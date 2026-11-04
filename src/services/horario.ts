/**
 * Mi horario: bloques fijos de la semana (colegio, facultad, trabajo, entreno, otro) que viven en el
 * Calendario. La app los usa para saber dónde está la persona: la línea del día en Hoy, los avisos
 * (callados durante un bloque obligatorio, uno solo al salir), los huecos libres y el entreno de hoy.
 * Fuentes de verdad que no se duplican: el sueño sale de los ajustes, el entreno de la acción
 * «entrenamiento» (hora, días y «Empezar hasta») y de la hora prevista del compromiso del día.
 */
import { db } from '../data/db'
import type { BloqueHorario, ConfigHorario, FechaClave, Horario, TipoBloque } from '../data/tipos'
import { diaSemanaDe, esHoraValida, instanteDe, minutosDe, sumarDias, type FechaDia } from '../domain/fechas'
import { fechaHoy, guardarAjustes, obtenerAjustes } from './base'
import { caeEn } from './fechasClave'
import { esFeriado } from './feriados'
import { ahora, nuevoId } from './reloj'

export const ID_HORARIO_INICIAL = 'horario-1'

export function configVacia(): ConfigHorario {
  return { activo: ID_HORARIO_INICIAL, horarios: [{ id: ID_HORARIO_INICIAL, nombre: 'Mi horario', bloques: [] }], excepciones: {} }
}

export async function configHorario(): Promise<ConfigHorario> {
  const a = await obtenerAjustes()
  const c = a.horario ?? configVacia()
  if (!c.horarios.some((h) => h.id === c.activo)) c.activo = c.horarios[0]?.id ?? ID_HORARIO_INICIAL
  if (!c.horarios.length) c.horarios = configVacia().horarios
  return c
}

export async function horarioActivo(): Promise<Horario> {
  const c = await configHorario()
  return c.horarios.find((h) => h.id === c.activo) ?? c.horarios[0]
}

async function guardar(c: ConfigHorario): Promise<ConfigHorario> {
  await guardarAjustes({ horario: c }, 'Mi horario')
  return c
}

function validar(b: Pick<BloqueHorario, 'nombre' | 'desde' | 'hasta' | 'dias'>): void {
  if (!b.nombre.trim()) throw new Error('El bloque necesita un nombre')
  if (!esHoraValida(b.desde) || !esHoraValida(b.hasta)) throw new Error('Hora inválida')
  if (minutosDe(b.hasta) <= minutosDe(b.desde)) throw new Error('«Hasta» tiene que ser después de «desde»')
  if (!b.dias.length) throw new Error('Elegí al menos un día')
}

/** Crea o edita un bloque del horario activo. El bloque de entreno escribe en la acción «entrenamiento». */
export async function guardarBloque(b: Omit<BloqueHorario, 'id'> & { id?: string }): Promise<BloqueHorario> {
  validar(b)
  if (b.id === ID_BLOQUE_ENTRENO || b.tipo === 'entreno') return guardarBloqueEntreno(b)
  const c = await configHorario()
  const h = c.horarios.find((x) => x.id === c.activo)!
  const bloque: BloqueHorario = { id: b.id ?? nuevoId('blq-'), nombre: b.nombre.trim(), tipo: b.tipo, dias: [...new Set(b.dias)].sort(), desde: b.desde, hasta: b.hasta }
  const i = h.bloques.findIndex((x) => x.id === bloque.id)
  if (i >= 0) h.bloques[i] = bloque
  else h.bloques.push(bloque)
  await guardar(c)
  return bloque
}

export const ID_BLOQUE_ENTRENO = 'entreno'

/** El entreno no se guarda como bloque: sus datos van a la acción (días, hora y «Empezar hasta»). */
async function guardarBloqueEntreno(b: Omit<BloqueHorario, 'id'> & { id?: string }): Promise<BloqueHorario> {
  const d = db()
  const a = await d.acciones.get('entrenamiento')
  if (!a) throw new Error('No hay pilar de entrenamiento')
  const dias = [...new Set(b.dias)].sort()
  await d.acciones.update('entrenamiento', { dias, hora: b.desde, horaLimiteInicio: b.hasta, horasPorDia: undefined })
  // Los compromisos de los próximos días toman la hora nueva (los de hoy ya iniciados, no).
  const f0 = await fechaHoy()
  for (let i = 0; i < 14; i++) {
    const f = sumarDias(f0, i)
    const c = await d.compromisos.get(`entrenamiento:${f}`)
    if (c && c.estado === 'pendiente') await d.compromisos.update(c.id, { horaPrevista: b.desde })
  }
  return { id: ID_BLOQUE_ENTRENO, nombre: a.nombre, tipo: 'entreno', dias, desde: b.desde, hasta: b.hasta }
}

