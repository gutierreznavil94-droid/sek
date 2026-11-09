import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

/**
 * Lluvia pastel para los temas subidos (en vez de la tormenta de tinta de Shinobi): gotas finas del color
 * del tema, pétalos que caen girando y anillitos donde tocan el piso. Suave, detrás de todo.
 * Con «reducir movimiento» queda un solo cuadro quieto.
 */
type Gota = { x: number; y: number; v: number; l: number; a: number }
type Petalo = { x: number; y: number; v: number; giro: number; vg: number; t: number; deriva: number }
type Anillo = { x: number; y: number; r: number; a: number }

function color(nombre: string, porDefecto: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
  return v || porDefecto
}

export function LluviaPastel({ enCaja = false, calma = false }: { enCaja?: boolean; calma?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const calmaRef = useRef(calma)
  calmaRef.current = calma
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const quieto = movimientoReducido()
    const gotaColor = color('--acento', '#F4A6C8')
    const petaloColor = color('--tp-cab-hasta', '#F0C5D4')
    const anilloColor = color('--tp-texto-3', '#8A6F5C')
    let w = 0, h = 0, dpr = 1
    const gotas: Gota[] = []
    const petalos: Petalo[] = []
    const anillos: Anillo[] = []
    const viento = 0.18
    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const caja = enCaja && c.parentElement ? c.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight }
      w = caja.width; h = caja.height
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round((w * h) / 9000)
      gotas.length = 0
      for (let i = 0; i < n; i++) gotas.push(nuevaGota(true))
      petalos.length = 0
      for (let i = 0; i < Math.max(5, Math.round(w / 55)); i++) petalos.push(nuevoPetalo(true))
    }
    const nuevaGota = (alAzar = false): Gota => ({ x: Math.random() * (w + 60) - 30, y: alAzar ? Math.random() * h : -20, v: 260 + Math.random() * 220, l: 10 + Math.random() * 14, a: 0.32 + Math.random() * 0.3 })
    const nuevoPetalo = (alAzar = false): Petalo => ({ x: Math.random() * w, y: alAzar ? Math.random() * h : -12, v: 22 + Math.random() * 26, giro: Math.random() * 6.28, vg: (Math.random() - 0.5) * 2, t: Math.random() * 6.28, deriva: 10 + Math.random() * 20 })
    const dibujar = (dt: number) => {
      ctx.clearRect(0, 0, w, h)
      const factor = calmaRef.current ? 0.35 : 1
      ctx.lineCap = 'round'
      ctx.strokeStyle = gotaColor
      ctx.lineWidth = 1.5
      gotas.forEach((g, i) => {
        if (i > gotas.length * factor) return
        g.y += g.v * dt; g.x += g.v * viento * dt
        if (g.y > h) {
          if (Math.random() < 0.25) anillos.push({ x: g.x, y: h - 8 - Math.random() * h * 0.25, r: 1, a: 0.35 })
          Object.assign(g, nuevaGota())
        }
        ctx.globalAlpha = g.a
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.l * viento, g.y - g.l); ctx.stroke()
      })
      ctx.strokeStyle = anilloColor
      ctx.lineWidth = 0.8
      for (let i = anillos.length - 1; i >= 0; i--) {
        const r = anillos[i]
        r.r += 16 * dt; r.a -= 0.45 * dt
        if (r.a <= 0) { anillos.splice(i, 1); continue }
        ctx.globalAlpha = r.a
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 1.8, r.r * 0.55, 0, 0, 6.29); ctx.stroke()
      }
      ctx.fillStyle = petaloColor
      for (const p of petalos) {
        p.t += dt; p.y += p.v * dt; p.giro += p.vg * dt
        const x = p.x + Math.sin(p.t * 0.9) * p.deriva
        if (p.y > h + 12) Object.assign(p, nuevoPetalo())
        ctx.globalAlpha = 0.75
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.giro); ctx.scale(1, Math.abs(Math.cos(p.t * 1.3)) * 0.6 + 0.4)
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, 6.29); ctx.fill(); ctx.restore()
      }
      ctx.globalAlpha = 1
    }
    medir()
    let id = 0
    let antes = performance.now()
    const paso = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - antes) / 1000)); antes = t
      if (document.visibilityState === 'visible') dibujar(dt)
      id = requestAnimationFrame(paso)
    }
    if (quieto) dibujar(0)
    else id = requestAnimationFrame(paso)
    const alMedir = () => { medir(); dibujar(0) }
    window.addEventListener('resize', alMedir)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', alMedir) }
  }, [enCaja])
  return <canvas ref={ref} className={`fondo-propio${enCaja ? ' en-caja' : ''}`} aria-hidden />
}
