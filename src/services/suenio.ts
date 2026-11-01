/**
 * Modo sueño: después de «Dejo celu» la app queda en una pantalla casi negra
 * hasta la hora de fin (5:00). Se guarda en la base, así recargar o cerrar la
 * app no lo quita. Salir antes pide confirmación y queda en el historial;
 * abrir la app durante el modo sueño también queda registrado (solo la hora).
 */

import { db } from '../data/db'
import type { ModoSuenio, RegistroSuenio } from '../data/tipos'
import { fechaDe, instanteDe, sumarDias, type FechaDia } from '../domain/fechas'
import { obtenerAjustes, registrarEvento } from './base'
import { pilaresDelDia, rachaActual } from './dia'
import { ahora } from './reloj'

/** Media hora antes de la hora de levantarse ya se considera «mañana»: abrir la app cierra la noche y no cuenta como apertura. */
const MARGEN_MANIANA_MS = 30 * 60_000

export async function modoSuenioActivo(): Promise<ModoSuenio | undefined> {
  return db().modoSuenio.get('activo')
}

/** Instante de fin del modo sueño que empieza en `inicio`: la próxima hora de fin (5:00) después de ese instante. */
export async function finDelModoSuenio(inicio: number): Promise<number> {
  const a = await obtenerAjustes()
  const hoy = fechaDe(inicio, a.zonaHoraria)
  const deHoy = instanteDe(hoy, a.horaFinSuenio, a.zonaHoraria)
  return deHoy > inicio ? deHoy : instanteDe(sumarDias(hoy, 1), a.horaFinSuenio, a.zonaHoraria)
}

/** Resumen de una línea para «Buenas noches»: pilares de hoy y racha. */
export async function resumenDeLaNoche(noche: FechaDia): Promise<string> {
  const p = await pilaresDelDia(noche)
  const r = await rachaActual(noche)
  return `${p.cumplidos} de ${p.aplican} pilares hoy · Racha: ${r} ${r === 1 ? 'día' : 'días'}`
}

/** Entra en modo sueño después de «Dejo celu». Idempotente para la misma noche. */
export async function entrarModoSuenio(noche: FechaDia, tarde: boolean, instante = ahora()): Promise<ModoSuenio> {
  const d = db()
  const existente = await d.modoSuenio.get('activo')
  if (existente && existente.noche === noche) return existente
  const estado: ModoSuenio = { id: 'activo', noche, inicio: instante, hasta: await finDelModoSuenio(instante), tarde, resumen: await resumenDeLaNoche(noche), aperturas: [] }
  await d.transaction('rw', [d.modoSuenio, d.eventos], async () => {
    await d.modoSuenio.put(estado)
    await registrarEvento({ tipo: 'modo_suenio', entidad: 'modo_suenio', entidadId: noche, despues: { inicio: estado.inicio, hasta: estado.hasta, tarde }, motivo: 'Entrar en modo sueño' })
  })
  await abrirRegistroDeSuenio(noche, instante, estado.hasta)
  return estado
}

/** Sale del modo sueño antes de la hora: queda en el historial con el motivo. */
export async function salirModoSuenio(motivo = 'Salida antes de hora', instante = ahora()): Promise<void> {
  const d = db()
  const estado = await d.modoSuenio.get('activo')
  if (!estado) return
  await d.transaction('rw', [d.modoSuenio, d.eventos], async () => {
    await d.modoSuenio.delete('activo')
    await registrarEvento({ tipo: 'modo_suenio', entidad: 'modo_suenio', entidadId: estado.noche, antes: estado, motivo: `Salir del modo sueño: ${motivo}`, instante })
  })
  // Si ya pasaron varias horas, salir es levantarse: cierra el registro de la noche.
  if (instante - estado.inicio >= 3 * 60 * 60_000) await registrarDespertar(estado.noche, instante)
}

