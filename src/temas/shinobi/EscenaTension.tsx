/**
 * Escena «tension» del tema Shinobi (pantalla completa). SEK solo la pide y recibe si diste la mano o no.
 * T1 la mirada → T1b pasos en los charcos → T3 la mano → T3b la espera (bucle sin límite: aro, «Tocalo»,
 * manchitas de rivales que bajan por las laderas, cada vuelta más y más cerca, y «No le doy la mano»).
 * · Diste la mano: tinta → T4a se tira del risco → tinta → T4c la carga (+ rivales chicos en el horizonte) → negro → 進.
 * · No la diste: T4b la derrota → negro → `onSoltar` (SEK dispara la caída, que sigue en la tumba).
 * Sin pantallas negras entre clips: el siguiente se precarga mientras corre el actual, y debajo queda el último cuadro
 * del anterior. Si un clip no carga, su último cuadro quieto y sigue. Con movimiento reducido: solo últimos cuadros.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { sonarEstampida, sonarLluvia, sonarTaiko } from '../../ui/animaciones/motor'

const BASE = `${import.meta.env.BASE_URL}temas/shinobi/tension/`
const R7 = `${import.meta.env.BASE_URL}temas/shinobi/caida/r7-rival-corre.mp4`
export const CLIPS_TENSION = ['t1-mirada', 't1b-charcos', 't3-mano', 't3b-espera', 't4a-se-tira', 't4c-carga-llanura', 't4b-derrota'] as const
export type ClipTension = (typeof CLIPS_TENSION)[number]
const clip = (c: ClipTension) => `${BASE}${c}.mp4`
const fin = (c: ClipTension) => `${BASE}${c}-fin.jpg`
/** Primer clip: si está, el botón de Tensión aparece. */
export const CLIP_PRUEBA_TENSION = clip('t1-mirada')

type Paso = ClipTension | 'final'
/** Qué sigue sin elegir nada (la espera se queda en bucle hasta que elegís). */
const SIGUE: Partial<Record<ClipTension, ClipTension>> = { 't1-mirada': 't1b-charcos', 't1b-charcos': 't3-mano', 't3-mano': 't3b-espera', 't4a-se-tira': 't4c-carga-llanura' }
/** Cómo se pasa de un clip al siguiente. */
const CORTE: Partial<Record<ClipTension, 'tinta' | 'negro'>> = { 't4a-se-tira': 'tinta', 't4c-carga-llanura': 'negro', 't4b-derrota': 'negro' }
const DURA_QUIETO = 1500
const DURA_ESPERA = 2833

export type PropsTension = {
  kanji: string
  frase: string
  sonido: boolean
  reducido: boolean
  /** Ver animaciones: elige solo después de cuatro vueltas de la espera. */
  auto?: 'mano' | 'soltar'
  onFin: () => void
  onSoltar: () => void
}

