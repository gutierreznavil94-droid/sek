/**
 * «xp-perdida» en Shinobi: la bolita de XP brilla un instante, se apaga (de rojo brasa a gris)
 * y se deshace en ceniza que cae. Al lado, el −N en tinta roja. Con «reducir movimiento», quieta.
 */
import { useMemo } from 'react'

export function XpCeniza({ texto, x, y }: { texto: string; x: number; y: number }) {
  const ceniza = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4
    return {
      dx: Math.round(Math.cos(a) * (6 + Math.random() * 8)),
      cae: Math.round(46 + Math.random() * 60),
      deriva: Math.round((Math.random() - 0.5) * 34),
      tam: (1.6 + Math.random() * 2.4).toFixed(1),
      demora: Math.round(Math.random() * 260),
      gira: Math.round((Math.random() - 0.5) * 300),
    }
  }), [])
  return (
    <div className="xpz" style={{ left: x, top: y }} role="status" aria-label={`Perdiste ${texto}`}>
      <span className="xpz-bola" aria-hidden />
      {ceniza.map((c, i) => (
        <i key={i} className="xpz-ceniza" aria-hidden style={{ '--dx': `${c.dx}px`, '--cae': `${c.cae}px`, '--deriva': `${c.deriva}px`, '--tam': `${c.tam}px`, '--demora': `${c.demora}ms`, '--gira': `${c.gira}deg` } as React.CSSProperties} />
      ))}
      <span className="xpz-texto">{texto}</span>
    </div>
  )
}
