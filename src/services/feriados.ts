/**
 * Feriados y límite de juego según el tipo de día: lunes a viernes un límite,
 * sábados, domingos y feriados otro. Los feriados vienen precargados y se
 * pueden marcar o quitar desde el Calendario.
 */

import { db } from '../data/db'
import { FERIADOS_INICIALES } from '../data/semilla'
import type { Feriado } from '../data/tipos'
import { diaSemanaDe, type FechaDia } from '../domain/fechas'
import { obtenerAjustes, registrarEvento } from './base'
import { ahora } from './reloj'

export async function cargarFeriadosIniciales(): Promise<void> {
  const d = db()
  if ((await d.feriados.count()) > 0) return
  await d.feriados.bulkPut(FERIADOS_INICIALES.map((f) => ({ ...f, creado: ahora() })))
}

export async function esFeriado(fecha: FechaDia): Promise<boolean> {
  return !!(await db().feriados.get(fecha))
}

export async function feriadosEntre(desde: FechaDia, hasta: FechaDia): Promise<Feriado[]> {
  return db().feriados.where('fecha').between(desde, hasta, true, true).toArray()
}

export async function marcarFeriado(fecha: FechaDia, nombre = 'Feriado'): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.feriados, d.eventos], async () => {
    const f: Feriado = { fecha, nombre, propio: true, creado: ahora() }
    await d.feriados.put(f)
    await registrarEvento({ tipo: 'crear', entidad: 'feriado', entidadId: fecha, despues: f })
  })
}

export async function quitarFeriado(fecha: FechaDia): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.feriados, d.eventos], async () => {
    const antes = await d.feriados.get(fecha)
    if (!antes) return
    await d.feriados.delete(fecha)
    await registrarEvento({ tipo: 'borrar', entidad: 'feriado', entidadId: fecha, antes })
  })
}

/** true los sábados, domingos y feriados. */
export async function esDiaDeFinde(fecha: FechaDia): Promise<boolean> {
  const ds = diaSemanaDe(fecha)
  if (ds === 0 || ds === 6) return true
  return esFeriado(fecha)
}

/** Límite de juego (minutos) que aplica a una fecha. */
export async function limiteJuegoDelDia(fecha: FechaDia): Promise<number> {
  const a = await obtenerAjustes()
  return (await esDiaDeFinde(fecha)) ? a.limiteJuegoFinde : a.limiteJuegoSemana
}
