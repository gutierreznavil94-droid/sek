/**
 * Personaje del tema quieto y respirando, dibujado desde su hoja de sprites (la misma del compañero).
 * Autocontenido: recibe la URL de la hoja (.webp) y lee su .json (celda, columnas, clips).
 * Con «reducir movimiento» queda en el primer cuadro.
 */
import { useEffect, useRef } from 'react'

type Clip = { desde: number; n: number; fps: number }
type Hoja = { celda: [number, number]; columnas: number; clips: Record<string, Clip> }

export function PersonajeQuieto({ hoja, clip = 'quieto', escala = 2, espejo = false }: { hoja: string; clip?: string; escala?: number; espejo?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let vivo = true
    let id = 0
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const img = new Image()
    img.src = hoja
    void fetch(hoja.replace(/\.webp$/, '.json')).then((r) => r.json() as Promise<Hoja>).then((h) => {
      if (!vivo) return
      const cl = h.clips[clip] ?? h.clips.quieto ?? Object.values(h.clips)[0]
      const [cw, ch] = h.celda
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(cw * escala * dpr); c.height = Math.round(ch * escala * dpr)
      c.style.width = `${cw * escala}px`; c.style.height = `${ch * escala}px`
      ctx.imageSmoothingEnabled = true
      const pintar = (f: number) => {
        const i = cl.desde + f
        ctx.setTransform(espejo ? -dpr : dpr, 0, 0, dpr, espejo ? c.width : 0, 0)
        ctx.clearRect(0, 0, cw * escala, ch * escala)
        ctx.drawImage(img, (i % h.columnas) * cw, Math.floor(i / h.columnas) * ch, cw, ch, 0, 0, cw * escala, ch * escala)
      }
      const t0 = performance.now()
      const paso = (t: number) => { if (!vivo) return; pintar(Math.floor(((t - t0) / 1000) * cl.fps) % cl.n); id = requestAnimationFrame(paso) }
      const arrancar = () => { if (quieto) pintar(0); else id = requestAnimationFrame(paso) }
      if (img.complete) arrancar(); else img.onload = arrancar
    }).catch(() => undefined)
    return () => { vivo = false; cancelAnimationFrame(id) }
  }, [hoja, clip, escala, espejo])
  return <canvas ref={ref} className="tema-personaje" aria-hidden />
}
