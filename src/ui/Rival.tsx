/**
 * El rival escurridizo: un muñequito gris con el nombre de la distracción que se pasea por el borde de abajo de Hoy
 * (como el compañero, sin tapar nada). Tocarlo: el shinobi corre y salta hacia él; según el sorteo se escabulle 0, 1 o 2
 * veces; al atraparlo, destello gris y arranca la batalla. Ignorado 60 s (o cerrar la app): advertencia que rompe la
 * pantalla (10 s, botón «¡Atraparlo!») y después el robo (la bolita de XP sale del pecho y se la lleva corriendo).
 * Se pide con `pedirRival(pelea)`. Con un tema con escenas (Shinobi) el rival es la hoja de sprites del tema: se asoma
 * desde el borde con un «?», corre, salta, desenvaina al ser atrapado y roba la bolita. Sin escenas, la silueta gris de siempre.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import type { Pelea } from '../services/ninjas'
import { prepararBatalla } from '../services/batalla'
import { TIEMPO_ADVERTENCIA_MS, TIEMPO_IGNORADO_MS, guardarRivalPendiente, limpiarRivalPendiente, peleaPendiente, robarXp, rivalPendiente, sortearEscapes } from '../services/rival'
import { ahora } from '../services/reloj'
import { carpetaEscenas, temaActivo } from '../temas/temas'
import { emitirEvento } from '../temas/eventos'
import { BolitaDorada, HOJA_RIVAL, Pregunta, SpriteClip, useHoja } from '../temas/shinobi/Escenas'
import { Enemigo } from './animaciones/Escena'
import { sonarChoque, sonarTaiko } from './animaciones/motor'
import { HOJA_BASE, type Hoja } from './companero/rutina'
import { movimientoReducido } from './componentes'
import { pedirBatalla } from './Batalla'
import { pedirPelea } from './Ninja'
import { avisar, mutar } from './estado'

export type Fase = 'paseo' | 'corre' | 'salta' | 'esquiva' | 'atrapado' | 'advertencia' | 'robo'
type Rival = { pelea: Pelea; escapes: number; faseInicial: Fase }

let pendiente: Rival | null = null
const oyentes = new Set<() => void>()
function avisarOyentes() { for (const o of oyentes) o() }

/** Pide el rival (uno a la vez). `azar` fija el sorteo (pruebas). */
export function pedirRival(p: Pelea, azar: () => number = Math.random, faseInicial: Fase = 'paseo'): boolean {
  if (pendiente) return false
  // Quedó un rival de una sesión anterior (se cerró la app con él en pantalla): primero su advertencia; el nuevo espera.
  const viejo = faseInicial === 'paseo' ? rivalPendiente() : null
  if (viejo && viejo.desde < ahora() - 5000) {
    void peleaPendiente().then((v) => { if (v && !pendiente) { pendiente = { pelea: v, escapes: 0, faseInicial: 'advertencia' }; avisarOyentes() } })
    return false
  }
  pendiente = { pelea: p, escapes: sortearEscapes(azar), faseInicial }
  if (faseInicial !== 'advertencia') guardarRivalPendiente(p)
  avisarOyentes()
  return true
}
export function hayRival(): boolean { return pendiente !== null }
/** Saca al rival de pantalla sin anotar nada (pruebas). */
export function descartarRival(): void { if (pendiente) cerrarRival() }
function cerrarRival() { pendiente = null; limpiarRivalPendiente(); avisarOyentes() }
function useRival(): Rival | null {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pendiente, () => pendiente)
}
/** Para el compañero: mientras el rival está en pantalla, el shinobi es el que persigue. */
export function useRivalActivo(): boolean { return useRival() !== null }

/** Tiempos (ms) de cada tramo; las pruebas los acortan. */
export const TIEMPOS = { carreraPxPorSeg: 240, salto: 620, esquiva: 420, destello: 650, robo: 2600, pausaPaseo: [1200, 2800] as [number, number], ignorado: TIEMPO_IGNORADO_MS, advertencia: TIEMPO_ADVERTENCIA_MS }

const MARGEN = 10
const ANCHO_RIVAL = 40
const ALTO_RIVAL = 42

const hoja = () => `${import.meta.env.BASE_URL}${temaActivo().sprite}`

