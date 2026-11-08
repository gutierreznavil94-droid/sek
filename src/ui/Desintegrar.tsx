import { useEffect, useRef, type RefObject } from 'react'
import { movimientoReducido } from './componentes'
import { PapelMojado } from '../temas/PapelMojado'
import { dibujarPajaroTorpe } from '../temas/shinobi/pajaroTorpe'
import { obtenerAjustes } from '../services/base'
import { sonarToc } from './animaciones/motor'
import { adorno } from '../temas/temas'

/**
 * La cabecera es parte del fondo. Al bajar (pasado el 30 % de su alto) se
 * dispara una animación con tiempo propio, igual de lenta aunque se baje de golpe:
 *   1. Desintegración (0–0,6 s): se deshace en polvo de tinta desde el borde izquierdo.
 *   2. Reunión (0,6–1,1 s): el polvo se arremolina y forma 5 pájaros de tinta.
 *   3. Vuelo (1,1–2,2 s): los pájaros aletean y se van arriba y al costado, cada uno a su ritmo.
 * Al volver arriba, la cabecera se rearma con un fundido tranquilo, sin partículas.
 * Nunca hay dos animaciones a la vez. Con «reducir movimiento», solo fundidos.
 *
 * En Hoy, la barra del horario está en la cabecera (sobre el hueco `#hueco-horario`) pero NO se va con ella:
 * cuando la cabecera se deshace, la barra «aterriza» arriba en 0,25 s y queda fija; el polvo pasa por delante.
 * Pájaro torpe: el 10 % de las veces (nunca dos seguidas), cuando los demás ya se fueron, uno se choca con el
 * borde derecho, dice «¡agh!» y se va volando para arriba. Apagable en Ver animaciones.
 */

export const PROB_PAJARO_TORPE = 0.1
const CLAVE_TORPE_ULTIMO = 'pajaro-torpe-ultimo'
const CLAVE_TORPE_FORZAR = 'pajaro-torpe-forzar'

/** ¿Sale el pájaro torpe esta vez? 10 %, nunca dos veces seguidas; «forzar» (Probar) gana. */
export function decidirPajaroTorpe(x: { activo: boolean; ultimoFueTorpe: boolean; forzar?: boolean; azar?: () => number }): boolean {
  if (!x.activo) return false
  if (x.forzar) return true
  if (x.ultimoFueTorpe) return false
  return (x.azar ?? Math.random)() < PROB_PAJARO_TORPE
}

/** «Probar»: el próximo encabezado que se haga polvo trae al pájaro torpe. */
export function forzarPajaroTorpe(): void {
  try { localStorage.setItem(CLAVE_TORPE_FORZAR, '1') } catch { /* sin almacenamiento */ }
}

/** Sortea (y anota) si esta vez sale el torpe. */
function tocaPajaroTorpe(activo: boolean): boolean {
  let ultimo = false
  let forzar = false
  try { ultimo = localStorage.getItem(CLAVE_TORPE_ULTIMO) === '1'; forzar = localStorage.getItem(CLAVE_TORPE_FORZAR) === '1'; localStorage.removeItem(CLAVE_TORPE_FORZAR) } catch { /* sin almacenamiento */ }
  const sale = decidirPajaroTorpe({ activo, ultimoFueTorpe: ultimo, forzar })
  try { localStorage.setItem(CLAVE_TORPE_ULTIMO, sale ? '1' : '0') } catch { /* sin almacenamiento */ }
  return sale
}

/** Tramos del pájaro torpe (s, desde que empieza la animación). */
const TORPE = { sale: 2.15, choca: 2.95, globo: 3.0, finGlobo: 3.7, sacude: 3.6, vuela: 3.9, fin: 4.9 }

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

