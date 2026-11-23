'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const eventos = require('../../comun/eventos')
const comida = require('./ventanilla')
const calculo = require('./calculo')
const { crearApp } = require('../../app')

const MIN = 60000
const HOY = '2026-11-23' // prepararBase fija el lunes 23/11/2026 a las 10:00 de Córdoba
const AYER = '2026-11-22'
const OBJ = { peso: 70, altura: 175, edad: 30, sexo: 'hombre', actividad: 'moderado', meta: 'mantener' }

before(prepararBase)
after(terminar)

// ---------- Cuentas puras ----------

test('la tabla tiene unos 400 alimentos con fuente y sin repetidos', () => {
  const t = calculo.TABLA_ALIMENTOS
  assert.ok(t.length >= 380, `hay ${t.length}`)
  assert.equal(new Set(t.map((a) => a.id)).size, t.length)
  for (const a of t) assert.ok(calculo.FUENTES_TABLA[a.f], `${a.n} sin fuente`)
})

test('busca sin tildes y con varias palabras', () => {
  const r = calculo.buscarEn(calculo.TABLA_ALIMENTOS, 'milanesa POLLO')
  assert.ok(r.length > 0)
  assert.ok(r.every((a) => /milanesa/i.test(a.n) && /pollo/i.test(a.n)))
  assert.ok(calculo.buscarEn(calculo.TABLA_ALIMENTOS, 'platano').length + calculo.buscarEn(calculo.TABLA_ALIMENTOS, 'banana').length > 0)
  assert.deepEqual(calculo.buscarEn(calculo.TABLA_ALIMENTOS, '   '), [])
})

test('objetivo: Mifflin-St Jeor × actividad, +10 % para ganar y 1,8 g/kg', () => {
  const m = calculo.calcularObjetivo(OBJ)
  assert.equal(m.mantenimiento, 2550) // (700 + 1093,75 − 150 + 5) × 1,55 ≈ 2556
  assert.equal(m.proteina, 100) // 70 × 1,4 = 98 → 100
  const g = calculo.calcularObjetivo({ ...OBJ, meta: 'ganar' })
  assert.equal(g.kcal, 2800)
  assert.equal(g.proteina, 125) // 70 × 1,8 = 126 → 125
})

test('verde hasta +10 %, ámbar después, nunca rojo; franja según la hora', () => {
  assert.equal(calculo.estadoKcal(0, 2000), 'vacio')
  assert.equal(calculo.estadoKcal(2200, 2000), 'bien')
  assert.equal(calculo.estadoKcal(2201, 2000), 'pasado')
  assert.equal(calculo.franjaPorHora('08:30'), 'desayuno')
  assert.equal(calculo.franjaPorHora('13:00'), 'almuerzo')
  assert.equal(calculo.franjaPorHora('17:00'), 'merienda')
  assert.equal(calculo.franjaPorHora('21:00'), 'cena')
})

test('agua: 35 ml por kilo redondeado a 250, mínimo 1 L; litros legibles', () => {
  assert.equal(calculo.objetivoAgua(70), 2500)
  assert.equal(calculo.objetivoAgua(80), 2750)
  assert.equal(calculo.objetivoAgua(20), 1000)
  assert.equal(calculo.objetivoAgua(undefined), 2500)
  assert.equal(calculo.objetivoAgua(70, 3000), 3000)
  assert.equal(calculo.litros(1500), '1,5 L')
})

test('fruta: mordiscos en proporción y estados', () => {
  assert.equal(calculo.mordidoDe(0, 1, 2), 0)
  assert.equal(calculo.mordidoDe(1, 1, 2), 0.6)
  assert.equal(calculo.mordidoDe(2, 1, 2), 1)
  assert.equal(calculo.mordidoDe(1, 2, 4), 0.3)
  assert.equal(calculo.estadoFruta(0, 1, 2), 'pendiente')
  assert.equal(calculo.estadoFruta(1, 1, 2), 'cumplido')
  assert.equal(calculo.estadoFruta(3, 1, 2), 'superado')
})

