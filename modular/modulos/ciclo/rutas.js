'use strict'
/** Direcciones web del módulo ciclo. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const TEXTO = (max) => ({ type: 'string', maxLength: max })
const conId = { type: 'object', properties: { id: { type: 'string', maxLength: 100 } } }

module.exports = async function rutasCiclo(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const u = (pedido) => pedido.usuario.id
  const cuerpo = (props, required = []) => ({ ...conUsuario, schema: { body: { type: 'object', required, properties: props } } })
  const cuerpoConId = (props, required = []) => ({ ...conUsuario, schema: { params: conId, body: { type: 'object', required, properties: props } } })

  // Pantallas
  app.get('/ciclo', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'ciclo', 'ciclo.html'))
  app.get('/ciclo/metas', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'ciclo', 'metas.html'))
  app.get('/ciclo/identidad', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'ciclo', 'identidad.html'))
  app.get('/ciclo/revision', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'ciclo', 'revision.html'))

  // Ciclo y fases
  app.get('/api/ciclo', conUsuario, async (pedido) => v.resumen(u(pedido)))
  app.get('/api/ciclo/dia', {
    ...conUsuario, schema: { querystring: { type: 'object', properties: { fecha: FECHA } } },
  }, async (pedido) => ({ dia: await v.diaDelCiclo(u(pedido), pedido.query.fecha || null) }))
  app.post('/api/ciclo/iniciar', cuerpo({ inicio: FECHA, duracionDias: { type: 'integer' }, diasPorFase: { type: 'integer' }, diaCero: { type: 'boolean' } }, ['inicio']), async (pedido) => {
    await v.iniciarCiclo(u(pedido), pedido.body)
    return v.resumen(u(pedido))
  })
  app.post('/api/ciclo/inicio', cuerpo({ inicio: FECHA }, ['inicio']), async (pedido) => {
    await v.cambiarInicio(u(pedido), pedido.body.inicio)
    return v.resumen(u(pedido))
  })
  app.put('/api/ciclo/fases/:id', cuerpoConId({ foco: TEXTO(200), queSeMide: TEXTO(2000) }, ['foco']), async (pedido) => {
    await v.editarFase(u(pedido), pedido.params.id, pedido.body)
    return v.resumen(u(pedido))
  })
  app.post('/api/ciclo/fases/:id/cerrar', cuerpoConId({ notas: TEXTO(4000), resultados: { type: 'object', additionalProperties: TEXTO(500) } }), async (pedido) => {
    const r = await v.cerrarFase(u(pedido), pedido.params.id, pedido.body || {})
    return { ...(await v.resumen(u(pedido))), cerrada: r }
  })

  // Objetivos
  const OBJ = { titulo: TEXTO(200), indicador: TEXTO(300), atributoId: TEXTO(100), faseNumero: { type: 'integer' }, lineaBase: TEXTO(100), meta: TEXTO(100), resultado: TEXTO(500) }
  app.post('/api/ciclo/objetivos', cuerpo(OBJ, ['titulo', 'indicador', 'atributoId', 'faseNumero']), async (pedido) => {
    await v.guardarObjetivo(u(pedido), pedido.body)
    return v.resumen(u(pedido))
  })
  app.put('/api/ciclo/objetivos/:id', cuerpoConId(OBJ, ['titulo', 'indicador', 'atributoId']), async (pedido) => {
    await v.guardarObjetivo(u(pedido), { ...pedido.body, id: pedido.params.id })
    return v.resumen(u(pedido))
  })
  app.delete('/api/ciclo/objetivos/:id', { ...conUsuario, schema: { params: conId } }, async (pedido) => {
    await v.archivarObjetivo(u(pedido), pedido.params.id)
    return v.resumen(u(pedido))
  })

  // Atributos e identidad
  const ATR = { nombre: TEXTO(100), descripcion: TEXTO(300), ventanaDias: { type: 'integer' } }
  app.post('/api/ciclo/atributos', cuerpo(ATR, ['nombre']), async (pedido) => {
    await v.guardarAtributo(u(pedido), pedido.body)
    return v.resumen(u(pedido))
  })
  app.put('/api/ciclo/atributos/:id', cuerpoConId(ATR, ['nombre']), async (pedido) => {
    await v.guardarAtributo(u(pedido), { ...pedido.body, id: pedido.params.id })
    return v.resumen(u(pedido))
  })
  app.delete('/api/ciclo/atributos/:id', { ...conUsuario, schema: { params: conId } }, async (pedido) => {
    await v.archivarAtributo(u(pedido), pedido.params.id)
    return v.resumen(u(pedido))
  })
  app.put('/api/ciclo/identidad', cuerpo({ vision: TEXTO(4000), obstaculos: TEXTO(4000) }, ['vision']), async (pedido) => {
    await v.guardarIdentidad(u(pedido), pedido.body)
    return v.resumen(u(pedido))
  })

  // Metas con fecha
  const metas = async (pedido) => v.resumenMetas(u(pedido))
  app.get('/api/ciclo/metas', conUsuario, metas)
  app.post('/api/ciclo/metas', cuerpo({ titulo: TEXTO(200), fecha: FECHA, xp: { type: 'integer', minimum: 0, maximum: 1000 }, nota: TEXTO(500) }, ['titulo', 'fecha']), async (pedido) => {
    await v.crearMeta(u(pedido), pedido.body)
    return metas(pedido)
  })
  app.put('/api/ciclo/metas/:id', cuerpoConId({ titulo: TEXTO(200), fecha: FECHA, xp: { type: 'integer', minimum: 0, maximum: 1000 }, nota: TEXTO(500) }), async (pedido) => {
    await v.editarMeta(u(pedido), pedido.params.id, pedido.body || {})
    return metas(pedido)
  })
  app.post('/api/ciclo/metas/:id/resolver', cuerpoConId({ lograda: { type: 'boolean' }, motivo: TEXTO(200) }, ['lograda']), async (pedido) => {
    const r = await v.resolverMeta(u(pedido), pedido.params.id, pedido.body.lograda, pedido.body.motivo || '')
    return { ...(await metas(pedido)), resultado: { xp: r.xp, nuevoNivel: r.nuevoNivel, conTope: r.conTope } }
  })
  app.post('/api/ciclo/metas/:id/reabrir', { ...conUsuario, schema: { params: conId } }, async (pedido) => {
    await v.reabrirMeta(u(pedido), pedido.params.id, 'Desmarcada')
    return metas(pedido)
  })
  app.delete('/api/ciclo/metas/:id', { ...conUsuario, schema: { params: conId } }, async (pedido) => {
    await v.borrarMeta(u(pedido), pedido.params.id)
    return metas(pedido)
  })

  // Revisiones
  const TIPO = { type: 'string', enum: ['diaria', 'semanal'] }
  app.get('/api/ciclo/revision', {
    ...conUsuario, schema: { querystring: { type: 'object', required: ['tipo'], properties: { tipo: TIPO, fecha: FECHA } } },
  }, async (pedido) => v.datosRevision(u(pedido), pedido.query.tipo, pedido.query.fecha || null))
  app.post('/api/ciclo/revision', cuerpo({ tipo: TIPO, periodo: FECHA, respuestas: { type: 'object', additionalProperties: TEXTO(1000) }, foto: { type: 'object' } }, ['tipo', 'periodo']), async (pedido) => {
    const b = pedido.body
    const foto = b.foto || await v.fotoRevision(u(pedido), b.tipo, b.periodo)
    return v.guardarRevision(u(pedido), b.tipo, b.periodo, b.respuestas || {}, foto)
  })
}
