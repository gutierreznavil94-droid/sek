/**
 * Reglas de Organización, sin pantalla. Todo es JavaScript simple: sirve igual en SEK y en Tumi.
 * Las funciones que cambian algo modifican los datos que reciben (quien llama guarda después).
 */
import type { AjustesOrganizacion, DatosOrganizacion, Dia, Donde, Estado, Frente, Importancia, ItemBandeja, Quien, Rapidez, Tarea } from './tipos'
import { aprender, sugerir } from './sugerir'

export const LIMITE_SUELTAS = 5
export const COLORES = ['#C8102E', '#78BD97', '#e0a23a', '#9b7bd4', '#3fb0ac', '#d9822b', '#c9a227', '#e06c9f']
export const ICONOS_FRENTE = ['💡', '🗺', '🏢', '🎨', '🧮', '🙋', '📦', '🏠', '📚', '🔷']

const AJUSTES: AjustesOrganizacion = { limiteHoy: 3, sugerir: true, vista: 'todo' }

// ---------- Fechas ----------

export function diaLocal(d: Date = new Date()): Dia {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const n = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${n}`
}

export function sumarDias(dia: Dia, n: number): Dia {
  const [a, m, d] = dia.split('-').map(Number)
  return diaLocal(new Date(a, m - 1, d + n))
}

/** Días entre dos fechas (b − a). */
export function diasEntre(a: Dia, b: Dia): number {
  const [a1, m1, d1] = a.split('-').map(Number)
  const [a2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 864e5)
}

/** «atrasada», «hoy», «mañana», «en 5 días». */
export function cuando(fecha: Dia, hoy: Dia): string {
  const d = diasEntre(hoy, fecha)
  return d < 0 ? 'atrasada' : d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`
}

