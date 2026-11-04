/**
 * El compañero del tema: el shinobi chiquito que se pasea por el borde de abajo de Hoy y queda
 * quieto en una esquina en Calendario, Comida y Más. Nunca en Progreso ni dentro del entreno.
 * Tocarlo: se frena, mira al frente y habla (globo a tinta). Otro toque lo cierra.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { obtenerAjustes } from '../services/base'
import { datosConsejo, elegirConsejo, estadoCompanero, fraseSuelta, frasesCompanero, guardarEstadoCompanero, registrarApertura, type Consejo } from '../services/companero'
import { anotarVista, cambioVisibilidad } from '../services/ninjas'
import { temaActivo } from '../temas/temas'
import { useAnimacionActual } from './animaciones/motor'
import { movimientoReducido } from './componentes'
import { useDatos, useTic, useVersion } from './estado'

const hoja = () => `${import.meta.env.BASE_URL}${temaActivo().sprite}`
const CELDA = { w: 48, h: 35 }
const COLUMNAS = 16
const FILAS = 13
const CAMINAR = { desde: 0, n: 48 }
const FRENAR = { desde: 48, n: 55 }
const QUIETO = { desde: 103, n: 105 }
const PASO = 0.3348
const FRENO_AVANCE = 5.8
const FPS_CAMINAR = 24 * 1.4
const FPS_QUIETO = 12
const MARGEN = 10
/** Cuánto dura el globo si no lo tocan. */
const GLOBO_MS = 6000

type Globo = { texto: string; accion?: Consejo['accion'] }

function pintar(el: HTMLDivElement | null, cuadro: number) {
  if (!el) return
  const c = Math.max(0, cuadro)
  el.style.backgroundPosition = `${-(c % COLUMNAS) * CELDA.w}px ${-Math.floor(c / COLUMNAS) * CELDA.h}px`
}

/** Dónde va según la pantalla: pasea en Hoy, quieto en una esquina en Calendario, Comida y Más; en el resto no está. */
function lugarDe(ruta: string): 'pasea' | 'esquina' | null {
  if (ruta === '/') return 'pasea'
  if (ruta === '/calendario' || ruta.startsWith('/calendario/') || ruta === '/comida' || ruta.startsWith('/comida/') || ruta === '/mas' || ruta.startsWith('/mas/')) return 'esquina'
  return null
}

