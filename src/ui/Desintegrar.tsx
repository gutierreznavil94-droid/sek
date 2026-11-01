import { useEffect, useRef, type RefObject } from 'react'
import { movimientoReducido } from './componentes'

/**
 * La cabecera es parte del fondo. Al bajar (pasado el 30 % de su alto) se
 * dispara una animación con tiempo propio, igual de lenta aunque se baje de golpe:
 *   1. Desintegración (0–0,6 s): se deshace en polvo de tinta desde el borde izquierdo.
 *   2. Reunión (0,6–1,1 s): el polvo se arremolina y forma 5 pájaros de tinta.
 *   3. Vuelo (1,1–2,2 s): los pájaros aletean y se van arriba y al costado, cada uno a su ritmo.
 * Al volver arriba, la cabecera se rearma con un fundido tranquilo, sin partículas.
 * Nunca hay dos animaciones a la vez. Con «reducir movimiento», solo fundidos.
 */

const AVES = 5
const POLVO = 260
const DUR = 2.3

type Ave = { cx: number; cy: number; vx: number; vy: number; curva: number; fase: number; envergadura: number; fin: number }
type Grano = { u: number; v: number; te: number; ave: number; ox: number; oy: number; vx: number; vy: number; r: number; x: number; y: number; vivo: boolean; giro: number; papel: boolean }

function azar(semilla: number) {
  let s = semilla
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const suave = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x) }

export type EstadoCabecera = 'armada' | 'animando' | 'ausente' | 'rearmando'

/** Reglas de cuándo se dispara y cuándo se rearma (separadas para probarlas). */
export function siguienteEstado(estado: EstadoCabecera, avance: number, terminoAnimacion: boolean, terminoRearmado: boolean): EstadoCabecera {
  if (estado === 'armada' && avance > 0.3) return 'animando'
  if (estado === 'animando' && terminoAnimacion) return avance < 0.15 ? 'rearmando' : 'ausente'
  if (estado === 'ausente' && avance < 0.15) return 'rearmando'
  if (estado === 'rearmando' && terminoRearmado) return 'armada'
  return estado
}

/** Forma de un pájaro: puntos sobre las dos alas en curva y el cuerpo (unidades de envergadura). */
function puntoDeAve(r: () => number): [number, number] {
  if (r() < 0.18) return [(r() - 0.5) * 0.12, (r() - 0.5) * 0.08]
  const a = r() * 2 - 1
  return [a * 0.5, -Math.abs(a) * 0.22 + Math.abs(a) ** 2 * 0.12 + (r() - 0.5) * 0.05]
}

function dibujarAve(ctx: CanvasRenderingContext2D, x: number, y: number, e: number, cuadro: number) {
  // 3 cuadros de ala: arriba, al medio, abajo
  const alto = [0.42, 0.12, -0.18][cuadro] * e
  const m = e / 2
  ctx.beginPath()
  ctx.moveTo(x - m, y - alto)
  ctx.quadraticCurveTo(x - m * 0.45, y - alto * 0.2 - e * 0.05, x, y)
  ctx.quadraticCurveTo(x + m * 0.45, y - alto * 0.2 - e * 0.05, x + m, y - alto)
  ctx.quadraticCurveTo(x + m * 0.4, y - alto * 0.05 + e * 0.06, x, y + e * 0.08)
  ctx.quadraticCurveTo(x - m * 0.4, y - alto * 0.05 + e * 0.06, x - m, y - alto)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(241, 235, 223, 0.9)'
  ctx.lineWidth = 2.2
  ctx.stroke()
  ctx.fillStyle = '#121110'
  ctx.fill()
}