/**
 * Si el modo sueño ya terminó (pasó la hora de fin), lo cierra y devuelve
 * la noche, para mostrar «Buenos días». Si sigue activo devuelve null.
 */
export async function terminarModoSuenioSiCorresponde(instante = ahora()): Promise<ModoSuenio | null> {
  const d = db()
  const estado = await d.modoSuenio.get('activo')
  if (!estado) return null
  // Abrir la app en la última media hora antes de la hora de levantarse ya cuenta como mañana (sin alarma, uno se levanta un poco antes o después).
  if (instante < estado.hasta - MARGEN_MANIANA_MS) return null
  await d.transaction('rw', [d.modoSuenio, d.eventos], async () => {
    await d.modoSuenio.delete('activo')
    await registrarEvento({ tipo: 'modo_suenio', entidad: 'modo_suenio', entidadId: estado.noche, antes: estado, motivo: instante < estado.hasta ? 'Terminó al abrir la app poco antes de la hora de levantarse' : 'Terminó solo a la hora de fin', instante })
  })
  // Esta es la primera apertura de la mañana: cierra el registro de la noche (hora de levantarse = ahora − unos minutos).
  await registrarDespertar(estado.noche, instante)
  return estado
}

/** Registra que se abrió la app durante el modo sueño (solo la hora). No da ni quita XP. */
export async function registrarAperturaEnSuenio(instante = ahora()): Promise<number> {
  const d = db()
  const estado = await d.modoSuenio.get('activo')
  if (!estado || instante >= estado.hasta) return 0
  // Dos aperturas en menos de un minuto cuentan como una.
  const ultima = estado.aperturas[estado.aperturas.length - 1]
  if (ultima && instante - ultima < 60_000) return estado.aperturas.length
  const aperturas = [...estado.aperturas, instante]
  await d.transaction('rw', [d.modoSuenio, d.eventos], async () => {
    await d.modoSuenio.put({ ...estado, aperturas })
    await registrarEvento({ tipo: 'modo_suenio', entidad: 'apertura_suenio', entidadId: estado.noche, despues: { instante }, motivo: 'Abrió la app en modo sueño', instante })
  })
  await anotarAperturaEnRegistro(estado.noche, estado.inicio, instante)
  return aperturas.length
}

/** Aperturas de la app en modo sueño entre dos instantes (para la revisión semanal). */
export async function aperturasEnSuenioEntre(desde: number, hasta: number): Promise<number[]> {
  const eventos = await db().eventos.where('instante').between(desde, hasta, true, true).filter((e) => e.entidad === 'apertura_suenio').toArray()
  return eventos.map((e) => e.instante)
}

// ---------- Registro de sueño y ritmo circadiano (cambios 11) ----------

const MAX_LATENCIA = 90
/** Una apertura de la app dentro de este tiempo desde «Dejo celu» cuenta como «todavía no me dormí». */
const VENTANA_APERTURA_TEMPRANA_MS = 90 * 60_000

function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/**
 * Minutos que se tarda en dormirse, aprendidos: si en noches anteriores abrió
 * la app poco después de «Dejo celu», la app asume que se durmió después de
 * la última apertura temprana. Mediana de las últimas 14 noches con datos.
 */
export async function latenciaAprendida(): Promise<number> {
  const a = await obtenerAjustes()
  const base = a.latenciaSuenioMinutos
  const noches = await db().suenio.orderBy('noche').reverse().limit(14).toArray()
  // Solo aprende de noches con evidencia real (una apertura temprana que corrió la hora de dormirse);
  // las estimadas no cuentan, para no alimentar la estimación con ella misma.
  const muestras = noches.filter((n) => n.latenciaReal !== undefined).map((n) => n.latenciaReal!)
  // Hacen falta al menos tres noches observadas para cambiar la base.
  const m = muestras.length >= 3 ? mediana(muestras) : null
  if (m === null) return base
  return Math.min(MAX_LATENCIA, Math.max(base, m))
}

