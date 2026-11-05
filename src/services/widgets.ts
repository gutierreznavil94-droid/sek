/**
 * Widgets de Android: los datos que se les pasan (el día, la racha, los pilares, el agua y Mi horario) y lo que
 * se marcó desde el widget con la app cerrada, que se aplica al abrir la app.
 * Lo visual del widget vive en Android; los colores e íconos se piden al tema por nombre genérico.
 */
import { db } from '../data/db'
import type { FechaDia } from '../domain/fechas'
import { colorTema, iconoTema } from '../temas/temas'
import type { AccionWidget } from '../nativo/sek'
import { aguaDelDia, configAgua, tomarAgua } from './agua'
import { cicloActivo } from './ciclo'
import { completarCompromiso, pilaresDelDia, rachaActual } from './dia'
import { horarioActivo } from './horario'

export type PilarWidget = { id: string; nombre: string; estado: 'hecho' | 'pendiente' | 'descanso'; marcable: boolean; dias: number[] }
export type DatosWidget = {
  fecha: FechaDia
  inicio: FechaDia | null
  dias: number
  racha: number
  pilares: PilarWidget[]
  agua: { ml: number; objetivo: number; vasoMl: number }
  /** Mi horario por día de la semana (0 dom..6 sáb): nombre, desde y hasta. */
  horario: Record<string, { n: string; d: string; h: string }[]>
  colores: Record<string, string>
  iconos: Record<string, string>
}

export async function datosWidget(hoy: FechaDia): Promise<DatosWidget> {
  const ciclo = await cicloActivo()
  const { pilares } = ciclo ? await pilaresDelDia(hoy) : { pilares: [] }
  const agua = await aguaDelDia(hoy)
  const { principal } = await configAgua()
  const horario: DatosWidget['horario'] = {}
  for (const b of (await horarioActivo()).bloques) {
    for (const d of b.dias) (horario[String(d)] ??= []).push({ n: b.nombre, d: b.desde, h: b.hasta })
  }
  for (const k of Object.keys(horario)) horario[k].sort((a, b) => a.d.localeCompare(b.d))
  return {
    fecha: hoy,
    inicio: ciclo?.inicio ?? null,
    dias: ciclo?.duracionDias ?? 90,
    racha: ciclo ? await rachaActual(hoy) : 0,
    pilares: pilares.map((p) => ({
      id: p.accion.id,
      nombre: p.accion.nombre,
      estado: p.estado === 'cumplido' || p.estado === 'tarde' ? 'hecho' : p.estado === 'descanso' || p.estado === 'omitido' ? 'descanso' : 'pendiente',
      // «Dormir a horario» se marca con «Dejo celu» (abre la app); el resto, desde el widget.
      marcable: p.estado === 'pendiente' && !!p.compromiso && p.accion.tipo !== 'acostarse',
      dias: p.accion.dias,
    })),
    agua: { ml: agua.ml, objetivo: agua.objetivo, vasoMl: principal.ml },
    horario,
    colores: Object.fromEntries(['color-papel', 'color-tinta', 'color-tinta-suave', 'color-principal'].map((n) => [n, colorTema(n)])),
    iconos: Object.fromEntries(['icono-racha', 'icono-agua', 'icono-hoy'].map((n) => [n, iconoTema(n)])),
  }
}

/** Aplica lo marcado en el widget. Devuelve cuántas cosas se aplicaron. Lo de otro día se descarta. */
export async function aplicarAccionesWidget(acciones: AccionWidget[], hoy: FechaDia, fechaDe: (t: number) => FechaDia): Promise<number> {
  let n = 0
  for (const a of acciones) {
    const dia = fechaDe(a.instante)
    if (dia !== hoy) continue
    try {
      if (a.tipo === 'vaso') { await tomarAgua(hoy); n++; continue }
      const c = await db().compromisos.get(`${a.id}:${hoy}`)
      if (!c || (c.estado !== 'pendiente' && c.estado !== 'iniciado')) continue
      const accion = await db().acciones.get(a.id)
      const minutos = accion?.tipo === 'entrenamiento' ? accion.duracionMinutos ?? accion.minutosMinimos : undefined
      await completarCompromiso(c.id, { instante: a.instante, ...(minutos ? { minutos } : {}) })
      n++
    } catch {
      // Si algo ya no aplica (pilar borrado, hora vencida), se saltea.
    }
  }
  return n
}
