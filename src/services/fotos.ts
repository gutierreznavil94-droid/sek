/**
 * Fotos de progreso (opcionales): se guardan con el día en que se cargan y no se puede cambiar la fecha.
 * Quedan solo en el celu; en la copia de seguridad van si se pide «incluir fotos».
 */
import { db } from '../data/db'
import type { FotoProgreso, MarcaDia } from '../data/tipos'
import { diaDelCiclo, type FechaDia } from '../domain/fechas'
import { registrarEvento } from './base'
import { cicloActivo } from './ciclo'
import { ahora, nuevoId } from './reloj'

export async function listarFotos(): Promise<FotoProgreso[]> {
  return (await db().fotos.toArray()).sort((a, b) => a.creada - b.creada)
}

/** Guarda la foto (ya achicada) con el día de hoy. */
export async function agregarFoto(imagen: string, hoy: FechaDia): Promise<FotoProgreso> {
  if (!imagen.startsWith('data:image/')) throw new Error('Eso no es una imagen.')
  const ciclo = await cicloActivo()
  const foto: FotoProgreso = { id: nuevoId('foto'), fecha: hoy, dia: ciclo ? Math.max(1, diaDelCiclo(ciclo.inicio, hoy)) : 0, imagen, creada: ahora() }
  await db().transaction('rw', [db().fotos, db().eventos], async () => {
    await db().fotos.add(foto)
    await registrarEvento({ tipo: 'crear', entidad: 'foto', entidadId: foto.id, motivo: `Foto del ${hoy}` })
  })
  return foto
}

export async function borrarFoto(id: string): Promise<void> {
  await db().transaction('rw', [db().fotos, db().eventos], async () => {
    await db().fotos.delete(id)
    await registrarEvento({ tipo: 'borrar', entidad: 'foto', entidadId: id })
  })
}

// ---------- Días marcados (印) ----------

export async function listarMarcas(): Promise<MarcaDia[]> {
  return (await db().marcas.toArray()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Marca (o cambia el texto de) un día. */
export async function marcarDia(fecha: FechaDia, texto: string): Promise<MarcaDia> {
  const t = texto.trim().slice(0, 80)
  if (!t) throw new Error('Escribí qué pasó ese día.')
  return db().transaction('rw', [db().marcas, db().eventos], async () => {
    const antes = await db().marcas.get(fecha)
    const m: MarcaDia = antes ? { ...antes, texto: t, editada: ahora() } : { fecha, texto: t, creada: ahora() }
    await db().marcas.put(m)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'marca', entidadId: fecha, antes, despues: m })
    return m
  })
}

export async function quitarMarca(fecha: FechaDia): Promise<void> {
  await db().transaction('rw', [db().marcas, db().eventos], async () => {
    const antes = await db().marcas.get(fecha)
    if (!antes) return
    await db().marcas.delete(fecha)
    await registrarEvento({ tipo: 'borrar', entidad: 'marca', entidadId: fecha, antes })
  })
}
