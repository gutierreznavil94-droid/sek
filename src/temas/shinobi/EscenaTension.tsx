/**
 * Escena «tension» del tema Shinobi (pantalla completa). SEK solo la pide y recibe si diste la mano o no.
 * T1 la mirada → T1b pasos en los charcos → T3 la mano → T3b la espera (bucle sin límite: aro, «Tocalo»,
 * manchitas de rivales que bajan por las laderas, cada vuelta más y más cerca, y «No le doy la mano»).
 * · Diste la mano: tinta → T4a se tira del risco → tinta → T4c la carga (solo los 6 del clip y manchitas lejanas) → negro → 進.
 * · No la diste: T4b la derrota → negro → `onSoltar` (SEK dispara la caída, que sigue en la tumba).
 * Sin pantallas negras entre clips: el siguiente se precarga mientras corre el actual, y debajo queda el último cuadro
 * del anterior. Si un clip no carga, su último cuadro quieto y sigue. Con movimiento reducido: solo últimos cuadros.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { sonarEstampida, sonarLluvia, sonarTaiko } from '../../ui/animaciones/motor'

const BASE = `${import.meta.env.BASE_URL}temas/shinobi/tension/`
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
          {!reducido && !quieto.has(paso) && <img className="tema-tn-clip" src={`${BASE}${paso}-inicio.webp`} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
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
          {paso === 't4c-carga-llanura' && !reducido && <ManchasHorizonte />}
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
  // Solo en las laderas de los costados, nunca sobre el shinobi (que ocupa ≈ 25–68 % de ancho):
  // la mayoría baja desde la cima (≈ 70 %, 11 %) por la derecha; unas pocas por la ladera izquierda.
  const derecha = r(1) < 0.72
  const x0 = derecha ? 0.7 + r(2) * 0.04 : 0.17 + r(2) * 0.05
  const y0 = derecha ? 0.11 + r(3) * 0.03 : 0.2 + r(3) * 0.03
  const x1 = derecha ? 0.78 + r(4) * 0.19 : 0.03 + r(4) * 0.14
  const y1 = derecha ? 0.18 + r(5) * 0.1 : 0.26 + r(5) * 0.06
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

// ---------- La carga: solo los 6 del clip; muy lejos, manchitas grises en el horizonte ----------

/** A los costados de los 6 rivales y del shinobi (que ocupan ≈ 30–85 % de ancho), sobre la línea del horizonte. */
const LEJOS = Array.from({ length: 16 }, (_, i) => {
  const r = (k: number) => { const x = Math.sin(i * 91.17 + k * 37.719) * 24634.6345; return x - Math.floor(x) }
  const izquierda = i % 3 !== 0
  return { x: izquierda ? 0.03 + r(1) * 0.24 : 0.87 + r(1) * 0.11, y: 0.514 + r(2) * 0.012, raya: r(3) < 0.4, demora: r(4) * 0.8 }
})

function ManchasHorizonte() {
  return (
    <div className="tema-tn-manchas lejos" aria-hidden>
      {LEJOS.map((m, i) => (
        <i key={i} className={m.raya ? 'raya' : ''} style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, animationDelay: `${m.demora}s` }} />
      ))}
      <div className="tema-tn-niebla horizonte" />
    </div>
  )
}
