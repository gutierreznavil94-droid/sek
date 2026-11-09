/**
 * Reglas de XP.
 *
 * - Cada registro de XP tiene una clave única (`clave`). El índice único en la
 *   base de datos garantiza que el mismo evento no sume dos veces.
 * - La cantidad se congela en el registro: cambiar una regla después no
 *   recalcula lo ganado.
 * - No existe XP negativo, salvo el robo del rival escurridizo (origen «rival», chico y editable,
 *   nunca baja de nivel), la caída y lo no cumplido (origen «resta», v0.83). Las correcciones se registran como anulación (`anulado: true`) y quedan en el historial.
 */

import type { FechaDia } from './fechas'

export type OrigenXp =
  | 'compromiso'
  | 'dia0'
  | 'entrenamiento'
  | 'suenio'
  | 'juego'
  | 'inicio'
  | 'revision'
  | 'semana'
  | 'racha7'
  | 'meta'
  | 'contador'
  | 'extra'
  | 'manual'
  | 'rival'
  | 'caida'
  | 'forja'
  | 'resta'

export type ReglaXp = {
  id: string
  accionId: string
  xp: number
  /** Máximo de recompensas por periodo. */
  maximo: number
  periodo: 'dia' | 'semana' | 'compromiso'
  /** Fecha (AAAA-MM-DD) desde la que aplica; las reglas anteriores siguen en historial. */
  validaDesde: FechaDia
}

/** Construye la clave única de un evento de XP. */
export function claveXp(origen: OrigenXp, partes: (string | number)[]): string {
  return [origen, ...partes.map(String)].join(':')
}

/** Devuelve la regla vigente en una fecha, o null si ninguna aplica aún. */
export function reglaVigente<T extends { validaDesde: FechaDia }>(reglas: T[], fecha: FechaDia): T | null {
  let mejor: T | null = null
  for (const r of reglas) {
    if (r.validaDesde <= fecha && (!mejor || r.validaDesde > mejor.validaDesde)) mejor = r
  }
  return mejor
}

export type RegistroXp = {
  id?: number
  clave: string
  cantidad: number
  origen: OrigenXp
  reglaId?: string
  /** Fecha de calendario a la que pertenece. */
  fecha: FechaDia
  /** Instante de registro. */
  creado: number
  descripcion: string
  anulado?: boolean
  anuladoEn?: number
  motivoAnulacion?: string
}

/** Suma del XP válido (no anulado). Nunca baja de 0. Los únicos descuentos son el robo del rival, la caída (el precio de volver) y lo no cumplido (resta). */
export function totalXp(registros: (Pick<RegistroXp, 'cantidad' | 'anulado'> & { origen?: OrigenXp })[]): number {
  let total = 0
  for (const r of registros) if (!r.anulado) total += r.origen === 'rival' || r.origen === 'caida' || r.origen === 'resta' ? r.cantidad : Math.max(0, r.cantidad)
  return Math.max(0, total)
}

/**
 * Cuenta cuántas recompensas no anuladas de un origen ya hay en un periodo.
 * Útil para aplicar `maximo` (ej. 3 inicios con 3-2-1 por día).
 */
export function contarEnPeriodo(registros: RegistroXp[], origen: OrigenXp, fechas: FechaDia[]): number {
  const set = new Set(fechas)
  return registros.filter((r) => r.origen === origen && !r.anulado && set.has(r.fecha)).length
}
