'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const { todas } = require('../../comun/base')
const calculo = require('./calculo')
const progreso = require('./ventanilla')
const xp = require('../xp/ventanilla')
const ciclo = require('../ciclo/ventanilla')
const habitos = require('../habitos/ventanilla')
const comida = require('../comida/ventanilla')
const desafios = require('../desafios/ventanilla')
const { crearApp } = require('../../app')

// La hora de prueba es el lunes 23 nov 2026, 10:00 en Córdoba.
const HOY = '2026-11-23'
before(prepararBase)
after(terminar)

const sumar = (id, clave, cantidad, fecha) => xp.sumar(id, { clave, cantidad, origen: 'prueba', fecha, descripcion: clave })

// ---------- Cuentas puras ----------

test('cuentas: el camino acumula la XP neta día por día y nunca baja de 0', () => {
  const xpDias = new Map([['2026-11-01', { ganado: 10, perdido: 0, neto: 10 }], ['2026-11-02', { ganado: 0, perdido: 30, neto: -30 }], ['2026-11-03', { ganado: 5, perdido: 0, neto: 5 }]])
  const pilares = new Map([['2026-11-01', [{ estado: 'cumplido' }, { estado: 'omitido' }, { estado: 'descanso' }]]])
  const c = calculo.armarCamino({ desde: '2026-11-01', hasta: '2026-11-03', xpAntes: 0, xpDias, pilares, fechasCaida: new Set(['2026-11-02']), fechasForja: new Set(), marcas: new Map([['2026-11-03', 'Primer 5K']]) })
  assert.deepEqual(c.map((d) => d.acumulado), [10, 0, 0])
  assert.deepEqual(c[0].pilares, { hechos: 1, total: 2 })
  assert.equal(c[1].caida, true)
  assert.equal(c[2].marca, 'Primer 5K')
  assert.equal(c[2].dia, 3)
})

test('cuentas: pilares en rango no cuentan lo pendiente ni el descanso, y siempre están todos', () => {
  const r = calculo.pilaresEnRango([
    { fecha: 'a', pilares: [{ accionId: 'e', nombre: 'Entreno', estado: 'descanso' }, { accionId: 'd', nombre: 'Dormir', estado: 'tarde' }] },
    { fecha: 'b', pilares: [{ accionId: 'e', nombre: 'Entreno', estado: 'pendiente' }, { accionId: 'd', nombre: 'Dormir', estado: 'omitido' }] },
  ])
  assert.deepEqual(r, [{ id: 'e', nombre: 'Entreno', hechos: 0, programados: 0 }, { id: 'd', nombre: 'Dormir', hechos: 1, programados: 2 }])
})

test('cuentas: los números de un período sin registros vuelven null (nada se inventa)', () => {
  const n = calculo.numerosDelPeriodo({ diasCerrados: [], entrenos: { hechos: 0, previstos: 0 }, noches: [], xpGanado: 0 })
  assert.equal(n.cumplimiento, null)
  assert.equal(n.juegoPorDia, null)
  const m = calculo.numerosDelPeriodo({
    diasCerrados: [{ cumplidos: 3, programados: 4, minutosJuego: 60, excepcion: false }, { cumplidos: 0, programados: 4, minutosJuego: 0, excepcion: true }],
    entrenos: { hechos: 1, previstos: 2 }, noches: [{ cumplido: true }, { cumplido: false }], xpGanado: 40,
  })
  assert.equal(m.cumplimiento, 75) // la excepción no cuenta
  assert.equal(m.juegoPorDia, 30)
  assert.deepEqual(m.noches, { cumplidas: 1, total: 2 })
})

test('cuentas: rangos del gráfico de XP', () => {
  assert.equal(calculo.desdeDelRango('semana', HOY, null), '2026-11-17')
  assert.equal(calculo.desdeDelRango('mes', HOY, null), '2026-10-25')
  assert.equal(calculo.desdeDelRango('ciclo', HOY, '2026-11-16'), '2026-11-16')
  assert.equal(calculo.desdeDelRango('ciclo', HOY, null), '2026-11-17') // sin ciclo: la semana
})

// ---------- Con la base ----------

test('la vista de XP por día separa lo ganado, lo perdido y deja afuera lo anulado', async () => {
  const id = await personaDePrueba()
  await sumar(id, 'a', 30, HOY)
  await sumar(id, 'b', 20, HOY)
  await xp.restar(id, { clave: 'r', cantidad: 8, origen: 'resta', fecha: HOY, descripcion: 'resta' })
  await xp.anular(id, 'b', 'prueba')
  const [fila] = await todas('SELECT ganado, perdido, neto FROM progreso_xp_dia WHERE usuario_id = $1', [id])
  assert.deepEqual(fila, { ganado: 30, perdido: 8, neto: 22 })
})

