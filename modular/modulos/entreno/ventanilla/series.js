'use strict'
/**
 * Entreno · series rápidas (contadores): flexiones al salir del taller, dominadas en la escalera.
 * Cada toque suma una cantidad fija. Llegar a la cuota da XP una vez por día y al extra, otro poco.
 * Si cumplió la cuota 3 días seguidos, propone subir las reps por serie (nunca sube sola).
 * No son pilares: no tocan la racha. Traído de src/services/contadores.ts y src/domain/cuotas.ts.
 */
const datos = require('../datos')
const calculo = require('../calculo')
const planes = require('../planes')
const xp = require('../../xp/ventanilla')
const { transaccion } = require('../../../comun/base')
const { anotar } = require('../../../comun/historial')
const { ahora } = require('../../../comun/reloj')
const { obtenerAjustes } = require('../../../comun/ajustes')
const { fechaDe, lunesDe, sumarDias, esFechaValida } = require('../../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../../comun/errores')
const { fechaHoy, aContador, nuevoId } = require('./ayuda')

const DESDE_SIEMPRE = '0000-01-01'
/** Lo que se guarda en `datos` (lo demás son columnas). */
const CAMPOS = ['nombre', 'cantidadPorToque', 'metaDiaria', 'metaExtra', 'xpMetaDiaria', 'xpExtra', 'seriesPorDia', 'cuotaAMano', 'pasoReps', 'historialCuota', 'proximaPropuesta', 'sinSubida', 'atributoIds']

function aFila(c) {
  const d = {}
  for (const k of CAMPOS) if (c[k] !== undefined && c[k] !== null) d[k] = c[k]
  return { id: c.id, datos: d, orden: c.orden, activo: c.activo !== false, creado: c.creado }
}

async function listarContadores(usuarioId, { inactivos = false } = {}, tx = null) {
  const todos = (await datos.contadores(usuarioId, tx)).map(aContador)
  return inactivos ? todos : todos.filter((c) => c.activo)
}

async function contador(usuarioId, id, tx) {
  const c = aContador(await datos.contador(usuarioId, id, tx))
  if (!c) throw noEncontrado('Esa serie rápida')
  return c
}

const vigenteActual = (c, desde, motivo) => ({ desde, cuota: c.metaDiaria, extra: c.metaExtra ?? calculo.extraPorDefecto(c.metaDiaria), porToque: c.cantidadPorToque, motivo })

async function totalDelDia(usuarioId, contadorId, fecha, tx = null) {
  return (await datos.registrosDelDia(usuarioId, contadorId, fecha, tx)).reduce((s, r) => s + r.cantidad, 0)
}

/** Da o anula el XP de la cuota y del extra según el total del día. Idempotente: cada tope da XP una sola vez por día. */
async function ajustarXpMeta(usuarioId, c, fecha, tx) {
  const total = await totalDelDia(usuarioId, c.id, fecha, tx)
  const { cuota, extra } = calculo.cuotaDelDia(c, fecha)
  const r = { xp: 0, nuevoNivel: null, metaLograda: total >= cuota, extraLogrado: total >= extra, xpExtra: 0 }
  const tope = async (clave, logrado, cantidad, descripcion) => {
    if (logrado) {
      if (!(cantidad > 0)) return 0
      const x = await xp.sumar(usuarioId, { clave, cantidad, origen: 'contador', fecha, descripcion }, tx)
      if (x.nuevoNivel) r.nuevoNivel = x.nuevoNivel
      return x.concedido ? x.cantidad : 0
    }
    await xp.anular(usuarioId, clave, 'Total del día por debajo del tope', tx)
    return 0
  }
  r.xp += await tope(xp.claveXp('contador', [c.id, fecha]), r.metaLograda, c.xpMetaDiaria, `${c.nombre}: cuota diaria (${cuota})`)
  r.xpExtra = await tope(xp.claveXp('contador', [c.id, fecha, 'extra']), r.extraLogrado, c.xpExtra ?? 5, `${c.nombre}: extra (${extra})`)
  r.xp += r.xpExtra
  // Si ese día ya había restado (la cuota se completó después), se devuelve.
  if (r.metaLograda) await xp.devolverResta(usuarioId, `serie-${c.id}`, fecha, 'Cuota completada', tx)
  return r
}

