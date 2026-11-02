/**
 * Fuentes de sueño: cada una sabe «traer las noches entre dos fechas».
 * Hoy existe la fuente estimada (Dejo celu + latencia, ventana de levantarse,
 * correcciones a mano). Un reloj inteligente sería otra fuente con la misma
 * interfaz: las pantallas no cambian. Ver LEEME.md.
 */

import type { EtapaSuenio, FuenteSuenio } from '../../data/tipos'
import type { FechaDia } from '../../domain/fechas'

export type DatoSuenio = { valor: number; fuente: FuenteSuenio }

export type NocheDeFuente = {
  noche: FechaDia
  acostado?: DatoSuenio
  dormido?: DatoSuenio
  levantado?: DatoSuenio
  /** Etapas (ligero, profundo, REM, despierto) si la fuente las da. */
  etapas?: EtapaSuenio[]
  despertares?: number
}

export interface FuenteDeSuenio {
  id: string
  nombre: string
  /** Si está conectada y se puede leer. */
  disponible(): Promise<boolean>
  /** Noches entre `desde` y `hasta` (incluidas), por fecha de la noche. */
  traerNoches(desde: FechaDia, hasta: FechaDia): Promise<NocheDeFuente[]>
}
