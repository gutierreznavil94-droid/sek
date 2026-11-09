/**
 * El compañero del tema: el shinobi chiquito que vive en el borde de abajo de Hoy y queda quieto en una
 * esquina en Calendario, Comida y Más. Nunca en Progreso ni dentro del entreno.
 * En Hoy tiene una rutina (companero/rutina.ts): camina, corre, salta a los botones y tarjetas, se sienta,
 * cae y rueda, voltereta, se estira, alerta. Tocarlo: se frena, mira al frente y habla con un globo a pincel
 * que lo sigue. Otro toque lo cierra.
 */
import { CompaneroDormido } from './animaciones/Siluetas'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { obtenerAjustes } from '../services/base'
import { datosConsejo, elegirConsejo, estadoCompanero, fraseSuelta, frasesCompanero, guardarEstadoCompanero, registrarApertura, type Consejo } from '../services/companero'
import { anotarVista, cambioVisibilidad } from '../services/ninjas'
import { temaActivo, urlTema } from '../temas/temas'
import { useAnimacionActual } from './animaciones/motor'
import { useRivalActivo } from './Rival'
import { alEvento, type EventoTema } from '../temas/eventos'
import { HOJA_BASE, apoyoEn, arcoSalto, caida, clipPara, duracionDe, elegirMovimiento, escalonCercano, SALTO, type Escalon, type Hoja, type Movimiento } from './companero/rutina'
import { movimientoReducido } from './componentes'
import { useDatos, useTic, useVersion } from './estado'

const hoja = () => urlTema(temaActivo().sprite)
const hojaJson = () => hoja().replace(/\.webp$/, '.json')
const MARGEN = 10
/** Cuánto dura el globo si no lo tocan. */
const GLOBO_MS = 6000
const ANCHO_GLOBO = 220
/** Alto del lienzo de la punta del globo (px desde el piso). */
const ALTO_PUNTA = 420
/** Qué cosas de Hoy sirven de escalón (su borde de arriba). */
const ESCALONES = 'main .pilar-tarjeta, main .co-tarjeta, main .agua-tarjeta, main .boton, main .contador-boton, main .tarjeta'

type Globo = { texto: string; accion?: Consejo['accion'] }

