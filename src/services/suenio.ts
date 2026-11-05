/**
 * Modo sueño: después de «Dejo celu» la app queda en una pantalla casi negra
 * hasta la hora de fin (5:00). Se guarda en la base, así recargar o cerrar la
 * app no lo quita. Salir antes pide confirmación y queda en el historial;
 * abrir la app durante el modo sueño también queda registrado (solo la hora).
 */

import { db } from '../data/db'
import type { EtapaSuenio, FuenteSuenio, ModoSuenio, RegistroSuenio } from '../data/tipos'
import { dormidoEstimado, latenciaValida, levantadoEstimado, minutosDormidos, rangoDormido } from '../sueno/estimar'
import { nocheDesdeRegistro } from '../sueno/fuentes/estimada'
import { nochesEntre } from '../sueno/fuentes'
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
  // Esta es la primera apertura de la mañana: solo cierra la noche (levantado = centro de la ventana habitual).
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

// ---------- Registro de sueño (v0.34: estimación simple, fuentes y correcciones) ----------

/** Al entrar en modo sueño: dormido = «Dejo celu» + latencia (15 min por defecto) y la mañana prevista. */
export async function abrirRegistroDeSuenio(noche: FechaDia, inicio: number, hasta: number): Promise<void> {
  const d = db()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return
  const a = await obtenerAjustes()
  const latencia = latenciaValida(a.latenciaDormirseMinutos)
  const cambios: Partial<RegistroSuenio> = { despertarPrevisto: hasta, aperturas: reg.aperturas ?? 0 }
  if (reg.fuenteDormido !== 'corregido' && reg.fuenteDormido !== 'reloj') Object.assign(cambios, { dormido: dormidoEstimado(reg.acostadoManual ?? inicio, latencia), latenciaMinutos: latencia, fuenteDormido: 'estimado' })
  if (!reg.fuenteAcostado) cambios.fuenteAcostado = 'estimado'
  await d.suenio.update(reg.id!, cambios)
}

/** Una apertura durante la noche solo se cuenta; ya no corre la hora de dormirse. */
export async function anotarAperturaEnRegistro(noche: FechaDia, _inicioModo: number, instante: number): Promise<void> {
  const d = db()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return
  // Abrir el celu en la última media hora antes de la hora de levantarse no es una apertura de la noche.
  if (reg.despertarPrevisto && instante >= reg.despertarPrevisto - MARGEN_MANIANA_MS) return
  await d.suenio.update(reg.id!, { aperturas: (reg.aperturas ?? 0) + 1 })
}

/**
 * Cierra el registro de la noche (al abrir la app a la mañana o salir del modo sueño).
 * La hora de levantarse es siempre el centro de la ventana habitual de 15 min:
 * la apertura del celu no se usa, porque se agarra unos minutos después de levantarse.
 */
export async function registrarDespertar(noche: FechaDia, instante = ahora()): Promise<RegistroSuenio | null> {
  const d = db()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg || reg.levantado) return reg ?? null
  const a = await obtenerAjustes()
  const n = nocheDesdeRegistro(reg, a)
  const levantado = levantadoEstimado(noche, a.horaFinSuenio, a.zonaHoraria)
  const cambios: Partial<RegistroSuenio> = { levantado, fuenteLevantado: 'estimado', minutosDormido: minutosDormidos(n.dormido!.valor, levantado) }
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    await d.suenio.update(reg.id!, cambios)
    await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: reg, despues: { ...reg, ...cambios }, motivo: 'Noche cerrada: levantado = centro de la ventana habitual', instante })
  })
  return { ...reg, ...cambios }
}

export type CorreccionNoche = { acostado?: string; dormido?: string; levantado?: string; /** 0–3 (3 = «3 o más»); null lo borra. */ despertares?: number | null }

/** «HH:MM» de una noche a instante: de 12:00 a 23:59 es el día de la noche; de 00:00 a 11:59, la mañana siguiente. */
export function instanteDeNoche(noche: FechaDia, hm: string, zona: string): number {
  const h = Number(hm.split(':')[0])
  return instanteDe(h >= 12 ? noche : sumarDias(noche, 1), hm, zona)
}

