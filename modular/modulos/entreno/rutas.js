'use strict'
/** Direcciones web del módulo entreno. Reciben el pedido, llaman a la ventanilla y responden. */
const v = require('./ventanilla')
const { requiereUsuario } = require('../../comun/sesion')
const { pagina } = require('../../comun/pantalla/servir')
const { datoInvalido } = require('../../comun/errores')
const { sumarDias } = require('../../comun/fechas')

const num = (x) => (x === undefined || x === null || x === '' ? undefined : Number(x))

/** Acciones sobre un entreno en curso: POST /api/entreno/sesiones/:id/<accion>. Cada una devuelve la vista nueva. */
const ACCIONES = {
  serie: (u, id, b) => v.registrarSerie(u, id, b.bloqueId, { reps: num(b.reps), repsExtra: num(b.repsExtra), ayuda: num(b.ayuda), peso: num(b.peso) }),
  peso: (u, id, b) => v.fijarPeso(u, id, b.bloqueId, num(b.peso)),
  corregir: (u, id, b) => v.corregirSerie(u, id, b.bloqueId, num(b.n), { reps: num(b.reps), repsExtra: num(b.repsExtra), ayuda: num(b.ayuda), peso: num(b.peso) }),
  deshacer: (u, id) => v.deshacerSerie(u, id),
  marcar: (u, id, b) => v.marcarBloque(u, id, b.bloqueId),
  saltar: (u, id, b) => v.saltarBloque(u, id, b.bloqueId),
  ir: (u, id, b) => v.irABloque(u, id, b.bloqueId),
  mover: (u, id, b) => v.moverBloque(u, id, b.bloqueId, num(b.delta) < 0 ? -1 : 1),
  'fin-descanso': (u, id) => v.terminarDescanso(u, id),
  alargar: (u, id, b) => v.alargarDescanso(u, id, num(b.segundos) || 30),
  reloj: (u, id, b) => v.iniciarReloj(u, id, b.bloqueId),
  'saltar-preparacion': (u, id) => v.saltarPreparacion(u, id),
  'parar-reloj': (u, id) => v.pararReloj(u, id),
  cronometro: (u, id, b) => v.terminarCronometro(u, id, b.bloqueId, num(b.peso) || 0),
  tiempo: (u, id, b) => v.corregirTiempo(u, id, b.bloqueId, num(b.segundos) || 0),
  objetivo: (u, id, b) => v.fijarObjetivoCronometro(u, String(b.nombre || ''), Math.max(1, num(b.segundos) || 1), b.bloqueId),
  terminar: (u, id) => v.terminarEntreno(u, id),
  reabrir: (u, id) => v.reabrirEntreno(u, id),
  reiniciar: (u, id) => v.reiniciarEntreno(u, id),
}

