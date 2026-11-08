/**
 * Primera vez: arma la app a medida de una persona nueva (pilares, horarios,
 * visión, tema) y arranca el ciclo de 90 días desde hoy. Solo se usa cuando la
 * base nunca tuvo un ciclo; a quien ya usa la app no le aparece.
 */

import { db } from '../data/db'
import { ACCIONES_INICIALES, rutinaDeEjemplo } from '../data/semilla'
import type { Accion, Ajustes, Contador } from '../data/tipos'
import { cuotaDeSeries, seriesDe } from '../domain/cuotas'
import { configAgua } from './agua'
import { guardarContador } from './contadores'
import { configFruta, FRUTA_DEFECTO } from './fruta'
import { nuevoId } from './reloj'
import { esHoraValida, type FechaDia } from '../domain/fechas'
import { temaPorId } from '../temas/temas'
import { guardarAccion } from './acciones'
import { guardarAjustes, guardarIdentidad, obtenerAjustes, registrarEvento } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes } from './dia'
import { borrarTodo } from './exportar'
import { ahora } from './reloj'

export const MAX_PILARES = 5
const TODOS = [0, 1, 2, 3, 4, 5, 6]

export type ClavePilar = 'entrenar' | 'dormir' | 'estudiar' | 'leer' | 'dibujar' | 'meditar' | 'proyecto' | 'pantalla' | 'otro'

/** Sugerencias del paso 3. `id` es la acción que se usa (las de Navil se reutilizan para no perder animaciones ni orden). */
export const SUGERENCIAS_PILARES: { clave: ClavePilar; nombre: string; id: string; dias: number[]; horaLimite?: string; minutos?: number; atributo: string; xp: number; pideHora: boolean; pideMinutos: boolean }[] = [
  { clave: 'entrenar', nombre: 'Entrenar', id: 'entrenamiento', dias: [1, 3, 5], horaLimite: '19:00', minutos: 30, atributo: 'fisico', xp: 30, pideHora: true, pideMinutos: true },
  { clave: 'dormir', nombre: 'Dormir a horario', id: 'acostarse', dias: TODOS, atributo: 'autocontrol', xp: 20, pideHora: false, pideMinutos: false },
  { clave: 'estudiar', nombre: 'Estudiar', id: 'p-estudiar', dias: [1, 2, 3, 4, 5], horaLimite: '20:00', minutos: 30, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'leer', nombre: 'Leer', id: 'p-leer', dias: TODOS, horaLimite: '21:00', minutos: 15, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'dibujar', nombre: 'Dibujar', id: 'manga', dias: TODOS, horaLimite: '20:50', minutos: 15, atributo: 'claridad', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'meditar', nombre: 'Meditar', id: 'p-meditar', dias: TODOS, horaLimite: '21:00', minutos: 10, atributo: 'autocontrol', xp: 15, pideHora: true, pideMinutos: true },
  { clave: 'proyecto', nombre: 'Proyecto propio', id: 'empresa', dias: TODOS, horaLimite: '20:50', atributo: 'disciplina', xp: 15, pideHora: true, pideMinutos: false },
  { clave: 'pantalla', nombre: 'Límite de pantalla', id: 'p-pantalla', dias: TODOS, horaLimite: '22:00', atributo: 'autocontrol', xp: 15, pideHora: true, pideMinutos: false },
  { clave: 'otro', nombre: 'Otro…', id: 'p-otro', dias: TODOS, horaLimite: '20:50', minutos: 15, atributo: 'disciplina', xp: 15, pideHora: true, pideMinutos: true },
]

/** `minutosExtra`: segunda meta (ej. Dibujar manga: 15 min cumple, 30 min es el extra). */
export type EleccionPilar = { clave: ClavePilar; /** Acción que ya existe (Configurar de nuevo). */ id?: string; nombre: string; dias: number[]; horaLimite?: string; minutos?: number; minutosExtra?: number }

