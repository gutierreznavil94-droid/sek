import { useEffect, useRef } from 'react'
import { movimientoReducido } from './componentes'
import { temaActivo } from '../temas/temas'

/**
 * Shinobi que camina por la barra de bloques del entreno (videos de Luma pasados a tinta papel).
 * Sprite armado con scripts/shinobi-sprites.py: caminata de 2 pasos, frenado y quieto respirando.
 */
/** La hoja sale del tema activo (Shinobi: shinobi/camina.webp). */
const hoja = () => `${import.meta.env.BASE_URL}${temaActivo().sprite}`
const CELDA = { w: 48, h: 35 } // px CSS (la hoja está a 2x)
const COLUMNAS = 16
const FILAS = 13
const ANCLA = 23 // x del cuerpo dentro de la celda
const CAMINAR = { desde: 0, n: 48 }
const FRENAR = { desde: 48, n: 55 }
const QUIETO = { desde: 103, n: 105 }
const PASO = 0.3348 // px CSS por cuadro al paso natural del video
const FRENO_AVANCE = 5.8 // lo que avanza el cuerpo dentro de los cuadros del frenado
const RITMO = 1.6 // un poco más ágil que el video (el avance se escala igual: no patina)
const FPS_CAMINAR = 24 * RITMO
const FPS_QUIETO = 12
const FUNDIDO = 8 // últimos cuadros del frenado que se funden con el quieto

type Estado =
  | { tipo: 'quieto' }
  | { tipo: 'caminar'; dir: 1 | -1; cuadros: number; paso: number }
  | { tipo: 'frenar'; dir: 1 | -1 }

function fondo(el: HTMLDivElement | null, cuadro: number) {
  if (!el) return
  const c = Math.max(0, cuadro)
  el.style.backgroundPosition = `${-(c % COLUMNAS) * CELDA.w}px ${-Math.floor(c / COLUMNAS) * CELDA.h}px`
}

