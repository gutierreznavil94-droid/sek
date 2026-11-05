/**
 * Shinobi quieto respirando (tema Shinobi): el clip «quieto» de la hoja de sprites, pintado en negro plano con la
 * línea roja del kasa (el ala del sombrero se busca en cada cuadro: la fila más ancha arriba). Fondo transparente.
 * Autocontenido: solo React y canvas. Con «reducir movimiento» queda en el primer cuadro.
 */
import { useEffect, useRef } from 'react'

type Clip = { desde: number; n: number; fps: number }
type HojaJson = { celda: [number, number]; columnas: number; clips: Record<string, Clip> }

const NEGRO = '#121110'
const ROJO = '#c43a2e'
/** Recorte del personaje dentro de la celda real (96×70). */
const RECORTE = { x: 18, y: 0, w: 60, h: 70 }

export function ShinobiRespira({ hoja, quieto = false, className }: { hoja: string; quieto?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    let id = 0
    let vivo = true
    const img = new Image()
    const datos = fetch(hoja.replace(/\.webp$/, '.json')).then((r) => r.json() as Promise<HojaJson>).catch(() => null)
    img.src = hoja
    Promise.all([datos, img.decode().catch(() => undefined)]).then(([j]) => {
      if (!vivo || !img.naturalWidth) return
      const clip = j?.clips.quieto ?? { desde: 103, n: 105, fps: 12 }
      const columnas = j?.columnas ?? 16
      const escalaHoja = j ? img.naturalWidth / (columnas * j.celda[0]) : 2
      const cw = Math.round((j?.celda[0] ?? 48) * escalaHoja)
      const ch = Math.round((j?.celda[1] ?? 35) * escalaHoja)
      const k = cw / 96
      const rec = { x: RECORTE.x * k, y: RECORTE.y * k, w: RECORTE.w * k, h: RECORTE.h * k }
      // Se dibuja a 3× con suavizado para que no se vea pixelado al agrandarlo.
      const X = 3
      c.width = Math.round(rec.w * X)
      c.height = Math.round(rec.h * X)
      // Cada cuadro se prepara una vez (negro + línea roja) y se guarda.
      const cuadros: (HTMLCanvasElement | null)[] = Array(clip.n).fill(null)
      const preparar = (n: number): HTMLCanvasElement => {
        const ya = cuadros[n]
        if (ya) return ya
        const o = document.createElement('canvas')
        o.width = c.width; o.height = c.height
        const oc = o.getContext('2d')!
        const i = clip.desde + n
        oc.imageSmoothingEnabled = true
        oc.imageSmoothingQuality = 'high'
        oc.drawImage(img, (i % columnas) * cw + rec.x, Math.floor(i / columnas) * ch + rec.y, rec.w, rec.h, 0, 0, o.width, o.height)
        // Ala del kasa: la fila más ancha en el primer quinto del cuadro.
        const px = oc.getImageData(0, 0, o.width, o.height).data
        let fila = -1, ancho = 0, x0 = 0, x1 = 0
        for (let y = 0; y < Math.round(o.height * 0.2); y += X) {
          let a = -1, b = -1, cuenta = 0
          for (let x = 0; x < o.width; x++) if (px[(y * o.width + x) * 4 + 3] > 100) { cuenta++; if (a < 0) a = x; b = x }
          if (cuenta > ancho) { ancho = cuenta; fila = y; x0 = a; x1 = b }
        }
        oc.globalCompositeOperation = 'source-in'
        oc.fillStyle = NEGRO
        oc.fillRect(0, 0, o.width, o.height)
        oc.globalCompositeOperation = 'source-over'
        if (fila >= 0 && x1 - x0 > 4) {
          oc.strokeStyle = ROJO
          oc.lineWidth = X * 0.75
          oc.lineCap = 'round'
          const y = fila + X * 0.6
          oc.beginPath(); oc.moveTo(x0 + X * 1.2, y); oc.quadraticCurveTo((x0 + x1) / 2, y + X * 0.5, x1 - X * 0.3, y - X * 0.2); oc.stroke()
        }
        cuadros[n] = o
        return o
      }
      // Dos pasadas: el negro queda plano (sin que se transparente la lluvia de atrás).
      const pintar = (n: number) => { ctx.clearRect(0, 0, c.width, c.height); const o = preparar(n); ctx.drawImage(o, 0, 0); ctx.drawImage(o, 0, 0) }
      if (quieto) { pintar(0); return }
      const inicio = performance.now()
      let ultimo = -1
      const paso = (t: number) => {
        const n = Math.floor(((t - inicio) / 1000) * clip.fps) % clip.n
        if (n !== ultimo && document.visibilityState === 'visible') { pintar(n); ultimo = n }
        id = requestAnimationFrame(paso)
      }
      id = requestAnimationFrame(paso)
    })
    return () => { vivo = false; cancelAnimationFrame(id) }
  }, [hoja, quieto])
  return <canvas ref={ref} className={className} aria-label="Shinobi respirando" role="img" />
}
