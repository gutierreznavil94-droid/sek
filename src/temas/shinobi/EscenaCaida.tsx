/**
 * Escena «caída» del tema Shinobi (~9 s, pantalla completa). SEK solo dispara el evento y pasa la XP.
 * 1. Te arrasan (0–2,5 s): el clip R7 repetido muchas veces, cada vez más grandes y rápidos, con la espada afuera,
 *    hasta que todo queda gris oscuro. No se ve al shinobi.
 * 2. Fundido de tinta (2,5–3 s).
 * 3. La tumba (3–8 s): clip t6-tumba-regreso.mp4 si existe; si no, la tumba quieta dibujada acá
 *    (árbol seco en la montaña, lluvia, katana clavada con el sombrero) y la mano que sale de la tierra.
 * 4. Renacer (8 s en adelante): 甦 con brillo rojo que late, «NUEVO ROUND» y «Levantarme».
 * Con movimiento reducido: directo a la tumba quieta con el kanji y la frase.
 */
import { useEffect, useRef, useState } from 'react'

const BASE = `${import.meta.env.BASE_URL}temas/shinobi/caida/`
const CLIP_RIVAL = `${BASE}r7-rival-corre.mp4`
const CLIP_TUMBA = `${BASE}t6-tumba-regreso.mp4`

export const TIEMPOS_CAIDA = { arrasan: 2500, tinta: 500, tumba: 5000 }
export const KANJI_CAIDA = '甦'

// ---------- ¿Está el clip de la tumba? (una vez por carga) ----------
let hayTumba: boolean | null = null
function revisarClipTumba(): Promise<boolean> {
  if (hayTumba !== null) return Promise.resolve(hayTumba)
  return (async () => {
    try {
      const r = await fetch(CLIP_TUMBA, { method: 'HEAD', cache: 'no-store' })
      hayTumba = r.ok && (r.headers.get('content-type') ?? '').startsWith('video')
    } catch { hayTumba = false }
    return hayTumba
  })()
}

type Fase = 'arrasan' | 'tinta' | 'tumba' | 'renacer'

export function EscenaCaida({ xp, reducido = false, onFin }: { xp: number; reducido?: boolean; onFin: () => void }) {
  const [fase, setFase] = useState<Fase>(reducido ? 'tumba' : 'arrasan')
  const [clipTumba, setClipTumba] = useState(false)
  useEffect(() => { void revisarClipTumba().then(setClipTumba) }, [])
  useEffect(() => {
    if (fase === 'renacer') { try { navigator.vibrate?.([80, 60, 80, 60, 240]) } catch { /* sin vibración */ } return }
    const dur = reducido && fase === 'tumba' ? 900 : TIEMPOS_CAIDA[fase]
    const sig: Record<Exclude<Fase, 'renacer'>, Fase> = { arrasan: 'tinta', tinta: 'tumba', tumba: 'renacer' }
    const id = window.setTimeout(() => setFase(sig[fase]), dur)
    return () => window.clearTimeout(id)
  }, [fase, reducido])
  return (
    <div className={`tema-caida ${fase} ${reducido ? 'quieta' : ''}`} role="dialog" aria-label="Caída: nuevo round">
      {fase === 'arrasan' && <Estampida duracion={TIEMPOS_CAIDA.arrasan} />}
      {fase === 'tinta' && <div className="tema-caida-tinta" />}
      {(fase === 'tumba' || fase === 'renacer') && (
        clipTumba && !reducido
          ? <video className="tema-caida-video" src={CLIP_TUMBA} playsInline muted autoPlay preload="auto" onError={() => setClipTumba(false)} />
          : <TumbaQuieta mano={!reducido} />
      )}
      {fase === 'renacer' && (
        <div className="tema-caida-final">
          <div className="tema-caida-kanji" aria-hidden>{KANJI_CAIDA}</div>
          <div className="tema-caida-frase">Caíste. No terminaste.</div>
          <div className="tema-caida-round">NUEVO ROUND</div>
          <div className="tema-caida-precio">{xp > 0 ? `−${xp} XP · el precio de volver` : 'sin XP que perder · seguís'}</div>
          <button type="button" className="tema-caida-boton" onClick={onFin}>Levantarme</button>
        </div>
      )}
      {fase !== 'renacer' && <button type="button" className="tema-caida-saltar" onClick={() => setFase('renacer')}>Saltar</button>}
    </div>
  )
}

// ---------- 1. Te arrasan: lienzo con el clip del rival dibujado muchas veces ----------

type Rival = { x: number; base: number; alto: number; vel: number; desfase: number }