/**
 * Crea o edita una serie rápida. Si cambió la cuota, el extra o las reps por toque, queda anotado desde hoy:
 * los días pasados conservan lo que tenían. El XP de hoy se recalcula con la cuota nueva.
 */
async function guardarContador(usuarioId, cambios, motivo = 'manual', tx = null) {
  return transaccion(async (t) => {
    const antes = cambios.id ? aContador(await datos.contador(usuarioId, cambios.id, t)) : null
    const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v))
    const c = { ...(antes || {}), ...cambios }
    for (const k of ['cantidadPorToque', 'metaDiaria', 'metaExtra', 'xpMetaDiaria', 'xpExtra', 'seriesPorDia', 'pasoReps']) c[k] = num(c[k])
    c.nombre = String(c.nombre || '').trim()
    if (c.xpMetaDiaria === undefined) c.xpMetaDiaria = 10
    // Sin cuota a mano, la cuota sale de reps × series.
    if (!c.cuotaAMano && c.cantidadPorToque > 0 && c.seriesPorDia > 0 && (cambios.cantidadPorToque !== undefined || cambios.seriesPorDia !== undefined) && cambios.metaDiaria === undefined) {
      const q = calculo.cuotaDeSeries(c.cantidadPorToque, c.seriesPorDia)
      c.metaDiaria = q.cuota
      if (cambios.metaExtra === undefined) c.metaExtra = q.extra
    }
    if (antes && cambios.metaDiaria !== undefined && cambios.metaExtra === undefined && antes.metaExtra === calculo.extraPorDefecto(antes.metaDiaria)) c.metaExtra = calculo.extraPorDefecto(c.metaDiaria)
    const errores = calculo.erroresContador(c)
    if (errores.length) throw datoInvalido(errores.join('. '))
    const hoy = await fechaHoy(usuarioId, t)
    if (!antes) {
      c.id = c.id || nuevoId('serie')
      c.creado = ahora()
      c.orden = c.orden ?? (await datos.cuantosContadores(usuarioId, t)) + 1
      c.activo = c.activo !== false
    }
    if (c.metaExtra === undefined) c.metaExtra = calculo.extraPorDefecto(c.metaDiaria)
    if (!c.seriesPorDia) c.seriesPorDia = calculo.seriesPorDiaDe(c)
    const previo = antes ? vigenteActual(antes, DESDE_SIEMPRE, 'inicio') : null
    const nuevo = vigenteActual(c, hoy, motivo)
    let historial = antes && antes.historialCuota && antes.historialCuota.length ? [...antes.historialCuota] : previo ? [previo] : [{ ...nuevo, desde: DESDE_SIEMPRE, motivo: 'inicio' }]
    if (previo && (previo.cuota !== nuevo.cuota || previo.extra !== nuevo.extra || previo.porToque !== nuevo.porToque)) {
      historial = historial.filter((x) => x.desde < hoy)
      historial.push(nuevo)
      if (previo.cuota !== nuevo.cuota || previo.porToque !== nuevo.porToque) c.proximaPropuesta = sumarDias(hoy, 3)
    }
    c.historialCuota = historial
    const guardado = aContador(await datos.ponerContador(usuarioId, aFila(c), t))
    await anotar(usuarioId, 'entreno', antes ? 'editar_serie_rapida' : 'crear_serie_rapida', { id: c.id, antes, motivo }, t)
    await ajustarXpMeta(usuarioId, guardado, hoy, t)
    return guardado
  }, tx)
}

/** Un toque: suma la cantidad configurada (o una cantidad a mano) al día de hoy. */
async function sumarToque(usuarioId, contadorId, cantidad = null, nota = null, tx = null) {
  return transaccion(async (t) => {
    const c = await contador(usuarioId, contadorId, t)
    const fecha = await fechaHoy(usuarioId, t)
    const n = cantidad === null || cantidad === undefined ? c.cantidadPorToque : Math.round(Number(cantidad))
    if (!(n > 0)) throw datoInvalido('La cantidad tiene que ser mayor que 0')
    const registro = await datos.crearRegistro(usuarioId, { contadorId, fecha, instante: ahora(), cantidad: n, nota }, t)
    const r = await ajustarXpMeta(usuarioId, c, fecha, t)
    return { registro, total: await totalDelDia(usuarioId, contadorId, fecha, t), ...r }
  }, tx)
}

