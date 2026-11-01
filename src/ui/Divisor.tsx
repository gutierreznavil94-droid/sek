import { useMemo, useSyncExternalStore } from 'react'

/**
 * Franja que divide lo claro (papel) de lo oscuro (tinta), como una pincelada
 * ancha con poca tinta. Tres variantes; la elegida es «pincel». Es un SVG
 * fijo (siempre igual, no al azar) que se estira al ancho de la pantalla.
 *
 * - pincel: rayas horizontales irregulares que salen del negro y se deshilachan hacia el papel.
 * - trama: líneas finas de manga que se van juntando hasta volverse negro.
 * - diagonal: corte en diagonal con salpicaduras de tinta.
 *
 * `fondo` «papel» pinta el papel detrás (para la cabecera); «ninguno» deja
 * transparente lo que no es tinta (para apoyarla sobre el video).
 */
export type VarianteDivisor = 'pincel' | 'trama' | 'diagonal'

const oyentes = new Set<() => void>()
/** Cambia la franja en toda la app al instante (se guarda en este teléfono). */
export function elegirDivisor(v: VarianteDivisor): void {
  try { localStorage.setItem('divisor', v) } catch { /* sin almacenamiento */ }
  for (const o of oyentes) o()
}
export function useVarianteDivisor(): VarianteDivisor {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, varianteDivisor, () => 'pincel')
}

export function varianteDivisor(): VarianteDivisor {
  try {
    const v = localStorage.getItem('divisor')
    if (v === 'trama' || v === 'diagonal' || v === 'pincel') return v
  } catch { /* sin almacenamiento */ }
  return 'pincel'
}

// Generador determinista (siempre la misma franja).
function azar(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const ANCHO = 800
const ALTO = 48

/**
 * Pincel seco: un solo gesto ancho de izquierda a derecha. La tinta se apoya
 * abajo con un borde suave que ondula lento; desde ahí salen cerdas que se
 * abren hacia el papel, todas con la misma inclinación. La carga de tinta
 * sube y baja con ritmo (zonas cargadas y zonas secas), nunca de golpe.
 * Devuelve la tinta y, aparte, las vetas secas (papel que se ve dentro del negro).
 */
function pincel(): { tinta: string; seco: string } {
  const r = azar(23)
  const borde = (x: number) => 33 + 2.2 * Math.sin(x / 150 + 0.4) + 1.0 * Math.sin(x / 61 + 2)
  const carga = (x: number) => Math.max(0, Math.min(1, 0.55 + 0.35 * Math.sin(x / 210 + 1.1) + 0.12 * Math.sin(x / 77 + 0.3)))
  const tinta: string[] = []
  const seco: string[] = []
  // Base: el borde ondula lento, con una aspereza muy fina (no picos)
  let d = `M0,${ALTO} L0,${borde(0).toFixed(1)}`
  for (let x = 4; x <= ANCHO; x += 4) d += ` L${x},${(borde(x) + (r() - 0.5) * 0.7).toFixed(1)}`
  d += ` L${ANCHO},${ALTO} Z`
  tinta.push(`<path d="${d}"/>`)
  // Cerdas: nacen del borde y se abren hacia arriba; más largas donde hay más carga
  for (let x = -60; x < ANCHO + 20; x += 6) {
    const c = carga(Math.max(0, x))
    const n = 1 + (r() < c ? 1 : 0)
    for (let k = 0; k < n; k++) {
      const x0 = x + r() * 6
      const dist = 0.8 + 17 * Math.pow(r(), 1.5) * (0.45 + 0.55 * c)
      const y = borde(Math.max(0, x0)) - dist
      const cerca = 1 - dist / 21
      const largo = (26 + 150 * c * (0.45 + 0.55 * r())) * Math.pow(Math.max(0.05, cerca), 0.6)
      const g = (0.45 + 1.7 * cerca) * (0.7 + 0.5 * r())
      const sube = -largo * 0.014
      const x1 = x0 + largo
      tinta.push(`<path d="M${x0.toFixed(1)},${y.toFixed(1)} C${(x0 + largo * 0.2).toFixed(1)},${(y - g).toFixed(1)} ${(x0 + largo * 0.65).toFixed(1)},${(y + sube - g * 0.45).toFixed(1)} ${x1.toFixed(1)},${(y + sube).toFixed(1)} C${(x0 + largo * 0.65).toFixed(1)},${(y + sube + g * 0.45).toFixed(1)} ${(x0 + largo * 0.2).toFixed(1)},${(y + g).toFixed(1)} ${x0.toFixed(1)},${y.toFixed(1)} Z"/>`)
    }
  }
  // Vetas secas dentro del negro, solo donde el pincel va con poca tinta
  for (let x = 0; x < ANCHO; x += 19) {
    const c = carga(x)
    if (c > 0.5 || r() > 0.85) continue
    const y = borde(x) + 1.6 + r() * 5.5
    const largo = (30 + 70 * r()) * (1.2 - c)
    const g = 0.35 + 0.7 * r() * (1 - c)
    seco.push(`<path d="M${x.toFixed(1)},${y.toFixed(1)} Q${(x + largo / 2).toFixed(1)},${(y - g).toFixed(1)} ${(x + largo).toFixed(1)},${(y - largo * 0.012).toFixed(1)} Q${(x + largo / 2).toFixed(1)},${(y + g).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)} Z"/>`)
  }
  // Salpicaduras mínimas, solo cerca de las zonas cargadas
  for (let i = 0; i < 14; i++) {
    const x = r() * ANCHO
    if (carga(x) < 0.6) continue
    const y = borde(x) - 19 - r() * 7
    tinta.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.35 + r() * 0.7).toFixed(2)}"/>`)
  }
  return { tinta: tinta.join(''), seco: seco.join('') }
}