function Estampida({ duracion }: { duracion: number }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const c = lienzo.current
    const v = video.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const W = c.clientWidth || window.innerWidth
    const H = c.clientHeight || window.innerHeight
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    ctx.scale(dpr, dpr)
    v?.play().catch(() => undefined)
    const rivales: Rival[] = []
    const inicio = performance.now()
    let proximo = 0
    let ultimo = inicio
    let raf = 0
    let azar = 7
    const rnd = () => { azar = (azar * 9301 + 49297) % 233280; return azar / 233280 }
    const cuadro = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion)
      const dt = Math.min(0.05, Math.max(0, (ahora - ultimo) / 1000))
      ultimo = ahora
      // Cada vez salen más seguido, más grandes y más rápidos
      while (proximo <= t) {
        const alto = H * (0.22 + 1.25 * t * t + rnd() * 0.2)
        rivales.push({ x: -alto * 0.9 - rnd() * W * 0.3, base: H * (0.45 + rnd() * 0.5) + alto * 0.35, alto, vel: W * (0.7 + 2.6 * t + rnd() * 0.5), desfase: rnd() * 4 })
        proximo += 0.07 - 0.05 * t
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#e9e1d0'
      ctx.fillRect(0, 0, W, H)
      rivales.sort((a, b) => a.alto - b.alto)
      for (const r of rivales) {
        r.x += r.vel * dt
        if (r.x > W + r.alto) continue
        const ancho = r.alto * 1.03
        const y = r.base - r.alto
        ctx.globalCompositeOperation = 'multiply'
        ctx.globalAlpha = Math.min(0.8, 0.45 + 0.3 * r.alto / H)
        if (v && v.readyState >= 2) ctx.drawImage(v, r.x, y, ancho, r.alto)
        else siluetaDibujada(ctx, r.x, y, ancho, r.alto)
        // La espada desenvainada, hacia atrás desde la mano
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.9
        ctx.strokeStyle = '#2b2b2b'
        ctx.lineWidth = Math.max(1.5, r.alto * 0.022)
        ctx.lineCap = 'round'
        const mx = r.x + ancho * 0.22
        const my = y + r.alto * 0.42
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ancho * 0.55, my - r.alto * 0.18); ctx.stroke()
        ctx.strokeStyle = '#d8d8d4'
        ctx.lineWidth = Math.max(0.6, r.alto * 0.007)
        ctx.beginPath(); ctx.moveTo(mx - ancho * 0.06, my - r.alto * 0.02); ctx.lineTo(mx - ancho * 0.53, my - r.alto * 0.175); ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      // Al final todo queda gris oscuro
      const gris = Math.max(0, (t - 0.55) / 0.45)
      if (gris > 0) { ctx.fillStyle = `rgba(38,38,38,${Math.min(1, gris * gris * 1.1)})`; ctx.fillRect(0, 0, W, H) }
      if (t < 1) raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
  }, [duracion])
  return (
    <>
      <video ref={video} src={CLIP_RIVAL} muted playsInline loop autoPlay preload="auto" className="tema-caida-fuente" />
      <canvas ref={lienzo} className="tema-caida-lienzo" />
    </>
  )
}

/** Si el clip no carga: una silueta simple de rival corriendo. */
function siluetaDibujada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2e2e2e'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.72, y + h * 0.12, w * 0.08, h * 0.08, 0, 0, Math.PI * 2)
  ctx.moveTo(x + w * 0.66, y + h * 0.2)
  ctx.lineTo(x + w * 0.8, y + h * 0.24)
  ctx.lineTo(x + w * 0.6, y + h * 0.62)
  ctx.lineTo(x + w * 0.85, y + h * 0.98)
  ctx.lineTo(x + w * 0.7, y + h * 0.98)
  ctx.lineTo(x + w * 0.45, y + h * 0.7)
  ctx.lineTo(x + w * 0.15, y + h * 0.98)
  ctx.lineTo(x + w * 0.05, y + h * 0.92)
  ctx.lineTo(x + w * 0.35, y + h * 0.6)
  ctx.closePath()
  ctx.fill()
}

// ---------- 3. La tumba quieta (mientras no esté el clip t6) ----------

