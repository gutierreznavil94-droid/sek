/**
 * Batalla contra la distracción: minijuego de flexiones a pantalla completa.
 * Grito («¡Yo te ayudo!») → 3·2·1 → rondas: cada toque de «+5 flexiones» es un golpe y la vida del rival baja;
 * al último toque el rival cae y llega la victoria (fondo rojo, kanji 勝, brillo en la katana). Se pide con `pedirBatalla`.
 * Usa las tiras de cuadros de los clips de Luma que ya están (logro, parry, ejecución): sin clips nuevos.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { terminarBatalla, rendirse, type Batalla, type ResultadoBatalla } from '../services/batalla'
import { Enemigo, FondoEpico } from './animaciones/Escena'
import { configuracionAnimaciones, sonarChoque, sonarTaiko } from './animaciones/motor'
import { avisar, mutar } from './estado'

let pendiente: Batalla | null = null
const oyentes = new Set<() => void>()
function avisarOyentes() { for (const o of oyentes) o() }

/** Pide una batalla (una a la vez). */
export function pedirBatalla(b: Batalla): boolean {
  if (pendiente) return false
  pendiente = b
  avisarOyentes()
  return true
}
export function hayBatalla(): boolean { return pendiente !== null }
/** Para pruebas y para quien quiera saber contra quién es. */
export function batallaEnCurso(): Batalla | null { return pendiente }
/** Saca la batalla de pantalla sin anotar nada (pruebas). */
export function descartarBatalla(): void { pendiente = null; avisarOyentes() }
function useBatalla(): Batalla | null {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pendiente, () => pendiente)
}

// ---------- Tiras de cuadros (hojas .webp de public/animaciones) ----------
type Hoja = { w: number; h: number; cols: number; cuadros: number; nombre: string }
const PARRY: Hoja = { w: 407, h: 187, cols: 10, cuadros: 88, nombre: 'parry' }
const EJECUCION: Hoja = { w: 436, h: 158, cols: 10, cuadros: 84, nombre: 'ejecucion' }
const LOGRO: Hoja = { w: 357, h: 273, cols: 10, cuadros: 80, nombre: 'logro' }
const FILAS: Record<string, number> = { parry: 9, ejecucion: 9, logro: 8 }

/**
 * Reproduce los cuadros `desde`–`hasta` de una hoja en `dur` ms. `modo`: una vez (queda en el último), bucle o ida y vuelta.
 * `clave` reinicia la reproducción cuando cambia (un golpe nuevo).
 */
