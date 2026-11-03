/**
 * Primera vez: arma la app a medida de una persona nueva (pilares, horarios,
 * visión, tema) y arranca el ciclo de 90 días desde hoy. Solo se usa cuando la
 * base nunca tuvo un ciclo; a quien ya usa la app no le aparece.
 */

import { db } from '../data/db'
import { ACCIONES_INICIALES, rutinaDeEjemplo } from '../data/semilla'
import type { Accion } from '../data/tipos'
import { esHoraValida, type FechaDia } from '../domain/fechas'
import { temaPorId } from '../temas/temas'
import { guardarAccion } from './acciones'
import { guardarAjustes, guardarIdentidad, obtenerAjustes, registrarEvento } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes } from './dia'
import { borrarTodo } from './exportar'
import { ahora } from './reloj'

export const MAX_PILARES = 5
const TODOS = [0, 1, 2, 3, 4, 5, 6]

export type ClavePilar = 'entrenar' | 'dormir' | 'estudiar' | 'leer' | 'dibujar' | 'meditar' | 'proyecto' | 'pantalla' | 'otro'

/** Sugerencias del paso 3. `id` es la acción que se usa (las de Navil se reutilizan para no perder animaciones ni orden). */
export const SUGERENCIAS_PILARES: { clave: ClavePilar; nombre: string; id: string; dias: number[]; horaLimite?: string; minutos?: number; atributo: string; xp: number; pideHora: boolean; pideMinutos: boolean }[] = [
  { clave: 'entrenar', nombre: 'Entrenar', id: 'entrenamiento', dias: [1, 3, 5], horaLimite: '19:00', minutos: 30, atributo: 'fisico', xp: 30, pideHora: true, pideMinutos: true },
  { clave: 'dormir', nombre: 'Dormir a horario', id: 'acostarse', dias: TODOS, atributo: 'autocontrol', xp: 20, pideHora: false, pideMinutos: false },
  { clave: 'estudiar', nombre: 'Estudiar', id: 'p-estudiar', dias: [1, 2, 3, 4, 5], horaLimite: '20:00', minutos: 30, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'leer', nombre: 'Leer', id: 'p-leer', dias: TODOS, horaLimite: '21:00', minutos: 15, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'dibujar', nombre: 'Dibujar', id: 'manga', dias: TODOS, horaLimite: '20:50', minutos: 15, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'meditar', nombre: 'Meditar', id: 'p-meditar', dias: TODOS, horaLimite: '21:00', minutos: 10, atributo: 'autocontrol', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'proyecto', nombre: 'Proyecto propio', id: 'empresa', dias: TODOS, horaLimite: '20:50', atributo: 'disciplina', xp: 15, pideHora: true, pideMinutos: false },
  { clave: 'pantalla', nombre: 'Límite de pantalla', id: 'p-pantalla', dias: TODOS, horaLimite: '22:00', atributo: 'autocontrol', xp: 15, pideHora: true, pideMinutos: false },
  { clave: 'otro', nombre: 'Otro…', id: 'p-otro', dias: TODOS, horaLimite: '20:50', minutos: 15, atributo: 'disciplina', xp: 15, pideHora: true, pideMinutos: true },
]

export type EleccionPilar = { clave: ClavePilar; nombre: string; dias: number[]; horaLimite?: string; minutos?: number }

export type ConfigPrimeraVez = {
  hoy: FechaDia
  nombrePersona: string
  nombreApp: string
  tema: string
  pilares: EleccionPilar[]
  horarios: { alistarse: string; dejarCelu: string; dormir: string }
  vision: string
  obstaculo: string
}

/** ¿Hay que mostrar la primera vez? Solo si nunca hubo un ciclo y no se completó antes. */
export async function necesitaPrimeraVez(): Promise<boolean> {
  if ((await db().ciclos.count()) > 0) return false
  return !(await obtenerAjustes()).primeraVezHecha
}

export function validarPrimeraVez(c: ConfigPrimeraVez): string[] {
  const e: string[] = []
  if (!c.nombrePersona.trim()) e.push('Falta tu nombre.')
  if (c.pilares.length === 0) e.push('Elegí al menos un pilar.')
  if (c.pilares.length > MAX_PILARES) e.push(`Máximo ${MAX_PILARES} pilares.`)
  for (const p of c.pilares) {
    if (p.nombre.trim().length < 2) e.push('Cada pilar necesita un nombre.')
    if (p.dias.length === 0) e.push(`«${p.nombre}»: elegí al menos un día.`)
    if (p.horaLimite && !esHoraValida(p.horaLimite)) e.push(`«${p.nombre}»: la hora no es válida.`)
  }
  for (const h of [c.horarios.alistarse, c.horarios.dejarCelu, c.horarios.dormir]) if (!esHoraValida(h)) e.push('Revisá los horarios.')
  return [...new Set(e)]
}

function restarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number)
  const t = (((h * 60 + m - min) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Arma la acción de un pilar elegido. */
function accionDe(p: EleccionPilar, orden: number, indiceOtro: number, horarios: ConfigPrimeraVez['horarios']): { accion: Omit<Accion, 'creado'>; xp: number } {
  const s = SUGERENCIAS_PILARES.find((x) => x.clave === p.clave)!
  const base = ACCIONES_INICIALES.find((a) => a.id === s.id)
  const nombre = p.nombre.trim()
  const comun = { atributoIds: [s.atributo], objetivoIds: [], peso: 1, activa: true, pilar: true, orden, dias: [...p.dias].sort() }
  if (p.clave === 'entrenar') {
    const min = p.minutos ?? 30
    const hl = p.horaLimite ?? '19:00'
    return { xp: s.xp, accion: { ...base!, ...comun, nombre, tipo: 'entrenamiento', hora: hl, horaLimiteInicio: hl, avisoInicio: { activo: true, hora: restarMinutos(hl, 30) }, minutosMinimos: min, duracionMinutos: min, condicion: `Hacer el entrenamiento completo (${min} min) el día programado, empezando hasta las ${hl}. Los demás días el pilar muestra «Descanso».` } }
  }
  if (p.clave === 'dormir') {
    const h = horarios.dejarCelu
    return { xp: s.xp, accion: { ...base!, ...comun, nombre, tipo: 'acostarse', hora: h, horaLimite: h, condicion: `Tocar «Dejo celu» hasta las ${h} (celular lejos de la cama). Después queda como tarde con los minutos de retraso.` } }
  }
  const id = p.clave === 'otro' ? `p-otro-${indiceOtro}` : s.id
  const hl = p.horaLimite ?? s.horaLimite ?? '20:50'
  const min = s.pideMinutos ? p.minutos : undefined
  const condicion = p.clave === 'pantalla'
    ? `Respetar mi límite de pantalla. Marcar «Sí» hasta las ${hl}; después queda como tarde y no da XP.`
    : `${min ? `Al menos ${min} minutos. ` : ''}Marcar «Sí» hasta las ${hl}; después queda como tarde y no da XP.`
  return {
    xp: s.xp,
    accion: { id, nombre, tipo: 'compromiso', condicion, horaLimite: hl, minutosMinimos: min, ...(p.clave === 'proyecto' ? { pregunta: '¿Qué avancé?' } : {}), ...comun },
  }
}

/** Guarda todo lo elegido y arranca el ciclo de 90 días desde hoy. */
export async function configurarPrimeraVez(c: ConfigPrimeraVez): Promise<void> {
  const errores = validarPrimeraVez(c)
  if (errores.length) throw new Error(errores.join(' '))
  const d = db()
  const tema = temaPorId(c.tema)
  await guardarAjustes({
    nombrePersona: c.nombrePersona.trim(),
    nombreApp: c.nombreApp.trim() || 'SEK',
    tema: tema.id,
    nombrePersonaje: tema.personaje,
    horaAlistarse: c.horarios.alistarse,
    horaDejarCelu: c.horarios.dejarCelu,
    horaDormido: c.horarios.dormir,
    aMedida: true,
  }, 'Primera vez')
  await guardarIdentidad({ vision: c.vision.trim(), obstaculos: c.obstaculo.trim() })

  // Pilares: los de Navil que no se eligieron dejan de contar; los elegidos se arman con lo mínimo.
  const elegidos = c.pilares.map((p, i) => accionDe(p, i + 1, c.pilares.slice(0, i).filter((x) => x.clave === 'otro').length + 1, c.horarios))
  const ids = new Set(elegidos.map((e) => e.accion.id))
  for (const a of await d.acciones.toArray()) {
    if (!a.pilar || ids.has(a.id)) continue
    // «Dormir a horario» sigue funcionando para el modo sueño, pero sin ser pilar.
    await d.acciones.put({ ...a, pilar: false, activa: a.tipo === 'acostarse' })
  }
  for (const e of elegidos) {
    const existe = await d.acciones.get(e.accion.id)
    // Las acciones que ya existen conservan su XP; las nuevas reciben el de la sugerencia.
    await guardarAccion({ ...e.accion, minutosExtra: undefined, xpExtra: undefined }, existe ? undefined : e.xp, c.hoy)
  }

  // Entreno: si no hay sesiones, las rutinas de Navil se cambian por la de ejemplo.
  if ((await d.sesionesEntreno.count()) === 0) {
    const entrenar = c.pilares.find((p) => p.clave === 'entrenar')
    await d.transaction('rw', [d.rutinas, d.eventos], async () => {
      await d.rutinas.clear()
      await d.rutinas.put({ ...rutinaDeEjemplo(entrenar?.dias ?? [1, 3, 5]), creado: ahora() })
      await registrarEvento({ tipo: 'crear', entidad: 'rutina', entidadId: 'rutina-ejemplo', motivo: 'Primera vez: rutina de ejemplo' })
    })
  }
  // «Mi código» arranca vacío (los ejemplos eran de Navil).
  await d.codigo.clear()
  await guardarAjustes({ codigoSembrado: true, primeraVezHecha: true }, 'Primera vez: lista')

  await iniciarCiclo(c.hoy, { duracionDias: 90 })
  await cerrarDiasPendientes()
}

/** Borra todos los datos y las preferencias de este dispositivo: al recargar aparece la primera vez. */
export async function empezarDeCero(): Promise<void> {
  await borrarTodo()
  try { localStorage.clear() } catch { /* sin almacenamiento */ }
  try { sessionStorage.clear() } catch { /* sin almacenamiento */ }
}
