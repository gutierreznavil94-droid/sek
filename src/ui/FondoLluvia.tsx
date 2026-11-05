/**
 * Fondos con lluvia dibujada (canvas, sin video, poco gasto), detrás de todo. Opacidad baja: se ve, pero el texto
 * se lee igual. Con «reducir movimiento» quedan quietos. Apagables por pantalla en Ajustes → Fondo con lluvia.
 * - Hoy: banco de nubes a tinta arriba (tapa el hueco que deja el encabezado y se aclara hacia abajo), lluvia fina
 *   en diagonal con dos capas y cada 20–40 s un relámpago muy tenue.
 * - Calendario: llovizna más suave y vertical, con dos o tres nubes que pasan muy despacio; sin relámpagos.
 * - Juego: lluvia vista desde adentro: gotas gruesas que resbalan por un vidrio (bajan, se frenan, siguen) y un charco
 *   abajo donde caen gotas y abren anillos. Mientras corre el temporizador, todo más lento y tenue (concentración).
 * - Sueño: una habitación a tinta: futón abajo, ventana a la derecha con lluvia y gotas en el vidrio, lámpara de papel.
 */
import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

export type VarianteLluvia = 'hoy' | 'calendario' | 'juego' | 'sueno'

type Gota = { x: number; y: number; largo: number; vel: number; capa: 0 | 1 }
type Nube = { x: number; y: number; r: number; vel: number; a: number }
/** Gota en el vidrio: queda quieta un rato, baja, se frena, sigue. Deja un rastro que se borra. */
type GotaVidrio = { x: number; y: number; r: number; vel: number; quieta: number; moviendo: number; rastro: number }
type Anillo = { x: number; y: number; t: number; max: number }

const COLOR = '236, 234, 229'
/** El temporizador de Juego corriendo (lo marca la página): la lluvia va más lenta y tenue. */
export const CLASE_JUEGO_CORRIENDO = 'juego-corriendo'

