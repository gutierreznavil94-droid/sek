'use strict'
/** Direcciones web del módulo cuentas (pantalla Más). Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario, leerCookie } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')
const historial = require('../../comun/historial')

module.exports = async function rutasCuentas(app) {
  const conUsuario = { preHandler: requiereUsuario }

  app.get('/mas', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'mas.html'))
  app.get('/mas/ajustes', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'ajustes.html'))
  app.get('/mas/historial', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'historial.html'))

  // Historial de cambios (lo que anotan todos los módulos con comun/historial.js). Solo lectura.
  app.get('/api/cuentas/historial', { ...conUsuario, schema: { querystring: { type: 'object', properties: { limite: { type: 'integer', minimum: 1, maximum: 1000 } } } } },
    async (pedido) => ({ total: await historial.contar(pedido.usuario.id), eventos: await historial.ultimos(pedido.usuario.id, pedido.query.limite || 60) }))

  app.get('/api/cuentas', conUsuario, async (pedido) => ({
    usuario: pedido.usuario,
    ajustes: await v.ajustes(pedido.usuario.id),
    zonas: v.ZONAS,
  }))
  app.put('/api/cuentas/ajustes', { ...conUsuario, schema: { body: { type: 'object' } } },
    async (pedido) => ({ ajustes: await v.guardar(pedido.usuario.id, pedido.body) }))
  app.post('/api/cuentas/clave', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['actual', 'nueva'], properties: { actual: { type: 'string' }, nueva: { type: 'string' }, repetir: { type: 'string' } } } },
  }, async (pedido) => {
    await v.cambiarClave(pedido.usuario.id, pedido.body, leerCookie(pedido))
    return { ok: true }
  })
}
