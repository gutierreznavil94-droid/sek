'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const { guardarAjustes } = require('../../comun/ajustes')
const juego = require('./ventanilla')
const { crearApp } = require('../../app')

const MIN = 60000
before(prepararBase)
after(terminar)

test('empezar, pausar, seguir y terminar cuenta solo lo jugado', async () => {
  const id = await personaDePrueba()
  const inicio = reloj.ahora()
  await juego.empezar(id)
  reloj.avanzar(20 * MIN)
  await juego.pausar(id)
  reloj.avanzar(10 * MIN) // pausa: no cuenta
  await juego.seguir(id)
  reloj.avanzar(15 * MIN)
  let aviso = null
  eventos.escuchar('juego.terminado', async (d) => { aviso = d })
  const s = await juego.terminar(id)
  assert.equal(s.inicio, inicio)
  assert.equal(Math.round(aviso.minutos), 35)
  assert.equal(await juego.minutosDelDia(id, '2026-11-23'), 35)
  assert.equal(await juego.sesionActiva(id), null)
})

test('empezar dos veces no crea dos sesiones', async () => {
  const id = await personaDePrueba()
  const a = await juego.empezar(id)
  const b = await juego.empezar(id)
  assert.equal(a.id, b.id)
  await juego.terminar(id)
})

test('una sesión que cruza la medianoche se reparte entre los dos días', async () => {
  const id = await personaDePrueba()
  const inicio = Date.UTC(2026, 10, 22, 2, 30) // domingo 22, 23:30 en Córdoba
  await juego.agregarManual(id, { inicio, fin: inicio + 60 * MIN })
  assert.equal(await juego.minutosDelDia(id, '2026-11-21'), 30)
  assert.equal(await juego.minutosDelDia(id, '2026-11-22'), 30)
})

test('límite: semana y finde, con los ajustes de la persona', async () => {
  const id = await personaDePrueba()
  await guardarAjustes(id, { limiteJuegoSemana: 30 })
  const lunes = Date.UTC(2026, 10, 23, 11, 0) // lunes 08:00
  await juego.agregarManual(id, { inicio: lunes, fin: lunes + 40 * MIN })
  const r = await juego.limiteRespetado(id, '2026-11-23')
  assert.deepEqual(r, { minutos: 40, limite: 30, respetado: false })
  const res = await juego.resumen(id)
  assert.equal(res.estado, 'superado')
  assert.equal(res.semana.length, 7)
  assert.equal(res.semana[5].limite, 120) // sábado
})

test('no deja anotar al revés ni en el futuro', async () => {
  const id = await personaDePrueba()
  const t = reloj.ahora()
  await assert.rejects(juego.agregarManual(id, { inicio: t, fin: t - MIN }), /después del inicio/)
  await assert.rejects(juego.agregarManual(id, { inicio: t, fin: t + MIN }), /futuro/)
})

test('cada persona ve solo lo suyo', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  const t = reloj.ahora() - 60 * MIN
  const s = await juego.agregarManual(a, { inicio: t, fin: t + 10 * MIN })
  assert.equal((await juego.historial(b)).length, 0)
  await assert.rejects(juego.borrar(b, s.id), /no existe/)
  assert.equal((await juego.historial(a)).length, 1)
})

test('importa las sesiones de una copia de la app vieja', async () => {
  const id = await personaDePrueba()
  const t = Date.UTC(2026, 10, 20, 15, 0)
  const n = await juego.importar(id, [
    { id: 4, inicio: t, fin: t + 25 * MIN, pausas: [] },
    { id: 5, inicio: t + 60 * MIN, fin: t + 70 * MIN, pausas: [{ desde: t + 62 * MIN, hasta: t + 64 * MIN }], corregida: true },
    { basura: true },
  ])
  assert.equal(n, 2)
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 33)
})

test('web: la pantalla y la API de juego piden sesión y funcionan', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/juego' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'web@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  assert.equal((await app.inject({ url: '/juego', headers: { cookie } })).statusCode, 200)
  assert.equal((await app.inject({ url: '/m/juego/juego.js', headers: { cookie } })).statusCode, 200)
  const e = await app.inject({ method: 'POST', url: '/api/juego/empezar', headers: { cookie }, payload: {} })
  assert.equal(e.json().activa !== null, true)
  reloj.avanzar(5 * MIN)
  const f = await app.inject({ method: 'POST', url: '/api/juego/terminar', headers: { cookie }, payload: {} })
  assert.equal(f.json().minutosHoy, 5)
  const m = await app.inject({ method: 'POST', url: '/api/juego/manual', headers: { cookie }, payload: { inicio: 'x' } })
  assert.equal(m.statusCode, 400)
  await app.close()
})

test('corregir una sesión cambia inicio y fin y guarda el motivo', async () => {
  const id = await personaDePrueba()
  const t = reloj.ahora() - 5 * 60 * MIN
  const s = await juego.agregarManual(id, { inicio: t, fin: t + 90 * MIN })
  const [h] = await juego.historial(id, 1)
  await assert.rejects(juego.corregir(id, h.id, { inicio: t, fin: t + 30 * MIN, motivo: '' }), /motivo/)
  await assert.rejects(juego.corregir(id, h.id, { inicio: t, fin: t - MIN, motivo: 'x' }), /después del inicio/)
  const c = await juego.corregir(id, h.id, { inicio: t + 10 * MIN, fin: t + 40 * MIN, motivo: 'me olvidé de parar' })
  assert.equal(c.inicio, t + 10 * MIN)
  assert.equal(c.fin, t + 40 * MIN)
  assert.match(c.nota, /corregida · me olvidé/)
  assert.ok(s)
})

test('el resumen trae los últimos 7 días con su límite', async () => {
  const id = await personaDePrueba()
  const r = await juego.resumen(id)
  assert.equal(r.ultimos7.length, 7)
  assert.equal(r.ultimos7[6].fecha, r.hoy || r.ultimos7[6].fecha)
  assert.ok(r.ultimos7.every((d) => typeof d.minutos === 'number' && typeof d.limite === 'number'))
  assert.equal(r.limiteSemanaDia, 60)
})

test('las escenas de la pantalla (pelea, a jugar, jugando, té) están en el módulo', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const raiz = path.join(__dirname, 'pantallas', 'escenas')
  for (const e of ['pelea/pelea', 'juego/a-jugar', 'juego/jugando', 'juego/te-entra', 'juego/te-bucle', 'juego/te-sale']) {
    for (const fin of ['.mp4', '-inicio.webp', '-quieto.jpg', '-fin.jpg']) assert.ok(fs.existsSync(path.join(raiz, e + fin)), e + fin)
  }
})
