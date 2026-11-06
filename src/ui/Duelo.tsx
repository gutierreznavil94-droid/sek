/**
 * Duelo quieto (v0.85): SEK pide las flexiones de la serie rápida y las anota como una serie hecha; el tema dibuja.
 * Se pide con `pedirDuelo({ motivo })`: al alcanzar al rival (después sigue el 3·2·1), al final de Tensión y
 * después de «No cumplí» (la serie más la mitad).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { rendirse, terminarBatalla, type Batalla } from '../services/batalla'
import { anotarDuelo, configDuelo, type ConfigDuelo, type MotivoDuelo } from '../services/duelo'
import { DueloComun, DueloShinobi } from '../temas/shinobi/DueloShinobi'
import { rivalArchivado } from '../temas/archivado'
import { useTema } from '../temas/temas'
import { FondoLluvia } from './FondoLluvia'
import { sonarChoque } from './animaciones/motor'
import { movimientoReducido } from './componentes'
import { avisar, mutar } from './estado'

export type PedidoDuelo = { motivo: MotivoDuelo; batalla?: Batalla; despues?: string; prueba?: boolean; onFin?: () => void }
let pendiente: (PedidoDuelo & { n: number }) | null = null
let cuenta = 0
const oyentes = new Set<() => void>()
const avisarOyentes = () => { for (const o of oyentes) o() }

export function pedirDuelo(p: PedidoDuelo): boolean {
  if (pendiente) return false
  pendiente = { ...p, n: ++cuenta }
  avisarOyentes()
  return true
}
export function hayDuelo(): boolean { return pendiente !== null }
export function dueloEnCurso(): PedidoDuelo | null { return pendiente }
/** Para las pruebas: cierra sin anotar nada. */
export function descartarDuelo(): void { pendiente = null; avisarOyentes() }
function cerrarDuelo() { const p = pendiente; pendiente = null; avisarOyentes(); p?.onFin?.() }

/** Tiempos (ms): el tajo y la caída del rival. */
export const TIEMPOS_DUELO = { tajo: 1100 }

export function DueloCapa() {
  const p = useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pendiente, () => null)
  if (!p) return null
  return <Duelo key={p.n} p={p} />
}

function Duelo({ p }: { p: PedidoDuelo }) {
  const tema = useTema()
  const [reducido] = useState(() => movimientoReducido())
  const [c, setC] = useState<ConfigDuelo | null>(null)
  const [hechas, setHechas] = useState(0)
  const [fase, setFase] = useState<'guardia' | 'tajo'>('guardia')
  useEffect(() => { void configDuelo(p.motivo).then(setC) }, [p.motivo])

  const terminar = () => { if (fase === 'guardia') { setFase('tajo'); try { sonarChoque() } catch { /* sin sonido */ } try { navigator.vibrate?.(60) } catch { /* sin vibración */ } } }
  useEffect(() => {
    if (fase !== 'tajo' || !c) return
    const id = window.setTimeout(async () => {
      if (!p.prueba) {
        try {
          const r = p.batalla ? await mutar(() => terminarBatalla(p.batalla!, c.reps)) : await mutar(() => anotarDuelo(c))
          avisar(`${c.reps} ${c.nombre.toLowerCase()} · una serie hecha${r.xp > 0 ? ` · +${r.xp} XP` : ''}`, { tipo: 'ok' })
        } catch (e) { avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' }) }
      }
      cerrarDuelo()
      // Después del rival sigue el 3·2·1 con la acción que tocaba (o para elegir).
      if (p.motivo === 'rival' && p.despues !== undefined && !p.prueba) window.location.hash = p.despues ? `#/321?accion=${encodeURIComponent(p.despues)}&auto=1` : '#/321'
    }, reducido ? 300 : TIEMPOS_DUELO.tajo)
    return () => window.clearTimeout(id)
  }, [fase, c]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return null
  const tocar = () => {
    if (fase !== 'guardia') return
    const n = hechas + 1
    setHechas(Math.min(n, c.reps))
    try { navigator.vibrate?.(15) } catch { /* sin vibración */ }
    if (n >= c.reps) terminar()
  }
  const ahoraNo = () => {
    if (p.batalla && !p.prueba) void mutar(() => rendirse(p.batalla!))
    cerrarDuelo()
  }
  // Con el rival archivado (v0.86), la pantalla simple: lluvia, 力 y la cuenta, sin personajes.
  const Vista = tema.escenas && !rivalArchivado() ? DueloShinobi : DueloComun
  return <Vista fondo={tema.escenas ? <FondoLluvia variante="hoy" /> : undefined} titulo={c.nombre} hechas={hechas} total={c.reps} nombreRival={p.batalla?.pelea.distraccion.nombre} fase={fase} reducido={reducido} onTocar={tocar} onListo={terminar} onAhoraNo={ahoraNo} />
}
