'use strict'
/**
 * Errores con mensaje para la persona. Una ruta que tira un ErrorSek responde
 * con ese estado y ese texto; cualquier otro error responde 500 sin detalles.
 */
class ErrorSek extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje)
    this.estado = estado
  }
}

const noEncontrado = (que = 'Eso') => new ErrorSek(`${que} no existe.`, 404)
const sinSesion = () => new ErrorSek('Tenés que entrar primero.', 401)
const datoInvalido = (mensaje) => new ErrorSek(mensaje, 400)

/** Manejador para Fastify: respuesta { error: '...' }. */
function manejador(error, pedido, respuesta) {
  if (error instanceof ErrorSek) return respuesta.code(error.estado).send({ error: error.message })
  if (error.validation) return respuesta.code(400).send({ error: 'Faltan datos o están mal: ' + error.message })
  pedido.log.error(error)
  return respuesta.code(500).send({ error: 'Algo falló en el servidor.' })
}

module.exports = { ErrorSek, noEncontrado, sinSesion, datoInvalido, manejador }
