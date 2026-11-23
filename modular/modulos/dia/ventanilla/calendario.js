'use strict'
/**
 * Dia · parte 2: feriados, fechas clave, Mi horario y el Calendario del mes.
 * La puerta del módulo es ventanilla/index.js. Todas aceptan `tx` opcional al final.
 */
const crypto = globalThis.crypto
const datos = require('../datos')
const agenda = require('../agenda')
const pilares = require('./pilares')
const ciclo = require('../../ciclo/ventanilla')
const { transaccion } = require('../../../comun/base')
const { obtenerAjustes } = require('../../../comun/ajustes')
const { anotar } = require('../../../comun/historial')
const { ahora } = require('../../../comun/reloj')
const { fechaDe, instanteDe, sumarDias, esFechaValida, esHoraValida, minutosDe } = require('../../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../../comun/errores')

const nuevoId = (prefijo) => `${prefijo}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
function revisarFecha(f, que = 'La fecha') { if (!esFechaValida(f)) throw datoInvalido(`${que} no es válida.`) }
function revisarRango(desde, hasta) {
  revisarFecha(desde); revisarFecha(hasta)
  if (hasta < desde) throw datoInvalido('«Hasta» es antes de «desde».')
  if (hasta > sumarDias(desde, 400)) throw datoInvalido('El rango es muy largo (máximo 400 días).')
}

// ---------- Feriados ----------

async function esFeriado(usuarioId, fecha, tx = null) { return !!(await datos.feriado(usuarioId, fecha, tx)) }
async function feriadosEntre(usuarioId, desde, hasta, tx = null) { revisarRango(desde, hasta); return datos.feriadosEntre(usuarioId, desde, hasta, tx) }

async function marcarFeriado(usuarioId, fecha, nombre = 'Feriado', tx = null) {
  revisarFecha(fecha)
  const n = String(nombre || '').trim().slice(0, 120) || 'Feriado'
  return transaccion(async (t) => {
    await datos.ponerFeriado(usuarioId, { fecha, nombre: n, propio: true, creado: ahora() }, t)
    await anotar(usuarioId, 'dia', 'feriado', { fecha, nombre: n }, t)
    return { fecha, nombre: n, propio: true }
  }, tx)
}

async function quitarFeriado(usuarioId, fecha, tx = null) {
  revisarFecha(fecha)
  return transaccion(async (t) => {
    const quitado = await datos.quitarFeriado(usuarioId, fecha, t)
    if (quitado) await anotar(usuarioId, 'dia', 'quitar_feriado', { fecha }, t)
    return quitado
  }, tx)
}

/** Sábado, domingo o feriado (límite de juego de finde). */
async function esDiaDeFinde(usuarioId, fecha, tx = null) { return agenda.esDeFinde(fecha, await esFeriado(usuarioId, fecha, tx)) }

// ---------- Fechas clave ----------

function limpiarFechaClave(x, previa = {}) {
  const f = { ...previa, ...x }
  revisarFecha(f.fecha)
  f.titulo = String(f.titulo || '').trim().slice(0, 120)
  if (!f.titulo) throw datoInvalido('La fecha clave necesita un título.')
  f.nota = f.nota ? String(f.nota).trim().slice(0, 500) || null : null
  f.anual = !!f.anual
  f.hora = f.hora || null
  f.horaFin = f.hora ? f.horaFin || null : null
  if (f.hora && !esHoraValida(f.hora)) throw datoInvalido('Hora inválida.')
  if (f.horaFin && (!esHoraValida(f.horaFin) || minutosDe(f.horaFin) <= minutosDe(f.hora))) throw datoInvalido('«Hasta» tiene que ser después de la hora.')
  return f
}

async function agregarFechaClave(usuarioId, x, tx = null) {
  const f = limpiarFechaClave(x)
  return transaccion(async (t) => {
    const fc = { ...f, id: nuevoId('fc'), creada: ahora() }
    await datos.ponerFechaClave(usuarioId, fc, t)
    await anotar(usuarioId, 'dia', 'fecha_clave', { id: fc.id, titulo: fc.titulo }, t)
    return datos.fechaClave(usuarioId, fc.id, t)
  }, tx)
}

async function editarFechaClave(usuarioId, id, cambios, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.fechaClave(usuarioId, id, t)
    if (!antes) throw noEncontrado('Esa fecha clave')
    const f = limpiarFechaClave(cambios, antes)
    await datos.ponerFechaClave(usuarioId, { ...f, id, creada: antes.creada }, t)
    return datos.fechaClave(usuarioId, id, t)
  }, tx)
}

async function borrarFechaClave(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    if (!(await datos.borrarFechaClave(usuarioId, id, t))) throw noEncontrado('Esa fecha clave')
    await anotar(usuarioId, 'dia', 'borrar_fecha_clave', { id }, t)
    return true
  }, tx)
}

async function fechasClaveEntre(usuarioId, desde, hasta, tx = null) {
  revisarRango(desde, hasta)
  return agenda.fechasClavePorDia(await datos.fechasClave(usuarioId, tx), desde, hasta)
}

// ---------- Mi horario ----------

async function configHorario(usuarioId, tx = null) { return agenda.normalizarConfig(await datos.horario(usuarioId, tx)) }
async function guardarConfig(usuarioId, c, motivo, tx) {
  await datos.guardarHorario(usuarioId, c, ahora(), tx)
  await anotar(usuarioId, 'dia', 'horario', { motivo }, tx)
  return c
}
const activoDe = (c) => c.horarios.find((h) => h.id === c.activo)

/** Crea o edita un bloque del horario activo. El bloque de entreno escribe en la acción «entrenamiento» (días, hora y «Empezar hasta»). */
async function guardarBloque(usuarioId, b, tx = null) {
  const errores = agenda.validarBloque(b)
  if (errores.length) throw datoInvalido(errores[0])
  const dias = [...new Set(b.dias)].sort()
  return transaccion(async (t) => {
    if (b.id === agenda.ID_BLOQUE_ENTRENO || b.tipo === 'entreno') {
      const a = await datos.accion(usuarioId, 'entrenamiento', t)
      if (!a) throw noEncontrado('El pilar de entrenamiento')
      await pilares.guardarAccion(usuarioId, { ...a, dias, hora: b.desde, horaLimiteInicio: b.hasta, horasPorDia: undefined }, {}, t)
      return { id: agenda.ID_BLOQUE_ENTRENO, nombre: a.nombre, tipo: 'entreno', dias, desde: b.desde, hasta: b.hasta }
    }
    const c = await configHorario(usuarioId, t)
    const h = activoDe(c)
    const bloque = { id: b.id || nuevoId('blq'), nombre: String(b.nombre).trim().slice(0, 80), tipo: b.tipo || 'obligatorio', dias, desde: b.desde, hasta: b.hasta }
    const i = h.bloques.findIndex((x) => x.id === bloque.id)
    if (i >= 0) h.bloques[i] = bloque
    else if (b.id) throw noEncontrado('Ese bloque')
    else h.bloques.push(bloque)
    await guardarConfig(usuarioId, c, `bloque ${bloque.nombre}`, t)
    return bloque
  }, tx)
}

async function borrarBloque(usuarioId, id, tx = null) {
  if (id === agenda.ID_BLOQUE_ENTRENO) throw datoInvalido('El entreno se apaga desde sus pilares, no desde Mi horario.')
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    const h = activoDe(c)
    const antes = h.bloques.length
    h.bloques = h.bloques.filter((b) => b.id !== id)
    if (h.bloques.length === antes) throw noEncontrado('Ese bloque')
    await guardarConfig(usuarioId, c, 'borrar bloque', t)
    return true
  }, tx)
}

/** Mantener apretado un bloque: copiarlo a otros días (suma los días al mismo bloque). */
async function copiarADias(usuarioId, id, dias, tx = null) {
  return transaccion(async (t) => {
    const h = activoDe(await configHorario(usuarioId, t))
    const b = h.bloques.find((x) => x.id === id)
    if (!b) throw noEncontrado('Ese bloque')
    return guardarBloque(usuarioId, { ...b, dias: [...b.dias, ...(dias || [])] }, t)
  }, tx)
}

async function nuevoHorario(usuarioId, nombre, copiarDelActivo = false, tx = null) {
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    const base = activoDe(c)
    const h = { id: nuevoId('hor'), nombre: String(nombre || '').trim().slice(0, 60) || `Horario ${c.horarios.length + 1}`,
      bloques: copiarDelActivo && base ? base.bloques.map((b) => ({ ...b, id: nuevoId('blq') })) : [] }
    c.horarios.push(h)
    c.activo = h.id
    await guardarConfig(usuarioId, c, `nuevo horario ${h.nombre}`, t)
    return h
  }, tx)
}

async function activarHorario(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    if (!c.horarios.some((h) => h.id === id)) throw noEncontrado('Ese horario')
    c.activo = id
    return guardarConfig(usuarioId, c, 'activar horario', t)
  }, tx)
}

async function renombrarHorario(usuarioId, id, nombre, tx = null) {
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    const h = c.horarios.find((x) => x.id === id)
    if (!h) throw noEncontrado('Ese horario')
    h.nombre = String(nombre || '').trim().slice(0, 60) || h.nombre
    return guardarConfig(usuarioId, c, 'renombrar horario', t)
  }, tx)
}

async function borrarHorario(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    if (!c.horarios.some((h) => h.id === id)) throw noEncontrado('Ese horario')
    if (c.horarios.length <= 1) throw datoInvalido('Tiene que quedar al menos un horario.')
    c.horarios = c.horarios.filter((h) => h.id !== id)
    if (c.activo === id) c.activo = c.horarios[0].id
    return guardarConfig(usuarioId, c, 'borrar horario', t)
  }, tx)
}

/** Apaga (o vuelve a prender) un bloque solo en una fecha. */
async function apagarBloqueEnFecha(usuarioId, fecha, bloqueId, apagado = true, tx = null) {
  revisarFecha(fecha)
  return transaccion(async (t) => {
    const c = await configHorario(usuarioId, t)
    const lista = (c.excepciones[fecha] || []).filter((x) => x !== bloqueId)
    if (apagado) lista.push(bloqueId)
    if (lista.length) c.excepciones[fecha] = lista
    else delete c.excepciones[fecha]
    return guardarConfig(usuarioId, c, apagado ? 'apagar bloque' : 'prender bloque', t)
  }, tx)
}

/** «Hoy a las 19:30»: corre el entreno de una fecha sin tocar la semana. */
async function correrEntreno(usuarioId, fecha, hora, tx = null) {
  revisarFecha(fecha)
  if (!esHoraValida(hora)) throw datoInvalido('Hora inválida.')
  return transaccion(async (t) => {
    await pilares.generarCompromisos(usuarioId, fecha, t)
    const c = await datos.compromiso(usuarioId, `entrenamiento:${fecha}`, t)
    if (!c) throw datoInvalido('Ese día no hay entreno programado.')
    await datos.ponerCompromiso(usuarioId, { ...c, horaPrevista: hora, actualizado: ahora() }, t)
    await anotar(usuarioId, 'dia', 'correr_entreno', { fecha, hora }, t)
    return true
  }, tx)
}

/** Lo que necesita agenda.bloquesDelDia para una fecha. */
async function entradaBloques(usuarioId, fecha, c, a, todasFc, tx) {
  const accion = await datos.accion(usuarioId, 'entrenamiento', tx)
  const compromiso = accion ? await datos.compromiso(usuarioId, `entrenamiento:${fecha}`, tx) : null
  return { config: c, fecha, feriado: await esFeriado(usuarioId, fecha, tx), entreno: accion ? { accion, compromiso } : null,
    fechasClave: todasFc.filter((fc) => agenda.caeEn(fc, fecha)), ajustes: a }
}

/** Los bloques de una fecha (con los apagados marcados), los huecos libres y, si es hoy, dónde estás ahora. */
async function horarioDelDia(usuarioId, fecha = null, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const f = fecha || fechaDe(ahora(), a.zonaHoraria)
  revisarFecha(f)
  const c = await configHorario(usuarioId, tx)
  const bloques = agenda.bloquesDelDia(await entradaBloques(usuarioId, f, c, a, await datos.fechasClave(usuarioId, tx), tx), { conApagados: true })
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  let m = null
  if (f === hoy) {
    const minuto = Math.floor((ahora() - instanteDe(f, '00:00', a.zonaHoraria)) / 60000)
    m = agenda.momento(bloques, minuto, a.horaAlistarse)
    m.texto = agenda.textoMomento(m)
  }
  return { fecha: f, bloques, huecos: agenda.huecos(bloques, a.horaFinSuenio, a.horaAlistarse), momento: m }
}

/** Todo lo de la pantalla Mi horario: la config, los bloques de cada día de la semana de `fecha` y las plantillas. */
async function horarioSemana(usuarioId, fecha = null, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const f = fecha || fechaDe(ahora(), a.zonaHoraria)
  revisarFecha(f)
  const c = await configHorario(usuarioId, tx)
  const todasFc = await datos.fechasClave(usuarioId, tx)
  const ds = new Date(`${f}T12:00:00Z`).getUTCDay()
  const lunes = sumarDias(f, -((ds + 6) % 7))
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = sumarDias(lunes, i)
    dias.push({ fecha: d, bloques: agenda.bloquesDelDia(await entradaBloques(usuarioId, d, c, a, todasFc, tx), { conApagados: true }).filter((b) => b.tipo !== 'dormir') })
  }
  const accion = await datos.accion(usuarioId, 'entrenamiento', tx)
  return {
    hoy: fechaDe(ahora(), a.zonaHoraria),
    config: c,
    activo: activoDe(c),
    entreno: accion ? { nombre: accion.nombre, activa: accion.activa, dias: accion.dias, hora: accion.hora || null, horaLimiteInicio: accion.horaLimiteInicio || null } : null,
    sueno: { horaAlistarse: a.horaAlistarse, horaDormido: a.horaDormido, horaFinSuenio: a.horaFinSuenio },
    plantillas: agenda.PLANTILLAS,
    dias,
  }
}

// ---------- Calendario ----------

/**
 * Un mes del calendario ('AAAA-MM'): cada día con su cumplimiento, pilares, feriado, excepción, fechas clave y bloques,
 * y dónde cae el ciclo (Día 1, Día 0, fin).
 */
async function calendarioMes(usuarioId, mes, tx = null) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) throw datoInvalido('El mes va como AAAA-MM.')
  const desde = `${mes}-01`
  const [y, m] = mes.split('-').map(Number)
  const hasta = sumarDias(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1)
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const c = await ciclo.cicloActivo(usuarioId, tx)
  const cumplimiento = new Map((await pilares.cumplimientoPorDia(usuarioId, desde, hasta, tx)).map((d) => [d.fecha, d]))
  const porDia = new Map((await pilares.pilaresPorDia(usuarioId, desde, hasta, tx)).map((d) => [d.fecha, d.pilares]))
  const feriados = new Map((await datos.feriadosEntre(usuarioId, desde, hasta, tx)).map((f) => [f.fecha, f]))
  const excepciones = new Map((await datos.excepcionesEntre(usuarioId, desde, hasta, tx)).map((e) => [e.fecha, e]))
  const todasFc = await datos.fechasClave(usuarioId, tx)
  const fcPorDia = agenda.fechasClavePorDia(todasFc, desde, hasta)
  const config = await configHorario(usuarioId, tx)
  const dias = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const cu = cumplimiento.get(f)
    const bloques = agenda.bloquesDelDia(await entradaBloques(usuarioId, f, config, a, todasFc, tx)).filter((b) => b.tipo !== 'dormir')
    dias.push({
      fecha: f,
      hoy: f === hoy,
      futuro: f > hoy,
      porcentaje: cu ? cu.porcentaje : null,
      nivel: cu ? cu.nivel : null,
      pilares: porDia.get(f) || [],
      feriado: feriados.get(f) || null,
      excepcion: excepciones.get(f) || null,
      fechasClave: fcPorDia[f] || [],
      bloques: bloques.map((b) => ({ id: b.id, nombre: b.nombre, tipo: b.tipo, desde: b.desde, hasta: b.hasta })),
    })
  }
  return {
    mes, desde, hasta, hoy,
    ciclo: c ? { inicio: c.inicio, diaCero: c.diaCero || null, fin: sumarDias(c.inicio, c.duracionDias - 1), duracionDias: c.duracionDias } : null,
    dias,
  }
}

/** Al crear una cuenta: los feriados de fábrica (si no tiene ninguno). */
async function sembrarAgenda(usuarioId, tx = null) {
  return transaccion(async (t) => {
    if (await datos.cuantosFeriados(usuarioId, t)) return false
    const creado = ahora()
    for (const f of agenda.FERIADOS_INICIALES) await datos.ponerFeriado(usuarioId, { ...f, propio: false, creado }, t)
    return true
  }, tx)
}

/** De la copia de la app vieja: { feriados, fechasClave, horario (ajustes.horario) }. Lo repetido no entra. */
async function importarAgenda(usuarioId, vieja = {}, tx = null) {
  return transaccion(async (t) => {
    const n = { feriados: 0, fechasClave: 0, horario: 0 }
    for (const f of vieja.feriados || []) {
      if (!f || !esFechaValida(f.fecha) || await datos.feriado(usuarioId, f.fecha, t)) continue
      await datos.ponerFeriado(usuarioId, { fecha: f.fecha, nombre: String(f.nombre || 'Feriado').slice(0, 120), propio: !!f.propio, creado: f.creado ?? ahora() }, t)
      n.feriados++
    }
    for (const fc of vieja.fechasClave || []) {
      if (!fc || !fc.id || !esFechaValida(fc.fecha) || !String(fc.titulo || '').trim() || await datos.fechaClave(usuarioId, fc.id, t)) continue
      try {
        const limpia = limpiarFechaClave(fc)
        await datos.ponerFechaClave(usuarioId, { ...limpia, id: String(fc.id), creada: fc.creada ?? ahora() }, t)
        n.fechasClave++
      } catch (e) { /* una fecha clave rota no frena la copia */ }
    }
    if (vieja.horario && Array.isArray(vieja.horario.horarios) && !(await datos.horario(usuarioId, t))) {
      const c = agenda.normalizarConfig(vieja.horario)
      for (const h of c.horarios) h.bloques = (h.bloques || []).filter((b) => b && b.id && !agenda.validarBloque(b).length)
      await datos.guardarHorario(usuarioId, c, ahora(), t)
      n.horario = 1
    }
    return n
  }, tx)
}

/** Lo de la parte 2 para la copia nueva, con la forma que recibe `importarAgenda`. */
async function exportarAgenda(usuarioId, tx = null) {
  return {
    feriados: await datos.feriadosEntre(usuarioId, '0001-01-01', '9999-12-31', tx),
    fechasClave: await datos.fechasClave(usuarioId, tx),
    horario: await datos.horario(usuarioId, tx),
  }
}

module.exports = {
  exportarAgenda,
  esFeriado, feriadosEntre, marcarFeriado, quitarFeriado, esDiaDeFinde,
  agregarFechaClave, editarFechaClave, borrarFechaClave, fechasClaveEntre,
  configHorario, guardarBloque, borrarBloque, copiarADias, nuevoHorario, activarHorario, renombrarHorario, borrarHorario,
  apagarBloqueEnFecha, correrEntreno, horarioDelDia, horarioSemana,
  calendarioMes, sembrarAgenda, importarAgenda,
}
