/**
 * Ciclos de 90 días, fases y metas automáticas.
 */

import { db } from '../data/db'
import { FASES_INICIALES } from '../data/semilla'
import type { Ciclo, Fase, Meta, Objetivo } from '../data/tipos'
import { diaDelCiclo, domingoDe, faseDelDia, fechaDelDiaDelCiclo, sumarDias, type FechaDia } from '../domain/fechas'
import { registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

export async function cicloActivo(): Promise<Ciclo | undefined> {
  return db().ciclos.where('estado').equals('activo').first()
}

export async function todosLosCiclos(): Promise<Ciclo[]> {
  return db().ciclos.orderBy('numero').toArray()
}

/**
 * Crea un ciclo nuevo. Si había uno activo, lo cierra (el historial se
 * conserva; nivel y XP no se tocan). Crea las fases y las metas con fecha.
 */
export async function iniciarCiclo(inicio: FechaDia, opciones?: { duracionDias?: number; diasPorFase?: number }): Promise<Ciclo> {
  const d = db()
  const duracionDias = opciones?.duracionDias ?? 90
  const diasPorFase = opciones?.diasPorFase ?? 30
  return d.transaction('rw', [d.ciclos, d.fases, d.metas, d.eventos], async () => {
    const activo = await cicloActivo()
    if (activo) {
      await d.ciclos.update(activo.id, { estado: 'cerrado', cerrado: ahora() })
      await registrarEvento({ tipo: 'editar', entidad: 'ciclo', entidadId: activo.id, antes: activo, despues: { ...activo, estado: 'cerrado' }, motivo: 'Nuevo ciclo' })
    }
    const anteriores = await d.ciclos.count()
    const ciclo: Ciclo = {
      id: nuevoId('ciclo'),
      numero: anteriores + 1,
      inicio,
      duracionDias,
      diasPorFase,
      estado: 'activo',
      creado: ahora(),
    }
    await d.ciclos.add(ciclo)
    const nFases = Math.ceil(duracionDias / diasPorFase)
    for (let n = 1; n <= nFases; n++) {
      const base = FASES_INICIALES[n - 1] ?? { foco: `Fase ${n}`, queSeMide: '' }
      const fase: Fase = {
        id: nuevoId('fase'),
        cicloId: ciclo.id,
        numero: n,
        diaInicio: (n - 1) * diasPorFase + 1,
        diaFin: Math.min(n * diasPorFase, duracionDias),
        foco: base.foco,
        queSeMide: base.queSeMide,
      }
      await d.fases.add(fase)
      const fechaFin = fechaDelDiaDelCiclo(inicio, fase.diaFin)
      await d.metas.add(meta(fechaFin, n === nFases ? `Fin del ciclo ${ciclo.numero}` : `Fin de la fase ${n}`, n === nFases ? 'fin_ciclo' : 'fin_fase'))
    }
    await d.metas.add(meta(inicio, `Día 1 del ciclo ${ciclo.numero}`, 'inicio_ciclo'))
    // Revisión semanal cada domingo del ciclo.
    const fin = fechaDelDiaDelCiclo(inicio, duracionDias)
    let dom = domingoDe(inicio)
    while (dom <= fin) {
      if (dom >= inicio) await d.metas.add(meta(dom, 'Revisión semanal', 'revision_semanal'))
      dom = sumarDias(dom, 7)
    }
    await registrarEvento({ tipo: 'nuevo_ciclo', entidad: 'ciclo', entidadId: ciclo.id, despues: ciclo })
    return ciclo
  })
}

/**
 * Cambia la fecha de inicio del ciclo activo sin perder nada: mueve las
 * metas automáticas, borra los cierres de días anteriores a la nueva fecha y
 * deja constancia en el historial. El XP y los registros no se tocan.
 */
export async function cambiarInicioCiclo(nuevoInicio: FechaDia): Promise<Ciclo> {
  const d = db()
  return d.transaction('rw', [d.ciclos, d.fases, d.metas, d.diasCerrados, d.compromisos, d.eventos], async () => {
    const ciclo = await cicloActivo()
    if (!ciclo) throw new Error('No hay un ciclo activo')
    if (ciclo.inicio === nuevoInicio) return ciclo
    const despues = { ...ciclo, inicio: nuevoInicio }
    await d.ciclos.put(despues)
    // Metas automáticas: se regeneran; las propias se conservan.
    const automaticas = (await d.metas.toArray()).filter((m) => m.tipo !== 'propia')
    await d.metas.bulkDelete(automaticas.map((m) => m.id))
    const fases = await fasesDelCiclo(ciclo.id)
    for (const fase of fases) {
      const fechaFin = fechaDelDiaDelCiclo(nuevoInicio, fase.diaFin)
      const ultima = fase.numero === fases.length
      await d.metas.add(meta(fechaFin, ultima ? `Fin del ciclo ${ciclo.numero}` : `Fin de la fase ${fase.numero}`, ultima ? 'fin_ciclo' : 'fin_fase'))
    }
    await d.metas.add(meta(nuevoInicio, `Día 1 del ciclo ${ciclo.numero}`, 'inicio_ciclo'))
    const fin = fechaDelDiaDelCiclo(nuevoInicio, ciclo.duracionDias)
    let dom = domingoDe(nuevoInicio)
    while (dom <= fin) {
      if (dom >= nuevoInicio) await d.metas.add(meta(dom, 'Revisión semanal', 'revision_semanal'))
      dom = sumarDias(dom, 7)
    }
    // Días cerrados y compromisos sin resolver anteriores al nuevo inicio ya no forman parte del ciclo.
    if (nuevoInicio > ciclo.inicio) {
      await d.diasCerrados.where('fecha').below(nuevoInicio).delete()
      await d.compromisos.where('fecha').below(nuevoInicio).filter((c) => c.estado === 'pendiente' || c.estado === 'no_registrado').delete()
    }
    await registrarEvento({ tipo: 'editar', entidad: 'ciclo', entidadId: ciclo.id, antes: ciclo, despues, motivo: 'Cambio de fecha de inicio' })
    return despues
  })
}

function meta(fecha: FechaDia, titulo: string, tipo: Meta['tipo']): Meta {
  return { id: nuevoId('meta'), fecha, titulo, tipo, creado: ahora() }
}

export type EstadoCiclo = {
  ciclo: Ciclo
  dia: number
  fase: Fase | undefined
  faseNumero: number
  terminado: boolean
  noEmpezado: boolean
  fechaFin: FechaDia
}

export async function estadoDelCiclo(hoy: FechaDia): Promise<EstadoCiclo | null> {
  const ciclo = await cicloActivo()
  if (!ciclo) return null
  const dia = diaDelCiclo(ciclo.inicio, hoy)
  const faseNumero = faseDelDia(Math.min(Math.max(dia, 1), ciclo.duracionDias), ciclo.diasPorFase)
  const fase = await db().fases.where('[cicloId+numero]').equals([ciclo.id, faseNumero]).first()
  return {
    ciclo,
    dia,
    fase,
    faseNumero,
    terminado: dia > ciclo.duracionDias,
    noEmpezado: dia < 1,
    fechaFin: fechaDelDiaDelCiclo(ciclo.inicio, ciclo.duracionDias),
  }
}

export async function fasesDelCiclo(cicloId: string): Promise<Fase[]> {
  return (await db().fases.where('cicloId').equals(cicloId).toArray()).sort((a, b) => a.numero - b.numero)
}

export async function guardarFase(fase: Fase): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.fases, d.eventos], async () => {
    const antes = await d.fases.get(fase.id)
    await d.fases.put(fase)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'fase', entidadId: fase.id, antes, despues: fase })
  })
}

