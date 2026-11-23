'use strict'
/** Consultas SQL del módulo entreno. Solo las usa su ventanilla. Tablas: rutinas, sesiones_entreno, contadores, registros_contador. */
const { una, todas, consulta } = require('../../comun/base')

// ---------- Rutinas ----------

const COL_RUTINA = 'id, nombre, dias, bloques, minutos, orden, activa, borrada, creado'

const rutinas = (usuarioId, tx) =>
  todas(`SELECT ${COL_RUTINA} FROM rutinas WHERE usuario_id = $1 ORDER BY orden, creado`, [usuarioId], tx)

const rutina = (usuarioId, id, tx) =>
  una(`SELECT ${COL_RUTINA} FROM rutinas WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

/** Crea o reemplaza una rutina entera. */
async function ponerRutina(usuarioId, r, tx) {
  const valores = [usuarioId, r.id, r.nombre, JSON.stringify(r.dias || []), JSON.stringify(r.bloques || []), r.minutos ?? 30, r.orden ?? 0, r.activa !== false, !!r.borrada, r.creado]
  const hecho = await una(`UPDATE rutinas SET nombre = $3, dias = $4, bloques = $5, minutos = $6, orden = $7, activa = $8, borrada = $9
    WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_RUTINA}`, valores.slice(0, 9), tx)
  if (hecho) return hecho
  return una(`INSERT INTO rutinas (usuario_id, id, nombre, dias, bloques, minutos, orden, activa, borrada, creado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${COL_RUTINA}`, valores, tx)
}

const borrarRutina = (usuarioId, id, tx) =>
  consulta('DELETE FROM rutinas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

// ---------- Entrenos (sesiones) ----------

const COL_SESION = 'id, rutina_id, fecha, estado, inicio, fin, datos'

const sesion = (usuarioId, id, tx) =>
  una(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const enCurso = (usuarioId, tx) =>
  una(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND estado = 'en_curso' ORDER BY inicio DESC LIMIT 1`, [usuarioId], tx)

const crearSesion = (usuarioId, { rutinaId, fecha, estado, inicio, fin = null, datos }, tx) =>
  una(`INSERT INTO sesiones_entreno (usuario_id, rutina_id, fecha, estado, inicio, fin, datos) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COL_SESION}`,
    [usuarioId, rutinaId, fecha, estado, inicio, fin, JSON.stringify(datos)], tx)

const guardarSesion = (usuarioId, id, { rutinaId, fecha, estado, inicio, fin = null, datos }, tx) =>
  una(`UPDATE sesiones_entreno SET rutina_id = $3, fecha = $4, estado = $5, inicio = $6, fin = $7, datos = $8 WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_SESION}`,
    [usuarioId, id, rutinaId, fecha, estado, inicio, fin, JSON.stringify(datos)], tx)

const borrarSesion = (usuarioId, id, tx) =>
  consulta('DELETE FROM sesiones_entreno WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

/** Terminadas (de una rutina o de todas), más viejas primero. */
const terminadas = (usuarioId, rutinaId, tx) => rutinaId
  ? todas(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND rutina_id = $2 AND estado = 'terminada' ORDER BY COALESCE(fin, inicio)`, [usuarioId, rutinaId], tx)
  : todas(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND estado = 'terminada' ORDER BY COALESCE(fin, inicio)`, [usuarioId], tx)

const cuantasDeRutina = async (usuarioId, rutinaId, tx) =>
  (await una('SELECT count(*)::int AS n FROM sesiones_entreno WHERE usuario_id = $1 AND rutina_id = $2', [usuarioId, rutinaId], tx)).n

const delDia = (usuarioId, fecha, tx) =>
  todas(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND fecha = $2 ORDER BY inicio`, [usuarioId, fecha], tx)

const ultimas = (usuarioId, cantidad, tx) =>
  todas(`SELECT ${COL_SESION} FROM sesiones_entreno WHERE usuario_id = $1 AND estado = 'terminada' ORDER BY COALESCE(fin, inicio) DESC LIMIT $2`, [usuarioId, cantidad], tx)

// ---------- Series rápidas (contadores) ----------

const COL_CONTADOR = 'id, datos, orden, activo, creado'

const contadores = (usuarioId, tx) =>
  todas(`SELECT ${COL_CONTADOR} FROM contadores WHERE usuario_id = $1 ORDER BY orden, creado`, [usuarioId], tx)

const contador = (usuarioId, id, tx) =>
  una(`SELECT ${COL_CONTADOR} FROM contadores WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

async function ponerContador(usuarioId, { id, datos, orden, activo, creado }, tx) {
  const hecho = await una(`UPDATE contadores SET datos = $3, orden = $4, activo = $5 WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_CONTADOR}`,
    [usuarioId, id, JSON.stringify(datos), orden, activo], tx)
  if (hecho) return hecho
  return una(`INSERT INTO contadores (usuario_id, id, datos, orden, activo, creado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COL_CONTADOR}`,
    [usuarioId, id, JSON.stringify(datos), orden, activo, creado], tx)
}

const cuantosContadores = async (usuarioId, tx) =>
  (await una('SELECT count(*)::int AS n FROM contadores WHERE usuario_id = $1', [usuarioId], tx)).n

const COL_REGISTRO = 'id, contador_id AS "contadorId", fecha, instante, cantidad, nota'

const crearRegistro = (usuarioId, { contadorId, fecha, instante, cantidad, nota = null }, tx) =>
  una(`INSERT INTO registros_contador (usuario_id, contador_id, fecha, instante, cantidad, nota) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COL_REGISTRO}`,
    [usuarioId, contadorId, fecha, instante, cantidad, nota], tx)

const registro = (usuarioId, id, tx) =>
  una(`SELECT ${COL_REGISTRO} FROM registros_contador WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const borrarRegistro = (usuarioId, id, tx) =>
  consulta('DELETE FROM registros_contador WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

const registrosDelDia = (usuarioId, contadorId, fecha, tx) =>
  todas(`SELECT ${COL_REGISTRO} FROM registros_contador WHERE usuario_id = $1 AND contador_id = $2 AND fecha = $3 ORDER BY instante`, [usuarioId, contadorId, fecha], tx)

/** Total por día de un contador en [desde, hasta]. */
const totalesPorDia = (usuarioId, contadorId, desde, hasta, tx) =>
  todas(`SELECT fecha, sum(cantidad)::int AS total FROM registros_contador WHERE usuario_id = $1 AND contador_id = $2 AND fecha BETWEEN $3 AND $4 GROUP BY fecha ORDER BY fecha`,
    [usuarioId, contadorId, desde, hasta], tx)

const todosLosRegistros = (usuarioId, tx) =>
  todas(`SELECT ${COL_REGISTRO} FROM registros_contador WHERE usuario_id = $1 ORDER BY instante`, [usuarioId], tx)

module.exports = {
  rutinas, rutina, ponerRutina, borrarRutina,
  sesion, enCurso, crearSesion, guardarSesion, borrarSesion, terminadas, cuantasDeRutina, delDia, ultimas,
  contadores, contador, ponerContador, cuantosContadores, crearRegistro, registro, borrarRegistro, registrosDelDia, totalesPorDia, todosLosRegistros,
}
