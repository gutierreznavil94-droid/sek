'use strict'
/** Direcciones web del módulo temas. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

module.exports = async function rutasTemas(app) {
  v.conectar()
  const conUsuario = { preHandler: requiereUsuario }

  app.get('/temas', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'temas', 'temas.html'))

  // Lo que pide cada pantalla al abrirse (tema.js).
  app.get('/api/temas/activo', conUsuario, async (pedido) => v.activo(pedido.usuario.id))

  app.get('/api/temas', conUsuario, async (pedido) => v.lista(pedido.usuario.id))
  app.put('/api/temas/elegido', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 80 } } } },
  }, async (pedido) => v.elegir(pedido.usuario.id, pedido.body.id))
  app.put('/api/temas/lluvia', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['lluvia'], properties: { lluvia: { type: 'string' } } } },
  }, async (pedido) => ({ lluvia: await v.guardarLluvia(pedido.usuario.id, pedido.body.lluvia) }))

  // Temas subidos (.sektema)
  app.post('/api/temas/propios', {
    ...conUsuario,
    bodyLimit: v.MAX_ARCHIVO + 4096,
    schema: { body: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' } } } },
  }, async (pedido) => {
    const id = await v.subir(pedido.usuario.id, pedido.body.texto)
    return { id, ...(await v.lista(pedido.usuario.id)) }
  })
  app.delete('/api/temas/propios/:id', conUsuario, async (pedido) => {
    await v.borrarPropio(pedido.usuario.id, pedido.params.id)
    return v.lista(pedido.usuario.id)
  })
  app.get('/api/temas/propios/:id/archivo', conUsuario, async (pedido, respuesta) => {
    const a = await v.archivoDe(pedido.usuario.id, pedido.params.id)
    respuesta.header('Content-Type', 'application/json; charset=utf-8')
    respuesta.header('Content-Disposition', `attachment; filename="${a.nombreArchivo.replace(/[^a-z0-9.-]/gi, '')}"`)
    return respuesta.send(a.texto)
  })
  app.get('/api/temas/propios/:id/medio/:nombre', conUsuario, async (pedido, respuesta) => {
    const m = await v.medio(pedido.usuario.id, pedido.params.id, pedido.params.nombre)
    respuesta.header('Content-Type', m.tipo)
    respuesta.header('Cache-Control', 'private, max-age=300')
    return respuesta.send(m.bytes)
  })
}