test('convierte la respuesta de Open Food Facts', () => {
  const a = calculo.alimentoDeOff('7790001', { status: 1, product: { product_name: 'Galletitas', brands: 'Marca, Otra', serving_quantity: '30', serving_size: '30 g', nova_group: 4, nutriments: { 'energy-kcal_100g': 480, proteins_100g: 7.04, carbohydrates_100g: 70, fat_100g: 19 } } })
  assert.equal(a.n, 'Galletitas · Marca')
  assert.equal(a.kcal, 480)
  assert.equal(a.p, 7)
  assert.equal(a.gr, 30)
  assert.equal(a.up, true)
  assert.equal(calculo.alimentoDeOff('1', { status: 0 }), null)
})

// ---------- Con base ----------

test('registra por gramos, suma el día, separa por franja y avisa comida.registrada', async () => {
  const id = await personaDePrueba()
  const avisos = []
  const soltar = eventos.escuchar('comida.registrada', async (d) => { avisos.push(d) })
  const r = await comida.registrar(id, { alimento: 't001', gramos: 200 }) // pechuga cocida, 10:00 → desayuno
  soltar()
  assert.equal(r.franja, 'desayuno')
  assert.equal(r.fecha, HOY)
  assert.equal(r.kcal, 330)
  assert.equal(r.p, 62)
  await comida.registrar(id, { alimento: 't001', gramos: 100, franja: 'cena' })
  const d = await comida.delDia(id, HOY)
  assert.equal(d.lista.length, 2)
  assert.equal(d.totales.kcal, 495)
  assert.equal(d.porFranja.cena.length, 1)
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].usuarioId, id)
  assert.equal(avisos[0].fecha, HOY)
})

test('cambiar la cantidad recalcula; borrar saca; no acepta 0 ni alimentos que no existen', async () => {
  const id = await personaDePrueba()
  const r = await comida.registrar(id, { alimento: 't001', gramos: 100 })
  const c = await comida.cambiarCantidad(id, r.id, 50)
  assert.equal(c.kcal, 83)
  await assert.rejects(comida.registrar(id, { alimento: 't001', gramos: 0 }), /mayor que cero/)
  await assert.rejects(comida.registrar(id, { alimento: 't99999', gramos: 10 }), /no existe/)
  await comida.borrar(id, r.id)
  assert.equal((await comida.delDia(id, HOY)).lista.length, 0)
})

test('frecuentes con la cantidad de la última vez, repetir ayer y comidas guardadas', async () => {
  const id = await personaDePrueba()
  await comida.registrar(id, { alimento: 't001', gramos: 150, franja: 'almuerzo', fecha: AYER })
  await comida.registrar(id, { alimento: 't007', gramos: 150, franja: 'almuerzo', fecha: AYER })
  reloj.avanzar(MIN)
  await comida.registrar(id, { alimento: 't001', gramos: 200, franja: 'cena', fecha: AYER })
  const f = await comida.frecuentes(id, HOY)
  assert.equal(f[0].alimento, 't001')
  assert.equal(f[0].veces, 2)
  assert.equal(f[0].gramos, 200)
  assert.equal(await comida.repetirAyer(id, HOY, 'almuerzo'), 2)
  assert.equal((await comida.delDia(id, HOY)).porFranja.almuerzo.length, 2)
  const g = await comida.guardarFranja(id, { nombre: 'Almuerzo de siempre', fecha: HOY, franja: 'almuerzo' })
  assert.equal(g.items.length, 2)
  assert.equal(await comida.cargarGuardada(id, g.id, { fecha: HOY, franja: 'cena' }), 2)
  assert.equal((await comida.delDia(id, HOY)).porFranja.cena.length, 2)
  await assert.rejects(comida.guardarFranja(id, { nombre: 'Nada', fecha: HOY, franja: 'merienda' }), /nada para guardar/)
  await comida.borrarGuardada(id, g.id)
  assert.equal((await comida.guardadas(id)).length, 0)
})

test('alimento propio por porción queda por 100 g y aparece primero en el buscador', async () => {
  const id = await personaDePrueba()
  const a = await comida.crearPropio(id, { nombre: 'Pollo de mamá', porcion: '1 plato', gramos: 250, kcal: 400, proteina: 50 })
  assert.match(a.id, /^p\d+$/)
  assert.equal(a.kcal, 160)
  assert.equal(a.p, 20)
  const r = await comida.buscar(id, 'pollo')
  assert.equal(r[0].id, a.id)
  const reg = await comida.registrar(id, { alimento: a.id, gramos: 250 })
  assert.equal(reg.kcal, 400)
  const otro = await personaDePrueba('Otro')
  await assert.rejects(comida.registrar(otro, { alimento: a.id, gramos: 100 }), /no existe/)
})

