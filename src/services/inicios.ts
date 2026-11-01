/**
 * Protocolo 3-2-1 y "Siguiente acción": empezar sin esperar las ganas.
 * Un inicio da XP (pocos) con tope diario; la misma tarea no cobra dos veces
 * el mismo día.
 */

import { db } from '../data/db'
import type { SiguienteAccion } from '../data/tipos'
import { claveXp } from '../domain/xp'
import { fechaHoy, obtenerAjustes, registrarEvento } from './base'
import { iniciarCompromiso } from './dia'
import { ahora } from './reloj'
import { concederXp, xpDelDia } from './xp'

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

/** Guarda una tarea ambigua convertida en acción concreta (todavía sin empezar). */
export async function crearSiguienteAccion(tareaAmbigua: string, accionConcreta: string, compromisoId?: string): Promise<SiguienteAccion> {
  const d = db()
  const s: SiguienteAccion = { tareaAmbigua: tareaAmbigua.trim(), accionConcreta: accionConcreta.trim(), creado: ahora(), compromisoId }
  const id = (await d.siguienteAccion.add(s)) as number
  return { ...s, id }
}

export type ResultadoInicio = { registro: SiguienteAccion; xp: number; nuevoNivel: number | null; motivoSinXp?: string }

/**
 * Registra que una acción empezó (al terminar la cuenta atrás 3-2-1).
 * Si no existía registro previo, lo crea. Concede XP con tope diario.
 */
export async function registrarInicio(params: { id?: number; accionConcreta: string; tareaAmbigua?: string; compromisoId?: string }): Promise<ResultadoInicio> {
  const d = db()
  const t = ahora()
  let registro: SiguienteAccion
  if (params.id) {
    const previo = await d.siguienteAccion.get(params.id)
    if (!previo) throw new Error('Registro no existe')
    registro = { ...previo, iniciado: previo.iniciado ?? t, segundosHastaEmpezar: previo.segundosHastaEmpezar ?? Math.round((t - previo.creado) / 1000) }
    await d.siguienteAccion.put(registro)
  } else {
    registro = { tareaAmbigua: params.tareaAmbigua?.trim() ?? '', accionConcreta: params.accionConcreta.trim(), creado: t, iniciado: t, segundosHastaEmpezar: 0, compromisoId: params.compromisoId }
    registro.id = (await d.siguienteAccion.add(registro)) as number
  }
  await d.transaction('rw', [d.eventos], async () => {
    await registrarEvento({ tipo: 'crear', entidad: 'inicio', entidadId: String(registro.id), despues: registro })
  })
  if (registro.compromisoId) {
    const c = await d.compromisos.get(registro.compromisoId)
    if (c && c.estado === 'pendiente') await iniciarCompromiso(c.id)
  }
  const hoy = await fechaHoy()
  const ajustes = await obtenerAjustes()
  const yaHoy = (await xpDelDia(hoy)).filter((r) => r.origen === 'inicio').length
  if (yaHoy >= ajustes.maxIniciosXpPorDia) {
    return { registro, xp: 0, nuevoNivel: null, motivoSinXp: `Tope de ${ajustes.maxIniciosXpPorDia} inicios con XP por día` }
  }
  const r = await concederXp({
    clave: claveXp('inicio', [normalizar(registro.accionConcreta), hoy]),
    cantidad: ajustes.xpInicio,
    origen: 'inicio',
    fecha: hoy,
    descripcion: `Inicio: ${registro.accionConcreta}`,
  })
  return { registro, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, motivoSinXp: r.concedido ? undefined : r.motivo }
}

export async function cerrarInicio(id: number, resultado: SiguienteAccion['resultado']): Promise<void> {
  await db().siguienteAccion.update(id, { resultado, terminado: ahora() })
}

export async function iniciosRecientes(limite = 30): Promise<SiguienteAccion[]> {
  return db().siguienteAccion.orderBy('creado').reverse().limit(limite).toArray()
}

export async function iniciosEntre(desde: number, hasta: number): Promise<SiguienteAccion[]> {
  return db().siguienteAccion.where('creado').between(desde, hasta, true, true).toArray()
}
