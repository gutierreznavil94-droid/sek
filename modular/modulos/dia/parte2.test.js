'use strict'
/** Pruebas de dia, parte 2: feriados, fechas clave, Mi horario, Calendario, el tablero de Hoy y el bloqueo del modo sueño. */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const { instanteDe } = require('../../comun/fechas')
const ciclo = require('../ciclo/ventanilla')
const juego = require('../juego/ventanilla')
const organizacion = require('../organizacion/ventanilla')
const dia = require('./ventanilla')
const agenda = require('./agenda')
const { crearApp } = require('../../app') // conecta los feriados a juego y escucha los avisos

const a = (fecha, hora) => instanteDe(fecha, hora)
const MARTES = '2026-11-24'
const MIERCOLES = '2026-11-25'

before(prepararBase)
after(terminar)

async function persona({ conCiclo = true, ahora = a(MARTES, '10:00') } = {}) {
  reloj.fijar(ahora)
  const id = await personaDePrueba('Parte2')
  await ciclo.sembrar(id)
  await dia.sembrar(id)
  if (conCiclo) await ciclo.iniciarCiclo(id, { inicio: MARTES })
  return id
}

// ---------- cuentas puras ----------

test('agenda: feriado apaga lo obligatorio, momento y huecos del día', () => {
  const config = agenda.normalizarConfig({ activo: 'h', horarios: [{ id: 'h', nombre: 'Mi horario', bloques: [
    { id: 'b1', nombre: 'Facultad', tipo: 'obligatorio', dias: [2], desde: '08:00', hasta: '12:00' },
    { id: 'b2', nombre: 'Inglés', tipo: 'otro', dias: [2], desde: '15:00', hasta: '16:00' },
  ] }], excepciones: {} })
  const ajustes = { horaDormido: '21:20', horaFinSuenio: '06:00' }
  const normal = agenda.bloquesDelDia({ config, fecha: MARTES, ajustes }).filter((b) => b.tipo !== 'dormir')
  assert.deepEqual(normal.map((b) => b.id), ['b1', 'b2'])
  const feriado = agenda.bloquesDelDia({ config, fecha: MARTES, feriado: true, ajustes }, { conApagados: true }).find((b) => b.id === 'b1')
  assert.equal(feriado.motivoApagado, 'feriado')
  const m = agenda.momento(normal, 10 * 60, '20:50')
  assert.equal(m.ahora.nombre, 'Facultad')
  assert.equal(m.libres, 180) // de 12:00 a 15:00
  assert.equal(agenda.textoMomento(m), 'Ahora: Facultad hasta 12:00 · después: Inglés 15:00')
  assert.deepEqual(agenda.huecos(normal, '06:00', '20:50').map((h) => `${h.desde}-${h.hasta}`), ['06:00-08:00', '12:00-15:00', '16:00-20:50'])
  assert.deepEqual(agenda.validarBloque({ nombre: 'x', desde: '10:00', hasta: '09:00', dias: [1] }), ['«Hasta» tiene que ser después de «desde».'])
  // Fecha clave anual: cae cada año desde la suya, no antes.
  const fc = { id: 'f', fecha: '2026-12-01', titulo: 'Cumple', anual: true, creada: 1 }
  assert.ok(agenda.caeEn(fc, '2027-12-01'))
  assert.ok(!agenda.caeEn(fc, '2025-12-01'))
  assert.deepEqual(Object.keys(agenda.fechasClavePorDia([fc], '2026-11-01', '2027-12-31')), ['2026-12-01', '2027-12-01'])
})

// ---------- feriados ----------

test('feriados: vienen cargados, se marcan y quitan, y el juego usa el límite de finde', async () => {
  const id = await persona()
  assert.ok(await dia.esFeriado(id, '2026-12-25'))
  assert.ok(!(await dia.esFeriado(id, MIERCOLES)))
  assert.equal((await juego.limiteRespetado(id, MIERCOLES)).limite, 60)
  await dia.marcarFeriado(id, MIERCOLES, 'Feriado puente')
  assert.ok(await dia.esDiaDeFinde(id, MIERCOLES))
  assert.equal((await juego.limiteRespetado(id, MIERCOLES)).limite, 120)
  assert.equal((await dia.feriadosEntre(id, MIERCOLES, MIERCOLES))[0].nombre, 'Feriado puente')
  assert.equal(await dia.quitarFeriado(id, MIERCOLES), true)
  assert.equal((await juego.limiteRespetado(id, MIERCOLES)).limite, 60)
  await assert.rejects(dia.marcarFeriado(id, '2026-13-01'), /no es válida/)
})