test('código de barras: consulta una vez y después lo encuentra guardado; sin internet avisa', async () => {
  const id = await personaDePrueba()
  let pedidos = 0
  const off = async () => { pedidos++; return { json: async () => ({ status: 1, product: { product_name: 'Yogur', nutriments: { 'energy-kcal_100g': 90, proteins_100g: 4 } } }) } }
  const a = await comida.buscarCodigo(id, '7790000000011', off)
  assert.equal(a.alimento.n, 'Yogur')
  const b = await comida.buscarCodigo(id, '7790000000011', off)
  assert.equal(b.alimento.id, a.alimento.id)
  assert.equal(pedidos, 1)
  const sin = await comida.buscarCodigo(id, '7790000000028', async () => { throw new Error('sin red') })
  assert.deepEqual(sin, { alimento: null, motivo: 'sin_internet' })
  const no = await comida.buscarCodigo(id, '7790000000035', async () => ({ json: async () => ({ status: 0 }) }))
  assert.equal(no.motivo, 'no_esta')
})

test('guardar el objetivo deja el peso para la curva, y un peso nuevo recalcula', async () => {
  const id = await personaDePrueba()
  const o = await comida.guardarObjetivo(id, OBJ)
  assert.equal(o.kcal, 2550)
  assert.deepEqual(await comida.pesos(id), [{ fecha: HOY, kg: 70 }])
  await comida.registrarPeso(id, '2026-11-24', 80)
  const n = await comida.objetivo(id)
  assert.equal(n.peso, 80)
  assert.equal(n.proteina, 110) // 80 × 1,4 = 112 → 110
  await assert.rejects(comida.guardarObjetivo(id, { ...OBJ, peso: 10 }), /Revisá peso/)
  // a mano: el peso nuevo no pisa las calorías
  await comida.guardarObjetivo(id, { ...OBJ, manual: true, kcal: 2000, proteina: 150 })
  await comida.registrarPeso(id, '2026-11-25', 75)
  const m = await comida.objetivo(id)
  assert.equal(m.kcal, 2000)
  assert.equal(m.peso, 75)
})

test('plan del día: sin objetivo o sin cargar no cuenta; en el plan se cumple; pasarse no', async () => {
  const id = await personaDePrueba()
  assert.equal(await comida.planDelDia(id, HOY), null)
  await comida.guardarObjetivo(id, { ...OBJ, manual: true, kcal: 1000, proteina: 100 })
  assert.equal(await comida.planDelDia(id, HOY), null)
  await comida.registrar(id, { alimento: 't001', gramos: 330 }) // ≈545 kcal, 102 g proteína
  assert.equal((await comida.planDelDia(id, HOY)).cumplido, false) // le faltan calorías
  await comida.registrar(id, { alimento: 't001', gramos: 270 }) // total ≈990 kcal
  const r = await comida.planDelDia(id, HOY)
  assert.equal(r.cumplido, true)
  await comida.registrar(id, { alimento: 't001', gramos: 100 })
  assert.equal((await comida.planDelDia(id, HOY)).cumplido, false)
})

test('agua: sale del peso, un toque suma el principal, se llena y más; deshacer resta', async () => {
  const id = await personaDePrueba()
  assert.equal((await comida.configAgua(id)).objetivo, 2500)
  await comida.guardarObjetivo(id, { ...OBJ, peso: 80 })
  assert.equal((await comida.configAgua(id)).objetivo, 2750)
  let r
  for (let i = 0; i < 4; i++) r = await comida.tomarAgua(id, HOY)
  assert.equal(r.dia.ml, 3000)
  assert.equal(r.recienLlego, true)
  assert.equal(r.dia.tomas.length, 4)
  r = await comida.tomarAgua(id, HOY, 'vaso-250')
  assert.equal(r.dia.ml, 3250)
  assert.equal(r.recienLlego, false)
  assert.ok(r.dia.nivel > 1)
  const d = await comida.deshacerAgua(id, HOY)
  assert.equal(d.ml, 3000)
})

