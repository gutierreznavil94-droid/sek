/**
 * Fruta del día: la manzana al lado de la cantimplora. Un toque suma 1 fruta; mantener apretado deshace.
 * Dos objetivos, como las series: el 1.º (por defecto 1 fruta) y el 2.º (por defecto 2). Sin XP.
 */
import { db } from '../data/db'
import type { ConfigFruta, TomaFruta } from '../data/tipos'
import { sumarDias, type FechaDia } from '../domain/fechas'
import { guardarAjustes, obtenerAjustes } from './base'
import { ahora, nuevoId } from './reloj'

export const FRUTA_DEFECTO: ConfigFruta = { nombre: 'Fruta', objetivo1: 1, objetivo2: 2 }

export async function configFruta(): Promise<ConfigFruta> {
  const a = await obtenerAjustes()
  return { ...FRUTA_DEFECTO, ...a.fruta }
}

export async function guardarConfigFruta(cambios: Partial<ConfigFruta>): Promise<ConfigFruta> {
  const nueva: ConfigFruta = { ...(await configFruta()), ...cambios }
  nueva.nombre = nueva.nombre.trim() || FRUTA_DEFECTO.nombre
  nueva.objetivo1 = Math.max(1, Math.round(nueva.objetivo1) || 1)
  nueva.objetivo2 = Math.max(nueva.objetivo1, Math.round(nueva.objetivo2) || nueva.objetivo1)
  await guardarAjustes({ fruta: nueva }, 'Fruta')
  return nueva
}

/** pendiente: no llegó al 1.º · cumplido: pasó el 1.º (sigue titilando) · superado: llegó al 2.º. */
export type EstadoFruta = 'pendiente' | 'cumplido' | 'superado'

export type FrutaDelDia = {
  n: number
  objetivo1: number
  objetivo2: number
  nombre: string
  estado: EstadoFruta
  /** 0..1: cuánto se comió la manzana (1 = solo el centro, al llegar al 2.º objetivo). */
  mordido: number
}

/** Cuánto se ve mordida la manzana: el 1.º objetivo ya muerde bastante (60 %), el 2.º deja solo el centro. */
export function mordidoDe(n: number, objetivo1: number, objetivo2: number): number {
  if (n <= 0) return 0
  if (n >= objetivo2) return 1
  if (n < objetivo1) return (n / objetivo1) * 0.6
  if (objetivo2 === objetivo1) return 1
  return 0.6 + ((n - objetivo1) / (objetivo2 - objetivo1)) * 0.4
}

export function estadoFruta(n: number, objetivo1: number, objetivo2: number): EstadoFruta {
  if (n >= objetivo2) return 'superado'
  if (n >= objetivo1) return 'cumplido'
  return 'pendiente'
}

export async function frutaDelDia(fecha: FechaDia): Promise<FrutaDelDia> {
  const c = await configFruta()
  const n = await db().frutas.where('fecha').equals(fecha).count()
  return { n, objetivo1: c.objetivo1, objetivo2: c.objetivo2, nombre: c.nombre, estado: estadoFruta(n, c.objetivo1, c.objetivo2), mordido: mordidoDe(n, c.objetivo1, c.objetivo2) }
}

export async function comerFruta(fecha: FechaDia): Promise<{ dia: FrutaDelDia; recienCumplido: boolean; recienSuperado: boolean }> {
  const antes = await frutaDelDia(fecha)
  const tomas = await db().frutas.where('fecha').equals(fecha).toArray()
  const ultimo = tomas.reduce((m, t) => Math.max(m, t.instante), 0)
  const toma: TomaFruta = { id: nuevoId('fruta-'), fecha, instante: Math.max(ahora(), ultimo + 1) }
  await db().frutas.add(toma)
  const dia = await frutaDelDia(fecha)
  return { dia, recienCumplido: antes.estado === 'pendiente' && dia.estado !== 'pendiente', recienSuperado: antes.estado !== 'superado' && dia.estado === 'superado' }
}

/** Resta la última fruta del día. */
export async function deshacerFruta(fecha: FechaDia): Promise<FrutaDelDia> {
  const tomas = await db().frutas.where('fecha').equals(fecha).toArray()
  const ultima = tomas.sort((a, b) => b.instante - a.instante)[0]
  if (ultima) await db().frutas.delete(ultima.id)
  return frutaDelDia(fecha)
}

/** Últimos días (del más viejo a hoy) con cuántas frutas, para el historial. */
export async function historialFruta(hoy: FechaDia, dias = 14): Promise<{ fecha: FechaDia; n: number; estado: EstadoFruta }[]> {
  const c = await configFruta()
  const desde = sumarDias(hoy, -(dias - 1))
  const tomas = await db().frutas.where('fecha').between(desde, hoy, true, true).toArray()
  const porDia = new Map<FechaDia, number>()
  for (const t of tomas) porDia.set(t.fecha, (porDia.get(t.fecha) ?? 0) + 1)
  const res: { fecha: FechaDia; n: number; estado: EstadoFruta }[] = []
  for (let f = desde; f <= hoy; f = sumarDias(f, 1)) { const n = porDia.get(f) ?? 0; res.push({ fecha: f, n, estado: estadoFruta(n, c.objetivo1, c.objetivo2) }) }
  return res
}
