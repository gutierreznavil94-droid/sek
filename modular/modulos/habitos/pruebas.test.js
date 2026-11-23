'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const { guardarAjustes } = require('../../comun/ajustes')
const { sumarDias, instanteDe } = require('../../comun/fechas')
const calculo = require('./calculo')
const h = require('./ventanilla')
const xp = require('../xp/ventanilla')
const { crearApp } = require('../../app')

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-23' // lunes (la hora fija de las pruebas)
const INI = '2026-11-02' // lunes
const dias = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => sumarDias(INI, desde + i))
const irA = (fecha) => reloj.fijar(instanteDe(fecha, '13:00', Z))

before(prepararBase)
after(terminar)

// ---------- Cuentas puras ----------

test('cuentas: pedazos a los 7, 12, 17, 21, 25 y 28; proporcional con otro número', () => {
  assert.deepEqual(calculo.pedazosPara(28), [7, 12, 17, 21, 25, 28])
  assert.deepEqual(calculo.pedazosPara(14), [4, 6, 9, 11, 13, 14])
  assert.equal(calculo.pedazosCaidos(12, 28), 2)
})

test('cuentas: la 1.ª falla de cada semana se perdona; las demás gastan margen', () => {
  // Semana 1: falla el día 3 (perdonada). Semana 2: fallan el 9 y el 10 (1 perdonada, 1 falla).
  const cumplidos = [...dias(0, 1), ...dias(3, 7), ...dias(10, 13)]
  const e = calculo.estadoForja({ inicio: INI, cumplidos }, sumarDias(INI, 14))
  assert.equal(e.perdonadas, 2)
  assert.equal(e.fallas, 1)
  assert.equal(e.margenRestante, 1)
  assert.equal(e.validos, cumplidos.length + 2)
  assert.equal(e.camino[2].estado, 'perdonado')
  assert.equal(e.camino[14].estado, 'hoy')
})

test('cuentas: sin margen, cada falla de más cierra una grieta y suma un día (nunca reinicia)', () => {
  const e = calculo.estadoForja({ inicio: INI, cumplidos: [INI] }, sumarDias(INI, 7))
  assert.equal(e.fallas, 5)
  assert.equal(e.cerradas, 3)
  assert.equal(e.duracion, 33)
  assert.equal(e.validos, 0)
})

test('cuentas: kanji sugeridos, configuración y XP de la caída', () => {
  assert.equal(calculo.kanjiSugeridos('Leer 10 min')[0], '読')
  assert.deepEqual(calculo.kanjiSugeridos('Sin celu en la cama').slice(0, 2), ['眠', '静'])
  assert.equal(calculo.kanjiSugeridos('algo').length, 6)
  assert.equal(calculo.limpiarKanji('  水分 '), '水')
  assert.deepEqual(calculo.configForja({ dias: 10, validos: 50 }), { dias: 10, validos: 10, xpDia: 5, xpForjado: 50, maximo: 3 })
  assert.equal(calculo.xpCaidaDe(undefined), 20)
  assert.equal(calculo.xpCaidaDe({ xp: 999 }), 200)
  assert.equal(calculo.xpCaidaDe({ xp: -3 }), 0)
})

// ---------- Forja en la base ----------

test('forja: marcar da +5 XP; tocar de nuevo desmarca y devuelve la XP', async () => {
  const id = await personaDePrueba()
  const habito = await h.crearHabito(id, { nombre: 'Leer 10 min', kanji: '読' })
  assert.equal(habito.inicio, HOY)
  const r = await h.alternarDia(id, habito.id)
  assert.equal(r.marcado, true)
  assert.equal(r.xp, 5)
  assert.equal(await xp.total(id), 5)
  const r2 = await h.alternarDia(id, habito.id)
  assert.equal(r2.marcado, false)
  assert.equal(await xp.total(id), 0)
  assert.equal((await h.listarForja(id)).enForja[0].estado.validos, 0)
  // Volver a marcar reactiva la misma clave: nunca suma dos veces.
  await h.alternarDia(id, habito.id)
  assert.equal(await xp.total(id), 5)
})

test('forja: máximo 3 a la vez y datos inválidos', async () => {
  const id = await personaDePrueba()
  for (const k of ['読', '水', '眠']) await h.crearHabito(id, { nombre: `Hábito ${k}`, kanji: k })
  await assert.rejects(h.crearHabito(id, { nombre: 'Otro', kanji: '心' }), /Terminá uno antes de empezar otro/)
  await assert.rejects(h.crearHabito(id, { nombre: '  ', kanji: '心' }), /nombre/)
  await assert.rejects(h.alternarDia(id, 'no-existe'), /no (existe|está)|Ese hábito/)
})

