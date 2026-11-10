/**
 * Fondos con lluvia dibujada (canvas, sin video, poco gasto), detrás de todo. Opacidad baja: se ve, pero el texto
 * se lee igual. Con «reducir movimiento» quedan quietos. Apagables por pantalla en Ajustes → Fondo con lluvia.
 * - Hoy: banco de nubes a tinta arriba (tapa el hueco que deja el encabezado y se aclara hacia abajo), lluvia fina
 *   en diagonal con dos capas y cada 20–40 s un relámpago muy tenue.
 * - Calendario: llovizna más suave y vertical, con dos o tres nubes que pasan muy despacio; sin relámpagos.
 * - Juego: lluvia vista desde adentro: gotas gruesas que resbalan por un vidrio (bajan, se frenan, siguen) y un charco
 *   abajo donde caen gotas y abren anillos. Mientras corre el temporizador, todo más lento y tenue (concentración).
 * - Sueño: una habitación a tinta: futón abajo, ventana a la derecha con lluvia y gotas en el vidrio, lámpara de papel.
 * - Comida: lluvia fina sobre hojas de bambú a un costado; cada tanto una gota resbala por una hoja y cae.
 * - Entreno: tormenta en diagonal con relámpagos lejanos; en el descanso (`calma`) se calma y va más lenta.
 * - Más: lluvia oblicua con viento que va y viene, y cada tanto una hoja que pasa volando.
 *
 * - v0.80, tormenta en todos (menos Sueño, que la ve por la ventana): más gotas, ráfagas de viento que inclinan la lluvia,
 *   salpicaduras al pie y sobre el borde de las tarjetas, neblina lenta, nubes, hojas que cruzan y relámpagos lejanos
 *   cada 20–60 s que iluminan las nubes y la silueta de montañas del fondo (trueno vía el evento «sek-trueno»).
 *   Si el celu va lento, baja la cantidad de gotas sola.
 *
 * Autocontenido: solo usa React y `movimientoReducido` (se puede llevar a otro proyecto tal cual).
 */
import { useEffect, useRef, useState } from 'react'
import { movimientoReducido } from './componentes'
import { useTema } from '../temas/temas'
import { LluviaPastel } from './LluviaPastel'

export type VarianteLluvia = 'hoy' | 'calendario' | 'juego' | 'sueno' | 'comida' | 'entreno' | 'mas'

type Gota = { x: number; y: number; largo: number; vel: number; capa: 0 | 1 }
type Nube = { x: number; y: number; r: number; vel: number; a: number }
/** Gota en el vidrio: queda quieta un rato, baja, se frena, sigue. Deja un rastro que se borra. */
type GotaVidrio = { x: number; y: number; r: number; vel: number; quieta: number; moviendo: number; rastro: number }
type Anillo = { x: number; y: number; t: number; max: number }
/** Salpicadura: dos o tres gotitas que saltan y caen. */
type Salpica = { x: number; y: number; t: number; dx: number[] }
type Niebla = { x: number; y: number; r: number; vel: number; a: number }
/** Hoja de bambú: sale de un nudo con un ángulo; se mece un poco. */
type HojaBambu = { x: number; y: number; ang: number; largo: number; ancho: number; fase: number }
/** Gota que resbala por una hoja (k: 0 base → 1 punta) y después cae. */
type GotaHoja = { hoja: number; k: number; cae: boolean; x: number; y: number; vy: number }
/** Hoja suelta que el viento lleva (Más). */
type HojaVuela = { x: number; y: number; vx: number; giro: number; fase: number; tam: number }

/** Cuánto se ve cada variante (Hoy queda como estaba). */
const PERFIL: Record<VarianteLluvia, { vel: [number, number]; largo: [number, number]; alfa: [number, number]; ancho: [number, number]; area: number; diagonal: number }> = {
  hoy: { vel: [150, 85], largo: [30, 16], alfa: [0.55, 0.28], ancho: [1.7, 1.1], area: 6500, diagonal: 0.22 },
  calendario: { vel: [95, 58], largo: [24, 14], alfa: [0.5, 0.26], ancho: [1.6, 1.1], area: 7000, diagonal: 0.04 },
  juego: { vel: [80, 48], largo: [18, 11], alfa: [0.46, 0.24], ancho: [1.6, 1.1], area: 12000, diagonal: 0.04 },
  sueno: { vel: [70, 42], largo: [18, 11], alfa: [0.55, 0.3], ancho: [1.5, 1], area: 380, diagonal: 0.04 },
  comida: { vel: [78, 48], largo: [15, 9], alfa: [0.48, 0.25], ancho: [1.4, 1], area: 8000, diagonal: 0.07 },
  entreno: { vel: [270, 175], largo: [40, 22], alfa: [0.55, 0.3], ancho: [1.8, 1.2], area: 5200, diagonal: 0.36 },
  mas: { vel: [125, 78], largo: [22, 13], alfa: [0.5, 0.27], ancho: [1.6, 1.1], area: 8000, diagonal: 0.5 },
}