export function FondoLluvia({ variante }: { variante: VarianteLluvia }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const quieto = movimientoReducido()
    let w = 0
    let h = 0
    let dpr = 1
    const gotas: Gota[] = []
    const nubes: Nube[] = []
    const vidrio: GotaVidrio[] = []
    const anillos: Anillo[] = []
    let proximoAnillo = 0
    const diagonal = variante === 'hoy' ? 0.22 : 0.04
    /** Ventana de Sueño (y zona de lluvia de afuera). */
    let ventana = { x: 0, y: 0, w: 0, h: 0 }

    const nueva = (inicial: boolean): Gota => {
      const capa: 0 | 1 = Math.random() < 0.55 ? 0 : 1
      const vel = variante === 'hoy' ? (capa ? 150 : 85) : variante === 'calendario' ? (capa ? 70 : 42) : capa ? 60 : 36
      const zona = variante === 'sueno' ? ventana : { x: 0, y: 0, w, h }
      return {
        x: zona.x + Math.random() * (zona.w + zona.h * diagonal) - zona.h * diagonal,
        y: inicial ? zona.y + Math.random() * zona.h : zona.y - 20,
        largo: variante === 'hoy' ? (capa ? 30 : 16) : variante === 'calendario' ? (capa ? 16 : 10) : capa ? 12 : 8,
        vel: vel * (0.85 + Math.random() * 0.3),
        capa,
      }
    }
    const nuevaVidrio = (inicial: boolean): GotaVidrio => {
      const zona = variante === 'sueno' ? ventana : { x: 0, y: 0, w, h }
      return { x: zona.x + 6 + Math.random() * (zona.w - 12), y: inicial ? zona.y + Math.random() * zona.h * 0.9 : zona.y - 6, r: 2 + Math.random() * (variante === 'sueno' ? 1.6 : 2.6), vel: 0, quieta: Math.random() * 3, moviendo: 0, rastro: 0 }
    }

    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ventana = { x: Math.round(w * 0.6), y: Math.round(h * 0.3), w: Math.round(w * 0.34), h: Math.round(h * 0.27) }
      gotas.length = 0
      const n = variante === 'hoy' ? Math.round((w * h) / 6500) : variante === 'calendario' ? Math.round((w * h) / 11000) : variante === 'juego' ? Math.round((w * h) / 26000) : Math.round((ventana.w * ventana.h) / 700)
      for (let i = 0; i < n; i++) gotas.push(nueva(true))
      vidrio.length = 0
      if (variante === 'juego') for (let i = 0; i < Math.max(9, Math.round(w / 34)); i++) vidrio.push(nuevaVidrio(true))
      if (variante === 'sueno') for (let i = 0; i < 7; i++) vidrio.push(nuevaVidrio(true))
      nubes.length = 0
      if (variante === 'calendario') for (let i = 0; i < 3; i++) nubes.push({ x: (w * (i + 0.5)) / 3 + (Math.random() - 0.5) * 80, y: 40 + i * 28 + Math.random() * 30, r: 70 + Math.random() * 50, vel: 3 + Math.random() * 3, a: 0.07 + Math.random() * 0.04 })
      if (variante === 'hoy') {
        // Banco denso arriba (detrás de la barra fija) y unas pocas sueltas más abajo que se aclaran.
        const nArriba = Math.max(7, Math.round(w / 55))
        for (let i = 0; i < nArriba; i++) nubes.push({ x: (w * (i + 0.5)) / nArriba + (Math.random() - 0.5) * 40, y: 10 + Math.random() * 90, r: 55 + Math.random() * 45, vel: 2 + Math.random() * 3, a: 0.2 + Math.random() * 0.08 })
        for (let i = 0; i < 4; i++) nubes.push({ x: Math.random() * w, y: 150 + Math.random() * h * 0.3, r: 60 + Math.random() * 50, vel: 1.5 + Math.random() * 2, a: 0.1 + Math.random() * 0.05 })
      }
    }

    let relampago = 0
    let proximoRelampago = performance.now() + 8000 + Math.random() * 12000

    /** Nube a tinta: masa gris con un núcleo más claro arriba (volumen), se aclara hacia abajo en Hoy. */
    const pintarNube = (nb: Nube) => {
      const aclara = variante === 'hoy' ? Math.max(0, 1 - nb.y / (h * 0.55)) : 1
      const a = nb.a * aclara
      if (a <= 0.004) return
      const base = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r * 1.5)
      base.addColorStop(0, `rgba(150, 148, 142, ${a})`)
      base.addColorStop(0.6, `rgba(120, 118, 112, ${a * 0.6})`)
      base.addColorStop(1, 'rgba(120, 118, 112, 0)')
      ctx.fillStyle = base
      ctx.beginPath(); ctx.ellipse(nb.x, nb.y, nb.r * 1.6, nb.r * 0.62, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(nb.x - nb.r * 0.55, nb.y + 8, nb.r * 0.95, nb.r * 0.48, 0, 0, Math.PI * 2); ctx.fill()
      if (variante === 'hoy') {
        const luz = ctx.createRadialGradient(nb.x + nb.r * 0.15, nb.y - nb.r * 0.25, 0, nb.x + nb.r * 0.15, nb.y - nb.r * 0.25, nb.r * 0.8)
        luz.addColorStop(0, `rgba(${COLOR}, ${a * 0.5})`)
        luz.addColorStop(1, `rgba(${COLOR}, 0)`)
        ctx.fillStyle = luz
        ctx.beginPath(); ctx.ellipse(nb.x + nb.r * 0.15, nb.y - nb.r * 0.2, nb.r * 0.9, nb.r * 0.42, 0, 0, Math.PI * 2); ctx.fill()
      }
    }

    const pintarLluvia = (dt: number, alfa: number, lento: number) => {
      ctx.lineCap = 'round'
      for (const g of gotas) {
        if (!quieto) {
          g.y += g.vel * dt * lento
          g.x += g.vel * dt * diagonal * lento
          const fondo = variante === 'sueno' ? ventana.y + ventana.h + 20 : h + 20
          if (g.y > fondo) Object.assign(g, nueva(false))
        }
        const base = g.capa ? (variante === 'hoy' ? 0.55 : variante === 'calendario' ? 0.34 : 0.22) : variante === 'hoy' ? 0.28 : variante === 'calendario' ? 0.17 : 0.12
        ctx.strokeStyle = `rgba(${COLOR}, ${base * alfa})`
        ctx.lineWidth = g.capa ? 1.7 : 1.1
        ctx.beginPath()
        ctx.moveTo(g.x, g.y)
        ctx.lineTo(g.x - g.largo * diagonal, g.y - g.largo)
        ctx.stroke()
      }
    }

    /** Gotas gruesas en el vidrio: quietas, bajan a tirones, dejan un rastro que se seca. */
    const pintarVidrio = (dt: number, alfa: number, lento: number) => {
      const zona = variante === 'sueno' ? ventana : { x: 0, y: 0, w, h }
      for (const g of vidrio) {
        if (!quieto) {
          if (g.quieta > 0) {
            g.quieta -= dt * lento
            if (g.quieta <= 0) { g.moviendo = 0.4 + Math.random() * 1.4; g.vel = 14 + Math.random() * 30 }
          } else {
            g.y += g.vel * dt * lento
            g.rastro = Math.min(60, g.rastro + g.vel * dt * lento)
            g.moviendo -= dt * lento
            if (g.moviendo <= 0) g.quieta = 0.6 + Math.random() * 2.4
          }
          g.rastro = Math.max(0, g.rastro - dt * 6 * lento)
          if (g.y > zona.y + zona.h + 8) Object.assign(g, nuevaVidrio(false))
        }
        if (g.rastro > 1) {
          ctx.strokeStyle = `rgba(${COLOR}, ${0.08 * alfa})`
          ctx.lineWidth = g.r * 0.9
          ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(g.x, g.y - g.r); ctx.lineTo(g.x + Math.sin(g.y * 0.05) * 1.2, g.y - g.r - g.rastro); ctx.stroke()
        }
        ctx.fillStyle = `rgba(${COLOR}, ${0.16 * alfa})`
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 1.25, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${COLOR}, ${0.4 * alfa})`
        ctx.beginPath(); ctx.arc(g.x - g.r * 0.35, g.y - g.r * 0.4, g.r * 0.32, 0, Math.PI * 2); ctx.fill()
      }
    }

    /** Charco de Juego: línea de tinta abajo; cada tanto cae una gota y abre un anillo. */
    const pintarCharco = (dt: number, t: number, alfa: number, lento: number) => {
      const y = h - 96
      const x0 = w * 0.08
      const x1 = w * 0.92
      ctx.strokeStyle = `rgba(${COLOR}, ${0.12 * alfa})`
      ctx.lineWidth = 1.3
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(w * 0.35, y + 6, w * 0.65, y - 4, x1, y + 2); ctx.stroke()
      if (!quieto && t >= proximoAnillo) {
        anillos.push({ x: x0 + 20 + Math.random() * (x1 - x0 - 40), y: y + 2, t: 0, max: 26 + Math.random() * 22 })
        proximoAnillo = t + (lento < 1 ? 2200 + Math.random() * 2500 : 900 + Math.random() * 1400)
      }
      for (let i = anillos.length - 1; i >= 0; i--) {
        const a = anillos[i]
        a.t += dt * lento
        const k = a.t / 1.8
        if (k >= 1) { anillos.splice(i, 1); continue }
        const r = Math.max(0, a.max * (1 - (1 - k) ** 2))
        ctx.strokeStyle = `rgba(${COLOR}, ${0.3 * (1 - k) * alfa})`
        ctx.lineWidth = 1.1
        ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * 0.24, 0, 0, Math.PI * 2); ctx.stroke()
        if (k < 0.3) {
          ctx.fillStyle = `rgba(${COLOR}, ${0.35 * (1 - k / 0.3) * alfa})`
          ctx.beginPath(); ctx.arc(a.x, a.y - 6 * (1 - k / 0.3), 1.4, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    /** Habitación de Sueño: futón, ventana con lluvia, lámpara de papel con luz cálida. */
    const pintarHabitacion = (dt: number, t: number) => {
      const tinta = (a: number) => `rgba(${COLOR}, ${a})`
      const piso = Math.round(h * 0.8)
      // Luz de la lámpara (muy suave, respira)
      const lx = w * 0.12
      const ly = h * 0.66
      const respira = quieto ? 1 : 0.9 + 0.1 * Math.sin(t / 1400)
      const luz = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * 0.45)
      luz.addColorStop(0, `rgba(245, 190, 110, ${0.16 * respira})`)
      luz.addColorStop(1, 'rgba(245, 190, 110, 0)')
      ctx.fillStyle = luz
      ctx.fillRect(0, 0, w, h)
      // Piso
      ctx.strokeStyle = tinta(0.12); ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(0, piso); ctx.lineTo(w, piso); ctx.stroke()
      // Ventana: cielo de noche, lluvia adentro del marco, gotas en el vidrio, marco tipo shōji
      const v = ventana
      ctx.fillStyle = 'rgba(120, 130, 150, 0.09)'
      ctx.fillRect(v.x, v.y, v.w, v.h)
      ctx.save()
      ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip()
      pintarLluvia(dt, 1, 1)
      pintarVidrio(dt, 1, 1)
      ctx.restore()
      ctx.strokeStyle = tinta(0.32); ctx.lineWidth = 2.4
      ctx.strokeRect(v.x, v.y, v.w, v.h)
      ctx.lineWidth = 1.2; ctx.strokeStyle = tinta(0.15)
      ctx.beginPath()
      ctx.moveTo(v.x + v.w / 2, v.y); ctx.lineTo(v.x + v.w / 2, v.y + v.h)
      ctx.moveTo(v.x, v.y + v.h / 2); ctx.lineTo(v.x + v.w, v.y + v.h / 2)
      ctx.stroke()
      // Alféizar
      ctx.strokeStyle = tinta(0.18); ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(v.x - 6, v.y + v.h + 3); ctx.lineTo(v.x + v.w + 6, v.y + v.h + 3); ctx.stroke()
      // Futón: colchón bajo, almohada, manta con un pliegue
      const fx = w * 0.06
      const fw = w * 0.56
      const fy = piso - 26
      ctx.fillStyle = tinta(0.07); ctx.strokeStyle = tinta(0.3); ctx.lineWidth = 1.5
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(fx, fy, fw, 24, 8); else ctx.rect(fx, fy, fw, 24)
      ctx.fill(); ctx.stroke()
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(fx + 8, fy - 12, fw * 0.22, 14, 7); else ctx.rect(fx + 8, fy - 12, fw * 0.22, 14)
      ctx.fillStyle = tinta(0.07); ctx.fill(); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(fx + fw * 0.3, fy - 4)
      ctx.bezierCurveTo(fx + fw * 0.5, fy - 12, fx + fw * 0.8, fy - 8, fx + fw - 4, fy + 2)
      ctx.lineTo(fx + fw - 4, fy + 20)
      ctx.lineTo(fx + fw * 0.3, fy + 20)
      ctx.closePath()
      ctx.fillStyle = tinta(0.06); ctx.fill(); ctx.strokeStyle = tinta(0.17); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(fx + fw * 0.45, fy - 6); ctx.bezierCurveTo(fx + fw * 0.5, fy + 4, fx + fw * 0.55, fy + 10, fx + fw * 0.6, fy + 18); ctx.strokeStyle = tinta(0.1); ctx.stroke()
      // Lámpara de papel (andon): pie, cuerpo de papel con luz, tapa
      const aw = 30
      const ah = 46
      ctx.fillStyle = `rgba(245, 200, 130, ${0.16 * respira})`
      ctx.fillRect(lx - aw / 2, ly - ah / 2, aw, ah)
      ctx.strokeStyle = tinta(0.34); ctx.lineWidth = 1.5
      ctx.strokeRect(lx - aw / 2, ly - ah / 2, aw, ah)
      ctx.beginPath()
      ctx.moveTo(lx - aw / 2, ly - ah / 6); ctx.lineTo(lx + aw / 2, ly - ah / 6)
      ctx.moveTo(lx - aw / 2, ly + ah / 6); ctx.lineTo(lx + aw / 2, ly + ah / 6)
      ctx.moveTo(lx - aw / 2 - 3, ly - ah / 2); ctx.lineTo(lx + aw / 2 + 3, ly - ah / 2)
      ctx.moveTo(lx - aw / 2 + 3, ly + ah / 2); ctx.lineTo(lx - aw / 2 + 3, piso)
      ctx.moveTo(lx + aw / 2 - 3, ly + ah / 2); ctx.lineTo(lx + aw / 2 - 3, piso)
      ctx.stroke()
    }

    const dibujar = (dt: number, t: number) => {
      ctx.clearRect(0, 0, w, h)
      if (variante === 'sueno') { pintarHabitacion(dt, t); return }
      if (variante === 'juego') {
        const calma = document.documentElement.classList.contains(CLASE_JUEGO_CORRIENDO)
        const lento = calma ? 0.45 : 1
        const alfa = calma ? 0.6 : 1
        pintarLluvia(dt, alfa, lento)
        pintarVidrio(dt, alfa, lento)
        pintarCharco(dt, t, alfa, lento)
        return
      }
      if (variante === 'hoy' && !quieto) {
        if (t >= proximoRelampago) { relampago = 1; proximoRelampago = t + 20000 + Math.random() * 20000 }
        if (relampago > 0) {
          ctx.fillStyle = `rgba(${COLOR}, ${0.09 * relampago})`
          ctx.fillRect(0, 0, w, h)
          relampago = Math.max(0, relampago - dt * 3.2)
        }
      }
      for (const nb of nubes) {
        if (!quieto) { nb.x += nb.vel * dt; if (nb.x - nb.r * 1.6 > w) nb.x = -nb.r * 1.6 }
        pintarNube(nb)
      }
      pintarLluvia(dt, 1, 1)
    }

    medir()
    let id = 0
    let antes = performance.now()
    const paso = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - antes) / 1000))
      antes = t
      if (document.visibilityState === 'visible') dibujar(dt, t)
      id = requestAnimationFrame(paso)
    }
    if (quieto) dibujar(0, performance.now())
    else id = requestAnimationFrame(paso)
    const alMedir = () => { medir(); dibujar(0, performance.now()) }
    window.addEventListener('resize', alMedir)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', alMedir) }
  }, [variante])
  return <canvas ref={ref} className={`fondo-lluvia ${variante}`} aria-hidden />
}
