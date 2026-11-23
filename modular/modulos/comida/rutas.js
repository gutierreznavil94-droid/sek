'use strict'
/** Direcciones web del módulo comida. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const FRANJA = { type: 'string', enum: ['desayuno', 'almuerzo', 'merienda', 'cena', 'otro'] }
const cuerpo = (required, properties) => ({ schema: { body: { type: 'object', required, properties } } })

module.exports = async function rutasComida(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const id = (pedido) => pedido.usuario.id
  const fechaDe = (pedido) => (pedido.body && pedido.body.fecha) || (pedido.query && pedido.query.fecha) || null

  // Pantallas
  app.get('/comida', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'comida', 'comida.html'))
  app.get('/comida/ajustes', conUsuario, async (pedido, respuesta) => pagina(respuesta, 'comida', 'ajustes.html'))

  // Resúmenes
  app.get('/api/comida', conUsuario, async (pedido) => v.resumen(id(pedido), pedido.query.fecha || null))
  app.get('/api/comida/hoy', conUsuario, async (pedido) => v.resumenHoy(id(pedido)))
  app.get('/api/comida/ajustes', conUsuario, async (pedido) => v.ajustes(id(pedido)))
  app.get('/api/comida/progreso', conUsuario, async (pedido) => {
    const hoy = await v.hoy(id(pedido))
    return { comida: await v.resumenSemanas(id(pedido), hoy), agua: await v.resumenAgua(id(pedido), hoy), fruta: await v.historialFruta(id(pedido), hoy) }
  })

  // Alimentos
  app.get('/api/comida/alimentos', conUsuario, async (pedido) => ({ alimentos: await v.buscar(id(pedido), pedido.query.q || '') }))
  app.post('/api/comida/alimentos', {
    ...conUsuario,
    ...cuerpo(['nombre', 'kcal'], { nombre: { type: 'string' }, porcion: { type: 'string' }, gramos: { type: 'number' }, kcal: { type: 'number' }, proteina: { type: 'number' }, carbos: { type: 'number' }, grasas: { type: 'number' }, up: { type: 'boolean' }, codigo: { type: 'string' } }),
  }, async (pedido) => ({ alimento: await v.crearPropio(id(pedido), pedido.body) }))
  app.get('/api/comida/codigo/:codigo', conUsuario, async (pedido) => v.buscarCodigo(id(pedido), pedido.params.codigo))

  // Lo comido
  app.post('/api/comida/registros', {
    ...conUsuario,
    ...cuerpo(['alimento', 'gramos'], { alimento: { type: 'string' }, gramos: { type: 'number' }, franja: FRANJA, fecha: FECHA }),
  }, async (pedido) => { await v.registrar(id(pedido), pedido.body); return v.resumen(id(pedido), fechaDe(pedido)) })
  app.put('/api/comida/registros/:id', { ...conUsuario, ...cuerpo(['gramos'], { gramos: { type: 'number' }, fecha: FECHA }) }, async (pedido) => {
    await v.cambiarCantidad(id(pedido), Number(pedido.params.id), pedido.body.gramos)
    return v.resumen(id(pedido), fechaDe(pedido))
  })
  app.delete('/api/comida/registros/:id', conUsuario, async (pedido) => {
    await v.borrar(id(pedido), Number(pedido.params.id))
    return v.resumen(id(pedido), fechaDe(pedido))
  })
  app.post('/api/comida/repetir-ayer', { ...conUsuario, ...cuerpo(['franja'], { franja: FRANJA, fecha: FECHA }) }, async (pedido) => {
    const fecha = fechaDe(pedido) || await v.hoy(id(pedido))
    const n = await v.repetirAyer(id(pedido), fecha, pedido.body.franja)
    return { copiadas: n, ...(await v.resumen(id(pedido), fecha)) }
  })

  // Comidas guardadas
  app.post('/api/comida/guardadas', { ...conUsuario, ...cuerpo(['nombre', 'franja'], { nombre: { type: 'string' }, franja: FRANJA, fecha: FECHA }) }, async (pedido) => {
    const fecha = fechaDe(pedido) || await v.hoy(id(pedido))
    await v.guardarFranja(id(pedido), { ...pedido.body, fecha })
    return v.resumen(id(pedido), fecha)
  })
  app.post('/api/comida/guardadas/:id/cargar', { ...conUsuario, ...cuerpo(['franja'], { franja: FRANJA, fecha: FECHA }) }, async (pedido) => {
    const fecha = fechaDe(pedido) || await v.hoy(id(pedido))
    const n = await v.cargarGuardada(id(pedido), Number(pedido.params.id), { fecha, franja: pedido.body.franja })
    return { cargadas: n, ...(await v.resumen(id(pedido), fecha)) }
  })
  app.delete('/api/comida/guardadas/:id', conUsuario, async (pedido) => {
    await v.borrarGuardada(id(pedido), Number(pedido.params.id))
    return v.resumen(id(pedido), fechaDe(pedido))
  })

  // Objetivo y peso
  app.put('/api/comida/objetivo', {
    ...conUsuario,
    ...cuerpo(['peso', 'altura', 'edad', 'sexo', 'actividad', 'meta'], {
      peso: { type: 'number' }, altura: { type: 'number' }, edad: { type: 'number' }, sexo: { type: 'string' }, actividad: { type: 'string' }, meta: { type: 'string' },
      manual: { type: 'boolean' }, kcal: { type: 'number' }, proteina: { type: 'number' },
    }),
  }, async (pedido) => { await v.guardarObjetivo(id(pedido), pedido.body); return v.ajustes(id(pedido)) })
  app.post('/api/comida/peso', { ...conUsuario, ...cuerpo(['kg'], { kg: { type: 'number' }, fecha: FECHA }) }, async (pedido) => {
    await v.registrarPeso(id(pedido), fechaDe(pedido), pedido.body.kg)
    return v.ajustes(id(pedido))
  })

  // Agua
  app.post('/api/comida/agua', { ...conUsuario, schema: { body: { type: ['object', 'null'], properties: { envase: { type: 'string' }, fecha: FECHA } } } }, async (pedido) => {
    const r = await v.tomarAgua(id(pedido), fechaDe(pedido), (pedido.body && pedido.body.envase) || null)
    return { dia: r.dia, recienLlego: r.recienLlego }
  })
  app.post('/api/comida/agua/deshacer', conUsuario, async (pedido) => ({ dia: await v.deshacerAgua(id(pedido), fechaDe(pedido)) }))
  app.put('/api/comida/agua/config', {
    ...conUsuario,
    ...cuerpo([], {
      envases: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, nombre: { type: 'string' }, ml: { type: 'number' } } } },
      principal: { type: 'string' }, objetivoMl: { type: ['number', 'null'] }, enHoy: { type: 'string', enum: ['chica', 'tarjeta', 'no'] },
    }),
  }, async (pedido) => { await v.guardarConfigAgua(id(pedido), pedido.body); return v.ajustes(id(pedido)) })

  // Fruta
  app.post('/api/comida/fruta', conUsuario, async (pedido) => v.comerFruta(id(pedido), fechaDe(pedido)))
  app.post('/api/comida/fruta/deshacer', conUsuario, async (pedido) => ({ dia: await v.deshacerFruta(id(pedido), fechaDe(pedido)) }))
  app.put('/api/comida/fruta/config', {
    ...conUsuario,
    ...cuerpo([], { nombre: { type: 'string' }, objetivo1: { type: 'number' }, objetivo2: { type: 'number' }, usar: { type: 'boolean' } }),
  }, async (pedido) => { await v.guardarConfigFruta(id(pedido), pedido.body); return v.ajustes(id(pedido)) })
}
