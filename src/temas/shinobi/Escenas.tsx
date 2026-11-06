/**
 * Escenas animadas del tema Shinobi: Juego (pelea → a jugar → jugando → té), noche (buenas noches → durmiendo),
 * Sueño (sentado junto a la cama) y el rival gris (hoja de sprites). SEK solo pide la escena con su estado; los clips
 * viven en public/temas/shinobi/<grupo>/ (los arma scripts/shinobi-escenas.py y scripts/rival-sprites.py).
 * Los videos tienen fondo negro y se muestran con `mix-blend-mode: screen`: el negro desaparece sobre el fondo oscuro.
 * Sin pantallas negras: el clip que sigue ya está precargado y debajo queda el último cuadro del anterior.
 * Con movimiento reducido (o si un clip no carga): un cuadro quieto.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const BASE = `${import.meta.env.BASE_URL}temas/shinobi/`

// ---------- Video en secuencia ----------

type PropsVideo = {
  /** Clip actual: carpeta/nombre dentro de temas/shinobi/, sin extensión (juego/jugando). */
  actual: string
  bucle?: boolean
  /** Clips que pueden venir: quedan cargados e invisibles. */
  precargar?: string[]
  reducido: boolean
  onFin?: () => void
  className?: string
  children?: React.ReactNode
}

export function VideoEscena({ actual, bucle = false, precargar = [], reducido, onFin, className = '', children }: PropsVideo) {
  const src = (c: string, ext: string) => `${BASE}${c}${ext}`
  const [anterior, setAnterior] = useState<string | null>(null)
  const [roto, setRoto] = useState<Set<string>>(() => new Set())
  const previo = useRef(actual)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const fin = useRef(onFin)
  fin.current = onFin
  useEffect(() => {
    if (previo.current === actual) return
    setAnterior(previo.current)
    previo.current = actual
  }, [actual])
  useEffect(() => {
    if (reducido) return
    const v = videos.current.get(actual)
    if (!v) return
    try { v.currentTime = 0 } catch { /* sin datos todavía */ }
    v.play().catch(() => undefined)
  }, [actual, reducido])
  // Quieto (movimiento reducido o clip roto): el cuadro quieto un ratito y sigue.
  useEffect(() => {
    if (bucle || (!reducido && !roto.has(actual))) return
    const id = window.setTimeout(() => fin.current?.(), 1200)
    return () => window.clearTimeout(id)
  }, [actual, bucle, reducido, roto])
  const montados = reducido ? [] : [actual, ...precargar.filter((c) => c !== actual)]
  const quieto = reducido || roto.has(actual)
  return (
    <div className={`tema-escena ${className}`} aria-hidden>
      {anterior && <img className="tema-escena-clip" src={src(anterior, '-fin.jpg')} alt="" />}
      {quieto && <img className="tema-escena-clip arriba" src={src(actual, '-quieto.jpg')} alt="" />}
      {montados.map((c) => (
        <video
          key={c}
          ref={(el) => { if (el) videos.current.set(c, el); else videos.current.delete(c) }}
          className={`tema-escena-clip ${c === actual && !roto.has(c) ? 'arriba' : 'oculto'}`}
          src={src(c, '.mp4')}
          muted
          playsInline
          preload="auto"
          loop={c === actual && bucle}
          onEnded={() => { if (c === previo.current) fin.current?.() }}
          onError={() => setRoto((r) => new Set(r).add(c))}
        />
      ))}
      {children}
    </div>
  )
}

// ---------- Juego: pelean → a jugar → jugando; pausa → té; terminar → fundido de tinta → pelea ----------