export async function borrarBloque(id: string): Promise<void> {
  if (id === ID_BLOQUE_ENTRENO) throw new Error('El entreno se apaga desde Más → Pilares')
  const c = await configHorario()
  const h = c.horarios.find((x) => x.id === c.activo)!
  h.bloques = h.bloques.filter((b) => b.id !== id)
  await guardar(c)
}

/** Mantener apretado un bloque: copiarlo a otros días (suma los días al mismo bloque). */
export async function copiarADias(id: string, dias: number[]): Promise<void> {
  const h = await horarioActivo()
  const b = h.bloques.find((x) => x.id === id)
  if (!b) throw new Error('Ese bloque no existe')
  await guardarBloque({ ...b, dias: [...b.dias, ...dias] })
}

// ---------- Horarios guardados ----------

export async function nuevoHorario(nombre: string, copiarDelActivo = false): Promise<Horario> {
  const c = await configHorario()
  const base = c.horarios.find((h) => h.id === c.activo)
  const h: Horario = { id: nuevoId('hor-'), nombre: nombre.trim() || `Horario ${c.horarios.length + 1}`, bloques: copiarDelActivo && base ? base.bloques.map((b) => ({ ...b, id: nuevoId('blq-') })) : [] }
  c.horarios.push(h)
  c.activo = h.id
  await guardar(c)
  return h
}

export async function activarHorario(id: string): Promise<void> {
  const c = await configHorario()
  if (!c.horarios.some((h) => h.id === id)) throw new Error('Ese horario no existe')
  c.activo = id
  await guardar(c)
}

export async function renombrarHorario(id: string, nombre: string): Promise<void> {
  const c = await configHorario()
  const h = c.horarios.find((x) => x.id === id)
  if (!h) throw new Error('Ese horario no existe')
  h.nombre = nombre.trim() || h.nombre
  await guardar(c)
}

export async function borrarHorario(id: string): Promise<void> {
  const c = await configHorario()
  if (c.horarios.length <= 1) throw new Error('Tiene que quedar al menos un horario')
  c.horarios = c.horarios.filter((h) => h.id !== id)
  if (c.activo === id) c.activo = c.horarios[0].id
  await guardar(c)
}

// ---------- Plantillas ----------

export const PLANTILLAS: { id: string; nombre: string; tipo: TipoBloque; dias: number[]; desde: string; hasta: string }[] = [
  { id: 'cursada', nombre: 'Cursada', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '13:00' },
  { id: 'trabajo', nombre: 'Trabajo', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '18:00' },
]

// ---------- Excepciones por fecha ----------

export async function apagarBloqueEnFecha(fecha: FechaDia, bloqueId: string): Promise<void> {
  const c = await configHorario()
  const lista = c.excepciones[fecha] ?? []
  if (!lista.includes(bloqueId)) c.excepciones[fecha] = [...lista, bloqueId]
  await guardar(c)
}

export async function encenderBloqueEnFecha(fecha: FechaDia, bloqueId: string): Promise<void> {
  const c = await configHorario()
  const lista = (c.excepciones[fecha] ?? []).filter((x) => x !== bloqueId)
  if (lista.length) c.excepciones[fecha] = lista
  else delete c.excepciones[fecha]
  await guardar(c)
}

// ---------- Qué hay cada día ----------

export type OrigenBloque = 'bloque' | 'entreno' | 'suenio' | 'fechaClave'

/** Un bloque ya resuelto para una fecha concreta, en minutos desde las 0:00. */
export type BloqueDia = {
  id: string
  nombre: string
  tipo: TipoBloque | 'dormir'
  origen: OrigenBloque
  desde: string
  hasta: string
  min: number
  max: number
  /** El entreno es variable: hora de hoy (si se corrió) y margen hasta «Empezar hasta». */
  variable?: boolean
  /** Está apagado ese día (excepción o feriado). Se devuelve igual para poder volver a encenderlo. */
  apagado?: boolean
  motivoApagado?: 'excepcion' | 'feriado'
}

const ENTRENO_MINUTOS = 42

