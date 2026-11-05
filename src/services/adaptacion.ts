/**
 * Adaptación del sueño: cuando uno empieza a acostarse a horario, las primeras 1–2 semanas son normales los
 * despertares, levantarse antes y dormir menos. Lo que importa es acostarse a horario. Etapas (todas editables):
 * Acostumbrando (sem 1–2) · Asentando (3–4) · Estable (5+). Cada una con semanas, horas esperadas y despertares
 * normales; tolerancia de «a horario» ±20 min. El veredicto de cada noche prioriza la hora de acostarse. XP sin cambios.
 */
import type { Ajustes } from '../data/tipos'
import { diferenciaDias, minutosDe, sumarDias, type FechaDia } from '../domain/fechas'
import { db } from '../data/db'
import { fechaDe } from '../domain/fechas'
import { obtenerAjustes } from './base'
import { cicloActivo } from './ciclo'
import type { NocheDeSuenio } from './suenio'

export type ConfigEtapa = { nombre: string; semanas: number; horasMin: number; horasMax: number; despertaresNormales: number }
export type ConfigAdaptacion = {
  /** «Empecé a mejorar mi sueño el…». Si falta: cuando se creó «Dormir a horario» (o el inicio del ciclo). */
  desde?: FechaDia
  etapas?: ConfigEtapa[]
  /** ±minutos alrededor de «Dejo celu» que cuentan como «a horario» (20 si falta). */
  toleranciaMinutos?: number
}

/** Lo sugerido (1–2 semanas acostumbrando, 3–4 asentando, después estable). La última etapa no termina (semanas 0). */
export const ETAPAS_SUGERIDAS: ConfigEtapa[] = [
  { nombre: 'Acostumbrando', semanas: 2, horasMin: 6, horasMax: 9, despertaresNormales: 2 },
  { nombre: 'Asentando', semanas: 2, horasMin: 6.5, horasMax: 9, despertaresNormales: 1 },
  { nombre: 'Estable', semanas: 0, horasMin: 7, horasMax: 9, despertaresNormales: 0 },
]
export const TOLERANCIA_SUGERIDA = 20
/** Noches cortas seguidas que disparan el aviso en «Asentando». */
export const NOCHES_SEGUIDAS_AVISO = 3

export function etapasDe(a: Pick<Ajustes, 'adaptacion'>): ConfigEtapa[] {
  const e = a.adaptacion?.etapas
  return e && e.length >= 1 ? e.map((x) => ({ ...x })) : ETAPAS_SUGERIDAS.map((x) => ({ ...x }))
}

export function toleranciaDe(a: Pick<Ajustes, 'adaptacion'>): number {
  const t = a.adaptacion?.toleranciaMinutos
  return t !== undefined && t >= 0 ? Math.round(t) : TOLERANCIA_SUGERIDA
}

export type EtapaActual = { indice: number; etapa: ConfigEtapa; /** Semana desde el inicio (1 = la primera). */ semana: number; dia: number; /** Semana dentro de la etapa. */ semanaEnEtapa: number; esUltima: boolean }

/** En qué etapa está una fecha, contando desde `inicio`. Las etapas se suman; la última no termina. */
export function etapaDe(fecha: FechaDia, inicio: FechaDia, etapas: ConfigEtapa[] = ETAPAS_SUGERIDAS): EtapaActual {
  const dia = Math.max(0, diferenciaDias(inicio, fecha)) + 1
  const semana = Math.floor((dia - 1) / 7) + 1
  let acumuladas = 0
  for (let i = 0; i < etapas.length; i++) {
    const e = etapas[i]
    const ultima = i === etapas.length - 1
    if (ultima || e.semanas <= 0 || semana <= acumuladas + e.semanas) {
      return { indice: i, etapa: e, semana, dia, semanaEnEtapa: semana - acumuladas, esUltima: ultima }
    }
    acumuladas += e.semanas
  }
  const i = etapas.length - 1
  return { indice: i, etapa: etapas[i], semana, dia, semanaEnEtapa: semana - acumuladas, esUltima: true }
}

/** Primer día de cada etapa (para la tira). La última no tiene fin. */
export function tramosDeEtapas(inicio: FechaDia, etapas: ConfigEtapa[]): { etapa: ConfigEtapa; desde: FechaDia; hasta: FechaDia | null }[] {
  const r: { etapa: ConfigEtapa; desde: FechaDia; hasta: FechaDia | null }[] = []
  let d = inicio
  etapas.forEach((e, i) => {
    const ultima = i === etapas.length - 1 || e.semanas <= 0
    const hasta = ultima ? null : sumarDias(d, e.semanas * 7 - 1)
    r.push({ etapa: e, desde: d, hasta })
    if (hasta) d = sumarDias(hasta, 1)
  })
  return r
}

