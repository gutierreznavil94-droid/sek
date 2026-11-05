/**
 * Fechas clave del calendario (印): notas como «Ingreso a la facultad» o un cumpleaños.
 * Solo viven en el calendario: no dan XP, no son metas y no tocan la racha.
 * Pueden repetirse cada año y valen también fuera de los 90 días.
 */

import { db } from '../data/db'
import type { FechaClave } from '../data/tipos'
import { registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

/** Mes-día de una fecha AAAA-MM-DD. */
const md = (f: string) => f.slice(5)

/** ¿La fecha clave cae en este día? (las anuales, cualquier año desde el suyo). */
export function caeEn(fc: FechaClave, fecha: string): boolean {
  if (!fc.anual) return fc.fecha === fecha
  return md(fc.fecha) === md(fecha) && fecha >= fc.fecha
}

/** Fechas clave por día entre dos fechas (inclusive). */
export async function fechasClavePorDia(desde: string, hasta: string): Promise<Map<string, FechaClave[]>> {
  const todas = await db().fechasClave.toArray()
  const mapa = new Map<string, FechaClave[]>()
  for (const fc of todas) {
    if (!fc.anual) {
      if (fc.fecha >= desde && fc.fecha <= hasta) mapa.set(fc.fecha, [...(mapa.get(fc.fecha) ?? []), fc])
      continue
    }
    for (let a = Number(desde.slice(0, 4)); a <= Number(hasta.slice(0, 4)); a++) {
      const f = `${a}-${md(fc.fecha)}`
      if (f >= desde && f <= hasta && caeEn(fc, f)) mapa.set(f, [...(mapa.get(f) ?? []), fc])
    }
  }
  for (const l of mapa.values()) l.sort((x, y) => x.creada - y.creada)
  return mapa
}

export async function agregarFechaClave(fecha: string, titulo: string, nota?: string, anual?: boolean, horas?: { hora?: string; horaFin?: string }): Promise<FechaClave> {
  const fc: FechaClave = { id: nuevoId('fc'), fecha, titulo: titulo.trim(), nota: nota?.trim() || undefined, anual: !!anual, hora: horas?.hora || undefined, horaFin: horas?.hora ? horas.horaFin || undefined : undefined, creada: ahora() }
  await db().fechasClave.add(fc)
  await registrarEvento({ tipo: 'crear', entidad: 'fechaClave', entidadId: fc.id, motivo: fc.titulo })
  return fc
}

export async function editarFechaClave(id: string, cambios: Partial<Pick<FechaClave, 'titulo' | 'nota' | 'anual' | 'hora' | 'horaFin'>>): Promise<void> {
  const c = { ...cambios }
  if (c.hora !== undefined && !c.hora) { c.hora = undefined; c.horaFin = undefined }
  if (c.horaFin !== undefined && !c.horaFin) c.horaFin = undefined
  if (c.titulo !== undefined) c.titulo = c.titulo.trim()
  if (c.nota !== undefined) c.nota = c.nota.trim() || undefined
  await db().fechasClave.update(id, c)
}

export async function borrarFechaClave(id: string): Promise<void> {
  await db().fechasClave.delete(id)
  await registrarEvento({ tipo: 'borrar', entidad: 'fechaClave', entidadId: id })
}