export function Companero({ hoy }: { hoy: string }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const version = useVersion()
  const ajustes = useDatos(() => obtenerAjustes(), [version])
  const anim = useAnimacionActual()
  const tic = useTic(60_000)
  const reducido = movimientoReducido()
  const [globo, setGlobo] = useState<Globo | null>(null)
  const [hablando, setHablando] = useState(false)
  const [x, setX] = useState(MARGEN)
  const caja = useRef<HTMLDivElement>(null)
  const capa = useRef<HTMLDivElement>(null)
  const diasSinAbrir = useRef<number | null>(null)
  if (diasSinAbrir.current === null) diasSinAbrir.current = registrarApertura(hoy)
  const datos = useDatos(() => datosConsejo(hoy, diasSinAbrir.current ?? 0), [hoy, version, tic])

  // Última vez a la vista (para el tajo al volver después de horas).
  useEffect(() => {
    anotarVista()
    const al = () => cambioVisibilidad(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', al)
    window.addEventListener('pagehide', al)
    return () => { document.removeEventListener('visibilitychange', al); window.removeEventListener('pagehide', al) }
  }, [tic])

  const modo = ajustes.datos?.companero ?? 'pasea'
  const lugar = lugarDe(pathname)
  const visible = modo !== 'apagado' && lugar !== null
  const pasea = visible && lugar === 'pasea' && modo === 'pasea' && !reducido && !hablando

  // Habla solo: al abrir (una vez por día) y cuando se dispara un consejo. Nunca con una animación en pantalla.
  useEffect(() => {
    if (!visible || anim || globo || !datos.datos || !ajustes.datos) return
    const e = estadoCompanero(hoy)
    const consejo = elegirConsejo(datos.datos, e.consejos)
    if (consejo) {
      guardarEstadoCompanero({ ...e, consejos: [...e.consejos, consejo.clave], hablo: true })
      const id = window.setTimeout(() => decir({ texto: consejo.texto, accion: consejo.accion }), 1200)
      return () => window.clearTimeout(id)
    }
    if (!e.hablo) {
      const f = fraseSuelta(frasesCompanero(ajustes.datos), e.frases)
      guardarEstadoCompanero({ ...e, frases: [...e.frases, f.indice], hablo: true })
      const id = window.setTimeout(() => decir({ texto: f.texto }), 1500)
      return () => window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anim, datos.datos, ajustes.datos, hoy])

  const decir = (g: Globo) => { setGlobo(g); setHablando(true) }
  const callar = () => { setGlobo(null); setHablando(false) }
  useEffect(() => {
    if (!globo) return
    const id = window.setTimeout(callar, GLOBO_MS)
    return () => window.clearTimeout(id)
  }, [globo])
  useEffect(() => { if (anim) callar() }, [anim])

  /** Un toque: se frena y dice lo más útil (o una frase). Otro toque lo cierra. */
  const tocar = () => {
    if (globo) return callar()
    const a = ajustes.datos
    if (!a) return
    const consejo = datos.datos ? elegirConsejo(datos.datos, [], true) : null
    if (consejo) return decir({ texto: consejo.texto, accion: consejo.accion })
    const e = estadoCompanero(hoy)
    const f = fraseSuelta(frasesCompanero(a), e.frases)
    guardarEstadoCompanero({ ...e, frases: [...e.frases, f.indice] })
    decir({ texto: f.texto })
  }

  // El paseo: camina hasta un punto al azar, frena, respira un rato y vuelve a salir.
  useEffect(() => {
    const el = caja.current
    const c = capa.current
    if (!el || !c || !visible) return
    let pos = lugar === 'esquina' ? -1 : x
    let dir: 1 | -1 = 1
    let estado: 'quieto' | 'caminar' | 'frenar' = 'quieto'
    let f = 0
    let tQuieto = 0
    let pausa = 1.5 + Math.random() * 2
    let objetivo = 0
    let id = 0
    let antes = performance.now()
    const ancho = () => Math.max(120, (el.parentElement?.clientWidth ?? window.innerWidth))
    if (pos < 0) pos = ancho() - CELDA.w - MARGEN
    const ubicar = () => {
      el.style.transform = `translateX(${pos}px)`
      c.style.transform = dir < 0 ? 'scaleX(-1)' : ''
      setX(pos)
    }
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      if (estado === 'quieto') {
        tQuieto += dt
        pintar(c, QUIETO.desde + (reducido ? 0 : Math.floor(tQuieto * FPS_QUIETO) % QUIETO.n))
        if (pasea && tQuieto > pausa) {
          const w = ancho()
          const min = MARGEN
          const max = w - CELDA.w - MARGEN
          let destino = min + Math.random() * (max - min)
          if (Math.abs(destino - pos) < 60) destino = pos < (min + max) / 2 ? max : min
          objetivo = destino
          dir = destino > pos ? 1 : -1
          estado = 'caminar'
          f = 0
        }
      } else if (estado === 'caminar') {
        const avance = dt * FPS_CAMINAR
        f += avance
        pos += dir * PASO * avance
        pintar(c, CAMINAR.desde + (Math.floor(f) % CAMINAR.n))
        if (!pasea || (dir > 0 ? pos >= objetivo - FRENO_AVANCE : pos <= objetivo + FRENO_AVANCE)) { estado = 'frenar'; f = 0 }
      } else {
        f += dt * FPS_CAMINAR
        pintar(c, FRENAR.desde + Math.min(FRENAR.n - 1, Math.floor(f)))
        if (f >= FRENAR.n) { pos += dir * FRENO_AVANCE; estado = 'quieto'; tQuieto = 0; pausa = 2 + Math.random() * 5 }
      }
      ubicar()
      id = requestAnimationFrame(cuadro)
    }
    const arrancar = () => { cancelAnimationFrame(id); antes = performance.now(); id = requestAnimationFrame(cuadro) }
    const alCambiar = () => (document.visibilityState === 'visible' ? arrancar() : cancelAnimationFrame(id))
    arrancar()
    document.addEventListener('visibilitychange', alCambiar)
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', alCambiar) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lugar, pasea, reducido])

  if (!visible) return null
  const estilo = { backgroundImage: `url(${hoja()})`, backgroundSize: `${COLUMNAS * CELDA.w}px ${FILAS * CELDA.h}px`, width: CELDA.w, height: CELDA.h }
  const anchoGlobo = 220
  const izqGlobo = Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 390) - anchoGlobo - 8, x + CELDA.w / 2 - anchoGlobo / 2))
  return (
    <div className="companero" aria-hidden={!globo}>
      {globo && (
        <div className="companero-globo" style={{ left: izqGlobo, width: anchoGlobo }} role="status" onClick={callar}>
          <span>{globo.texto}</span>
          {globo.accion && <button type="button" className="boton chico primario" onClick={(e) => { e.stopPropagation(); callar(); navegar(globo.accion!.ruta) }}>{globo.accion.etiqueta}</button>}
        </div>
      )}
      <div ref={caja} className="companero-caja" style={{ transform: `translateX(${x}px)` }}>
        <button type="button" className="companero-boton" aria-label={globo ? 'Cerrar lo que dice el compañero' : 'Tocar al compañero'} onClick={tocar}>
          <div ref={capa} className="shinobi-capa" style={estilo} />
        </button>
      </div>
    </div>
  )
}
