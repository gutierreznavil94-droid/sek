/**
 * El rival escurridizo: un muñequito gris con el nombre de la distracción que se pasea por el borde de abajo de Hoy
 * (como el compañero, sin tapar nada). Tocarlo: el shinobi corre y salta hacia él; según el sorteo se escabulle 0, 1 o 2
 * veces; al atraparlo, destello gris y arranca la batalla. Ignorado 60 s (o cerrar la app): advertencia que rompe la
 * pantalla (10 s, botón «¡Atraparlo!») y después el robo (la bolita de XP sale del pecho y se la lleva corriendo).
 * Se pide con `pedirRival(pelea)`. Hasta que estén los clips de Luma del rival, es una silueta gris que se desplaza.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import type { Pelea } from '../services/ninjas'
import { prepararBatalla } from '../services/batalla'
import { TIEMPO_ADVERTENCIA_MS, TIEMPO_IGNORADO_MS, guardarRivalPendiente, limpiarRivalPendiente, peleaPendiente, robarXp, rivalPendiente, sortearEscapes } from '../services/rival'
import { ahora } from '../services/reloj'
import { temaActivo } from '../temas/temas'
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
  }, [])

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
    if (fase !== 'paseo') return
    let vivo = true
    const paso = () => {
      if (!vivo || faseRef.current !== 'paseo') return
      const tope = Math.max(MARGEN, ancho - MARGEN - ANCHO_RIVAL)
      const destino = Math.round(MARGEN + Math.random() * (tope - MARGEN))
      const dist = Math.abs(destino - rxRef.current)
      const dur = reducido ? 0 : dist / 55
      setRdir(destino < rxRef.current ? -1 : 1)
      setRdur(dur)
      setRx(destino)
      const [a, b] = TIEMPOS.pausaPaseo
      luego(paso, dur * 1000 + a + Math.random() * (b - a))
    }
    const [a] = TIEMPOS.pausaPaseo
    luego(paso, a)
    return () => { vivo = false }
  }, [fase, ancho, reducido]) // eslint-disable-line react-hooks/exhaustive-deps

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
    }, reducido ? 300 : TIEMPOS.robo)
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
          luego(() => { void atrapar() }, reducido ? 100 : TIEMPOS.destello)
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
          <svg className="rv-adv-rival" viewBox="-60 -116 120 124" aria-hidden><g transform="scale(-1,1)"><Enemigo variante="bandido" sinArma /></g></svg>
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
          <div className="rv-robo-rival">
            <svg viewBox="-60 -116 120 124" aria-hidden><g transform="scale(-1,1)"><Enemigo variante="bandido" sinArma /></g></svg>
            <span className="rv-bolita" aria-hidden />
          </div>
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
      <button type="button" className={`rv-rival ${fase}`} style={{ transform: `translateX(${rx}px)`, transition: `transform ${rdur}s ${fase === 'esquiva' ? 'cubic-bezier(.2,.9,.3,1)' : 'linear'}`, width: ANCHO_RIVAL, height: ALTO_RIVAL + 22 }} onClick={tocar} aria-label={`Atrapar a ${nombre}`} data-escapes={escapes}>
        <span className="rv-cartel">{nombre}</span>
        <svg className="rv-silueta" viewBox="-30 -110 60 114" width={ANCHO_RIVAL} height={ALTO_RIVAL} style={{ transform: rdir === 1 ? 'scaleX(-1)' : undefined }} aria-hidden><Enemigo variante="bandido" sinArma /></svg>
        {fase === 'atrapado' && <span className="rv-destello" aria-hidden />}
      </button>
    </div>
  )
}