/** Al entrar en modo sueño: estima la hora de dormirse y anota el despertar previsto en el registro de la noche. */
export async function abrirRegistroDeSuenio(noche: FechaDia, inicio: number, hasta: number): Promise<void> {
  const d = db()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return
  const latencia = await latenciaAprendida()
  await d.suenio.update(reg.id!, { dormido: inicio + latencia * 60_000, latenciaMinutos: latencia, despertarPrevisto: hasta, aperturas: 0 })
}

/** Una apertura temprana corre la hora estimada de dormirse (todavía estaba despierto). */
export async function anotarAperturaEnRegistro(noche: FechaDia, inicioModo: number, instante: number): Promise<void> {
  const d = db()
  const a = await obtenerAjustes()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return
  // Abrir el celu en la última media hora antes de la hora de levantarse no es una apertura de la noche.
  if (reg.despertarPrevisto && instante >= reg.despertarPrevisto - MARGEN_MANIANA_MS) return
  const cambios: Partial<RegistroSuenio> = { aperturas: (reg.aperturas ?? 0) + 1 }
  if (instante - inicioModo <= VENTANA_APERTURA_TEMPRANA_MS) {
    cambios.dormido = instante + a.latenciaSuenioMinutos * 60_000
    cambios.latenciaReal = Math.round((cambios.dormido - reg.horaReal) / 60_000)
  }
  await d.suenio.update(reg.id!, cambios)
}

/**
 * Cierra el registro de la noche al levantarse. `instante` es cuando abrió
 * la app a la mañana o tocó «Ya me levanté»; si es mucho después del
 * despertar previsto (ya pasó la mañana), se usa el previsto.
 */
export async function registrarDespertar(noche: FechaDia, instante = ahora()): Promise<RegistroSuenio | null> {
  const d = db()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return reg ?? null
  const a = await obtenerAjustes()
  const previsto = reg.despertarPrevisto ?? instante
  // Sin alarma: la persona se levanta y recién después agarra el celu, así que
  // la hora de levantarse es la primera apertura menos unos minutos. Si abre
  // muy tarde (más de 3 h después de lo previsto), se usa la hora prevista.
  const antes = (a.minutosAntesDelCelu ?? 5) * 60_000
  const dormido = reg.dormido ?? reg.horaReal
  const levantado = instante > previsto + 3 * 60 * 60_000 ? previsto : Math.max(dormido + 60_000, instante - antes)
  const minutosDormido = Math.max(0, Math.round((levantado - dormido) / 60_000))
  const cambios: Partial<RegistroSuenio> = { levantado, minutosDormido }
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    await d.suenio.update(reg.id!, cambios)
    await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: reg, despues: { ...reg, ...cambios }, motivo: 'Registro de sueño cerrado al levantarse', instante })
  })
  return { ...reg, ...cambios }
}

/** Corrige a mano la hora de levantarse de una noche («HH:MM» de la mañana siguiente). */
export async function corregirLevantado(noche: FechaDia, hm: string): Promise<RegistroSuenio | null> {
  const d = db()
  const a = await obtenerAjustes()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg) return null
  const levantado = instanteDe(sumarDias(noche, 1), hm, a.zonaHoraria)
  const dormido = reg.dormido ?? reg.horaReal
  const cambios: Partial<RegistroSuenio> = { levantado, minutosDormido: Math.max(0, Math.round((levantado - dormido) / 60_000)), levantadoCorregido: true }
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    await d.suenio.update(reg.id!, cambios)
    await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: reg, despues: { ...reg, ...cambios }, motivo: 'Hora de levantarse corregida a mano' })
  })
  return { ...reg, ...cambios }
}

