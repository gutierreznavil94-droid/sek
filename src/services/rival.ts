/**
 * El rival escurridizo: cuando se dispara una distracción (pilar por vencer, noche, juego, «Dudo»), en vez de la carta
 * aparece un muñequito gris en Hoy con el nombre de la distracción. Se lo toca: el shinobi corre y salta; al azar se
 * escabulle 0, 1 o 2 veces (50 / 35 / 15 %). Al atraparlo arranca la batalla (batalla.ts).
 * Si se lo ignora (60 s, o cerrar la app con el rival en pantalla), avisa rompiendo la pantalla (10 s para atraparlo)
 * y después roba XP: 10 por defecto (editable, 0 a 30), nunca baja de nivel. Es la única penalización de la app.
 */
import { db } from '../data/db'
import type { Ajustes, MomentoNinja, PeleaNinja } from '../data/tipos'
import { estadoNivel } from '../domain/niveles'
import { claveXp, totalXp } from '../domain/xp'
import type { FechaDia } from '../domain/fechas'
import { obtenerAjustes, registrarEvento } from './base'
import { distraccionesDe, registrarPelea, type Pelea } from './ninjas'
import { ahora } from './reloj'

export const XP_ROBO_POR_DEFECTO = 10
export const XP_ROBO_MAX = 30
export const ESCAPES_MAX = 2
/** Sin tocarlo este tiempo, avisa que va a robar. */
export const TIEMPO_IGNORADO_MS = 60_000
/** Cuánto dura la advertencia antes del robo. */
export const TIEMPO_ADVERTENCIA_MS = 10_000

export type ModoRival = 'escurridizo' | 'carta'

/** Cómo aparece una distracción: el rival escurridizo (si falta) o la carta directa. */
export function modoRival(a: Pick<Ajustes, 'rival'>): ModoRival {
  return a.rival?.modo === 'carta' ? 'carta' : 'escurridizo'
}

/** XP que roba: 10 si falta, siempre entre 0 y 30. */
export function xpRoboDe(a: Pick<Ajustes, 'rival'>): number {
  const v = a.rival?.xpRobo
  if (v === undefined || v === null || Number.isNaN(v)) return XP_ROBO_POR_DEFECTO
  return Math.max(0, Math.min(XP_ROBO_MAX, Math.round(v)))
}

/** Cuántas veces se escabulle antes de que lo atrapen: 0 (50 %), 1 (35 %) o 2 (15 %). Nunca más de 2. */
export function sortearEscapes(azar: () => number = Math.random): number {
  const r = azar()
  if (r < 0.5) return 0
  if (r < 0.85) return 1
  return ESCAPES_MAX
}

/** Cuánto se puede descontar sin bajar de nivel: lo que sobra desde el inicio del nivel actual. */
export function roboPosible(xpTotal: number, cantidad: number, base?: number): number {
  const e = estadoNivel(xpTotal, base)
  return Math.max(0, Math.min(cantidad, e.xpTotal - e.xpInicioNivel))
}

export type ResultadoRobo = { pelea: PeleaNinja; robado: number; pedido: number }

/** El rival se llevó XP: sello del día («escapó» con el robo) y un registro negativo de XP. Nunca baja de nivel. */
export async function robarXp(p: Pelea, cantidad?: number): Promise<ResultadoRobo> {
  const d = db()
  const a = await obtenerAjustes()
  const pedido = cantidad ?? xpRoboDe(a)
  const total = totalXp(await d.xp.toArray())
  const robado = roboPosible(total, pedido, a.baseNivel)
  const pelea = await registrarPelea(p, 'escapo', robado > 0 ? { robo: robado } : {})
  if (robado > 0) {
    const clave = claveXp('rival', [p.fecha, pelea.id ?? ahora()])
    await d.xp.add({ clave, cantidad: -robado, origen: 'rival', fecha: p.fecha, creado: ahora(), descripcion: `${p.distraccion.nombre} se llevó ${robado} XP` })
    await registrarEvento({ tipo: 'anular_xp', entidad: 'xp', entidadId: clave, motivo: `Robo del rival ${p.distraccion.nombre}`, despues: { cantidad: -robado } })
  }
  return { pelea, robado, pedido }
}

// ---------- Rival pendiente (sobrevive a cerrar la app) ----------

const CLAVE_PENDIENTE = 'rival-pendiente'

export type RivalPendiente = { fecha: FechaDia; distraccionId: string; momento: MomentoNinja; pilar?: { id: string; nombre: string; entreno?: boolean }; desde: number }

export function guardarRivalPendiente(p: Pelea, desde: number = ahora()): void {
  const x: RivalPendiente = { fecha: p.fecha, distraccionId: p.distraccion.id, momento: p.momento.momento, pilar: p.momento.pilar, desde }
  try { localStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(x)) } catch { /* sin almacenamiento */ }
}

export function rivalPendiente(): RivalPendiente | null {
  try {
    const v = localStorage.getItem(CLAVE_PENDIENTE)
    if (!v) return null
    const x = JSON.parse(v) as RivalPendiente
    return x && x.fecha && x.distraccionId ? x : null
  } catch { return null }
}

export function limpiarRivalPendiente(): void {
  try { localStorage.removeItem(CLAVE_PENDIENTE) } catch { /* sin almacenamiento */ }
}

/** Reconstruye la pelea del rival pendiente (si la distracción sigue en la lista; si no, con el id como nombre). */
export async function peleaPendiente(): Promise<Pelea | null> {
  const x = rivalPendiente()
  if (!x) return null
  const lista = distraccionesDe(await obtenerAjustes())
  const distraccion = lista.find((d) => d.id === x.distraccionId) ?? { id: x.distraccionId, nombre: x.distraccionId }
  return { fecha: x.fecha, distraccion, momento: { momento: x.momento, pilar: x.pilar } }
}

/** Texto del sello en Hoy cuando el rival robó. */
export function selloRobo(nombre: string, p: Pick<PeleaNinja, 'robo'>): string {
  return `${nombre} se llevó ${p.robo ?? 0} XP`
}
