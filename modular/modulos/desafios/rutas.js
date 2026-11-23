'use strict'
/** Direcciones web del módulo desafios. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const motivo = { type: 'string', enum: ['tension', 'caida', 'rival'] }

module.exports = async function rutasDesafios(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const u = (pedido) => pedido.usuario.id

  // Pantallas
  app.get('/desafios', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'desafios', 'desafios.html'))
  app.get('/desafios/321', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'desafios', '321.html'))
  // Tensión y «No cumplí» como pantalla propia (para un enlace desde Hoy): hacen todo y vuelven a ?volver=
  app.get('/desafios/tension', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'desafios', 'accion.html'))
  app.get('/desafios/no-cumpli', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'desafios', 'accion.html'))

  // Resumen y configuración
  app.get('/api/desafios', conUsuario, async (pedido) => v.resumen(u(pedido)))
  app.get('/api/desafios/hoy', conUsuario, async (pedido) => v.pendientes(u(pedido)))
  app.put('/api/desafios/config', { ...conUsuario, schema: { body: { type: 'object' } } }, async (pedido) => {
    await v.cambiarConfig(u(pedido), pedido.body)
    return v.resumen(u(pedido))
  })

  // Al llegar a una pantalla (Hoy) y al irse
  app.post('/api/desafios/llegada', {
    ...conUsuario,
    schema: { body: { type: 'object', properties: { pilarPendiente: { type: 'boolean' }, pasoDejoCelu: { type: 'boolean' }, modoSueno: { type: 'boolean' } } } },
  }, async (pedido) => v.llegada(u(pedido), pedido.body || {}))
  app.post('/api/desafios/vista', conUsuario, async (pedido) => { await v.vista(u(pedido)); return { ok: true } })

  // Duelo de flexiones
  app.get('/api/desafios/duelo/:motivo', { ...conUsuario, schema: { params: { type: 'object', properties: { motivo } } } },
    async (pedido) => v.configDuelo(u(pedido), pedido.params.motivo))
  app.post('/api/desafios/duelo', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['motivo'], properties: { motivo, reps: { type: 'integer', minimum: 1, maximum: 500 } } } },
  }, async (pedido) => v.anotarDuelo(u(pedido), pedido.body.motivo, pedido.body.reps ?? null))

  // Caídas: «No cumplí» y Tensión sin dar la mano
  app.post('/api/desafios/no-cumpli', {
    ...conUsuario, schema: { body: { type: 'object', properties: { fecha: { type: 'string' } } } },
  }, async (pedido) => v.noCumpli(u(pedido), (pedido.body && pedido.body.fecha) || null))
  app.post('/api/desafios/tension/soltar', conUsuario, async (pedido) => v.tensionSoltar(u(pedido)))
  app.delete('/api/desafios/caidas/:id', conUsuario, async (pedido) => ({ ok: await v.deshacerCaida(u(pedido), pedido.params.id) }))

  // 3·2·1
  app.get('/api/desafios/inicios', conUsuario, async (pedido) => ({ inicios: await v.iniciosRecientes(u(pedido)) }))
  app.post('/api/desafios/inicios', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['accion'], properties: { id: { type: 'integer' }, accion: { type: 'string' }, tareaAmbigua: { type: 'string' }, compromisoId: { type: 'string' } } } },
  }, async (pedido) => v.registrarInicio(u(pedido), pedido.body))
  app.put('/api/desafios/inicios/:id', {
    ...conUsuario,
    schema: { params: { type: 'object', properties: { id: { type: 'integer' } } }, body: { type: 'object', required: ['resultado'], properties: { resultado: { type: 'string' } } } },
  }, async (pedido) => v.cerrarInicio(u(pedido), pedido.params.id, pedido.body.resultado))
}
