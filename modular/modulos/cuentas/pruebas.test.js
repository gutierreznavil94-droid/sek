'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const { obtenerAjustes } = require('../../comun/ajustes')
const { entrar, crearUsuario, crearSesion, usuarioDeToken } = require('../../comun/sesion')
const { todas } = require('../../comun/base')
const cuentas = require('./ventanilla')
const { crearApp } = require('../../app')

before(prepararBase)
after(terminar)

test('los ajustes arrancan con los valores iniciales (fases incluidas)', async () => {
  const id = await personaDePrueba()
  const a = await cuentas.ajustes(id)
  assert.equal(a.zonaHoraria, 'America/Argentina/Cordoba')
  assert.equal(a.nombreApp, 'SEK')
  assert.deepEqual(a.nombresFases, ['Disciplina', 'Constancia', 'Mi yo ideal'])
})

test('guardar cambia solo lo que viene y lo ve el resto de la app', async () => {
  const id = await personaDePrueba()
  await cuentas.guardar(id, { limiteJuegoSemana: 45, zonaHoraria: 'America/Montevideo' })
  const a = await obtenerAjustes(id) // como lo lee cualquier otro módulo
  assert.equal(a.limiteJuegoSemana, 45)
  assert.equal(a.zonaHoraria, 'America/Montevideo')
  assert.equal(a.limiteJuegoFinde, 120)
})

test('si un campo está mal no guarda nada', async () => {
  const id = await personaDePrueba()
  await assert.rejects(cuentas.guardar(id, { limiteJuegoSemana: 30, avisoJuegoPorcentaje: 5 }), /entre 10 y 100/)
  await assert.rejects(cuentas.guardar(id, { zonaHoraria: 'Marte/Olimpo' }), /no existe/)
  await assert.rejects(cuentas.guardar(id, { nombreApp: '   ' }), /vacío/)
  await assert.rejects(cuentas.guardar(id, { limiteJuegoFinde: 2.5 }), /entero/)
  await assert.rejects(cuentas.guardar(id, { diaInicioSemana: 3 }), /lunes/)
  assert.equal((await cuentas.ajustes(id)).limiteJuegoSemana, 60)
})

test('ignora lo que no es de cuentas (cada módulo cambia lo suyo)', async () => {
  const id = await personaDePrueba()
  await assert.rejects(cuentas.guardar(id, { tema: 'otro', cualquiera: 1 }), /nada para guardar/)
  assert.equal((await cuentas.ajustes(id)).tema, 'shinobi')
})

test('nombres: recorta espacios y una fase vacía vuelve a su nombre de siempre', async () => {
  const id = await personaDePrueba()
  const a = await cuentas.guardar(id, { nombreApp: '  Kai ', nombrePersona: ' Navil ', nombresFases: ['Fuego', '', 'Yo'] })
  assert.equal(a.nombreApp, 'Kai')
  assert.equal(a.nombrePersona, 'Navil')
  assert.deepEqual(a.nombresFases, ['Fuego', 'Constancia', 'Yo'])
})

test('anota en el historial qué cambió (antes y después)', async () => {
  const id = await personaDePrueba()
  await cuentas.guardar(id, { limiteJuegoFinde: 90, limiteJuegoSemana: 60 }) // 60 es igual: no se anota
  await cuentas.guardar(id, { limiteJuegoFinde: 90 }) // nada cambió: no se anota
  const h = await todas("SELECT tipo, detalle FROM historial WHERE usuario_id = $1 AND modulo = 'cuentas'", [id])
  assert.equal(h.length, 1)
  assert.deepEqual(h[0].detalle, { limiteJuegoFinde: { antes: 120, despues: 90 } })
})

test('cada persona tiene sus ajustes', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  await cuentas.guardar(a, { nombreApp: 'Ana App' })
  assert.equal((await cuentas.ajustes(b)).nombreApp, 'SEK')
})

test('cambiar contraseña: pide la actual, cierra las otras sesiones y deja la de ahora', async () => {
  const u = await crearUsuario({ nombre: 'Clave', email: 'clave@prueba.com', clave: 'vieja-1234' })
  const aca = await crearSesion(u.id)
  const otra = await crearSesion(u.id)
  await assert.rejects(cuentas.cambiarClave(u.id, { actual: 'mal-1234', nueva: 'nueva-1234' }, aca.token), /actual no es esa/)
  await assert.rejects(cuentas.cambiarClave(u.id, { actual: 'vieja-1234', nueva: 'corta' }, aca.token), /8 caracteres/)
  await assert.rejects(cuentas.cambiarClave(u.id, { actual: 'vieja-1234', nueva: 'nueva-1234', repetir: 'otra-1234' }, aca.token), /no son iguales/)
  await cuentas.cambiarClave(u.id, { actual: 'vieja-1234', nueva: 'nueva-1234', repetir: 'nueva-1234' }, aca.token)
  assert.ok(await usuarioDeToken(aca.token))
  assert.equal(await usuarioDeToken(otra.token), null)
  await assert.rejects(entrar('clave@prueba.com', 'vieja-1234'), /incorrectos/)
  assert.ok((await entrar('clave@prueba.com', 'nueva-1234')).token)
})

test('por la web: pantallas, ajustes, contraseña y salir', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/cuentas' })).statusCode, 401)
  assert.equal((await app.inject({ url: '/mas' })).statusCode, 302)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'web-cuentas@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  for (const url of ['/mas', '/mas/ajustes', '/mas/nombres', '/mas/cuenta', '/m/cuentas/mas.js', '/m/cuentas/estilo.css']) {
    assert.equal((await app.inject({ url, headers: { cookie } })).statusCode, 200, url)
  }
  const g = await app.inject({ url: '/api/cuentas', headers: { cookie } })
  assert.equal(g.json().usuario.email, 'web-cuentas@prueba.com')
  assert.ok(g.json().zonas.includes('America/Argentina/Cordoba'))
  const p = await app.inject({ method: 'PUT', url: '/api/cuentas/ajustes', headers: { cookie }, payload: { limiteJuegoSemana: 50 } })
  assert.equal(p.json().ajustes.limiteJuegoSemana, 50)
  const mal = await app.inject({ method: 'PUT', url: '/api/cuentas/ajustes', headers: { cookie }, payload: { limiteJuegoSemana: -1 } })
  assert.equal(mal.statusCode, 400)
  assert.match(mal.json().error, /entre 0 y 1440/)
  const c = await app.inject({ method: 'POST', url: '/api/cuentas/clave', headers: { cookie }, payload: { actual: 'clave-segura', nueva: 'clave-nueva-1', repetir: 'clave-nueva-1' } })
  assert.equal(c.statusCode, 200)
  assert.equal((await app.inject({ url: '/api/cuentas', headers: { cookie } })).statusCode, 200) // la sesión de ahora sigue
  await app.inject({ method: 'POST', url: '/api/sesion/salir', headers: { cookie }, payload: {} })
  assert.equal((await app.inject({ url: '/api/cuentas', headers: { cookie } })).statusCode, 401)
  await app.close()
})
