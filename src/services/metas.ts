/**
 * Metas propias con fecha: pendiente → cumplida (verde, da XP) o no cumplida
 * (rojo). Se resuelven a mano cuando llega la fecha; nunca se marcan solas
 * en rojo porque solo la persona sabe si la logró.
 */

import { db } from '../data/db'
import type { EstadoMeta, Meta } from '../data/tipos'
import { diferenciaDias, type FechaDia } from '../domain/fechas'
import { claveXp } from '../domain/xp'
import { obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'
import { anularXp, concederXp } from './xp'

export const XP_META_POR_DEFECTO = 30

export function estadoDeMeta(m: Meta): EstadoMeta {
  if (m.estado) return m.estado
  return m.cumplida ? 'cumplida' : 'pendiente'
}

export async function listarMetasPropias(): Promise<Meta[]> {
  return (await db().metas.where('tipo').equals('propia').toArray()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function crearMeta(datos: { titulo: string; fecha: FechaDia; xp?: number; nota?: string }): Promise<Meta> {
  const d = db()
  const titulo = datos.titulo.trim()
  if (!titulo) throw new Error('La meta necesita un título')
  const meta: Meta = { id: nuevoId('meta'), fecha: datos.fecha, titulo, tipo: 'propia', estado: 'pendiente', xp: datos.xp ?? XP_META_POR_DEFECTO, nota: datos.nota, creado: ahora() }
  await d.transaction('rw', [d.metas, d.eventos], async () => {
    await d.metas.add(meta)
    await registrarEvento({ tipo: 'crear', entidad: 'meta', entidadId: meta.id, despues: meta })
  })
  return meta
}

export async function editarMeta(id: string, cambios: Partial<Pick<Meta, 'titulo' | 'fecha' | 'xp' | 'nota'>>): Promise<Meta> {
  const d = db()
  return d.transaction('rw', [d.metas, d.eventos], async () => {
    const antes = await d.metas.get(id)
    if (!antes) throw new Error(`Meta ${id} no existe`)
    const despues: Meta = { ...antes, ...cambios }
    await d.metas.put(despues)
    await registrarEvento({ tipo: 'editar', entidad: 'meta', entidadId: id, antes, despues })
    return despues
  })
}

/**
 * Resuelve una meta: «Lo logré» (cumplida, da su XP una sola vez) o «No llegué»
 * (no cumplida). Se puede corregir después; el XP se anula o se reconcede con
 * historial, nunca se duplica.
 */
export async function resolverMeta(id: string, lograda: boolean, motivo?: string): Promise<{ meta: Meta; xp: number; nuevoNivel: number | null }> {
  const d = db()
  const antes = await d.metas.get(id)
  if (!antes) throw new Error(`Meta ${id} no existe`)
  const estado: EstadoMeta = lograda ? 'cumplida' : 'no_cumplida'
  const despues: Meta = { ...antes, estado, cumplida: lograda, resueltaEn: ahora() }
  await d.transaction('rw', [d.metas, d.eventos], async () => {
    await d.metas.put(despues)
    await registrarEvento({ tipo: antes.estado && antes.estado !== 'pendiente' ? 'corregir' : 'editar', entidad: 'meta', entidadId: id, antes, despues, motivo })
  })
  const clave = claveXp('meta', [id])
  if (lograda) {
    const cantidad = antes.xp ?? XP_META_POR_DEFECTO
    if (cantidad <= 0) return { meta: despues, xp: 0, nuevoNivel: null }
    const r = await concederXp({ clave, cantidad, origen: 'meta', fecha: antes.fecha, descripcion: `Meta: ${antes.titulo}` })
    return { meta: despues, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel }
  }
  await anularXp(clave, motivo ?? 'Meta marcada como no cumplida')
  return { meta: despues, xp: 0, nuevoNivel: null }
}

/** Vuelve una meta a pendiente (por ejemplo, si se marcó por error). */
export async function reabrirMeta(id: string, motivo = 'Vuelta a pendiente'): Promise<void> {
  const d = db()
  await anularXp(claveXp('meta', [id]), motivo)
  await d.transaction('rw', [d.metas, d.eventos], async () => {
    const antes = await d.metas.get(id)
    if (!antes) return
    const despues: Meta = { ...antes, estado: 'pendiente', cumplida: false, resueltaEn: undefined }
    await d.metas.put(despues)
    await registrarEvento({ tipo: 'corregir', entidad: 'meta', entidadId: id, antes, despues, motivo })
  })
}

export async function borrarMetaPropia(id: string): Promise<void> {
  const d = db()
  await anularXp(claveXp('meta', [id]), 'Meta borrada')
  await d.transaction('rw', [d.metas, d.eventos], async () => {
    const antes = await d.metas.get(id)
    if (!antes) return
    await d.metas.delete(id)
    await registrarEvento({ tipo: 'borrar', entidad: 'meta', entidadId: id, antes })
  })
}

/** Metas propias cuya fecha ya llegó y siguen sin respuesta (para preguntar en Hoy). */
export async function metasQueVencen(hoy: FechaDia): Promise<Meta[]> {
  return (await listarMetasPropias()).filter((m) => estadoDeMeta(m) === 'pendiente' && m.fecha <= hoy)
}

export type ResumenMetas = { pendientes: Meta[]; vencidas: Meta[]; cumplidas: Meta[]; noCumplidas: Meta[] }

export async function resumenMetas(hoy: FechaDia): Promise<ResumenMetas> {
  const todas = await listarMetasPropias()
  return {
    pendientes: todas.filter((m) => estadoDeMeta(m) === 'pendiente' && m.fecha > hoy),
    vencidas: todas.filter((m) => estadoDeMeta(m) === 'pendiente' && m.fecha <= hoy),
    cumplidas: todas.filter((m) => estadoDeMeta(m) === 'cumplida').sort((a, b) => b.fecha.localeCompare(a.fecha)),
    noCumplidas: todas.filter((m) => estadoDeMeta(m) === 'no_cumplida').sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }
}

export function diasParaMeta(m: Meta, hoy: FechaDia): number {
  return diferenciaDias(hoy, m.fecha)
}

export async function zonaHoraria(): Promise<string> {
  return (await obtenerAjustes()).zonaHoraria
}

// ---------- Metas rápidas por día (calendario, Hoy y Progreso) ----------

/** XP por meta cumplida (igual que un pilar) y cuántas por día dan XP. */
export const XP_META_RAPIDA = 15
export const TOPE_METAS_CON_XP = 3

export type EstadoVisibleMeta = 'pendiente' | 'cumplida' | 'no_cumplida'

/** Lo que se muestra: una meta de un día que ya pasó sin marcarse cuenta como no cumplida. */
export function estadoVisible(m: Meta, hoy: FechaDia): EstadoVisibleMeta {
  const e = estadoDeMeta(m)
  if (e === 'pendiente' && m.fecha < hoy) return 'no_cumplida'
  return e
}

/** Línea del calendario: verde con al menos una cumplida; gris si quedan pendientes; roja apagada si pasó sin cumplir. */
export function lineaDeMetas(metas: Meta[], hoy: FechaDia): 'verde' | 'gris' | 'roja' | null {
  if (!metas.length) return null
  const estados = metas.map((m) => estadoVisible(m, hoy))
  if (estados.includes('cumplida')) return 'verde'
  if (estados.includes('pendiente')) return 'gris'
  return 'roja'
}

/** Metas propias entre dos fechas, agrupadas por día. */
export async function metasPorDia(desde: FechaDia, hasta: FechaDia): Promise<Map<FechaDia, Meta[]>> {
  const lista = await db().metas.where('fecha').between(desde, hasta, true, true).toArray()
  const m = new Map<FechaDia, Meta[]>()
  for (const x of lista.filter((x) => x.tipo === 'propia').sort((a, b) => a.creado - b.creado)) {
    const l = m.get(x.fecha) ?? []
    l.push(x)
    m.set(x.fecha, l)
  }
  return m
}

/** Escribir una meta en un día (hoy o futuro). */
export async function crearMetaRapida(fecha: FechaDia, titulo: string, hoy: FechaDia): Promise<Meta> {
  if (fecha < hoy) throw new Error('En días pasados no se crean metas, solo se marcan')
  return crearMeta({ titulo, fecha, xp: XP_META_RAPIDA })
}

/**
 * Marcar una meta como cumplida: verde y +XP, con un tope de 3 metas con XP por
 * día. Si ya hay 3 con XP ese día, queda cumplida sin XP.
 */
export async function cumplirMeta(id: string): Promise<{ xp: number; nuevoNivel: number | null; conTope: boolean }> {
  const d = db()
  const meta = await d.metas.get(id)
  if (!meta) throw new Error(`Meta ${id} no existe`)
  const clave = claveXp('meta', [id])
  const delDia = await d.xp.where('fecha').equals(meta.fecha).toArray()
  const otrasConXp = delDia.filter((r) => r.origen === 'meta' && !r.anulado && r.clave !== clave).length
  if (otrasConXp >= TOPE_METAS_CON_XP) {
    const despues: Meta = { ...meta, estado: 'cumplida', cumplida: true, resueltaEn: ahora() }
    await d.transaction('rw', [d.metas, d.eventos], async () => {
      await d.metas.put(despues)
      await registrarEvento({ tipo: 'editar', entidad: 'meta', entidadId: id, antes: meta, despues, motivo: 'Cumplida sin XP (tope de 3 por día)' })
    })
    return { xp: 0, nuevoNivel: null, conTope: true }
  }
  const r = await resolverMeta(id, true)
  return { xp: r.xp, nuevoNivel: r.nuevoNivel, conTope: false }
}

/** Desmarcar: vuelve a pendiente y quita el XP (sin duplicar nunca). */
export async function desmarcarMeta(id: string): Promise<void> {
  await reabrirMeta(id, 'Desmarcada')
}

export type ResumenGraficoMetas = { cumplidas: number; puestas: number; porDia: Map<FechaDia, { cumplidas: number; noCumplidas: number; pendientes: number; metas: Meta[] }> }

/** Para el gráfico de Progreso: por día, cumplidas / no cumplidas / pendientes. */
export async function graficoMetas(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<ResumenGraficoMetas> {
  const porDia = new Map<FechaDia, { cumplidas: number; noCumplidas: number; pendientes: number; metas: Meta[] }>()
  let cumplidas = 0
  let puestas = 0
  for (const [f, metas] of await metasPorDia(desde, hasta)) {
    const x = { cumplidas: 0, noCumplidas: 0, pendientes: 0, metas }
    for (const m of metas) {
      const e = estadoVisible(m, hoy)
      if (e === 'cumplida') x.cumplidas++
      else if (e === 'no_cumplida') x.noCumplidas++
      else x.pendientes++
    }
    cumplidas += x.cumplidas
    puestas += metas.length
    porDia.set(f, x)
  }
  return { cumplidas, puestas, porDia }
}
