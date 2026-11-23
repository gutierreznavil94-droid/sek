'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const { instanteDe } = require('../../comun/fechas')
const { guardarAjustes } = require('../../comun/ajustes')
const xp = require('../xp/ventanilla')
const ciclo = require('../ciclo/ventanilla')
const juego = require('../juego/ventanilla')
const dia = require('./ventanilla')
const calculo = require('./calculo')
const { crearApp } = require('../../app')

const MIN = 60000
const a = (fecha, hora) => instanteDe(fecha, hora) // hora de Córdoba
const LUNES = '2026-11-23'

before(prepararBase)
after(terminar)

/** Persona con atributos, pilares de fábrica y un ciclo que empieza `inicio`. Deja el reloj en `ahora`. */
async function persona({ inicio = LUNES, ahora = a(LUNES, '10:00'), nombre = 'Prueba' } = {}) {
  reloj.fijar(ahora)
  const id = await personaDePrueba(nombre)
  await ciclo.sembrar(id)
  await dia.sembrar(id)
  await ciclo.iniciarCiclo(id, { inicio })
  await dia.cerrarDiasPendientes(id)
  return id
}
const xpDe = async (id, fecha, origen) => (await xp.delDia(id, fecha)).filter((r) => !r.anulado && (!origen || r.origen === origen))
const estado = async (id, cid) => (await dia.compromisosDelDia(id, cid.split(':')[1])).find((c) => c.id === cid)?.estado

// ---------- cuentas puras ----------

test('calculo: cumplimiento solo sobre pilares, racha con excepción y nivel del calendario', () => {
  const c = calculo.cumplimiento([
    { accionId: 'manga', fecha: LUNES, estado: 'completado', pilar: true, atributoIds: [] },
    { accionId: 'empresa', fecha: LUNES, estado: 'omitido', pilar: true, atributoIds: [] },
    { accionId: 'suelto', fecha: LUNES, estado: 'omitido', pilar: false, atributoIds: [] },
  ])
  assert.deepEqual(c, { cumplidos: 1, programados: 2, porcentaje: 50 })
  const m = new Map([['2026-11-23', { porcentaje: 100 }], ['2026-11-22', { porcentaje: null, excepcion: true }], ['2026-11-21', { porcentaje: 80 }], ['2026-11-20', { porcentaje: 50 }]])
  assert.equal(calculo.racha(m, '2026-11-23', 75), 2)
  assert.equal(calculo.nivelCumplimiento(85), 'alto')
  assert.equal(calculo.nivelCumplimiento(null), 'sin_datos')
  assert.equal(calculo.horaFinMargen('20:50', 10), '21:00')
  assert.ok(calculo.debeMostrarTajo({ ultimaVista: 0, ahora: 3 * 3600000, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: false }))
  assert.ok(!calculo.debeMostrarTajo({ ultimaVista: 0, ahora: 3 * 3600000, pilarPendiente: false, pasoDejoCelu: false, mostradoHoy: false }))
})

// ---------- pilares ----------

test('los pilares de fábrica arrancan pendientes el Día 1 (entreno, empresa, manga, dormir)', async () => {
  const id = await persona()
  const p = await dia.pilaresDelDia(id, LUNES)
  assert.deepEqual(p.pilares.map((x) => [x.accion.id, x.estado, x.xpPrevisto]), [
    ['entrenamiento', 'pendiente', 30], ['empresa', 'pendiente', 15], ['manga', 'pendiente', 15], ['acostarse', 'pendiente', 20],
  ])
  assert.equal(p.aplican, 4)
  // Antes del Día 1 no se programa nada.
  assert.deepEqual(await dia.generarCompromisos(id, '2026-11-22'), [])
})