function bloqueDeFechaClave(fc: FechaClave): BloqueDia | null {
  if (!fc.hora || !esHoraValida(fc.hora)) return null
  const desde = fc.hora
  const hasta = fc.horaFin && esHoraValida(fc.horaFin) && minutosDe(fc.horaFin) > minutosDe(desde) ? fc.horaFin : minutoAHora(Math.min(24 * 60 - 1, minutosDe(desde) + 120))
  return { id: `fc:${fc.id}`, nombre: fc.titulo, tipo: 'obligatorio', origen: 'fechaClave', desde, hasta, min: minutosDe(desde), max: minutosDe(hasta) }
}

export function minutoAHora(m: number): string {
  const x = Math.max(0, Math.min(24 * 60, Math.round(m)))
  return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}

/** Todos los bloques de una fecha (incluye los apagados, marcados), ordenados por hora. */
export async function bloquesDelDia(fecha: FechaDia, opciones: { conApagados?: boolean } = {}): Promise<BloqueDia[]> {
  const d = db()
  const a = await obtenerAjustes()
  const c = a.horario ?? configVacia()
  const h = c.horarios.find((x) => x.id === c.activo) ?? c.horarios[0]
  const ds = diaSemanaDe(fecha)
  const apagados = new Set(c.excepciones[fecha] ?? [])
  const feriado = await esFeriado(fecha)
  const lista: BloqueDia[] = []
  for (const b of h?.bloques ?? []) {
    if (!b.dias.includes(ds)) continue
    const x: BloqueDia = { id: b.id, nombre: b.nombre, tipo: b.tipo, origen: 'bloque', desde: b.desde, hasta: b.hasta, min: minutosDe(b.desde), max: minutosDe(b.hasta) }
    if (apagados.has(b.id)) { x.apagado = true; x.motivoApagado = 'excepcion' }
    else if (feriado && b.tipo === 'obligatorio') { x.apagado = true; x.motivoApagado = 'feriado' }
    lista.push(x)
  }
  // Entreno: los días de la acción; la hora de hoy si se corrió.
  const entreno = await d.acciones.get('entrenamiento')
  if (entreno?.activa) {
    const comp = await d.compromisos.get(`entrenamiento:${fecha}`)
    const programado = comp ? comp.estado !== 'reprogramado' : entreno.dias.includes(ds)
    if (programado) {
      const desde = comp?.horaPrevista ?? entreno.horasPorDia?.[ds] ?? entreno.hora ?? '19:00'
      const limite = entreno.horaLimiteInicio && minutosDe(entreno.horaLimiteInicio) > minutosDe(desde) ? entreno.horaLimiteInicio : null
      const dur = entreno.duracionMinutos ?? entreno.minutosMinimos ?? ENTRENO_MINUTOS
      const hasta = minutoAHora(minutosDe(limite ?? desde) + dur)
      const x: BloqueDia = { id: ID_BLOQUE_ENTRENO, nombre: entreno.nombre, tipo: 'entreno', origen: 'entreno', desde, hasta, min: minutosDe(desde), max: minutosDe(hasta), variable: true }
      if (apagados.has(ID_BLOQUE_ENTRENO)) { x.apagado = true; x.motivoApagado = 'excepcion' }
      lista.push(x)
    }
  }
  // Fechas clave con hora: obligatorias ese día.
  for (const fc of await d.fechasClave.toArray()) {
    if (!caeEn(fc, fecha)) continue
    const x = bloqueDeFechaClave(fc)
    if (x) lista.push(x)
  }
  // Dormir: de los ajustes (no se edita acá).
  const dormir = minutosDe(a.horaDormido)
  const despertar = minutosDe(a.horaFinSuenio ?? '06:00')
  lista.push({ id: 'dormir-noche', nombre: 'Dormir', tipo: 'dormir', origen: 'suenio', desde: a.horaDormido, hasta: '24:00', min: dormir, max: 24 * 60 })
  if (despertar > 0) lista.push({ id: 'dormir-madrugada', nombre: 'Dormir', tipo: 'dormir', origen: 'suenio', desde: '00:00', hasta: a.horaFinSuenio ?? '06:00', min: 0, max: despertar })
  const salida = opciones.conApagados ? lista : lista.filter((x) => !x.apagado)
  return salida.sort((p, q) => p.min - q.min || p.max - q.max)
}

/** Bloques de varios días (para las franjas del calendario). */
export async function bloquesEntre(desde: FechaDia, hasta: FechaDia): Promise<Map<FechaDia, BloqueDia[]>> {
  const m = new Map<FechaDia, BloqueDia[]>()
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) m.set(f, (await bloquesDelDia(f)).filter((b) => b.tipo !== 'dormir'))
  return m
}