export async function cerrarFase(faseId: string, notasCierre: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.fases, d.eventos], async () => {
    const antes = await d.fases.get(faseId)
    if (!antes) return
    const despues = { ...antes, notasCierre, cerradaEn: ahora() }
    await d.fases.put(despues)
    await registrarEvento({ tipo: 'cerrar_fase', entidad: 'fase', entidadId: faseId, antes, despues })
  })
}

// ---------- Objetivos ----------

export async function objetivosDelCiclo(cicloId: string): Promise<Objetivo[]> {
  return (await db().objetivos.where('cicloId').equals(cicloId).toArray()).filter((o) => !o.archivado)
}

export async function guardarObjetivo(o: Omit<Objetivo, 'id' | 'creado'> & { id?: string }): Promise<Objetivo> {
  const d = db()
  return d.transaction('rw', [d.objetivos, d.eventos], async () => {
    const antes = o.id ? await d.objetivos.get(o.id) : undefined
    const despues: Objetivo = { ...o, id: o.id ?? nuevoId('obj'), creado: antes?.creado ?? ahora() }
    await d.objetivos.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'objetivo', entidadId: despues.id, antes, despues })
    return despues
  })
}

export async function archivarObjetivo(id: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.objetivos, d.eventos], async () => {
    const antes = await d.objetivos.get(id)
    if (!antes) return
    await d.objetivos.update(id, { archivado: true })
    await registrarEvento({ tipo: 'borrar', entidad: 'objetivo', entidadId: id, antes })
  })
}

// ---------- Metas ----------

export async function metasEntre(desde: FechaDia, hasta: FechaDia): Promise<Meta[]> {
  return db().metas.where('fecha').between(desde, hasta, true, true).toArray()
}

export async function guardarMeta(m: Omit<Meta, 'id' | 'creado'> & { id?: string }): Promise<Meta> {
  const d = db()
  return d.transaction('rw', [d.metas, d.eventos], async () => {
    const antes = m.id ? await d.metas.get(m.id) : undefined
    const despues: Meta = { ...m, id: m.id ?? nuevoId('meta'), creado: antes?.creado ?? ahora() }
    await d.metas.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'meta', entidadId: despues.id, antes, despues })
    return despues
  })
}

export async function borrarMeta(id: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.metas, d.eventos], async () => {
    const antes = await d.metas.get(id)
    if (!antes) return
    await d.metas.delete(id)
    await registrarEvento({ tipo: 'borrar', entidad: 'meta', entidadId: id, antes })
  })
}
