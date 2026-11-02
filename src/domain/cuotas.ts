/** Cuotas de las series rápidas: cuota (primer tope) y extra (segundo tope), con su historial. */

import type { Contador } from '../data/tipos'
import type { FechaDia } from './fechas'

/** Extra por defecto: 1,5 × la cuota, redondeado para arriba. */
export function extraPorDefecto(cuota: number): number {
  return Math.ceil(cuota * 1.5)
}

/** Series por día: lo guardado o, en datos viejos, cuota ÷ reps por serie (5 por defecto). */
export function seriesDe(c: Pick<Contador, 'seriesPorDia' | 'metaDiaria' | 'cantidadPorToque'>): number {
  if (c.seriesPorDia && c.seriesPorDia > 0) return c.seriesPorDia
  const n = c.cantidadPorToque > 0 ? Math.round(c.metaDiaria / c.cantidadPorToque) : 0
  return n > 0 ? n : 5
}

/** Cuántas reps por serie sube cuando la app propone subir (1 por defecto). */
export function pasoDeSubida(c: Contador): number {
  return c.pasoReps ?? 1
}

/** Cuota y extra para unas reps por serie y unas series por día. */
export function cuotaDeSeries(reps: number, series: number): { cuota: number; extra: number } {
  const cuota = reps * series
  return { cuota, extra: extraPorDefecto(cuota) }
}

/** Reps por serie que valían ese día. */
export function repsDelDia(c: Contador, fecha: FechaDia): number {
  const h = c.historialCuota
  if (!h || h.length === 0) return c.cantidadPorToque
  let v = h[0]
  for (const x of h) if (x.desde <= fecha) v = x
  return v.porToque ?? c.cantidadPorToque
}

/** Escalones de reps por serie: el valor inicial y cada cambio con su fecha. */
export function subidasDeReps(c: Contador): { desde: FechaDia; reps: number }[] {
  const h = c.historialCuota ?? []
  const r: { desde: FechaDia; reps: number }[] = []
  for (const x of h) {
    const reps = x.porToque ?? c.cantidadPorToque
    if (r.length && r[r.length - 1].reps === reps) continue
    r.push({ desde: x.desde, reps })
  }
  if (!r.length) r.push({ desde: '0000-01-01', reps: c.cantidadPorToque })
  return r
}

/** Cuota y extra que valían ese día (los cambios valen desde su fecha en adelante). */
export function cuotaDelDia(c: Contador, fecha: FechaDia): { cuota: number; extra: number } {
  const h = c.historialCuota
  if (!h || h.length === 0) return { cuota: c.metaDiaria, extra: c.metaExtra ?? extraPorDefecto(c.metaDiaria) }
  let v = h[0]
  for (const x of h) if (x.desde <= fecha) v = x
  return { cuota: v.cuota, extra: v.extra }
}

/** Historial sin el registro inicial: las subidas de cuota con su fecha. */
export function subidasDeCuota(c: Contador): { desde: FechaDia; cuota: number }[] {
  const h = c.historialCuota ?? []
  const r: { desde: FechaDia; cuota: number }[] = []
  for (const x of h) {
    if (r.length && r[r.length - 1].cuota === x.cuota) continue
    r.push({ desde: x.desde, cuota: x.cuota })
  }
  return r
}

