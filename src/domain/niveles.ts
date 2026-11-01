/**
 * Niveles.
 *
 * Fórmula explícita y configurable: pasar del nivel n al n+1 cuesta
 * `base × n` XP. Por tanto el XP total para llegar al nivel L es
 * `base × L × (L − 1) / 2`. Con base = 100: nivel 2 a 100 XP, nivel 3 a 300,
 * nivel 5 a 1.000, nivel 10 a 4.500. No hay tope.
 */

export const BASE_NIVEL_POR_DEFECTO = 100

export type EstadoNivel = {
  nivel: number
  xpTotal: number
  /** XP acumulado dentro del nivel actual. */
  xpEnNivel: number
  /** XP que pide el nivel actual para pasar al siguiente. */
  xpParaSiguiente: number
  /** XP total en que empieza el nivel actual. */
  xpInicioNivel: number
  /** XP total en que empieza el siguiente nivel. */
  xpInicioSiguiente: number
  /** 0..1 */
  progreso: number
}

/** XP total necesario para alcanzar el nivel `nivel` (nivel 1 = 0 XP). */
export function xpParaNivel(nivel: number, base = BASE_NIVEL_POR_DEFECTO): number {
  if (nivel <= 1) return 0
  return (base * nivel * (nivel - 1)) / 2
}

/** Nivel que corresponde a un XP total. */
export function nivelDesdeXp(xpTotal: number, base = BASE_NIVEL_POR_DEFECTO): number {
  if (xpTotal <= 0 || base <= 0) return 1
  // Resuelve base·L·(L−1)/2 ≤ xp. Se usa la raíz y luego se corrige por redondeo.
  let nivel = Math.floor((1 + Math.sqrt(1 + (8 * xpTotal) / base)) / 2)
  while (xpParaNivel(nivel + 1, base) <= xpTotal) nivel++
  while (nivel > 1 && xpParaNivel(nivel, base) > xpTotal) nivel--
  return Math.max(1, nivel)
}

export function estadoNivel(xpTotal: number, base = BASE_NIVEL_POR_DEFECTO): EstadoNivel {
  const xp = Math.max(0, Math.floor(xpTotal))
  const nivel = nivelDesdeXp(xp, base)
  const xpInicioNivel = xpParaNivel(nivel, base)
  const xpInicioSiguiente = xpParaNivel(nivel + 1, base)
  const xpParaSiguiente = xpInicioSiguiente - xpInicioNivel
  const xpEnNivel = xp - xpInicioNivel
  return {
    nivel,
    xpTotal: xp,
    xpEnNivel,
    xpParaSiguiente,
    xpInicioNivel,
    xpInicioSiguiente,
    progreso: xpParaSiguiente > 0 ? xpEnNivel / xpParaSiguiente : 0,
  }
}

/** Etiqueta sobria de etapa; el nivel siempre se muestra como número. */
export function etapaDeNivel(nivel: number): string {
  if (nivel < 5) return 'Inicio'
  if (nivel < 10) return 'Constancia'
  if (nivel < 15) return 'Consolidación'
  return 'Sostenido'
}

/** Tabla de progresión para mostrar en la interfaz. */
export function tablaNiveles(hasta: number, base = BASE_NIVEL_POR_DEFECTO): { nivel: number; xpTotal: number; etapa: string }[] {
  const filas = []
  for (let n = 1; n <= hasta; n++) filas.push({ nivel: n, xpTotal: xpParaNivel(n, base), etapa: etapaDeNivel(n) })
  return filas
}