test('cumplir da su XP una sola vez; deshacer la anula; después de las 21:00 queda tarde y sin XP', async () => {
  const id = await persona()
  const r = await dia.completar(id, `manga:${LUNES}`, { minutos: 20 })
  assert.equal(r.xp, 15)
  assert.equal(r.compromiso.estado, 'completado')
  assert.equal((await dia.completar(id, `manga:${LUNES}`)).xp, 0) // ya estaba
  await dia.deshacer(id, `manga:${LUNES}`)
  assert.equal((await xpDe(id, LUNES, 'compromiso')).length, 0)
  assert.equal(await estado(id, `manga:${LUNES}`), 'pendiente')
  // Menos minutos que el mínimo: hecho sin XP.
  const corto = await dia.completar(id, `manga:${LUNES}`, { minutos: 5 })
  assert.equal(corto.xp, 0)
  assert.match(corto.motivoSinXp, /Menos de 15/)
  // Empresa a las 21:05: tarde.
  reloj.fijar(a(LUNES, '21:05'))
  const t = await dia.completar(id, `empresa:${LUNES}`, { respuesta: 'Llamé al proveedor' })
  assert.equal(t.compromiso.estado, 'tarde')
  assert.equal(t.compromiso.retrasoMinutos, 5)
  assert.equal(t.xp, 0)
})

test('el extra de manga (30 min) da su XP aparte y se puede deshacer', async () => {
  const id = await persona()
  await assert.rejects(dia.marcarExtra(id, `manga:${LUNES}`), /Primero marcá/)
  await dia.completar(id, `manga:${LUNES}`, { minutos: 15 })
  const e = await dia.marcarExtra(id, `manga:${LUNES}`)
  assert.equal(e.xp, 10)
  assert.equal(e.compromiso.minutos, 30)
  await dia.deshacerExtra(id, `manga:${LUNES}`)
  assert.equal((await xpDe(id, LUNES, 'extra')).length, 0)
  assert.equal(await estado(id, `manga:${LUNES}`), 'completado')
})

test('«Dormir a horario» no se marca a mano: lo marca el aviso de sueno, sin dar XP de nuevo', async () => {
  const id = await persona()
  dia.escucharAvisos()
  await assert.rejects(dia.completar(id, `acostarse:${LUNES}`), /Dejo celu/)
  await eventos.avisar('sueno.dejo_celu', { usuarioId: id, noche: LUNES, cumplido: true, retrasoMinutos: 0, instante: a(LUNES, '21:00') })
  assert.equal(await estado(id, `acostarse:${LUNES}`), 'completado')
  assert.equal((await xpDe(id, LUNES)).length, 0)
  await eventos.avisar('sueno.dejo_celu.deshecho', { usuarioId: id, noche: LUNES })
  assert.equal(await estado(id, `acostarse:${LUNES}`), 'pendiente')
  await eventos.avisar('sueno.dejo_celu', { usuarioId: id, noche: LUNES, cumplido: false, retrasoMinutos: 12, instante: a(LUNES, '21:27') })
  const c = (await dia.compromisosDelDia(id, LUNES)).find((x) => x.accionId === 'acostarse')
  assert.equal(c.estado, 'tarde')
  assert.equal(c.retrasoMinutos, 12)
})

test('entreno: empezado → iniciado; terminado → cumplido con XP; empezado tarde → tarde; deshecho vuelve', async () => {
  const id = await persona()
  dia.escucharAvisos()
  const cid = `entrenamiento:${LUNES}`
  await eventos.avisar('entreno.empezado', { usuarioId: id, sesionId: 1, fecha: LUNES, inicio: a(LUNES, '07:00') })
  assert.equal(await estado(id, cid), 'iniciado')
  await eventos.avisar('entreno.terminado', { usuarioId: id, sesionId: 1, fecha: LUNES, inicio: a(LUNES, '07:00'), inicioQueCuenta: a(LUNES, '07:00'), fin: a(LUNES, '07:45'), minutos: 45 })
  assert.equal(await estado(id, cid), 'completado')
  assert.equal((await xpDe(id, LUNES, 'entrenamiento'))[0].cantidad, 30)
  await eventos.avisar('entreno.deshecho', { usuarioId: id, sesionId: 1, fecha: LUNES, quedaIniciado: true, motivo: 'Entreno reabierto' })
  assert.equal(await estado(id, cid), 'iniciado')
  assert.equal((await xpDe(id, LUNES, 'entrenamiento')).length, 0)
  reloj.fijar(a(LUNES, '20:30'))
  await eventos.avisar('entreno.terminado', { usuarioId: id, sesionId: 1, fecha: LUNES, inicio: a(LUNES, '19:45'), inicioQueCuenta: a(LUNES, '19:45'), fin: a(LUNES, '20:30'), minutos: 45 })
  assert.equal(await estado(id, cid), 'tarde')
  assert.equal((await xpDe(id, LUNES, 'entrenamiento')).length, 0)
})