/** Deshace el último toque de hoy. Si el total baja de la cuota, el XP se anula. Devuelve el total nuevo. */
async function deshacerUltimoToque(usuarioId, contadorId, tx = null) {
  return transaccion(async (t) => {
    const c = await contador(usuarioId, contadorId, t)
    const fecha = await fechaHoy(usuarioId, t)
    const regs = await datos.registrosDelDia(usuarioId, contadorId, fecha, t)
    const ultimo = regs[regs.length - 1]
    if (!ultimo) return 0
    await datos.borrarRegistro(usuarioId, ultimo.id, t)
    await anotar(usuarioId, 'entreno', 'deshacer_toque', { antes: ultimo }, t)
    await ajustarXpMeta(usuarioId, c, fecha, t)
    return totalDelDia(usuarioId, contadorId, fecha, t)
  }, tx)
}

async function borrarRegistro(usuarioId, id, motivo = 'Borrado a mano', tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.registro(usuarioId, id, t)
    if (!antes) throw noEncontrado('Ese toque')
    await datos.borrarRegistro(usuarioId, id, t)
    await anotar(usuarioId, 'entreno', 'borrar_toque', { antes, motivo }, t)
    const c = aContador(await datos.contador(usuarioId, antes.contadorId, t))
    if (c) await ajustarXpMeta(usuarioId, c, antes.fecha, t)
  }, tx)
}

async function totalesPorDia(usuarioId, contadorId, desde, hasta, tx = null) {
  return new Map((await datos.totalesPorDia(usuarioId, contadorId, desde, hasta, tx)).map((f) => [f.fecha, f.total]))
}

/**
 * Si cumplió la cuota los últimos 3 días (ayer, anteayer y el anterior), propone subir las reps por serie.
 * Después de responder (sí o todavía no), no vuelve a proponer hasta 3 días después.
 * Los 3 días tienen que ser desde que existe la serie (en la app vieja, desde el inicio del ciclo).
 */
async function propuestaDeSubida(usuarioId, c, hoy, tx = null) {
  if (!c.activo || c.sinSubida) return null
  if (c.proximaPropuesta && hoy < c.proximaPropuesta) return null
  const { zonaHoraria } = await obtenerAjustes(usuarioId, tx)
  if (sumarDias(hoy, -3) < fechaDe(c.creado, zonaHoraria)) return null
  const totales = await totalesPorDia(usuarioId, c.id, sumarDias(hoy, -3), sumarDias(hoy, -1), tx)
  for (let i = 1; i <= 3; i++) {
    const f = sumarDias(hoy, -i)
    if ((totales.get(f) ?? 0) < calculo.cuotaDelDia(c, f).cuota) return null
  }
  return calculo.propuestaPara(c)
}

async function propuestasDeSubida(usuarioId, hoy = null, tx = null) {
  const f = hoy || (await fechaHoy(usuarioId, tx))
  const r = []
  for (const c of await listarContadores(usuarioId, {}, tx)) {
    const p = await propuestaDeSubida(usuarioId, c, f, tx)
    if (p) r.push(p)
  }
  return r
}

/** «Sí»: sube las reps por serie desde hoy (cuota y extra se recalculan). «Todavía no»: vuelve a proponer en 3 días. */
async function responderPropuesta(usuarioId, contadorId, acepta, tx = null) {
  return transaccion(async (t) => {
    const c = await contador(usuarioId, contadorId, t)
    if (acepta) {
      const p = calculo.propuestaPara(c)
      return guardarContador(usuarioId, { id: c.id, cantidadPorToque: p.a, seriesPorDia: p.series, metaDiaria: p.cuota, metaExtra: p.extra }, 'sugerida', t)
    }
    const hoy = await fechaHoy(usuarioId, t)
    const despues = { ...c, proximaPropuesta: sumarDias(hoy, 3) }
    await datos.ponerContador(usuarioId, aFila(despues), t)
    await anotar(usuarioId, 'entreno', 'todavia_no_subir', { id: c.id }, t)
    return despues
  }, tx)
}

