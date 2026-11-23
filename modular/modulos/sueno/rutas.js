'use strict'
/** Direcciones web del módulo sueno. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const HORA = { type: 'string', pattern: '^\\d{2}:\\d{2}$' }
const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }

module.exports = async function rutasSueno(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const rango = (pedido) => (['semana', 'mes', 'todo'].includes(pedido.query && pedido.query.rango) ? pedido.query.rango : 'semana')

  // Pantallas
  app.get('/sueno', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'sueno', 'sueno.html'))
  app.get('/sueno/modo', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'sueno', 'modo.html'))

  // Datos
  app.get('/api/sueno', conUsuario, async (pedido) => v.resumen(pedido.usuario.id, { rango: rango(pedido) }))
  app.get('/api/sueno/hoy', conUsuario, async (pedido) => v.resumenHoy(pedido.usuario.id))

  app.post('/api/sueno/dejo-celu', conUsuario, async (pedido) => {
    const nota = pedido.body && typeof pedido.body.nota === 'string' ? pedido.body.nota.slice(0, 300) : null
    const r = await v.dejoCelu(pedido.usuario.id, { nota })
    return { cumplido: r.cumplido, retrasoMinutos: r.retrasoMinutos, xp: r.xp, nuevoNivel: r.nuevoNivel, noche: r.noche }
  })
  app.post('/api/sueno/deshacer', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['noche'], properties: { noche: FECHA } } },
  }, async (pedido) => {
    await v.deshacerDejoCelu(pedido.usuario.id, pedido.body.noche)
    return v.resumen(pedido.usuario.id)
  })

  // Modo sueño: la pantalla pregunta cómo está (y si ya es de mañana, lo cierra solo).
  app.get('/api/sueno/modo', conUsuario, async (pedido) => {
    const termino = await v.terminarModoSiCorresponde(pedido.usuario.id)
    const modo = await v.modoActivo(pedido.usuario.id)
    return { modo, buenosDias: termino ? { noche: termino.noche } : null, ajustes: await v.ajustesSueno(pedido.usuario.id) }
  })
  app.post('/api/sueno/modo/apertura', conUsuario, async (pedido) => ({ aperturas: await v.registrarApertura(pedido.usuario.id) }))
  app.post('/api/sueno/modo/salir', conUsuario, async (pedido) => {
    await v.salirModo(pedido.usuario.id, 'Salida a mano desde la pantalla de sueño')
    return { ok: true }
  })

  // Correcciones
  app.put('/api/sueno/noches/:noche', {
    ...conUsuario,
    schema: {
      params: { type: 'object', properties: { noche: FECHA } },
      body: { type: 'object', properties: { acostado: HORA, dormido: HORA, levantado: HORA, despertares: { type: ['integer', 'null'], minimum: 0, maximum: 3 } } },
    },
  }, async (pedido) => {
    await v.corregirNoche(pedido.usuario.id, pedido.params.noche, pedido.body || {})
    return v.resumen(pedido.usuario.id, { rango: rango(pedido) })
  })
  app.post('/api/sueno/noches/:noche/estimado', {
    ...conUsuario,
    schema: { params: { type: 'object', properties: { noche: FECHA } }, body: { type: 'object', required: ['campo'], properties: { campo: { enum: ['acostado', 'dormido', 'levantado'] } } } },
  }, async (pedido) => {
    await v.volverAEstimado(pedido.usuario.id, pedido.params.noche, pedido.body.campo)
    return v.resumen(pedido.usuario.id, { rango: rango(pedido) })
  })

  // Ajustes y adaptación
  app.put('/api/sueno/ajustes', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['horaDejarCelu', 'latenciaDormirseMinutos', 'horaFinSuenio', 'objetivoSuenioHoras'], properties: { horaDejarCelu: HORA, horaFinSuenio: HORA, latenciaDormirseMinutos: { type: 'number' }, objetivoSuenioHoras: { type: 'number' } } } },
  }, async (pedido) => {
    await v.guardarAjustesSueno(pedido.usuario.id, pedido.body)
    return v.resumen(pedido.usuario.id)
  })
  app.put('/api/sueno/adaptacion', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['etapas'], properties: { desde: { anyOf: [FECHA, { type: 'null' }] }, toleranciaMinutos: { type: 'number' }, etapas: { type: 'array', minItems: 1, maxItems: 6 } } } },
  }, async (pedido) => {
    await v.guardarAdaptacion(pedido.usuario.id, pedido.body)
    return v.resumen(pedido.usuario.id)
  })
  app.delete('/api/sueno/adaptacion', conUsuario, async (pedido) => {
    await v.guardarAdaptacion(pedido.usuario.id, null)
    return v.resumen(pedido.usuario.id)
  })
}
