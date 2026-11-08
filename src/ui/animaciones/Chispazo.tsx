import { movimientoReducido } from '../componentes'

/**
 * Chispazo de estrellitas tipo varita mágica: lo que ven los temas con `adornos.cumplir: "chispazo"`
 * al cumplir un pilar, en lugar del corte. No frena los toques y se termina solo (~1,4 s).
 */
const RAYOS = 14

export function Chispazo({ onFin }: { onFin: () => void }) {
  const quieto = movimientoReducido()
  return (
    <div className={`chispazo ${quieto ? 'quieto' : ''}`} aria-hidden onAnimationEnd={(e) => { if (e.target === e.currentTarget) onFin() }}>
      <span className="chispazo-centro">✦</span>
      {Array.from({ length: RAYOS }, (_, i) => {
        const ang = (360 / RAYOS) * i + (i % 2 ? 8 : -6)
        const dist = 90 + ((i * 37) % 70)
        return (
          <span
            key={i}
            className={`chispazo-estrella ${i % 3 === 0 ? 'corazon' : ''}`}
            style={{ ['--ang' as string]: `${ang}deg`, ['--dist' as string]: `${dist}px`, ['--demora' as string]: `${(i % 4) * 40}ms` }}
          >
            {i % 3 === 0 ? '♥' : '★'}
          </span>
        )
      })}
    </div>
  )
}
