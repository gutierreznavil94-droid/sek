'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const eventos = require('../../comun/eventos')
const { guardarAjustes } = require('../../comun/ajustes')
const { transaccion } = require('../../comun/base')
const calculo = require('./calculo')
const xp = require('./ventanilla')
const { crearApp } = require('../../app')

const HOY = '2026-11-23'
const AYER = '2026-11-22'
before(prepararBase)
after(terminar)

const suma = (id, clave, cantidad, fecha = HOY, origen = 'manual') => xp.sumar(id, { clave, cantidad, origen, fecha, descripcion: clave })

test('cuentas: niveles con base × n, sin tope', () => {
  assert.equal(calculo.xpParaNivel(2), 100)
  assert.equal(calculo.xpParaNivel(3), 300)
  assert.equal(calculo.xpParaNivel(5), 1000)
  assert.equal(calculo.xpParaNivel(10), 4500)
  assert.equal(calculo.nivelDesdeXp(0), 1)
  assert.equal(calculo.nivelDesdeXp(99), 1)
  assert.equal(calculo.nivelDesdeXp(100), 2)
  assert.equal(calculo.nivelDesdeXp(4499), 9)
  assert.equal(calculo.nivelDesdeXp(4500), 10)
  const e = calculo.estadoNivel(150)
  assert.equal(e.nivel, 2)
  assert.equal(e.xpEnNivel, 50)
  assert.equal(e.xpParaSiguiente, 200)
  assert.equal(e.progreso, 0.25)
  assert.equal(calculo.etapaDeNivel(12), 'Consolidación')
})

test('cuentas: lo no cumplido resta la mitad, redondeado para arriba, y nunca de más', () => {
  assert.equal(calculo.cuantoResta(15, 50), 8)
  assert.equal(calculo.cuantoResta(10, 50), 5)
  assert.equal(calculo.cuantoResta(0, 50), 0)
  const cfg = { activa: true, porcentaje: 50, desde: AYER }
  const f = [{ id: 'a', nombre: 'A', xp: 20, tipo: 'pilar' }, { id: 'b', nombre: 'B', xp: 30, tipo: 'serie' }]
  assert.deepEqual(calculo.restasDelDia(f, cfg, HOY, 100).map((r) => r.cantidad), [10, 15])
  assert.deepEqual(calculo.restasDelDia(f, cfg, HOY, 12).map((r) => r.cantidad), [10, 2])
  assert.deepEqual(calculo.restasDelDia(f, cfg, '2026-11-21', 100), [], 'antes del día de inicio no resta')
  assert.deepEqual(calculo.restasDelDia(f, { ...cfg, activa: false }, HOY, 100), [])
  assert.equal(calculo.textoAvisoResta(f, 50), 'Te quedan 2 sin hacer: −25 XP si no los hacés hoy')
  assert.equal(calculo.textoAvisoResta([], 50), null)
})

test('sumar con clave única: el mismo evento nunca suma dos veces', async () => {
  const id = await personaDePrueba()
  const a = await suma(id, 'compromiso:leer:2026-11-23', 20, HOY, 'compromiso')
  assert.deepEqual(a, { concedido: true, cantidad: 20, nuevoNivel: null })
  const b = await suma(id, 'compromiso:leer:2026-11-23', 20, HOY, 'compromiso')
  assert.equal(b.concedido, false)
  assert.equal(b.motivo, 'Ya se había concedido')
  assert.equal(await xp.total(id), 20)
  assert.equal((await suma(id, 'nada', 0)).concedido, false)
})

test('subir de nivel avisa xp.nivel, una vez por nivel', async () => {
  const id = await personaDePrueba()
  const avisos = []
  const soltar = eventos.escuchar('xp.nivel', async (d) => { if (d.usuarioId === id) avisos.push(d.nivel) })
  await suma(id, 'a', 90)
  const r = await suma(id, 'b', 220) // 310 XP: pasa al 2 y al 3
  soltar()
  assert.equal(r.nuevoNivel, 3)
  assert.deepEqual(avisos, [2, 3])
  const e = await xp.estado(id)
  assert.equal(e.nivel, 3)
  assert.equal(e.xpTotal, 310)
})

test('la base de nivel sale de los ajustes de la persona', async () => {
  const id = await personaDePrueba()
  await guardarAjustes(id, { baseNivel: 50 })
  await suma(id, 'a', 150) // con base 50: nivel 2 a 50, nivel 3 a 150
  assert.equal((await xp.estado(id)).nivel, 3)
})