export function nuevoId(prefijo = 't'): string {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ---------- Datos ----------

export function frenteSueltas(hoy: Dia): Frente {
  return { id: 'sueltas', nombre: 'Sueltas', tipo: 'sueltas', icono: '', color: '#C8102E', sub: 'Cosas sin proyecto', movido: hoy, tareas: [] }
}

/** Lo que ve alguien la primera vez: Sueltas y Personal, vacíos. */
export function datosIniciales(hoy: Dia): DatosOrganizacion {
  return {
    formato: 1,
    frentes: [frenteSueltas(hoy), { id: 'personal', nombre: 'Personal', icono: '🙋', color: '#78BD97', sub: 'Cosas mías', movido: hoy, tareas: [] }],
    archivados: [],
    bandeja: [],
    ajustes: { ...AJUSTES },
  }
}

const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object'

/**
 * Toma lo que haya guardado (o nada) y devuelve datos válidos. Acá van las migraciones:
 * solo suman lo que falta, nunca borran lo cargado.
 */
export function normalizar(x: unknown, hoy: Dia): DatosOrganizacion {
  if (!esObj(x) || !Array.isArray(x.frentes)) return datosIniciales(hoy)
  const d = x as unknown as DatosOrganizacion
  d.formato = 1
  d.archivados = Array.isArray(d.archivados) ? d.archivados : []
  d.bandeja = Array.isArray(d.bandeja) ? d.bandeja : []
  d.ajustes = { ...AJUSTES, ...(esObj(d.ajustes) ? d.ajustes : {}) }
  for (const f of [...d.frentes, ...d.archivados]) {
    f.tareas = Array.isArray(f.tareas) ? f.tareas : []
    f.movido = f.movido || hoy
    for (const t of f.tareas) {
      t.quien = t.quien || 'yo'
      t.estado = t.estado === 'hecho' ? 'hecho' : 'por_hacer'
      t.creada = t.creada || Date.now()
    }
  }
  if (!d.frentes.some((f) => f.tipo === 'sueltas')) d.frentes.unshift(frenteSueltas(hoy))
  return d
}

// ---------- Consultas ----------

export const buscarFrente = (d: DatosOrganizacion, id: string): Frente | undefined =>
  d.frentes.find((f) => f.id === id) ?? d.archivados.find((f) => f.id === id)

export function buscarTarea(d: DatosOrganizacion, fid: string, tid: string): { f: Frente; t: Tarea } | null {
  const f = buscarFrente(d, fid)
  const t = f?.tareas.find((x) => x.id === tid)
  return f && t ? { f, t } : null
}

/** «Hoy me toca a mí»: lo mío, con fecha de hoy o vencida, y no hecho. */
export function toca(t: Tarea, hoy: Dia): boolean {
  return t.estado !== 'hecho' && (t.quien || 'yo') === 'yo' && !!t.fecha && t.fecha <= hoy
}

export function meToca(d: DatosOrganizacion, hoy: Dia): { f: Frente; t: Tarea }[] {
  const r: { f: Frente; t: Tarea }[] = []
  for (const f of d.frentes) for (const t of f.tareas) if (toca(t, hoy)) r.push({ f, t })
  return r.sort((a, b) => (a.t.fecha! < b.t.fecha! ? -1 : a.t.fecha! > b.t.fecha! ? 1 : 0))
}

export function avance(f: Frente): number {
  return f.tareas.length ? Math.round((100 * f.tareas.filter((t) => t.estado === 'hecho').length) / f.tareas.length) : 0
}

/** Lo que sigue en un frente: primero lo que toca hoy, después lo que tiene fecha, después el resto. */
export function proxima(f: Frente, hoy: Dia): Tarea | undefined {
  const peso = (t: Tarea) => (toca(t, hoy) ? 0 : t.fecha ? 1 : 2)
  return f.tareas.filter((t) => t.estado !== 'hecho').sort((a, b) => peso(a) - peso(b) || (a.fecha ?? '9').localeCompare(b.fecha ?? '9'))[0]
}

export function resumen(d: DatosOrganizacion, hoy: Dia): { meToca: number; bandeja: number; hechas: number; total: number; porcentaje: number } {
  const total = d.frentes.reduce((a, f) => a + f.tareas.length, 0)
  const hechas = d.frentes.reduce((a, f) => a + f.tareas.filter((t) => t.estado === 'hecho').length, 0)
  return { meToca: meToca(d, hoy).length, bandeja: d.bandeja.length, hechas, total, porcentaje: total ? Math.round((100 * hechas) / total) : 0 }
}

// ---------- Clasificar ----------

export interface Clasificacion {
  quien?: Quien
  quienNombre?: string
  imp?: Importancia
  rapidez?: Rapidez
  /** 'nada' = Sin dónde. */
  donde?: Donde | 'nada'
  /** 'libre' o una fecha. */
  fecha?: Dia | 'libre'
}

export const CAMPOS_CLASIFICAR = { quien: 'quién', imp: 'importancia', rapidez: 'rapidez', donde: 'dónde', fecha: 'fecha' } as const
export type CampoClasificar = keyof typeof CAMPOS_CLASIFICAR

/** Qué falta para poder elegir frente (todo es obligatorio; «Sin dónde» y «Libre» valen). */
export function faltan(c: Clasificacion): CampoClasificar[] {
  return (Object.keys(CAMPOS_CLASIFICAR) as CampoClasificar[]).filter((k) =>
    k === 'quien' ? !c.quien || (c.quien !== 'yo' && !c.quienNombre?.trim()) : !c[k],
  )
}

/** Lo que ya se sabía de un ítem de la bandeja (si volvió a Clasificar). */
export function clasificacionPrevia(it: ItemBandeja): Clasificacion {
  const p = it.previo
  if (!p) return { quien: 'yo' }
  return { quien: p.quien || 'yo', quienNombre: p.quienNombre, imp: p.imp, rapidez: p.rapidez, donde: p.donde || 'nada', fecha: p.fecha || 'libre' }
}

// ---------- Cambios ----------

export function anotar(d: DatosOrganizacion, texto: string, frente?: string): ItemBandeja {
  const it: ItemBandeja = { id: nuevoId('b'), texto: texto.trim(), creada: Date.now() }
  if (frente && buscarFrente(d, frente)) it.frente = frente
  d.bandeja.push(it)
  return it
}

export function clasificar(d: DatosOrganizacion, itemId: string, frenteId: string, c: Clasificacion, hoy: Dia): Tarea | null {
  const i = d.bandeja.findIndex((x) => x.id === itemId)
  const f = d.frentes.find((x) => x.id === frenteId)
  if (i < 0 || !f || faltan(c).length) return null
  const it = d.bandeja[i]
  aprender(d, it.texto, f, sugerir(d, it.texto))
  const t: Tarea = { ...(it.previo ?? {}), id: it.previo?.id ?? nuevoId(), texto: it.texto, estado: 'por_hacer', quien: c.quien!, creada: it.previo?.creada ?? it.creada ?? Date.now() }
  delete t.quienNombre; delete t.donde; delete t.fecha; delete t.hecha
  if (c.quien !== 'yo' && c.quienNombre?.trim()) t.quienNombre = c.quienNombre.trim()
  t.imp = c.imp
  t.rapidez = c.rapidez
  if (c.donde && c.donde !== 'nada') t.donde = c.donde
  if (c.fecha && c.fecha !== 'libre') t.fecha = c.fecha
  f.tareas.push(t)
  f.movido = hoy
  d.bandeja.splice(i, 1)
  return t
}

/** «Ya lo hice (menos de 2 min)»: queda anotada como hecha en el frente sugerido, o en Sueltas. */
export function yaLoHice(d: DatosOrganizacion, itemId: string, hoy: Dia): { f: Frente; t: Tarea } | null {
  const i = d.bandeja.findIndex((x) => x.id === itemId)
  if (i < 0) return null
  const it = d.bandeja[i]
  const f = (it.frente && d.frentes.find((x) => x.id === it.frente)) || sugerir(d, it.texto)?.f || d.frentes.find((x) => x.tipo === 'sueltas') || d.frentes[0]
  const t: Tarea = { id: nuevoId(), texto: it.texto, estado: 'hecho', quien: 'yo', creada: it.creada ?? Date.now(), hecha: Date.now() }
  f.tareas.push(t)
  f.movido = hoy
  d.bandeja.splice(i, 1)
  return { f, t }
}

export function borrarDeBandeja(d: DatosOrganizacion, itemId: string): void {
  d.bandeja = d.bandeja.filter((x) => x.id !== itemId)
}

export function marcar(d: DatosOrganizacion, fid: string, tid: string, estado: Estado, hoy: Dia): Tarea | null {
  const x = buscarTarea(d, fid, tid)
  if (!x) return null
  x.t.estado = estado
  if (estado === 'hecho') x.t.hecha = Date.now()
  else delete x.t.hecha
  x.f.movido = hoy
  return x.t
}

type CambioTarea = Partial<Pick<Tarea, 'texto' | 'quien' | 'quienNombre' | 'imp' | 'rapidez' | 'donde' | 'fecha'>>

/** Cambia campos de una tarea. Un valor vacío ('' o undefined) borra el campo (Sin dónde, Libre, Sin marcar). */
export function cambiarTarea(d: DatosOrganizacion, fid: string, tid: string, cambios: CambioTarea, hoy: Dia): Tarea | null {
  const x = buscarTarea(d, fid, tid)
  if (!x) return null
  for (const [k, v] of Object.entries(cambios) as [keyof CambioTarea, string | undefined][]) {
    if (k === 'texto') { if (v && v.trim()) x.t.texto = v.trim(); continue }
    if (v === undefined || v === '') delete x.t[k]
    else (x.t as unknown as Record<string, string>)[k] = v
  }
  if (!x.t.quien) x.t.quien = 'yo'
  if (x.t.quien === 'yo') delete x.t.quienNombre
  x.f.movido = hoy
  return x.t
}

export function moverTarea(d: DatosOrganizacion, fid: string, tid: string, destino: string, hoy: Dia): boolean {
  const x = buscarTarea(d, fid, tid)
  const g = d.frentes.find((f) => f.id === destino)
  if (!x || !g || g === x.f) return false
  x.f.tareas = x.f.tareas.filter((t) => t !== x.t)
  g.tareas.push(x.t)
  x.f.movido = hoy
  g.movido = hoy
  return true
}

export function nuevoFrente(d: DatosOrganizacion, hoy: Dia, nombre = 'Frente nuevo'): Frente {
  const f: Frente = { id: nuevoId('f'), nombre, icono: '💡', color: COLORES[d.frentes.length % COLORES.length], sub: '', movido: hoy, tareas: [] }
  d.frentes.push(f)
  return f
}

export function cambiarFrente(d: DatosOrganizacion, fid: string, cambios: Partial<Pick<Frente, 'nombre' | 'icono' | 'color' | 'sub' | 'nota'>>): void {
  const f = buscarFrente(d, fid)
  if (!f) return
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) delete cambios.nombre
  Object.assign(f, cambios)
}