type ClipJuego = 'pelea' | 'a-jugar' | 'jugando' | 'te-entra' | 'te-bucle' | 'te-sale'
const BUCLE_JUEGO: ClipJuego[] = ['pelea', 'jugando', 'te-bucle']
const SIGUE_JUEGO: Partial<Record<ClipJuego, ClipJuego>> = { 'a-jugar': 'jugando', 'te-entra': 'te-bucle', 'te-sale': 'jugando' }
const PRECARGA_JUEGO: Record<ClipJuego, ClipJuego[]> = {
  pelea: ['a-jugar'], 'a-jugar': ['jugando'], jugando: ['te-entra'], 'te-entra': ['te-bucle'], 'te-bucle': ['te-sale'], 'te-sale': ['jugando'],
}
const NOTA_JUEGO: Record<ClipJuego, string> = {
  pelea: 'Pelean en la casa hasta que empieces a jugar', 'a-jugar': 'Dejan de pelear y se sientan a jugar', jugando: 'Jugando, concentrados',
  'te-entra': 'Pausa: té', 'te-bucle': 'Pausa: té', 'te-sale': 'De vuelta a jugar',
}

const rutaJuego = (c: ClipJuego) => (c === 'pelea' ? 'pelea/pelea' : `juego/${c}`)

export function JuegoShinobi({ activa, pausada, reducido }: { activa: boolean; pausada: boolean; reducido: boolean }) {
  const objetivo = !activa ? 'pelea' : pausada ? 'te' : 'jugando'
  const [clip, setClip] = useState<ClipJuego>(() => (objetivo === 'te' ? 'te-bucle' : objetivo))
  const [tinta, setTinta] = useState(0)
  const clipRef = useRef(clip)
  clipRef.current = clip
  useEffect(() => {
    const c = clipRef.current
    if (objetivo === 'pelea') {
      if (c === 'pelea') return
      setTinta((n) => n + 1)
      const id = window.setTimeout(() => setClip('pelea'), 300)
      return () => window.clearTimeout(id)
    }
    if (objetivo === 'te') { if (c !== 'te-entra' && c !== 'te-bucle') setClip('te-entra'); return }
    if (c === 'pelea') setClip('a-jugar')
    else if (c === 'te-entra' || c === 'te-bucle') setClip('te-sale')
  }, [objetivo])
  return (
    <div className="tema-juego">
      <VideoEscena
        actual={rutaJuego(clip)}
        bucle={BUCLE_JUEGO.includes(clip)}
        precargar={PRECARGA_JUEGO[clip].map(rutaJuego)}
        reducido={reducido}
        onFin={() => { const s = SIGUE_JUEGO[clipRef.current]; if (s) setClip(s) }}
      >
        {clip === 'pelea' && !reducido && <Chispas />}
      </VideoEscena>
      {tinta > 0 && <div key={tinta} className="tema-escena-tinta" aria-hidden />}
      <span className="sl-casa-nota">{NOTA_JUEGO[clip]}</span>
    </div>
  )
}

/** Chispas donde chocan las katanas (cada choque del clip de la pelea, ≈ cada 1,25 s). */
function Chispas() {
  return (
    <div className="tema-chispas" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--a': `${i * 51 - 150}deg`, '--d': `${(i % 3) * 0.04}s` } as CSSProperties} />)}
    </div>
  )
}

// ---------- Noche: buenas noches → durmiendo en bucle ----------

export function NocheShinobi({ reducido, directo = false }: { reducido: boolean; directo?: boolean }) {
  const [clip, setClip] = useState(directo ? 'durmiendo' : 'buenas-noches')
  return (
    <VideoEscena className="tema-noche" actual={`noche/${clip}`} bucle={clip === 'durmiendo'} precargar={['noche/durmiendo']} reducido={reducido} onFin={() => setClip('durmiendo')} />
  )
}

// ---------- Sueño: el shinobi sentado junto a la cama ----------

export function SuenoShinobi({ reducido }: { reducido: boolean }) {
  return <VideoEscena className="tema-sueno" actual="sueno/sentado" bucle reducido={reducido} />
}

// ---------- Hojas de sprites (rival gris y compañero) ----------