export function Desintegracion({ cabecera, texto }: { cabecera: RefObject<HTMLElement | null>; texto: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const mini = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const cab = cabecera.current
    const cv = lienzo.current
    const mi = mini.current
    if (!cab || !cv || !mi) return
    const ctx = cv.getContext('2d')
    const quieto = movimientoReducido()
    let ancho = 0, alto = 0, arriba = 0, dpr = 1
    let estado: EstadoCabecera = 'armada'
    let t0 = 0, tRearme = 0, rafAnim = 0, rafScroll = 0, ultimo = 0, fijo = 0
    let aves: Ave[] = []
    let polvo: Grano[] = []
    let corrida = 0

    const medir = () => {
      const t = cab.style.transform
      cab.style.transform = ''
      const r = cab.getBoundingClientRect()
      cab.style.transform = t
      arriba = r.top + window.scrollY
      alto = r.height + 30
      ancho = window.innerWidth
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(ancho * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
    }
    const avance = () => Math.max(0, window.scrollY) / alto
    const topeCabecera = () => arriba - Math.max(0, window.scrollY) * 0.65

    const mostrarMini = (v: boolean) => {
      mi.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
      mi.style.opacity = v ? '1' : '0'
      mi.style.transform = v ? 'translate3d(0,0,0)' : 'translate3d(0,-6px,0)'
    }

    function pedir() { if (!rafScroll) rafScroll = requestAnimationFrame(alDesplazar) }

    const prepararAnimacion = () => {
      const r = azar(97 + (corrida++ % 7))
      const top = fijo
      aves = Array.from({ length: AVES }, (_, k) => {
        const lado = r() < 0.3 ? -1 : 1
        return {
          cx: ancho * (0.14 + 0.18 * k + (r() - 0.5) * 0.06),
          cy: Math.max(110, top + alto * 0.35) + r() * alto * 0.3,
          vx: lado * (50 + r() * 110),
          vy: -(80 + r() * 100),
          curva: (r() - 0.5) * 60,
          fase: r() * 3,
          envergadura: 30 + r() * 12,
          fin: 2.0 + r() * 0.3,
        }
      })
      polvo = Array.from({ length: POLVO }, (_, i) => {
        const u = r(), v = r()
        const ave = Math.min(AVES - 1, Math.floor(u * AVES))
        const [ox, oy] = puntoDeAve(r)
        return { u, v, te: u * 0.48 + r() * 0.08, ave: i % 4 === 0 ? (ave + 1) % AVES : ave, ox, oy, vx: 30 + r() * 90, vy: -(15 + r() * 50), r: 1 + r() * 1.6, x: 0, papel: r() < 0.55, y: 0, vivo: false, giro: (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2) }
      })
    }

    // Centro del pájaro k en el tiempo t (desde que empieza a formarse).
    const centroAve = (a: Ave, t: number): [number, number] => {
      const tf = Math.max(0, t - 0.6)
      const dx = a.curva * Math.sin(tf * 2.2)
      const vuelo = Math.max(0, t - 1.1)
      const imp = vuelo ** 1.35
      return [a.cx + dx + a.vx * imp, a.cy - tf * 14 + a.vy * imp]
    }

    const cuadroAnimacion = (ahora: number) => {
      rafAnim = 0
      const t = (ahora - t0) / 1000
      const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 0.016)
      ultimo = ahora
      // La cabecera se borra con un frente que avanza de izquierda a derecha (0–0,6 s)
      const frente = -20 + 140 * suave(t / 0.6)
      const mascara = `linear-gradient(100deg, transparent ${frente.toFixed(1)}%, #000 ${(frente + 18).toFixed(1)}%)`
      cab.style.setProperty('-webkit-mask-image', mascara)
      cab.style.setProperty('mask-image', mascara)
      if (t > 0.6) cab.style.opacity = '0'
      if (t > 0.45 && mi.style.opacity !== '1') mostrarMini(true)
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, ancho, window.innerHeight)
        const top = fijo
        // Polvo: nace en el frente, vuela con el viento, después se arremolina hacia su pájaro
        const reunion = suave((t - 0.6) / 0.5)
        const fundePolvo = 1 - suave((t - 1.0) / 0.15)
        if (fundePolvo > 0) {
          for (const g of polvo) {
            if (!g.vivo) {
              if (t < g.te) continue
              g.vivo = true
              g.x = g.u * ancho
              g.y = top + g.v * alto
            }
            g.x += g.vx * dt
            g.y += g.vy * dt
            g.vx *= 0.995
            let x = g.x, y = g.y
            if (reunion > 0) {
              const a = aves[g.ave]
              const [cx, cy] = centroAve(a, t)
              const tx = cx + g.ox * a.envergadura, ty = cy + g.oy * a.envergadura
              const ang = (1 - reunion) * g.giro
              const rx = x - tx, ry = y - ty
              const rx2 = rx * Math.cos(ang) - ry * Math.sin(ang), ry2 = rx * Math.sin(ang) + ry * Math.cos(ang)
              x = tx + rx2 * (1 - reunion)
              y = ty + ry2 * (1 - reunion)
            }
            const nace = clamp((t - g.te) / 0.12)
            // Granos de papel (claros) y de tinta (con borde de papel), para que se vean sobre el fondo oscuro
            const rad = g.r * (1 - 0.3 * reunion)
            ctx.globalAlpha = nace * fundePolvo * 0.95
            ctx.beginPath()
            ctx.arc(x, y, rad, 0, Math.PI * 2)
            if (g.papel) { ctx.fillStyle = '#F1EBDF'; ctx.fill() }
            else { ctx.fillStyle = '#121110'; ctx.fill(); ctx.strokeStyle = 'rgba(241, 235, 223, 0.7)'; ctx.lineWidth = 0.8; ctx.stroke() }
          }
        }
        // Pájaros: aparecen donde se juntó el polvo, aletean y se van
        const aparecen = suave((t - 1.0) / 0.15)
        if (aparecen > 0) {
          for (const a of aves) {
            const vuelo = Math.max(0, t - 1.1)
            const desvanece = 1 - suave((t - (a.fin - 0.45)) / 0.45)
            if (desvanece <= 0) continue
            const [x, y] = centroAve(a, t)
            const cuadro = Math.floor((t * 9 + a.fase) % 3)
            ctx.globalAlpha = aparecen * desvanece
            dibujarAve(ctx, x, y, a.envergadura * (1 - 0.45 * clamp(vuelo / 1.1)), vuelo > 0 ? cuadro : 1)
          }
        }
        ctx.globalAlpha = 1
      }
      if (t < DUR) { rafAnim = requestAnimationFrame(cuadroAnimacion); return }
      // Terminó
      ctx?.clearRect(0, 0, cv.width, cv.height)
      cab.style.removeProperty('-webkit-mask-image')
      cab.style.removeProperty('mask-image')
      estado = siguienteEstado(estado, avance(), true, false)
      pedir()
      if (estado === 'rearmando') rearmar()
    }

    const ocultarSinParticulas = () => {
      cab.style.transition = 'opacity 0.5s ease'
      cab.style.opacity = '0'
      cab.style.pointerEvents = 'none'
      mostrarMini(true)
      t0 = performance.now()
      const fin = () => {
        if (estado !== 'animando') return
        estado = siguienteEstado(estado, avance(), true, false)
        if (estado === 'rearmando') rearmar()
      }
      setTimeout(fin, 520)
    }

    const rearmar = () => {
      cab.style.transition = 'opacity 0.7s ease'
      cab.style.opacity = '1'
      cab.style.pointerEvents = ''
      mostrarMini(false)
      tRearme = performance.now()
      setTimeout(() => {
        if (estado !== 'rearmando' || performance.now() - tRearme < 690) return
        estado = siguienteEstado(estado, avance(), false, true)
        cab.style.transition = ''
        // Si mientras se rearmaba ya se bajó de nuevo, arranca otra vez (una sola)
        alDesplazar()
      }, 720)
    }

    const alDesplazar = () => {
      rafScroll = 0
      const s = Math.max(0, window.scrollY)
      // Mientras se deshace, la cabecera queda quieta en pantalla (aunque se baje de golpe), para que se vea entera la animación
      if (estado === 'animando') cab.style.transform = `translate3d(0, ${(fijo - arriba + s).toFixed(1)}px, 0)`
      else cab.style.transform = s > 0 ? `translate3d(0, ${(s * 0.35).toFixed(1)}px, 0)` : ''
      const antes = estado
      if (estado === 'animando' || estado === 'rearmando') return
      estado = siguienteEstado(estado, avance(), false, false)
      if (antes === 'armada' && estado === 'animando') {
        cab.style.transition = ''
        cab.style.pointerEvents = 'none'
        fijo = Math.max(topeCabecera(), Math.min(arriba, 0))
        cab.style.transform = `translate3d(0, ${(fijo - arriba + s).toFixed(1)}px, 0)`
        if (quieto || !ctx) { ocultarSinParticulas(); return }
        prepararAnimacion()
        t0 = performance.now()
        ultimo = 0
        rafAnim = requestAnimationFrame(cuadroAnimacion)
      } else if (antes === 'ausente' && estado === 'rearmando') {
        rearmar()
      }
    }
    const redimensionar = () => { if (estado === 'armada') medir() ; pedir() }
    medir()
    alDesplazar()
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', redimensionar)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redimensionar) : null
    ro?.observe(cab)
    return () => {
      cancelAnimationFrame(rafAnim)
      cancelAnimationFrame(rafScroll)
      window.removeEventListener('scroll', pedir)
      window.removeEventListener('resize', redimensionar)
      ro?.disconnect()
      for (const p of ['transform', 'opacity', 'pointer-events', 'transition', 'mask-image', '-webkit-mask-image']) cab.style.removeProperty(p)
    }
  }, [cabecera])
  return (
    <>
      <canvas ref={lienzo} className="motas-tinta" aria-hidden="true" />
      <div ref={mini} className="dia-mini" aria-hidden="true">{texto}</div>
    </>
  )
}
