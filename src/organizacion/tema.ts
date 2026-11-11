/**
 * Lo visual que Organización le pide a la app madre, siempre por nombre genérico.
 * Organización no sabe de qué tema se trata: pide «color-hecho», «icono-celu» o avisa «completar».
 * Si la app no responde algo, usa un respaldo simple (texto o color neutro).
 */
import type { DetalleEventoTema, NombreEventoTema } from './contrato-tema'

export interface TemaOrganizacion {
  /** Color por nombre genérico («color-principal», «color-hecho»…). '' = usar el de respaldo. */
  color(nombre: string): string
  /** Ícono por nombre genérico: un <svg> o un texto corto (kanji). '' = usar el de respaldo. */
  icono(nombre: string): string
  /** Evento visual genérico: el tema decide cómo se ve. */
  evento(nombre: NombreEventoTema, detalle: DetalleEventoTema): void
  /** Letra por nombre genérico («fuente-decorativa», la de kanjis y sellos), como en CSS font-family. '' = usar la de respaldo. */
  fuente?(nombre: string): string
}

/** Colores que usa Organización, la variable CSS donde quedan y un respaldo neutro (sin look de ningún tema). */
const COLORES: [string, string, string][] = [
  ['color-fondo', '--fr-fondo', '#141414'],
  ['color-tarjeta', '--fr-tarjeta', '#1c1c1c'],
  ['color-tarjeta-2', '--fr-tarjeta-2', '#262626'],
  ['color-borde', '--fr-borde', '#3a3a3a'],
  ['color-texto', '--fr-texto', '#eeeeee'],
  ['color-texto-2', '--fr-texto-2', '#b5b5b5'],
  ['color-texto-3', '--fr-texto-3', '#8a8a8a'],
  ['color-principal', '--fr-linea', '#5b8def'],
  ['color-hecho', '--fr-hecho', '#5fb37f'],
  ['color-aviso', '--fr-aviso', '#e0a23a'],
  ['color-con-alguien', '--fr-alguien', '#9b7bd4'],
  ['color-peligro', '--fr-peligro', '#ff8c8c'],
  ['color-papel', '--fr-papel', '#f2f2f2'],
  ['color-papel-2', '--fr-papel-2', '#dcdcdc'],
  ['color-tinta', '--fr-tinta', '#151515'],
  ['color-importancia-alta', '--fr-imp-alta', '#d9534f'],
  ['color-importancia-media', '--fr-imp-media', '#e0b23a'],
  ['color-importancia-baja', '--fr-imp-baja', '#8a8a8a'],
]

/** Letras que usa Organización, su variable CSS y el respaldo. */
const FUENTES: [string, string, string][] = [
  ['fuente-decorativa', '--fr-pincel', 'serif'],
]

/** Respaldo de íconos si el tema no tiene uno (texto simple). */
const RESPALDO: Record<string, string> = {
  'icono-importancia-alta': '■', 'icono-importancia-media': '▲', 'icono-importancia-baja': '●',
  'icono-rapida': '⚡', 'icono-lenta': '⏳', 'icono-celu': '📱', 'icono-compu': '💻', 'icono-calle': '👣',
  'icono-sin-donde': '◌', 'icono-yo': '●', 'icono-delegar': '→', 'icono-con-alguien': '∞', 'icono-flecha': '→',
  'icono-hecho': '✓', 'icono-por-hacer': '○', 'icono-libre': '~', 'icono-punto': '•', 'icono-sueltas': '~',
}

export interface TemaListo {
  /** Ícono (o su respaldo). Nunca vacío para los de RESPALDO. */
  I(nombre: string): string
  /** Kanji decorativo: vacío si el tema no usa kanjis. */
  K(nombre: string): string
  evento: TemaOrganizacion['evento']
  /** Pone los colores del tema como variables CSS en el elemento. */
  pintar(el: HTMLElement): void
}

const esTexto = (s: string) => !s.trim().startsWith('<')
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function prepararTema(t: Partial<TemaOrganizacion> = {}): TemaListo {
  const icono = (n: string) => { try { return t.icono?.(n) ?? '' } catch { return '' } }
  return {
    I(n) {
      const v = icono(n)
      if (!v) return `<span class="ico ico-txt" aria-hidden="true">${RESPALDO[n] ?? ''}</span>`
      return esTexto(v) ? `<span class="ico ico-txt" aria-hidden="true">${esc(v)}</span>` : v
    },
    K(n) {
      const v = icono(n)
      return v && esTexto(v) ? esc(v) : ''
    },
    evento(n, d) { try { t.evento?.(n, d) } catch { /* nunca rompe */ } },
    pintar(el) {
      for (const [nombre, variable, respaldo] of COLORES) {
        let v = ''
        try { v = t.color?.(nombre) ?? '' } catch { v = '' }
        el.style.setProperty(variable, v || respaldo)
      }
      for (const [nombre, variable, respaldo] of FUENTES) {
        let v = ''
        try { v = t.fuente?.(nombre) ?? '' } catch { v = '' }
        el.style.setProperty(variable, v || respaldo)
      }
      el.style.setProperty('--ico-hueco', 'var(--fr-fondo)')
    },
  }
}