test('envases editables: nuevo principal, objetivo a mano; nunca sin envases', async () => {
  const id = await personaDePrueba()
  const c = await comida.guardarConfigAgua(id, { envases: [{ id: 'termo', nombre: 'Termo', ml: 1000 }, { nombre: 'Taza', ml: 300 }], principal: 'termo', objetivoMl: 3000 })
  assert.equal(c.envases.length, 2)
  assert.equal(c.principal, 'termo')
  assert.equal((await comida.tomarAgua(id, HOY)).dia.ml, 1000)
  assert.equal((await comida.configAgua(id)).objetivo, 3000)
  await assert.rejects(comida.guardarConfigAgua(id, { envases: [] }), /al menos un envase/)
  await assert.rejects(comida.guardarConfigAgua(id, { envases: [{ nombre: 'X', ml: 0 }] }), /más que 0/)
  const sinPrincipal = await comida.guardarConfigAgua(id, { envases: [{ id: 'a', nombre: 'A', ml: 200 }], objetivoMl: null })
  assert.equal(sinPrincipal.principal, 'a')
  assert.equal((await comida.configAgua(id)).objetivo, 2500)
})

test('agua: resumen con tira de 14 días, litros por semana y racha', async () => {
  const id = await personaDePrueba()
  await comida.guardarConfigAgua(id, { envases: [{ id: 'b', nombre: 'Bidón', ml: 2500 }] })
  await comida.tomarAgua(id, '2026-11-21')
  await comida.tomarAgua(id, AYER)
  await comida.tomarAgua(id, HOY)
  const r = await comida.resumenAgua(id, HOY)
  assert.equal(r.dias.length, 14)
  assert.equal(r.rachaDias, 3)
  assert.equal(r.semanas[r.semanas.length - 1].litrosPorDia, 2.5)
})

test('fruta: arranca con 1 y 2, cada toque suma, deshacer resta, objetivos editables e historial', async () => {
  const id = await personaDePrueba()
  let d = await comida.frutaDelDia(id, HOY)
  assert.equal(d.objetivo1, 1)
  assert.equal(d.objetivo2, 2)
  let r = await comida.comerFruta(id, HOY)
  assert.equal(r.recienCumplido, true)
  assert.equal(r.dia.mordido, 0.6)
  r = await comida.comerFruta(id, HOY)
  assert.equal(r.recienSuperado, true)
  d = await comida.deshacerFruta(id, HOY)
  assert.equal(d.n, 1)
  const c = await comida.guardarConfigFruta(id, { nombre: ' Manzana ', objetivo1: 3, objetivo2: 1 })
  assert.equal(c.nombre, 'Manzana')
  assert.equal(c.objetivo2, 3) // nunca menos que el 1.º
  const h = await comida.historialFruta(id, HOY)
  assert.equal(h.length, 14)
  assert.equal(h[13].n, 1)
})

test('resumen de Hoy y promedios por semana solo con días cargados', async () => {
  const id = await personaDePrueba()
  await comida.guardarObjetivo(id, OBJ)
  await comida.registrar(id, { alimento: 't001', gramos: 100, fecha: AYER })
  await comida.registrar(id, { alimento: 't001', gramos: 300 })
  const h = await comida.resumenHoy(id)
  assert.equal(h.fecha, HOY)
  assert.equal(h.totales.kcal, 495)
  assert.equal(h.estado, 'bien')
  assert.equal(h.agua.objetivo, 2500)
  const s = await comida.resumenSemanas(id, HOY)
  assert.equal(s.semanas[s.semanas.length - 1].kcal, 495) // esta semana: solo hoy
  assert.equal(s.semanas[s.semanas.length - 2].kcal, 165) // la anterior: solo ayer (domingo)
  assert.equal(s.diasCargadosSemana, 1)
})

