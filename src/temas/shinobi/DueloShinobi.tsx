/**
 * Duelo quieto (v0.85): el shinobi y el rival frente a frente, en guardia. No se mueven: solo respiran
 * (subida y bajada muy suave) y el viento les mueve las cintas y la ropa (ida y vuelta de los últimos cuadros
 * de «desenvainar» de cada uno), con la lluvia de la app. Sin video nuevo. Al terminar: tajo y el rival cae.
 * SEK pasa el texto, la cuenta y qué hacer al tocar; acá solo se decide cómo se ve.
 */
import { useEffect, useRef } from 'react'
import { HOJA_RIVAL, useHoja, type HojaSprites } from './Escenas'
import { LluviaApp } from './EscenaCaida'

const HOJA_SHINOBI = `${import.meta.env.BASE_URL}temas/shinobi/companero/camina.webp`
/** Cuántos cuadros del final de cada clip se usan para el viento. */
const ULTIMOS = 10
const ESCALA = 3
/** «alerta» del shinobi: la espada afuera, en guardia (cuadros 30 a 70 del clip). */
const TRAMO_SHINOBI: [number, number] = [32, 36]

/** Ida y vuelta lenta de los últimos cuadros de un clip (el viento). Quieto con «reducir movimiento». */
/** `tramo`: [desde, cuántos] dentro del clip, si la guardia no está al final (el shinobi vuelve a envainar al terminar «alerta»). */
function EnGuardia({ url, datos, clip, mira, reducido, fps, className, tramo }: { url: string; datos: HojaSprites; clip: string; mira: 1 | -1; reducido: boolean; fps: number; className: string; tramo?: [number, number] }) {
  const el = useRef<HTMLDivElement>(null)
  const c = datos.clips[clip]
  useEffect(() => {
    const d = el.current
    if (!d || !c) return
    const [cw, ch] = datos.celda
    const desde = c.desde + (tramo ? tramo[0] : Math.max(0, c.n - ULTIMOS))
    const n = tramo ? Math.min(tramo[1], c.n - tramo[0]) : Math.min(ULTIMOS, c.n)
    const pintar = (k: number) => { const i = desde + k; d.style.backgroundPosition = `${-(i % datos.columnas) * cw}px ${-Math.floor(i / datos.columnas) * ch}px` }
    if (reducido) { pintar(n - 1); return }
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const f = Math.floor(((t - t0) / 1000) * fps) % (2 * n - 2 || 1)
      pintar(f < n ? n - 1 - f : f - n + 1)
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [c, datos, reducido, fps, tramo?.[0], tramo?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null
  const [cw, ch] = datos.celda
  return (
    <div className={`dq-personaje ${className}`} style={{ width: cw * ESCALA, height: ch * ESCALA }}>
      <div className="dq-respira">
        <div ref={el} className="dq-sprite" style={{ backgroundImage: `url(${url})`, backgroundSize: `${datos.columnas * cw}px ${datos.filas * ch}px`, width: cw, height: ch, transform: `scale(${mira * ESCALA}, ${ESCALA})`, marginBottom: -(datos.pies ?? 0) * ESCALA }} aria-hidden />
      </div>
    </div>
  )
}

export type PropsDuelo = {
  titulo: string
  hechas: number
  total: number
  nombreRival?: string
  fase: 'guardia' | 'tajo'
  reducido: boolean
  onTocar: () => void
  onListo: () => void
  onAhoraNo: () => void
}

export function DueloShinobi({ titulo, hechas, total, nombreRival, fase, reducido, onTocar, onListo, onAhoraNo }: PropsDuelo) {
  const shinobi = useHoja(HOJA_SHINOBI)
  const rival = useHoja(HOJA_RIVAL)
  return (
    <div className={`dq-capa dq-${fase === 'tajo' ? 'tajo-fase' : fase} ${reducido ? 'quieto' : ''}`} role="dialog" aria-label={`Duelo: ${titulo} · ${total}`}>
      {!reducido && <LluviaApp cantidad={38} />}
      <div className="dq-arriba">
        <div className="dq-titulo">{titulo} · <b>{total}</b></div>
        <div className="dq-cuenta" aria-live="polite">{hechas} / {total}</div>
        {nombreRival && <div className="dq-rival-nombre">{nombreRival}</div>}
      </div>
      <button type="button" className="dq-escena" onClick={onTocar} aria-label="Una flexión">
        {shinobi && <EnGuardia url={HOJA_SHINOBI} datos={shinobi} clip="alerta" mira={1} reducido={reducido} fps={5} className="dq-shinobi" tramo={TRAMO_SHINOBI} />}
        {rival && <EnGuardia url={HOJA_RIVAL} datos={rival} clip="desenvaina" mira={-1} reducido={reducido} fps={6} className="dq-rival" />}
        <span className="dq-piso" aria-hidden />
        {fase === 'tajo' && <span className="dq-tajo" aria-hidden />}
      </button>
      <div className="dq-abajo">
        <p className="dq-nota">Tocá por cada flexión</p>
        <button type="button" className="dq-listo" onClick={onListo}>Listo</button>
        <button type="button" className="dq-no" onClick={onAhoraNo}>Ahora no</button>
      </div>
    </div>
  )
}

/**
 * Pantalla simple (v0.86, con el rival archivado; y el tema Común): sin personajes. Lluvia de fondo, 力 grande,
 * «Flexiones · N», el contador (tocá en cualquier lado por cada flexión) y «Listo».
 */
export function DueloComun({ titulo, hechas, total, fase, reducido, lluvia, onTocar, onListo, onAhoraNo }: PropsDuelo & { lluvia?: boolean }) {
  return (
    <div className={`dq-capa simple dq-${fase === 'tajo' ? 'tajo-fase' : fase} ${reducido ? 'quieto' : ''}`} role="dialog" aria-label={`${titulo} · ${total}`}>
      {lluvia && !reducido && <LluviaApp cantidad={38} />}
      <button type="button" className="dq-escena dq-simple" onClick={onTocar} aria-label="Una flexión">
        <span className="dq-kanji" aria-hidden>力</span>
        <span className="dq-titulo">{titulo} · <b>{total}</b></span>
        <span className="dq-cuenta grande" aria-live="polite">{hechas} <span className="texto-3">/ {total}</span></span>
        <span className="dq-nota">Tocá por cada flexión</span>
      </button>
      <div className="dq-abajo"><button type="button" className="dq-listo" onClick={onListo}>Listo</button><button type="button" className="dq-no" onClick={onAhoraNo}>Ahora no</button></div>
    </div>
  )
}