/** Los cuatro pilares del creador de la app (Navil), con sus horarios y XP. Se ofrecen en la primera entrada y en Más. */
export const PILARES_DEL_CREADOR: EleccionPilar[] = [
  { clave: 'entrenar', nombre: 'Entrenar', dias: [1, 2, 3, 4, 5, 6], horaLimite: '19:35', minutos: 42 },
  { clave: 'dormir', nombre: 'Dormir a horario', dias: TODOS },
  { clave: 'dibujar', nombre: 'Dibujar manga', dias: TODOS, horaLimite: '20:50', minutos: 15, minutosExtra: 30 },
  { clave: 'proyecto', nombre: 'Proyecto propio', dias: TODOS, horaLimite: '20:50' },
]

export const TEXTO_CREADOR = 'Son los que uso yo todos los días. Cambialos a tu gusto.'

/** XP de un pilar sugerido (el de la sugerencia). */
export function xpDePilar(clave: ClavePilar): number {
  return SUGERENCIAS_PILARES.find((x) => x.clave === clave)?.xp ?? 15
}

/** Qué pilares del creador ya tiene esta persona (por la acción que usan). */
export async function pilaresDelCreadorQueTiene(): Promise<Set<ClavePilar>> {
  const tiene = new Set<ClavePilar>()
  for (const p of PILARES_DEL_CREADOR) {
    const s = SUGERENCIAS_PILARES.find((x) => x.clave === p.clave)!
    const a = await db().acciones.get(s.id)
    if (a && a.pilar && a.activa) tiene.add(p.clave)
  }
  return tiene
}

/** «Agregar los que me falten»: suma los pilares del creador que no tiene, sin pasar el máximo. Devuelve los agregados. */
export async function agregarPilaresDelCreador(hoy: FechaDia): Promise<string[]> {
  const d = db()
  const tiene = await pilaresDelCreadorQueTiene()
  const faltan = PILARES_DEL_CREADOR.filter((p) => !tiene.has(p.clave))
  if (!faltan.length) return []
  const activos = (await d.acciones.toArray()).filter((a) => a.pilar && a.activa).length
  if (activos + faltan.length > MAX_PILARES) throw new Error(`Con estos serían más de ${MAX_PILARES} pilares. Sacá alguno en Más → Pilares y acciones.`)
  const aj = await obtenerAjustes()
  const horarios = { alistarse: aj.horaAlistarse, dejarCelu: aj.horaDejarCelu, dormir: aj.horaDormido }
  const agregados: string[] = []
  for (const p of faltan) {
    const e = accionDe(p, activos + agregados.length + 1, 1, horarios)
    const existe = await d.acciones.get(e.accion.id)
    // Si la acción ya existía (por ejemplo, apagada), vuelve como pilar con su XP; si no, se crea con el del creador.
    await guardarAccion({ ...(existe ?? {}), minutosExtra: undefined, xpExtra: undefined, ...e.accion }, existe ? undefined : e.xp, hoy)
    agregados.push(p.nombre)
  }
  return agregados
}

export type NivelSerie = 'empezando' | 'intermedio' | 'fuerte'
export const NIVELES_SERIE: { id: NivelSerie; nombre: string }[] = [
  { id: 'empezando', nombre: 'Empezando' },
  { id: 'intermedio', nombre: 'Intermedio' },
  { id: 'fuerte', nombre: 'Fuerte' },
]
type Numeros = Record<NivelSerie, [reps: number, series: number]>
/** Series rápidas que se ofrecen en el primer arranque, con números sugeridos por nivel (reps × series). */
export const SERIES_BASE: { id: string; nombre: string; niveles: Numeros }[] = [
  { id: 'flexiones', nombre: 'Flexiones', niveles: { empezando: [5, 4], intermedio: [10, 5], fuerte: [15, 6] } },
  { id: 'dominadas', nombre: 'Dominadas', niveles: { empezando: [2, 3], intermedio: [5, 5], fuerte: [8, 6] } },
  { id: 'sentadillas', nombre: 'Sentadillas', niveles: { empezando: [10, 3], intermedio: [15, 4], fuerte: [20, 5] } },
  { id: 'abdominales', nombre: 'Abdominales', niveles: { empezando: [10, 3], intermedio: [15, 4], fuerte: [20, 5] } },
]
export const NIVELES_PROPIA: Numeros = { empezando: [5, 3], intermedio: [10, 4], fuerte: [15, 5] }

