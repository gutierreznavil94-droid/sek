'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const eventos = require('../../comun/eventos')
const { guardarAjustes } = require('../../comun/ajustes')
const M = require('./modelo')
const org = require('./ventanilla')
const { crearApp } = require('../../app')

const HOY = '2026-11-23' // la hora fija de las pruebas: lunes 23 nov 2026, 10:00 en Córdoba
before(prepararBase)
after(terminar)

const tarea = (id, extra = {}) => ({ id, texto: 'tarea ' + id, estado: 'por_hacer', quien: 'yo', creada: 1, ...extra })

// ---------- Reglas (modelo.js, las mismas que usa la pantalla) ----------

test('modelo: arranca con Sueltas y Personal, y normalizar agrega Sueltas si falta', () => {
  const d = M.datosIniciales(HOY)
  assert.deepEqual(d.frentes.map((f) => f.id), ['sueltas', 'personal'])
  const viejo = M.normalizar({ frentes: [{ id: 'x', nombre: 'X', icono: '', color: '#fff', tareas: [{ id: 'a', texto: 'algo', estado: 'esperando' }] }] }, HOY)
  assert.equal(viejo.frentes[0].tipo, 'sueltas')
  assert.equal(viejo.frentes[1].tareas[0].estado, 'por_hacer')
  assert.equal(viejo.frentes[1].tareas[0].quien, 'yo')
  assert.equal(viejo.ajustes.limiteHoy, 3)
  assert.equal(M.normalizar('basura', HOY).frentes.length, 2)
})

test('modelo: Clasificar exige todo y deja la tarea en el frente', () => {
  const d = M.datosIniciales(HOY)
  const it = M.anotar(d, 'Llamar a Facu', 'personal')
  assert.deepEqual(M.faltan({ quien: 'yo' }), ['imp', 'rapidez', 'donde', 'fecha'])
  assert.deepEqual(M.faltan({ quien: 'delegar', imp: 'alta', rapidez: 'rapida', donde: 'nada', fecha: 'libre' }), ['quien'])
  assert.equal(M.clasificar(d, it.id, 'personal', { quien: 'yo' }, HOY), null)
  const t = M.clasificar(d, it.id, 'personal', { quien: 'yo', imp: 'alta', rapidez: 'rapida', donde: 'nada', fecha: HOY }, HOY)
  assert.equal(t.texto, 'Llamar a Facu')
  assert.equal(t.fecha, HOY)
  assert.equal(t.donde, undefined)
  assert.equal(d.bandeja.length, 0)
  assert.equal(M.meToca(d, HOY).length, 1)
})

test('modelo: «Hoy me toca a mí» es solo lo mío con fecha de hoy o vencida', () => {
  const d = M.datosIniciales(HOY)
  d.frentes[1].tareas.push(
    tarea('1', { fecha: HOY }), tarea('2', { fecha: '2026-11-01' }), tarea('3', { fecha: '2026-11-24' }),
    tarea('4', { quien: 'delegar', quienNombre: 'Facu', fecha: HOY }), tarea('5', { estado: 'hecho', fecha: HOY }), tarea('6'),
  )
  assert.deepEqual(M.meToca(d, HOY).map((x) => x.t.id), ['2', '1'])
})

test('modelo: eliminar borra el frente con sus tareas; Sueltas no se elimina ni se finaliza', () => {
  const d = M.datosIniciales(HOY)
  const f = M.nuevoFrente(d, HOY, 'Tumi')
  f.tareas.push(tarea('a'))
  assert.equal(M.eliminarFrente(d, 'sueltas'), null)
  assert.equal(M.finalizarFrente(d, 'sueltas', HOY), null)
  assert.equal(M.eliminarFrente(d, f.id).nombre, 'Tumi')
  assert.equal(d.frentes.some((x) => x.id === f.id), false)
})

test('modelo: sugerir solo resalta y aprende cuando se elige otro', () => {
  const d = M.datosIniciales(HOY)
  const obras = M.nuevoFrente(d, HOY, 'Obras')
  obras.palabras = ['fibra', 'postes']
  assert.equal(M.sugerir(d, 'Revisar postes de la fibra').f, obras)
  const it = M.anotar(d, 'Revisar postes de la fibra')
  M.clasificar(d, it.id, 'personal', { quien: 'yo', imp: 'baja', rapidez: 'lenta', donde: 'calle', fecha: 'libre' }, HOY)
  assert.ok(obras.no.includes('postes'))
  d.ajustes.sugerir = false
  assert.equal(M.sugerir(d, 'Revisar postes de la fibra'), null)
})

test('modelo: el límite va de 1 a 9 y las fechas se cuentan bien', () => {
  const d = M.datosIniciales(HOY)
  for (let i = 0; i < 20; i++) M.cambiarLimite(d, 1)
  assert.equal(d.ajustes.limiteHoy, 9)
  for (let i = 0; i < 20; i++) M.cambiarLimite(d, -1)
  assert.equal(d.ajustes.limiteHoy, 1)
  assert.equal(M.sumarDias('2026-11-30', 1), '2026-12-01')
  assert.equal(M.cuando('2026-11-22', HOY), 'atrasada')
  assert.equal(M.cuando('2026-11-24', HOY), 'mañana')
})

// ---------- Ventanilla (base) ----------

test('leer sin nada guardado da Sueltas y Personal; guardar y volver a leer', async () => {
  const id = await personaDePrueba()
  const r = await org.leer(id)
  assert.equal(r.hoy, HOY)
  assert.equal(r.actualizado, 0)
  const d = r.datos
  M.anotar(d, 'Pagar la luz')
  const g = await org.guardar(id, d)
  assert.ok(g.actualizado > 0)
  const otra = await org.leer(id)
  assert.equal(otra.datos.bandeja[0].texto, 'Pagar la luz')
  assert.equal(otra.actualizado, g.actualizado)
})

