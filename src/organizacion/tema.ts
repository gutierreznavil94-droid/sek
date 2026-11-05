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
}

/** Colores que usa Organización y la variable CSS donde quedan. */
const COLORES: [string, string, string][] = [
  ['color-fondo', '--fr-fondo', '#121110'],
  ['color-tarjeta', '--fr-tarjeta', '#1b1918'],
  ['color-tarjeta-2', '--fr-tarjeta-2', '#262321'],
  ['color-borde', '--fr-borde', '#3A3836'],
  ['color-texto', '--fr-texto', '#EEECE7'],
  ['color-texto-2', '--fr-texto-2', '#b9b4ac'],
  ['color-texto-3', '--fr-texto-3', '#8E8A84'],
  ['color-principal', '--fr-linea', '#C8102E'],
  ['color-hecho', '--fr-hecho', '#78BD97'],
  ['color-aviso', '--fr-aviso', '#e0a23a'],
  ['color-con-alguien', '--fr-alguien', '#9b7bd4'],
  ['color-papel', '--fr-papel', '#F1EBDF'],
  ['color-tinta', '--fr-tinta', '#121110'],
  ['color-importancia-alta', '--fr-imp-alta', '#d2384f'],
  ['color-importancia-media', '--fr-imp-media', '#e0b23a'],
  ['color-importancia-baja', '--fr-imp-baja', '#8E8A84'],
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
      el.style.setProperty('--ico-hueco', 'var(--fr-fondo)')
    },
  }
}
