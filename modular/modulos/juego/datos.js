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

const actualizar = (usuarioId, id, { pausas, fin = null, nota = null }, tx) =>
  una(`UPDATE sesiones_juego SET pausas = $3, fin = $4, nota = COALESCE($5, nota) WHERE usuario_id = $1 AND id = $2 RETURNING ${COLUMNAS}`,
    [usuarioId, id, JSON.stringify(pausas), fin, nota], tx)

const borrar = (usuarioId, id, tx) =>
  consulta('DELETE FROM sesiones_juego WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

/** Sesiones que tocan el rango [desde, hasta) en milisegundos (las abiertas también). */
const entre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 AND inicio < $3 AND (fin IS NULL OR fin >= $2) ORDER BY inicio`,
    [usuarioId, desde, hasta], tx)

const ultimas = (usuarioId, cantidad, tx) =>
  todas(`SELECT ${COLUMNAS} FROM sesiones_juego WHERE usuario_id = $1 ORDER BY inicio DESC LIMIT $2`, [usuarioId, cantidad], tx)

module.exports = { activa, porId, crear, actualizar, borrar, entre, ultimas }
