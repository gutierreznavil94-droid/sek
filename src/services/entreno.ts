/**
 * Entrenamiento en modo juego: rutinas, la sesión en curso (series, descansos
 * con sombra y temporizadores), la progresión sugerida y el XP por mejorar.
 *
 * XP (pedido de Navil: que no se infle):
 * - Terminar el entreno da el XP del pilar, como siempre.
 * - +5 por cada ejercicio donde mejoraste respecto a la sesión anterior de la
 *   misma rutina y +10 por récord personal (estrictamente mayor que todo lo
 *   anterior, y solo si ya había historial). Tope: 20 por entreno.
 * - El extra se guarda con una sola clave por sesión: volver a terminar la
 *   misma sesión lo recalcula, no lo suma de nuevo.
 */

import { db } from '../data/db'
import { RUTINAS_INICIALES } from '../data/semilla'
import type { BloqueEjercicio, BloqueRutina, FaseDescanso, Rutina, SerieHecha, SesionEntreno } from '../data/tipos'
import { diaSemanaDe, lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { claveXp } from '../domain/xp'
import { fechaHoy, registrarEvento } from './base'
import { completarCompromiso, deshacerCompromiso, generarCompromisosDelDia, idCompromiso } from './dia'
import { ahora } from './reloj'
import { anularXp, concederXp } from './xp'

export const XP_MEJORA = 5
export const XP_RECORD = 10
/** Tope de XP extra por entreno. El pedido decía 40; con 6 entrenos por semana superaba a los otros pilares juntos. */
export const TOPE_XP_EXTRA = 20

// ---------- Rutinas ----------

/** Carga las 3 rutinas de la planilla la primera vez y deja el entrenamiento de lunes a sábado. Idempotente. */
export async function cargarRutinasIniciales(): Promise<void> {
  const d = db()
  if ((await d.rutinas.count()) > 0) return
  const t = ahora()
  await d.rutinas.bulkPut(RUTINAS_INICIALES.map((r) => ({ ...r, creado: t })))
  const entreno = await d.acciones.get('entrenamiento')
  const seis = [1, 2, 3, 4, 5, 6]
  if (entreno && entreno.dias.join() !== seis.join()) {
    const despues = { ...entreno, dias: seis }
    await d.acciones.put(despues)
    await registrarEvento({ tipo: 'editar', entidad: 'accion', entidadId: 'entrenamiento', antes: { dias: entreno.dias }, despues: { dias: seis }, motivo: 'Rutinas: entrena de lunes a sábado; domingo libre' })
  }
}

export async function listarRutinas(incluirInactivas = false): Promise<Rutina[]> {
  const todas = await db().rutinas.orderBy('orden').toArray()
  return incluirInactivas ? todas : todas.filter((r) => r.activa)
}

export async function obtenerRutina(id: string): Promise<Rutina | undefined> {
  return db().rutinas.get(id)
}

export async function guardarRutina(r: Rutina): Promise<void> {
  if (!r.nombre.trim()) throw new Error('Ponele un nombre a la rutina')
  for (const b of r.bloques) {
    if (b.tipo === 'ejercicio') {
      if (!b.nombre.trim()) throw new Error('Hay un ejercicio sin nombre')
      if (!(b.series > 0) || !(b.reps > 0)) throw new Error(`${b.nombre}: series y repeticiones tienen que ser mayores que 0`)
      if (b.repsTope < b.reps) throw new Error(`${b.nombre}: el tope no puede ser menor que el objetivo`)
      if (b.sombra >= b.descanso) throw new Error(`${b.nombre}: la sombra tiene que ser más corta que el descanso`)
    }
  }
  const antes = await db().rutinas.get(r.id)
  await db().rutinas.put({ ...r, nombre: r.nombre.trim() })
  await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'rutina', entidadId: r.id, antes, despues: r })
}

/** La rutina que toca ese día (la primera activa que incluye el día de la semana). */
export async function rutinaDelDia(fecha: FechaDia): Promise<Rutina | undefined> {
  const ds = diaSemanaDe(fecha)
  return (await listarRutinas()).find((r) => r.dias.includes(ds))
}

export function ejercicios(r: Pick<Rutina, 'bloques'>): BloqueEjercicio[] {
  return r.bloques.filter((b): b is BloqueEjercicio => b.tipo === 'ejercicio')
}

