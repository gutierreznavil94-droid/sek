/**
 * Revisión diaria (menos de 2 minutos), semanal y de fase.
 * Cada revisión guarda una "foto" de los números del momento.
 */

import { db } from '../data/db'
import type { Revision, TipoRevision } from '../data/tipos'
import { lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { registrarEvento } from './base'
import { completarCompromiso, idCompromiso, cumplimientoEntre, atributosHoy, cumplimientoPorDia } from './dia'
import { iniciosEntre } from './inicios'
import { resumenJuego } from './juego'
import { aperturasEnSuenioEntre } from './suenio'
import { ahora, nuevoId } from './reloj'
import { xpDelDia } from './xp'

export async function obtenerRevision(tipo: TipoRevision, periodo: string): Promise<Revision | undefined> {
  return db().revisiones.where('[tipo+periodo]').equals([tipo, periodo]).first()
}

/** Guarda (o actualiza) una revisión. La primera vez completa el compromiso correspondiente y da su XP. */
export async function guardarRevision(tipo: TipoRevision, periodo: string, respuestas: Record<string, string>, foto: Record<string, unknown>): Promise<{ revision: Revision; xp: number; nuevoNivel: number | null }> {
  const d = db()
  const previa = await obtenerRevision(tipo, periodo)
  const revision: Revision = previa
    ? { ...previa, respuestas, foto: previa.foto, actualizado: ahora() }
    : { id: nuevoId('rev'), tipo, periodo, respuestas, foto, creado: ahora(), actualizado: ahora() }
  await d.transaction('rw', [d.revisiones, d.eventos], async () => {
    await d.revisiones.put(revision)
    await registrarEvento({ tipo: previa ? 'editar' : 'crear', entidad: 'revision', entidadId: revision.id, antes: previa, despues: revision })
  })
  let xp = 0
  let nuevoNivel: number | null = null
  if (!previa) {
    const accionId = tipo === 'diaria' ? 'revision_diaria' : tipo === 'semanal' ? 'revision_semanal' : null
    if (accionId) {
      // Para la semanal, el compromiso es el del domingo de esa semana.
      const fecha = tipo === 'semanal' ? sumarDias(periodo, 6) : periodo
      const id = idCompromiso(accionId, fecha)
      let c = await d.compromisos.get(id)
      if (!c) {
        c = { id, accionId, fecha, estado: 'pendiente', actualizado: ahora() }
        await d.compromisos.add(c)
      }
      if (c.estado !== 'completado') {
        const r = await completarCompromiso(id)
        xp = r.xp
        nuevoNivel = r.nuevoNivel
      }
    }
  }
  return { revision, xp, nuevoNivel }
}

/** Datos que la revisión semanal muestra: todo sale de registros, nada inventado. */
export type DatosSemana = {
  lunes: FechaDia
  domingo: FechaDia
  cumplimiento: { cumplidos: number; programados: number; porcentaje: number | null }
  entrenamientos: { previstos: number; hechos: number }
  descanso: { noches: number; cumplidas: number; retrasoMedio: number | null }
  juego: { minutos: number; diasSobreLimite: number; limite: number }
  inicios: number
  /** Veces que se abrió la app en modo sueño esa semana (dato honesto, sin XP). */
  aperturasSuenio: number
  xp: number
  atributos: { id: string; nombre: string; valor: number | null; tendencia: number | null }[]
  porDia: { fecha: FechaDia; porcentaje: number | null }[]
}

export async function datosSemana(fechaEnSemana: FechaDia, hoy: FechaDia): Promise<DatosSemana> {
  const d = db()
  const lunes = lunesDe(fechaEnSemana)
  const domingo = sumarDias(lunes, 6)
  const c = await cumplimientoEntre(lunes, domingo, hoy)
  const comps = await d.compromisos.where('fecha').between(lunes, domingo, true, true).toArray()
  const entren = comps.filter((x) => x.accionId === 'entrenamiento' && x.estado !== 'reprogramado')
  const noches = await d.suenio.where('noche').between(lunes, domingo, true, true).toArray()
  const nochesProg = comps.filter((x) => x.accionId === 'acostarse').length
  const juego = await resumenJuego(hoy)
  let minutos = 0
  let sobre = 0
  for (let i = 0; i < 7; i++) {
    const m = juego.porDia.get(sumarDias(lunes, i)) ?? 0
    minutos += m
    if (m > (juego.limitesPorDia.get(sumarDias(lunes, i)) ?? juego.limiteMinutos)) sobre++
  }
  const aperturasSuenio = (await aperturasEnSuenioEntre(Date.parse(lunes) - 86_400_000, Date.parse(domingo) + 86_400_000 * 2)).length
  const inicios = (await iniciosEntre(Date.parse(lunes) - 86_400_000 * 2, Date.parse(domingo) + 86_400_000 * 2)).filter((i) => i.iniciado).length
  let xp = 0
  const porDia: { fecha: FechaDia; porcentaje: number | null }[] = []
  const mapa = await cumplimientoPorDia(lunes, domingo, hoy)
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i)
    for (const r of await xpDelDia(f)) xp += r.cantidad
    porDia.push({ fecha: f, porcentaje: f > hoy ? null : (mapa.get(f)?.porcentaje ?? null) })
  }
  const atributos = (await atributosHoy(hoy > domingo ? domingo : hoy)).map((a) => ({ id: a.atributoId, nombre: a.nombre, valor: a.valor, tendencia: a.tendencia }))
  return {
    lunes,
    domingo,
    cumplimiento: c,
    entrenamientos: { previstos: entren.length, hechos: entren.filter((x) => x.estado === 'completado').length },
    descanso: {
      noches: Math.max(nochesProg, noches.length),
      cumplidas: noches.filter((n) => n.cumplido).length,
      retrasoMedio: noches.length ? Math.round(noches.reduce((s, n) => s + n.retrasoMinutos, 0) / noches.length) : null,
    },
    juego: { minutos: Math.round(minutos), diasSobreLimite: sobre, limite: juego.limiteSemana },
    inicios,
    aperturasSuenio,
    xp,
    atributos,
    porDia,
  }
}