test('importa comida, agua, fruta, pesos, propios, guardadas y la configuración de la app vieja', async () => {
  const id = await personaDePrueba()
  const n = await comida.importar(id, {
    alimentosPropios: [{ id: 'al-viejo', n: 'Tarta de mamá', kcal: 250, p: 8, c: 20, g: 14, por: '1 porción', gr: 150, fuente: 'propio', creado: 1 }],
    comidas: [
      { id: 'com1', fecha: AYER, franja: 'cena', alimentoId: 'al-viejo', nombre: 'Tarta de mamá', gramos: 150, kcal: 375, p: 12, c: 30, g: 21, instante: 5 },
      { id: 'com2', fecha: AYER, franja: 'almuerzo', alimentoId: 't001', nombre: 'Pechuga de pollo cocida', gramos: 100, kcal: 165, p: 31, c: 0, g: 3.6, instante: 4 },
      { id: 'mal', fecha: 'ayer', franja: 'cena', alimentoId: 't001', gramos: 100 },
    ],
    comidasGuardadas: [{ id: 'cg1', nombre: 'Cena', items: [{ alimentoId: 'al-viejo', nombre: 'Tarta de mamá', gramos: 150 }], creado: 1 }],
    pesos: [{ id: 'peso-2026-11-01', fecha: '2026-11-01', kg: 72.5, instante: 1 }],
    agua: [{ id: 'a1', fecha: AYER, ml: 750, envase: 'botella-750', instante: 1 }],
    frutas: [{ id: 'f1', fecha: AYER, instante: 1 }],
    ajustes: [{ id: 'unicos', comida: { ...OBJ, kcal: 2550, proteina: 100 }, agua: { envases: [{ id: 'mate', nombre: 'Mate', ml: 1000 }], principal: 'mate' }, fruta: { nombre: 'Banana', objetivo1: 2, objetivo2: 3 } }],
  })
  assert.equal(n, 7)
  const d = await comida.delDia(id, AYER)
  assert.equal(d.lista.length, 2)
  assert.match(d.porFranja.cena[0].alimento, /^p\d+$/) // id viejo pasado al nuevo
  const g = (await comida.guardadas(id))[0]
  assert.equal(await comida.cargarGuardada(id, g.id, { fecha: HOY, franja: 'cena' }), 1)
  assert.equal((await comida.aguaDelDia(id, AYER)).ml, 750)
  assert.equal((await comida.frutaDelDia(id, AYER)).nombre, 'Banana')
  assert.equal((await comida.configAgua(id)).principal.nombre, 'Mate')
  assert.equal((await comida.objetivo(id)).kcal, 2550)
  assert.deepEqual((await comida.pesos(id))[0], { fecha: '2026-11-01', kg: 72.5 })
})

test('cada persona ve solo lo suyo', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  const r = await comida.registrar(a, { alimento: 't001', gramos: 100 })
  await comida.tomarAgua(a, HOY)
  await comida.comerFruta(a, HOY)
  assert.equal((await comida.delDia(b, HOY)).lista.length, 0)
  assert.equal((await comida.aguaDelDia(b, HOY)).ml, 0)
  assert.equal((await comida.frutaDelDia(b, HOY)).n, 0)
  await assert.rejects(comida.borrar(b, r.id), /no existe/)
  await assert.rejects(comida.cambiarCantidad(b, r.id, 10), /no existe/)
})

test('rutas: pantalla, registrar, agua, fruta y sin sesión no entra', async () => {
  const app = crearApp({ logger: false })
  const sin = await app.inject({ method: 'GET', url: '/api/comida' })
  assert.equal(sin.statusCode, 401)
  const alta = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Rutas', email: `rutas${Date.now()}@prueba.com`, clave: 'clave-de-prueba' } })
  const cookie = alta.headers['set-cookie']
  const pedir = (method, url, payload) => app.inject({ method, url, payload, headers: { cookie } })
  assert.equal((await pedir('GET', '/comida')).statusCode, 200)
  assert.equal((await pedir('GET', '/comida/ajustes')).statusCode, 200)
  const busq = (await pedir('GET', '/api/comida/alimentos?q=pechuga')).json()
  assert.ok(busq.alimentos.length > 0)
  const res = (await pedir('POST', '/api/comida/registros', { alimento: busq.alimentos[0].id, gramos: 100, franja: 'almuerzo' })).json()
  assert.equal(res.franjas.find((f) => f.id === 'almuerzo').lista.length, 1)
  const mal = await pedir('POST', '/api/comida/registros', { alimento: 't001', gramos: 100, franja: 'brunch' })
  assert.equal(mal.statusCode, 400)
  const agua = (await pedir('POST', '/api/comida/agua', {})).json()
  assert.equal(agua.dia.ml, 750)
  const fruta = (await pedir('POST', '/api/comida/fruta', {})).json()
  assert.equal(fruta.dia.n, 1)
  const obj = await pedir('PUT', '/api/comida/objetivo', OBJ)
  assert.equal(obj.json().objetivo.kcal, 2550)
  const hoy = (await pedir('GET', '/api/comida/hoy')).json()
  assert.equal(hoy.estado, 'bien')
  await app.close()
})
