/**
 * Fondo con lluvia dibujada (sin video, poco gasto): detrás de todo en Hoy y Calendario.
 * - Hoy: lluvia fina a tinta en diagonal suave, dos capas a distinta velocidad, y cada 20–40 s un relámpago muy tenue.
 * - Calendario: llovizna más suave y vertical, con dos o tres nubes a tinta que pasan muy despacio por arriba; sin relámpagos.
 * Opacidad baja: se ve, pero el texto se lee igual. Con «reducir movimiento» queda quieta. Apagable en Ajustes.
 */
import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

export type VarianteLluvia = 'hoy' | 'calendario'

type Gota = { x: number; y: number; largo: number; vel: number; capa: 0 | 1 }
type Nube = { x: number; y: number; r: number; vel: number; a: number }

const COLOR = '236, 234, 229'

/** Dibuja la lluvia en un canvas a pantalla completa. `clave` reinicia las gotas (cambio de pantalla). */
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
    const diagonal = variante === 'hoy' ? 0.22 : 0.04
    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      gotas.length = 0
      const n = variante === 'hoy' ? Math.round((w * h) / 6500) : Math.round((w * h) / 11000)
      for (let i = 0; i < n; i++) gotas.push(nueva(true))
      nubes.length = 0
      if (variante === 'calendario') for (let i = 0; i < 3; i++) nubes.push({ x: (w * (i + 0.5)) / 3 + (Math.random() - 0.5) * 80, y: 40 + i * 28 + Math.random() * 30, r: 70 + Math.random() * 50, vel: 3 + Math.random() * 3, a: 0.07 + Math.random() * 0.04 })
    }
    const nueva = (inicial: boolean): Gota => {
      const capa: 0 | 1 = Math.random() < 0.55 ? 0 : 1
      const vel = variante === 'hoy' ? (capa ? 150 : 85) : capa ? 70 : 42
      return { x: Math.random() * (w + h * diagonal) - h * diagonal, y: inicial ? Math.random() * h : -20, largo: variante === 'hoy' ? (capa ? 30 : 16) : capa ? 16 : 10, vel: vel * (0.85 + Math.random() * 0.3), capa }
    }
    let relampago = 0
    let proximoRelampago = performance.now() + 8000 + Math.random() * 12000
    const dibujar = (dt: number, t: number) => {
      ctx.clearRect(0, 0, w, h)
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
        const g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r)
        g.addColorStop(0, `rgba(${COLOR}, ${nb.a})`)
        g.addColorStop(1, `rgba(${COLOR}, 0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(nb.x, nb.y, nb.r * 1.6, nb.r * 0.6, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(nb.x - nb.r * 0.5, nb.y + 6, nb.r * 0.9, nb.r * 0.45, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.lineCap = 'round'
      for (const g of gotas) {
        if (!quieto) {
          g.y += g.vel * dt
          g.x += g.vel * dt * diagonal
          if (g.y > h + 20) Object.assign(g, nueva(false))
        }
        ctx.strokeStyle = `rgba(${COLOR}, ${g.capa ? (variante === 'hoy' ? 0.55 : 0.34) : variante === 'hoy' ? 0.28 : 0.17})`
        ctx.lineWidth = g.capa ? 1.7 : 1.1
        ctx.beginPath()
        ctx.moveTo(g.x, g.y)
        ctx.lineTo(g.x - g.largo * diagonal, g.y - g.largo)
        ctx.stroke()
      }
    }
    medir()
    let id = 0
    let antes = performance.now()
    const paso = (t: number) => {
      const dt = Math.min(0.05, (t - antes) / 1000)
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
