/** Cuotas de las series rápidas: cuota (primer tope) y extra (segundo tope), con su historial. */

import type { Contador } from '../data/tipos'
import type { FechaDia } from './fechas'

/** Extra por defecto: 1,5 × la cuota, redondeado para arriba. */
export function extraPorDefecto(cuota: number): number {
  return Math.ceil(cuota * 1.5)
}

/** Cuánto sube la cuota cuando la app propone subirla. */
export function pasoDeSubida(c: Contador): number {
  return c.pasoSubida ?? Math.max(1, Math.round(c.metaDiaria * 0.07))
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