/** Capa fija del rival. Vive en App; el muñeco solo se ve en Hoy, la advertencia y el robo en cualquier pantalla. */
export function RivalCapa() {
  const rival = useRival()
  const { pathname } = useLocation()
  // Al abrir la app con un rival pendiente (se cerró con el rival en pantalla): directo a la advertencia.
  useEffect(() => {
    if (pendiente || !rivalPendiente()) return
    void peleaPendiente().then((p) => { if (p && !pendiente) pedirRival(p, Math.random, 'advertencia') })
  }, [])
  if (!rival) return null
  return <RivalEnJuego key={rival.pelea.distraccion.id + rival.pelea.fecha} rival={rival} enHoy={pathname === '/'} />
}

function RivalEnJuego({ rival, enHoy }: { rival: Rival; enHoy: boolean }) {
  const { pelea } = rival
  const nombre = pelea.distraccion.nombre
  const reducido = movimientoReducido()
  const [fase, setFase] = useState<Fase>(rival.faseInicial)
  const [escapes, setEscapes] = useState(rival.escapes)
  const [hojaDatos, setHojaDatos] = useState<Hoja>(HOJA_BASE)
  const [ancho, setAncho] = useState(360)
  const [rx, setRx] = useState(260)
  const [rdir, setRdir] = useState<1 | -1>(-1)
  const [rdur, setRdur] = useState(0)
  const [sx, setSx] = useState(MARGEN)
  const [sdir, setSdir] = useState<1 | -1>(1)
  const [sdur, setSdur] = useState(0)
  const capa = useRef<HTMLDivElement>(null)
  const sprite = useRef<HTMLDivElement>(null)
  const faseRef = useRef(fase)
  faseRef.current = fase
  const rxRef = useRef(rx)
  rxRef.current = rx
  const sxRef = useRef(sx)
  sxRef.current = sx
  const temporizadores = useRef<number[]>([])
  const ignorado = useRef(0)
  const terminado = useRef(false)
  // Rival del tema (hoja de sprites): si el tema no trae escenas o la hoja no carga, queda la silueta.
  const hojaRival = useHoja(HOJA_RIVAL)
  const conSprite = !!carpetaEscenas() && !!hojaRival
  const [asomando, setAsomando] = useState(rival.faseInicial === 'paseo')
  const [moviendo, setMoviendo] = useState(false)
  const [brinco, setBrinco] = useState<{ n: number; dur: number; espera: number } | null>(null)
  const [huye, setHuye] = useState(false)
  useEffect(() => { emitirEvento('aparecer'); emitirEvento('alerta') }, [])
  // Se asoma desde un borde: el izquierdo o el derecho de la pantalla, o detrás del costado de un botón o tarjeta (al azar),
  // siempre donde no tape texto ni links. El corte del clip queda justo en ese borde.
  const [ry, setRy] = useState(0)
  const [lado, setLado] = useState<'izq' | 'der'>('der')
  const [colocado, setColocado] = useState(false)
  useEffect(() => {
    if (!conSprite || !asomando || !hojaRival) return
    const corte = hojaRival.clips.asoma?.corte ?? hojaRival.celda[0]
    if (!enHoy) { setColocado(false); return } // todavía no está en Hoy: se elige al llegar
    // Espera a que Hoy termine de dibujarse (las tarjetas llegan un poco después) y recién ahí elige dónde.
    const id = window.setTimeout(() => {
      const el = capa.current
      if (!el) return
      const lugar = elegirAsomo(el, el.clientWidth || ancho)
      const cw = hojaRival.celda[0]
      setRdur(0); setLado(lugar.lado); setRdir(lugar.lado === 'der' ? -1 : 1); setRy(lugar.alto)
      setRx(Math.round(lugar.lado === 'der' ? lugar.x + (cw - ANCHO_RIVAL) / 2 - corte : lugar.x + (cw - ANCHO_RIVAL) / 2 - cw + corte))
      setColocado(true)
    }, 450)
    return () => window.clearTimeout(id)
  }, [conSprite, asomando, ancho, enHoy]) // eslint-disable-line react-hooks/exhaustive-deps
  // Termina de asomarse: baja al piso y empieza el paseo.
  useEffect(() => { if (!asomando && ry !== 0) { setRdur(0.35); setRy(0) } }, [asomando]) // eslint-disable-line react-hooks/exhaustive-deps
  // El cartel siempre dentro de la pantalla.
  const cartel = useRef<HTMLSpanElement>(null)
  const [corrimiento, setCorrimiento] = useState(0)
  useEffect(() => {
    const c = cartel.current
    if (!c) return
    const w = c.offsetWidth
    const centro = rx + ANCHO_RIVAL / 2
    const izq = centro - w / 2
    setCorrimiento(izq < 4 ? 4 - izq : izq + w > ancho - 4 ? ancho - 4 - (izq + w) : 0)
  }, [rx, ancho, nombre])
  // Si la hoja no llega, no espera al «asoma».
  useEffect(() => { if (asomando && !carpetaEscenas()) setAsomando(false) }, [asomando])
  useEffect(() => { if (fase === 'robo') emitirEvento('robo') }, [fase])

  const luego = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); temporizadores.current.push(id); return id }
  useEffect(() => () => { for (const id of temporizadores.current) window.clearTimeout(id); window.clearTimeout(ignorado.current) }, [])

  // Hoja de sprites del shinobi (los clips correr y saltar ya están).
  useEffect(() => {
    let vivo = true
    fetch(hoja().replace(/\.webp$/, '.json')).then((r) => (r.ok ? r.json() : null)).then((h: Hoja | null) => { if (vivo && h && h.clips && h.celda) setHojaDatos(h) }).catch(() => { /* hoja base */ })
    return () => { vivo = false }
  }, [])
  useEffect(() => {
    const medir = () => { const w = capa.current?.clientWidth; if (w) setAncho(w) }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [enHoy])

  // Cuadros del shinobi: quieto mientras espera, correr y saltar en la persecución.
  useEffect(() => {
    const el = sprite.current
    if (!el) return
    const clipNombre = fase === 'corre' ? 'correr' : fase === 'salta' ? 'saltar' : 'quieto'
    const clip = hojaDatos.clips[clipNombre] ?? HOJA_BASE.clips.caminar
    const fps = clip.fps ?? 12
    const t0 = performance.now()
    const pintar = () => {
      const f = Math.floor(((performance.now() - t0) / 1000) * fps)
      const n = fase === 'salta' ? Math.min(clip.n - 1, f) : f % clip.n
      const i = clip.desde + Math.max(0, n)
      el.style.backgroundPosition = `${-(i % hojaDatos.columnas) * hojaDatos.celda[0]}px ${-Math.floor(i / hojaDatos.columnas) * hojaDatos.celda[1]}px`
    }
    pintar()
    const id = window.setInterval(pintar, Math.max(16, 1000 / fps))
    return () => window.clearInterval(id)
  }, [fase, hojaDatos])

  /** Reloj del «ignorado»: 60 s sin atraparlo → advertencia. Se reinicia con cada toque. */
  const armarIgnorado = () => {
    window.clearTimeout(ignorado.current)
    ignorado.current = window.setTimeout(() => { if (faseRef.current !== 'atrapado' && faseRef.current !== 'robo') setFase('advertencia') }, TIEMPOS.ignorado)
  }
  useEffect(() => { if (rival.faseInicial === 'paseo') armarIgnorado() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar la app (o mandarla atrás) con el rival en pantalla: al volver, la advertencia.
  useEffect(() => {
    const al = () => {
      if (document.visibilityState !== 'visible') return
      const f = faseRef.current
      if (f === 'paseo' || f === 'corre' || f === 'salta' || f === 'esquiva') setFase('advertencia')
    }
    document.addEventListener('visibilitychange', al)
    return () => document.removeEventListener('visibilitychange', al)
  }, [])

  // Paseo esquivo: camina a un punto, se frena, mira, vuelve a caminar.
  useEffect(() => {
    if (fase !== 'paseo' || (asomando && conSprite)) return
    let vivo = true
    const paso = () => {
      if (!vivo || faseRef.current !== 'paseo') return
      const tope = Math.max(MARGEN, ancho - MARGEN - ANCHO_RIVAL)
      const destino = Math.round(MARGEN + Math.random() * (tope - MARGEN))
      const dist = Math.abs(destino - rxRef.current)
      setRdir(destino < rxRef.current ? -1 : 1)
      const [a, b] = TIEMPOS.pausaPaseo
      // Con el rival del tema: corre (o, a veces, salta) y en las pausas queda parado.
      const salta = conSprite && !reducido && dist > 60 && dist < 200 && Math.random() < 0.35
      if (salta && hojaRival?.clips.salta) {
        const c = hojaRival.clips.salta
        const total = c.n / ((c.fps ?? 24) * 1.5)
        const [a0, a1] = c.aire ?? [0.3, 0.6]
        setBrinco({ n: Date.now(), dur: (a1 - a0) * total, espera: a0 * total })
        setMoviendo(true)
        luego(() => { setRdur((a1 - a0) * total); setRx(destino) }, a0 * total * 1000)
        luego(() => { setMoviendo(false); setBrinco(null) }, total * 1000)
        luego(paso, total * 1000 + a + Math.random() * (b - a))
        return
      }
      const dur = reducido ? 0 : dist / (conSprite ? 120 : 55)
      setRdur(dur)
      setRx(destino)
      if (conSprite) { setMoviendo(dur > 0); luego(() => setMoviendo(false), dur * 1000) }
      luego(paso, dur * 1000 + a + Math.random() * (b - a))
    }
    const [a] = TIEMPOS.pausaPaseo
    luego(paso, a)
    return () => { vivo = false }
  }, [fase, ancho, reducido, asomando, conSprite]) // eslint-disable-line react-hooks/exhaustive-deps

  // Advertencia: 10 s para atraparlo; si no, el robo.
  useEffect(() => {
    if (fase !== 'advertencia') return
    window.clearTimeout(ignorado.current)
    sonarTaiko()
    const id = luego(() => setFase('robo'), TIEMPOS.advertencia)
    return () => window.clearTimeout(id)
  }, [fase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Robo: la animación y, al final, el descuento.
  useEffect(() => {
    if (fase !== 'robo') return
    const id = luego(async () => {
      if (terminado.current) return
      terminado.current = true
      const r = await mutar(() => robarXp(pelea))
      cerrarRival()
      avisar(r.robado > 0 ? `${nombre} se llevó ${r.robado} XP` : `${nombre} se escapó. No había XP para llevarse.`, { tipo: 'bajo' })
    }, reducido ? 300 : conSprite ? TIEMPOS.robo + 1400 : TIEMPOS.robo)
    return () => window.clearTimeout(id)
  }, [fase]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Arranca la batalla con este rival (o la carta, si la batalla no se puede). */
  const atrapar = async () => {
    if (terminado.current) return
    terminado.current = true
    window.clearTimeout(ignorado.current)
    const r = await prepararBatalla(pelea.fecha, pelea.distraccion)
    cerrarRival()
    if (r.batalla) pedirBatalla(r.batalla)
    else pedirPelea(pelea)
  }

  /** Toque sobre el rival: el shinobi corre, salta y, según el sorteo, lo atrapa o el rival se escabulle. */
  const tocar = () => {
    if (fase !== 'paseo') return
    armarIgnorado()
    const objetivo = rxRef.current
    const desde = sxRef.current
    const dir: 1 | -1 = objetivo >= desde ? 1 : -1
    const llegada = objetivo - dir * 44
    const dist = Math.abs(llegada - desde)
    const durCarrera = reducido ? 0 : dist / TIEMPOS.carreraPxPorSeg
    setRdur(0)
    setRdir(dir === 1 ? -1 : 1)
    setSdir(dir)
    setSdur(durCarrera)
    setSx(llegada)
    setFase('corre')
    luego(() => {
      setFase('salta')
      setSdur(reducido ? 0 : TIEMPOS.salto / 1000)
      setSx(objetivo - dir * 10)
      luego(() => {
        if (escapes > 0) {
          setEscapes(escapes - 1)
          setFase('esquiva')
          const tope = Math.max(MARGEN, ancho - MARGEN - ANCHO_RIVAL)
          const lejos = objetivo > ancho / 2 ? MARGEN + Math.random() * 40 : tope - Math.random() * 40
          setRdir(lejos < objetivo ? -1 : 1)
          setRdur(reducido ? 0 : TIEMPOS.esquiva / 1000)
          setRx(Math.round(lejos))
          luego(() => setFase('paseo'), TIEMPOS.esquiva + 200)
        } else {
          setFase('atrapado')
          sonarChoque()
          try { navigator.vibrate?.(40) } catch { /* sin vibración */ }
          // Con el rival del tema, desenvaina antes de la batalla.
          luego(() => { void atrapar() }, reducido ? 100 : conSprite ? TIEMPOS.destello + 1250 : TIEMPOS.destello)
        }
      }, reducido ? 0 : TIEMPOS.salto)
    }, durCarrera * 1000)
  }

  if (fase === 'advertencia') {
    return (
      <div className="rv-adv" role="dialog" aria-label={`${nombre} está por robarte progreso`}>
        <div className="rv-adv-papel" />
        <div className="rv-adv-rotura" aria-hidden />
        <div className="rv-adv-cuerpo">
          {conSprite && hojaRival
            ? <div className="rv-adv-rival rv-adv-sprite"><SpriteClip hoja={HOJA_RIVAL} datos={hojaRival} clip="desenvaina" mira={-1} reducido={reducido} /></div>
            : <svg className="rv-adv-rival" viewBox="-60 -116 120 124" aria-hidden><g transform="scale(-1,1)"><Enemigo variante="bandido" sinArma /></g></svg>}
          <p className="rv-adv-texto"><b>{nombre}</b> está por robarte progreso</p>
          <button type="button" className="boton grande primario rv-adv-boton" onClick={() => { void atrapar() }}>¡Atraparlo!</button>
          <span className="rv-adv-cuenta" aria-hidden />
        </div>
      </div>
    )
  }
  if (fase === 'robo') {
    return (
      <div className={`rv-robo ${reducido ? 'reducido' : ''}`} role="status" aria-label={`${nombre} se lleva tu XP`}>
        <div className="rv-robo-escena">
          {conSprite && hojaRival ? (
            // Agarra la bolita (clip roba) y sale corriendo con ella (clip corre + la bolita dorada de la app).
            <div className={`rv-robo-sprite ${huye ? 'huye' : ''}`}>
              <SpriteClip hoja={HOJA_RIVAL} datos={hojaRival} clip={huye ? 'corre' : 'roba'} vel={huye ? 1.4 : 1.5} reducido={reducido} onFin={() => setHuye(true)} />
              {huye && <BolitaDorada style={{ left: '58%', top: '52%' }} />}
            </div>
          ) : (
            <div className="rv-robo-rival">
              <svg viewBox="-60 -116 120 124" aria-hidden><g transform="scale(-1,1)"><Enemigo variante="bandido" sinArma /></g></svg>
              <span className="rv-bolita" aria-hidden />
            </div>
          )}
          <span className="rv-cartel rv-cartel-robo">{nombre}</span>
        </div>
      </div>
    )
  }
  if (!enHoy) return null
  const [cw, ch] = hojaDatos.celda
  const estiloSprite = { backgroundImage: `url(${hoja()})`, backgroundSize: `${hojaDatos.columnas * cw}px ${hojaDatos.filas * ch}px`, width: cw, height: ch }
  return (
    <div ref={capa} className={`rival-capa fase-${fase}`} aria-live="polite">
      <div className={`rv-shinobi ${fase}`} style={{ transform: `translateX(${sx}px)`, transition: `transform ${sdur}s ${fase === 'salta' ? 'ease-out' : 'linear'}`, width: cw, height: ch }} aria-hidden>
        <div ref={sprite} className="shinobi-capa rv-sprite" style={{ ...estiloSprite, transform: sdir === -1 ? 'scaleX(-1)' : undefined }} />
      </div>
      <button type="button" className={`rv-rival ${fase}`} style={{ transform: `translate(${rx}px, ${-ry}px)`, transition: `transform ${rdur}s ${fase === 'esquiva' ? 'cubic-bezier(.2,.9,.3,1)' : 'linear'}`, width: ANCHO_RIVAL, height: ALTO_RIVAL + 22, visibility: conSprite && asomando && !colocado ? "hidden" : undefined }} onClick={tocar} aria-label={`Atrapar a ${nombre}`} data-escapes={escapes}>
        <span ref={cartel} className="rv-cartel" style={corrimiento ? { position: "relative", left: corrimiento } : undefined}>{nombre}</span>
        {conSprite && hojaRival && asomando && !colocado ? null : conSprite && hojaRival ? (
          <span className="rv-sprite-rival" style={{ width: hojaRival.celda[0], height: hojaRival.celda[1], marginBottom: -(hojaRival.pies ?? 0), marginTop: -20 }}>
            <span key={brinco?.n ?? 0} className={brinco ? 'rv-brinco' : ''} style={brinco ? { animationDuration: `${brinco.dur}s`, animationDelay: `${brinco.espera}s` } : undefined}>
              <SpriteClip
                hoja={HOJA_RIVAL}
                datos={hojaRival}
                clip={clipDelRival(fase, asomando, moviendo, !!brinco)}
                mira={rdir}
                vel={fase === 'esquiva' ? 2 : fase === 'atrapado' ? 1.6 : brinco ? 1.5 : 1}
                reducido={reducido}
                onFin={asomando ? () => setAsomando(false) : undefined}
              />
            </span>
            {asomando && fase === 'paseo' && <span className={`rv-pregunta ${lado}`}><Pregunta /></span>}
          </span>
        ) : (
          <svg className="rv-silueta" viewBox="-30 -110 60 114" width={ANCHO_RIVAL} height={ALTO_RIVAL} style={{ transform: rdir === 1 ? 'scaleX(-1)' : undefined }} aria-hidden><Enemigo variante="bandido" sinArma /></svg>
        )}
        {fase === 'atrapado' && <span className="rv-destello" aria-hidden />}
      </button>
    </div>
  )
}

/** Qué clip del rival del tema va en cada momento. */
function clipDelRival(fase: Fase, asomando: boolean, moviendo: boolean, brinco: boolean): string {
  if (fase === 'atrapado') return 'desenvaina'
  if (fase === 'esquiva') return 'salta'
  if (fase !== 'paseo') return 'quieto'
  if (asomando) return 'asoma'
  if (brinco) return 'salta'
  return moviendo ? 'corre' : 'quieto'
}

/**
 * Dónde se asoma el rival: borde izquierdo o derecho de la pantalla, o el costado de un botón o tarjeta de Hoy
 * (con los pies a la altura de su borde de abajo). Se prueba en orden al azar y se queda con el primero donde el
 * rival y su cartel no tapan texto ni links. `x`: dónde queda el corte del clip; `alto`: px por encima del piso.
 */
function elegirAsomo(capa: HTMLElement, ancho: number): { x: number; alto: number; lado: 'izq' | 'der' } {
  const base = capa.getBoundingClientRect()
  const piso = base.bottom
  // Bordes de la pantalla a distintas alturas (desde el piso hasta media pantalla) y costados de botones y tarjetas.
  const opciones: { x: number; alto: number; lado: 'izq' | 'der' }[] = []
  for (let alto = 0; alto <= Math.min(420, piso - 160); alto += 10) opciones.push({ x: ancho, alto, lado: 'der' }, { x: 0, alto, lado: 'izq' })
  if (typeof document !== 'undefined') {
    for (const e of document.querySelectorAll('.tarjeta, .boton, .pilar')) {
      const r = e.getBoundingClientRect()
      if (r.width < 60 || r.bottom > piso - 6 || r.bottom < 120 || r.height > 260) continue
      const alto = piso - r.bottom
      if (r.left - base.left > 34) opciones.push({ x: r.left - base.left, alto, lado: 'der' })
      if (base.right - r.right > 34) opciones.push({ x: r.right - base.left, alto, lado: 'izq' })
    }
  }
  for (let i = opciones.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opciones[i], opciones[j]] = [opciones[j], opciones[i]] }
  // Lo que no se puede tapar: cada renglón de texto (de links y botones también), los íconos y los campos.
  const prohibidos: DOMRect[] = []
  if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
    const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const rango = document.createRange()
    for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
      if (!(n.textContent ?? '').trim() || capa.contains(n) || n.parentElement?.closest('.aviso')) continue
      rango.selectNodeContents(n)
      for (const r of rango.getClientRects()) if (r.bottom > 0 && r.top < piso && r.width > 0) prohibidos.push(r)
    }
    // Íconos chicos y campos (los links y botones cuentan por su texto).
    for (const e of document.querySelectorAll('input, select, textarea, svg, img')) {
      if (capa.contains(e)) continue
      const r = e.getBoundingClientRect()
      if (r.width > 0 && r.bottom > 0 && r.top < piso && r.width < 48 && r.height < 48) prohibidos.push(r)
    }
  }
  // El rival y el «?» (≈ 50 px al costado del corte, 48 px de alto) y su cartel arriba (≈ 68 px de ancho, metido en la pantalla).
  const tapa = (o: { x: number; alto: number; lado: 'izq' | 'der' }): number => {
    const corte = base.left + o.x
    const y1 = piso - o.alto
    // Con margen: el «?» va al costado de la cabeza.
    const cuerpo = o.lado === 'der' ? [corte - 50, corte] : [corte, corte + 50]
    const centro = o.lado === 'der' ? corte - 20 : corte + 20
    const cx0 = Math.max(base.left + 2, Math.min(base.right - 70, centro - 34))
    const cajas = [[cuerpo[0], y1 - 48, cuerpo[1], y1 + 4], [cx0, y1 - 68, cx0 + 68, y1 - 38]]
    return prohibidos.filter((r) => cajas.some(([a, b, c, d]) => r.left < c && r.right > a && r.top < d && r.bottom > b)).length
  }
  let mejor = opciones[0]
  let menos = Infinity
  for (const o of opciones) {
    const n = tapa(o)
    if (n === 0) return o
    if (n < menos) { menos = n; mejor = o }
  }
  return mejor ?? { x: ancho, alto: 0, lado: 'der' }
}
