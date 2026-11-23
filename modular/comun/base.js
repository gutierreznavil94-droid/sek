'use strict'
/**
 * La base PostgreSQL. Todos los datos.js consultan por acá.
 *
 * - `consulta(texto, valores, tx)`: SQL siempre con valores aparte ($1, $2).
 * - `transaccion(fn)`: todo o nada. `fn` recibe `tx` y se lo pasa a cada ventanilla
 *   que toque (las funciones de ventanilla aceptan `tx` opcional al final).
 */
const { Pool, types } = require('pg')

// Fechas (date) vuelven como texto AAAA-MM-DD, nunca como Date (evita corrimientos de zona).
types.setTypeParser(1082, (v) => v)
// bigint (instantes en milisegundos) vuelve como número.
types.setTypeParser(20, (v) => Number(v))
const config = require('./config')

let pool = null

function conexion() {
  if (!pool) {
    pool = new Pool({ connectionString: config.baseUrl, max: 10 })
    pool.on('error', (e) => console.error('[base]', e.message))
  }
  return pool
}

/** Cambia la base (pruebas). */
function usarBase(url) {
  if (pool) pool.end().catch(() => {})
  pool = new Pool({ connectionString: url, max: 5 })
  pool.on('error', (e) => console.error('[base]', e.message))
}

async function consulta(texto, valores = [], tx = null) {
  return (tx || conexion()).query(texto, valores)
}

/** Primera fila o null. */
async function una(texto, valores = [], tx = null) {
  const r = await consulta(texto, valores, tx)
  return r.rows[0] || null
}

async function todas(texto, valores = [], tx = null) {
  const r = await consulta(texto, valores, tx)
  return r.rows
}

/**
 * Corre `fn(tx)` en una transacción. Si ya viene una (`txExterna`), usa esa y no la cierra:
 * así una ventanilla puede llamar a otra dentro del mismo «todo o nada».
 */
async function transaccion(fn, txExterna = null) {
  if (txExterna) return fn(txExterna)
  const cliente = await conexion().connect()
  try {
    await cliente.query('BEGIN')
    const r = await fn(cliente)
    await cliente.query('COMMIT')
    return r
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    cliente.release()
  }
}

async function cerrar() {
  if (pool) { const p = pool; pool = null; await p.end() }
}

module.exports = { consulta, una, todas, transaccion, usarBase, cerrar }
