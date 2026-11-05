/**
 * Ninjas de la distracción: en los momentos de duda aparece un ninja gris con el nombre de una
 * distracción (lista que edita la persona) y el shinobi lo bloquea. Si la persona toca «Empezar»,
 * el ninja queda vencido; si no, se escapó. Sin XP: no se farmea con el botón.
 */
import { db } from '../data/db'
import type { Ajustes, Distraccion, MomentoNinja, PeleaNinja } from '../data/tipos'
import { lunesDe, minutosDe, sumarDias, type FechaDia } from '../domain/fechas'
import { guardarAjustes, obtenerAjustes } from './base'
import { ahora, nuevoId } from './reloj'

/** Las 3 de muestra: se pueden borrar o renombrar. */
export const DISTRACCIONES_MUESTRA: Distraccion[] = [
  { id: 'celu', nombre: 'Celu' },
  { id: 'juego', nombre: 'Juego' },
  { id: 'pereza', nombre: 'Pereza' },
]

/** Apariciones automáticas por día como máximo (el botón «Estoy dudando» no tiene tope). */
export const TOPE_NINJAS_DIA = 2
/** Minutos antes de «empezar hasta» en que aparece el ninja del pilar. */
export const MINUTOS_PILAR = 15

export const NOMBRE_MOMENTO: Record<MomentoNinja, string> = {
  pilar: 'Pilar por vencer (15 min antes)',
  noche: 'Después de «Dejo celu» sin dormir',
  duda: 'Botón «Estoy dudando»',
  juego: 'Límite de juego pasado',
  batalla: 'Batalla (botón «Dudo»)',
}

export function distraccionesDe(a: Pick<Ajustes, 'distracciones'>): Distraccion[] {
  return a.distracciones ?? DISTRACCIONES_MUESTRA
}

export async function guardarDistracciones(lista: Distraccion[]): Promise<void> {
  await guardarAjustes({ distracciones: lista.map((d) => ({ ...d, nombre: d.nombre.trim() })).filter((d) => d.nombre) }, 'Mis distracciones')
}

export function nuevaDistraccion(nombre: string, momento?: Distraccion['momento']): Distraccion {
  return { id: `d-${nuevoId()}`, nombre: nombre.trim(), momento }
}

export type DatosMomento = {
  minutoActual: number
  pilaresPendientes: { id: string; nombre: string; horaLimite?: string; entreno?: boolean }[]
  /** Pasó la hora de «Dejo celu» y todavía no se marcó. */
  pasoDejoCelu: boolean
  juegoPasado: boolean
}

export type MomentoActivo = { momento: MomentoNinja; pilar?: { id: string; nombre: string; entreno?: boolean } }

/** Qué momento de duda está activo ahora (el primero que aplica). */
export function momentoActivo(d: DatosMomento): MomentoActivo | null {
  for (const p of d.pilaresPendientes) {
    if (!p.horaLimite) continue
    const faltan = minutosDe(p.horaLimite) - d.minutoActual
    if (faltan >= 0 && faltan <= MINUTOS_PILAR) return { momento: 'pilar', pilar: { id: p.id, nombre: p.nombre, entreno: p.entreno } }
  }
  if (d.pasoDejoCelu) return { momento: 'noche' }
  if (d.juegoPasado) return { momento: 'juego' }
  return null
}

/** Qué ninja sale: el asignado a ese momento; si ninguno, uno al azar sin repetir en el día. */
export function elegirNinja(lista: Distraccion[], momento: MomentoNinja, usadosHoy: string[], azar: () => number = Math.random): Distraccion | null {
  if (!lista.length) return null
  const asignados = lista.filter((d) => d.momento === momento)
  if (asignados.length) return asignados[Math.floor(azar() * asignados.length) % asignados.length]
  const libres = lista.filter((d) => !d.momento || d.momento === 'cualquiera')
  const base = libres.length ? libres : lista
  const sinRepetir = base.filter((d) => !usadosHoy.includes(d.id))
  const de = sinRepetir.length ? sinRepetir : base
  return de[Math.floor(azar() * de.length) % de.length]
}

