/**
 * Acciones, reglas de XP y atributos: la configuración editable.
 * Cambiar una regla solo afecta al futuro (nueva regla con `validaDesde`).
 */

import { db } from '../data/db'
import type { Accion, Atributo, ReglaXp } from '../data/tipos'
import { diaSemanaDe, esHoraValida, fechaDe, sumarDias, type FechaDia } from '../domain/fechas'
import { generarCompromisosDelDia } from './dia'
import { registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

export async function listarAcciones(): Promise<Accion[]> {
  return (await db().acciones.toArray()).sort((a, b) => a.orden - b.orden)
}

export function validarAccion(a: Partial<Accion>): string[] {
  const errores: string[] = []
  if (!a.nombre || a.nombre.trim().length < 2) errores.push('El nombre necesita al menos 2 letras.')
  if (a.hora && !esHoraValida(a.hora)) errores.push('La hora debe tener formato HH:MM.')
  if (!a.dias || a.dias.length === 0) errores.push('Elegí al menos un día de la semana.')
  if (!a.atributoIds || a.atributoIds.length === 0) errores.push('Vinculá la acción a al menos un atributo.')
  if (a.peso !== undefined && (a.peso <= 0 || a.peso > 5)) errores.push('El peso va de 1 a 5.')
  return errores
}

export async function guardarAccion(a: Omit<Accion, 'creado' | 'orden'> & { orden?: number }, xp?: number, hoy?: FechaDia): Promise<Accion> {
  const errores = validarAccion(a)
  if (errores.length) throw new Error(errores.join(' '))
  const d = db()
  return d.transaction('rw', [d.acciones, d.reglasXp, d.eventos], async () => {
    const antes = await d.acciones.get(a.id)
    const orden = a.orden ?? antes?.orden ?? (await d.acciones.count()) + 1
    const despues: Accion = { ...a, orden, creado: antes?.creado ?? ahora() }
    await d.acciones.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'accion', entidadId: a.id, antes, despues })
    if (xp !== undefined && hoy) await cambiarXpDeAccion(a.id, xp, hoy)
    return despues
  }).then(async (despues) => {
    await sincronizarCompromisosFuturos(despues)
    return despues
  })
}

/**
 * Tras editar días u horas: los compromisos pendientes desde hoy que ya no
 * tocan se quitan, los que faltan se crean, y la hora prevista se actualiza.
 * Los días pasados no se tocan.
 */
async function sincronizarCompromisosFuturos(a: Accion): Promise<void> {
  const d = db()
  const hoy = fechaDe(ahora())
  const hasta = sumarDias(hoy, 14)
  await d.transaction('rw', [d.compromisos], async () => {
    const existentes = await d.compromisos.where('[accionId+fecha]').between([a.id, hoy], [a.id, hasta], true, true).toArray()
    for (const c of existentes) {
      if (c.estado !== 'pendiente') continue
      const ds = diaSemanaDe(c.fecha)
      if (!a.activa || !a.dias.includes(ds)) await d.compromisos.delete(c.id)
      else await d.compromisos.update(c.id, { horaPrevista: a.horasPorDia?.[ds] ?? a.hora })
    }
  })
  if (a.activa) await generarCompromisosDelDia(hoy)
}

/** Crea una regla nueva vigente desde `desde`. El XP ya ganado no cambia. */
export async function cambiarXpDeAccion(accionId: string, xp: number, desde: FechaDia, maximo = 1, periodo: ReglaXp['periodo'] = 'dia'): Promise<ReglaXp> {
  const d = db()
  if (xp < 0 || !Number.isFinite(xp)) throw new Error('El XP debe ser 0 o más')
  return d.transaction('rw', [d.reglasXp, d.eventos], async () => {
    const vigente = await d.reglasXp.where('accionId').equals(accionId).and((r) => r.validaDesde === desde).first()
    if (vigente) {
      const despues = { ...vigente, xp, maximo, periodo }
      await d.reglasXp.put(despues)
      await registrarEvento({ tipo: 'editar', entidad: 'reglaXp', entidadId: vigente.id, antes: vigente, despues })
      return despues
    }
    const regla: ReglaXp = { id: nuevoId('regla'), accionId, xp: Math.floor(xp), maximo, periodo, validaDesde: desde, creado: ahora() }
    await d.reglasXp.add(regla)
    await registrarEvento({ tipo: 'crear', entidad: 'reglaXp', entidadId: regla.id, despues: regla })
    return regla
  })
}

export async function reglasDeAccion(accionId: string): Promise<ReglaXp[]> {
  return (await db().reglasXp.where('accionId').equals(accionId).toArray()).sort((a, b) => a.validaDesde.localeCompare(b.validaDesde))
}

export async function desactivarAccion(id: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.acciones, d.eventos], async () => {
    const antes = await d.acciones.get(id)
    if (!antes) return
    await d.acciones.update(id, { activa: false })
    await registrarEvento({ tipo: 'editar', entidad: 'accion', entidadId: id, antes, despues: { ...antes, activa: false }, motivo: 'Desactivada' })
  })
}

// ---------- Atributos ----------

export async function listarAtributos(): Promise<Atributo[]> {
  return (await db().atributos.filter((a) => !a.archivado).toArray()).sort((a, b) => a.orden - b.orden)
}

export async function guardarAtributo(a: Omit<Atributo, 'creado'>): Promise<Atributo> {
  if (!a.nombre || a.nombre.trim().length < 2) throw new Error('El nombre necesita al menos 2 letras.')
  if (a.ventanaDias < 3 || a.ventanaDias > 60) throw new Error('La ventana va de 3 a 60 días.')
  const d = db()
  return d.transaction('rw', [d.atributos, d.eventos], async () => {
    const antes = await d.atributos.get(a.id)
    const despues: Atributo = { ...a, creado: antes?.creado ?? ahora() }
    await d.atributos.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'atributo', entidadId: a.id, antes, despues })
    return despues
  })
}

export async function archivarAtributo(id: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.atributos, d.eventos], async () => {
    const antes = await d.atributos.get(id)
    if (!antes) return
    await d.atributos.update(id, { archivado: true })
    await registrarEvento({ tipo: 'borrar', entidad: 'atributo', entidadId: id, antes })
  })
}