// ---------- fechas clave y calendario ----------

test('fechas clave y calendario del mes: cumplimiento, feriado, excepción, fecha clave y Día 1', async () => {
  const id = await persona()
  const fc = await dia.agregarFechaClave(id, { fecha: MIERCOLES, titulo: 'Ingreso a la facultad', hora: '09:00', horaFin: '11:00' })
  assert.equal(fc.titulo, 'Ingreso a la facultad')
  await assert.rejects(dia.agregarFechaClave(id, { fecha: MIERCOLES, titulo: '  ' }), /título/)
  await assert.rejects(dia.agregarFechaClave(id, { fecha: MIERCOLES, titulo: 'x', hora: '10:00', horaFin: '09:00' }), /después/)
  await dia.editarFechaClave(id, fc.id, { nota: 'Llevar DNI' })
  await dia.marcarExcepcion(id, MARTES, 'Enfermo')
  const cal = await dia.calendarioMes(id, '2026-11')
  assert.equal(cal.dias.length, 30)
  assert.equal(cal.ciclo.inicio, MARTES)
  assert.equal(cal.ciclo.fin, '2027-02-21')
  const mar = cal.dias.find((d) => d.fecha === MARTES)
  assert.equal(mar.hoy, true)
  assert.equal(mar.excepcion.motivo, 'Enfermo')
  const mie = cal.dias.find((d) => d.fecha === MIERCOLES)
  assert.equal(mie.fechasClave[0].nota, 'Llevar DNI')
  assert.ok(mie.bloques.some((b) => b.nombre === 'Ingreso a la facultad' && b.desde === '09:00'))
  assert.equal(cal.dias.find((d) => d.fecha === '2026-11-23').feriado.nombre.startsWith('Día de la Soberanía'), true)
  await dia.borrarFechaClave(id, fc.id)
  await assert.rejects(dia.borrarFechaClave(id, fc.id), /no existe|Esa fecha clave/)
  await assert.rejects(dia.calendarioMes(id, '2026-13'), /AAAA-MM/)
})

// ---------- Mi horario ----------

test('Mi horario: bloques, apagar un día, copiar, otro horario y el entreno escribe en su pilar', async () => {
  const id = await persona()
  // El entreno de fábrica (07:00, «Empezar hasta» 19:35) ocupa casi todo el día: primero se acomoda.
  await dia.guardarBloque(id, { id: 'entreno', nombre: 'Entreno', tipo: 'entreno', dias: [2, 4], desde: '18:00', hasta: '18:30' })
  const b = await dia.guardarBloque(id, { nombre: 'Facultad', tipo: 'obligatorio', dias: [2, 3], desde: '08:00', hasta: '12:00' })
  await assert.rejects(dia.guardarBloque(id, { nombre: 'Mal', dias: [2], desde: '12:00', hasta: '08:00' }), /después/)
  let h = await dia.horarioDelDia(id, MARTES)
  assert.equal(h.momento.ahora.nombre, 'Facultad')
  assert.match(h.momento.texto, /^Ahora: Facultad hasta 12:00/)
  await dia.apagarBloqueEnFecha(id, MARTES, b.id, true)
  h = await dia.horarioDelDia(id, MARTES)
  assert.equal(h.bloques.find((x) => x.id === b.id).apagado, true)
  assert.equal(h.momento.ahora, null)
  await dia.apagarBloqueEnFecha(id, MARTES, b.id, false)
  await dia.copiarADias(id, b.id, [4])
  assert.deepEqual((await dia.configHorario(id)).horarios[0].bloques[0].dias, [2, 3, 4])
  // El entreno: cambió días y hora del pilar; los pendientes desde hoy tomaron la hora nueva.
  const acc = (await dia.acciones(id)).find((x) => x.id === 'entrenamiento')
  assert.deepEqual([acc.dias, acc.hora, acc.horaLimiteInicio], [[2, 4], '18:00', '18:30'])
  assert.equal((await dia.compromisosDelDia(id, MARTES)).find((c) => c.accionId === 'entrenamiento').horaPrevista, '18:00')
  await dia.correrEntreno(id, MARTES, '19:30')
  assert.equal((await dia.horarioDelDia(id, MARTES)).bloques.find((x) => x.id === 'entreno').desde, '19:30')
  // Otro horario (vacaciones), sin bloques; volver al primero.
  const vac = await dia.nuevoHorario(id, 'Vacaciones', false)
  assert.equal((await dia.horarioSemana(id, MARTES)).activo.nombre, 'Vacaciones')
  assert.ok(!(await dia.horarioDelDia(id, MARTES)).bloques.some((x) => x.id === b.id))
  await dia.borrarHorario(id, vac.id)
  await assert.rejects(dia.borrarHorario(id, (await dia.configHorario(id)).activo), /al menos un horario/)
  await assert.rejects(dia.borrarBloque(id, 'entreno'), /pilares/)
  await dia.borrarBloque(id, b.id)
  // Un feriado apaga lo obligatorio.
  const f = await dia.guardarBloque(id, { nombre: 'Trabajo', tipo: 'obligatorio', dias: [3], desde: '09:00', hasta: '18:00' })
  await dia.marcarFeriado(id, MIERCOLES)
  assert.equal((await dia.horarioDelDia(id, MIERCOLES)).bloques.find((x) => x.id === f.id).motivoApagado, 'feriado')
})

