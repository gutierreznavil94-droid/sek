'use strict'
/**
 * Aplica las migraciones de migraciones/ en orden (001-..., 002-...). Cada una corre una sola vez
 * y en su propia transacción. Uso: `npm run migrar`.
 */
const fs = require('node:fs')
const path = require('node:path')
const base = require('./base')

const CARPETA = path.join(__dirname, '..', 'migraciones')

async function migrar({ silencio = false } = {}) {
  await base.consulta('CREATE TABLE IF NOT EXISTS migraciones_hechas (nombre text PRIMARY KEY, instante bigint NOT NULL)')
  const hechas = new Set((await base.todas('SELECT nombre FROM migraciones_hechas')).map((f) => f.nombre))
  const archivos = fs.readdirSync(CARPETA).filter((a) => /^\d{3}-.+\.sql$/.test(a)).sort()
  const nuevas = []
  for (const a of archivos) {
    if (hechas.has(a)) continue
    const sql = fs.readFileSync(path.join(CARPETA, a), 'utf8')
    await base.transaccion(async (tx) => {
      await base.consulta(sql, [], tx)
      await base.consulta('INSERT INTO migraciones_hechas (nombre, instante) VALUES ($1, $2)', [a, Date.now()], tx)
    })
    nuevas.push(a)
    if (!silencio) console.log('migración aplicada:', a)
  }
  if (!silencio && !nuevas.length) console.log('la base ya estaba al día')
  return nuevas
}

module.exports = { migrar }

if (require.main === module) {
  migrar().then(() => base.cerrar()).catch((e) => { console.error(e.message); process.exit(1) })
}