test('guardar avisa organizacion.tarea.hecha solo por las que recién se hicieron', async () => {
  const id = await personaDePrueba()
  const { datos: d } = await org.leer(id)
  d.frentes[1].tareas.push(tarea('a', { fecha: HOY }), tarea('b', { fecha: HOY }))
  let g = await org.guardar(id, d)
  const avisos = []
  const soltar = eventos.escuchar('organizacion.tarea.hecha', async (x) => { avisos.push(x) })
  M.marcar(d, 'personal', 'a', 'hecho', HOY)
  g = await org.guardar(id, d, g.actualizado)
  await org.guardar(id, d, g.actualizado) // guardar lo mismo otra vez no vuelve a avisar
  soltar()
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].usuarioId, id)
  assert.equal(avisos[0].tarea.id, 'a')
  assert.equal(avisos[0].frente.nombre, 'Personal')
})

test('si otro teléfono guardó en el medio, no pisa (409)', async () => {
  const id = await personaDePrueba()
  const { datos: d } = await org.leer(id)
  const a = await org.guardar(id, d)
  await org.guardar(id, d, a.actualizado)
  await assert.rejects(org.guardar(id, d, a.actualizado), (e) => e.estado === 409)
  await assert.rejects(org.guardar(id, { nada: 1 }), /vinieron mal/)
})

test('resumenHoy y marcarHecha (para la tira de Hoy), con la zona de la persona', async () => {
  const id = await personaDePrueba()
  const { datos: d } = await org.leer(id)
  d.frentes[1].tareas.push(tarea('a', { fecha: HOY }), tarea('b', { fecha: '2026-11-24' }))
  await org.guardar(id, d)
  let r = await org.resumenHoy(id)
  assert.deepEqual(r.tareas.map((x) => x.tarea.id), ['a'])
  assert.equal(r.tareas[0].frente.nombre, 'Personal')
  assert.equal(r.limite, 3)
  // En Kiritimati (UTC+14) ya es martes 24: también le toca la «b».
  await guardarAjustes(id, { zonaHoraria: 'Pacific/Kiritimati' })
  r = await org.resumenHoy(id)
  assert.equal(r.hoy, '2026-11-24')
  assert.equal(r.meToca, 2)
  const avisos = []
  const soltar = eventos.escuchar('organizacion.tarea.hecha', async (x) => { avisos.push(x.tarea.id) })
  r = await org.marcarHecha(id, 'personal', 'a')
  soltar()
  assert.deepEqual(avisos, ['a'])
  assert.equal(r.meToca, 1)
  assert.equal(r.hechas, 1)
  await assert.rejects(org.marcarHecha(id, 'personal', 'no-existe'), /no existe/)
})

test('importa Organización de una copia de la app vieja (tabla o datos sueltos)', async () => {
  const id = await personaDePrueba()
  const viejo = { formato: 1, frentes: [{ id: 'tumi', nombre: 'Tumi', icono: '🗺', color: '#3fb0ac', movido: '2026-11-10', tareas: [tarea('x', { fecha: '2026-11-20' })] }], bandeja: [{ id: 'b1', texto: 'algo', creada: 5 }] }
  assert.equal(await org.importar(id, [{ id: 'datos', datos: viejo, actualizado: 9 }]), 1)
  const { datos: d } = await org.leer(id)
  assert.deepEqual(d.frentes.map((f) => f.id), ['sueltas', 'tumi'])
  assert.equal(d.bandeja.length, 1)
  assert.equal((await org.resumenHoy(id)).meToca, 1)
  assert.equal(await org.importar(id, viejo), 1)
  assert.equal(await org.importar(id, []), 0)
  assert.equal(await org.importar(id, null), 0)
})

test('cada persona ve solo lo suyo', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  const { datos: d } = await org.leer(a)
  M.anotar(d, 'secreto de Ana')
  await org.guardar(a, d)
  assert.equal((await org.leer(b)).datos.bandeja.length, 0)
  assert.equal((await org.leer(a)).datos.bandeja.length, 1)
})

// ---------- Web ----------

test('web: la pantalla y la API de organización piden sesión y funcionan', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/organizacion' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Navil', email: 'org@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  assert.equal((await app.inject({ url: '/organizacion', headers: { cookie } })).statusCode, 200)
  for (const f of ['organizacion.js', 'estilo.css', 'modelo.js']) {
    assert.equal((await app.inject({ url: '/m/organizacion/' + f, headers: { cookie } })).statusCode, 200, f)
  }
  const g = await app.inject({ url: '/api/organizacion', headers: { cookie } })
  const { datos, actualizado, nombre, hoy } = g.json()
  assert.equal(nombre, 'Navil')
  assert.equal(hoy, HOY)
  M.anotar(datos, 'Comprar yerba')
  const p = await app.inject({ method: 'PUT', url: '/api/organizacion', headers: { cookie }, payload: { datos, antes: actualizado } })
  assert.equal(p.statusCode, 200)
  assert.equal(p.json().datos.bandeja[0].texto, 'Comprar yerba')
  const viejo = await app.inject({ method: 'PUT', url: '/api/organizacion', headers: { cookie }, payload: { datos, antes: actualizado } })
  assert.equal(viejo.statusCode, 409)
  const mal = await app.inject({ method: 'PUT', url: '/api/organizacion', headers: { cookie }, payload: { otra: 1 } })
  assert.equal(mal.statusCode, 400)
  await app.close()
})