export function EscenaTension({ kanji, frase, sonido, reducido, auto, onFin, onSoltar }: PropsTension) {
  const [paso, setPaso] = useState<Paso>('t1-mirada')
  const [anterior, setAnterior] = useState<ClipTension | null>(null)
  const [quieto, setQuieto] = useState<Set<ClipTension>>(() => new Set())
  const [corte, setCorte] = useState<{ tipo: 'tinta' | 'negro'; n: number } | null>(null)
  const [vueltas, setVueltas] = useState(0)
  const videos = useRef(new Map<ClipTension, HTMLVideoElement>())
  const elegido = useRef(false)

  const irA = (destino: Paso, tipo?: 'tinta' | 'negro') => {
    const cambiar = () => {
      setAnterior((a) => (paso !== 'final' ? paso : a))
      setPaso(destino)
    }
    if (!tipo) return cambiar()
    setCorte((c) => ({ tipo, n: (c?.n ?? 0) + 1 }))
    window.setTimeout(cambiar, tipo === 'tinta' ? 280 : 380)
  }
  const terminoClip = (c: ClipTension) => {
    if (c !== paso) return
    if (c === 't3b-espera') return
    if (c === 't4b-derrota') { setCorte((x) => ({ tipo: 'negro', n: (x?.n ?? 0) + 1 })); window.setTimeout(onSoltar, 420); return }
    if (c === 't4c-carga-llanura') return irA('final', 'negro')
    const s = SIGUE[c]
    if (s) irA(s, CORTE[c])
  }
  const darMano = () => { if (paso !== 't3b-espera' || elegido.current) return; elegido.current = true; irA('t4a-se-tira', 'tinta') }
  const soltar = () => { if (paso !== 't3b-espera' || elegido.current) return; elegido.current = true; irA('t4b-derrota') }

  // Reproduce el clip actual (el elemento ya estaba precargado).
  useEffect(() => {
    if (paso === 'final' || reducido) return
    const v = videos.current.get(paso)
    if (!v) return
    try { v.currentTime = 0 } catch { /* todavía sin datos */ }
    v.play().catch(() => undefined)
  }, [paso, reducido])
  // Movimiento reducido o clip que no cargó: el último cuadro quieto y después sigue.
  useEffect(() => {
    if (paso === 'final' || paso === 't3b-espera') return
    if (!reducido && !quieto.has(paso)) return
    const id = window.setTimeout(() => terminoClip(paso), DURA_QUIETO)
    return () => window.clearTimeout(id)
  }, [paso, reducido, quieto]) // eslint-disable-line react-hooks/exhaustive-deps
  // La espera: cada vuelta del bucle suma rivales y los acerca. En Ver animaciones elige sola.
  useEffect(() => {
    if (paso !== 't3b-espera') return
    const id = window.setInterval(() => setVueltas((v) => v + 1), DURA_ESPERA)
    return () => window.clearInterval(id)
  }, [paso])
  useEffect(() => {
    if (!auto || paso !== 't3b-espera' || vueltas < 4) return
    if (auto === 'mano') darMano(); else soltar()
  }, [auto, paso, vueltas]) // eslint-disable-line react-hooks/exhaustive-deps
  // Sonido: lluvia todo el tiempo; pasos y metal en los charcos y en la derrota; taiko en la carga y al final.
  useEffect(() => (sonido ? sonarLluvia() : undefined), [sonido])
  useEffect(() => {
    if (!sonido) return
    if (paso === 't1b-charcos' || paso === 't4b-derrota') sonarEstampida(4.5)
    if (paso === 't4c-carga-llanura' || paso === 'final') sonarTaiko()
  }, [paso, sonido])
  useEffect(() => {
    if (paso === 'final') { try { navigator.vibrate?.([60, 40, 200]) } catch { /* sin vibración */ } }
  }, [paso])

  // Elementos de video montados: el actual y los que pueden venir (precargados, invisibles).
  const montados: ClipTension[] = useMemo(() => {
    if (paso === 'final' || reducido) return []
    const l: ClipTension[] = [paso]
    const s = SIGUE[paso]
    if (s) l.push(s)
    if (paso === 't3-mano') l.push('t4a-se-tira', 't4b-derrota')
    if (paso === 't3b-espera') l.push('t4a-se-tira', 't4b-derrota')
    return l
  }, [paso, reducido])

  const final = paso === 'final'
  const espera = paso === 't3b-espera'
  return (
    <div className={`tema-tn ${paso} ${reducido ? 'quieta' : ''}`} role="dialog" aria-label="Tensión">
      {!final && (
        <div className="tema-marco">
          {/* Debajo de todo, el último cuadro del clip anterior: nunca queda la pantalla negra */}
          {anterior && <img className="tema-tn-clip" src={fin(anterior)} alt="" />}
          {(reducido || quieto.has(paso)) && <img className="tema-tn-clip arriba" src={fin(paso)} alt="" />}
          {montados.map((c) => (
            <video
              key={c}
              ref={(el) => { if (el) videos.current.set(c, el); else videos.current.delete(c) }}
              className={`tema-tn-clip ${c === paso && !quieto.has(c) ? 'arriba' : 'oculto'}`}
              src={clip(c)}
              playsInline
              muted
              preload="auto"
              loop={c === 't3b-espera'}
              onEnded={() => terminoClip(c)}
              onError={() => setQuieto((q) => new Set(q).add(c))}
            />
          ))}
          {espera && <Manchitas vueltas={vueltas} />}
          {paso === 't4c-carga-llanura' && !reducido && <RivalesHorizonte />}
          <div className="tema-vineta" aria-hidden />
          {espera && (
            <button type="button" className="tema-tn-mano" onClick={darMano} aria-label="Darle la mano">
              <span className="tn-aro" />
              <span className="tn-tocalo">Tocalo</span>
            </button>
          )}
        </div>
      )}
      {espera && <button type="button" className="tema-tn-soltar" onClick={soltar}>No le doy la mano</button>}
      {corte && <div key={corte.n} className={`tema-tn-corte ${corte.tipo}`} aria-hidden />}
      {final && (
        <div className="tn-final" onClick={onFin} role="button" tabIndex={0}>
          <div className="tn-kanji" aria-label={kanji}>{kanji}</div>
          {frase && <div className="tn-frase">{frase}</div>}
          <div className="tn-cerrar">tocá para volver</div>
        </div>
      )}
      {!final && !espera && <button type="button" className="tn-saltar" onClick={onFin}>Salir</button>}
    </div>
  )
}

