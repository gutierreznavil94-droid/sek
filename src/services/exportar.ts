/**
 * Copia de seguridad: exportar e importar todo en JSON, y CSV de registros.
 * Como los datos viven solo en el teléfono, esto es la única copia.
 */

import { db, TABLAS, TABLA_FOTOS } from '../data/db'
import { guardarAjustes, registrarEvento } from './base'
import { ahora } from './reloj'

export const VERSION_EXPORTACION = 1

export type Exportacion = {
  app: 'sistema-progreso'
  version: number
  exportado: number
  tablas: Record<string, unknown[]>
}

/** `incluirFotos`: las fotos de progreso pueden pesar mucho; van solo si se pide. */
export async function exportarTodo(opciones: { incluirFotos?: boolean } = {}): Promise<Exportacion> {
  const d = db()
  const tablas: Record<string, unknown[]> = {}
  for (const nombre of TABLAS) tablas[nombre] = await d.table(nombre).toArray()
  if (opciones.incluirFotos) tablas[TABLA_FOTOS] = await d.table(TABLA_FOTOS).toArray()
  const salida: Exportacion = { app: 'sistema-progreso', version: VERSION_EXPORTACION, exportado: ahora(), tablas }
  await guardarAjustes({ ultimaExportacion: ahora() }, 'Exportación')
  await d.transaction('rw', [d.eventos], async () => {
    await registrarEvento({ tipo: 'exportar', entidad: 'todo', entidadId: String(salida.exportado) })
  })
  return salida
}

export function validarExportacion(x: unknown): x is Exportacion {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return o.app === 'sistema-progreso' && typeof o.version === 'number' && typeof o.tablas === 'object' && o.tablas !== null
}

/**
 * Importa reemplazando todo. Quien llama debe haber pedido confirmación.
 * Es una transacción: si algo falla, no queda a medias.
 */
export async function importarTodo(datos: Exportacion): Promise<{ filas: number }> {
  if (!validarExportacion(datos)) throw new Error('El archivo no es una copia de esta app.')
  if (datos.version > VERSION_EXPORTACION) throw new Error('La copia es de una versión más nueva de la app.')
  const d = db()
  let filas = 0
  await d.transaction('rw', d.tables, async () => {
    for (const nombre of TABLAS) {
      const t = d.table(nombre)
      await t.clear()
      const lista = datos.tablas[nombre]
      if (Array.isArray(lista) && lista.length) {
        await t.bulkAdd(lista)
        filas += lista.length
      }
    }
    // Las fotos solo se reemplazan si la copia las trae; si no, quedan las del celu.
    const fotos = datos.tablas[TABLA_FOTOS]
    if (Array.isArray(fotos)) {
      await d.table(TABLA_FOTOS).clear()
      if (fotos.length) { await d.table(TABLA_FOTOS).bulkAdd(fotos); filas += fotos.length }
    }
    await registrarEvento({ tipo: 'importar', entidad: 'todo', entidadId: String(datos.exportado), motivo: `${filas} filas` })
  })
  return { filas }
}

function csvCelda(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function aCsv(filas: Record<string, unknown>[], columnas?: string[]): string {
  if (!filas.length) return ''
  const cols = columnas ?? [...new Set(filas.flatMap((f) => Object.keys(f)))]
  const lineas = [cols.join(',')]
  for (const f of filas) lineas.push(cols.map((c) => csvCelda(f[c])).join(','))
  return lineas.join('\n')
}

export async function exportarCsv(): Promise<Record<string, string>> {
  const d = db()
  return {
    'compromisos.csv': aCsv(await d.compromisos.toArray()),
    'xp.csv': aCsv(await d.xp.toArray()),
    'juego.csv': aCsv((await d.sesionesJuego.toArray()).map((s) => ({ ...s, pausas: JSON.stringify(s.pausas) }))),
    'suenio.csv': aCsv(await d.suenio.toArray()),
    'dias.csv': aCsv(await d.diasCerrados.toArray()),
    'atributos_diarios.csv': aCsv(await d.atributosDiarios.toArray()),
  }
}

export async function borrarTodo(): Promise<void> {
  const d = db()
  await d.transaction('rw', d.tables, async () => {
    for (const nombre of TABLAS) await d.table(nombre).clear()
    await d.table(TABLA_FOTOS).clear()
  })
}