test('guardar la revisión diaria (ciclo) completa su pilar y da 10 XP', async () => {
  const id = await persona()
  dia.escucharAvisos()
  await ciclo.guardarRevision(id, 'diaria', LUNES, { obstaculo: 'Sueño', ajuste: 'Acostarme antes' })
  assert.equal(await estado(id, `revision_diaria:${LUNES}`), 'completado')
  assert.equal((await xpDe(id, LUNES, 'revision'))[0].cantidad, 10)
})

// ---------- cierre del día ----------

test('cerrar días: lo sin marcar queda omitido, resta la mitad, el límite de juego se decide y la racha se arma', async () => {
  const id = await persona({ inicio: '2026-11-20', ahora: a('2026-11-20', '08:00') })
  // Viernes 20: todo cumplido menos dormir.
  for (const p of ['entrenamiento', 'empresa', 'manga']) await dia.completar(id, `${p}:2026-11-20`, { minutos: 45 })
  // Sábado 21: nada. Juega 3 h (límite de finde 120).
  reloj.fijar(a('2026-11-21', '15:00'))
  await juego.agregarManual(id, { inicio: a('2026-11-21', '11:00'), fin: a('2026-11-21', '14:00') })
  // Lunes 23, 10:00: se cierran 20, 21 y 22.
  reloj.fijar(a(LUNES, '10:00'))
  assert.deepEqual(await dia.cerrarDiasPendientes(id), ['2026-11-20', '2026-11-21', '2026-11-22'])
  assert.equal(await estado(id, 'acostarse:2026-11-20'), 'omitido')
  assert.equal(await estado(id, 'limite_juego:2026-11-20'), 'completado')
  assert.equal(await estado(id, 'limite_juego:2026-11-21'), 'omitido')
  // Restas del 20: solo dormir (20 → −10). Del 21: los 4 pilares.
  const restas20 = await xpDe(id, '2026-11-20', 'resta')
  assert.deepEqual(restas20.map((r) => r.cantidad), [-10])
  assert.equal((await xpDe(id, '2026-11-21', 'resta')).length, 4)
  const dias = await dia.cumplimientoPorDia(id, '2026-11-20', '2026-11-22')
  assert.deepEqual(dias.map((d) => [d.fecha, d.porcentaje]), [['2026-11-20', 75], ['2026-11-21', 0], ['2026-11-22', 0]])
  assert.equal(await dia.rachaHasta(id, '2026-11-20'), 1)
  assert.equal(await dia.racha(id, LUNES), 0)
  // Cerrar otra vez no repite nada.
  assert.deepEqual(await dia.cerrarDiasPendientes(id), [])
  assert.equal((await xpDe(id, '2026-11-21', 'resta')).length, 4)
})

test('corregir un día cerrado a cumplido devuelve la resta y recalcula el día', async () => {
  const id = await persona({ inicio: '2026-11-22', ahora: a('2026-11-22', '08:00') })
  await xp.sumar(id, { clave: 'prueba:colchon', cantidad: 100, origen: 'prueba', fecha: '2026-11-22' }) // que haya de dónde restar
  reloj.fijar(a(LUNES, '10:00'))
  await dia.cerrarDiasPendientes(id)
  assert.equal((await xpDe(id, '2026-11-22', 'resta')).length, 3) // domingo: sin entreno (descanso)
  await dia.corregir(id, 'manga:2026-11-22', 'completado', 'Me olvidé de marcarlo', 20)
  assert.equal((await xpDe(id, '2026-11-22', 'resta')).length, 2)
  assert.equal((await xpDe(id, '2026-11-22', 'compromiso'))[0].cantidad, 15)
  const [d] = await dia.cumplimientoPorDia(id, '2026-11-22', '2026-11-22')
  assert.equal(d.cumplidos, 1)
  await assert.rejects(dia.corregir(id, 'manga:2026-11-22', 'completado', ''), /por qué/)
})

