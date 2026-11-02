/**
 * «Mi código» (掟, okite): reglas, costumbres y principios de Navil.
 * Solo se leen: no se marcan por día ni dan XP.
 */

import { db } from '../data/db'
import { CODIGO_INICIAL } from '../data/semilla'
import type { GrupoCodigo, ReglaCodigo } from '../data/tipos'
import { guardarAjustes, obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

export const GRUPOS_CODIGO: { id: GrupoCodigo; nombre: string; kanji: string }[] = [
  { id: 'cuerpo', nombre: 'Cuerpo', kanji: '体' },
  { id: 'mente', nombre: 'Mente', kanji: '心' },
  { id: 'comida', nombre: 'Comida', kanji: '食' },
  { id: 'cuidado', nombre: 'Cuidado', kanji: '養' },
]

/** Carga los ejemplos una sola vez (si después se borran, no vuelven). */
export async function sembrarCodigo(): Promise<void> {
  const d = db()
  const a = await obtenerAjustes()
  if (a.codigoSembrado) return
  if ((await d.codigo.count()) === 0) {
    const t = ahora()
    await d.codigo.bulkPut(CODIGO_INICIAL.map((r, i) => ({ id: `cod_${i + 1}`, texto: r.texto, grupo: r.grupo, orden: i + 1, creado: t })))
  }
  await guardarAjustes({ codigoSembrado: true }, 'Mi código: ejemplos cargados')
}

export async function listarCodigo(): Promise<ReglaCodigo[]> {
  return db().codigo.orderBy('orden').toArray()
}

export async function agregarRegla(texto: string, grupo: GrupoCodigo): Promise<ReglaCodigo> {
  const limpio = texto.trim()
  if (!limpio) throw new Error('Escribí la regla')
  const d = db()
  const ultimo = await d.codigo.orderBy('orden').last()
  const regla: ReglaCodigo = { id: nuevoId('cod'), texto: limpio, grupo, orden: (ultimo?.orden ?? 0) + 1, creado: ahora() }
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.add(regla)
    await registrarEvento({ tipo: 'crear', entidad: 'codigo', entidadId: regla.id, despues: regla })
  })
  return regla
}

export async function editarRegla(id: string, cambios: { texto?: string; grupo?: GrupoCodigo }): Promise<ReglaCodigo> {
  const d = db()
  const antes = await d.codigo.get(id)
  if (!antes) throw new Error('La regla no existe')
  const despues = { ...antes, ...cambios, texto: (cambios.texto ?? antes.texto).trim() }
  if (!despues.texto) throw new Error('Escribí la regla')
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.put(despues)
    await registrarEvento({ tipo: 'editar', entidad: 'codigo', entidadId: id, antes, despues })
  })
  return despues
}

export async function borrarRegla(id: string): Promise<void> {
  const d = db()
  const antes = await d.codigo.get(id)
  if (!antes) return
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.delete(id)
    await registrarEvento({ tipo: 'borrar', entidad: 'codigo', entidadId: id, antes })
  })
}

/** Sube (-1) o baja (+1) una regla dentro de su grupo. */
export async function moverRegla(id: string, dir: -1 | 1): Promise<void> {
  const d = db()
  const todas = await listarCodigo()
  const r = todas.find((x) => x.id === id)
  if (!r) return
  const grupo = todas.filter((x) => x.grupo === r.grupo)
  const i = grupo.findIndex((x) => x.id === id)
  const otra = grupo[i + dir]
  if (!otra) return
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.put({ ...r, orden: otra.orden })
    await d.codigo.put({ ...otra, orden: r.orden })
    await registrarEvento({ tipo: 'editar', entidad: 'codigo', entidadId: id, motivo: dir < 0 ? 'Subir' : 'Bajar' })
  })
}
