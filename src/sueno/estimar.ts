/**
 * Estimación simple de cada noche, sin reloj (v0.34):
 *   acostado  = «Dejo celu» (o la hora puesta a mano)
 *   dormido   = acostado + latencia (15 min por defecto; rango ±5: de 10 a 20)
 *   levantado = centro de la ventana habitual de 15 min (05:00–05:15 → 05:07:30)
 * La apertura del celu a la mañana ya no se usa para la hora de levantarse: solo cierra la noche.
 */

import type { FuenteSuenio } from '../data/tipos'
import { instanteDe, sumarDias, type FechaDia } from '../domain/fechas'

export const MINUTO = 60_000
/** La ventana de levantarse dura 15 minutos y se usa su centro. */
export const VENTANA_LEVANTARSE_MIN = 15
/** Margen del rango de «me dormí»: latencia ± 5 min. */
export const MARGEN_DORMIDO_MIN = 5
export const LATENCIA_MIN = 10
export const LATENCIA_MAX = 30

export const PRIORIDAD: Record<FuenteSuenio, number> = { estimado: 0, corregido: 1, reloj: 2 }

export function latenciaValida(min: number): number {
  return Math.max(LATENCIA_MIN, Math.min(LATENCIA_MAX, Math.round(min)))
}

export function dormidoEstimado(acostado: number, latenciaMin: number): number {
  return acostado + latenciaMin * MINUTO
}

/** «Dormido entre … y …»: latencia − 5 a latencia + 5 (nunca antes de acostarse). */
export function rangoDormido(acostado: number, latenciaMin: number): [number, number] {
  return [acostado + Math.max(0, latenciaMin - MARGEN_DORMIDO_MIN) * MINUTO, acostado + (latenciaMin + MARGEN_DORMIDO_MIN) * MINUTO]
}

/** Centro de la ventana de levantarse de la mañana siguiente a `noche`. */
export function levantadoEstimado(noche: FechaDia, inicioVentana: string, zona: string): number {
  return instanteDe(sumarDias(noche, 1), inicioVentana, zona) + (VENTANA_LEVANTARSE_MIN / 2) * MINUTO
}

/** «05:00» → «05:15». */
export function finVentana(inicio: string): string {
  const [h, m] = inicio.split(':').map(Number)
  const t = (h * 60 + m + VENTANA_LEVANTARSE_MIN) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export function minutosDormidos(dormido: number, levantado: number): number {
  return Math.max(0, Math.round((levantado - dormido) / MINUTO))
}

/** El dato de más prioridad entre varios (reloj > corregido > estimado). */
export function mejorDato<T extends { fuente: FuenteSuenio }>(datos: (T | undefined)[]): T | undefined {
  let mejor: T | undefined
  for (const d of datos) if (d && (!mejor || PRIORIDAD[d.fuente] > PRIORIDAD[mejor.fuente])) mejor = d
  return mejor
}
