'use strict'
/** Direcciones web del módulo cuentas (pantalla Más). Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario, leerCookie } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

module.exports = async function rutasCuentas(app) {
  const conUsuario = { preHandler: requiereUsuario }

  app.get('/mas', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'mas.html'))
  app.get('/mas/ajustes', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'ajustes.html'))
  app.get('/mas/nombres', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'nombres.html'))
  app.get('/mas/cuenta', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'cuentas', 'cuenta.html'))

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