// ---------- Descanso ----------

/**
 * Fases del descanso después de la serie `n` de un ejercicio.
 * - Serie que no es la última: sombra al principio y después «Descansá».
 * - Última serie: sin sombra; «Acomodá para el siguiente» todo el descanso.
 */
export function fasesDescanso(b: Pick<BloqueEjercicio, 'series' | 'descanso' | 'sombra'>, n: number, siguiente?: string): FaseDescanso[] {
  if (n >= b.series) {
    if (!siguiente) return []
    return [{ tipo: 'acomodar', segundos: b.descanso, texto: `Acomodá para el siguiente: ${siguiente}` }]
  }
  const sombra = Math.max(0, Math.min(b.sombra, b.descanso))
  const fases: FaseDescanso[] = []
  if (sombra > 0) fases.push({ tipo: 'sombra', segundos: sombra, texto: 'Sombra' })
  if (b.descanso - sombra > 0) fases.push({ tipo: 'descanso', segundos: b.descanso - sombra, texto: 'Descansá' })
  return fases
}

/** En qué fase está un descanso a cierto instante. `null` si ya terminó. */
export function faseActual(descanso: { inicio: number; fases: FaseDescanso[] }, t: number): { indice: number; fase: FaseDescanso; restante: number; totalRestante: number } | null {
  let pasado = (t - descanso.inicio) / 1000
  const total = descanso.fases.reduce((s, f) => s + f.segundos, 0)
  const totalRestante = Math.max(0, Math.ceil(total - pasado))
  for (let i = 0; i < descanso.fases.length; i++) {
    const f = descanso.fases[i]
    if (pasado < f.segundos) return { indice: i, fase: f, restante: Math.ceil(f.segundos - pasado), totalRestante }
    pasado -= f.segundos
  }
  return null
}

// ---------- Sesión ----------

async function guardarSesion(s: SesionEntreno): Promise<SesionEntreno> {
  await db().sesionesEntreno.put(s)
  return s
}

async function sesion(id: number): Promise<SesionEntreno> {
  const s = await db().sesionesEntreno.get(id)
  if (!s) throw new Error('Ese entreno no existe')
  return s
}

/** El entreno empezado y sin terminar (para volver donde estaba si la app se cerró). */
export async function sesionEnCurso(): Promise<SesionEntreno | undefined> {
  const lista = await db().sesionesEntreno.where('estado').equals('en_curso').toArray()
  return lista.sort((a, b) => b.inicio - a.inicio)[0]
}

export async function iniciarEntreno(rutinaId: string, fecha?: FechaDia): Promise<SesionEntreno> {
  const enCurso = await sesionEnCurso()
  if (enCurso) return enCurso
  const r = await obtenerRutina(rutinaId)
  if (!r) throw new Error('Esa rutina no existe')
  const f = fecha ?? (await fechaHoy())
  const s: SesionEntreno = { rutinaId, fecha: f, inicio: ahora(), estado: 'en_curso', paso: 0, orden: r.bloques.map((b) => b.id), series: [], hechos: [], saltados: [] }
  s.id = await db().sesionesEntreno.add(s)
  // El pilar de hoy queda «iniciado».
  const c = await db().compromisos.get(idCompromiso('entrenamiento', f))
  if (c && c.estado === 'pendiente') await db().compromisos.put({ ...c, estado: 'iniciado', inicioReal: s.inicio, actualizado: s.inicio })
  return s
}

export function seriesDe(s: Pick<SesionEntreno, 'series'>, bloqueId: string): SerieHecha[] {
  return s.series.filter((x) => x.bloqueId === bloqueId)
}

function bloqueDe(r: Rutina, id: string): BloqueRutina | undefined {
  return r.bloques.find((b) => b.id === id)
}

/** Un bloque está terminado si se hizo, se saltó o tiene todas sus series. */
export function bloqueTerminado(s: SesionEntreno, b: BloqueRutina): boolean {
  if (s.saltados.includes(b.id) || s.hechos.includes(b.id)) return true
  return b.tipo === 'ejercicio' && seriesDe(s, b.id).length >= b.series
}

