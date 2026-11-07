/**
 * Íconos SVG por nombre genérico. Sin React y sin nada de SEK.
 * Lo que un tema no tenga lo toma de Shinobi (el tema base); si tampoco está, devuelve vacío
 * y quien lo pide muestra su texto de respaldo.
 */
import { iconosShinobi } from './shinobi/iconos'

const porTema = new Map<string, Record<string, string>>([['shinobi', iconosShinobi]])
let temaActual = 'shinobi'

export function registrarIconos(temaId: string, iconos: Record<string, string>): void {
  porTema.set(temaId, iconos)
}

export function fijarTemaIconos(temaId: string): void {
  temaActual = temaId
}

/** `<svg>` listo para poner en la pantalla, o '' si ningún tema lo tiene. */
export function iconoSvg(nombre: string, temaId: string = temaActual): string {
  const cuerpo = porTema.get(temaId)?.[nombre] ?? iconosShinobi[nombre]
  if (!cuerpo) return ''
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`
}