/** Qué hace el botón de la pelea según el momento. */
export function accionDePelea(x: MomentoActivo): { etiqueta: string; ruta: string } {
  if (x.pilar) return { etiqueta: `Empezar ${x.pilar.nombre}`, ruta: x.pilar.entreno ? '/entreno' : '/' }
  if (x.momento === 'noche') return { etiqueta: 'Dejo celu', ruta: '/' }
  if (x.momento === 'juego') return { etiqueta: 'Cerrar el juego', ruta: '/juego' }
  return { etiqueta: 'Seguir con lo mío', ruta: '/' }
}

/** Frase corta que queda al terminar la pelea. */
export function fraseDePelea(x: MomentoActivo, distraccion: string): string {
  if (x.pilar) return `${distraccion} quiere que lo dejes para mañana. ${x.pilar.nombre} se hace hoy.`
  if (x.momento === 'noche') return `${distraccion} no te deja dormir. La lámpara se apaga ahora.`
  if (x.momento === 'juego') return `${distraccion} ya se llevó su parte. Hasta acá.`
  return `${distraccion} apareció. Vos decidís quién sigue.`
}

export async function peleasDelDia(fecha: FechaDia): Promise<PeleaNinja[]> {
  return (await db().ninjas.where('fecha').equals(fecha).toArray()).sort((a, b) => a.instante - b.instante)
}

/** ¿Puede aparecer solo en ese momento? Tope de 2 automáticos por día y una vez por momento. */
export async function puedeAparecer(fecha: FechaDia, momento: MomentoNinja): Promise<boolean> {
  if (momento === 'duda' || momento === 'batalla') return true
  const hoy = await peleasDelDia(fecha)
  const automaticas = hoy.filter((p) => p.momento !== 'duda' && p.momento !== 'batalla')
  if (automaticas.length >= TOPE_NINJAS_DIA) return false
  return !automaticas.some((p) => p.momento === momento)
}

export type Pelea = { fecha: FechaDia; distraccion: Distraccion; momento: MomentoActivo }

/** Arma una pelea si corresponde: ajuste encendido, lista no vacía, tope del día. */
export async function prepararPelea(fecha: FechaDia, momento: MomentoActivo, azar: () => number = Math.random): Promise<Pelea | null> {
  const a = await obtenerAjustes()
  if (a.ninjas === false) return null
  const lista = distraccionesDe(a)
  if (!lista.length) return null
  if (!(await puedeAparecer(fecha, momento.momento))) return null
  const usados = (await peleasDelDia(fecha)).map((p) => p.distraccion)
  const ninja = elegirNinja(lista, momento.momento, usados, azar)
  if (!ninja) return null
  return { fecha, distraccion: ninja, momento }
}

/** Sello del día: vencido («Empezar») o se escapó («Ahora no»). */
export async function registrarPelea(p: Pelea, resultado: PeleaNinja['resultado'], extra: { reps?: number; robo?: number } = {}): Promise<PeleaNinja> {
  const x: PeleaNinja = { fecha: p.fecha, distraccion: p.distraccion.id, momento: p.momento.momento, resultado, pilar: p.momento.pilar?.id, instante: ahora(), ...(extra.reps ? { reps: extra.reps } : {}), ...(extra.robo ? { robo: extra.robo } : {}) }
  x.id = await db().ninjas.add(x) as number
  return x
}

/** Para Progreso: ninjas vencidos esta semana (lunes a hoy). */
export async function ninjasVencidosSemana(hoy: FechaDia): Promise<{ vencidos: number; peleas: number }> {
  const lista = await db().ninjas.where('fecha').between(lunesDe(hoy), sumarDias(hoy, 1), true, false).toArray()
  return { vencidos: lista.filter((p) => p.resultado === 'vencido').length, peleas: lista.length }
}

/** Nombre de una distracción por id (si se borró de la lista, el id). */
export function nombreDistraccion(lista: Distraccion[], id: string): string {
  return lista.find((d) => d.id === id)?.nombre ?? id
}

// ---------- El tajo (volver después de horas con un pilar pendiente) ----------

export const HORAS_TAJO = 3
const CLAVE_VISTA = 'sek-ultima-vista'
const CLAVE_TAJO = 'sek-tajo'

