/**
 * Batalla contra la distracción: minijuego de flexiones. Desde «Dudo» (Hoy) o «⚔ Batalla» en la carta del ninja.
 *
 * - Objetivo = reps por serie del contador (14 flexiones → 15: múltiplo de las reps por toque). Sin contador: 15.
 * - Cada toque de «+5 flexiones» es un golpe; al último, el rival cae y se anota UNA serie en el contador
 *   con las reps del objetivo (misma XP y mismos topes que una serie cargada a mano: la batalla no da XP extra).
 * - Rendirse no anota nada («se escapó»). Tope: 3 batallas por día.
 */
import type { Contador, Distraccion, PeleaNinja } from '../data/tipos'
import type { FechaDia } from '../domain/fechas'
import { obtenerAjustes } from './base'
import { listarContadores, sumarToque } from './contadores'
import { distraccionesDe, elegirNinja, peleasDelDia, registrarPelea, type Pelea } from './ninjas'

export const TOPE_BATALLAS_DIA = 3
export const REPS_POR_TOQUE = 5
export const OBJETIVO_SIN_CONTADOR = 15

/** Objetivo: las reps por serie redondeadas hacia arriba a un múltiplo de las reps por toque (14 → 15, 20 → 20). */
export function objetivoBatalla(repsPorSerie: number | null | undefined, porToque: number = REPS_POR_TOQUE): number {
  const paso = Math.max(1, Math.round(porToque) || REPS_POR_TOQUE)
  const base = repsPorSerie && repsPorSerie > 0 ? repsPorSerie : OBJETIVO_SIN_CONTADOR
  return Math.max(paso, Math.ceil(base / paso) * paso)
}

export type ConfigBatalla = { activa: boolean; contador: Contador | null; repsPorToque: number; objetivo: number; rondas: number }

/** Configuración efectiva: ajustes + contador elegido (flexiones si no se eligió ninguno). */
export async function configBatalla(): Promise<ConfigBatalla> {
  const a = await obtenerAjustes()
  const lista = await listarContadores()
  const b = a.batalla ?? {}
  const contador = (b.contadorId ? lista.find((c) => c.id === b.contadorId) : undefined) ?? lista.find((c) => /flexi/i.test(c.nombre)) ?? lista[0] ?? null
  const repsPorToque = b.repsPorToque && b.repsPorToque > 0 ? Math.round(b.repsPorToque) : REPS_POR_TOQUE
  const objetivo = objetivoBatalla(contador?.cantidadPorToque, repsPorToque)
  return { activa: b.activa !== false, contador, repsPorToque, objetivo, rondas: Math.max(1, Math.round(objetivo / repsPorToque)) }
}

export async function batallasDelDia(fecha: FechaDia): Promise<PeleaNinja[]> {
  return (await peleasDelDia(fecha)).filter((p) => p.momento === 'batalla')
}

export async function puedeBatallar(fecha: FechaDia): Promise<{ puede: boolean; hechas: number; tope: number }> {
  const hechas = (await batallasDelDia(fecha)).length
  return { puede: hechas < TOPE_BATALLAS_DIA, hechas, tope: TOPE_BATALLAS_DIA }
}

export type Batalla = { pelea: Pelea; config: ConfigBatalla }

/** Arma la batalla o dice por qué no: ninjas/batalla apagados, lista vacía o tope del día. */
export async function prepararBatalla(fecha: FechaDia, distraccion?: Distraccion, azar: () => number = Math.random): Promise<{ batalla: Batalla; motivo?: undefined } | { motivo: string; batalla?: undefined }> {
  const a = await obtenerAjustes()
  if (a.ninjas === false) return { motivo: 'Los ninjas están apagados (Más → Ver animaciones).' }
  const config = await configBatalla()
  if (!config.activa) return { motivo: 'La batalla está apagada (Más → Ver animaciones).' }
  const lista = distraccionesDe(a)
  if (!lista.length) return { motivo: 'Sin distracciones en la lista (Más → Ver animaciones → Mis distracciones).' }
  const t = await puedeBatallar(fecha)
  if (!t.puede) return { motivo: `Batallas hoy: ${t.hechas} de ${t.tope}. Mañana hay más.` }
  const usados = (await peleasDelDia(fecha)).map((p) => p.distraccion)
  const rival = distraccion ?? elegirNinja(lista, 'batalla', usados, azar) ?? lista[0]
  return { batalla: { pelea: { fecha, distraccion: rival, momento: { momento: 'batalla' } }, config } }
}

export type ResultadoBatalla = { pelea: PeleaNinja; reps: number; xp: number; xpExtra: number; nuevoNivel: number | null; contador: string | null }

/** Victoria: sello del día + una serie en el contador con las reps del objetivo (una sola vez). */
export async function terminarBatalla(b: Batalla): Promise<ResultadoBatalla> {
  const reps = b.config.objetivo
  const pelea = await registrarPelea(b.pelea, 'vencido', { reps })
  if (!b.config.contador) return { pelea, reps, xp: 0, xpExtra: 0, nuevoNivel: null, contador: null }
  const r = await sumarToque(b.config.contador.id, reps, `Batalla contra ${b.pelea.distraccion.nombre}`)
  return { pelea, reps, xp: r.xp, xpExtra: r.xpExtra, nuevoNivel: r.nuevoNivel, contador: b.config.contador.nombre }
}

/** «Me rindo»: el ninja se escapó; no se anota ninguna serie y no hay XP negativo. */
export async function rendirse(b: Batalla): Promise<PeleaNinja> {
  return registrarPelea(b.pelea, 'escapo')
}

/** Texto del sello en Hoy. */
export function selloBatalla(nombreDistraccion: string, p: PeleaNinja, unidad = 'flexiones'): string {
  return p.resultado === 'vencido' ? `Venciste a ${nombreDistraccion}${p.reps ? ` con ${p.reps} ${unidad}` : ''}` : `${nombreDistraccion} se escapó`
}
