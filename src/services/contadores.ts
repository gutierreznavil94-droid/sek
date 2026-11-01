/**
 * Contadores de series rápidas (flexiones al salir del taller, dominadas en
 * la escalera). Cada toque suma una cantidad fija; llegar a la meta diaria
 * da XP una sola vez por día. No son pilares: no tocan la racha.
 */

import { db } from '../data/db'
import { CONTADORES_INICIALES } from '../data/semilla'
import type { CambioCuota, Contador, RegistroContador } from '../data/tipos'
import { lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { claveXp } from '../domain/xp'
import { cuotaDelDia, extraPorDefecto, pasoDeSubida, subidasDeCuota } from '../domain/cuotas'
export { cuotaDelDia, extraPorDefecto, pasoDeSubida, subidasDeCuota }
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

export function validarContador(c: Pick<Contador, 'nombre' | 'cantidadPorToque' | 'metaDiaria' | 'xpMetaDiaria'> & { metaExtra?: number }): string[] {
  const e: string[] = []
  if (c.metaExtra !== undefined && !(c.metaExtra > c.metaDiaria)) e.push('El extra tiene que ser mayor que la cuota')
  if (!c.nombre.trim()) e.push('Ponele un nombre')
  if (!(c.cantidadPorToque > 0)) e.push('La cantidad por toque tiene que ser mayor que 0')
  if (!(c.metaDiaria > 0)) e.push('La meta diaria tiene que ser mayor que 0')
  if (c.xpMetaDiaria < 0) e.push('El XP no puede ser negativo')
  return e
}

const DESDE_SIEMPRE = '0000-01-01'

function vigenteActual(c: Pick<Contador, 'metaDiaria' | 'metaExtra' | 'cantidadPorToque'>, desde: FechaDia, motivo: CambioCuota['motivo']): CambioCuota {
  return { desde, cuota: c.metaDiaria, extra: c.metaExtra ?? extraPorDefecto(c.metaDiaria), porToque: c.cantidadPorToque, motivo }
}

export async function guardarContador(c: Omit<Contador, 'creado' | 'orden'> & { orden?: number }, motivo: CambioCuota['motivo'] = 'manual'): Promise<Contador> {
  const d = db()
  const errores = validarContador(c)
  if (errores.length) throw new Error(errores.join('. '))
  const hoy = await fechaHoy()
  const guardado = await d.transaction('rw', [d.contadores, d.eventos], async () => {
    const antes = await d.contadores.get(c.id)
    const orden = c.orden ?? antes?.orden ?? (await d.contadores.count()) + 1
    const despues: Contador = { ...c, nombre: c.nombre.trim(), orden, creado: antes?.creado ?? ahora() }
    if (despues.metaExtra === undefined) despues.metaExtra = extraPorDefecto(despues.metaDiaria)
    // Si cambió la cuota, el extra o el toque, queda anotado desde hoy; los días pasados conservan lo que tenían.
    const previo = antes ? vigenteActual(antes, DESDE_SIEMPRE, 'inicio') : null
    const nuevo = vigenteActual(despues, hoy, motivo)
    let historial = antes?.historialCuota?.length ? [...antes.historialCuota] : previo ? [previo] : [{ ...nuevo, desde: DESDE_SIEMPRE, motivo: 'inicio' as const }]
    if (previo && (previo.cuota !== nuevo.cuota || previo.extra !== nuevo.extra || previo.porToque !== nuevo.porToque)) {
      historial = historial.filter((x) => x.desde < hoy)
      historial.push(nuevo)
      if (previo.cuota !== nuevo.cuota) despues.proximaPropuesta = sumarDias(hoy, 3)
    }
    despues.historialCuota = historial
    await d.contadores.put(despues)
    await registrarEvento({ tipo: antes ? 'editar' : 'crear', entidad: 'contador', entidadId: c.id, antes, despues })
    return despues
  })
  // El XP de hoy se recalcula con la cuota nueva
  await ajustarXpMeta(guardado, hoy)
  return guardado
}

export type PropuestaSubida = { contadorId: string; nombre: string; de: number; a: number; extra: number }

/**
 * Si cumplió la cuota los últimos 3 días (ayer, anteayer y el anterior), propone subirla.
 * Nunca sube sola. Después de responder (sí o todavía no), no vuelve a proponer hasta 3 días después.
 */
export async function propuestaDeSubida(c: Contador, hoy: FechaDia): Promise<PropuestaSubida | null> {
  if (!c.activo) return null
  if (c.proximaPropuesta && hoy < c.proximaPropuesta) return null
  const ciclo = await cicloActivo()
  if (!ciclo || sumarDias(hoy, -3) < ciclo.inicio) return null
  const totales = await totalesPorDia(c.id, sumarDias(hoy, -3), sumarDias(hoy, -1))
  for (let i = 1; i <= 3; i++) {
    const f = sumarDias(hoy, -i)
    if ((totales.get(f) ?? 0) < cuotaDelDia(c, f).cuota) return null
  }
  const a = c.metaDiaria + pasoDeSubida(c)
  return { contadorId: c.id, nombre: c.nombre, de: c.metaDiaria, a, extra: extraPorDefecto(a) }
}

export async function propuestasDeSubida(hoy: FechaDia): Promise<PropuestaSubida[]> {
  const r: PropuestaSubida[] = []
  for (const c of await listarContadores()) {
    const p = await propuestaDeSubida(c, hoy)
    if (p) r.push(p)
  }
  return r
}

/** «Sí»: sube la cuota desde hoy y recalcula el extra. «Todavía no»: vuelve a proponer en 3 días. */
export async function responderPropuesta(contadorId: string, acepta: boolean): Promise<Contador> {
  const d = db()
  const c = await d.contadores.get(contadorId)
  if (!c) throw new Error(`Contador ${contadorId} no existe`)
  const hoy = await fechaHoy()
  if (acepta) {
    const a = c.metaDiaria + pasoDeSubida(c)
    const { creado: _c, ...resto } = c
    void _c
    return guardarContador({ ...resto, metaDiaria: a, metaExtra: extraPorDefecto(a) }, 'sugerida')
  }
  const despues = { ...c, proximaPropuesta: sumarDias(hoy, 3) }
  await d.contadores.put(despues)
  await registrarEvento({ tipo: 'editar', entidad: 'contador', entidadId: c.id, antes: c, despues, motivo: 'Todavía no subir la cuota' })
  return despues
}

export function nuevoIdContador(): string {
  return nuevoId('cont')
}

export async function totalDelDia(contadorId: string, fecha: FechaDia): Promise<number> {
  const regs = await db().registrosContador.where('[contadorId+fecha]').equals([contadorId, fecha]).toArray()
  return regs.reduce((s, r) => s + r.cantidad, 0)
}

type ResultadoXp = { xp: number; nuevoNivel: number | null; metaLograda: boolean; extraLogrado: boolean; xpExtra: number }

/** Concede o anula el XP de la cuota y del extra según el total del día. Idempotente: cada tope da XP una sola vez por día. */
async function ajustarXpMeta(c: Contador, fecha: FechaDia): Promise<ResultadoXp> {
  const total = await totalDelDia(c.id, fecha)
  const { cuota, extra } = cuotaDelDia(c, fecha)
  const r: ResultadoXp = { xp: 0, nuevoNivel: null, metaLograda: total >= cuota, extraLogrado: total >= extra, xpExtra: 0 }
  const tope = async (clave: string, logrado: boolean, cantidad: number, descripcion: string) => {
    if (logrado) {
      if (cantidad <= 0) return 0
      const x = await concederXp({ clave, cantidad, origen: 'contador', fecha, descripcion })
      if (x.nuevoNivel) r.nuevoNivel = x.nuevoNivel
      return x.concedido ? x.cantidad : 0
    }
    await anularXp(clave, 'Total del día por debajo del tope')
    return 0
  }
  r.xp += await tope(claveXp('contador', [c.id, fecha]), r.metaLograda, c.xpMetaDiaria, `${c.nombre}: cuota diaria (${cuota})`)
  r.xpExtra = await tope(claveXp('contador', [c.id, fecha, 'extra']), r.extraLogrado, c.xpExtra ?? 10, `${c.nombre}: extra (${extra})`)
  r.xp += r.xpExtra
  return r
}

export type ResultadoToque = { registro: RegistroContador; total: number } & ResultadoXp

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
  diasConExtra: number
  metaLogradaHoy: boolean
  extraLogradoHoy: boolean
  cuotaHoy: number
  extraHoy: number
  subidas: { desde: FechaDia; cuota: number }[]
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
    let diasConExtra = 0
    for (const [f, t] of totales) {
      total += t
      if (f >= lunes) semana += t
      const q = cuotaDelDia(c, f)
      if (t >= q.cuota) diasConMeta++
      if (t >= q.extra) diasConExtra++
      if (!record || t > record.total) record = { fecha: f, total: t }
    }
    const porDia = Array.from({ length: 14 }, (_, i) => {
      const f = sumarDias(hoy, i - 13)
      return { fecha: f, total: totales.get(f) ?? 0 }
    })
    const deHoy = totales.get(hoy) ?? 0
    const q = cuotaDelDia(c, hoy)
    resultado.push({ contador: c, hoy: deHoy, toquesHoy: regsHoy, semana, ciclo: total, record, diasConMeta, diasConExtra, metaLogradaHoy: deHoy >= q.cuota, extraLogradoHoy: deHoy >= q.extra, cuotaHoy: q.cuota, extraHoy: q.extra, subidas: subidasDeCuota(c), porDia })
  }
  return resultado
}