/** Se fija al cargar la app: la última vez que estuvo a la vista antes de esta sesión. */
let vistaAnteriorCache: number | null = typeof localStorage === 'undefined' ? null : ultimaVista()
let estuvoOculta = false

export function vistaAnterior(): number | null {
  return vistaAnteriorCache
}

/** Al ocultarse se anota la hora; al volver a estar visible, esa hora pasa a ser la «vista anterior». */
export function cambioVisibilidad(visible: boolean): void {
  if (!visible) { estuvoOculta = true; anotarVista(); return }
  if (estuvoOculta) { estuvoOculta = false; vistaAnteriorCache = ultimaVista() }
}

/** Anota el último momento en que la app estuvo a la vista. */
export function anotarVista(t: number = ahora()): void {
  try { localStorage.setItem(CLAVE_VISTA, String(t)) } catch { /* sin almacenamiento */ }
}

export function ultimaVista(): number | null {
  try { const v = localStorage.getItem(CLAVE_VISTA); return v ? Number(v) : null } catch { return null }
}

/** ¿Toca el tajo? Volvió después de ≥ 3 h, hay un pilar pendiente, no es de noche y hoy todavía no salió. */
export function debeMostrarTajo(x: { ultimaVista: number | null; ahora: number; pilarPendiente: boolean; pasoDejoCelu: boolean; mostradoHoy: boolean }): boolean {
  if (x.mostradoHoy || !x.pilarPendiente || x.pasoDejoCelu) return false
  if (x.ultimaVista === null) return false
  return x.ahora - x.ultimaVista >= HORAS_TAJO * 3_600_000
}

export function tajoMostradoHoy(hoy: FechaDia): boolean {
  try { return localStorage.getItem(CLAVE_TAJO) === hoy } catch { return false }
}

export function marcarTajo(hoy: FechaDia): void {
  try { localStorage.setItem(CLAVE_TAJO, hoy) } catch { /* sin almacenamiento */ }
}

// ---------- Registro del día en una línea (chips) ----------

/** vencido: hizo las reps y además un 3·2·1 o un Siguiente acción · duda: le falta algo (todavía puede) · escapado · robo. */
export type EstadoChipBatalla = 'vencido' | 'duda' | 'escapado' | 'robo'
export type ChipBatalla = { pelea: PeleaNinja; estado: EstadoChipBatalla; repsDespues: number; hizoReps: boolean; hizoAccion: boolean }

/**
 * Cuándo cuenta como vencido: solo si después de la pelea hizo las reps (las de la batalla o una serie del contador)
 * y además al menos un 3·2·1 o un Siguiente acción. Si falta algo queda en duda hasta que lo haga; si el día terminó, escapó.
 */
export function estadoChip(p: PeleaNinja, info: { repsDespues: number; ultimaAccion: number; diaTerminado: boolean }): EstadoChipBatalla {
  if (p.robo) return 'robo'
  if (p.resultado === 'escapo') return 'escapado'
  const hizoReps = (p.reps ?? 0) > 0 || info.repsDespues > 0
  const hizoAccion = info.ultimaAccion >= p.instante
  if (hizoReps && hizoAccion) return 'vencido'
  return info.diaTerminado ? 'escapado' : 'duda'
}

/** Chips del día, en orden. `ultimaAccion`: último instante en que se usó 3·2·1 o Siguiente acción (0 si no). */
export async function registroBatallas(fecha: FechaDia, contadorId: string, ultimaAccion: number, diaTerminado = false): Promise<ChipBatalla[]> {
  const peleas = await peleasDelDia(fecha)
  const registros = await db().registrosContador.where('fecha').equals(fecha).filter((r) => r.contadorId === contadorId).toArray()
  return peleas.map((p) => {
    const repsDespues = registros.filter((r) => r.instante >= p.instante).reduce((s, r) => s + r.cantidad, 0)
    const estado = estadoChip(p, { repsDespues, ultimaAccion, diaTerminado })
    return { pelea: p, estado, repsDespues, hizoReps: (p.reps ?? 0) > 0 || repsDespues > 0, hizoAccion: ultimaAccion >= p.instante }
  })
}
