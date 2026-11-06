/**
 * Momento épico al jurar una regla de «Mi código»: la pantalla se oscurece,
 * la regla se escribe con pincel letra por letra, se estampa el sello 誓 con
 * rebote y vibración; el shinobi del video de fondo queda en guardia detrás. Dura ~2,8 s; un toque
 * lo salta. Con «reducir movimiento» se muestra quieto y se va solo.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { movimientoReducido } from '../componentes'

export const DURACION_JURAMENTO = 2800

export default function Juramento({ texto, grupo, onFin, kanjiSello = '誓' }: { texto: string; grupo: string; onFin: () => void; kanjiSello?: string }) {
  const reducido = movimientoReducido()
  const fin = useRef(onFin)
  fin.current = onFin
  const letras = [...texto]
  // Las letras se escriben en ~1,1 s sin importar el largo (entre 18 y 70 ms cada una).
  const paso = Math.max(18, Math.min(70, 1100 / Math.max(1, letras.length)))
  const sello = reducido ? 0 : Math.round(380 + letras.length * paso + 150)

  useEffect(() => {
    const ids: number[] = []
    if (!reducido && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      ids.push(window.setTimeout(() => { try { navigator.vibrate([35, 45, 70]) } catch { /* sin vibración */ } }, sello + 120))
    }
    ids.push(window.setTimeout(() => fin.current(), reducido ? 1600 : Math.max(DURACION_JURAMENTO, sello + 1200)))
    return () => ids.forEach((i) => clearTimeout(i))
  }, [reducido, sello])

  return createPortal(
    <div className={`juramento ${reducido ? 'quieto' : ''}`} role="dialog" aria-label={`Regla jurada: ${texto}`} onClick={() => fin.current()} style={{ '--sello': `${sello}ms` } as React.CSSProperties}>
      <div className="jur-velo" />
      <div className="jur-centro">
        <div className="jur-grupo">{grupo}</div>
        <p className="jur-texto">
          {letras.map((l, i) => <span key={i} style={{ animationDelay: `${380 + i * paso}ms` }}>{l}</span>)}
        </p>
        <svg className="jur-trazo" viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden>
          <path d="M4,9 C60,4 120,11 180,6 C230,3 270,8 296,5" />
        </svg>
        <div className="jur-sello" aria-hidden><span>{kanjiSello}</span></div>
      </div>
      <div className="jur-pie">{kanjiSello === '誓' ? '誓 · juramento' : `${kanjiSello} · forjado`} · tocá para seguir</div>
    </div>,
    document.body,
  )
}
