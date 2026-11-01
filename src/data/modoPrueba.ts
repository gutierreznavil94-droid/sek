/**
 * Modo prueba: una base de datos aparte, con la configuración real copiada y
 * el Día 1 hoy, para ver la app funcionando antes de empezar el ciclo.
 * Nada de lo que pasa ahí toca la base real. Se borra al salir o al cerrar
 * la app (la marca vive en sessionStorage).
 */

import Dexie from 'dexie'
import { BaseDatos } from './db'

export const NOMBRE_BASE_REAL = 'sistema-progreso'
export const NOMBRE_BASE_PRUEBA = 'sistema-progreso-prueba'
const MARCA = 'modo-prueba'

/** Tablas de configuración que se copian a la prueba (sin registros ni XP). */
const TABLAS_CONFIG = ['identidad', 'atributos', 'acciones', 'reglasXp', 'ajustes', 'feriados', 'objetivos'] as const

export function enModoPrueba(): boolean {
  try {
    return sessionStorage.getItem(MARCA) === '1'
  } catch {
    return false
  }
}

export function nombreBaseActual(): string {
  return enModoPrueba() ? NOMBRE_BASE_PRUEBA : NOMBRE_BASE_REAL
}

/** Crea la base de prueba copiando la configuración de la real y recarga la app en modo prueba. */
export async function entrarModoPrueba(): Promise<void> {
  const real = new BaseDatos(NOMBRE_BASE_REAL)
  await Dexie.delete(NOMBRE_BASE_PRUEBA)
  const prueba = new BaseDatos(NOMBRE_BASE_PRUEBA)
  for (const t of TABLAS_CONFIG) {
    const filas = await real.table(t).toArray()
    // Los objetivos van atados al ciclo real: se copian sin ciclo y se reasignan al crear el de prueba.
    if (filas.length) await prueba.table(t).bulkPut(filas)
  }
  real.close()
  prueba.close()
  sessionStorage.setItem(MARCA, '1')
  window.location.reload()
}

export function salirModoPrueba(): void {
  try {
    sessionStorage.removeItem(MARCA)
  } catch {
    // nada
  }
  window.location.reload()
}

/** Al abrir la app fuera del modo prueba, borra cualquier resto de una prueba anterior. */
export async function limpiarRestosDePrueba(): Promise<void> {
  if (enModoPrueba()) return
  try {
    await Dexie.delete(NOMBRE_BASE_PRUEBA)
  } catch {
    // nada
  }
}