test('forja: a los 28 válidos se forja (+50 XP), 6 pedazos, el primero en el día 7', async () => {
  irA(INI)
  const id = await personaDePrueba()
  const habito = await h.crearHabito(id, { nombre: 'Agua', kanji: '水' })
  let pedazos = 0
  let forjado = false
  for (let i = 0; i < 28; i++) {
    irA(sumarDias(INI, i))
    const r = await h.alternarDia(id, habito.id)
    if (r.pedazo) pedazos++
    if (i === 6) assert.equal(r.pedazo, true)
    forjado = r.forjado
  }
  assert.equal(forjado, true)
  assert.equal(pedazos, 6)
  assert.equal(await xp.total(id), 28 * 5 + 50)
  irA(sumarDias(INI, 28))
  const l = await h.listarForja(id)
  assert.equal(l.enForja.length, 0)
  assert.equal(l.forjados[0].habito.kanji, '水')
  assert.equal(l.forjados[0].habito.forjadoEn, sumarDias(INI, 27))
  await assert.rejects(h.alternarDia(id, habito.id), /Ya está forjado/)
  irA(HOY)
})

test('forja: abandonar no resta XP; editar cambia nombre y kanji', async () => {
  const id = await personaDePrueba()
  const habito = await h.crearHabito(id, { nombre: 'Meditar', kanji: '心' })
  await h.alternarDia(id, habito.id)
  await h.editarHabito(id, habito.id, { nombre: 'Meditar 5 min', kanji: '静か' })
  assert.equal((await h.listarForja(id)).enForja[0].habito.kanji, '静')
  await h.abandonarHabito(id, habito.id)
  assert.equal(await xp.total(id), 5)
  const l = await h.listarForja(id)
  assert.equal(l.enForja.length, 0)
  assert.equal(l.abandonados, 1)
  await assert.rejects(h.alternarDia(id, habito.id), /abandonado/)
})

test('forja: la configuración sale de los ajustes de la persona', async () => {
  const id = await personaDePrueba()
  await h.cambiarConfig(id, { forja: { xpDia: 7, maximo: 1 } })
  const habito = await h.crearHabito(id, { nombre: 'Correr', kanji: '体' })
  assert.equal((await h.alternarDia(id, habito.id)).xp, 7)
  await assert.rejects(h.crearHabito(id, { nombre: 'Otro', kanji: '心' }), /Terminá uno/)
})

// ---------- Mi código ----------

test('código: arranca con los ejemplos una sola vez; si se borran no vuelven', async () => {
  const id = await personaDePrueba()
  assert.equal(await h.sembrar(id), 6)
  assert.equal(await h.sembrar(id), 0)
  const reglas = await h.listarCodigo(id)
  assert.equal(reglas.length, 6)
  assert.equal(reglas[0].momento, 'manana')
  for (const r of reglas) await h.borrarRegla(id, r.id)
  assert.equal(await h.sembrar(id), 0)
  assert.equal((await h.listarCodigo(id)).length, 0)
})

test('código: agregar, editar, mover (cada vista con su orden) y borrar', async () => {
  const id = await personaDePrueba()
  const a = await h.agregarRegla(id, { texto: 'Uno', grupo: 'cuerpo', momento: 'noche' })
  const b = await h.agregarRegla(id, { texto: 'Dos', grupo: 'cuerpo', momento: 'manana' })
  const c = await h.agregarRegla(id, { texto: 'Tres', grupo: 'mente', momento: 'noche' })
  await assert.rejects(h.agregarRegla(id, { texto: '', grupo: 'cuerpo' }), /Escribí la regla/)
  await assert.rejects(h.agregarRegla(id, { texto: 'X', grupo: 'otro' }), /área/)
  // Por área: cuerpo = Uno, Dos → bajar Uno.
  assert.equal(await h.moverRegla(id, a.id, 1, 'area'), true)
  let todas = await h.listarCodigo(id)
  assert.deepEqual(calculo.reglasDelGrupo(todas, 'area', 'cuerpo').map((r) => r.texto), ['Dos', 'Uno'])
  // Por momento no cambió: noche = Uno, Tres.
  assert.deepEqual(calculo.reglasDelGrupo(todas, 'momento', 'noche').map((r) => r.texto), ['Uno', 'Tres'])
  assert.equal(await h.moverRegla(id, c.id, -1, 'momento'), true)
  todas = await h.listarCodigo(id)
  assert.deepEqual(calculo.reglasDelGrupo(todas, 'momento', 'noche').map((r) => r.texto), ['Tres', 'Uno'])
  assert.equal(await h.moverRegla(id, b.id, -1, 'area'), false, 'la primera no sube más')
  const e = await h.editarRegla(id, b.id, { texto: '  Dos bis ', momento: 'siempre' })
  assert.equal(e.texto, 'Dos bis')
  assert.equal(e.momento, 'siempre')
  assert.equal(e.grupo, 'cuerpo')
  assert.equal(await h.borrarRegla(id, b.id), true)
  assert.equal((await h.listarCodigo(id)).length, 2)
})

