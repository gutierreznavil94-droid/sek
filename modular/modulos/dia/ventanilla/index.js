'use strict'
/**
 * Dia · la única puerta del módulo. Junta sus partes:
 * - pilares.js: pilares y compromisos, cierre del día, racha, atributos, excepciones, el Tajo (parte 1).
 * - calendario.js: feriados, fechas clave, Mi horario y el Calendario del mes (parte 2).
 * - tablero.js: la pantalla Hoy como tablero, «Empezar mi ciclo», «Dejo celu» desde Hoy y el bloqueo del modo sueño (parte 2).
 */
const pilares = require('./pilares')
const calendario = require('./calendario')
const tablero = require('./tablero')
const { transaccion } = require('../../../comun/base')

/** Lo que app.js le conecta (ver LEEME): planComida, faltantesSeries, seriesParaAtributos, desafiosHoy. */
function conectar(cambios = {}) {
  pilares.conectar(cambios)
  tablero.conectarTablero(cambios)
}

/** Al crear una cuenta: pilares de fábrica y feriados. */
async function sembrar(usuarioId, tx = null) {
  const r = await pilares.sembrar(usuarioId, tx)
  await calendario.sembrarAgenda(usuarioId, tx)
  return r
}

/** De la copia de la app vieja: lo de la parte 1 más feriados, fechas clave y horario. */
async function importar(usuarioId, vieja = {}, tx = null) {
  return transaccion(async (t) => ({ ...(await pilares.importar(usuarioId, vieja, t)), ...(await calendario.importarAgenda(usuarioId, vieja, t)) }), tx)
}

/** Todo el módulo para la copia (lo usa copia): lo de la parte 1 más feriados, fechas clave y horario. */
async function exportar(usuarioId, tx = null) {
  return { ...(await pilares.exportar(usuarioId, tx)), ...(await calendario.exportarAgenda(usuarioId, tx)) }
}

module.exports = {
  ...pilares,
  ...calendario,
  ...tablero,
  conectar, sembrar, importar, exportar,
}