const COLOR = '236, 234, 229'

/** Intensidad elegida en Ajustes → Fondo con lluvia (la fija Layout al leer los ajustes). */
export type IntensidadLluvia = 'llovizna' | 'lluvia' | 'tormenta'
const INTENSIDAD: Record<IntensidadLluvia, { gotas: number; cerca: number; vidrio: number; rayo: [number, number] | null }> = {
  llovizna: { gotas: 0.5, cerca: 0, vidrio: 0.5, rayo: null },
  lluvia: { gotas: 1, cerca: 1, vidrio: 1, rayo: [45000, 90000] },
  tormenta: { gotas: 1.45, cerca: 1.8, vidrio: 1.5, rayo: [25000, 50000] },
}
let intensidadActual: IntensidadLluvia = 'lluvia'
export function fijarIntensidadLluvia(i: IntensidadLluvia | undefined): void {
  const v = i && INTENSIDAD[i] ? i : 'lluvia'
  if (v === intensidadActual) return
  intensidadActual = v
  try { window.dispatchEvent(new Event('sek-intensidad-lluvia')) } catch { /* nada */ }
}
/** Gota cercana: grande, rápida y desenfocada (profundidad). */
type GotaCerca = { x: number; y: number; largo: number; vel: number; ancho: number; a: number }
/** Salpicadura al tocar: anillo y gotitas que saltan del dedo. */
type Toque = { x: number; y: number; t: number; gotas: { vx: number; vy: number }[] }
/** El temporizador de Juego corriendo (lo marca la página): la lluvia va más lenta y tenue. */
export const CLASE_JUEGO_CORRIENDO = 'juego-corriendo'

