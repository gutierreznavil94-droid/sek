/**
 * El tajo: al volver a SEK después de horas con un pilar pendiente, el papel de Hoy se abre con un corte
 * de espada en diagonal, atrás se ve el fondo épico de lluvia y el shinobi llama (por ahora, quieto
 * mirando al frente: el gesto de la mano espera un clip de Luma). Dura 1,5 s y las mitades vuelven.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { temaActivo } from '../temas/temas'

const DURACION_TAJO = 1500

export function Tajo({ onFin }: { onFin: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onFin, DURACION_TAJO)
    return () => window.clearTimeout(id)
  }, [onFin])
  const t = temaActivo()
  const fondo = `${import.meta.env.BASE_URL}${t.carpetaFondos}lluvia.jpg`
  const hoja = `${import.meta.env.BASE_URL}${t.sprite}`
  return createPortal(
    <div className="tajo" aria-hidden onPointerDown={onFin}>
      <div className="tajo-fondo" style={{ backgroundImage: `url(${fondo})` }} />
      <div className="tajo-lluvia" />
      <div className="tajo-llama">
        <div className="tajo-shinobi" style={{ backgroundImage: `url(${hoja})` }} />
        <span className="tajo-texto">Volvé.</span>
      </div>
      <div className="tajo-mitad arriba" />
      <div className="tajo-mitad abajo" />
      <div className="tajo-corte" />
    </div>,
    document.body,
  )
}
