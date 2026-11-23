'use strict'
/** Direcciones web del módulo habitos. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const conId = { params: { type: 'object', properties: { id: { type: 'string', maxLength: 64 } } } }

module.exports = async function rutasHabitos(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const yo = (pedido) => pedido.usuario.id

  // Pantallas
  app.get('/habitos', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'habitos', 'habitos.html'))
  app.get('/habitos/fotos', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'habitos', 'fotos.html'))

  // Resúmenes
  app.get('/api/habitos', conUsuario, async (pedido) => v.resumen(yo(pedido)))
  app.get('/api/habitos/hoy', conUsuario, async (pedido) => v.resumenHoy(yo(pedido)))
  app.get('/api/habitos/kanjis', {
    ...conUsuario, schema: { querystring: { type: 'object', properties: { nombre: { type: 'string', maxLength: 80 } } } },
  }, async (pedido) => ({ kanjis: v.kanjiSugeridos(pedido.query.nombre || '') }))
  app.post('/api/habitos/config', {
    ...conUsuario,
    schema: { body: { type: 'object', properties: {
      forja: { type: 'object', properties: { dias: { type: 'number' }, validos: { type: 'number' }, xpDia: { type: 'number' }, xpForjado: { type: 'number' }, maximo: { type: 'number' } } },
      caidaXp: { type: 'number' },
    } } },
  }, async (pedido) => { await v.cambiarConfig(yo(pedido), pedido.body || {}); return v.resumen(yo(pedido)) })

  // Forja
  app.post('/api/habitos/forja', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['nombre', 'kanji'], properties: { nombre: { type: 'string', maxLength: 80 }, kanji: { type: 'string', maxLength: 8 } } } },
  }, async (pedido) => { const habito = await v.crearHabito(yo(pedido), pedido.body); return { habito, resumen: await v.resumen(yo(pedido)) } })
  app.post('/api/habitos/forja/:id/tocar', { ...conUsuario, schema: conId }, async (pedido) => {
    const resultado = await v.alternarDia(yo(pedido), pedido.params.id)
    return { resultado, resumen: await v.resumen(yo(pedido)) }
  })
  app.post('/api/habitos/forja/:id/abandonar', { ...conUsuario, schema: conId }, async (pedido) => {
    await v.abandonarHabito(yo(pedido), pedido.params.id)
    return v.resumen(yo(pedido))
  })
  app.put('/api/habitos/forja/:id', {
    ...conUsuario,
    schema: { ...conId, body: { type: 'object', properties: { nombre: { type: 'string', maxLength: 80 }, kanji: { type: 'string', maxLength: 8 } } } },
  }, async (pedido) => { await v.editarHabito(yo(pedido), pedido.params.id, pedido.body || {}); return v.resumen(yo(pedido)) })

  // Mi código
  const regla = { type: 'object', properties: { texto: { type: 'string', maxLength: 300 }, grupo: { type: 'string' }, momento: { type: 'string' } } }
  app.post('/api/habitos/codigo', { ...conUsuario, schema: { body: { ...regla, required: ['texto', 'grupo'] } } }, async (pedido) => {
    const r = await v.agregarRegla(yo(pedido), pedido.body)
    return { regla: r, resumen: await v.resumen(yo(pedido)) }
  })
  app.put('/api/habitos/codigo/:id', { ...conUsuario, schema: { ...conId, body: regla } }, async (pedido) => {
    await v.editarRegla(yo(pedido), pedido.params.id, pedido.body || {})
    return v.resumen(yo(pedido))
  })
  app.delete('/api/habitos/codigo/:id', { ...conUsuario, schema: conId }, async (pedido) => {
    await v.borrarRegla(yo(pedido), pedido.params.id)
    return v.resumen(yo(pedido))
  })
  app.post('/api/habitos/codigo/:id/mover', {
    ...conUsuario,
    schema: { ...conId, body: { type: 'object', required: ['dir'], properties: { dir: { type: 'integer', enum: [-1, 1] }, vista: { type: 'string', enum: ['area', 'momento'] } } } },
  }, async (pedido) => {
    await v.moverRegla(yo(pedido), pedido.params.id, pedido.body.dir, pedido.body.vista || 'area')
    return v.resumen(yo(pedido))
  })

  // Caídas
  app.get('/api/habitos/caidas', {
    ...conUsuario, schema: { querystring: { type: 'object', required: ['desde', 'hasta'], properties: { desde: FECHA, hasta: FECHA } } },
  }, async (pedido) => ({ porDia: await v.caidasPorDia(yo(pedido), pedido.query.desde, pedido.query.hasta) }))
  app.post('/api/habitos/caidas', {
    ...conUsuario, schema: { body: { type: 'object', properties: { origen: { type: 'string', enum: ['boton', 'tension'] } } } },
  }, async (pedido) => {
    const caida = await v.registrarCaida(yo(pedido), { origen: (pedido.body && pedido.body.origen) || 'boton' })
    return { caida, resumen: await v.resumen(yo(pedido)) }
  })
  app.post('/api/habitos/caidas/:id/deshacer', { ...conUsuario, schema: conId }, async (pedido) => {
    const deshecha = await v.deshacerCaida(yo(pedido), pedido.params.id)
    return { deshecha, resumen: await v.resumen(yo(pedido)) }
  })

  // Fotos y días marcados
  const fotosYMarcas = async (id) => ({ fotos: await v.listarFotos(id), marcas: await v.listarMarcas(id) })
  app.get('/api/habitos/fotos', conUsuario, async (pedido) => fotosYMarcas(yo(pedido)))
  app.get('/api/habitos/fotos/:id/imagen', { ...conUsuario, schema: conId }, async (pedido, respuesta) => {
    const url = await v.imagenFoto(yo(pedido), pedido.params.id)
    const [cabeza, base64] = url.split(',')
    respuesta.header('Cache-Control', 'private, max-age=31536000, immutable')
    return respuesta.type(cabeza.slice(5, cabeza.indexOf(';'))).send(Buffer.from(base64, 'base64'))
  })
  app.post('/api/habitos/fotos', {
    ...conUsuario,
    bodyLimit: 5 * 1024 * 1024,
    schema: { body: { type: 'object', required: ['imagen'], properties: { imagen: { type: 'string' }, dia: { type: 'integer' } } } },
  }, async (pedido) => { const foto = await v.agregarFoto(yo(pedido), pedido.body); return { foto, ...(await fotosYMarcas(yo(pedido))) } })
  app.delete('/api/habitos/fotos/:id', { ...conUsuario, schema: conId }, async (pedido) => {
    await v.borrarFoto(yo(pedido), pedido.params.id)
    return fotosYMarcas(yo(pedido))
  })
  app.put('/api/habitos/marcas/:fecha', {
    ...conUsuario,
    schema: { params: { type: 'object', properties: { fecha: FECHA } }, body: { type: 'object', required: ['texto'], properties: { texto: { type: 'string', maxLength: 80 } } } },
  }, async (pedido) => { await v.marcarDia(yo(pedido), pedido.params.fecha, pedido.body.texto); return fotosYMarcas(yo(pedido)) })
  app.delete('/api/habitos/marcas/:fecha', {
    ...conUsuario, schema: { params: { type: 'object', properties: { fecha: FECHA } } },
  }, async (pedido) => { await v.quitarMarca(yo(pedido), pedido.params.fecha); return fotosYMarcas(yo(pedido)) })
}
