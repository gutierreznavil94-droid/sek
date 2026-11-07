/**
 * Duelo quieto (v0.85): al alcanzar al rival, al final de Tensión y después de «No cumplí», el shinobi y el rival
 * quedan frente a frente y se piden las flexiones de la serie rápida. Esas flexiones cuentan como una serie hecha
 * (con su XP, igual que cargarla a mano). «No cumplí» pide la serie más la mitad. Sin serie de flexiones: 10 (editable).
 */
import type { Contador } from '../data/tipos'
import { obtenerAjustes } from './base'
import { configBatalla } from './batalla'
import { sumarToque } from './contadores'

export type MotivoDuelo = 'rival' | 'tension' | 'caida'
export const REPS_SIN_SERIE = 10

/** Cuántas flexiones pide: la serie (reps por serie del contador), o la serie más la mitad después de una caída. */
export function repsDuelo(repsSerie: number | null | undefined, motivo: MotivoDuelo, sinSerie: number = REPS_SIN_SERIE): number {
  const base = repsSerie && repsSerie > 0 ? Math.round(repsSerie) : Math.max(1, Math.round(sinSerie) || REPS_SIN_SERIE)
  return motivo === 'caida' ? base + Math.ceil(base / 2) : base
}

export type ConfigDuelo = { motivo: MotivoDuelo; reps: number; contador: Contador | null; nombre: string }

/** El contador de flexiones (el de la batalla) y las reps que tocan. */
export async function configDuelo(motivo: MotivoDuelo): Promise<ConfigDuelo> {
  const a = await obtenerAjustes()
  const { contador } = await configBatalla()
  const reps = repsDuelo(contador?.cantidadPorToque, motivo, a.batalla?.repsSinSerie ?? REPS_SIN_SERIE)
  return { motivo, reps, contador, nombre: contador?.nombre ?? 'Flexiones' }
}

const NOTA: Record<MotivoDuelo, string> = { rival: 'Duelo con el rival', tension: 'Tensión: avancé igual', caida: 'Caída: nuevo round' }

/** Hechas: una serie en el contador con esas reps (su XP, sus topes). Sin contador no anota nada. */
export async function anotarDuelo(c: ConfigDuelo, reps = c.reps): Promise<{ xp: number; nuevoNivel: number | null }> {
  if (!c.contador) return { xp: 0, nuevoNivel: null }
  const r = await sumarToque(c.contador.id, reps, NOTA[c.motivo])
  return { xp: r.xp, nuevoNivel: r.nuevoNivel }
}
