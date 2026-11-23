'use strict'
/** Consultas SQL del módulo sueno. Solo las usa ventanilla.js. Tablas: suenio, modo_suenio. */
const { una, todas, consulta } = require('../../comun/base')

// Columna de la base ↔ campo en JavaScript.
const CAMPOS = {
  noche: 'noche', horaPrevista: 'hora_prevista', horaReal: 'hora_real', retrasoMinutos: 'retraso_minutos', cumplido: 'cumplido',
  sinDejoCelu: 'sin_dejo_celu', nota: 'nota', creado: 'creado', acostadoManual: 'acostado_manual', dormido: 'dormido',
  latenciaMinutos: 'latencia_minutos', despertarPrevisto: 'despertar_previsto', levantado: 'levantado', despertares: 'despertares',
  minutosDormido: 'minutos_dormido', fuenteAcostado: 'fuente_acostado', fuenteDormido: 'fuente_dormido', fuenteLevantado: 'fuente_levantado',
  etapas: 'etapas', aperturas: 'aperturas',
}
const COLUMNAS = 'id, ' + Object.entries(CAMPOS).map(([js, col]) => (js === col ? col : `${col} AS "${js}"`)).join(', ')
// Al pisar una noche entera, lo que no viene vuelve a su valor inicial.
const INICIAL = { retrasoMinutos: 0, cumplido: false, sinDejoCelu: false, aperturas: 0 }

/** Saca los null (en JavaScript, «no está»). */
function limpio(f) {
  if (!f) return null
  const r = {}
  for (const [k, v] of Object.entries(f)) if (v !== null) r[k] = v
  return r
}

const valor = (k, v) => (k === 'etapas' && v != null ? JSON.stringify(v) : v === undefined ? null : v)

const deNoche = async (usuarioId, noche, tx) =>
  limpio(await una(`SELECT ${COLUMNAS} FROM suenio WHERE usuario_id = $1 AND noche = $2`, [usuarioId, noche], tx))

const entre = async (usuarioId, desde, hasta, tx) =>
  (await todas(`SELECT ${COLUMNAS} FROM suenio WHERE usuario_id = $1 AND noche BETWEEN $2 AND $3 ORDER BY noche`, [usuarioId, desde, hasta], tx)).map(limpio)

/** Las noches cumplidas hasta una fecha (para la racha). */
const cumplidasHasta = async (usuarioId, hasta, tx) =>
  (await todas('SELECT noche FROM suenio WHERE usuario_id = $1 AND cumplido AND noche <= $2 ORDER BY noche DESC LIMIT 400', [usuarioId, hasta], tx))
    .map((f) => ({ noche: f.noche, cumplido: true }))

async function primeraNoche(usuarioId, tx) {
  const f = await una('SELECT min(noche) AS noche FROM suenio WHERE usuario_id = $1', [usuarioId], tx)
  return f ? f.noche : null
}

/** Cambia algunos campos de una noche. `null` borra el dato. */
async function cambiar(usuarioId, noche, cambios, tx) {
  const ks = Object.keys(cambios).filter((k) => k in CAMPOS && k !== 'noche')
  if (!ks.length) return deNoche(usuarioId, noche, tx)
  const set = ks.map((k, i) => `${CAMPOS[k]} = $${i + 3}`)
  return limpio(await una(`UPDATE suenio SET ${set.join(', ')} WHERE usuario_id = $1 AND noche = $2 RETURNING ${COLUMNAS}`,
    [usuarioId, noche, ...ks.map((k) => valor(k, cambios[k]))], tx))
}

/** Crea la noche. Si ya existía, la pisa entera (como el `update` de la app vieja). */
async function guardar(usuarioId, reg, tx) {
  const ya = await una('SELECT id FROM suenio WHERE usuario_id = $1 AND noche = $2', [usuarioId, reg.noche], tx)
  if (ya) {
    const vacio = Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, k in INICIAL ? INICIAL[k] : null]))
    return cambiar(usuarioId, reg.noche, { ...vacio, ...reg }, tx)
  }
  const ks = Object.keys(CAMPOS).filter((k) => reg[k] !== undefined)
  const ph = ks.map((_, i) => `$${i + 2}`)
  return limpio(await una(`INSERT INTO suenio (usuario_id, ${ks.map((k) => CAMPOS[k]).join(', ')}) VALUES ($1, ${ph.join(', ')}) RETURNING ${COLUMNAS}`,
    [usuarioId, ...ks.map((k) => valor(k, reg[k]))], tx))
}

const borrar = (usuarioId, noche, tx) => consulta('DELETE FROM suenio WHERE usuario_id = $1 AND noche = $2', [usuarioId, noche], tx)

// ---------- modo_suenio ----------

const COLUMNAS_MODO = 'noche, inicio, hasta, tarde, resumen, aperturas'

const modo = (usuarioId, tx) => una(`SELECT ${COLUMNAS_MODO} FROM modo_suenio WHERE usuario_id = $1`, [usuarioId], tx)

const quitarModo = (usuarioId, tx) => consulta('DELETE FROM modo_suenio WHERE usuario_id = $1', [usuarioId], tx)

/** Prende el modo sueño (si había uno, lo reemplaza). */
async function ponerModo(usuarioId, m, tx) {
  await quitarModo(usuarioId, tx)
  return una(`INSERT INTO modo_suenio (usuario_id, noche, inicio, hasta, tarde, resumen, aperturas) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNAS_MODO}`,
    [usuarioId, m.noche, m.inicio, m.hasta, m.tarde, m.resumen || '', JSON.stringify(m.aperturas || [])], tx)
}

const aperturasModo = (usuarioId, aperturas, tx) =>
  consulta('UPDATE modo_suenio SET aperturas = $2 WHERE usuario_id = $1', [usuarioId, JSON.stringify(aperturas)], tx)

module.exports = { deNoche, entre, cumplidasHasta, primeraNoche, guardar, cambiar, borrar, modo, ponerModo, aperturasModo, quitarModo }
