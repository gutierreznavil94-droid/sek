/**
 * Polvo de tinta del modo entreno (pedido de Navil, ronda 5).
 *
 * - Entrada (~0,9 s): al llegar a un bloque nuevo, su título se arma con polvo
 *   que llega desde arriba y desde abajo; el título real aparece al final.
 * - Salida: al terminar el bloque, el título se deshace en polvo que se va.
 * - El fondo (aguada blanca que pasa) está en `AguadaFondo`, detrás de todo.
 *
 * Es un canvas fijo sin eventos de puntero: nunca frena un toque. Con «reducir
 * movimiento» no dibuja nada y el título solo aparece con un fundido (CSS).
 */
import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

type Punto = { x: number; y: number }
type Grano = { x0: number; y0: number; x1: number; y1: number; inicio: number; dur: number; r: number; tipo: 'llega' | 'se-va' }

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
  const puntosActuales = useRef<Punto[]>([])
  const armado = useRef<string | null>(null)
  void tenue
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
    const tinta = getComputedStyle(document.documentElement).getPropertyValue('--papel').trim() || '#ECEAE5'
    const cuadro = (ahora: number) => {
      void (ahora - antes)
      antes = ahora
      const w = window.innerWidth
      const h = window.innerHeight
      g.clearRect(0, 0, w, h)
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

// ---------- Aguada blanca del fondo (ronda 6) ----------

type Trazo = { img: HTMLCanvasElement; x: number; y: number; vx: number; vy: number; ang: number; alfa: number; gotas: { dx: number; dy: number; r: number }[] }

/** Un trazo ancho de pincel seco, dibujado una sola vez en un canvas aparte (blanco; la opacidad se da al pintarlo). */
function pintarTrazo(largo: number, ancho: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = largo
  c.height = ancho
  const g = c.getContext('2d')
  if (!g) return c
  g.lineCap = 'round'
  // Cuerpo de la aguada: una banda suave con puntas afinadas (lo que se ve de lejos).
  const grad = g.createLinearGradient(0, 0, largo, 0)
  grad.addColorStop(0, 'rgba(244,236,220,0)')
  grad.addColorStop(0.12, 'rgba(244,236,220,0.5)')
  grad.addColorStop(0.7, 'rgba(244,236,220,0.55)')
  grad.addColorStop(1, 'rgba(244,236,220,0)')
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(0, ancho / 2)
  g.bezierCurveTo(largo * 0.2, ancho * 0.08, largo * 0.8, ancho * 0.12, largo, ancho * 0.45)
  g.bezierCurveTo(largo * 0.8, ancho * 0.9, largo * 0.2, ancho * 0.95, 0, ancho / 2)
  g.fill()
  // Centro más cargado: una segunda banda angosta encima.
  g.beginPath()
  g.moveTo(largo * 0.06, ancho / 2)
  g.bezierCurveTo(largo * 0.25, ancho * 0.3, largo * 0.75, ancho * 0.32, largo * 0.94, ancho * 0.47)
  g.bezierCurveTo(largo * 0.75, ancho * 0.68, largo * 0.25, ancho * 0.72, largo * 0.06, ancho / 2)
  g.fill()
  // Muchas cerdas: líneas finas a lo largo, con cortes (pincel seco) y puntas afinadas.
  const cerdas = Math.round(ancho / 2.2)
  for (let i = 0; i < cerdas; i++) {
    const y0 = (i + Math.random()) * (ancho / cerdas)
    const centro = 1 - Math.abs(y0 / ancho - 0.5) * 2 // más carga en el medio
    const inicio = Math.random() * largo * 0.18 * (1 - centro + 0.3)
    const fin = largo - Math.random() * largo * 0.25 * (1 - centro + 0.3)
    g.strokeStyle = `rgba(244,236,220,${0.5 + centro * 0.5})`
    g.lineWidth = 0.8 + Math.random() * 2.2
    let x = inicio
    g.beginPath()
    g.moveTo(x, y0)
    while (x < fin) {
      const paso = 12 + Math.random() * 30
      x = Math.min(fin, x + paso)
      const y = y0 + Math.sin(x / 90 + i) * 2.5
      // Cortes del pincel seco.
      if (Math.random() < 0.22 * (1.2 - centro)) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  return c
}

/** Textura de papel cálido (grano y fibras), en mosaico detrás de los trazos. Opacidad media ~4 %. */
let texturaPapel: string | null = null
function papel(): string {
  if (texturaPapel) return texturaPapel
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (!g) return ''
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 240; img.data[i + 1] = 228; img.data[i + 2] = 205
    img.data[i + 3] = Math.round(4 + Math.random() * 14) // 1,5 a 7 %
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = 'rgba(240,228,205,0.06)'
  g.lineWidth = 0.7
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI, l = 6 + Math.random() * 22
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
  texturaPapel = c.toDataURL()
  return texturaPapel
}

export function AguadaFondo({ tenue }: { tenue: boolean }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const tenueRef = useRef(tenue)
  tenueRef.current = tenue
  const reducido = movimientoReducido()

  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    c.style.backgroundImage = `url(${papel()})`
    let w = window.innerWidth
    let h = window.innerHeight
    const tam = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    tam()
    const nuevo = (i: number, desdeAfuera: boolean): Trazo => {
      const principal = i === 0 // una pincelada principal, ancha y lenta; las otras más finas
      const largo = Math.round(w * (principal ? 1.4 + Math.random() * 0.4 : 0.8 + Math.random() * 0.6))
      const ancho = Math.round(principal ? 150 + Math.random() * 50 : 30 + Math.random() * 35)
      const segundos = principal ? 13 + Math.random() * 2 : 8 + Math.random() * 6 // cruza la pantalla en 8 a 15 s
      const vx = (w + largo) / segundos
      const sube = i % 2 === 0
      const vy = (sube ? -1 : 1) * vx * (0.12 + Math.random() * 0.12)
      return {
        img: pintarTrazo(largo, ancho),
        x: desdeAfuera ? -largo : -largo + Math.random() * (w + largo),
        y: h * (0.12 + ((i * 0.23 + Math.random() * 0.15) % 0.8)),
        vx, vy,
        ang: Math.atan2(vy, vx),
        alfa: 0.18 + Math.random() * 0.1, // 18 a 28 %
        gotas: Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => ({ dx: Math.random() * largo, dy: (Math.random() < 0.5 ? -1 : 1) * (ancho * 0.6 + Math.random() * 30), r: 1 + Math.random() * 2.5 })),
      }
    }
    const trazos: Trazo[] = Array.from({ length: 4 }, (_, i) => nuevo(i, false))
    const dibujar = () => {
      g.clearRect(0, 0, w, h)
      const factor = tenueRef.current ? 0.6 : 1
      for (const t of trazos) {
        g.save()
        g.translate(t.x, t.y)
        g.rotate(t.ang)
        g.globalAlpha = t.alfa * factor
        g.drawImage(t.img, 0, -t.img.height / 2)
        g.fillStyle = '#f4ecdc'
        g.globalAlpha = Math.min(0.5, t.alfa * 1.8) * factor
        for (const d of t.gotas) { g.beginPath(); g.arc(d.dx, d.dy, d.r, 0, Math.PI * 2); g.fill() }
        g.restore()
      }
      g.globalAlpha = 1
    }
    if (reducido) {
      dibujar()
      return
    }
    let id = 0
    let antes = performance.now()
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - antes) / 1000)
      antes = ahora
      const vel = tenueRef.current ? 0.6 : 1
      trazos.forEach((t, i) => {
        t.x += t.vx * dt * vel
        t.y += t.vy * dt * vel
        if (t.x > w + 40 || t.y < -200 || t.y > h + 200) trazos[i] = nuevo(i, true)
      })
      dibujar()
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

  return <canvas ref={lienzo} className="aguada-fondo" aria-hidden="true" />
}