function trama(): string {
  const partes: string[] = []
  // Líneas horizontales cada vez más juntas y gruesas hacia abajo, hasta fundirse en negro
  const filas = [1, 4.5, 8, 11, 13.6, 16, 18.2, 20.2, 22, 23.6, 25, 26.3, 27.5]
  filas.forEach((y, i) => {
    const g = 0.5 + i * 0.28
    partes.push(`<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}" stroke-width="${g.toFixed(2)}"/>`)
  })
  partes.push(`<rect x="0" y="28" width="${ANCHO}" height="${ALTO - 28}"/>`)
  // Cortes cortos en diagonal, como trama cruzada, en la mitad de abajo
  for (let x = 6; x < ANCHO; x += 14) partes.push(`<line x1="${x}" y1="27" x2="${x + 5}" y2="12" stroke-width="0.6"/>`)
  return partes.join('')
}

function diagonal(): string {
  const r = azar(11)
  const partes: string[] = []
  partes.push(`<path d="M0,${ALTO} L0,20 L${ANCHO},6 L${ANCHO},${ALTO} Z"/>`)
  // Salpicaduras a lo largo del corte
  for (let i = 0; i < 34; i++) {
    const x = r() * ANCHO
    const borde = 20 - (x / ANCHO) * 14
    const y = borde - r() * 12
    const rad = 0.5 + r() * 1.8
    partes.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}"/>`)
  }
  for (let i = 0; i < 10; i++) {
    const x = r() * ANCHO
    const borde = 20 - (x / ANCHO) * 14
    partes.push(`<path d="M${x.toFixed(1)},${borde.toFixed(1)} l${(r() * 8 - 4).toFixed(1)},${(-6 - r() * 8).toFixed(1)}" stroke-width="${(0.8 + r()).toFixed(1)}"/>`)
  }
  return partes.join('')
}

const CACHE: Partial<Record<VarianteDivisor, { tinta: string; seco: string }>> = {}
function dibujo(v: VarianteDivisor): { tinta: string; seco: string } {
  return (CACHE[v] ??= v === 'trama' ? { tinta: trama(), seco: '' } : v === 'diagonal' ? { tinta: diagonal(), seco: '' } : pincel())
}

export function Divisor({ variante, fondo = 'papel', className = '' }: { variante?: VarianteDivisor; fondo?: 'papel' | 'ninguno'; className?: string }) {
  const elegida = useVarianteDivisor()
  const v = variante ?? elegida
  const html = useMemo(() => dibujo(v), [v])
  return (
    <svg className={`divisor ${className}`} viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {fondo === "papel" && <rect x="0" y="0" width={ANCHO} height={31} className="divisor-papel" />}
      <g className="divisor-tinta" dangerouslySetInnerHTML={{ __html: html.tinta }} />
      {html.seco && <g className="divisor-seco" dangerouslySetInnerHTML={{ __html: html.seco }} />}
    </svg>
  )
}