// ---------- La espera: manchitas de rivales que bajan por las laderas del fondo ----------

const MANCHAS = Array.from({ length: 40 }, (_, i) => {
  const r = (k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  // Salen cerca de la cima (≈ 70 %, 11 %) y bajan por las laderas: la mayoría por la derecha
  const derecha = r(1) < 0.7
  const x0 = 0.68 + r(2) * 0.05
  const y0 = 0.11 + r(3) * 0.03
  const x1 = derecha ? 0.8 + r(4) * 0.18 : 0.12 + r(4) * 0.2
  const y1 = derecha ? 0.19 + r(5) * 0.1 : 0.24 + r(5) * 0.08
  return { x0, y0, x1, y1, vel: 0.6 + r(6) * 0.4, raya: r(7) < 0.45 }
})

function Manchitas({ vueltas }: { vueltas: number }) {
  const n = Math.min(MANCHAS.length, 8 + vueltas * 6)
  const p = Math.min(1, (vueltas + 1) / 6)
  return (
    <div className="tema-tn-manchas" aria-hidden>
      {MANCHAS.slice(0, n).map((m, i) => {
        const k = Math.min(1, p * m.vel + 0.05)
        const x = m.x0 + (m.x1 - m.x0) * k
        const y = m.y0 + (m.y1 - m.y0) * k
        return <i key={i} className={m.raya ? 'raya' : ''} style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: 0.4 + 0.55 * k, transform: `scale(${0.9 + 1.3 * k})` }} />
      })}
      <div className="tema-tn-niebla" />
    </div>
  )
}

// ---------- La carga: rivales chicos en el horizonte, detrás de los 6 del clip ----------

function RivalesHorizonte() {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const c = lienzo.current
    const v = video.current
    if (!c || !v) return
    const ctx = c.getContext('2d')
    const hoja = document.createElement('canvas')
    const hctx = hoja.getContext('2d', { willReadFrequently: true })
    if (!ctx || !hctx) return
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const W = c.clientWidth
    const H = c.clientHeight
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    ctx.scale(dpr, dpr)
    v.play().catch(() => undefined)
    // 12 rivales sobre la línea del horizonte (≈ 60 % de alto), los de cada lado mirando al centro
    const rivales = Array.from({ length: 12 }, (_, i) => ({ x: 0.04 + (i / 11) * 0.92 + Math.sin(i * 3.1) * 0.02, alto: 0.022 + ((i * 7) % 5) * 0.003, base: 0.548 + ((i * 5) % 4) * 0.004 }))
    const inicio = performance.now()
    let raf = 0
    const cuadro = (ahora: number) => {
      const t = (ahora - inicio) / 1000
      ctx.clearRect(0, 0, W, H)
      if (v.readyState >= 2) {
        // El clip tiene fondo blanco: se pasa a silueta gris con transparencia.
        hoja.width = 130; hoja.height = 126
        hctx.drawImage(v, 0, 0, 130, 126)
        const img = hctx.getImageData(0, 0, 130, 126)
        const d = img.data
        for (let k = 0; k < d.length; k += 4) {
          const a = 255 - (d[k] + d[k + 1] + d[k + 2]) / 3
          d[k] = 52; d[k + 1] = 52; d[k + 2] = 54; d[k + 3] = a < 40 ? 0 : Math.min(255, a * 1.2)
        }
        hctx.putImageData(img, 0, 0)
        for (const r of rivales) {
          const h = r.alto * H
          const w = h * 1.03
          const haciaCentro = r.x < 0.5 ? 1 : -1
          const x = (r.x + haciaCentro * Math.min(0.06, t * 0.012)) * W
          const y = r.base * H - h
          ctx.save()
          ctx.globalAlpha = 0.75
          if (haciaCentro < 0) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(hoja, 0, 0, w, h) } else ctx.drawImage(hoja, x, y, w, h)
          ctx.restore()
        }
      }
      // Un poco de niebla delante
      const g = ctx.createLinearGradient(0, H * 0.51, 0, H * 0.57)
      g.addColorStop(0, 'rgba(200,202,200,0)')
      g.addColorStop(0.5, 'rgba(200,202,200,0.22)')
      g.addColorStop(1, 'rgba(200,202,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, H * 0.51, W, H * 0.06)
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <video ref={video} src={R7} muted playsInline loop autoPlay preload="auto" className="tema-caida-fuente" />
      <canvas ref={lienzo} className="tema-tn-horizonte" />
    </>
  )
}