function TumbaQuieta({ mano }: { mano: boolean }) {
  return (
    <svg className="tema-caida-tumba" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="caida-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2b2c" />
          <stop offset="0.6" stopColor="#4a4b4a" />
          <stop offset="1" stopColor="#1d1d1d" />
        </linearGradient>
        <clipPath id="caida-suelo"><rect x="0" y="0" width="360" height="487" /></clipPath>
      </defs>
      <rect width="360" height="640" fill="url(#caida-cielo)" />
      {/* Montañas al fondo */}
      <path d="M0 330 L60 270 L95 300 L160 220 L215 290 L250 260 L360 340 L360 640 L0 640 Z" fill="#3a3b3b" />
      <path d="M0 400 L80 360 L150 380 L230 340 L360 390 L360 640 L0 640 Z" fill="#2c2d2d" />
      {/* La loma donde está la tumba */}
      <path d="M0 470 C90 430 250 420 360 455 L360 640 L0 640 Z" fill="#171717" />
      {/* Árbol seco */}
      <g className="tema-caida-arbol" stroke="#121212" strokeLinecap="round" fill="none">
        <path d="M262 455 C258 400 266 360 252 310" strokeWidth="9" />
        <path d="M255 340 C230 320 214 300 196 296" strokeWidth="4.5" />
        <path d="M214 302 C206 288 206 278 196 266" strokeWidth="2.5" />
        <path d="M253 320 C268 296 290 286 306 266" strokeWidth="4" />
        <path d="M290 282 C300 282 312 290 322 286" strokeWidth="2.2" />
        <path d="M252 312 C248 290 254 270 246 248" strokeWidth="3" />
        <path d="M249 262 C236 252 230 242 228 232" strokeWidth="1.8" />
      </g>
      {/* La lápida */}
      <path d="M150 462 L150 384 C150 368 162 358 178 358 C194 358 206 368 206 384 L206 462 Z" fill="#5a5a58" stroke="#141414" strokeWidth="2.5" />
      <text x="178" y="420" textAnchor="middle" fontSize="26" fill="#2a2a2a" fontFamily="serif">墓</text>
      {/* La katana clavada (un poco inclinada) con el sombrero de paja apoyado en el mango */}
      <g className="tema-caida-katana" transform="rotate(-6 120 482)">
        <path d="M120 484 L120 410" stroke="#b9b9b4" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M120 484 L120 410" stroke="#e2e2dd" strokeWidth="0.6" transform="translate(0.8 0)" />
        <path d="M110 409 L130 409" stroke="#0e0e0e" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M120 408 L120 380" stroke="#0e0e0e" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M118 386 L122 383 M118 392 L122 389 M118 398 L122 395" stroke="#3a3a3a" strokeWidth="1" />
        <path d="M116 398 C108 408 104 418 100 430" stroke="#a3262a" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      <g className="tema-caida-kasa" transform="rotate(-10 122 380)">
        <path d="M78 388 C96 372 110 364 122 362 C134 364 148 372 166 388 C150 392 94 392 78 388 Z" fill="#1b1b1a" stroke="#0a0a0a" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M100 377 L122 362 L144 377 M90 384 L122 362 L154 384" stroke="#353533" strokeWidth="0.8" fill="none" />
      </g>
      {/* Tierra removida al lado de la tumba */}
      <path d="M206 488 C220 479 252 479 266 489 C250 494 222 494 206 488 Z" fill="#0e0e0e" />
      {mano && (
        <g clipPath="url(#caida-suelo)"><g className="tema-caida-mano" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Contorno claro y después la tinta: antebrazo, palma, cuatro dedos que arañan y el pulgar */}
          {[['#4c4c4a', 3.2], ['#0b0b0b', 0]].map(([c, extra]) => (
            <g key={String(c)} stroke={String(c)}>
              <path d="M236 500 L235 462" strokeWidth={12 + Number(extra)} />
              <path d="M235 458 L236 452" strokeWidth={15 + Number(extra)} />
              <path d="M229 450 C227 442 226 436 224 430" strokeWidth={4 + Number(extra)} />
              <path d="M234 448 C234 440 234 432 233 424" strokeWidth={4.2 + Number(extra)} />
              <path d="M239 448 C240 440 241 434 242 427" strokeWidth={4 + Number(extra)} />
              <path d="M243 451 C245 445 247 441 249 436" strokeWidth={3.6 + Number(extra)} />
              <path d="M229 460 C224 456 221 452 219 446" strokeWidth={4 + Number(extra)} />
            </g>
          ))}
        </g></g>
      )}
      {/* Lluvia */}
      <g className="tema-caida-lluvia" stroke="#9a9a96" strokeWidth="1" opacity="0.45">
        {Array.from({ length: 34 }, (_, i) => {
          const x = (i * 53) % 360
          const y = (i * 97) % 640
          return <path key={i} d={`M${x} ${y} l-6 26`} />
        })}
      </g>
    </svg>
  )
}
