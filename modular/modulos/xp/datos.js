'use strict'
/** Consultas SQL del módulo xp. Solo las usa ventanilla.js. Tabla: xp_registros. */
const { una, todas, consulta } = require('../../comun/base')

const COLUMNAS = `id, clave, cantidad, origen, fecha, creado, descripcion, anulado, anulado_en AS "anuladoEn", motivo_anulacion AS "motivoAnulacion"`

/** Pone en fila los cambios de XP de una persona dentro de la transacción (dos sumas a la vez no se pisan el nivel). */
const bloquear = (usuarioId, tx) =>
  consulta(`SELECT pg_advisory_xact_lock(hashtext('xp_registros'), $1)`, [usuarioId], tx)

const porId = (usuarioId, id, tx) =>
  una(`SELECT ${COLUMNAS} FROM xp_registros WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const porClave = (usuarioId, clave, tx) =>
  una(`SELECT ${COLUMNAS} FROM xp_registros WHERE usuario_id = $1 AND clave = $2`, [usuarioId, clave], tx)

/** Total válido. Lo que no puede restar cuenta como 0 si fuera negativo; nunca baja de 0. */
const total = async (usuarioId, origenesQueRestan, tx) => {
  const f = await una(
    `SELECT COALESCE(SUM(CASE WHEN origen = ANY($2) THEN cantidad ELSE GREATEST(cantidad, 0) END), 0)::int AS total
     FROM xp_registros WHERE usuario_id = $1 AND NOT anulado`, [usuarioId, origenesQueRestan], tx)
  return Math.max(0, f.total)
}

/** Inserta; si la clave ya existe no hace nada y devuelve null. */
const crear = (usuarioId, r, tx) =>
  una(`INSERT INTO xp_registros (usuario_id, clave, cantidad, origen, fecha, creado, descripcion, anulado, anulado_en, motivo_anulacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (usuario_id, clave) DO NOTHING RETURNING ${COLUMNAS}`,
    [usuarioId, r.clave, r.cantidad, r.origen, r.fecha, r.creado, r.descripcion || '', !!r.anulado, r.anuladoEn ?? null, r.motivoAnulacion ?? null], tx)

const reactivar = (usuarioId, id, { cantidad, creado, descripcion }, tx) =>
  una(`UPDATE xp_registros SET anulado = false, anulado_en = NULL, motivo_anulacion = NULL, cantidad = $3, creado = $4, descripcion = $5
       WHERE usuario_id = $1 AND id = $2 RETURNING ${COLUMNAS}`, [usuarioId, id, cantidad, creado, descripcion], tx)

const anular = (usuarioId, id, instante, motivo, tx) =>
  una(`UPDATE xp_registros SET anulado = true, anulado_en = $3, motivo_anulacion = $4
       WHERE usuario_id = $1 AND id = $2 RETURNING ${COLUMNAS}`, [usuarioId, id, instante, motivo], tx)

const delDia = (usuarioId, fecha, tx) =>
  todas(`SELECT ${COLUMNAS} FROM xp_registros WHERE usuario_id = $1 AND fecha = $2 ORDER BY creado, id`, [usuarioId, fecha], tx)

/** XP neta por día (sin anulados) entre dos fechas, incluidas. */
const porDia = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT fecha, SUM(cantidad)::int AS xp FROM xp_registros
         WHERE usuario_id = $1 AND NOT anulado AND fecha BETWEEN $2 AND $3 GROUP BY fecha ORDER BY fecha`, [usuarioId, desde, hasta], tx)

const antesDe = async (usuarioId, fecha, tx) =>
  (await una(`SELECT COALESCE(SUM(cantidad), 0)::int AS xp FROM xp_registros WHERE usuario_id = $1 AND NOT anulado AND fecha < $2`, [usuarioId, fecha], tx)).xp

/** Últimos movimientos (anulados también, para que se vea la corrección). */
const ultimos = (usuarioId, cantidad, antesDeId, tx) =>
  todas(`SELECT ${COLUMNAS} FROM xp_registros WHERE usuario_id = $1 AND ($3::bigint IS NULL OR id < $3)
         ORDER BY id DESC LIMIT $2`, [usuarioId, cantidad, antesDeId], tx)

module.exports = { bloquear, porId, porClave, total, crear, reactivar, anular, delDia, porDia, antesDe, ultimos }
