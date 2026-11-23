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
const xp = require('./modulos/xp/rutas')
const organizacion = require('./modulos/organizacion/rutas')
const ciclo = require('./modulos/ciclo/rutas')
const cicloVentanilla = require('./modulos/ciclo/ventanilla')
const dia = require('./modulos/dia/rutas')
const diaVentanilla = require('./modulos/dia/ventanilla')

// Datos iniciales de cada cuenta nueva (una sola vez, al cargar app.js).
sesion.alCrearCuenta.push((usuarioId) => cicloVentanilla.sembrar(usuarioId))
const sueno = require('./modulos/sueno/rutas')
const habitos = require('./modulos/habitos/rutas')
const habitosVentanilla = require('./modulos/habitos/ventanilla')

// Datos iniciales al crear una cuenta
sesion.alCrearCuenta.push((id) => habitosVentanilla.sembrar(id))
const comida = require('./modulos/comida/rutas')
const comidaVentanilla = require('./modulos/comida/ventanilla')
const temas = require('./modulos/temas/rutas')
const entreno = require('./modulos/entreno/rutas')
const desafios = require('./modulos/desafios/rutas')
const entrenoVentanilla = require('./modulos/entreno/ventanilla')
const progreso = require('./modulos/progreso/rutas')
const copia = require('./modulos/copia/rutas')

// Datos iniciales al crear una cuenta.
sesion.alCrearCuenta.push((id) => entrenoVentanilla.sembrar(id))
sesion.alCrearCuenta.push((usuarioId) => diaVentanilla.sembrar(usuarioId))

// dia escucha los avisos de ciclo, sueno y entreno (pilares) y usa lo que le conectan los módulos que llegan después.
diaVentanilla.conectar({ planComida: comidaVentanilla.planDelDia, faltantesSeries: entrenoVentanilla.faltantesDelDia })
diaVentanilla.escucharAvisos()
// Los feriados (dia) usan el límite de juego de finde. juego no requiere dia: se lo conecta acá.
require('./modulos/juego/ventanilla').conectar({ esFeriado: diaVentanilla.esFeriado })
// Cuando llegue desafios: diaVentanilla.conectar({ desafiosHoy: desafiosVentanilla.pendientes }) (botones Tensión y No cumplí de Hoy).

/** Modo sueño: ninguna pantalla se ve (salvo la del modo); manda a /sueno/modo. La regla está en dia (tablero.js). */
async function bloqueoSueno(pedido, respuesta) {
  if (pedido.method !== 'GET' || !diaVentanilla.esPaginaBloqueable(pedido.url)) return
  const usuario = await sesion.usuarioDeToken(sesion.leerCookie(pedido))
  if (usuario && await diaVentanilla.enModoSueno(usuario.id)) return respuesta.redirect('/sueno/modo')
}

function crearApp(opciones = {}) {
  const app = Fastify({ logger: opciones.logger ?? { level: 'info' } })
  app.setErrorHandler(errores.manejador)
  app.addHook('preHandler', bloqueoSueno)

  // Lo común
  app.register(servir.rutas)
  app.register(sesion.rutas)
  app.get('/', async (pedido, respuesta) => respuesta.redirect('/hoy'))
  app.get('/entrar', async (pedido, respuesta) => servir.paginaComun(respuesta, 'entrar.html'))

  // Módulos
  app.register(juego)
  app.register(cuentas)
  app.register(xp)
  app.register(organizacion)
  app.register(ciclo)
  app.register(sueno)
  app.register(habitos)
  app.register(comida)
  app.register(temas)
  app.register(entreno)
  app.register(dia)
  app.register(desafios)
  app.register(progreso)
  app.register(copia)

  return app
}

module.exports = { crearApp }

if (require.main === module) {
  const { migrar } = require('./comun/migrar')
  migrar()
    .then(() => crearApp().listen({ port: config.puerto, host: config.host }))
    .catch((e) => { console.error(e); process.exit(1) })
}
