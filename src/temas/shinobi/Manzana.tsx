/**
 * Manzana a pincel del tema Shinobi (al lado de la cantimplora). No depende de SEK: recibe cuánto está comida.
 * `mordido` 0..1: 0 entera, ~0,6 con un par de mordiscos grandes, 1 solo el centro (carozo, cabito y semillas).
 * `mordiendo` muestra unas migas de tinta (el mordisco recién hecho).
 */
import { useId, type CSSProperties } from 'react'

const CUERPO = 'M50 26 C40 18 18 20 14 44 C10 68 26 96 40 96 C45 96 47 93 50 93 C53 93 55 96 60 96 C74 96 90 68 86 44 C82 20 60 18 50 26 Z'

/** Mordiscos en orden: primero los dos grandes a los costados, después más chicos que comen hacia el centro. */
const MORDISCOS: { x: number; y: number; r: number }[] = [
  { x: 92, y: 54, r: 20 },
  { x: 8, y: 62, r: 20 },
  { x: 86, y: 30, r: 15 },
  { x: 14, y: 36, r: 15 },
  { x: 84, y: 82, r: 15 },
]

function cuantos(mordido: number): number {
  if (mordido <= 0) return 0
  return Math.min(MORDISCOS.length, Math.max(1, Math.round(mordido / 0.3)))
}

export function Manzana({ mordido, ancho = 22, mordiendo = false, etiqueta }: { mordido: number; ancho?: number; mordiendo?: boolean; etiqueta?: string }) {
  const id = useId().replace(/:/g, '')
  const centro = mordido >= 0.999
  const n = cuantos(mordido)
  const ultimo = MORDISCOS[Math.max(0, n - 1)]
  return (
    <svg viewBox="0 0 100 110" width={ancho} height={ancho * 1.1} className={`tema-manzana ${centro ? 'centro' : ''}`} role="img" aria-label={etiqueta}>
      {/* Cabito y hoja */}
      <path className="tema-manzana-trazo" d="M50 26 C50 18 52 12 56 6" />
      <path className="tema-manzana-hoja" d="M54 14 C62 4 76 6 80 10 C72 18 62 18 54 14 Z" />
      {centro ? (
        <g>
          {/* Solo el centro: piel arriba y abajo, cintura fina con las semillas */}
          <path className="tema-manzana-pulpa" d="M36 26 C42 22 58 22 64 26 C60 34 55 40 55 52 C55 64 60 72 64 84 C66 90 60 94 50 93 C40 94 34 90 36 84 C40 72 45 64 45 52 C45 40 40 34 36 26 Z" />
          <path className="tema-manzana-piel" d="M36 26 C42 22 58 22 64 26 C62 30 60 31 50 31 C40 31 38 30 36 26 Z" />
          <path className="tema-manzana-piel" d="M38 88 C42 86 58 86 62 88 C63 92 58 95 50 94 C42 95 37 92 38 88 Z" />
          <path className="tema-manzana-trazo" d="M36 26 C40 34 45 40 45 52 C45 64 40 72 36 84 M64 26 C60 34 55 40 55 52 C55 64 60 72 64 84" />
          <path className="tema-manzana-semilla" d="M48 46 q-3 5 0 9 q3 -4 0 -9 Z M52 54 q-3 5 0 9 q3 -4 0 -9 Z" />
        </g>
      ) : (
        <g>
          <defs>
            <mask id={`${id}-piel`}>
              <rect x="0" y="0" width="100" height="110" fill="#fff" />
              {MORDISCOS.slice(0, n).map((m, i) => <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="#000" />)}
            </mask>
            <mask id={`${id}-pulpa`}>
              <rect x="0" y="0" width="100" height="110" fill="#fff" />
              {MORDISCOS.slice(0, n).map((m, i) => <circle key={i} cx={m.x + (m.x > 50 ? 4 : -4)} cy={m.y} r={m.r - 1} fill="#000" />)}
            </mask>
          </defs>
          {/* Pulpa: se ve solo en el borde de cada mordisco */}
          <path className="tema-manzana-pulpa" d={CUERPO} mask={`url(#${id}-pulpa)`} />
          <g mask={`url(#${id}-piel)`}>
            <path className="tema-manzana-piel" d={CUERPO} />
            <path className="tema-manzana-brillo" d="M28 40 C26 48 26 56 29 64" />
            <path className="tema-manzana-trazo cuerpo" d={CUERPO} />
          </g>
          {n > 0 && <path className="tema-manzana-semilla" d="M48 50 q-3 5 0 9 q3 -4 0 -9 Z" opacity={n >= 3 ? 1 : 0} />}
        </g>
      )}
      {mordiendo && ultimo && (
        <g className="tema-manzana-migas" style={{ transformOrigin: `${ultimo.x}px ${ultimo.y}px` }}>
          {[0, 1, 2, 3].map((i) => <circle key={i} className="tema-manzana-miga" cx={ultimo.x + (ultimo.x > 50 ? -6 : 6)} cy={ultimo.y - 6 + i * 4} r={1.8 + (i % 2)} style={{ '--mx': `${(ultimo.x > 50 ? 1 : -1) * (6 + i * 3)}px`, '--my': `${-8 + i * 5}px` } as CSSProperties} />)}
        </g>
      )}
    </svg>
  )
}
