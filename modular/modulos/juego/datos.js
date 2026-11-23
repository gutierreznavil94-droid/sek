'use strict'
/** Consultas SQL del módulo juego. Solo las usa ventanilla.js. Tabla: sesiones_juego. */
const { una, todas, consulta } = require('../../comun/base')

const COLUMNAS = 'id, inicio, fin, pausas, nota'

const activa = (usuarioId, tx) =>
  una(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 AND fin IS NULL ORDER BY inicio DESC LIMIT 1`, [usuarioId], tx)

const porId = (usuarioId, id, tx) =>
  una(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const crear = (usuarioId, { inicio, fin = null, pausas = [], nota = null }, tx) =>
  una(`INSERT INTO sesiones_juego (usuario_id, inicio, fin, pausas, nota) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
    [usuarioId, inicio, fin, JSON.stringify(pausas), nota], tx)

const actualizar = (usuarioId, id, { pausas, fin = null, nota = null, inicio = null }, tx) =>
  una(`UPDATE sesiones_juego SET pausas = $3, fin = $4, nota = COALESCE($5, nota), inicio = COALESCE($6, inicio) WHERE usuario_id = $1 AND id = $2 RETURNING ${COLUMNAS}`,
    [usuarioId, id, JSON.stringify(pausas), fin, nota, inicio], tx)

const borrar = (usuarioId, id, tx) =>
  consulta('DELETE FROM sesiones_juego WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

/** Sesiones que tocan el rango [desde, hasta) en milisegundos (las abiertas también). */
const entre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 AND inicio < $3 AND (fin IS NULL OR fin >= $2) ORDER BY inicio`,
    [usuarioId, desde, hasta], tx)

const ultimas = (usuarioId, cantidad, tx) =>
  todas(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 ORDER BY inicio DESC LIMIT $2`, [usuarioId, cantidad], tx)

const porInicio = (usuarioId, inicio, tx) =>
  una(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 AND inicio = $2 LIMIT 1`, [usuarioId, inicio], tx)

/** Todas las sesiones, en orden (para la copia). */
const todasLasSesiones = (usuarioId, tx) =>
  todas(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 ORDER BY inicio, id`, [usuarioId], tx)

module.exports = { porInicio, todasLasSesiones, activa, porId, crear, actualizar, borrar, entre, ultimas }
