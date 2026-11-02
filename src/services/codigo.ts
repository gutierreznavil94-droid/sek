/**
 * «Mi código» (掟, okite): reglas, costumbres y principios de Navil.
 * Solo se leen: no se marcan por día ni dan XP. Cada regla tiene dos etiquetas
 * (momento y área) y se puede ver agrupada de las dos formas; el orden se guarda por vista.
 */

import { db } from '../data/db'
import { CODIGO_INICIAL } from '../data/semilla'
import type { GrupoCodigo, MomentoCodigo, ReglaCodigo } from '../data/tipos'
import { guardarAjustes, obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

export type VistaCodigo = 'momento' | 'area'

export const GRUPOS_CODIGO: { id: GrupoCodigo; nombre: string; kanji: string }[] = [
  { id: 'cuerpo', nombre: 'Cuerpo', kanji: '体' },
  { id: 'mente', nombre: 'Mente', kanji: '心' },
  { id: 'comida', nombre: 'Comida', kanji: '食' },
  { id: 'cuidado', nombre: 'Cuidado', kanji: '整' },
]

export const MOMENTOS_CODIGO: { id: MomentoCodigo; nombre: string; kanji: string }[] = [
  { id: 'manana', nombre: 'Mañana', kanji: '朝' },
  { id: 'tarde', nombre: 'Tarde', kanji: '昼' },
  { id: 'noche', nombre: 'Noche', kanji: '夜' },
  { id: 'siempre', nombre: 'Siempre', kanji: '常' },
]

export function momentoDe(r: Pick<ReglaCodigo, 'momento'>): MomentoCodigo {
  return r.momento ?? 'siempre'
}

export function ordenEn(r: ReglaCodigo, vista: VistaCodigo): number {
  return vista === 'area' ? r.orden : r.ordenMomento ?? r.orden
}

/** Reglas de un grupo (área o momento), en el orden de esa vista. */
export function reglasDelGrupo(reglas: ReglaCodigo[], vista: VistaCodigo, grupo: string): ReglaCodigo[] {
  return reglas.filter((r) => (vista === 'area' ? r.grupo : momentoDe(r)) === grupo).sort((a, b) => ordenEn(a, vista) - ordenEn(b, vista))
}

/** Carga los ejemplos una sola vez (si después se borran, no vuelven) y completa el momento de las reglas viejas. */
export async function sembrarCodigo(): Promise<void> {
  const d = db()
  const a = await obtenerAjustes()
  if (!a.codigoSembrado) {
    if ((await d.codigo.count()) === 0) {
      const t = ahora()
      await d.codigo.bulkPut(CODIGO_INICIAL.map((r, i) => ({ id: `cod_${i + 1}`, texto: r.texto, grupo: r.grupo, momento: r.momento, orden: i + 1, ordenMomento: i + 1, creado: t })))
    }
    await guardarAjustes({ codigoSembrado: true }, 'Mi código: ejemplos cargados')
  }
  // Reglas de antes de las dos vistas: los ejemplos toman su momento; las demás, «siempre».
  for (const r of await d.codigo.toArray()) {
    if (r.momento) continue
    const ejemplo = CODIGO_INICIAL.find((x) => x.texto === r.texto)
    await d.codigo.put({ ...r, momento: ejemplo?.momento ?? 'siempre', ordenMomento: r.ordenMomento ?? r.orden })
  }
}

export async function listarCodigo(): Promise<ReglaCodigo[]> {
  return db().codigo.orderBy('orden').toArray()
}

export async function agregarRegla(texto: string, grupo: GrupoCodigo, momento: MomentoCodigo = 'siempre'): Promise<ReglaCodigo> {
  const limpio = texto.trim()
  if (!limpio) throw new Error('Escribí la regla')
  const d = db()
  const todas = await d.codigo.toArray()
  const max = (f: (r: ReglaCodigo) => number) => todas.reduce((m, r) => Math.max(m, f(r)), 0)
  const regla: ReglaCodigo = { id: nuevoId('cod'), texto: limpio, grupo, momento, orden: max((r) => r.orden) + 1, ordenMomento: max((r) => r.ordenMomento ?? r.orden) + 1, creado: ahora() }
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.add(regla)
    await registrarEvento({ tipo: 'crear', entidad: 'codigo', entidadId: regla.id, despues: regla })
  })
  return regla
}

export async function editarRegla(id: string, cambios: { texto?: string; grupo?: GrupoCodigo; momento?: MomentoCodigo }): Promise<ReglaCodigo> {
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

/** Sube (-1) o baja (+1) una regla dentro de su grupo, en la vista indicada (el orden de la otra vista no cambia). */
export async function moverRegla(id: string, dir: -1 | 1, vista: VistaCodigo = 'area'): Promise<void> {
  const d = db()
  const todas = await listarCodigo()
  const r = todas.find((x) => x.id === id)
  if (!r) return
  const grupo = reglasDelGrupo(todas, vista, vista === 'area' ? r.grupo : momentoDe(r))
  const i = grupo.findIndex((x) => x.id === id)
  const otra = grupo[i + dir]
  if (!otra) return
  const campo = vista === 'area' ? 'orden' : 'ordenMomento'
  const a = ordenEn(r, vista)
  const b = ordenEn(otra, vista)
  await d.transaction('rw', [d.codigo, d.eventos], async () => {
    await d.codigo.put({ ...r, [campo]: b === a ? b + dir : b })
    await d.codigo.put({ ...otra, [campo]: a })
    await registrarEvento({ tipo: 'editar', entidad: 'codigo', entidadId: id, motivo: `${dir < 0 ? 'Subir' : 'Bajar'} (${vista === 'area' ? 'por área' : 'por momento'})` })
  })
}
