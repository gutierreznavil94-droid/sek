'use strict'
/** Historial de cambios: cada módulo anota lo importante (qué, cuándo, antes y después). */
const { consulta, todas } = require('./base')
const { ahora } = require('./reloj')

async function anotar(usuarioId, modulo, tipo, detalle = null, tx = null) {
  await consulta('INSERT INTO historial (usuario_id, modulo, tipo, detalle, instante) VALUES ($1, $2, $3, $4, $5)',
    [usuarioId, modulo, tipo, detalle, ahora()], tx)
}

async function ultimos(usuarioId, cantidad = 50, tx = null) {
  return todas('SELECT modulo, tipo, detalle, instante FROM historial WHERE usuario_id = $1 ORDER BY instante DESC, id DESC LIMIT $2',
    [usuarioId, cantidad], tx)
}

module.exports = { anotar, ultimos }