/**
 * Corrige a mano una noche (cualquiera de los tres datos). Lo corregido queda
 * marcado y gana sobre lo estimado. Si la noche no tiene registro (no se tocó
 * «Dejo celu»), se crea a mano: no da XP ni cuenta como «Dormir a horario».
 */
export async function corregirNoche(noche: FechaDia, c: CorreccionNoche): Promise<RegistroSuenio> {
  const d = db()
  const a = await obtenerAjustes()
  const z = a.zonaHoraria
  let reg = await d.suenio.where('noche').equals(noche).first()
  const antes = reg ? { ...reg } : undefined
  if (!reg) {
    if (!c.acostado) throw new Error('Para cargar una noche a mano, poné a qué hora te acostaste')
    const t = instanteDeNoche(noche, c.acostado, z)
    reg = { noche, horaPrevista: a.horaDejarCelu, horaReal: t, retrasoMinutos: 0, cumplido: false, rutinaRegistrada: false, creado: ahora(), sinDejoCelu: true, fuenteAcostado: 'corregido', acostadoManual: t }
    reg.id = (await d.suenio.add(reg)) as number
  }
  const cambios: Partial<RegistroSuenio> = {}
  if (c.acostado) {
    cambios.acostadoManual = instanteDeNoche(noche, c.acostado, z)
    cambios.fuenteAcostado = 'corregido'
  }
  if (c.dormido) {
    cambios.dormido = instanteDeNoche(noche, c.dormido, z)
    cambios.fuenteDormido = 'corregido'
  } else if (c.acostado && reg.fuenteDormido !== 'corregido' && reg.fuenteDormido !== 'reloj') {
    // Si cambió la hora de acostarse y el dormido era estimado, se recalcula con la latencia.
    cambios.dormido = dormidoEstimado(cambios.acostadoManual!, latenciaValida(a.latenciaDormirseMinutos))
    cambios.fuenteDormido = 'estimado'
  }
  if (c.levantado) {
    cambios.levantado = instanteDeNoche(noche, c.levantado, z)
    cambios.fuenteLevantado = 'corregido'
    cambios.levantadoCorregido = true
  }
  if (c.despertares !== undefined) cambios.despertares = c.despertares === null ? undefined : Math.max(0, Math.min(3, Math.round(c.despertares)))
  const despues = { ...reg, ...cambios }
  const n = nocheDesdeRegistro(despues, a)
  if (n.dormido!.valor < n.acostado!.valor) throw new Error('Te dormiste antes de acostarte: revisá las horas')
  if (n.levantado!.valor <= n.dormido!.valor) throw new Error('La hora de levantarte tiene que ser después de la de dormirte')
  if (despues.levantado !== undefined) cambios.minutosDormido = minutosDormidos(n.dormido!.valor, n.levantado!.valor)
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    await d.suenio.update(reg!.id!, cambios)
    await registrarEvento({ tipo: antes ? 'corregir' : 'crear', entidad: 'suenio', entidadId: noche, antes, despues: { ...despues, ...cambios }, motivo: 'Noche corregida a mano' })
  })
  return { ...despues, ...cambios }
}

