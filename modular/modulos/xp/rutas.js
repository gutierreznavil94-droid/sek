'use strict'
/** Direcciones web del módulo xp. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

module.exports = async function rutasXp(app) {
  const conUsuario = { preHandler: requiereUsuario }

  app.get('/xp', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'xp', 'xp.html'))

  app.get('/api/xp', conUsuario, async (pedido) => v.resumen(pedido.usuario.id))
  app.get('/api/xp/estado', conUsuario, async (pedido) => v.estado(pedido.usuario.id))
  app.get('/api/xp/historial', {
    ...conUsuario,
    schema: { querystring: { type: 'object', properties: { antesDe: { type: 'integer' }, cantidad: { type: 'integer' } } } },
  }, async (pedido) => ({ movimientos: await v.historialXp(pedido.usuario.id, { antesDe: pedido.query.antesDe ?? null, cantidad: pedido.query.cantidad ?? 50 }) }))
  app.post('/api/xp/movimientos/:id/anular', {
    ...conUsuario,
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } }, body: { type: 'object', properties: { motivo: { type: 'string', maxLength: 200 } } } },
  }, async (pedido) => {
    await v.anularPorId(pedido.usuario.id, pedido.params.id, (pedido.body && pedido.body.motivo) || 'Anulado desde XP')
    return v.resumen(pedido.usuario.id)
  })
  app.post('/api/xp/resta', {
    ...conUsuario,
    schema: { body: { type: 'object', properties: { activa: { type: 'boolean' }, porcentaje: { type: 'number' } } } },
  }, async (pedido) => {
    await v.cambiarResta(pedido.usuario.id, pedido.body || {})
    return v.resumen(pedido.usuario.id)
  })
}