test('anular deja el registro tachado, con motivo, y se puede reactivar', async () => {
  const id = await personaDePrueba()
  await suma(id, 'x', 40)
  assert.equal(await xp.anular(id, 'x', 'Me equivoqué'), true)
  assert.equal(await xp.anular(id, 'x', 'otra vez'), false)
  assert.equal(await xp.total(id), 0)
  const [m] = await xp.historialXp(id)
  assert.equal(m.anulado, true)
  assert.equal(m.motivoAnulacion, 'Me equivoqué')
  const r = await suma(id, 'x', 40)
  assert.equal(r.concedido, true)
  assert.equal(await xp.total(id), 40)
  assert.equal((await xp.historialXp(id)).length, 1, 'reactivar no duplica')
})

test('restar: solo orígenes que restan y nunca baja de 0', async () => {
  const id = await personaDePrueba()
  await suma(id, 'base', 30)
  await assert.rejects(xp.restar(id, { clave: 'r1', cantidad: 5, origen: 'manual', fecha: HOY }), /no puede restar/)
  const r = await xp.restar(id, { clave: 'caida:1', cantidad: 50, origen: 'caida', fecha: HOY, descripcion: 'Caída' })
  assert.deepEqual(r, { restado: true, cantidad: 30 })
  assert.equal(await xp.total(id), 0)
  assert.equal((await xp.restar(id, { clave: 'caida:2', cantidad: 5, origen: 'caida', fecha: HOY })).restado, false)
})

test('aplicarRestas: la mitad de lo que faltó, una sola vez por día, y se devuelve si se corrige', async () => {
  const id = await personaDePrueba()
  await suma(id, 'antes', 200, AYER)
  const cfg = await xp.asegurarInicioResta(id, AYER)
  assert.equal(cfg.desde, AYER)
  const faltantes = [
    { id: 'entreno', nombre: 'Entrenamiento', xp: 15, tipo: 'pilar' },
    { id: 'serie-flexiones', nombre: 'Flexiones', xp: 10, tipo: 'serie' },
  ]
  assert.equal(await xp.aplicarRestas(id, HOY, faltantes), 13) // 8 + 5
  assert.equal(await xp.aplicarRestas(id, HOY, faltantes), 0, 'el mismo día no resta dos veces')
  assert.equal(await xp.total(id), 187)
  assert.deepEqual(await xp.balanceDelDia(id, HOY), { mas: 0, menos: 13 })
  const movs = await xp.delDia(id, HOY)
  assert.deepEqual(movs.map((m) => m.descripcion), ['Entrenamiento sin hacer', 'Flexiones sin hacer'])
  assert.equal(await xp.devolverResta(id, 'entreno', HOY), true)
  assert.equal(await xp.total(id), 195)
  assert.equal(await xp.aplicarRestas(id, '2026-11-21', faltantes), 0, 'nunca hacia atrás')
})

test('apagar la resta y el aviso de hoy', async () => {
  const id = await personaDePrueba()
  await suma(id, 'antes', 100, AYER)
  await xp.asegurarInicioResta(id, AYER)
  const aviso = await xp.avisoResta(id, HOY, [{ id: 'a', nombre: 'Leer', xp: 15 }])
  assert.equal(aviso.total, 8)
  assert.equal(aviso.texto, 'Te queda 1 sin hacer: −8 XP si no lo hacés hoy')
  assert.equal(await xp.avisoResta(id, HOY, []), null)
  const c = await xp.cambiarResta(id, { activa: false })
  assert.equal(c.activa, false)
  assert.equal(await xp.aplicarRestas(id, HOY, [{ id: 'a', nombre: 'Leer', xp: 15 }]), 0)
  const p = await xp.cambiarResta(id, { activa: true, porcentaje: 5 })
  assert.equal(p.porcentaje, 10, 'el mínimo es 10 %')
  assert.equal(p.desde, HOY, 'al prender vale desde hoy')
})

test('transacción compartida: si algo falla después, el XP vuelve atrás', async () => {
  const id = await personaDePrueba()
  await assert.rejects(transaccion(async (tx) => {
    await xp.sumar(id, { clave: 't', cantidad: 50, origen: 'manual', fecha: HOY }, tx)
    throw new Error('falló otro módulo')
  }), /falló otro módulo/)
  assert.equal(await xp.total(id), 0)
})

test('dos sumas a la vez con la misma clave cuentan una sola', async () => {
  const id = await personaDePrueba()
  const r = await Promise.all([suma(id, 'doble', 30), suma(id, 'doble', 30), suma(id, 'doble', 30)])
  assert.equal(r.filter((x) => x.concedido).length, 1)
  assert.equal(await xp.total(id), 30)
})