export function Companero({ hoy }: { hoy: string }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const version = useVersion()
  const ajustes = useDatos(() => obtenerAjustes(), [version])
  const anim = useAnimacionActual()
  const rivalActivo = useRivalActivo()
  const tic = useTic(60_000)
  const reducido = movimientoReducido()
  const [globo, setGlobo] = useState<Globo | null>(null)
  const [saliendo, setSaliendo] = useState(false)
  const [hablando, setHablando] = useState(false)
  const [hojaDatos, setHojaDatos] = useState<Hoja>(HOJA_BASE)
  const caja = useRef<HTMLDivElement>(null)
  const capa = useRef<HTMLDivElement>(null)
  const globoEl = useRef<HTMLDivElement>(null)
  const punta = useRef<SVGPathElement>(null)
  const hojaRef = useRef<Hoja>(HOJA_BASE)
  /** Posición y altura (sobre el piso) del muñeco: sobreviven a los reinicios del bucle. */
  const cuerpo = useRef({ x: MARGEN, y: 0, dir: 1 as 1 | -1 })
  const globoPos = useRef({ x: MARGEN, y: 0 })
  const diasSinAbrir = useRef<number | null>(null)
  if (diasSinAbrir.current === null) diasSinAbrir.current = registrarApertura(hoy)
  const datos = useDatos(() => datosConsejo(hoy, diasSinAbrir.current ?? 0), [hoy, version, tic])

  // La hoja de sprites: qué clips hay. Si llega un clip nuevo (correr, sentado…), el estado lo usa solo.
  useEffect(() => {
    let vivo = true
    fetch(hojaJson()).then((r) => (r.ok ? r.json() : null)).then((h: Hoja | null) => {
      if (vivo && h && h.clips && h.celda) { hojaRef.current = h; setHojaDatos(h) }
    }).catch(() => { /* queda la hoja base */ })
    return () => { vivo = false }
  }, [])

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
  // Después de «Dejo celu» (Hoy lo anota) el compañero no se pasea: duerme en su cama en una esquina.
  const [, refrescar] = useState(0)
  useEffect(() => {
    const f = () => refrescar((x) => x + 1)
    window.addEventListener('companero-cambio', f)
    return () => window.removeEventListener('companero-cambio', f)
  }, [])
  const dormido = companeroDormido()
  // Con el rival escurridizo en pantalla, el shinobi que se ve es el que persigue (Rival.tsx).
  const visible = modo !== 'apagado' && lugar !== null && !dormido && !rivalActivo
  const pasea = visible && lugar === 'pasea' && modo === 'pasea' && !reducido && !hablando && !anim

  // Habla solo: al abrir (una vez por día) y cuando se dispara un consejo. Nunca con una animación en pantalla.
  useEffect(() => {
    if (!visible || anim || globo || !datos.datos || !ajustes.datos) return
    const e = estadoCompanero(hoy)
    const consejo = elegirConsejo(datos.datos, e.consejos)
    if (consejo) {
      guardarEstadoCompanero({ ...e, consejos: [...e.consejos, consejo.clave], hablo: true })
      const id = cuandoLibre(() => decir({ texto: consejo.texto, accion: consejo.accion }), 1200)
      return () => id.cancelar()
    }
    if (!e.hablo) {
      const f = fraseSuelta(frasesCompanero(ajustes.datos), e.frases)
      guardarEstadoCompanero({ ...e, frases: [...e.frases, f.indice], hablo: true })
      const id = cuandoLibre(() => decir({ texto: f.texto }), 1500)
      return () => id.cancelar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anim, datos.datos, ajustes.datos, hoy])

  const decir = (g: Globo) => { setSaliendo(false); setGlobo(g); setHablando(true) }
  /** Se va con un desvanecido a tinta y recién después desaparece. */
  const callar = () => {
    setSaliendo(true)
    window.setTimeout(() => { setGlobo(null); setSaliendo(false); setHablando(false) }, 260)
  }
  useEffect(() => {
    if (!globo) return
    const id = window.setTimeout(callar, GLOBO_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globo])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (anim && globo) callar() }, [anim])

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

  // La rutina: un bucle por cuadro que mueve al muñeco, pinta el clip y lleva el globo detrás.
  useEffect(() => {
    const el = caja.current
    const c = capa.current
    if (!el || !c || !visible) return
    const [W_CELDA, H_CELDA] = hojaRef.current.celda
    const ancho = () => Math.max(120, (el.parentElement?.clientWidth ?? window.innerWidth))
    const b = cuerpo.current
    if (lugar === 'esquina') { b.x = ancho() - W_CELDA - MARGEN; b.y = 0 }
    let arrancaEnElAire = b.y > 0
    let mov: Movimiento | 'frenar' = 'quieto'
    let anterior: Movimiento = 'quieto'
    let f = 0
    let t = 0
    let dur = 1.5 + Math.random() * 2
    let objetivo = 0
    let salto = { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 0 } }
    let escalon: Escalon | null = null
    let giro = 0
    let id = 0
    let antes = performance.now()

    const pintar = (nombre: string, cuadro: number, unaVez = false) => {
      const h = hojaRef.current
      const clip = h.clips[nombre] ?? HOJA_BASE.clips.quieto
      const n = unaVez ? Math.min(clip.n - 1, Math.floor(cuadro)) : Math.floor(cuadro) % clip.n
      const i = clip.desde + Math.max(0, n)
      c.style.backgroundPosition = `${-(i % h.columnas) * h.celda[0]}px ${-Math.floor(i / h.columnas) * h.celda[1]}px`
    }
    /** Los escalones de Hoy ahora mismo, en coordenadas del piso del compañero. */
    const escalones = (): Escalon[] => {
      const base = el.parentElement?.getBoundingClientRect()
      if (!base) return []
      const lista: Escalon[] = []
      for (const e of document.querySelectorAll(ESCALONES)) {
        const r = e.getBoundingClientRect()
        if (r.width < 20 || r.top < 0) continue
        lista.push({ izq: r.left - base.left, der: r.right - base.left, alto: base.bottom - r.top, el: e })
      }
      return lista
    }
    const altoDe = (e: Escalon): number => {
      const base = el.parentElement?.getBoundingClientRect()
      if (!base || !e.el) return e.alto
      return base.bottom - e.el.getBoundingClientRect().top
    }
    const quedarse = (m: Movimiento) => { mov = m; t = 0; f = 0; dur = duracionDe(m) }
    const caminarHasta = (m: 'caminar' | 'correr', minDist: number) => {
      const w = ancho()
      const min = MARGEN
      const max = w - W_CELDA - MARGEN
      let destino = min + Math.random() * (max - min)
      if (Math.abs(destino - b.x) < minDist) destino = b.x < (min + max) / 2 ? max : min
      objetivo = destino
      b.dir = destino > b.x ? 1 : -1
      mov = m; f = 0; t = 0
    }
    const bajar = () => {
      salto = { desde: { x: b.x, y: b.y }, hasta: { x: b.x, y: 0 } }
      escalon = null
      b.dir = b.x < ancho() / 2 ? 1 : -1
      mov = 'caerRodar'; t = 0; f = 0; giro = 0
    }
    /** Elige qué hacer ahora. Si no pasea (habla, quieto, reducir movimiento), se queda parado. */
    const siguiente = () => {
      if (mov !== 'frenar') anterior = mov
      if (!pasea) { quedarse(escalon ? 'enEscalon' : 'quieto'); dur = Infinity; return }
      const lista = escalones()
      const cerca = escalonCercano(lista, b.x, W_CELDA)
      const m = elegirMovimiento({ enEscalon: escalon !== null, hayEscalon: cerca !== null, anterior })
      if (m === 'caminar') return caminarHasta('caminar', 60)
      if (m === 'correr') return caminarHasta('correr', 140)
      if (m === 'saltar' && cerca) {
        const x1 = apoyoEn(cerca, b.x, W_CELDA)
        salto = { desde: { x: b.x, y: b.y }, hasta: { x: x1, y: cerca.alto } }
        escalon = cerca
        if (Math.abs(x1 - b.x) > 4) b.dir = x1 > b.x ? 1 : -1
        mov = 'saltar'; t = 0; f = 0
        return
      }
      if (m === 'caerRodar') return bajar()
      if (m === 'voltereta' || m === 'saltoGiro') { giro = 0; quedarse(m); return }
      quedarse(m)
    }
    const ubicar = () => {
      const bajar = mov !== 'frenar' ? (clipPara(hojaRef.current, mov).propio ? clipPara(hojaRef.current, mov).clip.bajar ?? 0 : 0) : 0
      el.style.transform = `translate(${b.x}px, ${-(b.y - bajar)}px)`
      c.style.transform = `${b.dir < 0 ? 'scaleX(-1) ' : ''}${giro ? `rotate(${giro}deg)` : ''}`
    }
    /** El globo se ancla arriba del muñeco (hacia el centro de la pantalla) y lo sigue suave; la punta va a la cabeza. */
    const llevarGlobo = (dt: number) => {
      const g = globoEl.current
      const p = punta.current
      if (!g) return
      const w = ancho()
      const gx1 = Math.max(8, Math.min(w - ANCHO_GLOBO - 8, b.x + W_CELDA / 2 - ANCHO_GLOBO / 2))
      const gy1 = b.y + H_CELDA + 30
      const k = 1 - Math.exp(-dt / 0.12)
      const gp = globoPos.current
      gp.x += (gx1 - gp.x) * k
      gp.y += (gy1 - gp.y) * k
      g.style.transform = `translate(${gp.x}px, ${-gp.y}px)`
      if (!p) return
      const cabezaX = b.x + W_CELDA / 2 + b.dir * 2
      const cabezaY = b.y + H_CELDA - 6
      const baseX = Math.max(gp.x + 22, Math.min(gp.x + ANCHO_GLOBO - 22, cabezaX))
      const baseY = gp.y - 1.5
      const Y = (y: number) => ALTO_PUNTA - y
      const lado = cabezaX < baseX ? -1 : 1
      p.setAttribute('d', `M ${baseX - 10} ${Y(baseY)} Q ${baseX - 8 + lado * 9} ${Y((baseY + cabezaY) / 2 + 4)} ${cabezaX} ${Y(cabezaY)} Q ${baseX + 9 + lado * 9} ${Y((baseY + cabezaY) / 2 - 2)} ${baseX + 10} ${Y(baseY)} Z`)
    }

    const cuadro = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      const h = hojaRef.current
      const propio = (m: Movimiento) => clipPara(h, m)
      if (mov === 'quieto' || mov === 'enEscalon' || mov === 'sentado' || mov === 'estirarse' || mov === 'alerta') {
        t += dt
        const { nombre, clip, propio: suyo } = propio(mov)
        pintar(nombre, reducido ? 0 : t * (clip.fps ?? 12), clip.unaVez ?? (suyo && (mov === 'estirarse' || mov === 'alerta')))
        if (suyo && clip.unaVez && dur !== Infinity && dur < clip.n / (clip.fps ?? 12) + 1) dur = clip.n / (clip.fps ?? 12) + 1
        if (escalon) {
          const alto = altoDe(escalon)
          if (alto < SALTO.altoMin || alto > SALTO.altoMax) bajar(); else b.y = alto
        }
        if (pasea && t > dur) siguiente()
        else if (!pasea && dur !== Infinity && t > dur) siguiente()
      } else if (mov === 'caminar' || mov === 'correr') {
        const { nombre, clip } = propio(mov)
        const fps = clip.fps ?? 33.6
        const vel = mov === 'correr' ? (propio('correr').propio ? 3.2 : 2.1) : 1
        f += dt * fps * vel
        b.x += b.dir * h.pasoCuadro * dt * fps * vel
        pintar(nombre, f)
        if (!pasea || (b.dir > 0 ? b.x >= objetivo - h.frenoAvance : b.x <= objetivo + h.frenoAvance)) { mov = 'frenar'; f = 0 }
      } else if (mov === 'frenar') {
        const clip = h.clips.frenar
        f += dt * (clip.fps ?? 33.6)
        pintar('frenar', f, true)
        if (f >= clip.n) { b.x += b.dir * h.frenoAvance; quedarse('quieto'); siguiente() }
      } else if (mov === 'saltar') {
        t += dt
        const { nombre, clip, propio: suyo } = propio('saltar')
        // Con el clip de Luma: se agacha, salta (solo en el tramo «aire» se mueve) y aterriza; sin clip, un arco corto.
        const total = suyo ? clip.n / (clip.fps ?? 24) : SALTO.duracion
        const k = Math.min(1, t / total)
        const [a0, a1] = suyo && clip.aire ? clip.aire : [0, 1]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        b.x = salto.desde.x + (salto.hasta.x - salto.desde.x) * kk
        b.y = arcoSalto(kk, salto.desde.y, salto.hasta.y)
        pintar(nombre, suyo ? k * clip.n : 0, suyo)
        if (k >= 1) { b.x = salto.hasta.x; b.y = salto.hasta.y; quedarse('enEscalon') }
      } else if (mov === 'caerRodar' && propio('caerRodar').propio) {
        // Con el clip de Luma: cae en el tramo «aire», aterriza en cuclillas, se para y se acomoda el sombrero.
        t += dt
        const { nombre, clip } = propio('caerRodar')
        const total = clip.n / (clip.fps ?? 24)
        const k = Math.min(1, t / total)
        const [a0, a1] = clip.aire ?? [0, 0.3]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        b.y = caida(kk, salto.desde.y)
        if (k > a0 && k < a1) b.x = Math.max(MARGEN, Math.min(ancho() - W_CELDA - MARGEN, b.x + b.dir * 24 * dt))
        pintar(nombre, k * clip.n, true)
        if (k >= 1) { b.y = 0; quedarse('quieto') }
      } else if (mov === 'caerRodar') {
        t += dt
        const { nombre, clip, propio: suyo } = propio('caerRodar')
        if (t < 0.42) {
          b.y = caida(t / 0.42, salto.desde.y)
          b.x += b.dir * 30 * dt
          pintar(nombre, suyo ? (t / 0.95) * clip.n : 0, suyo)
        } else if (t < 0.95) {
          b.y = 0
          b.x = Math.max(MARGEN, Math.min(ancho() - W_CELDA - MARGEN, b.x + b.dir * 110 * dt))
          if (!suyo) giro = b.dir * ((t - 0.42) / 0.53) * 360
          pintar(nombre, suyo ? (t / 0.95) * clip.n : f += dt * 40, suyo)
        } else { giro = 0; b.y = 0; quedarse('quieto') }
      } else if (mov === 'voltereta' || mov === 'saltoGiro') {
        // Festejo: voltereta (logro) o salto con giro (completar). Con el clip del tema, solo se eleva en su tramo «aire».
        t += dt
        const { nombre, clip, propio: suyo } = propio(mov)
        const total = suyo ? clip.n / (clip.fps ?? 24) : 0.7
        const k = Math.min(1, t / total)
        const [a0, a1] = suyo && clip.aire ? clip.aire : [0, 1]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        const y0 = escalon ? altoDe(escalon) : 0
        b.y = kk > 0 && kk < 1 ? arcoSalto(kk, y0, y0) : y0
        if (mov === 'voltereta' && kk > 0 && kk < 1) b.x = Math.max(MARGEN, Math.min(ancho() - W_CELDA - MARGEN, b.x - b.dir * 40 * dt))
        if (!suyo) giro = (mov === 'voltereta' ? -b.dir : b.dir) * k * 360
        pintar(nombre, suyo ? k * clip.n : 0, suyo)
        if (k >= 1) { giro = 0; b.y = y0; quedarse(escalon ? 'enEscalon' : 'quieto') }
      }
      ubicar()
      llevarGlobo(dt)
      id = requestAnimationFrame(cuadro)
    }
    const arrancar = () => { cancelAnimationFrame(id); antes = performance.now(); id = requestAnimationFrame(cuadro) }
    // Para probar a mano desde la consola: __companero('saltar') fuerza un movimiento.
    ;(window as unknown as { __companero?: (m: Movimiento) => void }).__companero = (m) => {
      if (m === 'saltar') { const e = escalonCercano(escalones(), b.x, W_CELDA); if (!e) return; const x1 = apoyoEn(e, b.x, W_CELDA); salto = { desde: { x: b.x, y: b.y }, hasta: { x: x1, y: e.alto } }; escalon = e; b.dir = x1 >= b.x ? 1 : -1; mov = 'saltar'; t = 0; f = 0; return }
      if (m === 'caminar' || m === 'correr') return caminarHasta(m, m === 'correr' ? 140 : 60)
      if (m === 'caerRodar') return bajar()
      giro = 0; quedarse(m)
    }
    // Eventos genéricos de SEK: el tema decide el gesto. Completar → salto con giro; logro → voltereta; alerta → desenvaina.
    const GESTO: Partial<Record<EventoTema, Movimiento>> = { completar: 'saltoGiro', logro: 'voltereta', alerta: 'alerta', aparecer: 'alerta' }
    const dejarEventos = alEvento((e) => {
      const m = GESTO[e]
      if (!m || reducido || mov === 'saltar' || mov === 'caerRodar') return
      giro = 0
      quedarse(m)
      if (!pasea) dur = Math.max(dur, 2.5)
    })
    const alCambiar = () => (document.visibilityState === 'visible' ? arrancar() : cancelAnimationFrame(id))
    // Si deja de pasear a mitad de algo que no se mueve, se queda; lo que se mueve termina y recién ahí se queda.
    if (!pasea) { quedarse(escalon ? 'enEscalon' : 'quieto'); dur = Infinity }
    // Si el bucle arranca con el muñeco en el aire (cambió algo a mitad de un salto): si hay escalón abajo se para ahí, si no cae.
    if (arrancaEnElAire) {
      arrancaEnElAire = false
      const abajo = escalones().find((e) => Math.abs(e.alto - b.y) < 8 && b.x + W_CELDA / 2 >= e.izq && b.x + W_CELDA / 2 <= e.der)
      if (abajo) { escalon = abajo; b.y = abajo.alto; quedarse('enEscalon'); if (!pasea) dur = Infinity } else bajar()
    }
    ubicar()
    arrancar()
    document.addEventListener('visibilitychange', alCambiar)
    return () => { cancelAnimationFrame(id); dejarEventos(); document.removeEventListener('visibilitychange', alCambiar) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lugar, pasea, reducido])

  // Dormido: no flota encima de nada. En Hoy la cama va abajo de todo, dentro de la página (ver CamaDelCompanero).
  if (dormido) return null
  // Tema subido sin hoja de sprites: no hay compañero que camine.
  if (!temaActivo().sprite) return null
  if (!visible) return null
  const [cw, ch] = hojaDatos.celda
  const estilo = { backgroundImage: `url(${hoja()})`, backgroundSize: `${hojaDatos.columnas * cw}px ${hojaDatos.filas * ch}px`, width: cw, height: ch }
  const gp = globoPos.current
  return (
    <div className="companero" aria-hidden={!globo}>
      <svg className="companero-filtro" width="0" height="0" aria-hidden>
        <filter id="globo-pincel" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {globo && (
        <>
          <svg className={`companero-punta ${saliendo ? 'saliendo' : ''}`} width="100%" height={ALTO_PUNTA} aria-hidden>
            <path ref={punta} d="" />
          </svg>
          <div ref={globoEl} className={`companero-globo ${saliendo ? 'saliendo' : ''}`} style={{ width: ANCHO_GLOBO, transform: `translate(${gp.x}px, ${-gp.y}px)` }} role="status" onClick={callar}>
            <span>{globo.texto}</span>
            {globo.accion && <button type="button" className="boton chico primario" onClick={(e) => { e.stopPropagation(); callar(); navegar(globo.accion!.ruta) }}>{globo.accion.etiqueta}</button>}
          </div>
        </>
      )}
      <div ref={caja} className="companero-caja" style={{ width: cw, height: ch }}>
        <button type="button" className="companero-boton" style={{ width: cw, height: ch }} aria-label={globo ? 'Cerrar lo que dice el compañero' : 'Tocar al compañero'} onClick={tocar}>
          <div ref={capa} className="shinobi-capa" style={estilo} />
        </button>
      </div>
    </div>
  )
}

