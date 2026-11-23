'use strict'
/**
 * Direcciones web del módulo dia (parte 1: solo API). La pantalla Hoy, el Calendario y Mi horario llegan en la parte 2.
 * Los id de compromiso llevan «:» (manga:2026-11-23): la pantalla los manda con encodeURIComponent.
 */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')

const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }

module.exports = async function rutasDia(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const u = (p) => p.usuario.id
  const cuerpo = (p) => p.body || {}

  // Hoy: cierra lo pendiente y devuelve pilares, racha, aviso de resta y la noche.
  app.get('/api/dia', conUsuario, async (p) => v.resumenHoy(u(p)))
  app.get('/api/dia/pilares', { ...conUsuario, schema: { querystring: { type: 'object', properties: { fecha: FECHA } } } },
    async (p) => v.pilaresDelDia(u(p), p.query.fecha || null))
  app.get('/api/dia/compromisos', { ...conUsuario, schema: { querystring: { type: 'object', required: ['fecha'], properties: { fecha: FECHA } } } },
    async (p) => ({ compromisos: await v.compromisosDelDia(u(p), p.query.fecha) }))

  // Marcar
  const id = (p) => p.params.id
  app.post('/api/dia/compromisos/:id/iniciar', conUsuario, async (p) => ({ compromiso: await v.iniciar(u(p), id(p)) }))
  app.post('/api/dia/compromisos/:id/completar', {
    ...conUsuario,
    schema: { body: { type: 'object', properties: { minutos: { type: 'number', minimum: 0 }, nota: { type: 'string', maxLength: 500 }, respuesta: { type: 'string', maxLength: 1000 } } } },
  }, async (p) => { const b = cuerpo(p); return v.completar(u(p), id(p), { minutos: b.minutos, nota: b.nota, respuesta: b.respuesta }) })
  app.post('/api/dia/compromisos/:id/omitir', conUsuario, async (p) => ({ compromiso: await v.omitir(u(p), id(p), cuerpo(p).nota || null) }))
  app.post('/api/dia/compromisos/:id/deshacer', conUsuario, async (p) => ({ compromiso: await v.deshacer(u(p), id(p)) }))
  app.post('/api/dia/compromisos/:id/extra', conUsuario, async (p) => v.marcarExtra(u(p), id(p), { minutos: cuerpo(p).minutos }))
  app.post('/api/dia/compromisos/:id/deshacer-extra', conUsuario, async (p) => ({ compromiso: await v.deshacerExtra(u(p), id(p)) }))
  app.post('/api/dia/compromisos/:id/reprogramar', { ...conUsuario, schema: { body: { type: 'object', required: ['fecha'], properties: { fecha: FECHA } } } },
    async (p) => ({ compromiso: await v.reprogramar(u(p), id(p), p.body.fecha) }))
  app.post('/api/dia/compromisos/:id/corregir', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['estado', 'motivo'], properties: { estado: { type: 'string' }, motivo: { type: 'string', maxLength: 300 }, minutos: { type: 'number' } } } },
  }, async (p) => ({ compromiso: await v.corregir(u(p), id(p), p.body.estado, p.body.motivo, p.body.minutos) }))

  // Resúmenes
  const rango = { ...conUsuario, schema: { querystring: { type: 'object', required: ['desde', 'hasta'], properties: { desde: FECHA, hasta: FECHA } } } }
  app.get('/api/dia/cumplimiento', rango, async (p) => ({ dias: await v.cumplimientoPorDia(u(p), p.query.desde, p.query.hasta) }))
  app.get('/api/dia/pilares-por-dia', rango, async (p) => ({ dias: await v.pilaresPorDia(u(p), p.query.desde, p.query.hasta) }))
  app.get('/api/dia/racha', conUsuario, async (p) => ({ racha: await v.racha(u(p)) }))
  app.get('/api/dia/atributos', conUsuario, async (p) => ({ atributos: await v.atributosHoy(u(p)) }))
  app.get('/api/dia/aviso-resta', conUsuario, async (p) => ({ aviso: await v.avisoResta(u(p)) }))

  // Excepciones
  app.get('/api/dia/excepciones', rango, async (p) => ({ excepciones: await v.excepciones(u(p), p.query.desde, p.query.hasta) }))
  app.put('/api/dia/excepciones/:fecha', { ...conUsuario, schema: { body: { type: 'object', required: ['motivo'], properties: { motivo: { type: 'string', maxLength: 200 } } } } },
    async (p) => { await v.marcarExcepcion(u(p), p.params.fecha, p.body.motivo); return { ok: true } })
  app.delete('/api/dia/excepciones/:fecha', conUsuario, async (p) => { await v.quitarExcepcion(u(p), p.params.fecha); return { ok: true } })

  // Acciones (pilares y compromisos configurables)
  app.get('/api/dia/acciones', conUsuario, async (p) => ({ acciones: await v.accionesConXp(u(p)) }))
  app.put('/api/dia/acciones/:id', { ...conUsuario, schema: { body: { type: 'object' } } }, async (p) => {
    const { xp, ...a } = cuerpo(p)
    return { accion: await v.guardarAccion(u(p), { ...a, id: p.params.id }, { xp: xp === undefined ? undefined : Number(xp) }) }
  })
  app.post('/api/dia/acciones/:id/activa', { ...conUsuario, schema: { body: { type: 'object', required: ['activa'], properties: { activa: { type: 'boolean' } } } } },
    async (p) => ({ accion: await v.activarAccion(u(p), p.params.id, p.body.activa) }))
  app.post('/api/dia/comida', { ...conUsuario, schema: { body: { type: 'object', required: ['activo'], properties: { activo: { type: 'boolean' } } } } },
    async (p) => ({ accion: await v.activarPilarComida(u(p), p.body.activo) }))

  // El Tajo: la pantalla avisa cuando la app se oculta y pregunta al volver.
  app.post('/api/dia/vista', conUsuario, async (p) => { await v.anotarVista(u(p)); return { ok: true } })
  app.post('/api/dia/tajo', conUsuario, async (p) => v.tajo(u(p)))
}