// ---------- Caídas ----------

test('caída: saca 20 XP, deja la marca del día; deshacer devuelve todo', async () => {
  const id = await personaDePrueba()
  await xp.sumar(id, { clave: 'prueba:1', cantidad: 100, origen: 'manual', fecha: HOY })
  const c = await h.registrarCaida(id, { origen: 'boton' })
  assert.equal(c.fecha, HOY)
  assert.equal(c.xp, 20)
  assert.equal(await xp.total(id), 80)
  assert.deepEqual(await h.caidasPorDia(id, '2026-11-01', '2026-11-30'), { [HOY]: 1 })
  assert.equal(await h.deshacerCaida(id, c.id), true)
  assert.equal(await xp.total(id), 100)
  assert.equal((await h.caidasDelDia(id, HOY)).length, 0)
  assert.equal(await h.deshacerCaida(id, c.id), false)
})

test('caída: con poca XP saca solo lo que hay y la marca igual queda; la XP es editable', async () => {
  const id = await personaDePrueba()
  await xp.sumar(id, { clave: 'prueba:1', cantidad: 7, origen: 'manual', fecha: HOY })
  const c = await h.registrarCaida(id, { origen: 'tension' })
  assert.equal(c.xp, 7)
  assert.equal(await xp.total(id), 0)
  const c2 = await h.registrarCaida(id)
  assert.equal(c2.xp, 0)
  assert.equal((await h.todasLasCaidas(id)).length, 2)
  await h.cambiarConfig(id, { caidaXp: 35 })
  await xp.sumar(id, { clave: 'prueba:2', cantidad: 100, origen: 'manual', fecha: HOY })
  assert.equal((await h.registrarCaida(id)).xp, 35)
})

// ---------- Fotos y marcas ----------

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

test('fotos: se guardan con el día de hoy, la lista no trae la imagen; borrar', async () => {
  const id = await personaDePrueba()
  await assert.rejects(h.agregarFoto(id, { imagen: 'hola' }), /no es una imagen/)
  const f = await h.agregarFoto(id, { imagen: PIXEL, dia: 22 })
  assert.equal(f.fecha, HOY)
  assert.equal(f.dia, 22)
  const lista = await h.listarFotos(id)
  assert.equal(lista.length, 1)
  assert.equal(lista[0].imagen, undefined)
  assert.equal(await h.imagenFoto(id, f.id), PIXEL)
  await h.borrarFoto(id, f.id)
  assert.equal((await h.listarFotos(id)).length, 0)
})

test('marcas: marcar, cambiar el texto y quitar; no se marcan días futuros', async () => {
  const id = await personaDePrueba()
  await h.marcarDia(id, '2026-11-20', 'Primer día sin celu')
  const m = await h.marcarDia(id, '2026-11-20', 'Primer día sin celu en la cama')
  assert.equal(m.texto, 'Primer día sin celu en la cama')
  assert.ok(m.editada)
  await assert.rejects(h.marcarDia(id, '2026-11-24', 'mañana'), /todavía no pasó/)
  await assert.rejects(h.marcarDia(id, '2026-11-20', '  '), /Escribí/)
  assert.equal((await h.listarMarcas(id)).length, 1)
  assert.equal(await h.quitarMarca(id, '2026-11-20'), true)
  assert.equal((await h.listarMarcas(id)).length, 0)
})

// ---------- Resumen de Hoy e importar ----------

test('resumenHoy: piedras en forja, caídas de hoy y cuántas reglas', async () => {
  const id = await personaDePrueba()
  await h.sembrar(id)
  const habito = await h.crearHabito(id, { nombre: 'Leer', kanji: '読' })
  await h.alternarDia(id, habito.id)
  await h.registrarCaida(id)
  const r = await h.resumenHoy(id)
  assert.equal(r.hoy, HOY)
  assert.deepEqual(r.enForja[0], { id: habito.id, nombre: 'Leer', kanji: '読', validos: 1, necesarios: 28, pedazos: 0, hechoHoy: true })
  assert.equal(r.caidasHoy, 1)
  assert.equal(r.reglas, 6)
})