module.exports = async function rutasEntreno(app) {
  const conUsuario = { preHandler: requiereUsuario }
  const u = (p) => p.usuario.id

  // Pantallas
  app.get('/entreno', conUsuario, async (p, r) => pagina(r, 'entreno', 'entreno.html'))
  app.get('/entreno/rutina', conUsuario, async (p, r) => pagina(r, 'entreno', 'rutina.html'))
  app.get('/entreno/sesion', conUsuario, async (p, r) => pagina(r, 'entreno', 'sesion.html'))
  app.get('/entreno/series', conUsuario, async (p, r) => pagina(r, 'entreno', 'series.html'))
  app.get('/entreno/historial', conUsuario, async (p, r) => pagina(r, 'entreno', 'historial.html'))

  // Inicio del módulo: lo de hoy, rutinas, planes y últimos entrenos.
  app.get('/api/entreno', conUsuario, async (p) => ({
    hoy: await v.resumenHoy(u(p)),
    rutinas: await v.listarRutinas(u(p), { inactivas: true }),
    planes: v.planes(),
    ideas: v.ideasDeAPoco(),
    historial: await v.historialEntrenos(u(p), 10),
  }))
  app.post('/api/entreno/eleccion', {
    ...conUsuario,
    schema: { body: { type: 'object', required: ['eleccion'], properties: { eleccion: { type: 'object' }, reemplazar: { type: 'boolean' }, diasPilar: { type: 'array', items: { type: 'integer' } } } } },
  }, async (p) => v.aplicarEleccion(u(p), p.body.eleccion, { reemplazar: !!p.body.reemplazar, diasPilar: p.body.diasPilar }))

  // Rutinas
  app.post('/api/entreno/rutinas', conUsuario, async (p) => v.crearRutina(u(p), { nombre: (p.body && p.body.nombre) || undefined, dias: (p.body && p.body.dias) || [] }))
  app.post('/api/entreno/rutinas/orden', conUsuario, async (p) => ({ rutinas: await v.ordenarRutinas(u(p), (p.body && p.body.ids) || []) }))
  app.get('/api/entreno/rutinas/:id', conUsuario, async (p) => {
    const rutina = await v.obtenerRutina(u(p), p.params.id)
    if (!rutina) throw datoInvalido('Esa rutina no existe.')
    return detalleRutina(u(p), rutina)
  })
  app.put('/api/entreno/rutinas/:id', { ...conUsuario, schema: { body: { type: 'object', required: ['nombre', 'bloques'] } } }, async (p) => {
    const rutina = await v.guardarRutina(u(p), { ...p.body, id: p.params.id })
    return detalleRutina(u(p), rutina)
  })
  app.delete('/api/entreno/rutinas/:id', conUsuario, async (p) => ({ resultado: await v.borrarRutina(u(p), p.params.id) }))
  app.post('/api/entreno/rutinas/:id/sumar-bloque', conUsuario, async (p) => {
    const n = await v.sumarBloqueARutinas(u(p), p.params.id, p.body.bloqueId, p.body.destinos || [])
    return { sumadas: n, ...(await detalleRutina(u(p), await v.obtenerRutina(u(p), p.params.id))) }
  })
  app.post('/api/entreno/rutinas/:id/es-el-mismo', conUsuario, async (p) => {
    const rutina = await v.responderEsElMismo(u(p), p.params.id, p.body.bloqueId, p.body.otroBloqueId, !!p.body.esElMismo)
    return detalleRutina(u(p), rutina)
  })

  // Entreno en curso
  app.post('/api/entreno/empezar', { ...conUsuario, schema: { body: { type: 'object', required: ['rutinaId'], properties: { rutinaId: { type: 'string' } } } } },
    async (p) => v.vistaEntreno(u(p), (await v.iniciarEntreno(u(p), p.body.rutinaId)).id))
  app.get('/api/entreno/en-curso', conUsuario, async (p) => {
    const s = await v.sesionEnCurso(u(p))
    return { vista: s ? await v.vistaEntreno(u(p), s.id) : null }
  })
  app.get('/api/entreno/sesiones/:id', conUsuario, async (p) => v.vistaEntreno(u(p), Number(p.params.id)))
  app.post('/api/entreno/sesiones/:id/:accion', conUsuario, async (p) => {
    const fn = ACCIONES[p.params.accion]
    if (!fn) throw datoInvalido('Esa acción no existe.')
    const id = Number(p.params.id)
    const r = await fn(u(p), id, p.body || {})
    const vista = await v.vistaEntreno(u(p), id)
    if (p.params.accion === 'terminar') return { vista, resultado: { resumen: r.resumen, xpExtra: r.xpExtra, motivoSinXp: r.motivoSinXp, nuevoNivel: r.nuevoNivel } }
    if (p.params.accion === 'cronometro') return { vista, resultado: { tiempo: r.tiempo, objetivo: r.objetivo, subio: r.subio } }
    return { vista }
  })
  app.delete('/api/entreno/sesiones/:id', conUsuario, async (p) => { await v.descartarEntreno(u(p), Number(p.params.id)); return { ok: true } })

  // Historial
  app.get('/api/entreno/historial', conUsuario, async (p) => ({ entrenos: await v.historialEntrenos(u(p), 60) }))
  app.get('/api/entreno/ejercicios/:bloqueId', conUsuario, async (p) => v.progresionEjercicio(u(p), p.params.bloqueId))
  app.get('/api/entreno/fuerza', conUsuario, async (p) => {
    const hoy = (await v.resumenHoy(u(p))).fecha
    return v.resumenFuerza(u(p), hoy, (p.query && p.query.desde) || sumarDias(hoy, -89))
  })

  // Series rápidas
  app.get('/api/series', conUsuario, async (p) => ({ ...(await v.resumenSeries(u(p))), todas: await v.listarContadores(u(p), { inactivos: true }) }))
  app.post('/api/series', conUsuario, async (p) => ({ contador: await v.guardarContador(u(p), p.body || {}) }))
  app.post('/api/series/:id/toque', conUsuario, async (p) => {
    const r = await v.sumarToque(u(p), p.params.id, num(p.body && p.body.cantidad) ?? null)
    return { toque: { total: r.total, xp: r.xp, metaLograda: r.metaLograda, extraLogrado: r.extraLogrado, nuevoNivel: r.nuevoNivel }, ...(await v.resumenSeries(u(p))) }
  })
  app.post('/api/series/:id/deshacer', conUsuario, async (p) => { await v.deshacerUltimoToque(u(p), p.params.id); return v.resumenSeries(u(p)) })
  app.post('/api/series/:id/propuesta', conUsuario, async (p) => { await v.responderPropuesta(u(p), p.params.id, !!(p.body && p.body.acepta)); return v.resumenSeries(u(p)) })
}

/** La rutina con lo que el editor necesita: las otras rutinas, en cuáles está cada bloque y las preguntas «¿Es el mismo?». */
async function detalleRutina(usuarioId, rutina) {
  const todas = await v.listarRutinas(usuarioId, { inactivas: true })
  const enlaces = {}
  const preguntas = []
  for (const b of rutina.bloques) {
    const otras = todas.filter((r) => r.id !== rutina.id && r.bloques.some((x) => x.id === b.id)).map((r) => r.nombre)
    if (otras.length) enlaces[b.id] = otras
    else {
      const m = await v.mismoNombreEnOtraRutina(usuarioId, rutina.id, b)
      if (m) preguntas.push({ bloqueId: b.id, nombre: b.nombre, otraRutina: m.rutina.nombre, otroBloqueId: m.bloque.id })
    }
  }
  return { rutina, otras: todas.filter((r) => r.id !== rutina.id).map((r) => ({ id: r.id, nombre: r.nombre })), enlaces, preguntas }
}
