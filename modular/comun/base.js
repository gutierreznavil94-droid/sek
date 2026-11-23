'use strict'
/**
 * La base: PostgreSQL ADENTRO del celu (PGlite). No hay servidor.
 * - En el celu guarda en la memoria del teléfono (IndexedDB, 'idb://sek').
 * - En las pruebas y en la compu, en memoria (o en una carpeta si se pide con `usarBase('./datos')`).
 *
 * Misma forma de siempre: `consulta(texto, valores, tx)`, `una`, `todas`, `transaccion(fn, txExterna?)`.
 * SQL siempre con valores aparte ($1, $2). Fechas (date) vuelven como texto AAAA-MM-DD; bigint como número.
 */
const { PGlite } = require('@electric-sql/pglite')

// Fechas como texto (sin corrimientos de zona), bigint como número, numeric como texto (igual que pg).
// Ojo: se pasan en CADA consulta, porque las transacciones de PGlite no heredan los del constructor.
const PARSERS = { 1082: (v) => v, 20: (v) => Number(v), 1700: (v) => v }

let db = null
let lugar = (typeof SEK_LUGAR_BASE !== 'undefined' && SEK_LUGAR_BASE) || undefined // undefined = en memoria

function conexion() {
  // En el celu la página madre deja listos el wasm y los datos de PGlite (SEK_PGLITE_OPCIONES).
  if (!db) db = new PGlite(lugar, { ...(globalThis.SEK_PGLITE_OPCIONES || {}), parsers: PARSERS })
  return db
}

/** Cambia la base: sin nada, una nueva en memoria (pruebas); 'idb://sek' en el celu; una carpeta en la compu. */
function usarBase(nuevoLugar) {
  if (db) db.close().catch(() => {})
  db = null
  lugar = nuevoLugar || undefined
}

const adaptar = (r) => ({ rows: r.rows, rowCount: r.affectedRows ?? r.rows.length })

async function consulta(texto, valores = [], tx = null) {
  const q = tx || conexion()
  // Varias sentencias juntas (las migraciones): exec, sin valores.
  if (!valores.length && /;\s*\S/.test(texto)) { await q.exec(texto); return { rows: [], rowCount: 0 } }
  return adaptar(await q.query(texto, valores, { parsers: PARSERS }))
}

/** Un guion con varias sentencias (las migraciones). */
async function ejecutar(texto, tx = null) { await (tx || conexion()).exec(texto) }

/** Primera fila o null. */
async function una(texto, valores = [], tx = null) { return (await consulta(texto, valores, tx)).rows[0] || null }

async function todas(texto, valores = [], tx = null) { return (await consulta(texto, valores, tx)).rows }

/**
 * Corre `fn(tx)` en una transacción. Si ya viene una (`txExterna`), usa esa y no la cierra:
 * así una ventanilla puede llamar a otra dentro del mismo «todo o nada».
 */
async function transaccion(fn, txExterna = null) {
  if (txExterna) return fn(txExterna)
  return conexion().transaction(async (tx) => fn(tx))
}

/** Espera a que la base esté abierta (en el celu, la primera vez tarda un poco). */
async function abrir() { await conexion().waitReady }

async function cerrar() { if (db) { const d = db; db = null; await d.close() } }

/** Guarda ya en la memoria del teléfono lo que falte (en el celu se guarda sin esperar a cada consulta). */
async function guardarYa() { if (db && typeof db.syncToFs === 'function') await db.syncToFs(false) }

module.exports = { guardarYa, consulta, una, todas, ejecutar, transaccion, usarBase, abrir, cerrar }
