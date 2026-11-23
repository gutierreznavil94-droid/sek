'use strict'
/** Direcciones web del módulo juego. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

module.exports = async function rutasJuego(app) {
  const conUsuario = { preHandler: requiereUsuario }

  app.get('/juego', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'juego', 'juego.html'))

  app.get('/api/juego', conUsuario, async (pedido) => v.resumen(pedido.usuario.id))
  app.get('/api/juego/historial', conUsuario, async (pedido) => ({ sesiones: await v.historial(pedido.usuario.id) }))
  app.post('/api/juego/empezar', conUsuario, async (pedido) => { await v.empezar(pedido.usuario.id); return v.resumen(pedido.usuario.id) })
  app.post('/api/juego/pausar', conUsuario, async (pedido) => { await v.pausar(pedido.usuario.id); return v.resumen(pedido.usuario.id) })
  app.post('/api/juego/seguir', conUsuario, async (pedido) => { await v.seguir(pedido.usuario.id); return v.resumen(pedido.usuario.id) })
  app.post('/api/juego/terminar', conUsuario, async (pedido) => {
    await v.terminar(pedido.usuario.id, (pedido.body && pedido.body.nota) || null)
    return v.resumen(pedido.usuario.id)
  })
  app.post('/api/juego/manual', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['inicio', 'fin'], properties: { inicio: { type: 'number' }, fin: { type: 'number' }, nota: { type: 'string' } } } },
  }, async (pedido) => {
    await v.agregarManual(pedido.usuario.id, pedido.body)
    return v.resumen(pedido.usuario.id)
  })
  app.delete('/api/juego/sesiones/:id', conUsuario, async (pedido) => {
    await v.borrar(pedido.usuario.id, Number(pedido.params.id), 'Borrada desde Juego')
    return v.resumen(pedido.usuario.id)
  })
}
