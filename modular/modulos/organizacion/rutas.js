'use strict'
/** Direcciones web del módulo organizacion. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const CELU = typeof SEK_CELU !== 'undefined' && SEK_CELU

module.exports = async function rutasOrganizacion(app) {
  const conUsuario = { preHandler: requiereUsuario }

  // La pantalla (?abrir=anotar o ?abrir=<id de frente> abre esa hoja al entrar).
  app.get('/organizacion', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'organizacion', 'organizacion.html'))

  // Las reglas son el mismo archivo en el servidor y en la pantalla.
  app.get('/m/organizacion/modelo.js', async (pedido, respuesta) => {
    respuesta.header('Content-Type', 'text/javascript; charset=utf-8')
    respuesta.header('Cache-Control', 'no-cache')
    // En el celu el archivo ya está en el paquete (www/m/organizacion/modelo.js).
    if (CELU) return respuesta.header('X-SEK-Archivo', 'm/organizacion/modelo.js').send('')
    return respuesta.send(require('node:fs').readFileSync(require('node:path').join(__dirname, 'modelo.js'), 'utf8'))
  })

  // El «almacén» de la pantalla: leer todo y guardar todo.
  app.get('/api/organizacion', conUsuario, async (pedido) => ({ ...(await v.leer(pedido.usuario.id)), nombre: pedido.usuario.nombre }))
  app.put('/api/organizacion', {
    ...conUsuario,
    bodyLimit: 5 * 1024 * 1024,
    schema: { body: { type: 'object', required: ['datos'], properties: { datos: { type: 'object' }, antes: { type: 'number' } } } },
  }, async (pedido) => v.guardar(pedido.usuario.id, pedido.body.datos, pedido.body.antes ?? null))
}