test('xp por día y antes de una fecha (para la montaña de Progreso)', async () => {
  const id = await personaDePrueba()
  await suma(id, 'a', 10, '2026-11-20')
  await suma(id, 'b', 20, AYER)
  await suma(id, 'c', 5, AYER)
  await xp.restar(id, { clave: 'resta:x:' + AYER, cantidad: 4, origen: 'resta', fecha: AYER })
  assert.deepEqual(await xp.xpPorDia(id, '2026-11-21', HOY), [{ fecha: AYER, xp: 21 }])
  assert.equal(await xp.xpAntesDe(id, AYER), 10)
})

test('cada persona ve solo lo suyo', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  await suma(a, 'misma', 50)
  assert.equal((await suma(b, 'misma', 10)).concedido, true, 'la clave es única por persona')
  assert.equal(await xp.total(a), 50)
  assert.equal(await xp.total(b), 10)
  const [m] = await xp.historialXp(a)
  await assert.rejects(xp.anularPorId(b, m.id), /no existe/)
})

test('importa el XP de una copia de la app vieja (con anulados y restas) sin repetir', async () => {
  const id = await personaDePrueba()
  const viejos = [
    { id: 1, clave: 'compromiso:a:2026-11-01', cantidad: 20, origen: 'compromiso', fecha: '2026-11-01', creado: 1, descripcion: 'Leer' },
    { id: 2, clave: 'compromiso:b:2026-11-01', cantidad: 30, origen: 'compromiso', fecha: '2026-11-01', creado: 2, descripcion: 'Error', anulado: true, motivoAnulacion: 'mal' },
    { id: 3, clave: 'resta:c:2026-11-02', cantidad: -5, origen: 'resta', fecha: '2026-11-02', creado: 3, descripcion: 'C sin hacer' },
    { clave: 'raro', cantidad: -9, origen: 'compromiso', fecha: '2026-11-02' },
    { basura: true },
  ]
  assert.equal(await xp.importar(id, viejos), 4)
  assert.equal(await xp.importar(id, viejos), 0, 'lo repetido no entra')
  assert.equal(await xp.total(id), 15) // 20 − 5 (el anulado no cuenta, el negativo raro cuenta 0)
})

test('web: la pantalla y la API de XP piden sesión y funcionan', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/xp' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'webxp@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  assert.equal((await app.inject({ url: '/xp', headers: { cookie } })).statusCode, 200)
  assert.equal((await app.inject({ url: '/m/xp/xp.js', headers: { cookie } })).statusCode, 200)
  const yo = await app.inject({ url: '/api/xp', headers: { cookie } })
  assert.equal(yo.json().estado.nivel, 1)
  const usuarioId = (await app.inject({ url: '/api/sesion/yo', headers: { cookie } })).json().usuario.id
  await xp.sumar(usuarioId, { clave: 'w', cantidad: 120, origen: 'manual', fecha: HOY })
  const res = await app.inject({ url: '/api/xp', headers: { cookie } })
  assert.equal(res.json().estado.nivel, 2)
  const m = res.json().movimientos[0]
  const an = await app.inject({ method: 'POST', url: `/api/xp/movimientos/${m.id}/anular`, headers: { cookie }, payload: { motivo: 'prueba' } })
  assert.equal(an.json().estado.xpTotal, 0)
  const c = await app.inject({ method: 'POST', url: '/api/xp/resta', headers: { cookie }, payload: { porcentaje: 75 } })
  assert.equal(c.json().resta.porcentaje, 75)
  assert.equal((await app.inject({ method: 'POST', url: '/api/xp/resta', headers: { cookie }, payload: { activa: 'quizás' } })).statusCode, 400)
  assert.equal((await app.inject({ url: '/api/xp/historial?antesDe=abc', headers: { cookie } })).statusCode, 400)
  await app.close()
})

test('la tabla de niveles marca el día en que se alcanzó cada nivel', async () => {
  const id = await personaDePrueba()
  const hoy = require('../../comun/fechas').fechaDe(require('../../comun/reloj').ahora())
  const t0 = await xp.tablaNiveles(id)
  assert.equal(t0.actual, 1)
  assert.equal(t0.filas.length, 15)
  assert.equal(t0.filas[1].xpTotal, 100)
  assert.equal(t0.filas[1].alcanzado, null)
  await xp.sumar(id, { clave: 'prueba-niveles', cantidad: 150, origen: 'manual', fecha: hoy, descripcion: 'prueba' })
  const t1 = await xp.tablaNiveles(id)
  assert.equal(t1.actual, 2)
  assert.equal(t1.filas[1].alcanzado, hoy)
  assert.equal(t1.filas[2].alcanzado, null)
})