/** El próximo bloque sin terminar a partir del paso actual (o el primero pendiente). */
function siguientePaso(s: SesionEntreno, r: Rutina, desde: number): number {
  for (let i = desde; i < s.orden.length; i++) {
    const b = bloqueDe(r, s.orden[i])
    if (b && !bloqueTerminado(s, b)) return i
  }
  for (let i = 0; i < desde && i < s.orden.length; i++) {
    const b = bloqueDe(r, s.orden[i])
    if (b && !bloqueTerminado(s, b)) return i
  }
  return s.orden.length
}

function nombreSiguiente(s: SesionEntreno, r: Rutina): string | undefined {
  const i = siguientePaso(s, r, s.paso)
  const b = i < s.orden.length ? bloqueDe(r, s.orden[i]) : undefined
  return b?.nombre
}

/** Anota una serie y arranca el descanso con sus fases. */
export async function registrarSerie(id: number, bloqueId: string, hecho: { reps: number; repsExtra?: number; peso: number }): Promise<SesionEntreno> {
  const s = await sesion(id)
  const r = await obtenerRutina(s.rutinaId)
  const b = r && bloqueDe(r, bloqueId)
  if (!r || !b || b.tipo !== 'ejercicio') throw new Error('Ese ejercicio no está en la rutina')
  const n = seriesDe(s, bloqueId).length + 1
  const t = ahora()
  const nueva: SesionEntreno = { ...s, series: [...s.series, { bloqueId, n, reps: Math.max(0, Math.round(hecho.reps)), repsExtra: hecho.repsExtra, peso: Math.max(0, hecho.peso), instante: t }], reloj: undefined }
  // Si terminó el ejercicio, el paso pasa al siguiente y el descanso es para acomodar.
  if (n >= b.series) nueva.paso = siguientePaso(nueva, r, s.paso)
  const fases = fasesDescanso(b, n, n >= b.series ? nombreSiguiente(nueva, r) : undefined)
  nueva.descanso = fases.length ? { inicio: t, fases } : undefined
  return guardarSesion(nueva)
}

/** Deshace la última serie anotada (y su descanso). */
export async function deshacerSerie(id: number): Promise<SesionEntreno> {
  const s = await sesion(id)
  const ultima = s.series[s.series.length - 1]
  if (!ultima) return s
  const i = s.orden.indexOf(ultima.bloqueId)
  return guardarSesion({ ...s, series: s.series.slice(0, -1), descanso: undefined, paso: i >= 0 ? i : s.paso })
}

/** Marca hecho un bloque que no es ejercicio (calentamiento, colgarse, kick boxing, estirar). */
export async function marcarBloque(id: number, bloqueId: string): Promise<SesionEntreno> {
  const s = await sesion(id)
  const r = await obtenerRutina(s.rutinaId)
  if (!r) throw new Error('Rutina no encontrada')
  const nueva = { ...s, hechos: s.hechos.includes(bloqueId) ? s.hechos : [...s.hechos, bloqueId], reloj: undefined, descanso: undefined }
  nueva.paso = siguientePaso(nueva, r, s.paso)
  return guardarSesion(nueva)
}

export async function saltarBloque(id: number, bloqueId: string): Promise<SesionEntreno> {
  const s = await sesion(id)
  const r = await obtenerRutina(s.rutinaId)
  if (!r) throw new Error('Rutina no encontrada')
  const nueva = { ...s, saltados: s.saltados.includes(bloqueId) ? s.saltados : [...s.saltados, bloqueId], reloj: undefined, descanso: undefined }
  nueva.paso = siguientePaso(nueva, r, s.paso)
  return guardarSesion(nueva)
}

/** Ir a un bloque (para cambiar el orden sobre la marcha o volver a uno saltado). */
export async function irABloque(id: number, bloqueId: string): Promise<SesionEntreno> {
  const s = await sesion(id)
  const i = s.orden.indexOf(bloqueId)
  if (i < 0) return s
  return guardarSesion({ ...s, paso: i, saltados: s.saltados.filter((x) => x !== bloqueId), reloj: undefined, descanso: undefined })
}

/** Mueve un bloque pendiente una posición antes (-1) o después (+1). */
export async function moverBloque(id: number, bloqueId: string, delta: -1 | 1): Promise<SesionEntreno> {
  const s = await sesion(id)
  const i = s.orden.indexOf(bloqueId)
  const j = i + delta
  if (i < 0 || j < 0 || j >= s.orden.length) return s
  const orden = [...s.orden]
  ;[orden[i], orden[j]] = [orden[j], orden[i]]
  const actual = s.orden[s.paso]
  return guardarSesion({ ...s, orden, paso: actual ? orden.indexOf(actual) : s.paso })
}

