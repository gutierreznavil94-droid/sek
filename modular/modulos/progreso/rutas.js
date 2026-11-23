'use strict'
/** Direcciones web del módulo progreso. Solo GET: progreso nunca cambia nada. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

module.exports = async function rutasProgreso(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const u = (pedido) => pedido.usuario.id

  // Pantallas
  app.get('/progreso', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'progreso', 'progreso.html'))
  app.get('/progreso/seccion', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'progreso', 'seccion.html'))
  app.get('/progreso/fase', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'progreso', 'fase.html'))

  // Datos
  app.get('/api/progreso', conUsuario, async (pedido) => v.resumen(u(pedido)))
  app.get('/api/progreso/xp', {
    ...conUsuario, schema: { querystring: { type: 'object', properties: { rango: { type: 'string', enum: v.RANGOS } } } },
  }, async (pedido) => v.xpEnRango(u(pedido), pedido.query.rango || 'semana'))
  app.get('/api/progreso/pilares', conUsuario, async (pedido) => v.pilares(u(pedido)))
  app.get('/api/progreso/sueno', conUsuario, async (pedido) => v.suenoProgreso(u(pedido)))
  app.get('/api/progreso/fuerza', conUsuario, async (pedido) => v.fuerza(u(pedido)))
  app.get('/api/progreso/fuerza/:bloqueId', {
    ...conUsuario, schema: { params: { type: 'object', properties: { bloqueId: { type: 'string', maxLength: 100 } } } },
  }, async (pedido) => v.ejercicio(u(pedido), pedido.params.bloqueId))
  app.get('/api/progreso/comida', conUsuario, async (pedido) => v.comida(u(pedido)))
  app.get('/api/progreso/series', conUsuario, async (pedido) => v.series(u(pedido)))
  app.get('/api/progreso/fase/:numero', {
    ...conUsuario, schema: { params: { type: 'object', properties: { numero: { type: 'integer', minimum: 1 } } } },
  }, async (pedido) => v.cierreFase(u(pedido), pedido.params.numero))
}
