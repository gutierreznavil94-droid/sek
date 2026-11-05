/**
 * Papel mojado (visual del tema): manchas de agua quietas y unas gotas que resbalan despacio dejando una marca
 * un poco más oscura que se seca. Se pone detrás del contenido de una franja de papel (position: relative).
 * Autocontenido: solo React y canvas. Con «reducir movimiento» quedan las manchas y las gotas quietas.
 */
import { useEffect, useRef } from 'react'

type Gota = { x: number; y: number; r: number; vel: number; quieta: number; marca: { x: number; y: number; a: number }[] }
type Mancha = { x: number; y: number; rx: number; ry: number; a: number; giro: number }

export function PapelMojado({ tinta = '20, 20, 20' }: { tinta?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0
    let gotas: Gota[] = []
    let manchas: Mancha[] = []
    const nuevaGota = (inicial: boolean): Gota => ({ x: 8 + Math.random() * Math.max(10, w - 16), y: inicial ? Math.random() * h * 0.6 : -3, r: 2 + Math.random() * 1.6, vel: 0, quieta: Math.random() * 4, marca: [] })
    const medir = () => {
      const r = c.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = r.width; h = r.height
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      gotas = Array.from({ length: Math.max(3, Math.round(w / 70)) }, () => nuevaGota(true))
      manchas = Array.from({ length: Math.max(4, Math.round(w / 55)) }, () => ({ x: Math.random() * w, y: Math.random() * h, rx: 6 + Math.random() * 16, ry: 3 + Math.random() * 6, a: 0.05 + Math.random() * 0.05, giro: (Math.random() - 0.5) * 0.6 }))
    }
    const dibujar = (dt: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const m of manchas) {
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.rx)
        g.addColorStop(0, `rgba(${tinta}, ${m.a})`)
        g.addColorStop(0.75, `rgba(${tinta}, ${m.a * 0.6})`)
        g.addColorStop(1, `rgba(${tinta}, 0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.rx, m.ry, m.giro, 0, Math.PI * 2); ctx.fill()
      }
      for (const g of gotas) {
        if (!quieto) {
          if (g.quieta > 0) { g.quieta -= dt; if (g.quieta <= 0) g.vel = 4 + Math.random() * 7 }
          else {
            g.y += g.vel * dt
            const ultima = g.marca[g.marca.length - 1]
            if (!ultima || g.y - ultima.y >= 2) g.marca.push({ x: g.x, y: g.y, a: 0.07 })
            if (Math.random() < dt * 0.8) g.quieta = 0.5 + Math.random() * 2
          }
          for (const m of g.marca) m.a -= dt * 0.012
          g.marca = g.marca.filter((m) => m.a > 0)
          if (g.y > h + 4 && g.marca.length === 0) Object.assign(g, nuevaGota(false))
        }
        for (const m of g.marca) { ctx.fillStyle = `rgba(${tinta}, ${m.a})`; ctx.fillRect(m.x - g.r * 0.45, m.y - 1, g.r * 0.9, 2) }
        if (g.y <= h + 4) {
          ctx.fillStyle = `rgba(${tinta}, 0.24)`
          ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 1.25, 0, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
          ctx.beginPath(); ctx.arc(g.x - g.r * 0.35, g.y - g.r * 0.4, g.r * 0.35, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
    medir()
    let id = 0
    let antes = performance.now()
    const paso = (t: number) => {
      const dt = Math.max(0, Math.min(0.05, (t - antes) / 1000))
      antes = t
      if (document.visibilityState === 'visible') dibujar(dt)
      id = requestAnimationFrame(paso)
    }
    if (quieto) dibujar(0)
    else id = requestAnimationFrame(paso)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { medir(); dibujar(0) }) : null
    ro?.observe(c)
    return () => { cancelAnimationFrame(id); ro?.disconnect() }
  }, [tinta])
  return <canvas ref={ref} className="tema-papel-mojado" aria-hidden />
}