/** Guarda el paso actual (para reanudar). */
export async function guardarPaso(id: number, paso: number): Promise<SesionEntreno> {
  const s = await sesion(id)
  return guardarSesion({ ...s, paso })
}

export async function terminarDescanso(id: number): Promise<SesionEntreno> {
  const s = await sesion(id)
  return guardarSesion({ ...s, descanso: undefined })
}

/** Alarga la fase actual del descanso. */
export async function alargarDescanso(id: number, segundos = 30): Promise<SesionEntreno> {
  const s = await sesion(id)
  if (!s.descanso) return s
  const f = faseActual(s.descanso, ahora())
  const fases = s.descanso.fases.map((x, i) => (f && i === f.indice) || (!f && i === s.descanso!.fases.length - 1) ? { ...x, segundos: x.segundos + segundos } : x)
  return guardarSesion({ ...s, descanso: { ...s.descanso, fases } })
}

/** Arranca el temporizador de un bloque (calentamiento, colgarse o rondas). */
export async function iniciarReloj(id: number, bloqueId: string): Promise<SesionEntreno> {
  const s = await sesion(id)
  const r = await obtenerRutina(s.rutinaId)
  const b = r && bloqueDe(r, bloqueId)
  if (!b) throw new Error('Bloque no encontrado')
  const segundos = b.tipo === 'rondas' ? b.rondas.reduce((t, x) => t + x.segundos, 0) : b.tipo === 'casilla' || b.tipo === 'ejercicio' ? 0 : b.segundos * (b.veces ?? 1)
  return guardarSesion({ ...s, reloj: { bloqueId, ronda: 0, inicio: ahora(), segundos }, descanso: undefined })
}

export async function pararReloj(id: number): Promise<SesionEntreno> {
  const s = await sesion(id)
  return guardarSesion({ ...s, reloj: undefined })
}

/** Ronda en curso de un bloque de rondas según el tiempo pasado. */
export function rondaActual(rondas: { segundos: number }[], inicio: number, t: number): { indice: number; restante: number } | null {
  let pasado = (t - inicio) / 1000
  for (let i = 0; i < rondas.length; i++) {
    if (pasado < rondas[i].segundos) return { indice: i, restante: Math.ceil(rondas[i].segundos - pasado) }
    pasado -= rondas[i].segundos
  }
  return null
}

export async function descartarEntreno(id: number): Promise<void> {
  const s = await sesion(id)
  await db().sesionesEntreno.delete(id)
  const c = await db().compromisos.get(idCompromiso('entrenamiento', s.fecha))
  if (c && c.estado === 'iniciado') await db().compromisos.put({ ...c, estado: 'pendiente', inicioReal: undefined, actualizado: ahora() })
  await registrarEvento({ tipo: 'borrar', entidad: 'sesionEntreno', entidadId: String(id), antes: s, motivo: 'Entreno descartado' })
}

// ---------- Marcas, progresión y XP ----------

/** Mejor marca de un ejercicio en una sesión: el peso más alto y las repeticiones con ese peso (suma de series). */
export type Marca = { peso: number; reps: number; repsTotal: number; volumen: number }

export function marcaDe(series: SerieHecha[]): Marca | null {
  if (!series.length) return null
  const peso = Math.max(...series.map((s) => s.peso))
  const conPeso = series.filter((s) => s.peso === peso)
  return {
    peso,
    reps: Math.max(...conPeso.map((s) => s.reps)),
    repsTotal: series.reduce((t, s) => t + s.reps + (s.repsExtra ?? 0), 0),
    volumen: series.reduce((t, s) => t + (s.reps + (s.repsExtra ?? 0)) * s.peso, 0),
  }
}

/** Compara dos marcas: >0 si `a` es mejor (más peso, o mismo peso y más repeticiones totales). */
export function compararMarcas(a: Marca, b: Marca): number {
  if (a.peso !== b.peso) return a.peso - b.peso
  return a.repsTotal - b.repsTotal
}