/** Una serie rápida en el asistente: si se usa, reps por serie y series por día (cuota = reps × series). */
export type SerieElegida = { id: string; nombre: string; usar: boolean; reps: number; series: number }

/** Reps y series sugeridas para esa serie y ese nivel. */
export function numerosDeNivel(id: string, nivel: NivelSerie): { reps: number; series: number } {
  const [reps, series] = (SERIES_BASE.find((x) => x.id === id)?.niveles ?? NIVELES_PROPIA)[nivel]
  return { reps, series }
}

/** Primer arranque: flexiones y dominadas en «Empezando»; sentadillas y abdominales sin usar. */
export function seriesDeEntrada(): SerieElegida[] {
  return SERIES_BASE.map((x, i) => ({ id: x.id, nombre: x.nombre, usar: i < 2, ...numerosDeNivel(x.id, 'empezando') }))
}

export function serieNueva(nombre = ''): SerieElegida {
  return { id: nuevoId('cont'), nombre, usar: true, ...numerosDeNivel('', 'empezando') }
}

export type ConfigPrimeraVez = {
  hoy: FechaDia
  nombrePersona: string
  nombreApp: string
  tema: string
  pilares: EleccionPilar[]
  horarios: { alistarse: string; dejarCelu: string; dormir: string }
  vision?: string
  obstaculo?: string
  /** Series rápidas (flexiones, dominadas…). Sin esto no se tocan. */
  series?: SerieElegida[]
  /** Proponer subir las reps cada 3 días. */
  subidaSugerida?: boolean
  /** Flexiones de Tensión y «No cumplí» cuando no se usa ninguna serie. */
  repsSinSerie?: number
  /** Tiempo de Juego permitido por día, en minutos. */
  juego?: { semana: number; finde: number }
  agua?: { usar: boolean; litros: number }
  fruta?: { usar: boolean; porDia: number }
  avisos?: Pick<Ajustes, 'avisos' | 'avisosPropios'>
  /** «Configurar de nuevo»: los pilares que se mostraron (los que no queden elegidos dejan de ser pilar). */
  pilaresIniciales?: string[]
}

/** ¿Hay que mostrar la primera vez? Solo si nunca hubo un ciclo y no se completó antes. */
export async function necesitaPrimeraVez(): Promise<boolean> {
  if ((await db().ciclos.count()) > 0) return false
  return !(await obtenerAjustes()).primeraVezHecha
}

export function validarPrimeraVez(c: ConfigPrimeraVez): string[] {
  const e: string[] = []
  if (!c.nombrePersona.trim()) e.push('Falta tu nombre.')
  if (c.pilares.length === 0) e.push('Elegí al menos un pilar.')
  if (c.pilares.length > MAX_PILARES) e.push(`Máximo ${MAX_PILARES} pilares.`)
  for (const p of c.pilares) {
    if (p.nombre.trim().length < 2) e.push('Cada pilar necesita un nombre.')
    if (p.dias.length === 0) e.push(`«${p.nombre}»: elegí al menos un día.`)
    if (p.horaLimite && !esHoraValida(p.horaLimite)) e.push(`«${p.nombre}»: la hora no es válida.`)
  }
  for (const h of [c.horarios.alistarse, c.horarios.dejarCelu, c.horarios.dormir]) if (!esHoraValida(h)) e.push('Revisá los horarios.')
  for (const s of c.series ?? []) {
    if (!s.usar) continue
    if (!s.nombre.trim()) e.push('Cada serie necesita un nombre.')
    if (!(s.reps >= 1 && Number.isInteger(s.reps)) || !(s.series >= 1 && Number.isInteger(s.series))) e.push(`«${s.nombre || 'Serie'}»: reps y series tienen que ser 1 o más.`)
  }
  if (c.repsSinSerie !== undefined && !(c.repsSinSerie >= 1)) e.push('Las flexiones de Tensión tienen que ser 1 o más.')
  if (c.juego && (!(c.juego.semana >= 0) || !(c.juego.finde >= 0))) e.push('Revisá el tiempo de Juego.')
  if (c.agua?.usar && !(c.agua.litros > 0)) e.push('El agua tiene que ser más de 0 litros.')
  if (c.fruta?.usar && !(c.fruta.porDia >= 1)) e.push('Las frutas por día tienen que ser 1 o más.')
  return [...new Set(e)]
}

function restarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number)
  const t = (((h * 60 + m - min) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Clave del pilar sugerido que usa esa acción (o null si no es una de las sugeridas). */
export function claveDeAccion(id: string): ClavePilar | null {
  if (id.startsWith('p-otro')) return 'otro'
  return SUGERENCIAS_PILARES.find((x) => x.id === id)?.clave ?? null
}

/** Lo que muestra el asistente de una acción que ya es pilar. */
export function eleccionDeAccion(a: Accion): EleccionPilar | null {
  const clave = claveDeAccion(a.id)
  if (!clave) return null
  const s = SUGERENCIAS_PILARES.find((x) => x.clave === clave)!
  const base: EleccionPilar = { clave, id: a.id, nombre: a.nombre, dias: [...(a.dias ?? [0, 1, 2, 3, 4, 5, 6])].sort() }
  if (clave === 'dormir') return base
  if (clave === 'entrenar') return { ...base, horaLimite: a.horaLimiteInicio ?? a.hora, minutos: a.duracionMinutos ?? a.minutosMinimos }
  return { ...base, horaLimite: s.pideHora ? a.horaLimite : undefined, minutos: s.pideMinutos ? a.minutosMinimos : undefined, ...(a.minutosExtra ? { minutosExtra: a.minutosExtra } : {}) }
}

/** Arma la acción de un pilar elegido. */
function accionDe(p: EleccionPilar, orden: number, indiceOtro: number, horarios: ConfigPrimeraVez['horarios']): { accion: Omit<Accion, 'creado'>; xp: number } {
  const s = SUGERENCIAS_PILARES.find((x) => x.clave === p.clave)!
  const base = ACCIONES_INICIALES.find((a) => a.id === s.id)
  const nombre = p.nombre.trim()
  const comun = { atributoIds: [s.atributo], objetivoIds: [], peso: 1, activa: true, pilar: true, orden, dias: [...p.dias].sort() }
  if (p.clave === 'entrenar') {
    const min = p.minutos ?? 30
    const hl = p.horaLimite ?? '19:00'
    return { xp: s.xp, accion: { ...base!, ...comun, nombre, tipo: 'entrenamiento', hora: hl, horaLimiteInicio: hl, avisoInicio: { activo: true, hora: restarMinutos(hl, 30) }, minutosMinimos: min, duracionMinutos: min, condicion: `Hacer el entrenamiento completo (${min} min) el día programado, empezando hasta las ${hl}. Los demás días el pilar muestra «Descanso».` } }
  }
  if (p.clave === 'dormir') {
    const h = horarios.dejarCelu
    return { xp: s.xp, accion: { ...base!, ...comun, nombre, tipo: 'acostarse', hora: h, horaLimite: h, condicion: `Tocar «Dejo celu» hasta las ${h} (celular lejos de la cama). Después queda como tarde con los minutos de retraso.` } }
  }
  const id = p.id ?? (p.clave === 'otro' ? `p-otro-${indiceOtro}` : s.id)
  const hl = p.horaLimite ?? s.horaLimite ?? '20:50'
  const min = s.pideMinutos ? p.minutos : undefined
  const extra = min && p.minutosExtra && p.minutosExtra > min ? { minutosExtra: p.minutosExtra, xpExtra: 10 } : { minutosExtra: undefined, xpExtra: undefined }
  const condicion = p.clave === 'pantalla'
    ? `Respetar mi límite de pantalla. Marcar «Sí» hasta las ${hl}; después queda como tarde y no da XP.`
    : `${min ? `Al menos ${min} minutos. ` : ''}Marcar «Sí» hasta las ${hl}; después queda como tarde y no da XP.`
  return {
    xp: s.xp,
    accion: { id, nombre, tipo: 'compromiso', condicion, horaLimite: hl, minutosMinimos: min, ...extra, ...(p.clave === 'proyecto' ? { pregunta: '¿Qué avancé?' } : {}), ...comun },
  }
}

const igualEleccion = (x: EleccionPilar, y: EleccionPilar) =>
  x.nombre.trim() === y.nombre.trim() && x.dias.join() === [...y.dias].sort().join() && (x.horaLimite ?? '') === (y.horaLimite ?? '') && (x.minutos ?? 0) === (y.minutos ?? 0)

/** Cambia solo lo que se tocó de un pilar que ya existía (conserva XP, extra, avisos y horas por día). */
function cambiosDePilar(a: Accion, p: EleccionPilar, orden: number): Accion {
  const antes = eleccionDeAccion(a)!
  const r: Accion = { ...a, nombre: p.nombre.trim(), dias: [...p.dias].sort(), orden, activa: true, pilar: true }
  if (p.horaLimite && p.horaLimite !== antes.horaLimite) {
    if (p.clave === 'entrenar') { r.hora = p.horaLimite; r.horaLimiteInicio = p.horaLimite; r.horasPorDia = undefined }
    else r.horaLimite = p.horaLimite
  }
  if ((p.minutos ?? 0) !== (antes.minutos ?? 0)) {
    r.minutosMinimos = p.minutos
    if (p.clave === 'entrenar') r.duracionMinutos = p.minutos
  }
  return r
}

async function aplicarPilares(c: ConfigPrimeraVez, deNuevo: boolean): Promise<void> {
  const d = db()
  const elegidos = c.pilares.map((p, i) => ({ p, ...accionDe(p, i + 1, c.pilares.slice(0, i).filter((x) => x.clave === 'otro').length + 1, c.horarios) }))
  const ids = new Set(elegidos.map((e) => e.accion.id))
  const apagables = deNuevo ? new Set(c.pilaresIniciales ?? []) : null
  for (const a of await d.acciones.toArray()) {
    if (!a.pilar || ids.has(a.id)) continue
    if (apagables && !apagables.has(a.id)) continue
    // «Dormir a horario» sigue funcionando para el modo sueño, pero sin ser pilar.
    await d.acciones.put({ ...a, pilar: false, activa: a.tipo === 'acostarse' })
  }
  for (const e of elegidos) {
    const existe = await d.acciones.get(e.accion.id)
    if (deNuevo && existe?.pilar) {
      const antes = eleccionDeAccion(existe)
      let nueva = antes && igualEleccion(e.p, antes) ? { ...existe, orden: e.accion.orden } : cambiosDePilar(existe, e.p, e.accion.orden)
      if (e.p.clave === 'dormir' && nueva.hora !== c.horarios.dejarCelu) nueva = { ...nueva, hora: c.horarios.dejarCelu, horaLimite: c.horarios.dejarCelu }
      if (JSON.stringify(nueva) !== JSON.stringify(existe)) await guardarAccion(nueva, undefined, c.hoy)
      continue
    }
    // Las acciones que ya existen conservan su XP; las nuevas reciben el de la sugerencia.
    await guardarAccion({ ...(deNuevo && existe ? existe : {}), minutosExtra: undefined, xpExtra: undefined, ...e.accion }, existe ? undefined : e.xp, c.hoy)
  }
}

async function aplicarSeries(c: ConfigPrimeraVez, primeraVez: boolean): Promise<void> {
  if (!c.series) return
  const d = db()
  for (const [i, s] of c.series.entries()) {
    let existe = await d.contadores.get(s.id)
    if (!s.usar) {
      if (existe?.activo) await d.contadores.put({ ...existe, activo: false })
      continue
    }
    if (primeraVez && existe) { await d.contadores.delete(s.id); existe = undefined }
    const sinSubida = c.subidaSugerida === false ? true : undefined
    if (existe && existe.activo && existe.nombre === s.nombre.trim() && existe.cantidadPorToque === s.reps && seriesDe(existe) === s.series && !!existe.sinSubida === !!sinSubida) {
      if (existe.orden !== i + 1) await d.contadores.put({ ...existe, orden: i + 1 })
      continue
    }
    const mismosNumeros = !!existe && existe.cantidadPorToque === s.reps && seriesDe(existe) === s.series
    const { cuota, extra } = cuotaDeSeries(s.reps, s.series)
    const { creado: _c, ...resto } = existe ?? ({} as Partial<Contador>)
    void _c
    await guardarContador({
      xpMetaDiaria: 10, xpExtra: 5, atributoIds: ['fisico'],
      ...resto,
      id: s.id, nombre: s.nombre.trim(), cantidadPorToque: s.reps, seriesPorDia: s.series,
      metaDiaria: mismosNumeros ? existe!.metaDiaria : cuota, metaExtra: mismosNumeros ? existe!.metaExtra : extra,
      cuotaAMano: mismosNumeros ? existe!.cuotaAMano : undefined,
      activo: true, sinSubida, orden: i + 1,
    })
  }
}

/** Ajustes que salen del asistente (nombre, tema, horarios, juego, agua, fruta, avisos, series sin usar). */
async function aplicarAjustes(c: ConfigPrimeraVez, deNuevo: boolean): Promise<void> {
  const a = await obtenerAjustes()
  const tema = temaPorId(c.tema)
  const cambioTema = !deNuevo || a.tema !== tema.id
  const cambios: Partial<Ajustes> = {
    nombrePersona: c.nombrePersona.trim(),
    nombreApp: c.nombreApp.trim() || 'SEK',
    tema: tema.id,
    ...(cambioTema ? { nombrePersonaje: tema.personaje, ...(tema.nombresFases?.length === 3 ? { nombresFases: tema.nombresFases } : {}) } : {}),
    horaAlistarse: c.horarios.alistarse,
    horaDejarCelu: c.horarios.dejarCelu,
    horaDormido: c.horarios.dormir,
  }
  if (c.juego) { cambios.limiteJuegoSemana = Math.round(c.juego.semana); cambios.limiteJuegoFinde = Math.round(c.juego.finde) }
  if (c.agua) {
    const actual = await configAgua()
    const ml = Math.round(c.agua.litros * 1000)
    const enHoy = c.agua.usar ? (actual.config.enHoy && actual.config.enHoy !== 'no' ? actual.config.enHoy : 'chica') : 'no'
    cambios.agua = { ...actual.config, enHoy, ...(c.agua.usar && ml !== actual.objetivo ? { objetivoMl: ml } : {}) }
  }
  if (c.fruta) {
    const f = await configFruta()
    const n = Math.max(1, Math.round(c.fruta.porDia))
    cambios.fruta = { ...f, usar: c.fruta.usar, objetivo1: n, objetivo2: Math.max(f.objetivo2, n + 1) }
  }
  if (c.avisos) { cambios.avisos = c.avisos.avisos; cambios.avisosPropios = c.avisos.avisosPropios }
  if (c.repsSinSerie) cambios.batalla = { ...a.batalla, repsSinSerie: Math.round(c.repsSinSerie) }
  if (!deNuevo) cambios.aMedida = true
  await guardarAjustes(cambios, deNuevo ? 'Configurar de nuevo' : 'Primera vez')
}

/** Guarda todo lo elegido y arranca el ciclo de 90 días desde hoy. */
export async function configurarPrimeraVez(c: ConfigPrimeraVez): Promise<void> {
  const errores = validarPrimeraVez(c)
  if (errores.length) throw new Error(errores.join(' '))
  const d = db()
  await aplicarAjustes(c, false)
  if (c.vision?.trim() || c.obstaculo?.trim()) await guardarIdentidad({ vision: (c.vision ?? '').trim(), obstaculos: (c.obstaculo ?? '').trim() })
  await aplicarPilares(c, false)
  await aplicarSeries(c, true)

  // Entreno: si no hay sesiones, las rutinas de Navil se cambian por la de ejemplo.
  if ((await d.sesionesEntreno.count()) === 0) {
    const entrenar = c.pilares.find((p) => p.clave === 'entrenar')
    await d.transaction('rw', [d.rutinas, d.eventos], async () => {
      await d.rutinas.clear()
      await d.rutinas.put({ ...rutinaDeEjemplo(entrenar?.dias ?? [1, 3, 5]), creado: ahora() })
      await registrarEvento({ tipo: 'crear', entidad: 'rutina', entidadId: 'rutina-ejemplo', motivo: 'Primera vez: rutina de ejemplo' })
    })
  }
  // «Mi código» arranca vacío (los ejemplos eran de Navil).
  await d.codigo.clear()
  await guardarAjustes({ codigoSembrado: true, primeraVezHecha: true }, 'Primera vez: lista')

  await iniciarCiclo(c.hoy, { duracionDias: 90 })
  await cerrarDiasPendientes()
}

/** «Configurar de nuevo» (Más): cambia solo ajustes, pilares y series. No borra datos ni toca el ciclo. */
export async function configurarDeNuevo(c: ConfigPrimeraVez): Promise<void> {
  const errores = validarPrimeraVez(c)
  if (errores.length) throw new Error(errores.join(' '))
  await aplicarAjustes(c, true)
  await aplicarPilares(c, true)
  await aplicarSeries(c, false)
}

/** Lo que se carga de entrada en el asistente: valores de ejemplo (primera vez) o lo que ya tiene (de nuevo). */
export async function configDeEntrada(hoy: FechaDia, deNuevo: boolean): Promise<ConfigPrimeraVez> {
  const a = await obtenerAjustes()
  const agua = await configAgua()
  const fruta = await configFruta()
  const comun = {
    hoy,
    horarios: { alistarse: a.horaAlistarse, dejarCelu: a.horaDejarCelu, dormir: a.horaDormido },
    juego: { semana: a.limiteJuegoSemana, finde: a.limiteJuegoFinde },
    avisos: { avisos: a.avisos, avisosPropios: a.avisosPropios },
    repsSinSerie: a.batalla?.repsSinSerie ?? 10,
  }
  if (!deNuevo) {
    return {
      ...comun,
      nombrePersona: '', nombreApp: 'SEK', tema: 'shinobi',
      pilares: PILARES_DEL_CREADOR.map((p) => ({ ...p, dias: [...p.dias] })),
      series: seriesDeEntrada(), subidaSugerida: true,
      agua: { usar: true, litros: 2 },
      fruta: { usar: true, porDia: FRUTA_DEFECTO.objetivo1 },
    }
  }
  const acciones = (await db().acciones.toArray()).filter((x) => x.pilar && x.activa).sort((x, y) => x.orden - y.orden)
  const pilares: EleccionPilar[] = []
  for (const x of acciones) {
    const e = eleccionDeAccion(x)
    if (e && !pilares.some((p) => p.clave === e.clave)) pilares.push(e)
  }
  const contadores = await db().contadores.orderBy('orden').toArray()
  const series: SerieElegida[] = contadores.map((x) => ({ id: x.id, nombre: x.nombre, usar: x.activo, reps: x.cantidadPorToque, series: seriesDe(x) }))
  for (const b of SERIES_BASE) if (!series.some((x) => x.id === b.id)) series.push({ id: b.id, nombre: b.nombre, usar: false, ...numerosDeNivel(b.id, 'empezando') })
  return {
    ...comun,
    nombrePersona: a.nombrePersona ?? '', nombreApp: a.nombreApp ?? 'SEK', tema: a.tema ?? 'shinobi',
    pilares, pilaresIniciales: pilares.map((p) => p.id!).filter(Boolean),
    series, subidaSugerida: !contadores.filter((x) => x.activo).every((x) => x.sinSubida) || contadores.every((x) => !x.activo),
    agua: { usar: agua.config.enHoy !== 'no', litros: agua.objetivo / 1000 },
    fruta: { usar: fruta.usar !== false, porDia: fruta.objetivo1 },
  }
}

/** Borra todos los datos y las preferencias de este dispositivo: al recargar aparece la primera vez. */
export async function empezarDeCero(): Promise<void> {
  await borrarTodo()
  try { localStorage.clear() } catch { /* sin almacenamiento */ }
  try { sessionStorage.clear() } catch { /* sin almacenamiento */ }
}
