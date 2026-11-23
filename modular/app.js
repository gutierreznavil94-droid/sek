'use strict'
/**
 * SEK · arranca el servidor y registra las rutas de cada módulo.
 * Para sumar un módulo: requerir su rutas.js y registrarlo abajo (y, si necesita datos al crear
 * una cuenta, anotar su función en sesion.alCrearCuenta).
 */
const Fastify = require('fastify')
const config = require('./comun/config')
const errores = require('./comun/errores')
const sesion = require('./comun/sesion')
const servir = require('./comun/pantalla/servir')

// Módulos
const juego = require('./modulos/juego/rutas')
const cuentas = require('./modulos/cuentas/rutas')

function crearApp(opciones = {}) {
  const app = Fastify({ logger: opciones.logger ?? { level: 'info' } })
  app.setErrorHandler(errores.manejador)

  // Lo común
  app.register(servir.rutas)
  app.register(sesion.rutas)
  app.get('/', async (pedido, respuesta) => respuesta.redirect('/hoy'))
  app.get('/entrar', async (pedido, respuesta) => servir.paginaComun(respuesta, 'entrar.html'))
  // Provisorio hasta que exista el módulo «dia».
  app.get('/hoy', { preHandler: sesion.requiereUsuario }, async (pedido, respuesta) => servir.paginaComun(respuesta, 'inicio.html'))

  // Módulos
  app.register(juego)
  app.register(cuentas)

  return app
}

module.exports = { crearApp }

if (require.main === module) {
  const { migrar } = require('./comun/migrar')
  migrar()
    .then(() => crearApp().listen({ port: config.puerto, host: config.host }))
    .catch((e) => { console.error(e); process.exit(1) })
}
