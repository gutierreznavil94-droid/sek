'use strict'
/**
 * Consultas SQL del módulo comida. Solo las usa ventanilla.js.
 * Tablas: comida_config, alimentos_propios, comidas, comidas_guardadas, pesos, agua_tomas, frutas.
 */
const { una, todas, consulta } = require('../../comun/base')

// ---------- Configuración (objetivo, agua, fruta) ----------

const config = (usuarioId, tx) =>
  una('SELECT objetivo, agua, fruta FROM comida_config WHERE usuario_id = $1', [usuarioId], tx)

/** Guarda una parte de la configuración: 'objetivo', 'agua' o 'fruta'. */
function guardarConfig(usuarioId, parte, valor, tx) {
  if (!['objetivo', 'agua', 'fruta'].includes(parte)) throw new Error('Parte de configuración desconocida')
  return consulta(
    `INSERT INTO comida_config (usuario_id, ${parte}) VALUES ($1, $2)
     ON CONFLICT (usuario_id) DO UPDATE SET ${parte} = EXCLUDED.${parte}`,
    [usuarioId, valor === null ? null : JSON.stringify(valor)], tx)
}

// ---------- Alimentos propios ----------

const COL_PROPIO = 'id, nombre, kcal, p, c, g, porcion, gramos, fuente, codigo, up, creado'

const propios = (usuarioId, tx) =>
  todas(`SELECT ${COL_PROPIO} FROM alimentos_propios WHERE usuario_id = $1 ORDER BY id DESC`, [usuarioId], tx)