/** Estrellita (k par) o corazoncito (k impar) que brilla: para los temas con `adornos.aves: "estrellas"`. */
function dibujarEstrella(ctx: CanvasRenderingContext2D, x: number, y: number, e: number, k: number, t: number) {
  const brillo = 0.75 + 0.25 * Math.sin(t * 7 + k * 1.7)
  const r = (e / 2.6) * brillo
  ctx.beginPath()
  if (k % 2 === 0) {
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 === 0 ? r : r * 0.45
      ctx.lineTo(x + rr * Math.cos(ang), y + rr * Math.sin(ang))
    }
  } else {
    ctx.moveTo(x, y + r * 0.85)
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35)
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.85)
  }
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
  ctx.shadowBlur = 8 * brillo
  ctx.fillStyle = k % 2 === 0 ? '#FFE27A' : '#F4A6C8'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 1.2
  ctx.stroke()
}

export function Desintegracion({ cabecera, texto, conHorario = false }: { cabecera: RefObject<HTMLElement | null>; texto: string; conHorario?: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  /** El pájaro torpe va en su propio lienzo, por delante de todo (tarjetas, polvo y barra). */
  const lienzoTorpe = useRef<HTMLCanvasElement>(null)
  const mini = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const cab = cabecera.current
    const cv = lienzo.current
    const mi = mini.current
    if (!cab || !cv || !mi) return
    const ctx = cv.getContext('2d')
    const cvT = lienzoTorpe.current
    const ctxT = cvT?.getContext('2d') ?? null
    const quieto = movimientoReducido()
    const ba = conHorario ? barra.current : null
    let torpeActivo = true
    let torpe = false
    let tocado = false
    void obtenerAjustes().then((a) => { torpeActivo = a.pajaroTorpe !== false }).catch(() => undefined)
    // ---- La barra del horario: sigue al hueco mientras está la cabecera; fija arriba cuando no ----
    let barraFija = false
    let hastaTransicion = 0
    const ponerBarra = (fija: boolean, animar = false) => {
      if (!ba) return
      const h = document.getElementById('hueco-horario')
      const y = fija || !h ? 0 : Math.max(0, h.getBoundingClientRect().top)
      if (animar && !quieto) hastaTransicion = performance.now() + 270
      ba.style.transition = performance.now() < hastaTransicion ? 'transform 0.25s ease-out, box-shadow 0.25s ease-out' : ''
      ba.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
      if (fija !== barraFija) { barraFija = fija; ba.classList.toggle('fija', fija) }
    }
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
      if (cvT) { cvT.width = cv.width; cvT.height = cv.height }
    }
    const avance = () => Math.max(0, window.scrollY) / alto
    const topeCabecera = () => arriba - Math.max(0, window.scrollY) * 0.65

    const mostrarMini = (v: boolean) => {
      if (ba) { mi.style.opacity = '0'; return }
      mi.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
      mi.style.opacity = v ? '1' : '0'
      mi.style.transform = v ? 'translate3d(0,0,0)' : 'translate3d(0,-6px,0)'
    }

    function pedir() { if (!rafScroll) rafScroll = requestAnimationFrame(alDesplazar) }

    let estrellas = false
    const prepararAnimacion = () => {
      estrellas = adorno('aves') === 'estrellas'
      // El pájaro torpe es de los pájaros de tinta: con estrellitas no sale.
      torpe = !estrellas && tocaPajaroTorpe(torpeActivo)
      tocado = false
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
      const imp = vuelo ** 1.35 * (estrellas ? 0.3 : 1) // las estrellitas flotan despacio
      return [a.cx + dx + a.vx * imp, a.cy - tf * 14 + a.vy * imp]
    }

    /** El pájaro torpe: vuela al borde derecho, se choca (dos plumitas), «¡agh!», se sacude y se va para arriba. */
    const dibujarTorpe = (c: CanvasRenderingContext2D, t: number) => {
      const e = 50
      const x0 = -e * 0.8, y0 = Math.max(110, fijo + alto * 0.5)
      const borde = ancho - e * 0.66
      let x = x0, y = y0, cuadro = Math.floor((t * 10) % 3), giro = 0
      if (t < TORPE.choca) {
        const k = suave((t - TORPE.sale) / (TORPE.choca - TORPE.sale))
        x = x0 + (borde - x0) * k
        y = y0 - 10 * Math.sin(k * Math.PI)
      } else if (t < TORPE.vuela) {
        if (!tocado) { tocado = true; sonarToc() }
        const k = clamp((t - TORPE.choca) / 0.18)
        x = borde - 18 * Math.sin(k * Math.PI * 0.5)
        y = y0 + 8 * k
        cuadro = 2
        giro = -0.35 * (1 - k)
        if (t >= TORPE.sacude) { const s2 = (t - TORPE.sacude) / 0.2; x += Math.sin(s2 * Math.PI * 6) * 3 * (1 - clamp(s2)); cuadro = Math.floor((t * 16) % 3) }
      } else {
        const k = (t - TORPE.vuela) / (TORPE.fin - TORPE.vuela)
        x = borde - 18 - 30 * k
        y = y0 + 8 - (y0 + 80) * k ** 1.3
      }
      c.save()
      c.translate(x, y); c.rotate(giro)
      c.globalAlpha = 1
      dibujarPajaroTorpe(c, e, cuadro, t >= TORPE.choca && t < TORPE.vuela)
      c.restore()
      // Dos plumitas que caen después del choque
      if (t > TORPE.choca && t < TORPE.choca + 1.2) {
        const k = (t - TORPE.choca) / 1.2
        for (const [dx, fase] of [[-6, 0], [7, 1.7]] as const) {
          const px = borde - 10 + dx + Math.sin(k * 6 + fase) * 6
          const py = y0 + k * 70
          c.globalAlpha = 1 - k
          c.save(); c.translate(px, py); c.rotate(Math.sin(k * 5 + fase) * 0.8)
          c.beginPath(); c.ellipse(0, 0, 8, 2.6, 0, 0, Math.PI * 2)
          c.fillStyle = '#121110'; c.fill(); c.strokeStyle = 'rgba(241, 235, 223, 0.85)'; c.lineWidth = 0.8; c.stroke()
          c.restore()
        }
      }
      // Globito de papel «¡agh!»
      if (t >= TORPE.globo && t < TORPE.finGlobo + 0.1) {
        const a = t < TORPE.finGlobo ? clamp((t - TORPE.globo) / 0.08) : 1 - clamp((t - TORPE.finGlobo) / 0.1)
        const gw = 66, gh = 28
        const gx = borde - gw - 34, gy = y0 - 74
        c.globalAlpha = a
        // Globo de papel con borde a pincel (dos trazos apenas corridos) y la punta hacia el pájaro
        const globo = () => {
          c.beginPath()
          if (typeof c.roundRect === 'function') c.roundRect(gx, gy, gw, gh, [11, 14, 10, 13]); else c.rect(gx, gy, gw, gh)
          c.moveTo(gx + gw - 18, gy + gh); c.lineTo(gx + gw + 4, gy + gh + 14); c.lineTo(gx + gw - 32, gy + gh)
        }
        globo(); c.fillStyle = '#F4EFE6'; c.fill()
        c.strokeStyle = '#151413'; c.lineWidth = 2.4; c.stroke()
        c.save(); c.translate(0.8, -0.6); c.globalAlpha = a * 0.45; c.lineWidth = 1; globo(); c.stroke(); c.restore()
        c.globalAlpha = a
        c.fillStyle = '#151413'; c.font = "900 16px 'Pincel', system-ui, sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('¡agh!', gx + gw / 2, gy + gh / 2 + 1)
      }
      c.globalAlpha = 1
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
      // Además del frente, la cabecera se apaga rápido: no quedan pestañas ni papel asomando entre las tarjetas
      cab.style.opacity = String(Math.max(0, 1 - suave(t / 0.45)).toFixed(3))
      if (t > 0.45 && mi.style.opacity !== '1') mostrarMini(true)
      // La barra aterriza arriba mientras la cabecera termina de irse (el polvo, en el lienzo, pasa por delante)
      if (t > 0.5 && !barraFija) ponerBarra(true, true)
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
            if (estrellas) { ctx.fillStyle = g.papel ? '#F7B6D2' : '#D9C2F0'; ctx.fill() }
            else if (g.papel) { ctx.fillStyle = '#F1EBDF'; ctx.fill() }
            else { ctx.fillStyle = '#121110'; ctx.fill(); ctx.strokeStyle = 'rgba(241, 235, 223, 0.7)'; ctx.lineWidth = 0.8; ctx.stroke() }
          }
        }
        // Pájaros: aparecen donde se juntó el polvo, aletean y se van
        const aparecen = suave((t - 1.0) / 0.15)
        if (aparecen > 0) {
          for (const [k, a] of aves.entries()) {
            const vuelo = Math.max(0, t - 1.1)
            const desvanece = 1 - suave((t - (a.fin - 0.45)) / 0.45)
            if (desvanece <= 0) continue
            const [x, y] = centroAve(a, t)
            const cuadro = Math.floor((t * 9 + a.fase) % 3)
            ctx.globalAlpha = aparecen * desvanece
            if (estrellas) dibujarEstrella(ctx, x, y, a.envergadura * (1 - 0.3 * clamp(vuelo / 1.1)), k, t)
            else dibujarAve(ctx, x, y, a.envergadura * (1 - 0.45 * clamp(vuelo / 1.1)), vuelo > 0 ? cuadro : 1)
          }
        }
        ctx.globalAlpha = 1
      }
      if (ctxT) {
        ctxT.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctxT.clearRect(0, 0, ancho, window.innerHeight)
        if (torpe && t >= TORPE.sale) dibujarTorpe(ctxT, t)
        ctxT.globalAlpha = 1
      }
      if (t < (torpe ? TORPE.fin : DUR)) { rafAnim = requestAnimationFrame(cuadroAnimacion); return }
      // Terminó
      ctx?.clearRect(0, 0, cv.width, cv.height)
      ctxT?.setTransform(1, 0, 0, 1, 0, 0)
      ctxT?.clearRect(0, 0, cvT!.width, cvT!.height)
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
      ponerBarra(true)
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
      ponerBarra(false, true)
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
      // Sin parallax: la cabecera sube con la página (si se quedaba atrás, asomaba entre las tarjetas)
      else cab.style.transform = ''
      if (estado === 'armada' || estado === 'rearmando') ponerBarra(false)
      else if (estado === 'ausente') ponerBarra(true)
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
      // Al cambiar de pantalla, el «Día N» chico no queda prendido (si no, tapa la barra de Hoy)
      for (const p of ['opacity', 'transform', 'transition']) mi.style.removeProperty(p)
    }
  }, [cabecera, conHorario])
  return (
    <>
      <canvas ref={lienzo} className="motas-tinta" aria-hidden="true" />
      <canvas ref={lienzoTorpe} className="motas-torpe" aria-hidden="true" />
      <div ref={mini} className="dia-mini" aria-hidden="true">{texto}</div>
      {conHorario && (
        <div ref={barra} className="barra-horario-fija">
          <PapelMojado />
          <div className="barra-horario-int">
            <span className="barra-dia" aria-hidden="true">{texto}</span>
            <div id="barra-horario-slot" className="barra-horario-slot" />
          </div>
          <svg className="barra-pincel" viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,2.5 C40,1.5 70,4 120,3 C170,2 210,4.6 260,3.4 C310,2.2 350,4.2 400,2.8 L400,5.2 C350,6.6 300,5 250,6 C200,7 150,4.8 100,5.8 C60,6.4 30,5 0,5.6 Z" />
            {/* Tinta corrida (papel mojado): un borde irregular con chorreaduras cortas */}
            <path className="barra-corrida" d="M0,5.6 C30,5 60,6.4 100,5.8 C150,4.8 200,7 250,6 C300,5 350,6.6 400,5.2 L400,6.6 C380,7.4 372,7 366,7.6 C364,10 362,10.6 361,8 C340,8.2 320,7.2 290,7.8 C276,8 270,7.6 262,8.4 C261,11.4 258,11.6 257,8.6 C230,8.8 200,8.2 170,7.6 C150,7.4 132,8.6 120,8 C118,10.2 116,10.4 115,8 C80,7.6 60,8.2 40,7.4 C34,7.4 30,7.8 26,8.2 C25,11 22,11.2 22,8 C14,7.6 6,7.2 0,7 Z" />
          </svg>
        </div>
      )}
    </>
  )
}