/** Vuelve un dato corregido a lo estimado. */
export async function volverAEstimado(noche: FechaDia, campo: 'acostado' | 'dormido' | 'levantado'): Promise<void> {
  const d = db()
  const a = await obtenerAjustes()
  const reg = await d.suenio.where('noche').equals(noche).first()
  if (!reg) return
  const cambios: Partial<RegistroSuenio> = {}
  const acostado = campo === 'acostado' ? reg.horaReal : (reg.acostadoManual ?? reg.horaReal)
  if (campo === 'acostado') { cambios.acostadoManual = undefined; cambios.fuenteAcostado = 'estimado' }
  if (campo === 'dormido' || (campo === 'acostado' && reg.fuenteDormido !== 'corregido')) {
    cambios.dormido = dormidoEstimado(acostado, latenciaValida(a.latenciaDormirseMinutos))
    cambios.fuenteDormido = 'estimado'
  }
  if (campo === 'levantado') {
    cambios.levantado = reg.levantado !== undefined ? levantadoEstimado(noche, a.horaFinSuenio, a.zonaHoraria) : undefined
    cambios.fuenteLevantado = 'estimado'
    cambios.levantadoCorregido = false
  }
  const n = nocheDesdeRegistro({ ...reg, ...cambios }, a)
  if (reg.levantado !== undefined || cambios.levantado !== undefined) cambios.minutosDormido = minutosDormidos(n.dormido!.valor, n.levantado!.valor)
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    await d.suenio.update(reg.id!, cambios)
    await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: reg, despues: { ...reg, ...cambios }, motivo: `Volver a lo estimado: ${campo}` })
  })
}

/** Compatibilidad: corrige solo la hora de levantarse. */
export async function corregirLevantado(noche: FechaDia, hm: string): Promise<RegistroSuenio | null> {
  return corregirNoche(noche, { levantado: hm })
}

export type NocheDeSuenio = {
  noche: FechaDia
  /** Minutos desde las 00:00 del día de la noche (puede pasar de 1440 si es después de medianoche). */
  acostado: number
  dormido: number
  /** «Dormido entre … y …» cuando es estimado (latencia ± 5). */
  dormidoRango: [number, number] | null
  levantado: number
  minutos: number
  fuentes: { acostado: FuenteSuenio; dormido: FuenteSuenio; levantado: FuenteSuenio }
  /** Algún dato es estimado. */
  estimado: boolean
  /** Algún dato fue corregido a mano. */
  corregido: boolean
  /** Algún dato viene del reloj. */
  reloj: boolean
  /** «Dejo celu» a tiempo (cuenta para Dormir a horario). */
  cumplido: boolean
  sinDejoCelu: boolean
  aperturas: number
  /** Despertares cargados a mano (si no se cargaron, no se asume nada). */
  despertares?: number
  etapas?: EtapaSuenio[]
}

export type ResumenSuenio = {
  noches: NocheDeSuenio[]
  anoche: NocheDeSuenio | null
  /** Promedios en minutos desde las 00:00 de la noche (acostado y dormido pueden pasar de 1440). */
  promedio: { acostado: number; dormido: number; levantado: number; minutos: number } | null
  /** Desvío típico de la hora de dormirse, en minutos: cuanto más bajo, más regular. */
  regularidadMinutos: number | null
  /** Minutos por noche por encima (+) o por debajo (−) del objetivo. */
  diferenciaObjetivo: number | null
  latencia: number
  objetivoMinutos: number
  /** Cómo vas mejorando: esta semana (últimas 7 noches) contra la anterior. */
  mejora: {
    semana: number | null
    semanaAnterior: number | null
    regularidad: number | null
    regularidadAnterior: number | null
    /** Noches seguidas con «Dejo celu» a tiempo, hasta anoche. */
    racha: number
  }
}

function minutosDesdeNoche(instante: number, noche: FechaDia, zona: string): number {
  return Math.round((instante - instanteDe(noche, '00:00', zona)) / 60_000)
}

const promedioDe = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
function desvio(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.round(Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length))
}

