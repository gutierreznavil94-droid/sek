'use strict'
/**
 * Direcciones web del módulo dia: las pantallas Hoy (/hoy), Calendario (/calendario) y Mi horario (/horario), y su API.
 * Los id de compromiso llevan «:» (manga:2026-11-23): la pantalla los manda con encodeURIComponent.
 */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')

const FECHA = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
const HORA = { type: 'string', pattern: '^\\d{2}:\\d{2}$' }
const DIAS = { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, maxItems: 7 }

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

  // ---------- Parte 2: pantallas ----------
  app.get('/hoy', conUsuario, async (p, r) => pagina(r, 'dia', 'hoy.html'))
  app.get('/calendario', conUsuario, async (p, r) => pagina(r, 'dia', 'calendario.html'))
  app.get('/horario', conUsuario, async (p, r) => pagina(r, 'dia', 'horario.html'))

  // Hoy como tablero (pilares + la tarjeta de cada módulo)
  app.get('/api/dia/hoy', conUsuario, async (p) => v.tableroHoy(u(p)))
  app.post('/api/dia/empezar-ciclo', {
    ...conUsuario,
    schema: { body: { type: 'object', properties: { inicio: FECHA, duracionDias: { type: 'integer', minimum: 7, maximum: 3650 }, diaCero: { type: 'boolean' } } } },
  }, async (p) => ({ ciclo: await v.empezarCiclo(u(p), cuerpo(p)) }))
  app.post('/api/dia/dejo-celu', conUsuario, async (p) => v.dejoCeluDesdeHoy(u(p)))
  app.post('/api/dia/organizacion/:frente/:tarea/hecha', conUsuario, async (p) => v.tareaHecha(u(p), p.params.frente, p.params.tarea))

  // Calendario, feriados y fechas clave
  app.get('/api/dia/calendario', { ...conUsuario, schema: { querystring: { type: 'object', required: ['mes'], properties: { mes: { type: 'string', pattern: '^\\d{4}-\\d{2}$' } } } } },
    async (p) => v.calendarioMes(u(p), p.query.mes))
  app.get('/api/dia/feriados', rango, async (p) => ({ feriados: await v.feriadosEntre(u(p), p.query.desde, p.query.hasta) }))
  app.put('/api/dia/feriados/:fecha', { ...conUsuario, schema: { params: { type: 'object', properties: { fecha: FECHA } }, body: { type: 'object', properties: { nombre: { type: 'string', maxLength: 120 } } } } },
    async (p) => ({ feriado: await v.marcarFeriado(u(p), p.params.fecha, cuerpo(p).nombre) }))
  app.delete('/api/dia/feriados/:fecha', { ...conUsuario, schema: { params: { type: 'object', properties: { fecha: FECHA } } } },
    async (p) => ({ quitado: await v.quitarFeriado(u(p), p.params.fecha) }))
  const fechaClave = { type: 'object', properties: { fecha: FECHA, titulo: { type: 'string', maxLength: 120 }, nota: { type: ['string', 'null'], maxLength: 500 }, anual: { type: 'boolean' }, hora: { type: ['string', 'null'] }, horaFin: { type: ['string', 'null'] } } }
  app.post('/api/dia/fechas-clave', { ...conUsuario, schema: { body: { ...fechaClave, required: ['fecha', 'titulo'] } } },
    async (p) => ({ fechaClave: await v.agregarFechaClave(u(p), p.body) }))
  app.put('/api/dia/fechas-clave/:id', { ...conUsuario, schema: { body: fechaClave } }, async (p) => ({ fechaClave: await v.editarFechaClave(u(p), p.params.id, cuerpo(p)) }))
  app.delete('/api/dia/fechas-clave/:id', conUsuario, async (p) => { await v.borrarFechaClave(u(p), p.params.id); return { ok: true } })

  // Mi horario
  const conFecha = { ...conUsuario, schema: { querystring: { type: 'object', properties: { fecha: FECHA } } } }
  app.get('/api/dia/horario', conFecha, async (p) => v.horarioSemana(u(p), p.query.fecha || null))
  app.get('/api/dia/horario/dia', conFecha, async (p) => v.horarioDelDia(u(p), p.query.fecha || null))
  const bloque = { type: 'object', required: ['nombre', 'desde', 'hasta', 'dias'], properties: { nombre: { type: 'string', maxLength: 80 }, tipo: { type: 'string' }, desde: HORA, hasta: HORA, dias: DIAS } }
  app.post('/api/dia/horario/bloques', { ...conUsuario, schema: { body: bloque } }, async (p) => ({ bloque: await v.guardarBloque(u(p), { ...p.body, id: undefined }) }))
  app.put('/api/dia/horario/bloques/:id', { ...conUsuario, schema: { body: bloque } }, async (p) => ({ bloque: await v.guardarBloque(u(p), { ...p.body, id: p.params.id }) }))
  app.delete('/api/dia/horario/bloques/:id', conUsuario, async (p) => { await v.borrarBloque(u(p), p.params.id); return { ok: true } })
  app.post('/api/dia/horario/bloques/:id/copiar', { ...conUsuario, schema: { body: { type: 'object', required: ['dias'], properties: { dias: DIAS } } } },
    async (p) => ({ bloque: await v.copiarADias(u(p), p.params.id, p.body.dias) }))
  app.post('/api/dia/horario/apagar', { ...conUsuario, schema: { body: { type: 'object', required: ['fecha', 'bloqueId', 'apagado'], properties: { fecha: FECHA, bloqueId: { type: 'string' }, apagado: { type: 'boolean' } } } } },
    async (p) => { await v.apagarBloqueEnFecha(u(p), p.body.fecha, p.body.bloqueId, p.body.apagado); return v.horarioDelDia(u(p), p.body.fecha) })
  app.post('/api/dia/horario/correr-entreno', { ...conUsuario, schema: { body: { type: 'object', required: ['fecha', 'hora'], properties: { fecha: FECHA, hora: HORA } } } },
    async (p) => { await v.correrEntreno(u(p), p.body.fecha, p.body.hora); return v.horarioDelDia(u(p), p.body.fecha) })
  app.post('/api/dia/horarios', { ...conUsuario, schema: { body: { type: 'object', properties: { nombre: { type: 'string', maxLength: 60 }, copiar: { type: 'boolean' } } } } },
    async (p) => ({ horario: await v.nuevoHorario(u(p), cuerpo(p).nombre, !!cuerpo(p).copiar) }))
  app.post('/api/dia/horarios/:id/activar', conUsuario, async (p) => ({ config: await v.activarHorario(u(p), p.params.id) }))
  app.put('/api/dia/horarios/:id', { ...conUsuario, schema: { body: { type: 'object', required: ['nombre'], properties: { nombre: { type: 'string', maxLength: 60 } } } } },
    async (p) => ({ config: await v.renombrarHorario(u(p), p.params.id, p.body.nombre) }))
  app.delete('/api/dia/horarios/:id', conUsuario, async (p) => ({ config: await v.borrarHorario(u(p), p.params.id) }))
}