/** `enCaja`: dentro de un recuadro (position: absolute) en lugar de toda la pantalla; mide el recuadro. */
export function FondoLluvia({ variante, calma = false, enCaja = false }: { variante: VarianteLluvia; calma?: boolean; enCaja?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Tema subido: nada de tormenta ni tinta; pétalos suaves del color del tema.
  const propio = !!useTema().propio
  const frenteRef = useRef<HTMLCanvasElement>(null)
  const calmaRef = useRef(calma)
  calmaRef.current = calma
  // Al cambiar la intensidad en Ajustes, la lluvia se arma de nuevo.
  const [intensidad, setIntensidad] = useState(intensidadActual)
  useEffect(() => {
    const cambio = () => setIntensidad(intensidadActual)
    window.addEventListener('sek-intensidad-lluvia', cambio)
    return () => window.removeEventListener('sek-intensidad-lluvia', cambio)
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const atras = c.getContext('2d')
    if (!atras) return
    let ctx: CanvasRenderingContext2D = atras
    // Capa de adelante (encima de las tarjetas, sin tomar toques): gotas en el vidrio, salpicadura del dedo y el destello.
    const cf = frenteRef.current
    const frente = cf?.getContext('2d') ?? null
    const quieto = movimientoReducido()
    let w = 0
    let h = 0
    let dpr = 1
    const gotas: Gota[] = []
    const nubes: Nube[] = []
    const vidrio: GotaVidrio[] = []
    const anillos: Anillo[] = []
    let proximoAnillo = 0
    const perfil = PERFIL[variante]
    let diagonal = perfil.diagonal
    const hojas: HojaBambu[] = []
    const gotasHoja: GotaHoja[] = []
    let proximaGotaHoja = 0
    const vuelan: HojaVuela[] = []
    let proximaHojaVuela = performance.now() + 2500
    // Tormenta: todas las variantes menos Sueño (que tiene su ventana).
    const tormenta = variante !== 'sueno'
    let factorGotas = 1
    const salpicas: Salpica[] = []
    const nieblas: Niebla[] = []
    let rafaga = 0
    let proximaRafaga = performance.now() + 9000 + Math.random() * 12000
    let tormentaLuz = 0
    let tormentaFuerte = false
    let proximaTormenta = performance.now() + 6000 + Math.random() * 14000
    let bordes: { x: number; y: number; w: number }[] = []
    let medidoBordes = 0
    let lentoAcum = 0
    let silueta: [number, number][] = []
    /** Ventana de Sueño (y zona de lluvia de afuera). */
    let ventana = { x: 0, y: 0, w: 0, h: 0 }
    const int = INTENSIDAD[intensidadActual]
    const cerca: GotaCerca[] = []
    const toques: Toque[] = []
    /** Relámpago cercano: un rayo que se ve y un destello suave (más suave de noche, para no encandilar). */
    let rayo = 0
    let rayoCamino: [number, number][][] = []
    let proximoRayo = int.rayo ? performance.now() + 15000 + Math.random() * int.rayo[0] : Infinity
    /** Gotas en el vidrio sobre la pantalla (todas las variantes con tormenta; Juego ya tiene las suyas). */
    const vidrioPantalla = tormenta && !enCaja && variante !== 'juego'

    const nueva = (inicial: boolean): Gota => {
      const capa: 0 | 1 = Math.random() < 0.55 ? 0 : 1
      const vel = perfil.vel[capa ? 0 : 1]
      const zona = variante === 'sueno' ? ventana : { x: 0, y: 0, w, h }
      return {
        x: zona.x + Math.random() * (zona.w + zona.h * Math.abs(diagonal)) - zona.h * Math.max(0, diagonal),
        y: inicial ? zona.y + Math.random() * zona.h : zona.y - 20,
        largo: perfil.largo[capa ? 0 : 1],
        vel: vel * (0.85 + Math.random() * 0.3),
        capa,
      }
    }
    const nuevaVidrio = (inicial: boolean): GotaVidrio => {
      const zona = variante === 'sueno' ? ventana : { x: 0, y: 0, w, h }
      return { x: zona.x + 6 + Math.random() * (zona.w - 12), y: inicial ? zona.y + Math.random() * zona.h * 0.9 : zona.y - 6, r: 2 + Math.random() * (variante === 'sueno' ? 1.6 : 2.6), vel: 0, quieta: Math.random() * 3, moviendo: 0, rastro: 0 }
    }

    const nuevaCerca = (inicial: boolean): GotaCerca => ({
      x: Math.random() * (w + h * Math.abs(diagonal)) - h * Math.max(0, diagonal),
      y: inicial ? Math.random() * h : -120,
      largo: 70 + Math.random() * 60,
      vel: 520 + Math.random() * 260,
      ancho: 3 + Math.random() * 3,
      a: 0.05 + Math.random() * 0.05,
    })

    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const caja = enCaja ? c.getBoundingClientRect() : null
      w = caja && caja.width > 0 ? caja.width : window.innerWidth
      h = caja && caja.height > 0 ? caja.height : window.innerHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (cf && frente) { cf.width = c.width; cf.height = c.height; frente.setTransform(dpr, 0, 0, dpr, 0, 0) }
      ventana = { x: Math.round(w * 0.6), y: Math.round(h * 0.3), w: Math.round(w * 0.34), h: Math.round(h * 0.27) }
      gotas.length = 0
      const n = Math.round(((variante === 'sueno' ? ventana.w * ventana.h : w * h) / perfil.area) * (enCaja ? 6 : 1) * (tormenta ? 1.7 * factorGotas * int.gotas : 1))
      for (let i = 0; i < n; i++) gotas.push(nueva(true))
      cerca.length = 0
      if (tormenta) for (let i = 0; i < Math.round((w / 95) * int.cerca * factorGotas); i++) cerca.push(nuevaCerca(true))
      vidrio.length = 0
      if (variante === 'juego') for (let i = 0; i < Math.max(9, Math.round(w / 34)); i++) vidrio.push(nuevaVidrio(true))
      if (vidrioPantalla) for (let i = 0; i < Math.max(3, Math.round((w / 70) * int.vidrio)); i++) vidrio.push(nuevaVidrio(true))
      if (variante === 'sueno') for (let i = 0; i < 7; i++) vidrio.push(nuevaVidrio(true))
      nubes.length = 0
      if (variante === 'calendario') for (let i = 0; i < 4; i++) nubes.push({ x: (w * (i + 0.5)) / 4 + (Math.random() - 0.5) * 80, y: 150 + i * h * 0.17 + Math.random() * 40, r: 70 + Math.random() * 50, vel: 3 + Math.random() * 3, a: 0.16 + Math.random() * 0.07 })
      if (variante === 'entreno') for (let i = 0; i < 5; i++) nubes.push({ x: (w * (i + 0.5)) / 5, y: 10 + Math.random() * 60, r: 60 + Math.random() * 40, vel: 6 + Math.random() * 5, a: 0.14 + Math.random() * 0.06 })
      hojas.length = 0
      gotasHoja.length = 0
      if (variante === 'comida') {
        // Dos cañas a la derecha, con nudos y hojas largas que cuelgan hacia el centro.
        const canas = [w * 0.9, w * 0.97]
        canas.forEach((cx, j) => {
          for (let k = 0; k < 5; k++) {
            const y = h * (0.12 + k * 0.16) + j * 30
            const n = 2 + (k % 2)
            for (let q = 0; q < n; q++) hojas.push({ x: cx, y, ang: Math.PI * (0.82 + q * 0.09 + Math.random() * 0.05), largo: 46 + Math.random() * 34, ancho: 6 + Math.random() * 3, fase: Math.random() * 6 })
          }
        })
      }
      nieblas.length = 0
      if (tormenta) {
        for (let i = 0; i < 3; i++) nieblas.push({ x: Math.random() * w, y: h * (0.35 + i * 0.22), r: 140 + Math.random() * 90, vel: 5 + Math.random() * 6, a: 0.05 + Math.random() * 0.03 })
        if (variante === 'juego' || variante === 'comida' || variante === 'mas') for (let i = 0; i < 4; i++) nubes.push({ x: (w * (i + 0.5)) / 4, y: 10 + Math.random() * 50, r: 55 + Math.random() * 35, vel: 3 + Math.random() * 3, a: 0.12 + Math.random() * 0.05 })
        // Silueta de montañas lejanas: solo se ve cuando ilumina un relámpago.
        silueta = []
        for (let k = 0; k <= 10; k++) silueta.push([(w * k) / 10, h * (0.56 + Math.random() * 0.1) - (k % 4 === 2 ? h * 0.08 : 0)])
      }
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
          if (g.y > fondo || g.x > w + 60 || g.x < -60) Object.assign(g, nueva(false))
        }
        const base = perfil.alfa[g.capa ? 0 : 1]
        ctx.strokeStyle = `rgba(${COLOR}, ${base * alfa})`
        ctx.lineWidth = perfil.ancho[g.capa ? 0 : 1]
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
          ctx.strokeStyle = `rgba(${COLOR}, ${0.14 * alfa})`
          ctx.lineWidth = g.r * 0.9
          ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(g.x, g.y - g.r); ctx.lineTo(g.x + Math.sin(g.y * 0.05) * 1.2, g.y - g.r - g.rastro); ctx.stroke()
        }
        ctx.fillStyle = `rgba(${COLOR}, ${0.26 * alfa})`
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 1.25, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${COLOR}, ${0.55 * alfa})`
        ctx.beginPath(); ctx.arc(g.x - g.r * 0.35, g.y - g.r * 0.4, g.r * 0.32, 0, Math.PI * 2); ctx.fill()
      }
    }

    /** Charco de Juego: línea de tinta abajo; cada tanto cae una gota y abre un anillo. */
    const pintarCharco = (dt: number, t: number, alfa: number, lento: number) => {
      const y = h - 96
      const x0 = w * 0.08
      const x1 = w * 0.92
      ctx.strokeStyle = `rgba(${COLOR}, ${0.24 * alfa})`
      ctx.lineWidth = 1.6
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
        ctx.strokeStyle = `rgba(${COLOR}, ${0.46 * (1 - k) * alfa})`
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
      ctx.fillStyle = 'rgba(120, 132, 155, 0.15)'
      ctx.fillRect(v.x, v.y, v.w, v.h)
      ctx.save()
      ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip()
      pintarLluvia(dt, 1, 1)
      pintarVidrio(dt, 1, 1)
      ctx.restore()
      ctx.strokeStyle = tinta(0.52); ctx.lineWidth = 3
      ctx.strokeRect(v.x, v.y, v.w, v.h)
      ctx.lineWidth = 1.6; ctx.strokeStyle = tinta(0.3)
      ctx.beginPath()
      ctx.moveTo(v.x + v.w / 2, v.y); ctx.lineTo(v.x + v.w / 2, v.y + v.h)
      ctx.moveTo(v.x, v.y + v.h / 2); ctx.lineTo(v.x + v.w, v.y + v.h / 2)
      ctx.stroke()
      // Alféizar
      ctx.strokeStyle = tinta(0.32); ctx.lineWidth = 3.5
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

    /** Bambú de Comida: cañas a tinta con nudos, hojas que se mecen y gotas que resbalan por ellas. */
    const puntaHoja = (hj: HojaBambu, t: number) => {
      const a = hj.ang + (quieto ? 0 : Math.sin(t / 1600 + hj.fase) * 0.04)
      return { a, x: hj.x + Math.cos(a) * hj.largo, y: hj.y + Math.sin(a) * hj.largo * 0.55 + hj.largo * 0.25 }
    }
    const pintarBambu = (dt: number, t: number) => {
      ctx.lineCap = 'round'
      for (const cx of [w * 0.9, w * 0.97]) {
        ctx.strokeStyle = `rgba(${COLOR}, 0.2)`; ctx.lineWidth = 5
        ctx.beginPath(); ctx.moveTo(cx, -10); ctx.lineTo(cx + 3, h + 10); ctx.stroke()
        ctx.strokeStyle = `rgba(${COLOR}, 0.34)`; ctx.lineWidth = 2
        for (let y = 40; y < h; y += 92) { ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.lineTo(cx + 5, y + 1); ctx.stroke() }
      }
      for (const hj of hojas) {
        const p = puntaHoja(hj, t)
        const mx = (hj.x + p.x) / 2
        const my = (hj.y + p.y) / 2
        const nx = -(p.y - hj.y) / hj.largo
        const ny = (p.x - hj.x) / hj.largo
        ctx.fillStyle = `rgba(${COLOR}, 0.16)`
        ctx.beginPath()
        ctx.moveTo(hj.x, hj.y)
        ctx.quadraticCurveTo(mx + nx * hj.ancho, my + ny * hj.ancho, p.x, p.y)
        ctx.quadraticCurveTo(mx - nx * hj.ancho * 0.6, my - ny * hj.ancho * 0.6, hj.x, hj.y)
        ctx.fill()
        ctx.strokeStyle = `rgba(${COLOR}, 0.22)`; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.moveTo(hj.x, hj.y); ctx.lineTo(p.x, p.y); ctx.stroke()
      }
      if (!quieto && hojas.length && t >= proximaGotaHoja) {
        gotasHoja.push({ hoja: Math.floor(Math.random() * hojas.length), k: 0, cae: false, x: 0, y: 0, vy: 0 })
        proximaGotaHoja = t + 1400 + Math.random() * 2600
      }
      for (let i = gotasHoja.length - 1; i >= 0; i--) {
        const g = gotasHoja[i]
        const hj = hojas[g.hoja]
        if (!g.cae) {
          g.k = Math.min(1, g.k + dt * 0.7)
          const p = puntaHoja(hj, t)
          g.x = hj.x + (p.x - hj.x) * g.k
          g.y = hj.y + (p.y - hj.y) * g.k
          if (g.k >= 1) g.cae = true
        } else {
          g.vy += 900 * dt
          g.y += g.vy * dt
          if (g.y > h + 10) { gotasHoja.splice(i, 1); continue }
        }
        ctx.fillStyle = `rgba(${COLOR}, 0.6)`
        ctx.beginPath(); ctx.ellipse(g.x, g.y, 1.8, g.cae ? 3.4 : 2.2, 0, 0, Math.PI * 2); ctx.fill()
      }
    }

    /** Hojas que el viento lleva de un lado al otro (Más). */
    const pintarHojasVuela = (dt: number, t: number) => {
      if (!quieto && t >= proximaHojaVuela && vuelan.length < 2) {
        vuelan.push({ x: -20, y: h * (0.15 + Math.random() * 0.55), vx: 110 + Math.random() * 70, giro: Math.random() * 6, fase: Math.random() * 6, tam: 7 + Math.random() * 5 })
        proximaHojaVuela = t + 5000 + Math.random() * 7000
      }
      for (let i = vuelan.length - 1; i >= 0; i--) {
        const f = vuelan[i]
        if (!quieto) {
          f.x += f.vx * dt * (0.8 + diagonal * 0.6)
          f.y += Math.sin(t / 400 + f.fase) * 30 * dt + 12 * dt
          f.giro += dt * 3
          if (f.x > w + 30) { vuelan.splice(i, 1); continue }
        }
        ctx.save()
        ctx.translate(f.x, f.y)
        ctx.rotate(f.giro)
        ctx.scale(1, 0.5 + 0.5 * Math.abs(Math.cos(f.giro * 0.7)))
        ctx.fillStyle = `rgba(${COLOR}, 0.4)`
        ctx.beginPath()
        ctx.moveTo(-f.tam, 0)
        ctx.quadraticCurveTo(0, -f.tam * 0.55, f.tam, 0)
        ctx.quadraticCurveTo(0, f.tam * 0.55, -f.tam, 0)
        ctx.fill()
        ctx.restore()
      }
    }

    const relampagoLejano = (dt: number, t: number) => {
      if (quieto) return
      if (t >= proximoRelampago) { relampago = 1; proximoRelampago = t + 12000 + Math.random() * 14000 }
      if (relampago > 0) {
        const parpadeo = relampago > 0.6 ? 1 : relampago > 0.45 ? 0.3 : 0.8
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.6)
        g.addColorStop(0, `rgba(${COLOR}, ${0.16 * relampago * parpadeo})`)
        g.addColorStop(1, `rgba(${COLOR}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h * 0.6)
        relampago = Math.max(0, relampago - dt * 2.4)
      }
    }

    /** Relámpago lejano: destello que ilumina las nubes y la silueta de montañas un instante (a veces doble y más fuerte). */
    const pintarTormentaLuz = (dt: number, t: number) => {
      if (quieto) return
      if (t >= proximaTormenta) {
        tormentaFuerte = Math.random() < 0.3
        tormentaLuz = 1
        proximaTormenta = t + 20000 + Math.random() * 40000
        try { window.dispatchEvent(new CustomEvent('sek-trueno', { detail: { fuerte: tormentaFuerte } })) } catch { /* sin eventos */ }
      }
      if (tormentaLuz <= 0) return
      const parpadeo = tormentaLuz > 0.75 ? 1 : tormentaLuz > 0.6 ? 0.25 : tormentaLuz > 0.45 ? (tormentaFuerte ? 0.9 : 0.5) : 0.6
      const k = tormentaLuz * parpadeo * (tormentaFuerte ? 1 : 0.6)
      const cielo = ctx.createLinearGradient(0, 0, 0, h * 0.75)
      cielo.addColorStop(0, `rgba(${COLOR}, ${0.2 * k})`)
      cielo.addColorStop(1, `rgba(${COLOR}, 0)`)
      ctx.fillStyle = cielo
      ctx.fillRect(0, 0, w, h * 0.75)
      if (silueta.length) {
        ctx.fillStyle = `rgba(8, 8, 8, ${0.5 * k})`
        ctx.beginPath(); ctx.moveTo(0, h)
        for (const [x, y] of silueta) ctx.lineTo(x, y)
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
      }
      tormentaLuz = Math.max(0, tormentaLuz - dt * (tormentaFuerte ? 1.6 : 2.4))
    }
    /** Ráfaga de viento: la lluvia se inclina más unos segundos y vuelve. */
    const vientoRafaga = (dt: number, t: number) => {
      if (quieto) return 0
      if (t >= proximaRafaga) { rafaga = 1; proximaRafaga = t + 14000 + Math.random() * 18000 }
      if (rafaga > 0) rafaga = Math.max(0, rafaga - dt / 4.5)
      return Math.sin(Math.PI * rafaga) * 0.28
    }
    /** Neblina suave que pasa lenta. */
    const pintarNiebla = (dt: number) => {
      for (const n of nieblas) {
        if (!quieto) { n.x += n.vel * dt; if (n.x - n.r * 2 > w) n.x = -n.r * 2 }
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2)
        g.addColorStop(0, `rgba(170, 168, 162, ${n.a})`)
        g.addColorStop(1, 'rgba(170, 168, 162, 0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r * 2, n.r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
      }
    }
    /** Salpicaduras al pie de la pantalla y sobre el borde de arriba de las tarjetas. */
    const pintarSalpicas = (dt: number, t: number) => {
      if (quieto || enCaja) return
      if (t - medidoBordes > 1200) {
        medidoBordes = t
        bordes = []
        document.querySelectorAll('.tarjeta, .av-tarjeta, .pilar-bloque, .hj-dia').forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width > 60 && r.top > 40 && r.top < h - 40) bordes.push({ x: r.left + 8, y: r.top, w: r.width - 16 })
          if (bordes.length > 14) return
        })
      }
      const nuevas = dt * 9
      const cuantas = Math.floor(nuevas) + (Math.random() < nuevas % 1 ? 1 : 0)
      for (let i = 0; i < cuantas; i++) {
        const b = bordes.length && Math.random() < 0.6 ? bordes[Math.floor(Math.random() * bordes.length)] : { x: 0, y: h - 2, w }
        salpicas.push({ x: b.x + Math.random() * b.w, y: b.y, t: 0, dx: [-1, 0.2, 1].map((v) => v * (6 + Math.random() * 6)) })
      }
      ctx.fillStyle = `rgba(${COLOR}, 0.5)`
      for (let i = salpicas.length - 1; i >= 0; i--) {
        const sp = salpicas[i]
        sp.t += dt
        const k = sp.t / 0.38
        if (k >= 1) { salpicas.splice(i, 1); continue }
        ctx.globalAlpha = 1 - k
        for (const dx of sp.dx) { ctx.beginPath(); ctx.arc(sp.x + dx * k, sp.y - 9 * Math.sin(Math.PI * k) * (0.6 + Math.abs(dx) / 20), 0.9, 0, Math.PI * 2); ctx.fill() }
      }
      ctx.globalAlpha = 1
      if (salpicas.length > 60) salpicas.splice(0, salpicas.length - 60)
    }
    /** Gotas cerca de la cara: trazos anchos y transparentes con un centro más nítido (profundidad). */
    const pintarCerca = (dt: number, lento: number) => {
      ctx.lineCap = 'round'
      const dg = diagonal * 1.15
      for (const g of cerca) {
        if (!quieto) {
          g.y += g.vel * dt * lento
          g.x += g.vel * dt * dg * lento
          if (g.y - g.largo > h || g.x > w + 120 || g.x < -120) Object.assign(g, nuevaCerca(false))
        }
        ctx.strokeStyle = `rgba(${COLOR}, ${g.a})`
        ctx.lineWidth = g.ancho
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.largo * dg, g.y - g.largo); ctx.stroke()
        ctx.strokeStyle = `rgba(${COLOR}, ${g.a * 1.6})`
        ctx.lineWidth = 1.1
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.largo * 0.7 * dg, g.y - g.largo * 0.7); ctx.stroke()
      }
    }

    /** Camino quebrado de un rayo, con una o dos ramas. */
    const armarRayo = (): [number, number][][] => {
      const x0 = w * (0.15 + Math.random() * 0.7)
      const fin = h * (0.28 + Math.random() * 0.18)
      const tronco: [number, number][] = [[x0, -10]]
      let x = x0
      for (let y = -10; y < fin; ) { y += 14 + Math.random() * 22; x += (Math.random() - 0.5) * 34; tronco.push([x, y]) }
      const ramas: [number, number][][] = [tronco]
      for (let k = 0; k < 1 + Math.round(Math.random()); k++) {
        const desde = tronco[2 + Math.floor(Math.random() * Math.max(1, tronco.length - 4))]
        const rama: [number, number][] = [desde]
        let [rx, ry] = desde
        const lado = Math.random() < 0.5 ? -1 : 1
        for (let i = 0; i < 4; i++) { ry += 10 + Math.random() * 16; rx += lado * (8 + Math.random() * 16); rama.push([rx, ry]) }
        ramas.push(rama)
      }
      return ramas
    }
    /**
     * Relámpago cercano (cada 45–90 s con «lluvia», más seguido con «tormenta», nunca con «llovizna»): se ve el rayo
     * arriba y la pantalla se aclara apenas. De noche (19 a 7 h) el destello es la mitad, para no encandilar.
     */
    const pintarRayo = (dt: number, t: number) => {
      if (quieto || !int.rayo || enCaja) return
      if (t >= proximoRayo) {
        rayo = 1
        rayoCamino = armarRayo()
        proximoRayo = t + int.rayo[0] + Math.random() * (int.rayo[1] - int.rayo[0])
        try { window.dispatchEvent(new CustomEvent('sek-trueno', { detail: { fuerte: true } })) } catch { /* sin eventos */ }
        try {
          const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
          if (!ua || ua.hasBeenActive) window.setTimeout(() => navigator.vibrate?.([22, 70, 34]), 350)
        } catch { /* sin vibración */ }
      }
      if (rayo <= 0) return
      const hora = new Date().getHours()
      const noche = hora >= 19 || hora < 7
      const parpadeo = rayo > 0.8 ? 1 : rayo > 0.68 ? 0.2 : rayo > 0.5 ? 0.85 : 0.45
      const k = rayo * parpadeo
      const destello = frente ?? ctx
      destello.fillStyle = `rgba(${COLOR}, ${(noche ? 0.06 : 0.11) * k})`
      destello.fillRect(0, 0, w, h)
      if (rayo > 0.35) {
        destello.lineCap = 'round'
        destello.lineJoin = 'round'
        rayoCamino.forEach((c, i) => {
          for (const [ancho, a] of [[6, 0.1], [1.6, 0.55]] as const) {
            destello.strokeStyle = `rgba(${COLOR}, ${a * k * (noche ? 0.55 : 1) * (i ? 0.6 : 1)})`
            destello.lineWidth = i ? ancho * 0.6 : ancho
            destello.beginPath(); c.forEach(([x, y], j) => (j ? destello.lineTo(x, y) : destello.moveTo(x, y))); destello.stroke()
          }
        })
      }
      rayo = Math.max(0, rayo - dt * 1.9)
    }

    /** Al tocar un pilar o un botón: un anillo de agua y gotitas que saltan del dedo. */
    const pintarToques = (dt: number) => {
      for (let i = toques.length - 1; i >= 0; i--) {
        const q = toques[i]
        q.t += dt
        const k = q.t / 0.65
        if (k >= 1) { toques.splice(i, 1); continue }
        ctx.strokeStyle = `rgba(${COLOR}, ${0.5 * (1 - k)})`
        ctx.lineWidth = 1.4
        const r = 8 + 34 * (1 - (1 - k) ** 2)
        ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = `rgba(${COLOR}, ${0.7 * (1 - k)})`
        for (const g of q.gotas) {
          const x = q.x + g.vx * q.t
          const y = q.y + g.vy * q.t + 520 * q.t * q.t
          ctx.beginPath(); ctx.ellipse(x, y, 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    /** Si el celu va lento (más de 3 s por debajo de ~35 cuadros), menos gotas. */
    const cuidarBateria = (dt: number) => {
      if (quieto) return
      lentoAcum = dt > 1 / 35 ? lentoAcum + dt : Math.max(0, lentoAcum - dt)
      if (lentoAcum > 3 && factorGotas > 0.45) { factorGotas *= 0.65; lentoAcum = 0; gotas.splice(Math.round(gotas.length * 0.65)); cerca.splice(Math.round(cerca.length * 0.5)) }
    }

    const dibujar = (dt: number, t: number) => {
      ctx.clearRect(0, 0, w, h)
      if (tormenta) {
        cuidarBateria(dt)
        pintarTormentaLuz(dt, t)
        pintarNiebla(dt)
        diagonal = (variante === 'mas' ? diagonal : perfil.diagonal) + vientoRafaga(dt, t)
      }
      dibujarVariante(dt, t)
      if (tormenta) {
        if (variante !== 'mas') pintarHojasVuela(dt, t)
        pintarSalpicas(dt, t)
        {
          const calmo = (variante === 'entreno' && calmaRef.current) || (variante === 'juego' && document.documentElement.classList.contains(CLASE_JUEGO_CORRIENDO))
          pintarCerca(dt, calmo ? 0.4 : 1)
        }
      }
      if (frente) {
        frente.clearRect(0, 0, w, h)
        ctx = frente
        if (vidrioPantalla) pintarVidrio(dt, 0.45, 1)
        pintarToques(dt)
        ctx = atras
      } else pintarToques(dt)
      if (tormenta) {
        const calmo = (variante === 'entreno' && calmaRef.current) || (variante === 'juego' && document.documentElement.classList.contains(CLASE_JUEGO_CORRIENDO))
        if (!calmo) pintarRayo(dt, t)
      }
    }
    const dibujarVariante = (dt: number, t: number) => {
      if (variante === 'comida') { pintarLluvia(dt, 1, 1); pintarBambu(dt, t); return }
      if (variante === 'mas') {
        // Viento que va y viene: la lluvia se inclina más o menos
        if (!quieto) diagonal = perfil.diagonal + Math.sin(t / 2600) * 0.16 + Math.sin(t / 900) * 0.04 + vientoRafaga(0, t)
        pintarLluvia(dt, 1, 1)
        pintarHojasVuela(dt, t)
        return
      }
      if (variante === 'entreno') {
        const calmo = calmaRef.current
        if (!calmo) relampagoLejano(dt, t)
        for (const nb of nubes) {
          if (!quieto) { nb.x += nb.vel * dt * (calmo ? 0.3 : 1); if (nb.x - nb.r * 1.6 > w) nb.x = -nb.r * 1.6 }
          pintarNube(nb)
        }
        pintarLluvia(dt, calmo ? 0.55 : 1, calmo ? 0.35 : 1)
        return
      }
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
    const alTocar = (e: PointerEvent) => {
      if (quieto || enCaja || !(e.target instanceof Element) || !e.target.closest('.pilar-bloque, button, .boton, a.tarjeta')) return
      toques.push({ x: e.clientX, y: e.clientY, t: 0, gotas: Array.from({ length: 7 }, () => { const a = -Math.PI * (0.1 + Math.random() * 0.8); const v = 90 + Math.random() * 120; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v } }) })
      if (toques.length > 6) toques.shift()
    }
    document.addEventListener('pointerdown', alTocar, { passive: true })
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', alMedir); document.removeEventListener('pointerdown', alTocar) }
  }, [variante, enCaja, propio, intensidad])
  if (propio) return <LluviaPastel enCaja={enCaja} calma={calma} />
  return (
    <>
      <canvas ref={ref} className={`fondo-lluvia ${variante}${enCaja ? ' en-caja' : ''}`} aria-hidden />
      {!enCaja && <canvas ref={frenteRef} className="fondo-lluvia-frente" aria-hidden />}
    </>
  )
}