/** Noches entre dos fechas, combinando las fuentes (reloj > corregido > estimado). */
export async function nochesDeSuenio(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<NocheDeSuenio[]> {
  const a = await obtenerAjustes()
  const regs = new Map((await db().suenio.where('noche').between(desde, hasta, true, true).toArray()).map((r) => [r.noche, r]))
  const latencia = latenciaValida(a.latenciaDormirseMinutos)
  const r: NocheDeSuenio[] = []
  for (const n of await nochesEntre(desde, hasta)) {
    const reg = regs.get(n.noche)
    // La noche de hoy todavía no terminó: no entra en el gráfico ni en los promedios.
    if (n.noche >= hoy && !reg?.levantado && n.levantado?.fuente !== 'reloj') continue
    if (!n.acostado || !n.dormido || !n.levantado) continue
    const fuentes = { acostado: n.acostado.fuente, dormido: n.dormido.fuente, levantado: n.levantado.fuente }
    const lista = Object.values(fuentes)
    const z = a.zonaHoraria
    r.push({
      noche: n.noche,
      acostado: minutosDesdeNoche(n.acostado.valor, n.noche, z),
      dormido: minutosDesdeNoche(n.dormido.valor, n.noche, z),
      dormidoRango: fuentes.dormido === 'estimado' ? (rangoDormido(n.acostado.valor, reg?.latenciaMinutos ?? latencia).map((x) => minutosDesdeNoche(x, n.noche, z)) as [number, number]) : null,
      levantado: minutosDesdeNoche(n.levantado.valor, n.noche, z),
      minutos: minutosDormidos(n.dormido.valor, n.levantado.valor),
      fuentes,
      estimado: lista.includes('estimado'),
      corregido: lista.includes('corregido'),
      reloj: lista.includes('reloj'),
      cumplido: !!reg?.cumplido,
      sinDejoCelu: !!reg?.sinDejoCelu,
      aperturas: reg?.aperturas ?? 0,
      despertares: reg?.despertares,
      etapas: n.etapas,
    })
  }
  return r
}

/** Las últimas `dias` noches, para la pantalla Sueño, la tarjeta de Progreso y «Buenos días». */
export async function resumenSuenio(hoy: FechaDia, dias = 14): Promise<ResumenSuenio> {
  const a = await obtenerAjustes()
  const desde = sumarDias(hoy, -Math.max(dias, 14))
  const todas = await nochesDeSuenio(desde, hoy, hoy)
  const noches = todas.filter((n) => n.noche >= sumarDias(hoy, -dias))
  const promedio = noches.length
    ? { acostado: promedioDe(noches.map((n) => n.acostado))!, dormido: promedioDe(noches.map((n) => n.dormido))!, levantado: promedioDe(noches.map((n) => n.levantado))!, minutos: promedioDe(noches.map((n) => n.minutos))! }
    : null
  const objetivoMinutos = Math.round(a.objetivoSuenioHoras * 60)
  const ultima = noches[noches.length - 1] ?? null
  // Semana: las 7 noches hasta anoche; la anterior, las 7 de antes.
  const semana = todas.filter((n) => n.noche >= sumarDias(hoy, -7))
  const anterior = todas.filter((n) => n.noche >= sumarDias(hoy, -14) && n.noche < sumarDias(hoy, -7))
  // Racha: noches seguidas con «Dejo celu» a tiempo, hacia atrás desde anoche (o esta noche, si ya se tocó a tiempo).
  const regs = new Map((await db().suenio.where('noche').between(sumarDias(hoy, -400), hoy, true, true).toArray()).map((r) => [r.noche, r]))
  let racha = 0
  let f = regs.get(hoy)?.cumplido ? hoy : sumarDias(hoy, -1)
  while (regs.get(f)?.cumplido) { racha++; f = sumarDias(f, -1) }
  return {
    noches,
    anoche: ultima && (ultima.noche === sumarDias(hoy, -1) || ultima.noche === hoy) ? ultima : null,
    promedio,
    regularidadMinutos: desvio(noches.map((n) => n.dormido)),
    diferenciaObjetivo: promedio ? promedio.minutos - objetivoMinutos : null,
    latencia: latenciaValida(a.latenciaDormirseMinutos),
    objetivoMinutos,
    mejora: {
      semana: promedioDe(semana.map((n) => n.minutos)),
      semanaAnterior: promedioDe(anterior.map((n) => n.minutos)),
      regularidad: desvio(semana.map((n) => n.dormido)),
      regularidadAnterior: desvio(anterior.map((n) => n.dormido)),
      racha,
    },
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
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