/** Sesiones terminadas de una rutina, más nuevas primero. */
async function terminadasDe(rutinaId: string): Promise<SesionEntreno[]> {
  const lista = await db().sesionesEntreno.where('rutinaId').equals(rutinaId).filter((s) => s.estado === 'terminada').toArray()
  return lista.sort((a, b) => (b.fin ?? b.inicio) - (a.fin ?? a.inicio))
}

/** Lo que hiciste la última vez en ese ejercicio (sin contar la sesión `excepto`). */
export async function ultimaVez(rutinaId: string, bloqueId: string, excepto?: number): Promise<SerieHecha[]> {
  for (const s of await terminadasDe(rutinaId)) {
    if (s.id === excepto) continue
    const series = seriesDe(s, bloqueId)
    if (series.length) return series
  }
  return []
}

export type Sugerencia = { reps: number; peso: number; texto: string; sube: 'peso' | 'reps' | 'nada' }

/**
 * Doble progresión: si en todas las series llegaste al tope, subí peso y volvé
 * al mínimo de repeticiones (peso corporal: +1 repetición); si no, +1 repetición.
 */
export function sugerencia(b: BloqueEjercicio, ultima: SerieHecha[]): Sugerencia {
  if (!ultima.length) return { reps: b.reps, peso: b.peso, texto: 'Primera vez: lo de la planilla', sube: 'nada' }
  const peso = Math.max(...ultima.map((s) => s.peso))
  const conPeso = ultima.filter((s) => s.peso === peso)
  const minReps = Math.min(...conPeso.map((s) => s.reps))
  const todasAlTope = conPeso.length >= b.series && conPeso.every((s) => s.reps >= b.repsTope)
  if (todasAlTope && b.incremento > 0 && peso > 0) {
    const nuevo = Math.round((peso + b.incremento) * 100) / 100
    return { reps: b.reps, peso: nuevo, texto: `Llegaste al tope: subí a ${kg(nuevo)} y volvé a ${b.reps} reps`, sube: 'peso' }
  }
  if (todasAlTope) return { reps: minReps + 1, peso, texto: `Llegaste al tope: probá ${minReps + 1} reps`, sube: 'reps' }
  const reps = Math.min(b.repsTope, minReps + 1)
  return { reps, peso, texto: `Probá ${reps} reps con ${kg(peso)}`, sube: 'reps' }
}

export function kg(peso: number): string {
  if (peso === 0) return 'peso corporal'
  return `${String(peso).replace('.', ',')} kg`
}

export type ResultadoEjercicio = { bloqueId: string; nombre: string; marca: Marca; antes: Marca | null; mejora: boolean; igual: boolean; record: boolean }
export type ResumenEntreno = {
  minutos: number
  series: number
  volumen: number
  ejercicios: ResultadoEjercicio[]
  xpExtra: number
  /** XP extra sin el tope (para explicar). */
  xpSinTope: number
}

/** Mejor marca de cada ejercicio en todo el historial anterior a la sesión (todas las rutinas, por id de bloque). */
async function mejoresAnteriores(s: SesionEntreno): Promise<Map<string, Marca>> {
  const previas = (await db().sesionesEntreno.filter((x) => x.estado === 'terminada' && x.id !== s.id && (x.fin ?? x.inicio) < (s.fin ?? ahora())).toArray())
  const mejores = new Map<string, Marca>()
  for (const p of previas) {
    for (const id of new Set(p.series.map((x) => x.bloqueId))) {
      const m = marcaDe(seriesDe(p, id))
      if (!m) continue
      const actual = mejores.get(id)
      if (!actual || compararMarcas(m, actual) > 0) mejores.set(id, m)
    }
  }
  return mejores
}

