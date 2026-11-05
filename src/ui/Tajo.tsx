/**
 * El tajo: al volver a SEK después de horas con un pilar pendiente, la pantalla de Hoy se corta como papel.
 * Es el clip de Luma (public/shinobi/tajo.webm): hoja blanca → corte fino rojo en diagonal → por el hueco se ve la
 * noche de lluvia → una mano negra a tinta sale y llama. El blanco del clip se vuelve transparente con un filtro de
 * luminancia, así el «papel» que se corta es la propia pantalla. Como en el clip no se ve la katana, la app dibuja
 * encima, justo cuando aparece el corte, una hoja brillante que barre la diagonal. Queda congelado hasta el toque.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** En qué segundo del clip aparece el corte (la hoja brillante barre ahí). */
const SEGUNDO_CORTE = 1.0
/** Por las dudas: si nadie toca, se cierra solo. */
const MAXIMO_MS = 15_000

export function Tajo({ onFin }: { onFin: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [hoja, setHoja] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(onFin, MAXIMO_MS)
    return () => window.clearTimeout(id)
  }, [onFin])
  // La hoja brillante va sincronizada con el clip: se dispara cuando el video llega al segundo del corte.
  useEffect(() => {
    const v = video.current
    if (!v) return
    let disparada = false
    const alAvanzar = () => { if (!disparada && v.currentTime >= SEGUNDO_CORTE) { disparada = true; setHoja(true) } }
    v.addEventListener('timeupdate', alAvanzar)
    v.play().catch(() => { /* si no puede reproducir, queda el fondo y el toque lo cierra */ })
    return () => v.removeEventListener('timeupdate', alAvanzar)
  }, [])
  const base = import.meta.env.BASE_URL
  const w = typeof window !== 'undefined' ? window.innerWidth : 390
  const h = typeof window !== 'undefined' ? window.innerHeight : 844
  // La diagonal del corte en el clip va de arriba a la derecha hacia abajo a la izquierda.
  const angulo = Math.atan2(h, -w) * 180 / Math.PI
  const largo = Math.hypot(w, h)
  return createPortal(
    <div className="tajo" aria-hidden onPointerDown={onFin}>
      <svg width="0" height="0" aria-hidden>
        <filter id="tajo-luma" colorInterpolationFilters="sRGB">
          {/* alfa = 7.2 − 10·luminancia: el blanco del papel desaparece, lo oscuro (corte, lluvia, mano) queda. */}
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -3 -5.9 -1.1 0 7.2" />
        </filter>
      </svg>
      <video ref={video} className="tajo-video" muted playsInline preload="auto" disablePictureInPicture>
        <source src={`${base}shinobi/tajo.webm`} type="video/webm" />
        <source src={`${base}shinobi/tajo.mp4`} type="video/mp4" />
      </video>
      {hoja && (
        <div className="tajo-riel" style={{ transform: `translate(-50%, -50%) rotate(${angulo}deg)`, width: largo, ["--largo" as string]: `${largo}px` }}>
          <div className="tajo-hoja" />
        </div>
      )}
    </div>,
    document.body,
  )
}
