import { useSyncExternalStore } from 'react'
import { diferenciaDias, type FechaDia } from '../domain/fechas'
import config from './videos.json'

/**
 * Qué video de fondo se muestra en Progreso.
 *
 * - «intercalado» (el que se usa): ciclo de 2 días según la fecha de Córdoba.
 *   Día 1 lluvia, Día 2 rayos, Día 3 lluvia otra vez…
 * - «clima» (preparado, apagado): sigue el clima real de Córdoba. Mientras
 *   `clima.activo` sea false en videos.json, se comporta como «intercalado».
 * - «lluvia» / «rayos»: siempre el mismo.
 */
export type IdVideo = 'lluvia' | 'rayos'
export type ModoFondo = 'intercalado' | 'clima' | IdVideo
export interface VideoFondo { id: IdVideo; nombre: string; archivo: string; cuadroFijo: string; tipo: 'claro' | 'oscuro'; vidrio: number; destellos?: number[][] }

export const VIDEOS = config.videos as VideoFondo[]
/** Video horizontal para pantallas anchas (computadora): siempre el mismo, sin importar el día. */
export const VIDEO_PC = config.pc as unknown as VideoFondo
const CONSULTA_HORIZONTAL = '(min-aspect-ratio: 1/1) and (min-width: 900px)'
function esHorizontal(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_HORIZONTAL).matches
}
/** true en pantallas horizontales y anchas; se actualiza si cambia el tamaño de la ventana. */
export function usePantallaHorizontal(): boolean {
  return useSyncExternalStore((o) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const m = window.matchMedia(CONSULTA_HORIZONTAL)
    m.addEventListener('change', o)
    return () => m.removeEventListener('change', o)
  }, esHorizontal, () => false)
}
export const CICLO = config.cicloPorDia as IdVideo[]
export const CLIMA_ACTIVO: boolean = config.clima.activo
export const CON_MARCA_DE_AGUA: boolean = config.marcaDeAgua
export const VIDRIO_EN_DESTELLO: number = config.vidrioEnDestello

/** 0 fuera de un relámpago, 1 en pleno destello, con rampas de 0,15 s. */
export function intensidadDestello(t: number, destellos: number[][] | undefined): number {
  if (!destellos) return 0
  const r = 0.15
  let m = 0
  for (const [a, b] of destellos) {
    if (t >= a && t <= b) m = 1
    else if (t > a - r && t < a) m = Math.max(m, (t - (a - r)) / r)
    else if (t > b && t < b + r) m = Math.max(m, 1 - (t - b) / r)
  }
  return m
}

export function video(id: IdVideo): VideoFondo {
  return VIDEOS.find((v) => v.id === id) ?? VIDEOS[0]
}

/** Video del día en el ciclo (lluvia, rayos). `diaUno` es el Día 1 del ciclo (si no hay, la fecha de referencia). */
export function videoDelDia(hoy: FechaDia, diaUno: FechaDia = config.diaUnoReferencia): IdVideo {
  const n = diferenciaDias(diaUno, hoy)
  const i = ((n % CICLO.length) + CICLO.length) % CICLO.length
  return CICLO[i]
}

/**
 * Clima → video, con los códigos WMO que devuelve Open-Meteo:
 * 95–99 tormenta eléctrica → rayos; el resto → lluvia.
 */
export function videoSegunClima(codigoWmo: number | null | undefined): IdVideo {
  if (codigoWmo != null && codigoWmo >= 95 && codigoWmo <= 99) return 'rayos'
  return 'lluvia'
}

/** Elección final. `codigoClima` solo se usa si el modo clima está activado en videos.json. */
export function elegirVideo(modo: ModoFondo, hoy: FechaDia, diaUno?: FechaDia, codigoClima?: number | null): IdVideo {
  if (modo === 'lluvia' || modo === 'rayos') return modo
  if (modo === 'clima' && CLIMA_ACTIVO && codigoClima != null) return videoSegunClima(codigoClima)
  return videoDelDia(hoy, diaUno)
}

// Preferencia guardada en este teléfono (como la franja).
const oyentes = new Set<() => void>()
const MODOS: ModoFondo[] = ['intercalado', 'clima', 'lluvia', 'rayos']
export function modoFondo(): ModoFondo {
  try {
    const v = localStorage.getItem('fondoVideo') as ModoFondo | null
    if (v && MODOS.includes(v)) return v
  } catch { /* sin almacenamiento */ }
  return 'intercalado'
}
export function elegirModoFondo(m: ModoFondo): void {
  try { localStorage.setItem('fondoVideo', m) } catch { /* sin almacenamiento */ }
  for (const o of oyentes) o()
}
export function useModoFondo(): ModoFondo {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, modoFondo, () => 'intercalado')
}
