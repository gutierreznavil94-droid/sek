/**
 * Agua: la cantimplora de Hoy. Un toque suma el envase principal; el objetivo sale del peso de Comida
 * (35 ml por kilo, redondeado a 250) salvo que se cargue a mano. Sin XP: no afecta a ningún pilar.
 */
import { db } from '../data/db'
import type { ConfigAgua, EnvaseAgua, TomaAgua } from '../data/tipos'
import { lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { guardarAjustes, obtenerAjustes } from './base'
import { ahora, nuevoId } from './reloj'

export const ENVASES_DEFECTO: EnvaseAgua[] = [
  { id: 'botella-750', nombre: 'Botella', ml: 750 },
  { id: 'vaso-250', nombre: 'Vaso', ml: 250 },
  { id: 'botella-500', nombre: 'Botella chica', ml: 500 },
]

export const ML_POR_KILO = 35
export const OBJETIVO_SIN_PESO = 2500

/** Objetivo del día en ml: a mano si lo cargó, si no 35 ml/kg del peso de Comida redondeado a 250. */
export function objetivoAgua(peso: number | undefined, aMano?: number): number {
  if (aMano && aMano > 0) return aMano
  if (!peso || peso <= 0) return OBJETIVO_SIN_PESO
  return Math.max(1000, Math.round((peso * ML_POR_KILO) / 250) * 250)
}

export type EstadoAgua = {
  config: ConfigAgua
  principal: EnvaseAgua
  objetivo: number
  /** Objetivo calculado del peso (para mostrar «35 ml × 70 kg»). */
  calculado: number
  pesoUsado?: number
}

export async function configAgua(): Promise<EstadoAgua> {
  const a = await obtenerAjustes()
  const config: ConfigAgua = a.agua && a.agua.envases.length ? a.agua : { envases: ENVASES_DEFECTO, principal: ENVASES_DEFECTO[0].id, objetivoMl: a.agua?.objetivoMl }
  const principal = config.envases.find((e) => e.id === config.principal) ?? config.envases[0]
  const peso = a.comida?.peso
  return { config, principal, objetivo: objetivoAgua(peso, config.objetivoMl), calculado: objetivoAgua(peso), pesoUsado: peso }
}

export async function guardarConfigAgua(cambios: Partial<ConfigAgua>): Promise<ConfigAgua> {
  const { config } = await configAgua()
  const nueva: ConfigAgua = { ...config, ...cambios }
  if (!nueva.envases.length) throw new Error('Dejá al menos un envase')
  for (const e of nueva.envases) {
    if (!e.nombre.trim()) throw new Error('Cada envase necesita un nombre')
    if (!(e.ml > 0)) throw new Error(`${e.nombre}: los ml tienen que ser más que 0`)
  }
  if (!nueva.envases.some((e) => e.id === nueva.principal)) nueva.principal = nueva.envases[0].id
  if (nueva.objetivoMl !== undefined && !(nueva.objetivoMl > 0)) delete nueva.objetivoMl
  await guardarAjustes({ agua: nueva }, 'Agua')
  return nueva
}

export function nuevoEnvase(nombre: string, ml: number): EnvaseAgua {
  return { id: nuevoId('env-'), nombre: nombre.trim(), ml: Math.round(ml) }
}

export type AguaDelDia = { ml: number; objetivo: number; tomas: TomaAgua[]; /** 0..1 sobre el objetivo (puede pasar de 1). */ nivel: number; llego: boolean }

export async function aguaDelDia(fecha: FechaDia): Promise<AguaDelDia> {
  const { objetivo } = await configAgua()
  const tomas = (await db().agua.where('fecha').equals(fecha).toArray()).sort((a, b) => a.instante - b.instante)
  const ml = tomas.reduce((s, t) => s + t.ml, 0)
  return { ml, objetivo, tomas, nivel: objetivo ? ml / objetivo : 0, llego: ml >= objetivo }
}

/** Un toque: suma el envase (el principal si no se dice otro). */
export async function tomarAgua(fecha: FechaDia, envaseId?: string): Promise<{ toma: TomaAgua; dia: AguaDelDia; recienLlego: boolean }> {
  const antes = await aguaDelDia(fecha)
  const { config, principal } = await configAgua()
  const e = (envaseId && config.envases.find((x) => x.id === envaseId)) || principal
  // Dos toques en el mismo instante (reloj fijo) igual quedan en orden.
  const ultimo = antes.tomas[antes.tomas.length - 1]?.instante ?? 0
  const toma: TomaAgua = { id: nuevoId('agua-'), fecha, ml: e.ml, envase: e.id, instante: Math.max(ahora(), ultimo + 1) }
  await db().agua.add(toma)
  const dia = await aguaDelDia(fecha)
  return { toma, dia, recienLlego: !antes.llego && dia.llego }
}

/** Resta el último toque del día. Devuelve lo que quedó. */
export async function deshacerToma(fecha: FechaDia): Promise<AguaDelDia> {
  const tomas = await db().agua.where('fecha').equals(fecha).toArray()
  const ultima = tomas.sort((a, b) => b.instante - a.instante)[0]
  if (ultima) await db().agua.delete(ultima.id)
  return aguaDelDia(fecha)
}

export async function borrarToma(id: string): Promise<void> {
  await db().agua.delete(id)
}

export type ResumenAgua = {
  objetivo: number
  /** Últimos 14 días, del más viejo a hoy. */
  dias: { fecha: FechaDia; ml: number; llego: boolean }[]
  /** Litros por día promedio de cada semana (solo días con algo), de la más vieja a la actual. */
  semanas: { desde: FechaDia; litrosPorDia: number | null; dias: number; llego: number }[]
  rachaDias: number
}

export async function resumenAgua(hoy: FechaDia, semanas = 6): Promise<ResumenAgua> {
  const { objetivo } = await configAgua()
  const lunes = lunesDe(hoy)
  const desde = sumarDias(lunes, -7 * (semanas - 1))
  const desdeDias = sumarDias(hoy, -13)
  const tomas = await db().agua.where('fecha').between(desdeDias < desde ? desdeDias : desde, hoy, true, true).toArray()
  const porDia = new Map<FechaDia, number>()
  for (const t of tomas) porDia.set(t.fecha, (porDia.get(t.fecha) ?? 0) + t.ml)
  const dias: ResumenAgua['dias'] = []
  for (let f = desdeDias; f <= hoy; f = sumarDias(f, 1)) dias.push({ fecha: f, ml: porDia.get(f) ?? 0, llego: (porDia.get(f) ?? 0) >= objetivo })
  const res: ResumenAgua['semanas'] = []
  for (let i = 0; i < semanas; i++) {
    const ini = sumarDias(desde, 7 * i)
    const fin = sumarDias(ini, 6)
    const d = [...porDia.entries()].filter(([f]) => f >= ini && f <= fin)
    res.push({ desde: ini, dias: d.length, llego: d.filter(([, ml]) => ml >= objetivo).length, litrosPorDia: d.length ? Math.round(d.reduce((s, [, ml]) => s + ml, 0) / d.length / 100) / 10 : null })
  }
  while (res.length > 2 && res[0].dias === 0) res.shift()
  let racha = 0
  for (let i = dias.length - 1; i >= 0 && dias[i].llego; i--) racha++
  return { objetivo, dias, semanas: res, rachaDias: racha }
}

/** «1,5 de 2,5 L» */
export function litros(ml: number): string {
  const l = ml / 1000
  return `${(Math.round(l * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: l >= 10 ? 1 : 2 })} L`
}
