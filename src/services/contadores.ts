/**
 * Contadores de series rápidas (flexiones al salir del taller, dominadas en
 * la escalera). Cada toque suma una cantidad fija; llegar a la meta diaria
 * da XP una sola vez por día. No son pilares: no tocan la racha.
 */

import { db } from '../data/db'
import { CONTADORES_INICIALES } from '../data/semilla'
import type { Contador, RegistroContador } from '../data/tipos'
import { lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { claveXp } from '../domain/xp'
import { fechaHoy, registrarEvento } from './base'
import { cicloActivo } from './ciclo'
import { ahora, nuevoId } from './reloj'
import { anularXp, concederXp } from './xp'

export async function cargarContadoresIniciales(): Promise<void> {
  const d = db()
  if ((await d.contadores.count()) > 0) return
  const t = ahora()
  await d.contadores.bulkPut(CONTADORES_INICIALES.map((c) => ({ ...c, creado: t })))
}

export async function listarContadores(incluirInactivos = false): Promise<Contador[]> {
  const todos = await db().contadores.orderBy('orden').toArray()
  return incluirInactivos ? todos : todos.filter((c) => c.activo)
}

export function validarContador(c: Pick<Contador, 'nombre' | 'cantidadPorToque' | 'metaDiaria' | 'xpMetaDiaria'>): string[] {
  const e: string[] = []
  if (!c.nombre.trim()) e.push('Ponele un nombre')
  if (!(c.cantidadPorToque > 0)) e.push('La cantidad por toque tiene que ser mayor que 0')
  if (!(c.metaDiaria > 0)) e.push('La meta diaria tiene que ser mayor que 0')
  if (c.xpMetaDiaria < 0) e.push('El XP no puede ser negativo')
  return e
}

export async function guardarContador(c: Omit<Contador, 'creado' | 'orden'> & { orden?: number }): Promise<Contador> {
  const d = db()
  const errores = validarContador(c)
  if (errores.length) throw new Error(errores.join('. '))
  return d.transaction('rw', [d.contadores, d.eventos], async () => {
    const antes = await d.contadores.get(c.id)
    const orden = c.orden ?? antes?.orden ?? (await d.contadores.count()) + 1
    const despues: Contador = { ...c, nombre: c.nombre.trim(), orden, creado: antes?.creado ?? ahora() }
    await d.contadores.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'contador', entidadId: c.id, antes, despues })
    return despues
  })
}

export function nuevoIdContador(): string {
  return nuevoId('cont')
}

export async function totalDelDia(contadorId: string, fecha: FechaDia): Promise<number> {
  const regs = await db().registrosContador.where('[contadorId+fecha]').equals([contadorId, fecha]).toArray()
  return regs.reduce((s, r) => s + r.cantidad, 0)
}

/** Concede o anula el XP de la meta diaria según el total del día. Idempotente. */
async function ajustarXpMeta(c: Contador, fecha: FechaDia): Promise<{ xp: number; nuevoNivel: number | null; metaLograda: boolean }> {
  const total = await totalDelDia(c.id, fecha)
  const clave = claveXp('contador', [c.id, fecha])
  if (total >= c.metaDiaria) {
    if (c.xpMetaDiaria <= 0) return { xp: 0, nuevoNivel: null, metaLograda: true }
    const r = await concederXp({ clave, cantidad: c.xpMetaDiaria, origen: 'contador', fecha, descripcion: `${c.nombre}: meta diaria (${c.metaDiaria})` })
    return { xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, metaLograda: true }
  }
  await anularXp(clave, 'Total del día por debajo de la meta')
  return { xp: 0, nuevoNivel: null, metaLograda: false }
}

export type ResultadoToque = { registro: RegistroContador; total: number; xp: number; nuevoNivel: number | null; metaLograda: boolean }

/** Un toque: suma la cantidad configurada (o una cantidad a mano) al día de hoy. */
export async function sumarToque(contadorId: string, cantidad?: number, nota?: string): Promise<ResultadoToque> {
  const d = db()
  const c = await d.contadores.get(contadorId)
  if (!c) throw new Error(`Contador ${contadorId} no existe`)
  const ciclo = await cicloActivo()
  const fecha = await fechaHoy()
  if (!ciclo || fecha < ciclo.inicio) throw new Error('El ciclo todavía no empezó: no se registra nada antes del Día 1')
  const n = cantidad ?? c.cantidadPorToque
  if (!(n > 0)) throw new Error('La cantidad tiene que ser mayor que 0')
  const registro: RegistroContador = { contadorId, fecha, instante: ahora(), cantidad: n, nota }
  await d.transaction('rw', [d.registrosContador, d.eventos], async () => {
    registro.id = (await d.registrosContador.add(registro)) as number
    await registrarEvento({ tipo: 'crear', entidad: 'registroContador', entidadId: String(registro.id), despues: registro })
  })
  const r = await ajustarXpMeta(c, fecha)
  return { registro, total: await totalDelDia(contadorId, fecha), ...r }
}

