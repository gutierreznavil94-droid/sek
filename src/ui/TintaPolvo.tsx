/**
 * Polvo de tinta del modo entreno (pedido de Navil, ronda 5).
 *
 * - Entrada (~0,9 s): al llegar a un bloque nuevo, su título se arma con polvo
 *   que llega desde arriba y desde abajo; el título real aparece al final.
 * - Salida: al terminar el bloque, el título se deshace en polvo que se va.
 * - Ambiente: 10 motas que flotan lento por los bordes (más tenues en el descanso).
 *
 * Es un canvas fijo sin eventos de puntero: nunca frena un toque. Con «reducir
 * movimiento» no dibuja nada y el título solo aparece con un fundido (CSS).
 */
import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

type Punto = { x: number; y: number }
type Grano = { x0: number; y0: number; x1: number; y1: number; inicio: number; dur: number; r: number; tipo: 'llega' | 'se-va' }
type Mota = { x: number; y: number; vy: number; fase: number; r: number; lado: number }

const DUR_ENTRADA = 900
const DUR_SALIDA = 650
const PASO = 3 // px entre muestras del texto

/** Puntos del texto del título, en coordenadas de la pantalla (palabra por palabra, respeta los saltos de línea). */
export function puntosDelTitulo(el: HTMLElement, paso = PASO): Punto[] {
  const caja = el.getBoundingClientRect()
  if (!caja.width || !caja.height) return []
  const dpr = 1
  const c = document.createElement('canvas')
  c.width = Math.ceil(caja.width * dpr)
  c.height = Math.ceil(caja.height * dpr)
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return []
  const cs = getComputedStyle(el)
  g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  g.fillStyle = '#000'
  g.textBaseline = 'alphabetic'
  // Cada palabra en su lugar real (con Range), así un título de dos líneas sale bien.
  const nodo = el.firstChild
  const texto = el.textContent ?? ''
  if (nodo && nodo.nodeType === Node.TEXT_NODE && typeof document.createRange === 'function') {
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(texto))) {
      const rango = document.createRange()
      rango.setStart(nodo, m.index)
      rango.setEnd(nodo, m.index + m[0].length)
      const r = rango.getBoundingClientRect()
      g.fillText(m[0], r.left - caja.left, r.top - caja.top + r.height * 0.78)
    }
  } else {
    g.fillText(texto, 0, caja.height * 0.78)
  }
  const datos = g.getImageData(0, 0, c.width, c.height).data
  const puntos: Punto[] = []
  for (let y = 0; y < c.height; y += paso) {
    for (let x = 0; x < c.width; x += paso) {
      if (datos[(y * c.width + x) * 4 + 3] > 120) puntos.push({ x: caja.left + x, y: caja.top + y })
    }
  }
  // Tope para que sea liviano.
  if (puntos.length > 900) return puntos.filter((_, i) => i % Math.ceil(puntos.length / 900) === 0)
  return puntos
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIn = (t: number) => t * t

