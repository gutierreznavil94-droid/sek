/**
 * «xp-perdida» según el tema (v0.83). SEK solo avisa cuánto se perdió (`disparar('xp-perdida', { texto, elemento })`);
 * acá se decide cómo se ve: Shinobi (y los temas con escenas) apaga la bolita de XP y la deja caer como ceniza;
 * Común muestra un −N rojo simple que sube y se va.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { XpMenosComun } from './comun/XpMenosComun'
import { alDisparar, sinMovimiento } from './eventos'
import { XpCeniza } from './shinobi/XpCeniza'
import { useTema } from './temas'

type Pedido = { n: number; texto: string; x: number; y: number }

export function CapaXpPerdida() {
  const tema = useTema()
  const [p, setP] = useState<Pedido | null>(null)
  useEffect(() => alDisparar((e, det) => {
    if (e !== 'xp-perdida') return
    const r = det.elemento?.getBoundingClientRect?.()
    // Justo arriba de lo que se perdió (el −N de «Ayer»); sin elemento, arriba al centro.
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2
    const y = r ? r.top - 12 : 120
    setP((v) => ({ n: (v?.n ?? 0) + 1, texto: det.texto ?? '−XP', x, y }))
  }), [])
  useEffect(() => {
    if (!p) return
    const t = window.setTimeout(() => setP(null), sinMovimiento() ? 1800 : 3000)
    return () => window.clearTimeout(t)
  }, [p])
  if (!p || typeof document === 'undefined') return null
  const Vista = tema.escenas ? XpCeniza : XpMenosComun
  return createPortal(<Vista key={p.n} texto={p.texto} x={p.x} y={p.y} />, document.body)
}