export function finalizarFrente(d: DatosOrganizacion, fid: string, hoy: Dia): Frente | null {
  const i = d.frentes.findIndex((f) => f.id === fid)
  if (i < 0 || d.frentes[i].tipo === 'sueltas') return null
  const [f] = d.frentes.splice(i, 1)
  f.finalizado = hoy
  d.archivados.push(f)
  return f
}

export function reabrirFrente(d: DatosOrganizacion, fid: string, hoy: Dia): Frente | null {
  const i = d.archivados.findIndex((f) => f.id === fid)
  if (i < 0) return null
  const [f] = d.archivados.splice(i, 1)
  delete f.finalizado
  f.movido = hoy
  d.frentes.push(f)
  return f
}

/** Elimina el frente y sus tareas (lo confirmó Navil). Sueltas no se elimina. */
export function eliminarFrente(d: DatosOrganizacion, fid: string): Frente | null {
  const f = buscarFrente(d, fid)
  if (!f || f.tipo === 'sueltas') return null
  d.frentes = d.frentes.filter((x) => x.id !== fid)
  d.archivados = d.archivados.filter((x) => x.id !== fid)
  for (const it of d.bandeja) if (it.frente === fid) delete it.frente
  return f
}

export function moverFrente(d: DatosOrganizacion, fid: string, dir: -1 | 1): void {
  const i = d.frentes.findIndex((f) => f.id === fid)
  const j = i + dir
  if (i < 0 || j < 0 || j >= d.frentes.length) return
  ;[d.frentes[i], d.frentes[j]] = [d.frentes[j], d.frentes[i]]
}

export function cambiarLimite(d: DatosOrganizacion, delta: number): number {
  d.ajustes.limiteHoy = Math.min(9, Math.max(1, (d.ajustes.limiteHoy || 3) + delta))
  return d.ajustes.limiteHoy
}