/** Lo que muestra la pantalla de series rápidas: hoy, semana, récord, días con cuota, últimos 14 días, escalones. */
async function resumenSeries(usuarioId, hoy = null, desde = null, tx = null) {
  const f = hoy || (await fechaHoy(usuarioId, tx))
  const inicio = desde && esFechaValida(desde) ? desde : sumarDias(f, -90)
  const lunes = lunesDe(f)
  const r = []
  for (const c of await listarContadores(usuarioId, {}, tx)) {
    const totales = await totalesPorDia(usuarioId, c.id, inicio, f, tx)
    const toquesHoy = (await datos.registrosDelDia(usuarioId, c.id, f, tx)).length
    let semana = 0
    let total = 0
    let record = null
    let diasConMeta = 0
    let diasConExtra = 0
    for (const [d, n] of totales) {
      total += n
      if (d >= lunes) semana += n
      const q = calculo.cuotaDelDia(c, d)
      if (n >= q.cuota) diasConMeta++
      if (n >= q.extra) diasConExtra++
      if (!record || n > record.total) record = { fecha: d, total: n }
    }
    const porDia = Array.from({ length: 14 }, (_, i) => { const d = sumarDias(f, i - 13); return { fecha: d, total: totales.get(d) ?? 0, ...calculo.cuotaDelDia(c, d) } })
    const deHoy = totales.get(f) ?? 0
    const q = calculo.cuotaDelDia(c, f)
    r.push({
      contador: c, hoy: deHoy, toquesHoy, semana, total, record, diasConMeta, diasConExtra,
      metaLogradaHoy: deHoy >= q.cuota, extraLogradoHoy: deHoy >= q.extra, cuotaHoy: q.cuota, extraHoy: q.extra,
      repsHoy: calculo.repsDelDia(c, f), series: calculo.seriesPorDiaDe(c), escalonesReps: calculo.subidasDeReps(c), porDia,
      propuesta: await propuestaDeSubida(usuarioId, c, f, tx),
    })
  }
  return { hoy: f, series: r }
}

/** Reps hechas de una serie rápida en un día (lo usa desafios: flexiones de Tensión y «No cumplí»). */
async function repsDe(usuarioId, contadorId, fecha = null, tx = null) {
  return totalDelDia(usuarioId, contadorId, fecha || (await fechaHoy(usuarioId, tx)), tx)
}

/**
 * Las series rápidas que quedaron debajo de la cuota ese día, como faltantes para xp.aplicarRestas / avisoResta
 * (el módulo dia las junta con los pilares). Las creadas después de esa fecha no cuentan.
 */
async function faltantesDelDia(usuarioId, fecha, tx = null) {
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  const { zonaHoraria } = await obtenerAjustes(usuarioId, tx)
  const r = []
  for (const c of await listarContadores(usuarioId, {}, tx)) {
    if (c.creado && fechaDe(c.creado, zonaHoraria) > fecha) continue
    if ((await totalDelDia(usuarioId, c.id, fecha, tx)) >= calculo.cuotaDelDia(c, fecha).cuota) continue
    if (c.xpMetaDiaria > 0) r.push({ id: `serie-${c.id}`, nombre: c.nombre, xp: c.xpMetaDiaria, tipo: 'serie' })
  }
  return r
}

/** Siembra las series rápidas iniciales (flexiones y dominadas) si la persona no tiene ninguna. */
async function sembrarSeries(usuarioId, tx = null) {
  return transaccion(async (t) => {
    if ((await datos.cuantosContadores(usuarioId, t)) > 0) return 0
    const creado = ahora()
    for (const c of planes.CONTADORES_INICIALES) {
      const hist = [{ desde: DESDE_SIEMPRE, cuota: c.metaDiaria, extra: c.metaExtra, porToque: c.cantidadPorToque, motivo: 'inicio' }]
      await datos.ponerContador(usuarioId, aFila({ ...c, historialCuota: hist, creado }), t)
    }
    return planes.CONTADORES_INICIALES.length
  }, tx)
}

module.exports = {
  listarContadores, guardarContador, sumarToque, deshacerUltimoToque, borrarRegistro, totalDelDia, totalesPorDia,
  propuestaDeSubida, propuestasDeSubida, responderPropuesta, resumenSeries, repsDe, faltantesDelDia, sembrarSeries, aFila,
}
