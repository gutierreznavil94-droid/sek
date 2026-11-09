import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'

/**
 * Fondo dibujado de los temas subidos (en vez de la tormenta de tinta de Shinobi), con los colores del tema:
 * cielo pastel, lomas con arbolitos en flor, nubes que pasan (las grises con su lluvia), llovizna fina y cosas
 * volando: pétalos, corazones, mariposas y destellos. Lo quieto se dibuja una vez; lo que se mueve, cada cuadro.
 * Con «reducir movimiento» queda un solo cuadro.
 */
type Rgb = [number, number, number]
type Gota = { x: number; y: number; v: number; l: number; a: number }
type Nube = { x: number; y: number; e: number; v: number; gris: boolean; bolas: [number, number, number][] }
type Volador = { tipo: 'petalo' | 'corazon' | 'mariposa'; x: number; y: number; vx: number; vy: number; t: number; giro: number; e: number; color: string }
type Destello = { x: number; y: number; t: number; v: number; e: number }
type Anillo = { x: number; y: number; r: number; a: number }

function leer(nombre: string, porDefecto: string): Rgb {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : leer('', porDefecto)
}
const mezcla = (a: Rgb, b: Rgb, k: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k)) as Rgb
const css = (c: Rgb, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
const azar = (a: number, b: number) => a + Math.random() * (b - a)

function corazon(ctx: CanvasRenderingContext2D, e: number) {
  ctx.beginPath()
  ctx.moveTo(0, e * 0.35)
  ctx.bezierCurveTo(-e, -e * 0.3, -e * 0.45, -e, 0, -e * 0.45)
  ctx.bezierCurveTo(e * 0.45, -e, e, -e * 0.3, 0, e * 0.35)
  ctx.fill()
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
    const acento = leer('--acento', '#F4A6C8')
    const fondo = leer('--fondo', '#FCF7D9')
    const tarjeta = leer('--tp-cab-desde', '#F6D8D6')
    const tarjeta2 = leer('--tp-cab-hasta', '#F0C5D4')
    const texto = leer('--tp-texto-3', '#8A6F5C')
    const hecho = leer('--ok', '#4F8F6F')
    const lila: Rgb = [200, 182, 230]
    const blanco: Rgb = [255, 255, 255]
    // Cielo un poco más oscuro que el fondo de la app, para que se note el dibujo.
    const cieloArriba = mezcla(tarjeta2, lila, 0.35)
    const cieloAbajo = mezcla(fondo, tarjeta, 0.45)
    const fuerte = mezcla(acento, [120, 40, 80], 0.15)
    let w = 0, h = 0, dpr = 1
    const quietoLienzo = document.createElement('canvas')
    const gotas: Gota[] = []
    const nubes: Nube[] = []
    const voladores: Volador[] = []
    const destellos: Destello[] = []
    const anillos: Anillo[] = []
    const viento = 0.16
    const piso = () => h * 0.8

    const nuevaNube = (x?: number): Nube => {
      const e = azar(0.7, 1.4) * Math.min(w, 520) / 5
      const bolas: [number, number, number][] = []
      const n = 5 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) bolas.push([(i - n / 2) * e * 0.38 + azar(-6, 6), -Math.sin((i / (n - 1)) * Math.PI) * e * 0.35 + azar(-4, 4), e * azar(0.28, 0.42)])
      return { x: x ?? -e * 1.5, y: azar(h * 0.06, h * 0.42), e, v: azar(6, 16), gris: Math.random() < 0.35, bolas }
    }
    const colores = [css(acento, 0.85), css(tarjeta2, 0.95), css(blanco, 0.9), css(mezcla(acento, lila, 0.5), 0.85)]
    const nuevoVolador = (alAzar = false): Volador => {
      const r = Math.random()
      const tipo = r < 0.6 ? 'petalo' : r < 0.82 ? 'corazon' : 'mariposa'
      return {
        tipo, x: alAzar ? azar(0, w) : azar(-40, w * 0.6), y: alAzar ? azar(0, h) : -20,
        vx: azar(8, 26), vy: tipo === 'mariposa' ? azar(-6, 6) : azar(16, 40), t: azar(0, 6.28), giro: azar(0, 6.28),
        e: tipo === 'mariposa' ? azar(7, 11) : tipo === 'corazon' ? azar(5, 9) : azar(4, 7),
        color: tipo === 'mariposa' ? css(mezcla(acento, lila, Math.random()), 0.95) : colores[Math.floor(Math.random() * colores.length)],
      }
    }
    const nuevaGota = (alAzar = false): Gota => ({ x: azar(-30, w + 60), y: alAzar ? azar(0, h) : -20, v: azar(300, 520), l: azar(10, 22), a: azar(0.3, 0.6) })

    const dibujarQuieto = () => {
      quietoLienzo.width = w * dpr; quietoLienzo.height = h * dpr
      const q = quietoLienzo.getContext('2d')!
      q.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = q.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, css(cieloArriba)); g.addColorStop(0.65, css(mezcla(cieloArriba, cieloAbajo, 0.7))); g.addColorStop(1, css(cieloAbajo))
      q.fillStyle = g; q.fillRect(0, 0, w, h)
      // Sol tapado por las nubes: un halo suave.
      const sol = q.createRadialGradient(w * 0.78, h * 0.16, 0, w * 0.78, h * 0.16, Math.min(w, h) * 0.35)
      sol.addColorStop(0, css(blanco, 0.55)); sol.addColorStop(1, css(blanco, 0))
      q.fillStyle = sol; q.fillRect(0, 0, w, h)
      // Arcoíris tenue.
      q.lineWidth = Math.max(5, w / 70)
      const arco = [acento, mezcla(acento, [255, 220, 150], 0.6), mezcla(hecho, blanco, 0.45), mezcla(lila, [150, 170, 240], 0.4)]
      arco.forEach((col, i) => { q.strokeStyle = css(col, 0.22); q.beginPath(); q.arc(w * 0.2, piso(), w * 0.55 - i * q.lineWidth, Math.PI, Math.PI * 1.5); q.stroke() })
      // Lomas: tres capas.
      const lomas: [Rgb, number, number][] = [[mezcla(lila, cieloAbajo, 0.35), 0.66, 0.9], [mezcla(hecho, tarjeta, 0.7), 0.74, 1.3], [mezcla(hecho, cieloAbajo, 0.55), 0.82, 1.7]]
      lomas.forEach(([col, alto, f], k) => {
        q.fillStyle = css(col)
        q.beginPath(); q.moveTo(0, h)
        for (let x = 0; x <= w + 10; x += 10) q.lineTo(x, h * alto + Math.sin(x / w * Math.PI * f + k * 1.7) * h * 0.035 + Math.sin(x / w * Math.PI * f * 2.3 + k) * h * 0.012)
        q.lineTo(w, h); q.closePath(); q.fill()
      })
      // Arbolitos en flor sobre la loma del medio.
      const arboles = Math.max(3, Math.round(w / 110))
      for (let i = 0; i < arboles; i++) {
        const x = (i + 0.5) * (w / arboles) + azar(-20, 20)
        const y = h * 0.74 + Math.sin(x / w * Math.PI * 1.3 + 1.7) * h * 0.035 + 2
        const e = azar(14, 24)
        q.fillStyle = css(mezcla(texto, [90, 60, 50], 0.4), 0.8)
        q.fillRect(x - 1.5, y - e * 1.2, 3, e * 1.2)
        for (const [dx, dy, r] of [[0, -1.6, 0.75], [-0.6, -1.25, 0.6], [0.6, -1.25, 0.6], [0, -1.05, 0.55]] as const) {
          q.fillStyle = css(mezcla(acento, blanco, azar(0.1, 0.45)), 0.95)
          q.beginPath(); q.arc(x + dx * e, y + dy * e, r * e, 0, 6.29); q.fill()
        }
      }
      // Florcitas en el pasto de adelante.
      for (let i = 0; i < w / 14; i++) {
        const x = azar(0, w), y = azar(h * 0.86, h * 0.99)
        q.fillStyle = css(i % 3 ? blanco : acento, 0.75)
        q.beginPath(); q.arc(x, y, azar(1.2, 2.4), 0, 6.29); q.fill()
      }
    }

    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const caja = enCaja && c.parentElement ? c.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight }
      w = caja.width; h = caja.height
      c.width = w * dpr; c.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dibujarQuieto()
      gotas.length = 0
      for (let i = 0; i < Math.round((w * h) / 6500); i++) gotas.push(nuevaGota(true))
      nubes.length = 0
      for (let i = 0; i < Math.max(4, Math.round(w / 120)); i++) nubes.push(nuevaNube(azar(-80, w)))
      voladores.length = 0
      for (let i = 0; i < Math.max(10, Math.round(w / 28)); i++) voladores.push(nuevoVolador(true))
      destellos.length = 0
      for (let i = 0; i < Math.max(8, Math.round(w / 40)); i++) destellos.push({ x: azar(0, w), y: azar(0, h * 0.7), t: azar(0, 6.28), v: azar(1, 2.5), e: azar(2, 4.5) })
    }

    const dibujarNube = (n: Nube) => {
      const col = n.gris ? mezcla(texto, cieloArriba, 0.55) : blanco
      ctx.fillStyle = css(col, n.gris ? 0.55 : 0.85)
      ctx.beginPath()
      for (const [dx, dy, r] of n.bolas) { ctx.moveTo(n.x + dx + r, n.y + dy); ctx.arc(n.x + dx, n.y + dy, r, 0, 6.29) }
      ctx.fill()
      ctx.fillStyle = css(col, n.gris ? 0.4 : 0.6)
      ctx.beginPath(); ctx.ellipse(n.x, n.y + n.e * 0.12, n.e * 1.25, n.e * 0.2, 0, 0, 6.29); ctx.fill()
    }

    const dibujar = (dt: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(quietoLienzo, 0, 0, w, h)
      const factor = calmaRef.current ? 0.35 : 1
      // Destellos que titilan.
      for (const d of destellos) {
        d.t += d.v * dt
        const a = Math.max(0, Math.sin(d.t)) * 0.9
        if (a <= 0.02) continue
        ctx.fillStyle = css(blanco, a)
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(0.785)
        ctx.fillRect(-d.e / 4, -d.e, d.e / 2, d.e * 2); ctx.fillRect(-d.e, -d.e / 4, d.e * 2, d.e / 2)
        ctx.restore()
      }
      // Nubes; las grises dejan caer su propia lluvia.
      for (const n of nubes) {
        n.x += n.v * dt
        if (n.x - n.e * 1.5 > w) Object.assign(n, nuevaNube())
        if (n.gris && Math.random() < 6 * dt * factor) gotas.push({ x: n.x + azar(-n.e, n.e), y: n.y + n.e * 0.15, v: azar(260, 420), l: azar(8, 16), a: azar(0.4, 0.7) })
        dibujarNube(n)
      }
      // Llovizna fina, inclinada por el viento.
      ctx.lineCap = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = css(fuerte)
      const base = Math.round((w * h) / 6500)
      for (let i = gotas.length - 1; i >= 0; i--) {
        const g = gotas[i]
        g.y += g.v * dt; g.x += g.v * viento * dt
        if (g.y > h) {
          if (Math.random() < 0.3) anillos.push({ x: g.x, y: azar(piso() + 10, h - 6), r: 1, a: 0.5 })
          if (i >= base) { gotas.splice(i, 1); continue }
          Object.assign(g, nuevaGota())
        }
        if (i > base * factor && i < base) continue
        ctx.globalAlpha = g.a
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.l * viento, g.y - g.l); ctx.stroke()
      }
      ctx.globalAlpha = 1
      // Anillitos donde cae la lluvia.
      ctx.lineWidth = 0.9; ctx.strokeStyle = css(blanco)
      for (let i = anillos.length - 1; i >= 0; i--) {
        const r = anillos[i]
        r.r += 18 * dt; r.a -= 0.5 * dt
        if (r.a <= 0) { anillos.splice(i, 1); continue }
        ctx.globalAlpha = r.a
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 1.8, r.r * 0.55, 0, 0, 6.29); ctx.stroke()
      }
      ctx.globalAlpha = 1
      // Pétalos, corazones y mariposas.
      for (const v of voladores) {
        v.t += dt
        v.x += (v.vx + Math.sin(v.t * 0.8) * 14) * dt
        v.y += (v.vy + (v.tipo === 'mariposa' ? Math.sin(v.t * 2.2) * 22 : Math.cos(v.t * 1.1) * 6)) * dt
        v.giro += dt * (v.tipo === 'petalo' ? 1.6 : 0.4)
        if (v.x > w + 30 || v.y > h + 30 || v.y < -60) Object.assign(v, nuevoVolador())
        ctx.save(); ctx.translate(v.x, v.y); ctx.fillStyle = v.color
        if (v.tipo === 'petalo') {
          ctx.rotate(v.giro); ctx.scale(1, Math.abs(Math.cos(v.t * 1.4)) * 0.6 + 0.4)
          ctx.beginPath(); ctx.ellipse(0, 0, v.e, v.e * 0.6, 0, 0, 6.29); ctx.fill()
        } else if (v.tipo === 'corazon') {
          ctx.rotate(Math.sin(v.t) * 0.4); corazon(ctx, v.e)
        } else {
          const ala = Math.abs(Math.sin(v.t * 9)) * 0.75 + 0.25
          ctx.rotate(Math.sin(v.t * 2.2) * 0.3)
          for (const lado of [-1, 1]) {
            ctx.save(); ctx.scale(lado * ala, 1)
            ctx.beginPath(); ctx.ellipse(v.e * 0.55, -v.e * 0.3, v.e * 0.6, v.e * 0.45, -0.5, 0, 6.29); ctx.fill()
            ctx.beginPath(); ctx.ellipse(v.e * 0.4, v.e * 0.3, v.e * 0.4, v.e * 0.3, 0.5, 0, 6.29); ctx.fill()
            ctx.restore()
          }
          ctx.fillStyle = css(texto, 0.8); ctx.fillRect(-0.8, -v.e * 0.6, 1.6, v.e * 1.1)
        }
        ctx.restore()
      }
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