/** Deshace el último toque de hoy. Si el total baja de la meta, el XP se anula. */
export async function deshacerUltimoToque(contadorId: string): Promise<number> {
  const d = db()
  const c = await d.contadores.get(contadorId)
  if (!c) throw new Error(`Contador ${contadorId} no existe`)
  const fecha = await fechaHoy()
  const regs = await d.registrosContador.where('[contadorId+fecha]').equals([contadorId, fecha]).toArray()
  const ultimo = regs.sort((a, b) => b.instante - a.instante)[0]
  if (!ultimo) return 0
  await d.transaction('rw', [d.registrosContador, d.eventos], async () => {
    await d.registrosContador.delete(ultimo.id!)
    await registrarEvento({ tipo: 'borrar', entidad: 'registroContador', entidadId: String(ultimo.id), antes: ultimo, motivo: 'Deshacer último toque' })
  })
  await ajustarXpMeta(c, fecha)
  return totalDelDia(contadorId, fecha)
}

export async function borrarRegistroContador(id: number, motivo = 'Borrado a mano'): Promise<void> {
  const d = db()
  const antes = await d.registrosContador.get(id)
  if (!antes) return
  const c = await d.contadores.get(antes.contadorId)
  await d.transaction('rw', [d.registrosContador, d.eventos], async () => {
    await d.registrosContador.delete(id)
    await registrarEvento({ tipo: 'borrar', entidad: 'registroContador', entidadId: String(id), antes, motivo })
  })
  if (c) await ajustarXpMeta(c, antes.fecha)
}

/** Total por día de un contador en un rango (días sin registros no aparecen). */
export async function totalesPorDia(contadorId: string, desde: FechaDia, hasta: FechaDia): Promise<Map<FechaDia, number>> {
  const regs = await db().registrosContador.where('[contadorId+fecha]').between([contadorId, desde], [contadorId, hasta], true, true).toArray()
  const m = new Map<FechaDia, number>()
  for (const r of regs) m.set(r.fecha, (m.get(r.fecha) ?? 0) + r.cantidad)
  return m
}

export type ResumenContador = {
  contador: Contador
  hoy: number
  toquesHoy: number
  semana: number
  ciclo: number
  record: { fecha: FechaDia; total: number } | null
  diasConMeta: number
  metaLogradaHoy: boolean
  /** Últimos 14 días, de más viejo a hoy. */
  porDia: { fecha: FechaDia; total: number }[]
}

export async function resumenContadores(hoy: FechaDia): Promise<ResumenContador[]> {
  const d = db()
  const contadores = await listarContadores()
  const ciclo = await cicloActivo()
  const desdeCiclo = ciclo ? ciclo.inicio : sumarDias(hoy, -90)
  const lunes = lunesDe(hoy)
  const resultado: ResumenContador[] = []
  for (const c of contadores) {
    const totales = await totalesPorDia(c.id, desdeCiclo < sumarDias(hoy, -400) ? sumarDias(hoy, -400) : desdeCiclo, hoy)
    const regsHoy = await d.registrosContador.where('[contadorId+fecha]').equals([c.id, hoy]).count()
    let semana = 0
    let total = 0
    let record: ResumenContador['record'] = null
    let diasConMeta = 0
    for (const [f, t] of totales) {
      total += t
      if (f >= lunes) semana += t
      if (t >= c.metaDiaria) diasConMeta++
      if (!record || t > record.total) record = { fecha: f, total: t }
    }
    const porDia = Array.from({ length: 14 }, (_, i) => {
      const f = sumarDias(hoy, i - 13)
      return { fecha: f, total: totales.get(f) ?? 0 }
    })
    const deHoy = totales.get(hoy) ?? 0
    resultado.push({ contador: c, hoy: deHoy, toquesHoy: regsHoy, semana, ciclo: total, record, diasConMeta, metaLogradaHoy: deHoy >= c.metaDiaria, porDia })
  }
  return resultado
}