export type Veredicto = {
  /** Se acostó dentro de la tolerancia. */
  aHorario: boolean
  /** Horas dentro del rango esperado de la etapa (y despertares dentro de lo normal, si se cargaron). */
  enRango: boolean
  tono: 'bien' | 'normal' | 'aviso' | 'tarde'
  texto: string
}

function horas(min: number): string { const h = Math.floor(min / 60); const m = min % 60; return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h` }
function hora(min: number): string { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

/**
 * Veredicto de una noche. `acostado` y `horaDejarCelu` en minutos desde las 00:00 de la noche (pueden pasar de 1440).
 * Prioridad: acostarse a horario. Si se acostó a horario pero durmió poco (o se despertó), depende de la etapa.
 */
export function veredictoNoche(x: { acostado: number; horaDejarCelu: string; tolerancia: number; minutos: number; despertares?: number; etapa: EtapaActual; nochesCortasSeguidas?: number }): Veredicto {
  const limite = minutosDe(x.horaDejarCelu)
  const limiteNoche = limite < 12 * 60 ? limite + 1440 : limite
  const aHorario = x.acostado <= limiteNoche + x.tolerancia
  const e = x.etapa.etapa
  const pocas = x.minutos < e.horasMin * 60
  const muchas = x.minutos > e.horasMax * 60
  const despertares = x.despertares ?? 0
  const seDesperto = x.despertares !== undefined && x.despertares > e.despertaresNormales
  const enRango = !pocas && !seDesperto
  const dur = horas(x.minutos)
  if (!aHorario) {
    return { aHorario, enRango, tono: 'tarde', texto: `Te acostaste tarde (${hora(x.acostado)}). Mañana, a horario.` }
  }
  if (enRango) {
    const extra = muchas ? ' (más de lo esperado: está bien si lo necesitabas)' : ''
    return { aHorario, enRango, tono: 'bien', texto: `Dormiste bien: a horario y ${dur}${extra}.` }
  }
  const que = pocas && seDesperto ? `dormiste menos y te despertaste ${despertares} ${despertares === 1 ? 'vez' : 'veces'}` : pocas ? 'dormiste menos' : `te despertaste ${despertares} ${despertares === 1 ? 'vez' : 'veces'}`
  const Que = que.charAt(0).toUpperCase() + que.slice(1)
  if (x.etapa.indice === 0) {
    return { aHorario, enRango, tono: 'normal', texto: `${Que}, pero te acostaste a horario. Semana ${x.etapa.semana}: es normal, tu cuerpo se está acostumbrando.` }
  }
  if (!x.etapa.esUltima) {
    const seguidas = x.nochesCortasSeguidas ?? 0
    const aviso = seguidas >= NOCHES_SEGUIDAS_AVISO ? ` Van ${seguidas} noches seguidas: revisá pantalla, café o entreno tarde.` : ''
    return { aHorario, enRango, tono: aviso ? 'aviso' : 'normal', texto: `Te acostaste a horario; todavía se está asentando (${que}).${aviso}` }
  }
  return { aHorario, enRango, tono: 'aviso', texto: `A horario, pero ${que}: revisá pantalla, café o entreno tarde.` }
}

/** Frase corta de la etapa para arriba del gráfico. */
export function fraseDeEtapa(e: EtapaActual): string {
  if (e.indice === 0) return `Semana ${e.semana} · ${e.etapa.nombre}: lo que importa es acostarte a horario; dormir menos o despertarte es normal.`
  if (!e.esUltima) return `Semana ${e.semana} · ${e.etapa.nombre}: el cuerpo se asienta, los despertares bajan.`
  return `Semana ${e.semana} · ${e.etapa.nombre}: una noche mala suelta ya no es adaptación; buscá la causa.`
}

/** Hasta qué semana se puede leer con «Semana siguiente»: la primera de la última etapa (Estable). */
export function ultimaSemanaConInfo(etapas: ConfigEtapa[]): number {
  return etapas.slice(0, -1).reduce((s, e) => s + Math.max(0, e.semanas), 0) + 1
}

const enHoras = (h: number) => String(h).replace('.', ',')

/**
 * Lo que te cuenta el shinobi en Sueño sobre una semana (sale de las etapas editables: si cambian las semanas
 * o las horas, el texto cambia).
 */
export function discursoDeSemana(semana: number, etapas: ConfigEtapa[] = ETAPAS_SUGERIDAS): { titulo: string; texto: string; etapa: number } {
  const s = Math.max(1, Math.round(semana))
  const e = etapaDe(sumarDias('2026-01-05', (s - 1) * 7), '2026-01-05', etapas)
  const { nombre, horasMin, horasMax, despertaresNormales: d } = e.etapa
  const esperado = `Esperá ${enHoras(horasMin)} a ${enHoras(horasMax)} h`
  const desp = d === 0 ? 'ya casi no deberías despertarte' : d === 1 ? 'despertarte una vez es normal' : `despertarte hasta ${d} veces es normal`
  const titulo = `Semana ${s} · ${nombre}`
  if (e.indice === 0) return { etapa: 0, titulo, texto: `Lo importante es acostarte a horario. ${esperado}; ${desp}. Si dormís menos, no pasa nada: el cuerpo se está acostumbrando.` }
  if (!e.esUltima) return { etapa: e.indice, titulo, texto: `El cuerpo se asienta. ${esperado}; ${desp}. Si hay varias noches cortas seguidas, fijate qué las cambia.` }
  return { etapa: e.indice, titulo, texto: `Ya es tu ritmo. ${esperado}; ${desp}. Una noche mala suelta ya no es adaptación: buscá la causa.` }
}

/** Valida y acota lo editado: semanas 0–12, horas 3–14 (mín ≤ máx), despertares 0–5, tolerancia 0–120. */
export function normalizarEtapas(etapas: ConfigEtapa[]): ConfigEtapa[] {
  return etapas.map((e) => {
    const min = Math.max(3, Math.min(14, Number(e.horasMin) || ETAPAS_SUGERIDAS[0].horasMin))
    const max = Math.max(min, Math.min(14, Number(e.horasMax) || min))
    return { nombre: (e.nombre || '').trim() || 'Etapa', semanas: Math.max(0, Math.min(12, Math.round(Number(e.semanas) || 0))), horasMin: min, horasMax: max, despertaresNormales: Math.max(0, Math.min(5, Math.round(Number(e.despertaresNormales) || 0))) }
  })
}

// ---------- Con la base ----------

export type EstadoAdaptacion = { inicio: FechaDia; etapas: ConfigEtapa[]; tolerancia: number; actual: EtapaActual; tramos: ReturnType<typeof tramosDeEtapas>; horaDejarCelu: string }

/** Desde cuándo se cuenta: la fecha editada, si no cuando se creó «Dormir a horario», si no el inicio del ciclo, si no hoy. */
export async function inicioAdaptacion(hoy: FechaDia): Promise<FechaDia> {
  const a = await obtenerAjustes()
  if (a.adaptacion?.desde) return a.adaptacion.desde
  const acostarse = await db().acciones.get('acostarse')
  if (acostarse?.creado) { const f = fechaDe(acostarse.creado, a.zonaHoraria); if (f <= hoy) return f }
  const ciclo = await cicloActivo()
  if (ciclo && ciclo.inicio <= hoy) return ciclo.inicio
  return hoy
}

export async function estadoAdaptacion(hoy: FechaDia): Promise<EstadoAdaptacion> {
  const a = await obtenerAjustes()
  const inicio = await inicioAdaptacion(hoy)
  const etapas = etapasDe(a)
  return { inicio, etapas, tolerancia: toleranciaDe(a), actual: etapaDe(hoy, inicio, etapas), tramos: tramosDeEtapas(inicio, etapas), horaDejarCelu: a.horaDejarCelu }
}

/** Veredicto de una noche ya resumida (Sueño y el «Buenos días» de Hoy). `anteriores`: noches previas, para contar las cortas seguidas. */
export function veredictoDe(n: Pick<NocheDeSuenio, 'noche' | 'acostado' | 'minutos' | 'despertares'>, e: EstadoAdaptacion, anteriores: Pick<NocheDeSuenio, 'noche' | 'minutos'>[] = []): Veredicto {
  const etapa = etapaDe(n.noche, e.inicio, e.etapas)
  let seguidas = n.minutos < etapa.etapa.horasMin * 60 ? 1 : 0
  if (seguidas) for (const x of [...anteriores].filter((x) => x.noche < n.noche).sort((p, q) => (p.noche < q.noche ? 1 : -1))) { if (x.minutos < etapa.etapa.horasMin * 60) seguidas++; else break }
  return veredictoNoche({ acostado: n.acostado, horaDejarCelu: e.horaDejarCelu, tolerancia: e.tolerancia, minutos: n.minutos, despertares: n.despertares, etapa, nochesCortasSeguidas: seguidas })
}
