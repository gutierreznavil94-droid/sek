/**
 * «Dudar es fracasar»: la frase grande, en pincel, sobre fondo oscuro.
 * Sale al abrir la app (una vez por día) y antes de la escena de Tensión. Tocar la salta.
 */
import { useEffect, useState } from 'react'
import { fechaDe } from '../domain/fechas'
import { obtenerAjustes } from '../services/base'
import { ahora } from '../services/reloj'
import { modoSuenioActivo } from '../services/suenio'
import { movimientoReducido } from './componentes'
import { rutaTema, simbolo, temaActivo, urlTema } from '../temas/temas'
import { video } from '../fondos/elegir'

export const FRASE_DUDA = ['Dudar', 'es', 'fracasar']
const DURACION_MS = 2600
const DURACION_DIA_MS = 4600
/** 斬: cortar. La duda se corta de un tajo. */
export const KANJI_DUDA = '斬'
const CLAVE_DIA = 'frase-duda-dia'

export function FraseImponente({ onFin, dia = false }: { onFin: () => void; dia?: boolean }) {
  const [quieto] = useState(() => movimientoReducido())
  const [saliendo, setSaliendo] = useState(false)
  const total = dia ? DURACION_DIA_MS : DURACION_MS
  useEffect(() => {
    const a = window.setTimeout(() => setSaliendo(true), total - 450)
    const b = window.setTimeout(onFin, total)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [onFin, total])
  // El de todos los días: el video de Progreso del tema (Shinobi: rayos; tema subido: su video).
  const [fondo] = useState(() => {
    if (!dia) return null
    const v = video('rayos')
    const propio = !!temaActivo().propio
    return { src: urlTema(rutaTema(v.archivo)), poster: propio ? undefined : urlTema(rutaTema(v.cuadroFijo)) }
  })
  const icono = simbolo(KANJI_DUDA)
  return (
    <div className={`frase-duda ${dia ? 'fd-dia' : ''} ${quieto ? 'quieto' : ''} ${saliendo ? 'saliendo' : ''}`} role="dialog" aria-label={FRASE_DUDA.join(' ')} onClick={onFin}>
      {fondo?.src && (quieto && fondo.poster ? <img className="fd-video" src={fondo.poster} alt="" /> : <video className="fd-video" src={fondo.src} poster={fondo.poster} autoPlay muted loop playsInline />)}
      <div className="fd-velo" aria-hidden />
      <div className="fd-tinta" aria-hidden />
      {dia && (
        <div className="fd-icono" aria-hidden>
          <span className="fd-kanji">{icono}</span>
          {Array.from({ length: 14 }).map((_, i) => <i key={i} className="fd-chispa" style={{ ['--a' as string]: `${i * (360 / 14)}deg`, ['--d' as string]: `${(i % 4) * 0.12}s` }} />)}
        </div>
      )}
      <p className="fd-texto" aria-hidden>
        {FRASE_DUDA.map((p, i) => <span key={p} className={`fd-palabra fd-p${i + 1}`}>{p}</span>)}
      </p>
      <span className="fd-tajo" aria-hidden />
    </div>
  )
}

/** Una vez por día, al abrir la app (no en la primera configuración ni en modo sueño). */
export function FraseDelDiaCapa() {
  const [ver, setVer] = useState(false)
  useEffect(() => {
    let vivo = true
    void (async () => {
      const a = await obtenerAjustes()
      if (!a.primeraVezHecha || location.hash.includes('bienvenida')) return
      if (await modoSuenioActivo()) return
      const hoy = fechaDe(ahora(), a.zonaHoraria)
      let ultimo: string | null = null
      try { ultimo = localStorage.getItem(CLAVE_DIA) } catch { /* sin almacenamiento */ }
      if (ultimo === hoy) return
      try { localStorage.setItem(CLAVE_DIA, hoy) } catch { /* sin almacenamiento */ }
      if (vivo) setVer(true)
    })()
    return () => { vivo = false }
  }, [])
  if (!ver) return null
  return <FraseImponente dia onFin={() => setVer(false)} />
}