/** ¿Está durmiendo? Hoy guarda la noche al tocar «Dejo celu» y la borra al deshacer o al día siguiente. */
export function companeroDormido(): boolean {
  try { return !!localStorage.getItem('companero-dormido') } catch { return false }
}

/** Espera `ms` y llama; si justo está el tajo en pantalla, espera 5 s más (no habla encima del corte). */
function cuandoLibre(fn: () => void, ms: number): { cancelar: () => void } {
  let id = 0
  const intentar = () => { if (document.querySelector('.tajo')) { id = window.setTimeout(intentar, 5000); return } fn() }
  id = window.setTimeout(intentar, ms)
  return { cancelar: () => window.clearTimeout(id) }
}

/** Dónde va según la pantalla: pasea en Hoy, quieto en una esquina en Calendario, Comida y Más; en el resto no está. */
function lugarDe(ruta: string): 'pasea' | 'esquina' | null {
  if (ruta === '/') return 'pasea'
  if (ruta === '/calendario' || ruta.startsWith('/calendario/') || ruta === '/comida' || ruta.startsWith('/comida/') || ruta === '/mas' || ruta.startsWith('/mas/')) return 'esquina'
  return null
}

/** La cama del compañero, al final de Hoy: ocupa su propio lugar después de la última tarjeta y nunca tapa nada. */
export function CamaDelCompanero({ dormido, modo }: { dormido: boolean; modo?: string }) {
  if ((modo ?? 'pasea') === 'apagado' || !dormido) return null
  return <div className="companero-cama-lugar" aria-hidden><CompaneroDormido /></div>
}
