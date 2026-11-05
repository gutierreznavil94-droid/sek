/**
 * Recordatorio tenue para alistarse a dormir: aparece en Hoy unos minutos antes de «Dejo celu»,
 * con una frase que rota cada noche. Un toque lo cierra por esa noche (queda en el teléfono).
 */
import type { Ajustes } from '../data/tipos'
import type { FechaDia } from '../domain/fechas'

export const MINUTOS_AVISO_DORMIR = 30

export const FRASES_DORMIR_DEFECTO = [
  'El shinobi apaga la lámpara. Alistate para dormir.',
  'La noche también entrena. Dejá el celu y descansá.',
  'Mañana se gana esta noche. Alistate para dormir.',
]

/** Frases vigentes: las del ajuste (sin vacías) o las de la app. */
export function frasesDormir(a: Pick<Ajustes, 'frasesDormir'>): string[] {
  const f = (a.frasesDormir ?? []).map((x) => x.trim()).filter(Boolean)
  return f.length ? f : FRASES_DORMIR_DEFECTO
}

/** La frase de una noche: rota por día (misma frase toda la noche). */
export function fraseDormir(a: Pick<Ajustes, 'frasesDormir'>, noche: FechaDia): string {
  const f = frasesDormir(a)
  const n = Math.round(Date.parse(noche) / 86_400_000)
  return f[((n % f.length) + f.length) % f.length]
}

/** Cuántos minutos antes de «Dejo celu» aparece (30 por defecto). */
export function minutosAvisoDormir(a: Pick<Ajustes, 'minutosAvisoDormir'>): number {
  return a.minutosAvisoDormir && a.minutosAvisoDormir > 0 ? a.minutosAvisoDormir : MINUTOS_AVISO_DORMIR
}

const CLAVE = 'sek-dormir-cerrado'

/** ¿Se cerró el recordatorio esta noche? Vive en el teléfono, no en los datos. */
export function avisoDormirCerrado(noche: FechaDia): boolean {
  try { return localStorage.getItem(CLAVE) === noche } catch { return false }
}

export function cerrarAvisoDormir(noche: FechaDia): void {
  try { localStorage.setItem(CLAVE, noche) } catch { /* sin almacenamiento */ }
}

/**
 * ¿Toca mostrarlo? Desde `minutos` antes de «Dejo celu» hasta que se cierra la ventana de la noche,
 * mientras no se haya marcado «Dejo celu» ni cerrado el aviso.
 */
export function mostrarAvisoDormir(x: { ahora: number; instDejarCelu: number; instFinCelu: number; minutos: number; dormirMarcado: boolean; noche: FechaDia }): boolean {
  if (x.dormirMarcado || avisoDormirCerrado(x.noche)) return false
  return x.ahora >= x.instDejarCelu - x.minutos * 60_000 && x.ahora < x.instFinCelu
}