test('sin ciclo: nivel y racha, la montaña vacía y la sección de XP en semana', async () => {
  const id = await personaDePrueba()
  await sumar(id, 'x', 50, HOY)
  const r = await progreso.resumen(id)
  assert.equal(r.ciclo, null)
  assert.deepEqual(r.camino, [])
  assert.equal(r.nivel.xpTotal, 50)
  assert.equal(r.secciones.xp.hoy, 50)
  assert.equal(r.secciones.xp.mini.length, 7)
  const s = await progreso.xpEnRango(id, 'ciclo') // sin ciclo cae en la semana
  assert.equal(s.dias.length, 7)
  await assert.rejects(progreso.xpEnRango(id, 'año'), /rango/)
  await assert.rejects(progreso.cierreFase(id, 1), /ciclo activo/i)
})

test('con ciclo: la montaña va del Día 1 a hoy con caídas, marcas, agua y peso', async () => {
  const id = await personaDePrueba()
  await ciclo.iniciarCiclo(id, { inicio: '2026-11-16' }) // hoy es el Día 8
  await sumar(id, 'antes', 100, '2026-11-10') // antes del ciclo: arranca la montaña
  await sumar(id, 'd1', 20, '2026-11-16')
  await sumar(id, 'd3', 15, '2026-11-18')
  await habitos.registrarCaida(id, { fecha: '2026-11-18' })
  await habitos.marcarDia(id, '2026-11-20', 'Primera dominada')
  await comida.tomarAgua(id, HOY)
  await comida.registrarPeso(id, '2026-11-20', 80)
  const r = await progreso.resumen(id)
  assert.equal(r.ciclo.dia, 8)
  assert.equal(r.camino.length, 8)
  assert.equal(r.camino[0].fecha, '2026-11-16')
  assert.equal(r.camino[0].acumulado, 120)
  const d3 = r.camino[2]
  assert.equal(d3.caida, true)
  assert.ok(d3.perdido > 0, 'la caída resta XP ese día')
  assert.equal(d3.acumulado, 120 + d3.neto)
  assert.equal(r.camino[4].marca, 'Primera dominada')
  assert.equal(r.caidasSuperadas, 1)
  assert.ok(r.secciones.comida.aguaHoy > 0)
  assert.equal(r.secciones.comida.peso, 80)
  assert.deepEqual(r.fases.map((f) => f.numero), [1])
  const c = await progreso.xpEnRango(id, 'ciclo')
  assert.equal(c.desde, '2026-11-16')
  assert.equal(c.dias[c.dias.length - 1].acumulado, r.camino[7].acumulado)
})

test('cierre de fase: base, esta fase y la que todavía no empezó', async () => {
  const id = await personaDePrueba()
  await ciclo.iniciarCiclo(id, { inicio: '2026-11-16' })
  await sumar(id, 'f1', 25, '2026-11-17')
  await sumar(id, 'f2', 10, HOY)
  const f1 = await progreso.cierreFase(id, 1)
  assert.equal(f1.empezo, true)
  assert.equal(f1.enCurso, true)
  assert.equal(f1.numeros.base.xp, 25) // primeros 7 días
  assert.equal(f1.numeros.esta.xp, 35)
  assert.equal(f1.numeros.anterior, null)
  assert.equal(f1.numeros.esta.cumplimiento, null) // sin días cerrados: «—»
  assert.equal(f1.numeros.esta.inicios, 0)
  const f2 = await progreso.cierreFase(id, 2)
  assert.equal(f2.empezo, false)
  assert.ok(f2.numeros.anterior, 'la fase 2 compara con la 1')
  await assert.rejects(progreso.cierreFase(id, 9), /fase/i)
  await desafios.registrarInicio(id, { accion: 'Abrir el cuaderno' })
  assert.equal((await progreso.cierreFase(id, 1)).numeros.esta.inicios, 1) // «Inicios con 3-2-1»
})

test('sueño, fuerza, comida y series responden aunque no haya nada cargado', async () => {
  const id = await personaDePrueba()
  const s = await progreso.suenoProgreso(id)
  assert.equal(s.noches.length, 30)
  const f = await progreso.fuerza(id)
  assert.ok(Array.isArray(f.volumenPorSemana))
  const c = await progreso.comida(id)
  assert.equal(c.agua.length, 30)
  const se = await progreso.series(id)
  assert.deepEqual(se.contadores, [])
  const p = await progreso.pilares(id)
  assert.ok(Array.isArray(p.atributos))
})

test('progreso solo lee: ninguna ruta suya escribe y todas piden sesión', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/progreso' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'progreso@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  for (const url of ['/progreso', '/progreso/seccion?cual=xp', '/progreso/fase?numero=1', '/m/progreso/progreso.js', '/api/progreso', '/api/progreso/xp?rango=mes', '/api/progreso/pilares', '/api/progreso/sueno', '/api/progreso/fuerza', '/api/progreso/comida', '/api/progreso/series']) {
    assert.equal((await app.inject({ url, headers: { cookie } })).statusCode, 200, url)
  }
  assert.equal((await app.inject({ url: '/api/progreso/xp?rango=año', headers: { cookie } })).statusCode, 400)
  assert.equal((await app.inject({ url: '/api/progreso/fase/1', headers: { cookie } })).statusCode, 404) // sin ciclo
  const texto = require('node:fs').readFileSync(require('node:path').join(__dirname, 'rutas.js'), 'utf8')
  assert.ok(!/app\.(post|put|patch|delete)\(/.test(texto), 'progreso no tiene rutas que escriban')
  await app.close()
})
