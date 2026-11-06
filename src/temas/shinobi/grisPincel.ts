/**
 * Fondo «gris pincel» del tema Shinobi (v0.66): la zona oscura es una aguada de tinta apenas más clara, así el shinobi
 * negro y el rival gris se ven con sus colores originales. Tres tonos para elegir en Más → Ver animaciones; queda
 * guardado en este teléfono. Los colores están en visual.css (html[data-gris="1|2|3"]).
 */
export const TONOS_GRIS = [
  { id: '1', nombre: 'Oscuro', color: '#2A2926' },
  { id: '2', nombre: 'Medio', color: '#33312E' },
  { id: '3', nombre: 'Claro', color: '#3C3A36' },
] as const
export type TonoGris = (typeof TONOS_GRIS)[number]['id']
export const TONO_POR_DEFECTO: TonoGris = '2'
const CLAVE = 'sek-gris-pincel'

export function tonoGris(): TonoGris {
  try {
    const v = localStorage.getItem(CLAVE)
    if (v === '1' || v === '2' || v === '3') return v
  } catch { /* sin almacenamiento */ }
  return TONO_POR_DEFECTO
}

export function elegirTonoGris(t: TonoGris): void {
  try { localStorage.setItem(CLAVE, t) } catch { /* sin almacenamiento: vale hasta cerrar */ }
  aplicarTonoGris(t)
}

export function aplicarTonoGris(t: TonoGris = tonoGris()): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.gris = t
  // La barra del teléfono sigue al fondo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', TONOS_GRIS.find((x) => x.id === t)?.color ?? '#33312E')
}

aplicarTonoGris()
