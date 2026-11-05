/**
 * Brillo por estado (Hoy): SEK solo avisa en qué estado está cada tarjeta con `data-brillo`; el tema decide cómo se ve.
 * - pendiente: falta (el tema lo hace titilar en gris)
 * - hecho: cumplido (verde fijo)
 * - parcial: pasó el 1.er objetivo pero hay un 2.º (verde que sigue titilando)
 * - maximo: llegó al 2.º objetivo (verde más fuerte y fijo)
 * El desfase hace que no titilen todas juntas. Con «Brillo de pendientes» apagado no se pone nada.
 */
import type { CSSProperties } from 'react'

export type EstadoBrillo = 'pendiente' | 'hecho' | 'parcial' | 'maximo'

export function brillo(estado: EstadoBrillo | null, indice: number, activo: boolean): { 'data-brillo'?: EstadoBrillo; style?: CSSProperties } {
  if (!activo || !estado) return {}
  return { 'data-brillo': estado, style: { '--brillo-desfase': `${-((indice * 0.7) % 3).toFixed(2)}s` } as CSSProperties }
}
