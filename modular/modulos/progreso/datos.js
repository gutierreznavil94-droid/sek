'use strict'
/**
 * Consultas SQL del módulo progreso. Solo las usa ventanilla.js.
 * Progreso no tiene tablas: lee SOLO las vistas de su migración (015-progreso.sql). Nunca escribe.
 */
const { una, todas } = require('../../comun/base')

/** XP por día en [desde, hasta]: { fecha, ganado, perdido, neto }. */
const xpPorDia = (u, desde, hasta, tx) =>
  todas('SELECT fecha, ganado, perdido, neto FROM progreso_xp_dia WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

/** XP neta acumulada antes de una fecha (para arrancar la montaña). */
const xpAntesDe = async (u, fecha, tx) =>
  (await una('SELECT COALESCE(SUM(neto), 0)::int AS xp FROM progreso_xp_dia WHERE usuario_id = $1 AND fecha < $2', [u, fecha], tx)).xp

/** Lo ganado (positivo) en un rango: para el cierre de fase. */
const xpGanado = async (u, desde, hasta, tx) =>
  (await una('SELECT COALESCE(SUM(ganado), 0)::int AS xp FROM progreso_xp_dia WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3', [u, desde, hasta], tx)).xp

const dias = (u, desde, hasta, tx) =>
  todas(`SELECT fecha, cumplidos, programados, porcentaje, minutos_juego AS "minutosJuego", excepcion
         FROM progreso_dias WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha`, [u, desde, hasta], tx)

const entrenosPrevistos = async (u, desde, hasta, tx) => una(
  `SELECT COUNT(*)::int AS previstos, (COUNT(*) FILTER (WHERE estado IN ('completado', 'tarde')))::int AS hechos
   FROM progreso_entrenos_previstos WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3`, [u, desde, hasta], tx)

const atributosDelDia = (u, fecha, tx) =>
  todas('SELECT atributo_id AS "atributoId", nombre, valor FROM progreso_atributos_dia WHERE usuario_id = $1 AND fecha = $2 ORDER BY nombre', [u, fecha], tx)

const noches = (u, desde, hasta, tx) =>
  todas(`SELECT noche, cumplido, retraso_minutos AS "retrasoMinutos", minutos_dormido AS "minutosDormido", sin_dejo_celu AS "sinDejoCelu"
         FROM progreso_noches WHERE usuario_id = $1 AND noche BETWEEN $2 AND $3 ORDER BY noche`, [u, desde, hasta], tx)

const entrenos = (u, desde, hasta, tx) =>
  todas('SELECT fecha, rutina_id AS "rutinaId", rutina, minutos FROM progreso_entrenos WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

const seriesPorDia = (u, desde, hasta, tx) =>
  todas(`SELECT contador_id AS "contadorId", nombre, fecha, reps FROM progreso_series_dia
         WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY nombre, fecha`, [u, desde, hasta], tx)

const comidaPorDia = (u, desde, hasta, tx) =>
  todas('SELECT fecha, kcal, proteina FROM progreso_comida_dia WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

const aguaPorDia = (u, desde, hasta, tx) =>
  todas('SELECT fecha, ml FROM progreso_agua_dia WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

const frutaPorDia = (u, desde, hasta, tx) =>
  todas('SELECT fecha, frutas FROM progreso_fruta_dia WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

const pesos = (u, desde, hasta, tx) =>
  todas('SELECT fecha, kg FROM progreso_pesos WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)

const caidas = (u, tx) =>
  todas('SELECT fecha, origen FROM progreso_caidas WHERE usuario_id = $1 ORDER BY fecha', [u], tx)

const marcas = (u, tx) =>
  todas('SELECT fecha, texto FROM progreso_marcas WHERE usuario_id = $1 ORDER BY fecha', [u], tx)

const forja = (u, tx) =>
  todas('SELECT id, nombre, kanji, estado, cumplidos FROM progreso_forja WHERE usuario_id = $1 ORDER BY nombre', [u], tx)

module.exports = {
  xpPorDia, xpAntesDe, xpGanado, dias, entrenosPrevistos, atributosDelDia, noches, entrenos, seriesPorDia,
  comidaPorDia, aguaPorDia, frutaPorDia, pesos, caidas, marcas, forja,
}