export function ShinobiBarra({ indice, total, barra }: { indice: number; total: number; barra: React.RefObject<HTMLDivElement | null> }) {
  const capaA = useRef<HTMLDivElement>(null)
  const capaB = useRef<HTMLDivElement>(null)
  const caja = useRef<HTMLDivElement>(null)
  const objetivo = useRef<number | null>(null)
  const reducido = movimientoReducido()

  // Dónde tiene que estar: centro del trazo actual, o el final de la barra si ya terminó todo.
  useEffect(() => {
    const medir = () => {
      const b = barra.current
      if (!b) return
      const trazos = b.querySelectorAll('span')
      if (!trazos.length) return
      const x0 = b.getBoundingClientRect().left
      if (indice >= trazos.length) {
        const r = trazos[trazos.length - 1].getBoundingClientRect()
        objetivo.current = r.right - x0 - 6
      } else {
        const r = trazos[indice].getBoundingClientRect()
        objetivo.current = r.left - x0 + r.width / 2
      }
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    if (ro && barra.current) ro.observe(barra.current)
    return () => ro?.disconnect()
  }, [indice, total, barra])

  useEffect(() => {
    const a = capaA.current
    const bq = capaB.current
    const el = caja.current
    if (!a || !bq || !el) return
    let x: number | null = null
    let estado: Estado = { tipo: 'quieto' }
    let f = 0 // cuadro dentro de la animación actual (con decimales)
    let tQuieto = 0
    let id = 0
    let antes = performance.now()

    const ubicar = (dir: 1 | -1) => {
      el.style.transform = `translateX(${(x ?? 0) - ANCLA}px)`
      a.style.transform = bq.style.transform = dir < 0 ? 'scaleX(-1)' : ''
    }
    let dirVista: 1 | -1 = 1
    const planear = (desdeCuadro: number) => {
      const T = objetivo.current!
      const d = T - x!
      const dir: 1 | -1 = d < 0 ? -1 : 1
      const recorrido = Math.abs(d) - FRENO_AVANCE
      // Cuadros hasta un final de ciclo (ahí empalma con el frenado); el paso se ajusta para llegar justo.
      const resto = CAMINAR.n - (desdeCuadro % CAMINAR.n)
      const extra = Math.max(0, Math.round((recorrido - resto * PASO) / (CAMINAR.n * PASO)))
      const cuadros = resto + extra * CAMINAR.n
      estado = { tipo: 'caminar', dir, cuadros, paso: Math.max(0, recorrido) / cuadros }
      f = desdeCuadro % CAMINAR.n
      dirVista = dir
    }

    const cuadro = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      const T = objetivo.current
      if (T != null && x == null) x = T
      if (T != null && x != null) {
        if (estado.tipo === 'quieto' && Math.abs(T - x) > 1.5) {
          if (reducido || Math.abs(T - x) < FRENO_AVANCE + 2) x = T
          else planear(0)
        }
        if (estado.tipo === 'caminar') {
          const e = estado
          const avance = Math.min(dt * FPS_CAMINAR, e.cuadros)
          f += avance
          e.cuadros -= avance
          x += e.dir * e.paso * avance
          // Si cambió el destino a mitad de camino, se replanea sin cortar el paso.
          const quedaria = x + e.dir * (e.paso * e.cuadros + FRENO_AVANCE)
          if (Math.abs(quedaria - T) > 2) planear(Math.floor(f))
          else if (e.cuadros <= 0) { estado = { tipo: 'frenar', dir: e.dir }; f = 0 }
        } else if (estado.tipo === 'frenar') {
          f += dt * FPS_CAMINAR
          if (f >= FRENAR.n) {
            x += estado.dir * FRENO_AVANCE
            estado = { tipo: 'quieto' }
            f = 0
            tQuieto = 0
          }
        }
      }
      // Pintar.
      if (estado.tipo === 'caminar') {
        fondo(a, CAMINAR.desde + (Math.floor(f) % CAMINAR.n))
        a.style.opacity = '1'
        bq.style.opacity = '0'
      } else if (estado.tipo === 'frenar') {
        const c = Math.min(FRENAR.n - 1, Math.floor(f))
        fondo(a, FRENAR.desde + c)
        // El quieto se pinta ya en la posición final; el frenado avanza dentro de su propia celda.
        const mezcla = Math.max(0, (f - (FRENAR.n - FUNDIDO)) / FUNDIDO)
        fondo(bq, QUIETO.desde)
        bq.style.marginLeft = `${estado.dir * FRENO_AVANCE}px`
        a.style.opacity = String(1 - mezcla)
        bq.style.opacity = String(mezcla)
      } else {
        tQuieto += dt
        const c = reducido ? 0 : Math.floor(tQuieto * FPS_QUIETO) % QUIETO.n
        fondo(bq, QUIETO.desde + c)
        bq.style.marginLeft = '0px'
        a.style.opacity = '0'
        bq.style.opacity = '1'
      }
      if (x != null) { ubicar(dirVista); el.style.visibility = 'visible' }
      if (reducido && estado.tipo === 'quieto') { id = 0; return }
      id = requestAnimationFrame(cuadro)
    }
    const arrancar = () => { cancelAnimationFrame(id); antes = performance.now(); id = requestAnimationFrame(cuadro) }
    const alCambiar = () => (document.visibilityState === 'visible' ? arrancar() : cancelAnimationFrame(id))
    arrancar()
    document.addEventListener('visibilitychange', alCambiar)
    // Con «reducir movimiento» se pinta una sola vez por cambio de bloque.
    const relanzar = () => arrancar()
    window.addEventListener('shinobi-mover', relanzar)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('visibilitychange', alCambiar)
      window.removeEventListener('shinobi-mover', relanzar)
    }
  }, [reducido])

  useEffect(() => { if (reducido) window.dispatchEvent(new Event('shinobi-mover')) }, [indice, reducido])

  const estilo = { backgroundImage: `url(${hoja()})`, backgroundSize: `${COLUMNAS * CELDA.w}px ${FILAS * CELDA.h}px`, width: CELDA.w, height: CELDA.h, transformOrigin: `${ANCLA}px 50%` }
  return (
    <div ref={caja} className="shinobi-barra" aria-hidden="true" style={{ visibility: 'hidden' }}>
      <div ref={capaA} className="shinobi-capa" style={estilo} />
      <div ref={capaB} className="shinobi-capa" style={estilo} />
    </div>
  )
}