export type ClipHoja = { desde: number; n: number; fps?: number; unaVez?: boolean; aire?: [number, number]; corte?: number }
export type HojaSprites = { celda: [number, number]; columnas: number; filas: number; pies?: number; clips: Record<string, ClipHoja> }

const hojas = new Map<string, Promise<HojaSprites | null>>()
export function cargarHoja(url: string): Promise<HojaSprites | null> {
  if (!hojas.has(url)) {
    hojas.set(url, fetch(url.replace(/\.webp$/, '.json')).then((r) => (r.ok ? r.json() : null)).then((h: HojaSprites | null) => (h && h.clips && h.celda ? h : null)).catch(() => null))
  }
  return hojas.get(url)!
}
export function useHoja(url: string): HojaSprites | null {
  const [h, setH] = useState<HojaSprites | null>(null)
  useEffect(() => { let vivo = true; void cargarHoja(url).then((x) => { if (vivo) setH(x) }); return () => { vivo = false } }, [url])
  return h
}

export const HOJA_RIVAL = `${BASE}rival/rival.webp`
/** Hacia dónde mira cada clip del rival en el video (1 = derecha). */
const MIRA_RIVAL: Record<string, 1 | -1> = { asoma: -1 }

/** Un clip de una hoja de sprites. `mira`: hacia dónde tiene que mirar (1 derecha, -1 izquierda). `vel`: multiplica los fps. */
export function SpriteClip({ hoja: url, datos, clip, mira = 1, vel = 1, reducido = false, onFin, className = '', style }: {
  hoja: string; datos: HojaSprites; clip: string; mira?: 1 | -1; vel?: number; reducido?: boolean; onFin?: () => void; className?: string; style?: CSSProperties
}) {
  const el = useRef<HTMLDivElement>(null)
  const fin = useRef(onFin)
  fin.current = onFin
  const c = datos.clips[clip] ?? datos.clips.quieto ?? Object.values(datos.clips)[0]
  useEffect(() => {
    const d = el.current
    if (!d || !c) return
    const [cw, ch] = datos.celda
    const pintar = (k: number) => {
      const i = c.desde + Math.max(0, Math.min(c.n - 1, k))
      d.style.backgroundPosition = `${-(i % datos.columnas) * cw}px ${-Math.floor(i / datos.columnas) * ch}px`
    }
    if (reducido) { pintar(c.unaVez ? c.n - 1 : 0); if (c.unaVez) { const id = window.setTimeout(() => fin.current?.(), 600); return () => window.clearTimeout(id) } return }
    const t0 = performance.now()
    let id = 0
    let avisado = false
    const paso = (ahora: number) => {
      const f = Math.floor(((ahora - t0) / 1000) * (c.fps ?? 24) * vel)
      if (c.unaVez) { pintar(f); if (f >= c.n - 1 && !avisado) { avisado = true; fin.current?.() } } else pintar(f % c.n)
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [c, clip, datos, reducido, vel])
  const [cw, ch] = datos.celda
  const nativa = url === HOJA_RIVAL ? MIRA_RIVAL[clip] ?? 1 : 1
  const voltear = nativa !== mira
  return (
    <div
      ref={el}
      className={`tema-sprite ${className}`}
      style={{ backgroundImage: `url(${url})`, backgroundSize: `${datos.columnas * cw}px ${datos.filas * ch}px`, width: cw, height: ch, transform: voltear ? 'scaleX(-1)' : undefined, ...style }}
      aria-hidden
    />
  )
}

/** El «?» de tinta arriba del rival cuando se asoma (al dudar). */
export function Pregunta() {
  return <span className="tema-pregunta" aria-hidden>?</span>
}

/** La bolita dorada de XP que se lleva el rival mientras corre. */
export function BolitaDorada({ style }: { style?: CSSProperties }) {
  return <span className="tema-bolita" style={style} aria-hidden />
}