/** Calcula el resumen y el XP extra de una sesión (sin guardar nada). */
export async function calcularResumen(s: SesionEntreno): Promise<ResumenEntreno> {
  const r = await obtenerRutina(s.rutinaId)
  const previa = (await terminadasDe(s.rutinaId)).find((x) => x.id !== s.id && (x.fin ?? x.inicio) < (s.fin ?? ahora()))
  const mejores = await mejoresAnteriores(s)
  const ejerciciosHechos: ResultadoEjercicio[] = []
  for (const id of s.orden) {
    const b = r && bloqueDe(r, id)
    const marca = marcaDe(seriesDe(s, id))
    if (!b || !marca) continue
    const antes = previa ? marcaDe(seriesDe(previa, id)) : null
    const mejor = mejores.get(id)
    const c = antes ? compararMarcas(marca, antes) : 0
    ejerciciosHechos.push({ bloqueId: id, nombre: b.nombre, marca, antes, mejora: !!antes && c > 0, igual: !!antes && c === 0, record: !!mejor && compararMarcas(marca, mejor) > 0 })
  }
  const xpSinTope = ejerciciosHechos.reduce((t, e) => t + (e.mejora ? XP_MEJORA : 0) + (e.record ? XP_RECORD : 0), 0)
  return {
    minutos: Math.max(1, Math.round(((s.fin ?? ahora()) - s.inicio) / 60_000)),
    series: s.series.length,
    volumen: Math.round(s.series.reduce((t, x) => t + (x.reps + (x.repsExtra ?? 0)) * x.peso, 0)),
    ejercicios: ejerciciosHechos,
    xpExtra: Math.min(TOPE_XP_EXTRA, xpSinTope),
    xpSinTope,
  }
}

export function claveXpExtra(sesionId: number): string {
  return claveXp('entrenamiento', ['extra', sesionId])
}

export type ResultadoTerminar = { sesion: SesionEntreno; resumen: ResumenEntreno; xpPilar: number; motivoSinXp?: string; nuevoNivel: number | null }

/** Termina el entreno: guarda el resumen, marca el pilar Entrenamiento y da el XP extra (con tope). */
export async function terminarEntreno(id: number): Promise<ResultadoTerminar> {
  const d = db()
  const antes = await sesion(id)
  const s: SesionEntreno = { ...antes, estado: 'terminada', fin: antes.fin ?? ahora(), descanso: undefined, reloj: undefined }
  const resumen = await calcularResumen(s)
  s.xpExtra = resumen.xpExtra
  await guardarSesion(s)
  await registrarEvento({ tipo: 'editar', entidad: 'sesionEntreno', entidadId: String(id), despues: { estado: 'terminada', series: s.series.length, xpExtra: s.xpExtra } })
  // Pilar del día.
  await generarCompromisosDelDia(s.fecha)
  const accion = await d.acciones.get('entrenamiento')
  const c = await d.compromisos.get(idCompromiso('entrenamiento', s.fecha))
  let xpPilar = 0
  let motivoSinXp: string | undefined
  let nuevoNivel: number | null = null
  if (c && (c.estado === 'pendiente' || c.estado === 'iniciado')) {
    const minutos = Math.max(resumen.minutos, accion?.duracionMinutos ?? accion?.minutosMinimos ?? 0)
    const r = await completarCompromiso(c.id, { minutos, instante: s.fin })
    xpPilar = r.xp
    motivoSinXp = r.motivoSinXp
    nuevoNivel = r.nuevoNivel
  } else if (!c) {
    motivoSinXp = 'Hoy no es día de entreno: queda en el historial, sin XP del pilar'
  }
  // XP extra por mejorar (una sola clave por sesión; recalcula si se vuelve a terminar).
  if (resumen.xpExtra > 0 && c) {
    const rx = await concederXp({ clave: claveXpExtra(id), cantidad: resumen.xpExtra, origen: 'entrenamiento', fecha: s.fecha, descripcion: `Entreno: ${resumen.ejercicios.filter((e) => e.mejora || e.record).length} ejercicios mejorados` })
    nuevoNivel = rx.nuevoNivel ?? nuevoNivel
  } else {
    await anularXp(claveXpExtra(id), 'Sin mejoras en esta sesión')
    s.xpExtra = 0
    await guardarSesion(s)
  }
  return { sesion: s, resumen, xpPilar, motivoSinXp, nuevoNivel }
}

/** Vuelve a abrir un entreno terminado (por ejemplo para corregir una serie): quita el XP extra y el del pilar. */
export async function reabrirEntreno(id: number): Promise<SesionEntreno> {
  const s = await sesion(id)
  await anularXp(claveXpExtra(id), 'Entreno reabierto')
  const c = await db().compromisos.get(idCompromiso('entrenamiento', s.fecha))
  if (c && (c.estado === 'completado' || c.estado === 'tarde')) await deshacerCompromiso(c.id, 'Entreno reabierto')
  const r = await obtenerRutina(s.rutinaId)
  const abierta: SesionEntreno = { ...s, estado: 'en_curso', fin: undefined, xpExtra: undefined }
  if (r) abierta.paso = siguientePaso(abierta, r, 0)
  return guardarSesion(abierta)
}