function Tira({ hoja, desde, hasta, dur, modo = 'una', oscuro, clase, clave = 0, onFin }: { hoja: Hoja; desde: number; hasta: number; dur: number; modo?: 'una' | 'bucle' | 'vaiven'; oscuro?: boolean; clase?: string; clave?: number; onFin?: () => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const alFin = useRef(onFin)
  alFin.current = onFin
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const n = hasta - desde + 1
    const t0 = performance.now()
    let id = 0
    let ultimo = -1
    let avisado = false
    const paso = (t: number) => {
      const f = (t - t0) / dur
      let i: number
      if (modo === 'una') i = Math.min(n - 1, Math.floor(f * n))
      else if (modo === 'bucle') i = Math.floor((f % 1) * n)
      else { const c = f % 2; i = Math.floor((c < 1 ? c : 2 - c) * (n - 1) + 0.0001) }
      const cuadro = desde + Math.max(0, Math.min(n - 1, i))
      if (cuadro !== ultimo) {
        ultimo = cuadro
        el.setAttribute('viewBox', `${(cuadro % hoja.cols) * hoja.w} ${Math.floor(cuadro / hoja.cols) * hoja.h} ${hoja.w} ${hoja.h}`)
      }
      if (modo === 'una' && f >= 1) { if (!avisado) { avisado = true; alFin.current?.() } return }
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [hoja, desde, hasta, dur, modo, clave])
  const src = `${import.meta.env.BASE_URL}animaciones/${hoja.nombre}/${hoja.nombre}-${oscuro ? 'oscuro' : 'claro'}.webp`
  return (
    <svg ref={ref} className={`bt-tira ${clase ?? ''}`} viewBox={`${(desde % hoja.cols) * hoja.w} ${Math.floor(desde / hoja.cols) * hoja.h} ${hoja.w} ${hoja.h}`} preserveAspectRatio="xMidYMax meet" aria-hidden>
      <image href={src} x={0} y={0} width={hoja.w * hoja.cols} height={hoja.h * FILAS[hoja.nombre]} />
    </svg>
  )
}

type Fase = 'grito' | 'cuenta' | 'pelea' | 'caida' | 'victoria'
const DUR_GRITO = 1500
const DUR_CAIDA = 2200
const DUR_VICTORIA = 3000

export function BatallaCapa() {
  const b = useBatalla()
  if (!b) return null
  return <BatallaEnCurso key={b.pelea.distraccion.id + b.pelea.fecha} b={b} />
}

function BatallaEnCurso({ b }: { b: Batalla }) {
  const [fase, setFase] = useState<Fase>('grito')
  const [n, setN] = useState(3)
  const [toques, setToques] = useState(0)
  const [golpe, setGolpe] = useState(0)
  const [golpeando, setGolpeando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBatalla | null>(null)
  const [puedeCerrar, setPuedeCerrar] = useState(false)
  const terminando = useRef(false)
  const sonido = configuracionAnimaciones().sonido
  const rival = b.pelea.distraccion.nombre
  const { rondas, repsPorToque, objetivo, contador } = b.config
  const cerrar = () => { pendiente = null; avisarOyentes() }

  // Grito → cuenta
  useEffect(() => {
    if (fase !== 'grito') return
    if (sonido) sonarTaiko()
    const id = window.setTimeout(() => setFase('cuenta'), DUR_GRITO)
    return () => window.clearTimeout(id)
  }, [fase, sonido])
  // 3 · 2 · 1 (taiko en cada número)
  useEffect(() => {
    if (fase !== 'cuenta') return
    if (n === 0) { setFase('pelea'); return }
    if (sonido) sonarTaiko()
    const id = window.setTimeout(() => setN(n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [fase, n, sonido])
  // Caída del rival: se anota la serie (una sola vez) y después la victoria
  useEffect(() => {
    if (fase !== 'caida' || terminando.current) return
    terminando.current = true
    if (sonido) sonarChoque()
    mutar(() => terminarBatalla(b)).then(setResultado).catch((e: unknown) => avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' }))
    const id = window.setTimeout(() => setFase('victoria'), DUR_CAIDA)
    return () => window.clearTimeout(id)
  }, [fase, b, sonido])
  // Victoria: taiko doble, 3 s, un toque cierra
  useEffect(() => {
    if (fase !== 'victoria') return
    if (sonido) { sonarTaiko(); window.setTimeout(sonarTaiko, 380) }
    try { navigator.vibrate?.([80, 60, 160]) } catch { /* sin vibración */ }
    const a = window.setTimeout(() => setPuedeCerrar(true), 900)
    const c = window.setTimeout(cerrar, DUR_VICTORIA + 4000)
    return () => { window.clearTimeout(a); window.clearTimeout(c) }
  }, [fase, sonido]) // eslint-disable-line react-hooks/exhaustive-deps

  const tocar = () => {
    if (fase !== 'pelea') return
    const t = toques + 1
    setToques(t)
    setGolpe((g) => g + 1)
    setGolpeando(true)
    if (sonido) sonarChoque()
    try { navigator.vibrate?.(60) } catch { /* sin vibración */ }
    if (t >= rondas) setFase('caida')
  }
  const rendir = async () => {
    await mutar(() => rendirse(b)).catch(() => undefined)
    avisar(`${rival} se escapó. Sin castigo.`, { tipo: 'bajo' })
    cerrar()
  }
  const vida = Math.max(0, 1 - toques / rondas)
  const victoria = fase === 'victoria'
  const unidad = (contador?.nombre ?? 'flexiones').toLowerCase()

  return (
    <div className={`sh-capa oscura epica bt-capa ${fase}`} role="dialog" aria-label={`Batalla contra ${rival}`} onPointerDown={victoria && puedeCerrar ? cerrar : undefined}>
      {!victoria && <FondoEpico />}
      {victoria && (
        <div className="bt-victoria-fondo" aria-hidden>
          <div className="bt-sol" />
          <div className="bt-particulas">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i, left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.25}s` } as CSSProperties} />)}</div>
          <div className="bt-kanji-victoria">勝</div>
        </div>
      )}

      <div className="bt-arriba">
        {!victoria && fase !== 'caida' && <button type="button" className="bt-rendirse" onClick={rendir}>Me rindo</button>}
        <span className="bt-rival">{rival}</span>
      </div>
      {!victoria && (
        <div className="bt-vida" role="progressbar" aria-valuenow={Math.round(vida * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Vida de ${rival}`}>
          <i style={{ width: `${vida * 100}%` }} />
        </div>
      )}

      <div className="bt-escena">
        {fase === 'grito' && (
          <>
            <div className="bt-globo">¡Yo te ayudo!</div>
            <Tira hoja={LOGRO} desde={58} hasta={79} dur={1400} modo="vaiven" clase="bt-shinobi grito" />
            <svg className="bt-enemigo" viewBox="0 0 90 130" aria-hidden><g transform="translate(45,124)"><Enemigo variante="ronin" /></g></svg>
          </>
        )}
        {fase === 'cuenta' && (
          <>
            <div className="bt-numero">{n > 0 ? n : '¡Ya!'}</div>
            <Tira hoja={PARRY} desde={0} hasta={10} dur={2400} modo="vaiven" clase="bt-pelea" />
          </>
        )}
        {fase === 'pelea' && (
          golpeando
            ? <Tira key={`g${golpe}`} hoja={PARRY} desde={6} hasta={55} dur={900} modo="una" clase="bt-pelea golpe" clave={golpe} onFin={() => setGolpeando(false)} />
            : <Tira hoja={PARRY} desde={0} hasta={16} dur={1800} modo="vaiven" clase="bt-pelea" />
        )}
        {fase === 'caida' && <Tira hoja={EJECUCION} desde={26} hasta={83} dur={DUR_CAIDA} modo="una" clase="bt-pelea caida" />}
        {victoria && (
          <div className="bt-pose">
            <Tira hoja={LOGRO} desde={56} hasta={79} dur={700} modo="una" oscuro clase="bt-shinobi victoria" />
            <span className="bt-filo" aria-hidden />
          </div>
        )}
      </div>

      <div className="bt-abajo">
        {fase === 'pelea' && (
          <>
            <button type="button" className="bt-boton" onClick={tocar}>+{repsPorToque} {unidad}</button>
            <span className="bt-cuenta">{toques * repsPorToque} de {objetivo} · hacé {repsPorToque} y tocá</span>
          </>
        )}
        {fase === 'grito' && <span className="bt-cuenta">{rival} apareció. El shinobi pelea con vos.</span>}
        {fase === 'cuenta' && <span className="bt-cuenta">A las {objetivo} {unidad}, {rival} cae.</span>}
        {fase === 'caida' && <span className="bt-cuenta">{objetivo} {unidad}. {rival} cae.</span>}
        {victoria && (
          <div className="bt-resultado">
            <b>Venciste a {rival}</b>
            <span>{objetivo} {unidad}{resultado?.contador ? ` · 1 serie en ${resultado.contador}` : ''}{resultado && resultado.xp + resultado.xpExtra > 0 ? ` · +${resultado.xp + resultado.xpExtra} XP` : ''}</span>
            {puedeCerrar && <span className="bt-saltar">tocá para cerrar</span>}
          </div>
        )}
      </div>
    </div>
  )
}
