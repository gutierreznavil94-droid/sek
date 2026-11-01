/**
 * Conceder y anular XP. Una sola puerta de entrada para todo el XP de la app.
 */

import { db } from '../data/db'
import type { RegistroXp, ReglaXp } from '../data/tipos'
import { nivelDesdeXp } from '../domain/niveles'
import { reglaVigente, totalXp, type OrigenXp } from '../domain/xp'
import { obtenerAjustes, registrarEvento } from './base'
import { ahora } from './reloj'

export type ResultadoXp = {
  concedido: boolean
  cantidad: number
  /** Nivel alcanzado si subió, o null. */
  nuevoNivel: number | null
  motivo?: string
}

/**
 * Concede XP con una clave única. Si la clave ya existe (y no está anulada),
 * no concede nada: el mismo evento nunca suma dos veces.
 * Si existía anulada, se reactiva: la corrección de una corrección.
 */
export async function concederXp(params: {
  clave: string
  cantidad: number
  origen: OrigenXp
  fecha: string
  descripcion: string
  reglaId?: string
}): Promise<ResultadoXp> {
  const d = db()
  if (params.cantidad <= 0) return { concedido: false, cantidad: 0, nuevoNivel: null, motivo: 'La regla da 0 XP' }
  return d.transaction('rw', [d.xp, d.niveles, d.eventos, d.ajustes], async () => {
    const existente = await d.xp.where('clave').equals(params.clave).first()
    if (existente && !existente.anulado) {
      return { concedido: false, cantidad: 0, nuevoNivel: null, motivo: 'Ya se había concedido' }
    }
    const ajustes = await obtenerAjustes()
    const antesTotal = totalXp(await d.xp.toArray())
    const nivelAntes = nivelDesdeXp(antesTotal, ajustes.baseNivel)
    const registro: RegistroXp = {
      clave: params.clave,
      cantidad: Math.floor(params.cantidad),
      origen: params.origen,
      fecha: params.fecha,
      creado: ahora(),
      descripcion: params.descripcion,
      reglaId: params.reglaId,
    }
    if (existente) {
      // Reactivar: mantiene el id y quita la anulación.
      await d.xp.update(existente.id!, { anulado: false, anuladoEn: undefined, motivoAnulacion: undefined, cantidad: registro.cantidad, creado: registro.creado })
      await registrarEvento({ tipo: 'corregir', entidad: 'xp', entidadId: params.clave, antes: existente, despues: { ...existente, anulado: false } })
    } else {
      await d.xp.add(registro)
    }
    const total = antesTotal + registro.cantidad
    const nivelDespues = nivelDesdeXp(total, ajustes.baseNivel)
    let nuevoNivel: number | null = null
    if (nivelDespues > nivelAntes) {
      for (let n = nivelAntes + 1; n <= nivelDespues; n++) {
        await d.niveles.add({ nivel: n, alcanzado: ahora(), xpTotal: total })
        await registrarEvento({ tipo: 'subir_nivel', entidad: 'nivel', entidadId: String(n), despues: { nivel: n, xpTotal: total } })
      }
      nuevoNivel = nivelDespues
    }
    return { concedido: true, cantidad: registro.cantidad, nuevoNivel }
  })
}

/** Anula un XP concedido por error. Queda en el historial; el total nunca es negativo. */
export async function anularXp(clave: string, motivo: string): Promise<boolean> {
  const d = db()
  return d.transaction('rw', [d.xp, d.eventos], async () => {
    const r = await d.xp.where('clave').equals(clave).first()
    if (!r || r.anulado) return false
    await d.xp.update(r.id!, { anulado: true, anuladoEn: ahora(), motivoAnulacion: motivo })
    await registrarEvento({ tipo: 'anular_xp', entidad: 'xp', entidadId: clave, antes: r, motivo })
    return true
  })
}

export async function xpTotal(): Promise<number> {
  return totalXp(await db().xp.toArray())
}

export async function xpDelDia(fecha: string): Promise<RegistroXp[]> {
  return (await db().xp.where('fecha').equals(fecha).toArray()).filter((r) => !r.anulado)
}

/** Regla vigente para una acción en una fecha. */
export async function reglaDeAccion(accionId: string, fecha: string): Promise<ReglaXp | null> {
  const reglas = await db().reglasXp.where('accionId').equals(accionId).toArray()
  return reglaVigente(reglas, fecha)
}

/** XP ganado por día (sin anulados) en un rango, para el gráfico. */
export async function xpPorDia(desde: string, hasta: string): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  for (const r of await db().xp.where('fecha').between(desde, hasta, true, true).toArray()) {
    if (r.anulado) continue
    mapa.set(r.fecha, (mapa.get(r.fecha) ?? 0) + r.cantidad)
  }
  return mapa
}

/** XP total ganado antes de una fecha (sin anulados). */
export async function xpAntesDe(fecha: string): Promise<number> {
  let total = 0
  for (const r of await db().xp.where('fecha').below(fecha).toArray()) if (!r.anulado) total += r.cantidad
  return total
}