export async function obtenerSesion(id: number): Promise<SesionEntreno | undefined> {
  return db().sesionesEntreno.get(id)
}

// ---------- Historial y estadísticas ----------

export type PuntoEjercicio = { fecha: FechaDia; peso: number; reps: number; repsTotal: number; record: boolean }

/** Historial de un ejercicio (más viejo primero), con su récord marcado. */
export async function historialEjercicio(bloqueId: string): Promise<{ puntos: PuntoEjercicio[]; record: Marca | null }> {
  const lista = (await db().sesionesEntreno.filter((s) => s.estado === 'terminada' && s.series.some((x) => x.bloqueId === bloqueId)).toArray()).sort((a, b) => (a.fin ?? a.inicio) - (b.fin ?? b.inicio))
  const puntos: PuntoEjercicio[] = []
  let mejor: Marca | null = null
  for (const s of lista) {
    const m = marcaDe(seriesDe(s, bloqueId))!
    const esRecord = !!mejor && compararMarcas(m, mejor) > 0
    if (!mejor || compararMarcas(m, mejor) > 0) mejor = m
    puntos.push({ fecha: s.fecha, peso: m.peso, reps: m.reps, repsTotal: m.repsTotal, record: esRecord })
  }
  return { puntos, record: mejor }
}

export type ResumenFuerza = {
  entrenos: number
  records: { nombre: string; marca: Marca; fecha: FechaDia }[]
  mejoraronEsteMes: string[]
  volumenPorSemana: { semana: FechaDia; volumen: number }[]
}

/** Tarjeta «Fuerza»: récords del ciclo, ejercicios que mejoraron este mes y volumen por semana. */
export async function resumenFuerza(hoy: FechaDia, inicioCiclo: FechaDia, semanas = 6): Promise<ResumenFuerza> {
  const todas = (await db().sesionesEntreno.filter((s) => s.estado === 'terminada').toArray()).sort((a, b) => (a.fin ?? a.inicio) - (b.fin ?? b.inicio))
  const rutinas = new Map((await listarRutinas(true)).map((r) => [r.id, r]))
  const nombre = (s: SesionEntreno, id: string) => rutinas.get(s.rutinaId)?.bloques.find((b) => b.id === id)?.nombre ?? id
  const mejor = new Map<string, Marca>()
  const records = new Map<string, { nombre: string; marca: Marca; fecha: FechaDia }>()
  const mejoraron = new Set<string>()
  const ultimaPorEj = new Map<string, Marca>()
  const mes = hoy.slice(0, 7)
  for (const s of todas) {
    for (const id of new Set(s.series.map((x) => x.bloqueId))) {
      const m = marcaDe(seriesDe(s, id))!
      const previo = mejor.get(id)
      if (previo && compararMarcas(m, previo) > 0 && s.fecha >= inicioCiclo) records.set(id, { nombre: nombre(s, id), marca: m, fecha: s.fecha })
      if (!previo || compararMarcas(m, previo) > 0) mejor.set(id, m)
      const ultima = ultimaPorEj.get(id)
      if (ultima && compararMarcas(m, ultima) > 0 && s.fecha.slice(0, 7) === mes) mejoraron.add(nombre(s, id))
      ultimaPorEj.set(id, m)
    }
  }
  const lunes = lunesDe(hoy)
  const volumenPorSemana: { semana: FechaDia; volumen: number }[] = []
  for (let i = semanas - 1; i >= 0; i--) {
    const desde = sumarDias(lunes, -7 * i)
    const hasta = sumarDias(desde, 6)
    const volumen = todas.filter((s) => s.fecha >= desde && s.fecha <= hasta).reduce((t, s) => t + s.series.reduce((u, x) => u + (x.reps + (x.repsExtra ?? 0)) * x.peso, 0), 0)
    volumenPorSemana.push({ semana: desde, volumen: Math.round(volumen) })
  }
  return { entrenos: todas.filter((s) => s.fecha >= inicioCiclo).length, records: [...records.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)), mejoraronEsteMes: [...mejoraron], volumenPorSemana }
}