test('importar: trae forja, código, caídas, fotos y marcas de la app vieja, conserva los id y no duplica', async () => {
  const id = await personaDePrueba()
  const viejo = {
    forja: [{ id: 'forja_abc', nombre: 'Agua', kanji: '水', inicio: INI, cumplidos: [INI, sumarDias(INI, 1)], fallas: 0, estado: 'forja', creado: 1 }],
    codigo: [{ id: 'cod_1', texto: 'Flexiones al despertar', grupo: 'cuerpo', orden: 1, creado: 1 }, { id: 'malo', texto: 'x', grupo: 'nada' }],
    caidas: [{ id: 'c1', fecha: '2026-11-10', instante: 5, origen: 'tension', xp: 20 }],
    fotos: [{ id: 'foto_1', fecha: '2026-11-03', dia: 2, imagen: PIXEL, creada: 3 }, { id: 'foto_2', fecha: '2026-11-03', imagen: 'roto' }],
    marcas: [{ fecha: '2026-11-05', texto: 'Cambié de estilo', creada: 4 }],
    ajustes: { forja: { xpDia: 6 }, caida: { xp: 30 }, codigoSembrado: true },
  }
  const n = await h.importar(id, viejo)
  assert.deepEqual(n, { forja: 1, codigo: 1, caidas: 1, fotos: 1, marcas: 1 })
  assert.deepEqual(await h.importar(id, viejo), { forja: 0, codigo: 0, caidas: 0, fotos: 0, marcas: 0 }, 'lo repetido no entra')
  const l = await h.listarForja(id)
  assert.equal(l.enForja[0].habito.id, 'forja_abc')
  assert.equal(l.enForja[0].estado.cumplidos, 2)
  assert.equal(l.config.xpDia, 6)
  assert.equal((await h.listarCodigo(id))[0].momento, 'siempre')
  assert.equal(await h.sembrar(id), 0, 'con código importado no se cargan los ejemplos')
  assert.equal((await h.resumen(id)).caida.xp, 30)
  // Desmarcar hoy un día importado usa la misma clave de XP que la app vieja.
  await xp.importar(id, [{ clave: `forja:forja_abc:${HOY}`, cantidad: 5, origen: 'forja', fecha: HOY, creado: 1 }])
  await h.alternarDia(id, 'forja_abc') // marca hoy: la clave ya existe → no suma de nuevo
  assert.equal(await xp.total(id), 5)
})

// ---------- Rutas ----------

test('rutas: sin sesión no entra; crear cuenta siembra Mi código; la pantalla y la API responden', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ method: 'GET', url: '/api/habitos' })).statusCode, 401)
  const alta = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Ruta', email: `ruta${Date.now()}@prueba.com`, clave: 'clave-de-prueba' } })
  assert.equal(alta.statusCode, 200)
  const cookie = alta.headers['set-cookie']
  const pedir = (method, url, payload) => app.inject({ method, url, payload, headers: { cookie } })

  const pantalla = await pedir('GET', '/habitos')
  assert.equal(pantalla.statusCode, 200)
  assert.match(pantalla.body, /habitos\.js/)

  let r = (await pedir('GET', '/api/habitos')).json()
  assert.equal(r.codigo.length, 6, 'la cuenta nueva arranca con los ejemplos')
  assert.deepEqual((await pedir('GET', '/api/habitos/kanjis?nombre=leer')).json().kanjis[0], '読')

  const creado = (await pedir('POST', '/api/habitos/forja', { nombre: 'Leer', kanji: '読' })).json()
  const tocar = (await pedir('POST', `/api/habitos/forja/${creado.habito.id}/tocar`)).json()
  assert.equal(tocar.resultado.marcado, true)
  assert.equal(tocar.resumen.forja.enForja[0].estado.hechoHoy, true)

  const regla = (await pedir('POST', '/api/habitos/codigo', { texto: 'Nueva', grupo: 'mente', momento: 'tarde' })).json()
  r = (await pedir('POST', `/api/habitos/codigo/${regla.regla.id}/mover`, { dir: -1, vista: 'area' })).json()
  assert.equal(r.codigo.length, 7)
  assert.equal((await pedir('POST', '/api/habitos/codigo', { texto: 'x', grupo: 'cualquiera' })).statusCode, 400)

  const caida = (await pedir('POST', '/api/habitos/caidas', { origen: 'boton' })).json()
  assert.equal(caida.resumen.caida.hoy.length, 1)
  assert.equal((await pedir('POST', `/api/habitos/caidas/${caida.caida.id}/deshacer`)).json().deshecha, true)

  const foto = (await pedir('POST', '/api/habitos/fotos', { imagen: PIXEL })).json()
  const img = await pedir('GET', `/api/habitos/fotos/${foto.foto.id}/imagen`)
  assert.equal(img.statusCode, 200)
  assert.equal(img.headers['content-type'], 'image/png')
  assert.equal((await pedir('PUT', '/api/habitos/marcas/2026-11-20', { texto: 'Algo' })).json().marcas.length, 1)
  assert.equal((await pedir('PUT', '/api/habitos/marcas/2026-99-99', { texto: 'Algo' })).statusCode, 400)
  assert.equal((await pedir('GET', '/api/habitos/caidas?desde=2026-11-01&hasta=2026-11-30')).statusCode, 200)
  await app.close()
})