// ---------- Hoy como tablero ----------

test('Hoy: sin ciclo pide «Empezar mi ciclo»; después junta pilares y la tarjeta de cada módulo', async () => {
  const id = await persona({ conCiclo: false })
  let t = await dia.tableroHoy(id)
  assert.equal(t.sinCiclo, true)
  await dia.empezarCiclo(id, {})
  await assert.rejects(dia.empezarCiclo(id, {}), /Ya tenés un ciclo/)
  t = await dia.tableroHoy(id)
  assert.equal(t.sinCiclo, false)
  assert.equal(t.ciclo.dia, 1)
  assert.equal(t.pilares.length, 4)
  assert.equal(t.modoSueno, false)
  assert.equal(t.nivel.nivel, 1)
  for (const k of ['juego', 'sueno', 'comida', 'entreno', 'habitos', 'organizacion']) assert.ok(t.tarjetas[k], `falta la tarjeta ${k}`)
  // desafios: app.js le conecta su `pendientes` (Tensión y No cumplí).
  assert.match(t.tarjetas.desafios.noCumpli.ruta, /^\/desafios\/no-cumpli/)
  dia.conectar({ desafiosHoy: async () => ({ tension: { ruta: '/desafios/tension', activa: true }, noCumpli: { ruta: '/desafios/no-cumpli' }, pendientes: [] }) })
  assert.equal((await dia.tableroHoy(id)).tarjetas.desafios.noCumpli.ruta, '/desafios/no-cumpli')
  dia.conectar({ desafiosHoy: async () => { throw new Error('roto') } })
  assert.equal((await dia.tableroHoy(id)).tarjetas.desafios, null) // una tarjeta rota no rompe Hoy
  dia.conectar({ desafiosHoy: require('../desafios/ventanilla').pendientes })
})

test('Hoy: la tira «Hoy me toca a mí» marca la tarea en organizacion', async () => {
  const id = await persona()
  const { datos: d } = await organizacion.leer(id)
  const frente = { id: 'f1', nombre: 'Facultad', color: '#C8102E', icono: '', tipo: 'normal', tareas: [{ id: 't1', texto: 'Leer apunte', estado: 'pendiente', fecha: MARTES }] }
  d.frentes = [frente]
  await organizacion.guardar(id, d)
  const antes = (await dia.tableroHoy(id)).tarjetas.organizacion
  assert.deepEqual(antes.tareas.map((x) => x.tarea.texto), ['Leer apunte'])
  const r = await dia.tareaHecha(id, 'f1', 't1')
  assert.equal(r.hechas, 1)
  assert.equal(r.tareas.length, 0) // lo hecho sale de la tira
})