const propio = (usuarioId, id, tx) =>
  una(`SELECT ${COL_PROPIO} FROM alimentos_propios WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const propioPorCodigo = (usuarioId, codigo, tx) =>
  una(`SELECT ${COL_PROPIO} FROM alimentos_propios WHERE usuario_id = $1 AND codigo = $2`, [usuarioId, codigo], tx)

const crearPropio = (usuarioId, a, tx) =>
  una(`INSERT INTO alimentos_propios (usuario_id, nombre, kcal, p, c, g, porcion, gramos, fuente, codigo, up, creado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ${COL_PROPIO}`,
  [usuarioId, a.nombre, a.kcal, a.p, a.c, a.g, a.porcion, a.gramos, a.fuente, a.codigo || null, !!a.up, a.creado], tx)

// ---------- Comidas del día ----------

const COL_COMIDA = 'id, fecha, franja, alimento, nombre, gramos, kcal, p, c, g, up, instante'

const crearComida = (usuarioId, r, tx) =>
  una(`INSERT INTO comidas (usuario_id, fecha, franja, alimento, nombre, gramos, kcal, p, c, g, up, instante)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ${COL_COMIDA}`,
  [usuarioId, r.fecha, r.franja, r.alimento, r.nombre, r.gramos, r.kcal, r.p, r.c, r.g, !!r.up, r.instante], tx)

const comida = (usuarioId, id, tx) =>
  una(`SELECT ${COL_COMIDA} FROM comidas WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const cambiarComida = (usuarioId, id, { gramos, kcal, p, c, g }, tx) =>
  una(`UPDATE comidas SET gramos = $3, kcal = $4, p = $5, c = $6, g = $7 WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_COMIDA}`,
    [usuarioId, id, gramos, kcal, p, c, g], tx)

const borrarComida = (usuarioId, id, tx) =>
  consulta('DELETE FROM comidas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

/** Comidas entre dos fechas (incluidas), en orden. */
const comidasEntre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COL_COMIDA} FROM comidas WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha, instante, id`,
    [usuarioId, desde, hasta], tx)

// ---------- Comidas guardadas ----------

const guardadas = (usuarioId, tx) =>
  todas('SELECT id, nombre, items, creado FROM comidas_guardadas WHERE usuario_id = $1 ORDER BY lower(nombre)', [usuarioId], tx)

const guardada = (usuarioId, id, tx) =>
  una('SELECT id, nombre, items, creado FROM comidas_guardadas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

const crearGuardada = (usuarioId, { nombre, items, creado }, tx) =>
  una('INSERT INTO comidas_guardadas (usuario_id, nombre, items, creado) VALUES ($1, $2, $3, $4) RETURNING id, nombre, items, creado',
    [usuarioId, nombre, JSON.stringify(items), creado], tx)

const borrarGuardada = (usuarioId, id, tx) =>
  consulta('DELETE FROM comidas_guardadas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

// ---------- Peso ----------

const guardarPeso = (usuarioId, { fecha, kg, instante }, tx) =>
  una(`INSERT INTO pesos (usuario_id, fecha, kg, instante) VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET kg = EXCLUDED.kg, instante = EXCLUDED.instante
       RETURNING fecha, kg, instante`, [usuarioId, fecha, kg, instante], tx)

const pesos = (usuarioId, tx) =>
  todas('SELECT fecha, kg, instante FROM pesos WHERE usuario_id = $1 ORDER BY fecha', [usuarioId], tx)

// ---------- Agua ----------

const crearToma = (usuarioId, { fecha, ml, envase, instante }, tx) =>
  una('INSERT INTO agua_tomas (usuario_id, fecha, ml, envase, instante) VALUES ($1, $2, $3, $4, $5) RETURNING id, fecha, ml, envase, instante',
    [usuarioId, fecha, ml, envase || null, instante], tx)

const tomasEntre = (usuarioId, desde, hasta, tx) =>
  todas('SELECT id, fecha, ml, envase, instante FROM agua_tomas WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha, instante, id',
    [usuarioId, desde, hasta], tx)

/** Borra la última toma del día. Devuelve la borrada o null. */
const borrarUltimaToma = (usuarioId, fecha, tx) =>
  una(`DELETE FROM agua_tomas WHERE id = (
         SELECT id FROM agua_tomas WHERE usuario_id = $1 AND fecha = $2 ORDER BY instante DESC, id DESC LIMIT 1
       ) RETURNING id, ml`, [usuarioId, fecha], tx)

const borrarToma = (usuarioId, id, tx) =>
  consulta('DELETE FROM agua_tomas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

// ---------- Fruta ----------

const crearFruta = (usuarioId, { fecha, instante }, tx) =>
  una('INSERT INTO frutas (usuario_id, fecha, instante) VALUES ($1, $2, $3) RETURNING id, fecha, instante', [usuarioId, fecha, instante], tx)

/** Cuántas frutas por día entre dos fechas: [{ fecha, n }]. */
const frutasPorDia = (usuarioId, desde, hasta, tx) =>
  todas('SELECT fecha, count(*)::int AS n FROM frutas WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 GROUP BY fecha ORDER BY fecha',
    [usuarioId, desde, hasta], tx)

/** Todas las frutas, una por fila (para la copia). */
const frutasTodas = (usuarioId, tx) =>
  todas('SELECT id, fecha, instante FROM frutas WHERE usuario_id = $1 ORDER BY fecha, instante, id', [usuarioId], tx)

const ultimoInstanteFruta = async (usuarioId, fecha, tx) =>
  (await una('SELECT max(instante) AS m FROM frutas WHERE usuario_id = $1 AND fecha = $2', [usuarioId, fecha], tx)).m || 0

const borrarUltimaFruta = (usuarioId, fecha, tx) =>
  una(`DELETE FROM frutas WHERE id = (
         SELECT id FROM frutas WHERE usuario_id = $1 AND fecha = $2 ORDER BY instante DESC, id DESC LIMIT 1
       ) RETURNING id`, [usuarioId, fecha], tx)

module.exports = {
  frutasTodas,
  config, guardarConfig,
  propios, propio, propioPorCodigo, crearPropio,
  crearComida, comida, cambiarComida, borrarComida, comidasEntre,
  guardadas, guardada, crearGuardada, borrarGuardada,
  guardarPeso, pesos,
  crearToma, tomasEntre, borrarUltimaToma, borrarToma,
  crearFruta, frutasPorDia, ultimoInstanteFruta, borrarUltimaFruta,
}