export type NocheDeSuenio = {
  noche: FechaDia
  /** Minutos desde las 00:00 del día de la noche (puede pasar de 1440 si es después de medianoche). */
  acostado: number
  dormido: number
  levantado: number
  minutos: number
  /** Sin apertura a la mañana: se usó la hora prevista. */
  estimado: boolean
  /** La hora de levantarse se corrigió a mano. */
  corregido: boolean
  cumplido: boolean
  aperturas: number
}

export type ResumenSuenio = {
  noches: NocheDeSuenio[]
  anoche: NocheDeSuenio | null
  /** Promedios en minutos desde las 00:00 de la noche (acostado y dormido pueden pasar de 1440). */
  promedio: { acostado: number; dormido: number; levantado: number; minutos: number } | null
  /** Desvío típico de la hora de acostarse, en minutos: cuanto más bajo, más regular. */
  regularidadMinutos: number | null
  /** Minutos por noche por encima (+) o por debajo (−) del objetivo. */
  diferenciaObjetivo: number | null
  latenciaAprendida: number
  objetivoMinutos: number
}

function minutosDesdeNoche(instante: number, noche: FechaDia, zona: string): number {
  return Math.round((instante - instanteDe(noche, '00:00', zona)) / 60_000)
}

/** Las últimas `dias` noches con registro, para la pantalla de sueño y «Buenos días». */
export async function resumenSuenio(hoy: FechaDia, dias = 14): Promise<ResumenSuenio> {
  const a = await obtenerAjustes()
  const desde = sumarDias(hoy, -dias)
  const regs = (await db().suenio.where('noche').between(desde, hoy, true, true).toArray()).sort((x, y) => x.noche.localeCompare(y.noche))
  const noches: NocheDeSuenio[] = regs.map((r) => {
    const dormido = r.dormido ?? r.horaReal + a.latenciaSuenioMinutos * 60_000
    const levantado = r.levantado ?? r.despertarPrevisto ?? instanteDe(sumarDias(r.noche, 1), a.horaFinSuenio, a.zonaHoraria)
    return {
      noche: r.noche,
      acostado: minutosDesdeNoche(r.horaReal, r.noche, a.zonaHoraria),
      dormido: minutosDesdeNoche(dormido, r.noche, a.zonaHoraria),
      levantado: minutosDesdeNoche(levantado, r.noche, a.zonaHoraria),
      minutos: r.minutosDormido ?? Math.max(0, Math.round((levantado - dormido) / 60_000)),
      estimado: !r.levantado,
      corregido: !!r.levantadoCorregido,
      cumplido: r.cumplido,
      aperturas: r.aperturas ?? 0,
    }
  })
  const prom = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length)
  const cerradas = noches.filter((n) => !n.estimado || n.noche < hoy)
  const promedio = cerradas.length
    ? { acostado: prom(cerradas.map((n) => n.acostado)), dormido: prom(cerradas.map((n) => n.dormido)), levantado: prom(cerradas.map((n) => n.levantado)), minutos: prom(cerradas.map((n) => n.minutos)) }
    : null
  let regularidadMinutos: number | null = null
  if (promedio && cerradas.length >= 2) {
    const v = cerradas.reduce((s, n) => s + (n.acostado - promedio.acostado) ** 2, 0) / cerradas.length
    regularidadMinutos = Math.round(Math.sqrt(v))
  }
  const objetivoMinutos = Math.round(a.objetivoSuenioHoras * 60)
  const ultima = noches[noches.length - 1] ?? null
  return {
    noches,
    anoche: ultima && (ultima.noche === sumarDias(hoy, -1) || ultima.noche === hoy) ? ultima : null,
    promedio,
    regularidadMinutos,
    diferenciaObjetivo: promedio ? promedio.minutos - objetivoMinutos : null,
    latenciaAprendida: await latenciaAprendida(),
    objetivoMinutos,
  }
}

/** «6 h 40 min». */
export function duracionSuenio(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/** Minutos desde las 00:00 (pueden pasar de 1440) como «HH:MM». */
export function horaDeMinutos(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