test('«Dejo celu» desde Hoy: no antes del Día 1; después prende el modo sueño y bloquea las pantallas', async () => {
  const id = await persona({ conCiclo: false, ahora: a(MARTES, '21:00') })
  await assert.rejects(dia.dejoCeluDesdeHoy(id), /todavía no empezó/)
  await ciclo.iniciarCiclo(id, { inicio: MARTES })
  const r = await dia.dejoCeluDesdeHoy(id)
  assert.equal(r.cumplido, true)
  assert.equal(await dia.enModoSueno(id), true)
  const p = (await dia.pilaresDelDia(id, MARTES)).pilares.find((x) => x.accion.id === 'acostarse')
  assert.equal(p.estado, 'cumplido')
  assert.equal(dia.esPaginaBloqueable('/hoy'), true)
  assert.equal(dia.esPaginaBloqueable('/sueno/modo'), false)
  assert.equal(dia.esPaginaBloqueable('/api/dia/hoy'), false)
  assert.equal(dia.esPaginaBloqueable('/m/dia/hoy.js'), false)
})

// ---------- web ----------

test('web: pantallas de dia, /api/dia/hoy, empezar el ciclo, feriados y el bloqueo del modo sueño', async () => {
  reloj.fijar(a(MARTES, '21:00'))
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/dia/hoy' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web2', email: 'webdia2@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pide = (url, opciones = {}) => app.inject({ url, headers: { cookie }, ...opciones })
  for (const ruta of ['/hoy', '/calendario', '/horario']) {
    const x = await pide(ruta)
    assert.equal(x.statusCode, 200, ruta)
    assert.match(x.headers['content-type'], /text\/html/)
  }
  assert.equal((await pide('/api/dia/hoy')).json().sinCiclo, true)
  assert.equal((await pide('/api/dia/empezar-ciclo', { method: 'POST', payload: { inicio: MARTES } })).statusCode, 200)
  assert.equal((await pide('/api/dia/hoy')).json().sinCiclo, false)
  assert.equal((await pide('/api/dia/calendario?mes=2026-11')).json().dias.length, 30)
  assert.equal((await pide('/api/dia/calendario?mes=nov')).statusCode, 400)
  assert.equal((await pide(`/api/dia/feriados/${MIERCOLES}`, { method: 'PUT', payload: { nombre: 'Puente' } })).statusCode, 200)
  assert.equal((await pide(`/api/dia/feriados?desde=${MIERCOLES}&hasta=${MIERCOLES}`)).json().feriados[0].nombre, 'Puente')
  const bloque = await pide('/api/dia/horario/bloques', { method: 'POST', payload: { nombre: 'Facultad', tipo: 'obligatorio', dias: [1, 2], desde: '08:00', hasta: '12:00' } })
  assert.equal(bloque.statusCode, 200)
  assert.equal((await pide('/api/dia/horario')).json().dias.length, 7)
  // «Dejo celu» → modo sueño: las pantallas mandan a /sueno/modo; la del modo y la API siguen andando.
  assert.equal((await pide('/api/dia/dejo-celu', { method: 'POST' })).statusCode, 200)
  const bloqueada = await pide('/calendario')
  assert.equal(bloqueada.statusCode, 302)
  assert.equal(bloqueada.headers.location, '/sueno/modo')
  assert.equal((await pide('/sueno/modo')).statusCode, 200)
  assert.equal((await pide('/api/dia/hoy')).json().modoSueno, true)
  assert.equal((await app.inject({ url: '/entrar' })).statusCode, 200)
  await app.close()
})

test('importar: feriados, fechas clave y horario de la app vieja (lo repetido no entra)', async () => {
  const id = await persona()
  const vieja = {
    feriados: [{ fecha: '2027-02-15', nombre: 'Carnaval', propio: true }, { fecha: '2026-12-25', nombre: 'Navidad' }],
    fechasClave: [{ id: 'fc1', fecha: '2027-03-01', titulo: 'Arranca la facultad', anual: false, creada: 1 }, { id: 'rota', fecha: 'x', titulo: 'Mal' }],
    horario: { activo: 'horario-1', horarios: [{ id: 'horario-1', nombre: 'Mi horario', bloques: [{ id: 'b', nombre: 'Taller', tipo: 'obligatorio', dias: [1], desde: '14:00', hasta: '18:00' }, { id: 'mal', nombre: '', dias: [], desde: 'x', hasta: 'y' }] }], excepciones: {} },
  }
  const n = await dia.importar(id, vieja)
  assert.deepEqual([n.feriados, n.fechasClave, n.horario], [1, 1, 1])
  assert.deepEqual((await dia.configHorario(id)).horarios[0].bloques.map((b) => b.id), ['b'])
  const otra = await dia.importar(id, vieja)
  assert.deepEqual([otra.feriados, otra.fechasClave, otra.horario], [0, 0, 0])
})
