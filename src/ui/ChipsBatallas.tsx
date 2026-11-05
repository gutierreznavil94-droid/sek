/**
 * Registro de batallas del día en una sola línea: un chip chiquito por rival (vencido, escapado, robo o en duda) y
 * al final «3/3 batallas». La fila se desliza de costado; al tocar un chip se ve el detalle. El look es del tema.
 */
import { useState } from 'react'
import type { Ajustes } from '../data/tipos'
import { formatoHora } from '../domain/fechas'
import { distraccionesDe, nombreDistraccion, registroBatallas, type ChipBatalla, type EstadoChipBatalla } from '../services/ninjas'
import { iconoTema } from '../temas/temas'
import { useDatos } from './estado'
import { caidasDelDia } from '../services/caidas'
import type { Caida } from '../data/tipos'

/** Último uso de 3·2·1 o Siguiente acción hoy (lo anotan esas pantallas al empezar). */
function ultimaAccion(hoy: string): number {
  try {
    const v = ['321', 'siguiente'].map((q) => Number(localStorage.getItem(`usado-${q}:${hoy}`) ?? 0))
    return Math.max(0, ...v.map((x) => (Number.isFinite(x) ? x : 0)))
  } catch { return 0 }
}

const ICONO: Record<EstadoChipBatalla, [string, string]> = {
  vencido: ['icono-batalla-vencido', '斬'],
  escapado: ['icono-batalla-escapado', '逃'],
  robo: ['icono-batalla-robo', '盗'],
  duda: ['icono-batalla-duda', '…'],
}

export function ChipsBatallas({ hoy, ajustes, unidad, hechas, tope }: { hoy: string; ajustes: Ajustes; unidad: string; hechas?: number; tope?: number }) {
  const contador = ajustes.batalla?.contadorId ?? 'flexiones'
  const datos = useDatos(() => registroBatallas(hoy, contador, ultimaAccion(hoy)), [hoy, contador])
  const caidas = useDatos(() => caidasDelDia(hoy), [hoy])
  const [abierto, setAbierto] = useState<number | null>(null)
  const [caidaAbierta, setCaidaAbierta] = useState<string | null>(null)
  // Solo lo que ya se definió: vencido, se escapó o robó. Los «en duda» no ocupan lugar.
  const chips = (datos.datos ?? []).filter((c) => c.estado !== 'duda')
  const listaCaidas: Caida[] = caidas.datos ?? []
  if (!chips.length && !hechas && !listaCaidas.length) return null
  const nombre = (id: string) => nombreDistraccion(distraccionesDe(ajustes), id)
  const detalle = (c: ChipBatalla): string => {
    const hora = formatoHora(c.pelea.instante, ajustes.zonaHoraria)
    const n = nombre(c.pelea.distraccion)
    if (c.estado === 'robo') return `${hora} · ${n} se llevó ${c.pelea.robo ?? 0} XP`
    if (c.estado === 'escapado') return `${hora} · ${n} se escapó`
    const reps = (c.pelea.reps ?? 0) + c.repsDespues
    const partes = [`${hora} · ${n}`, c.hizoReps ? `${reps} ${unidad}` : `faltan ${unidad}`, c.hizoAccion ? '3·2·1 o Siguiente ✓' : 'falta 3·2·1 o Siguiente']
    return c.estado === 'vencido' ? `Venciste: ${partes.join(' · ')}` : `En duda: ${partes.join(' · ')}`
  }
  const sel = abierto !== null ? chips[abierto] : null
  const selCaida = listaCaidas.find((c) => c.id === caidaAbierta) ?? null
  const detalleCaida = (c: Caida) => `${formatoHora(c.instante, ajustes.zonaHoraria)} · caída${c.origen === 'tension' ? ' en Tensión' : ''}${c.xp > 0 ? ` · −${c.xp} XP` : ''} · nuevo round, seguiste`
  return (
    <div className="chips-batallas">
      <div className="chips-batallas-fila" role="list" aria-label="Batallas de hoy">
        {chips.map((c, i) => {
          const [nombreIcono, defecto] = ICONO[c.estado]
          return (
            <button key={c.pelea.id ?? i} type="button" role="listitem" className={`tema-chip-batalla ${abierto === i ? 'abierto' : ''}`} data-chip={c.estado} onClick={() => { setCaidaAbierta(null); setAbierto(abierto === i ? null : i) }} aria-label={detalle(c)}>
              <span className="tema-chip-k" aria-hidden>{iconoTema(nombreIcono) || defecto}</span>
              <span className="tema-chip-t">{c.estado === 'robo' ? `−${c.pelea.robo ?? 0} XP` : nombre(c.pelea.distraccion)}</span>
            </button>
          )
        })}
        {listaCaidas.map((c) => (
          <button key={c.id} type="button" role="listitem" className={`tema-chip-batalla ${caidaAbierta === c.id ? 'abierto' : ''}`} data-chip="caida" onClick={() => { setAbierto(null); setCaidaAbierta(caidaAbierta === c.id ? null : c.id) }} aria-label={detalleCaida(c)}>
            <span className="tema-chip-k" aria-hidden>{iconoTema('icono-caida') || '墓'}</span>
            <span className="tema-chip-t">caída</span>
          </button>
        ))}
        {hechas !== undefined && hechas > 0 && <span className="chips-batallas-cuenta muy-chico texto-3">{hechas}/{tope} batallas</span>}
      </div>
      {sel && <div className="chips-batallas-globo muy-chico" role="status">{detalle(sel)}</div>}
      {selCaida && <div className="chips-batallas-globo muy-chico" role="status">{detalleCaida(selCaida)}</div>}
    </div>
  )
}