test('un día de excepción no resta y no corta la racha', async () => {
  const id = await persona({ inicio: '2026-11-21', ahora: a('2026-11-21', '08:00') })
  for (const p of ['entrenamiento', 'empresa', 'manga']) await dia.completar(id, `${p}:2026-11-21`, { minutos: 45 })
  dia.escucharAvisos()
  await eventos.avisar('sueno.dejo_celu', { usuarioId: id, noche: '2026-11-21', cumplido: true, retrasoMinutos: 0, instante: a('2026-11-21', '21:00') })
  await dia.marcarExcepcion(id, '2026-11-22', 'Enfermo')
  reloj.fijar(a(LUNES, '10:00'))
  await dia.cerrarDiasPendientes(id)
  assert.equal((await xpDe(id, '2026-11-22', 'resta')).length, 0)
  assert.equal(await dia.rachaHasta(id, '2026-11-22'), 1)
})

test('el pilar de comida se decide al cerrar con lo que conecta comida; sin comidas cargadas no cuenta', async () => {
  const id = await persona({ inicio: '2026-11-21', ahora: a('2026-11-21', '08:00') })
  await dia.activarPilarComida(id, true)
  assert.ok((await dia.pilaresDelDia(id, '2026-11-21')).pilares.some((p) => p.accion.id === 'comer-plan'))
  dia.conectar({ planComida: async (u, fecha) => (fecha === '2026-11-21' ? { cumplido: true, kcal: 2100, proteina: 140 } : null) })
  reloj.fijar(a('2026-11-22', '23:00'))
  await dia.generarCompromisos(id, '2026-11-22')
  reloj.fijar(a(LUNES, '10:00'))
  await dia.cerrarDiasPendientes(id)
  dia.conectar({ planComida: null })
  assert.equal(await estado(id, 'comer-plan:2026-11-21'), 'completado')
  assert.equal((await dia.compromisosDelDia(id, '2026-11-22')).some((c) => c.accionId === 'comer-plan'), false)
})

test('las series de entreno conectadas suman a lo que resta', async () => {
  const id = await persona()
  dia.conectar({ faltantesSeries: async () => [{ id: 'serie-flexiones', nombre: 'Flexiones', xp: 10, tipo: 'serie' }] })
  const aviso = await dia.avisoResta(id)
  dia.conectar({ faltantesSeries: null })
  assert.deepEqual(aviso.faltantes.map((f) => f.id), ['entrenamiento', 'empresa', 'manga', 'acostarse', 'serie-flexiones'])
  assert.equal(aviso.total, 15 + 8 + 8 + 10 + 5)
})

// ---------- el Tajo ----------

test('el Tajo sale al volver después de 3 h con un pilar pendiente, una vez por día', async () => {
  const id = await persona()
  await dia.anotarVista(id)
  reloj.avanzar(60 * MIN)
  assert.equal((await dia.tajo(id)).mostrar, false) // solo 1 h
  reloj.avanzar(4 * 60 * MIN)
  const t = await dia.tajo(id)
  assert.equal(t.mostrar, true)
  assert.ok(t.pendientes.includes('Dibujar manga'))
  reloj.avanzar(4 * 60 * MIN)
  assert.equal((await dia.tajo(id)).mostrar, false) // ya salió hoy
})

// ---------- configuración ----------

test('acciones: cambiar la XP vale desde hoy y editar días acomoda lo pendiente', async () => {
  const id = await persona()
  await assert.rejects(dia.guardarAccion(id, { id: 'x', nombre: 'A', tipo: 'compromiso', dias: [], atributoIds: [] }), /nombre|día|atributo/)
  const manga = (await dia.acciones(id)).find((x) => x.id === 'manga')
  await dia.guardarAccion(id, { ...manga, dias: [0] }, { xp: 25 })
  assert.equal((await dia.compromisosDelDia(id, LUNES)).some((c) => c.accionId === 'manga'), false)
  assert.equal((await dia.accionesConXp(id)).find((x) => x.id === 'manga').xp, 25)
  await dia.guardarAccion(id, { id: 'leer', nombre: 'Leer 10 páginas', tipo: 'compromiso', dias: [1], atributoIds: ['claridad'] })
  const r = await dia.completar(id, `leer:${LUNES}`)
  assert.equal(r.xp, 10) // compromiso sin regla: xpCompromisoPorDefecto
  await guardarAjustes(id, { maxCompromisosXpPorDia: 1 })
  await dia.guardarAccion(id, { id: 'meditar', nombre: 'Meditar', tipo: 'compromiso', dias: [1], atributoIds: ['autocontrol'] })
  assert.match((await dia.completar(id, `meditar:${LUNES}`)).motivoSinXp, /Tope/)
})

