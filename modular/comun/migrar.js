'use strict'
/**
 * Aplica las migraciones de migraciones/ en orden (001-..., 002-...). Cada una corre una sola vez
 * y en su propia transacción.
 * - En la compu las lee de la carpeta migraciones/.
 * - En el celu vienen adentro del paquete (las mete herramientas/armar-celu.js en SEK_MIGRACIONES).
 */
const base = require('./base')
const { ahora } = require('./reloj')

/** [{ nombre, sql }] en orden. */
function leerMigraciones() {
  if (typeof SEK_MIGRACIONES !== 'undefined') return SEK_MIGRACIONES // eslint-disable-line no-undef
  const fs = require('node:fs')
  const path = require('node:path')
  const carpeta = path.join(__dirname, '..', 'migraciones')
  return fs.readdirSync(carpeta).filter((a) => /^\d{3}-.+\.sql$/.test(a)).sort()
    .map((nombre) => ({ nombre, sql: fs.readFileSync(path.join(carpeta, nombre), 'utf8') }))
}

async function migrar({ silencio = false } = {}) {
  await base.consulta('CREATE TABLE IF NOT EXISTS migraciones_hechas (nombre text PRIMARY KEY, instante bigint NOT NULL)')
  const hechas = new Set((await base.todas('SELECT nombre FROM migraciones_hechas')).map((f) => f.nombre))
  const nuevas = []
  for (const { nombre, sql } of leerMigraciones()) {
    if (hechas.has(nombre)) continue
    await base.transaccion(async (tx) => {
      await base.ejecutar(sql, tx)
      await base.consulta('INSERT INTO migraciones_hechas (nombre, instante) VALUES ($1, $2)', [nombre, ahora()], tx)
    })
    nuevas.push(nombre)
    if (!silencio) console.log('migración aplicada:', nombre)
  }
  return nuevas
}

module.exports = { migrar, leerMigraciones }
