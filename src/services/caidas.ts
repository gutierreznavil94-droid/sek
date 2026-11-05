/**
 * Caída y «Nuevo round». No es un reinicio: el día sigue igual. Saca XP (el precio de volver, editable, nunca baja de 0)
 * y deja una marca por día (la tumba rota) que se ve en Calendario, Progreso y el registro de batallas.
 * La escena la pone el tema con el evento genérico «caida».
 */
import { db } from '../data/db'
import type { Ajustes, Caida } from '../data/tipos'
import { claveXp, totalXp } from '../domain/xp'
import type { FechaDia } from '../domain/fechas'
import { obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

export const XP_CAIDA_POR_DEFECTO = 20
export const XP_CAIDA_MAX = 200
/** Cuánto dura «Deshacer» después de cerrar la escena. */
export const DESHACER_CAIDA_MS = 10_000

export function xpCaidaDe(a: Pick<Ajustes, 'caida'>): number {
  const v = a.caida?.xp
  if (v === undefined || !Number.isFinite(v)) return XP_CAIDA_POR_DEFECTO
  return Math.max(0, Math.min(XP_CAIDA_MAX, Math.round(v)))
}

/** Lo que se puede sacar sin dejar el total por debajo de 0. */
export function xpQueSaca(total: number, pedido: number): number {
  return Math.max(0, Math.min(pedido, Math.floor(total)))
}

/** Registra la caída: guarda la marca del día y, si hay XP, un registro negativo. */
export async function registrarCaida(fecha: FechaDia, origen: Caida['origen']): Promise<Caida> {
  const d = db()
  const a = await obtenerAjustes()
  const total = totalXp(await d.xp.toArray())
  const xp = xpQueSaca(total, xpCaidaDe(a))
  const c: Caida = { id: nuevoId(), fecha, instante: ahora(), origen, xp }
  await d.transaction('rw', [d.caidas, d.xp, d.eventos], async () => {
    await d.caidas.add(c)
    if (xp > 0) await d.xp.add({ clave: claveXp('caida', [c.id]), cantidad: -xp, origen: 'caida', fecha, creado: ahora(), descripcion: `Caída: −${xp} XP, el precio de volver` })
    await registrarEvento({ tipo: 'crear', entidad: 'caidas', entidadId: c.id, despues: c, motivo: 'No cumplí mi palabra' })
  })
  return c
}

/** Deshacer (los 10 s después de la escena): devuelve la XP y quita la marca. */
export async function deshacerCaida(id: string): Promise<boolean> {
  const d = db()
  return d.transaction('rw', [d.caidas, d.xp, d.eventos], async () => {
    const c = await d.caidas.get(id)
    if (!c) return false
    await d.caidas.delete(id)
    await d.xp.where('clave').equals(claveXp('caida', [id])).delete()
    await registrarEvento({ tipo: 'borrar', entidad: 'caidas', entidadId: id, antes: c, motivo: 'Deshacer caída' })
    return true
  })
}

export async function caidasDelDia(fecha: FechaDia): Promise<Caida[]> {
  return (await db().caidas.where('fecha').equals(fecha).toArray()).sort((x, y) => x.instante - y.instante)
}

/** Caídas por día entre dos fechas (para el Calendario). */
export async function caidasPorDia(desde: FechaDia, hasta: FechaDia): Promise<Map<FechaDia, number>> {
  const m = new Map<FechaDia, number>()
  for (const c of await db().caidas.where('fecha').between(desde, hasta, true, true).toArray()) m.set(c.fecha, (m.get(c.fecha) ?? 0) + 1)
  return m
}

/** Todas las caídas: «Caídas superadas: N» en Progreso. */
export async function todasLasCaidas(): Promise<Caida[]> {
  return (await db().caidas.toArray()).sort((x, y) => x.instante - y.instante)
}