test('mover el Día 1 borra lo sin resolver de antes del nuevo inicio', async () => {
  const id = await persona({ inicio: '2026-11-20', ahora: a('2026-11-20', '08:00') })
  dia.escucharAvisos()
  await dia.completar(id, 'manga:2026-11-20')
  reloj.fijar(a(LUNES, '10:00'))
  await ciclo.cambiarInicio(id, LUNES)
  const del20 = await dia.compromisosDelDia(id, '2026-11-20')
  assert.deepEqual(del20.map((c) => c.accionId), ['manga']) // lo hecho queda, lo pendiente se fue
  assert.deepEqual(await dia.cerrarDiasPendientes(id), [])
})

test('importa pilares, reglas, compromisos y días cerrados de la app vieja', async () => {
  reloj.fijar(a(LUNES, '10:00'))
  const id = await personaDePrueba('Copia')
  const n = await dia.importar(id, {
    acciones: [{ id: 'manga', nombre: 'Dibujar manga', tipo: 'compromiso', dias: [0, 1, 2, 3, 4, 5, 6], horaLimite: '20:50', pilar: true, atributoIds: ['claridad'], objetivoIds: [], peso: 1, activa: true, orden: 3, creado: a('2026-11-01', '10:00'), minutosExtra: 30 }],
    reglasXp: [{ id: 'r_manga', accionId: 'manga', xp: 15, maximo: 1, periodo: 'dia', validaDesde: '2026-11-01' }],
    compromisos: [{ id: 'manga:2026-11-10', accionId: 'manga', fecha: '2026-11-10', estado: 'completado', minutos: 30, extra: true, actualizado: 1 }, { basura: 1 }],
    diasCerrados: [{ fecha: '2026-11-10', cumplidos: 1, programados: 1, porcentaje: 100, minutosJuego: 0, cerradoEn: 1 }],
    excepciones: [{ fecha: '2026-11-11', motivo: 'Viaje', creado: 1 }],
  })
  assert.deepEqual(n, { acciones: 1, reglasXp: 1, compromisos: 1, diasCerrados: 1, excepciones: 1, atributosDiarios: 0 })
  const c = (await dia.compromisosDelDia(id, '2026-11-10'))[0]
  assert.equal(c.extra, true)
  assert.equal(c.accion.minutosExtra, 30)
  assert.equal((await dia.importar(id, { compromisos: [{ id: 'manga:2026-11-10', accionId: 'manga', fecha: '2026-11-10', estado: 'omitido' }] })).compromisos, 0)
})

test('cada persona ve solo lo suyo', async () => {
  const ana = await persona({ nombre: 'Ana' })
  const beto = await persona({ nombre: 'Beto' })
  await dia.completar(ana, `manga:${LUNES}`)
  assert.equal((await dia.pilaresDelDia(beto, LUNES)).cumplidos, 0)
  assert.equal((await dia.pilaresDelDia(ana, LUNES)).cumplidos, 1)
})

test('web: la API de dia pide sesión, siembra los pilares al crear la cuenta y marca', async () => {
  reloj.fijar(a(LUNES, '10:00'))
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/dia' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'webdia@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const sinCiclo = (await app.inject({ url: '/api/dia', headers: { cookie } })).json()
  assert.equal(sinCiclo.ciclo, null)
  assert.equal(sinCiclo.pilares.length, 4)
  await app.inject({ method: 'POST', url: '/api/ciclo/iniciar', headers: { cookie }, payload: { inicio: LUNES } })
  const hoy = (await app.inject({ url: '/api/dia', headers: { cookie } })).json()
  assert.equal(hoy.pilares.find((p) => p.accion.id === 'manga').estado, 'pendiente')
  const m = await app.inject({ method: 'POST', url: `/api/dia/compromisos/${encodeURIComponent(`manga:${LUNES}`)}/completar`, headers: { cookie }, payload: { minutos: 20 } })
  assert.equal(m.statusCode, 200)
  assert.equal(m.json().xp, 15)
  assert.equal((await app.inject({ url: '/api/dia/cumplimiento?desde=2026-11-23&hasta=x', headers: { cookie } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'POST', url: '/api/dia/tajo', headers: { cookie } })).json().mostrar, false)
  await app.close()
})
