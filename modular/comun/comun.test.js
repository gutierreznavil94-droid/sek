'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('./prueba')
const sesion = require('./sesion')
const ajustes = require('./ajustes')
const eventos = require('./eventos')
const base = require('./base')
const { crearApp } = require('../app')

before(prepararBase)
after(terminar)

test('la contraseña se guarda con hash y se reconoce', async () => {
  const h = await sesion.hashear('una-clave-larga')
  assert.ok(h.startsWith('pbkdf2:'))
  assert.ok(!h.includes('una-clave-larga'))
  assert.equal(await sesion.claveCorrecta('una-clave-larga', h), true)
  assert.equal(await sesion.claveCorrecta('otra', h), false)
})

test('crear cuenta pide email válido y clave de 8', async () => {
  await assert.rejects(sesion.crearUsuario({ nombre: 'A', email: 'malo', clave: '12345678' }), /email/)
  await assert.rejects(sesion.crearUsuario({ nombre: 'A', email: 'a@b.com', clave: '123' }), /8 caracteres/)
})

test('ajustes: devuelve los iniciales y guarda solo campos conocidos', async () => {
  const id = await personaDePrueba()
  assert.equal((await ajustes.obtenerAjustes(id)).limiteJuegoSemana, 60)
  const a = await ajustes.guardarAjustes(id, { limiteJuegoSemana: 45, inventado: 1 })
  assert.equal(a.limiteJuegoSemana, 45)
  assert.equal(a.inventado, undefined)
  assert.equal((await ajustes.obtenerAjustes(id)).limiteJuegoFinde, 120)
})

test('transacción: si algo falla, no queda nada', async () => {
  const id = await personaDePrueba()
  await assert.rejects(base.transaccion(async (tx) => {
    await ajustes.guardarAjustes(id, { nombrePersona: 'Navil' }, tx)
    throw new Error('falla a propósito')
  }))
  assert.equal((await ajustes.obtenerAjustes(id)).nombrePersona, '')
})

test('eventos: avisa a quien escucha', async () => {
  let recibido = null
  const quitar = eventos.escuchar('prueba.algo', async (d) => { recibido = d })
  await eventos.avisar('prueba.algo', { x: 1 })
  quitar()
  assert.deepEqual(recibido, { x: 1 })
})

test('web: crear cuenta, ver yo, salir', async () => {
  const app = crearApp({ logger: false })
  const r1 = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Navil', email: 'navil@prueba.com', clave: 'clave-segura' } })
  assert.equal(r1.statusCode, 200)
  const cookie = r1.headers['set-cookie'].split(';')[0]
  assert.match(r1.headers['set-cookie'], /HttpOnly/)
  const r2 = await app.inject({ method: 'GET', url: '/api/sesion/yo', headers: { cookie } })
  assert.equal(r2.json().usuario.nombre, 'Navil')
  const r3 = await app.inject({ method: 'GET', url: '/api/sesion/yo' })
  assert.equal(r3.statusCode, 401)
  const r4 = await app.inject({ method: 'GET', url: '/hoy' })
  assert.equal(r4.statusCode, 302)
  assert.equal(r4.headers.location, '/entrar')
  await app.inject({ method: 'POST', url: '/api/sesion/salir', headers: { cookie }, payload: {} })
  const r5 = await app.inject({ method: 'GET', url: '/api/sesion/yo', headers: { cookie } })
  assert.equal(r5.statusCode, 401)
  const r6 = await app.inject({ method: 'POST', url: '/api/sesion/entrar', payload: { email: 'NAVIL@prueba.com', clave: 'mal-clave' } })
  assert.equal(r6.statusCode, 401)
  await app.close()
})

test('web: sirve lo común y no deja salir de la carpeta', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/comun/estilo.css' })).statusCode, 200)
  assert.equal((await app.inject({ url: '/entrar' })).statusCode, 200)
  assert.equal((await app.inject({ url: '/comun/../app.js' })).statusCode, 404)
  assert.equal((await app.inject({ url: '/comun/%2e%2e/app.js' })).statusCode, 404)
  await app.close()
})