export type Momento = {
  /** Bloque en curso (no cuenta dormir). */
  ahora: BloqueDia | null
  /** El que sigue hoy, si hay. */
  siguiente: BloqueDia | null
  /** Minutos libres hasta el siguiente bloque (o hasta alistarse). */
  libres: number
  /** Hasta qué hora corre el hueco libre. */
  libreHasta: string
  enObligatorio: boolean
}

/** Dónde está la persona a un instante dado. */
export async function momento(fecha: FechaDia, instante: number): Promise<Momento> {
  const a = await obtenerAjustes()
  const bloques = (await bloquesDelDia(fecha)).filter((b) => b.tipo !== 'dormir')
  const m = Math.floor((instante - instanteDe(fecha, '00:00', a.zonaHoraria)) / 60_000)
  const enCurso = bloques.find((b) => m >= b.min && m < b.max) ?? null
  const siguiente = bloques.find((b) => b.min > m) ?? null
  const fin = siguiente ? siguiente.min : minutosDe(a.horaAlistarse)
  const libres = enCurso ? Math.max(0, fin - enCurso.max) : Math.max(0, fin - m)
  return { ahora: enCurso, siguiente, libres, libreHasta: minutoAHora(fin), enObligatorio: enCurso?.tipo === 'obligatorio' }
}

export type Hueco = { desde: string; hasta: string; minutos: number }

/** Huecos libres del día entre despertar y alistarse, descontando todos los bloques. */
export async function huecosDelDia(fecha: FechaDia): Promise<Hueco[]> {
  const a = await obtenerAjustes()
  const bloques = (await bloquesDelDia(fecha)).filter((b) => b.tipo !== 'dormir')
  const inicio = minutosDe(a.horaFinSuenio ?? '06:00')
  const fin = minutosDe(a.horaAlistarse)
  const huecos: Hueco[] = []
  let cursor = inicio
  for (const b of bloques) {
    if (b.min > cursor && b.min <= fin) huecos.push({ desde: minutoAHora(cursor), hasta: minutoAHora(Math.min(b.min, fin)), minutos: Math.min(b.min, fin) - cursor })
    cursor = Math.max(cursor, b.max)
  }
  if (cursor < fin) huecos.push({ desde: minutoAHora(cursor), hasta: minutoAHora(fin), minutos: fin - cursor })
  return huecos.filter((h) => h.minutos >= 10)
}

/** Si un instante cae dentro de un bloque obligatorio, devuelve el fin del bloque (para correr avisos). */
export async function finDeObligatorio(fecha: FechaDia, instante: number): Promise<{ bloque: BloqueDia; fin: number } | null> {
  const a = await obtenerAjustes()
  const m = Math.floor((instante - instanteDe(fecha, '00:00', a.zonaHoraria)) / 60_000)
  const b = (await bloquesDelDia(fecha)).find((x) => x.tipo === 'obligatorio' && m >= x.min && m < x.max)
  if (!b) return null
  return { bloque: b, fin: instanteDe(fecha, b.hasta, a.zonaHoraria) }
}

/** «Hoy a las 19:30»: corre el entreno de una fecha sin tocar la semana. */
export async function correrEntreno(fecha: FechaDia, hora: string): Promise<void> {
  if (!esHoraValida(hora)) throw new Error('Hora inválida')
  const d = db()
  const c = await d.compromisos.get(`entrenamiento:${fecha}`)
  if (c) await d.compromisos.update(c.id, { horaPrevista: hora, actualizado: ahora() })
  else throw new Error('Ese día no hay entreno programado')
}

/** Resumen corto del momento para una línea: «Ahora: Facultad hasta 18:00 · después: Entreno 19:00». */
export function textoMomento(m: Momento): string {
  const partes: string[] = []
  if (m.ahora) partes.push(`Ahora: ${m.ahora.nombre} hasta ${m.ahora.hasta}`)
  else if (m.siguiente) partes.push(`Libre ${m.libres >= 60 ? `${Math.floor(m.libres / 60)} h${m.libres % 60 ? ` ${m.libres % 60}` : ''}` : `${m.libres} min`}`)
  else partes.push('Sin bloques por hoy')
  if (m.siguiente) partes.push(`después: ${m.siguiente.nombre} ${m.siguiente.desde}`)
  return partes.join(' · ')
}
