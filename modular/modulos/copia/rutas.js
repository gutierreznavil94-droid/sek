'use strict'
/** Direcciones web del módulo copia. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')
const { fechaDe } = require('../../comun/fechas')
const { obtenerAjustes } = require('../../comun/ajustes')

// Una copia con fotos o temas propios puede pesar varios MB (Fastify deja 1 MB si no se dice).
const LIMITE_COPIA = 80 * 1024 * 1024

module.exports = async function rutasCopia(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const conTexto = {
    ...conUsuario,
    bodyLimit: LIMITE_COPIA,
    schema: { body: { type: 'object', required: ['texto'], properties: { texto: { type: 'string' } } } },
  }

  app.get('/mas/copia', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'copia', 'copia.html'))

  app.get('/api/copia', conUsuario, async (pedido) => v.estado(pedido.usuario.id))
  app.post('/api/copia/revisar', conTexto, async (pedido) => v.revisar(pedido.usuario.id, pedido.body.texto))
  app.post('/api/copia/importar', conTexto, async (pedido) => v.importar(pedido.usuario.id, pedido.body.texto))

  // ?descargar=1 → baja como archivo sek-AAAA-MM-DD.json; sin eso, el JSON para «Copiar como texto».
  app.get('/api/copia/exportar', conUsuario, async (pedido, respuesta) => {
    const copia = await v.exportar(pedido.usuario.id)
    if (pedido.query && pedido.query.descargar) {
      const fecha = fechaDe(copia.exportado, (await obtenerAjustes(pedido.usuario.id)).zonaHoraria)
      respuesta.header('Content-Disposition', `attachment; filename="sek-${fecha}.json"`)
    }
    return copia
  })
}