export function TintaPolvo({ bloque, visible, tenue }: { bloque: string | null; visible: boolean; tenue: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const granos = useRef<Grano[]>([])
  const motas = useRef<Mota[]>([])
  const puntosActuales = useRef<Punto[]>([])
  const armado = useRef<string | null>(null)
  const tenueRef = useRef(tenue)
  tenueRef.current = tenue
  const reducido = movimientoReducido()

  // Bucle de dibujo: solo con la pantalla visible.
  useEffect(() => {
    if (reducido) return
    const c = lienzo.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    let id = 0
    let antes = performance.now()
    const tam = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(window.innerWidth * dpr)
      c.height = Math.round(window.innerHeight * dpr)
      c.style.width = `${window.innerWidth}px`
      c.style.height = `${window.innerHeight}px`
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    tam()
    if (!motas.current.length) {
      motas.current = Array.from({ length: 10 }, (_, i) => ({
        lado: i % 2,
        x: 0,
        y: Math.random() * window.innerHeight,
        vy: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10),
        fase: Math.random() * Math.PI * 2,
        r: 1.4 + Math.random() * 2.2,
      }))
    }
    const tinta = getComputedStyle(document.documentElement).getPropertyValue('--papel').trim() || '#ECEAE5'
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000)
      antes = ahora
      const w = window.innerWidth
      const h = window.innerHeight
      g.clearRect(0, 0, w, h)
      // Motas del ambiente, por los bordes.
      g.fillStyle = '#8E8A84'
      for (const m of motas.current) {
        m.y += m.vy * dt
        m.fase += dt * 0.8
        if (m.y < -10) m.y = h + 10
        if (m.y > h + 10) m.y = -10
        const x = (m.lado ? w - 14 : 14) + Math.sin(m.fase) * 8
        g.globalAlpha = tenueRef.current ? 0.12 : 0.32
        g.beginPath()
        g.ellipse(x, m.y, m.r * 0.7, m.r * 1.8, 0, 0, Math.PI * 2)
        g.fill()
      }
      // Polvo del título.
      const vivos: Grano[] = []
      g.fillStyle = tinta
      for (const p of granos.current) {
        const t = (ahora - p.inicio) / p.dur
        if (t < 0) { vivos.push(p); continue }
        if (t >= 1) continue
        vivos.push(p)
        const k = p.tipo === 'llega' ? easeOut(t) : easeIn(t)
        const x = p.x0 + (p.x1 - p.x0) * k
        const y = p.y0 + (p.y1 - p.y0) * k
        // Llega: aparece y se apaga al final (el título real toma el relevo). Se va: se apaga mientras se aleja.
        g.globalAlpha = p.tipo === 'llega' ? Math.min(1, t * 3) * (t > 0.82 ? (1 - t) / 0.18 : 1) : 1 - t
        g.beginPath()
        g.ellipse(x, y, p.r, p.r * (p.tipo === 'llega' ? 1.6 - k * 0.6 : 1 + k), 0, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      granos.current = vivos
      id = requestAnimationFrame(cuadro)
    }
    const arrancar = () => { cancelAnimationFrame(id); antes = performance.now(); id = requestAnimationFrame(cuadro) }
    const alCambiar = () => (document.visibilityState === 'visible' ? arrancar() : cancelAnimationFrame(id))
    arrancar()
    window.addEventListener('resize', tam)
    document.addEventListener('visibilitychange', alCambiar)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', tam)
      document.removeEventListener('visibilitychange', alCambiar)
    }
  }, [reducido])

  // Cambio de bloque: el anterior se deshace en polvo; el nuevo se arma cuando su título está a la vista.
  useEffect(() => {
    if (armado.current === bloque) return
    const ahora = performance.now()
    if (!reducido && armado.current && puntosActuales.current.length) {
      const h = window.innerHeight
      granos.current.push(
        ...puntosActuales.current.map((p, i) => ({
          x0: p.x, y0: p.y,
          x1: p.x + (Math.random() - 0.5) * 80,
          y1: i % 2 ? -30 - Math.random() * 60 : h + 30 + Math.random() * 60,
          inicio: ahora + Math.random() * 120, dur: DUR_SALIDA, r: 1.1 + Math.random() * 0.9, tipo: 'se-va' as const,
        })),
      )
      puntosActuales.current = []
    }
    if (!visible || !bloque) return
    const el = document.querySelector<HTMLElement>('.entreno-bloque .entreno-titulo')
    armado.current = bloque
    if (!el) return
    // El título real entra con un fundido que termina junto con el polvo.
    el.classList.remove('tinta-arma')
    void el.offsetWidth
    el.classList.add('tinta-arma')
    if (reducido) return
    const puntos = puntosDelTitulo(el)
    puntosActuales.current = puntos
    const h = window.innerHeight
    granos.current.push(
      ...puntos.map((p, i) => ({
        x0: p.x + (Math.random() - 0.5) * 60,
        y0: i % 2 ? -20 - Math.random() * 80 : h + 20 + Math.random() * 80,
        x1: p.x, y1: p.y,
        inicio: ahora + Math.random() * 150, dur: DUR_ENTRADA - 150, r: 1.2 + Math.random() * 0.8, tipo: 'llega' as const,
      })),
    )
  }, [bloque, visible, reducido])

  if (reducido) return null
  return <canvas ref={lienzo} className="tinta-polvo" aria-hidden="true" />
}
