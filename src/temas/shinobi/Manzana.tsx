/**
 * Manzana del tema Shinobi, simple como la cantimplora: pocas líneas, relleno plano apagado.
 * No depende de SEK: recibe cuánto está comida.
 * `mordido` 0..1: 0 entera, ~0,6 con un par de mordiscos (recortes simples), 1 solo el centro en silueta.
 */
import { useId } from 'react'

const CUERPO = 'M50 52 C38 42 14 46 13 76 C12 106 30 136 44 136 C47 136 48 134 50 134 C52 134 53 136 56 136 C70 136 88 106 87 76 C86 46 62 42 50 52 Z'
const CENTRO = 'M36 54 C44 50 56 50 64 54 C58 66 56 78 56 92 C56 106 60 116 64 128 C56 134 44 134 36 128 C40 116 44 106 44 92 C44 78 42 66 36 54 Z'

/** Recortes en orden: primero dos grandes a los costados, después más chicos hacia el centro. */
const MORDISCOS: { x: number; y: number; r: number }[] = [
  { x: 94, y: 88, r: 22 },
  { x: 6, y: 96, r: 22 },
  { x: 88, y: 58, r: 16 },
  { x: 12, y: 62, r: 16 },
  { x: 86, y: 124, r: 16 },
]

function cuantos(mordido: number): number {
  if (mordido <= 0) return 0
  return Math.min(MORDISCOS.length, Math.max(1, Math.round(mordido / 0.3)))
}

export function Manzana({ mordido, ancho = 20, etiqueta }: { mordido: number; ancho?: number; etiqueta?: string }) {
  const id = useId().replace(/:/g, '')
  const centro = mordido >= 0.999
  const n = cuantos(mordido)
  return (
    <svg viewBox="0 0 100 150" width={ancho} height={ancho * 1.5} className={`tema-manzana ${centro ? 'centro' : ''}`} role="img" aria-label={etiqueta}>
      {/* Cabito y hoja, con el mismo trazo que la cantimplora */}
      <path className="tema-manzana-trazo" d="M50 52 C50 40 52 30 57 22" />
      <path className="tema-manzana-trazo fino" d="M55 32 C62 22 74 22 78 26 C72 34 62 36 55 32 Z" />
      {centro ? (
        <path className="tema-manzana-cuerpo" d={CENTRO} />
      ) : (
        <>
          <defs>
            <mask id={`${id}-m`}>
              <rect x="0" y="0" width="100" height="150" fill="#fff" />
              {MORDISCOS.slice(0, n).map((m, i) => <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="#000" />)}
            </mask>
          </defs>
          <path className="tema-manzana-cuerpo" d={CUERPO} mask={`url(#${id}-m)`} />
        </>
      )}
    </svg>
  )
}
