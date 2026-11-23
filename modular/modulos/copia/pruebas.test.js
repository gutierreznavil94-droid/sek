'use strict'
const { test, before, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const reloj = require('../../comun/reloj')
const { obtenerAjustes } = require('../../comun/ajustes')
const sesion = require('../../comun/sesion')
const { crearApp } = require('../../app') // registra la siembra de cada cuenta nueva, como en la app real
const copia = require('./ventanilla')
const formato = require('./formato')
const xp = require('../xp/ventanilla')
const juego = require('../juego/ventanilla')
const ciclo = require('../ciclo/ventanilla')
const dia = require('../dia/ventanilla')
const sueno = require('../sueno/ventanilla')
const habitos = require('../habitos/ventanilla')
const comida = require('../comida/ventanilla')
const entreno = require('../entreno/ventanilla')
const organizacion = require('../organizacion/ventanilla')
const temas = require('../temas/ventanilla')

/** Una copia de ejemplo de «Copiar todo como texto» de la app vieja (con todas las tablas que se reparten y algunas que no). */
const TEXTO_VIEJO = fs.readFileSync(path.join(__dirname, 'ejemplo-copia-vieja.json'), 'utf8')
const VIEJA = JSON.parse(TEXTO_VIEJO)
/** Una cuenta como las de verdad: con lo que siembra cada módulo al crearla (pilares, atributos, series, Mi código). */
async function cuentaNueva(nombre) {
  const id = await personaDePrueba(nombre)
  for (const fn of sesion.alCrearCuenta) await fn(id)
  return id
}
const conCambios = (f) => { const o = JSON.parse(TEXTO_VIEJO); f(o); return JSON.stringify(o) }

before(prepararBase)
after(terminar)
beforeEach(() => reloj.fijar(Date.UTC(2026, 10, 23, 13, 0, 0))) // lunes 23 nov 2026, 10:00 en Córdoba

// ---------- formato.js (sin base) ----------

test('formato: reconoce la copia vieja y la reparte por módulo', () => {
  const c = formato.leerTexto(`\n  ${TEXTO_VIEJO}  \n`)
  assert.equal(c.origen, 'vieja')
  assert.equal(c.exportado, VIEJA.exportado)
  assert.equal(c.partes.xp.length, 3)
  assert.equal(c.partes.juego.length, 1)
  assert.deepEqual(Object.keys(c.partes.ciclo), formato.TABLAS_VIEJAS.ciclo)
  assert.equal(c.partes.habitos.ajustes.id, 'unicos', 'habitos recibe el objeto de ajustes')
  assert.ok(Array.isArray(c.partes.comida.ajustes), 'comida recibe la tabla de ajustes')
  assert.equal(c.partes.temas.tema, 'shinobi')
  assert.deepEqual(c.sinUsar.map((x) => x.tabla).sort(), ['eventos', 'feriados'], 'tablas vacías no se listan')
  assert.equal(c.partes.desafios.ninjas.length, 1)
  assert.equal(c.partes.desafios.ajustes.id, 'unicos', 'desafios recibe el objeto de ajustes')
  assert.equal(formato.cuantas(c.partes.organizacion), 2, 'una tarea y una en la bandeja')
  // Ajustes: los de comun, sin id ni tema; la lluvia pasa a un solo valor.
  assert.equal(c.ajustes.limiteJuegoSemana, 45)
  assert.equal(c.ajustes.lluvia, 'tormenta')
  assert.equal(c.ajustes.id, undefined)
  assert.equal(c.ajustes.tema, undefined)
  assert.equal(formato.ajustesDeVieja({ fondoLluvia: { hoy: false, juego: false }, lluviaIntensidad: 'tormenta' }).lluvia, 'apagada')
})

test('formato: lo que no es una copia se explica claro', () => {
  assert.throws(() => formato.leerTexto(''), /Pegá el texto/)
  assert.throws(() => formato.leerTexto('{"app": "sistema-progreso", "tablas": '), /no se pudo leer/)
  assert.throws(() => formato.leerTexto('[1, 2]'), /no es una copia de SEK/)
  assert.throws(() => formato.leerTexto('{"app": "otra", "tablas": {}}'), /no es una copia de SEK/)
  assert.throws(() => formato.leerTexto('{"app": "sistema-progreso", "version": 9, "tablas": {}}'), /más nueva/)
  assert.throws(() => formato.leerTexto('{"app": "sek", "version": 9, "modulos": {}}'), /más nueva/)
  assert.equal(formato.total({ a: 2, b: 3, c: 'x' }), 5)
  assert.equal(formato.total(4), 4)
})

// ---------- importar la copia de la app vieja ----------

test('revisar muestra qué trae sin guardar nada', async () => {
  const id = await cuentaNueva()
  const r = await copia.revisar(id, TEXTO_VIEJO)
  assert.equal(r.origen, 'vieja')
  assert.equal(r.yaImportada, null)
  const filas = Object.fromEntries(r.partes.map((p) => [p.clave, p.filas]))
  assert.deepEqual(filas, { ciclo: 10, dia: 6, xp: 3, juego: 1, organizacion: 2, sueno: 1, habitos: 5, comida: 7, entreno: 4, desafios: 2, temas: 1 })
  assert.ok(r.ajustes > 5)
  assert.equal((await juego.historial(id)).length, 0, 'revisar no guarda')
})

test('importar la copia de ejemplo: cada módulo recibe lo suyo', async () => {
  const id = await cuentaNueva()
  const r = await copia.importar(id, TEXTO_VIEJO)
  assert.equal(r.origen, 'vieja')
  for (const m of formato.CLAVES.filter((k) => k !== 'temas')) assert.ok(r.resultado[m] > 0, `entró algo de ${m}`)
  assert.equal(r.total, formato.total(r.resultado))
  assert.deepEqual(r.sinUsar.map((x) => x.tabla).sort(), ['eventos', 'feriados'])

  // ciclo: Día 22 del ciclo viejo, con su identidad y su atributo propio
  const d = await ciclo.diaDelCiclo(id)
  assert.equal(d.ciclo.id, 'ciclo_1')
  assert.equal(d.dia, 22)
  assert.equal((await ciclo.identidad(id)).vision, 'Ser alguien que cumple lo que se promete')
  // dia: el pilar viejo, con su compromiso cumplido
  assert.equal((await dia.compromisosDelDia(id, '2026-11-20')).find((c) => c.accionId === 'manga').estado, 'completado')
  // xp: suma, resta y anulado (15 − 7 = 8)
  assert.equal(await xp.total(id), 8)
  // juego, sueño, comida, entreno, hábitos, organización
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 25)
  assert.equal((await sueno.noches(id, '2026-11-19', '2026-11-19'))[0].cumplido, true)
  assert.equal((await comida.delDia(id, '2026-11-20')).lista.length, 2)
  assert.equal((await comida.aguaDelDia(id, '2026-11-20')).ml, 750)
  assert.equal(await entreno.totalDelDia(id, 'flexiones', '2026-11-20'), 14)
  assert.ok((await habitos.listarForja(id)).enForja.some((h) => h.habito.id === 'forja_agua'))
  assert.equal((await organizacion.leer(id)).datos.bandeja.length, 1)
  // ajustes de comun y el tema
  const a = await obtenerAjustes(id)
  assert.equal(a.limiteJuegoSemana, 45)
  assert.equal(a.nombrePersona, 'Navil')
  assert.equal(a.lluvia, 'tormenta')
  assert.equal(a.caida.xp, 25)
  assert.equal(a.tema, 'shinobi')
  assert.equal((await temas.activo(id)).tema.id, 'shinobi')
})

test('la misma copia no se importa dos veces', async () => {
  const id = await cuentaNueva()
  await copia.importar(id, TEXTO_VIEJO)
  await assert.rejects(copia.importar(id, TEXTO_VIEJO), (e) => e.estado === 409 && /ya se importó/.test(e.message))
  assert.ok((await copia.revisar(id, TEXTO_VIEJO)).yaImportada)
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 25, 'no duplicó el juego')
  assert.equal((await copia.estado(id)).importaciones.length, 1)
  // Otra copia (otro momento) con lo mismo adentro: entra, pero lo repetido no se duplica.
  const r = await copia.importar(id, conCambios((o) => { o.exportado += 1000 }))
  assert.equal(r.resultado.xp, 0)
  assert.equal(r.resultado.juego, 0)
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 25)
})

test('todo o nada: si un módulo falla, no entra nada (y se puede volver a intentar)', async () => {
  const id = await cuentaNueva()
  const rota = conCambios((o) => { o.tablas.xp.push({ clave: 'rota', cantidad: 1e12, origen: 'manual', fecha: '2026-11-21', creado: 1 }) })
  await assert.rejects(copia.importar(id, rota))
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 0)
  assert.equal(await ciclo.diaDelCiclo(id), null)
  assert.equal((await obtenerAjustes(id)).limiteJuegoSemana, 60)
  assert.equal((await copia.estado(id)).importaciones.length, 0, 'no quedó anotada')
  await copia.importar(id, TEXTO_VIEJO)
  assert.equal(await juego.minutosDelDia(id, '2026-11-20'), 25)
})

// ---------- exportar y volver a importar ----------

test('exportar y volver a importar en otra cuenta deja lo mismo', async () => {
  const a = await cuentaNueva('Ana')
  await copia.importar(a, TEXTO_VIEJO)
  await juego.agregarManual(a, { inicio: Date.UTC(2026, 10, 22, 18, 0), fin: Date.UTC(2026, 10, 22, 18, 40) })
  const exportada = await copia.exportar(a)
  assert.equal(exportada.app, 'sek')
  assert.deepEqual(Object.keys(exportada.modulos), formato.CLAVES)
  assert.ok((await copia.estado(a)).ultimaExportacion)

  const texto = JSON.stringify(exportada)
  const b = await cuentaNueva('Beto')
  const rev = await copia.revisar(b, texto)
  assert.equal(rev.origen, 'nueva')
  const r = await copia.importar(b, texto)
  assert.equal(r.resultado.xp, 3)
  assert.equal(r.resultado.juego, 2)

  const otra = await copia.exportar(b)
  assert.deepEqual(otra.modulos.xp, exportada.modulos.xp)
  assert.deepEqual(otra.modulos.juego, exportada.modulos.juego)
  assert.deepEqual(otra.modulos.sueno, exportada.modulos.sueno)
  assert.deepEqual(otra.modulos.dia.compromisos, exportada.modulos.dia.compromisos)
  assert.deepEqual(otra.modulos.ciclo.ciclos, exportada.modulos.ciclo.ciclos)
  assert.deepEqual(otra.modulos.ciclo.metas, exportada.modulos.ciclo.metas)
  assert.deepEqual(otra.modulos.habitos.fotos, exportada.modulos.habitos.fotos)
  const comidaCorta = (m) => m.comida.comidas.map((c) => `${c.fecha} ${c.franja} ${c.nombre} ${c.gramos}`)
  assert.deepEqual(comidaCorta(otra.modulos), comidaCorta(exportada.modulos))
  assert.equal(otra.modulos.entreno.registrosContador.length, exportada.modulos.entreno.registrosContador.length)
  assert.deepEqual(otra.modulos.organizacion.bandeja, exportada.modulos.organizacion.bandeja)
  assert.equal(otra.ajustes.limiteJuegoSemana, 45)
  assert.equal(await juego.minutosDelDia(b, '2026-11-22'), 40)
  // cada persona ve solo lo suyo: Ana no recibió nada de Beto
  assert.equal((await copia.estado(a)).importaciones.length, 1)
})

// ---------- web ----------

test('web: pantalla y API de copia piden sesión y funcionan (también con copias grandes)', async () => {
  const app = crearApp({ logger: process.env.VER_LOG ? { level: 'error' } : false })
  assert.equal((await app.inject({ url: '/mas/copia' })).statusCode, 302)
  assert.equal((await app.inject({ url: '/api/copia' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Web', email: 'web-copia@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pedir = (method, url, payload) => app.inject({ method, url, headers: { cookie }, payload })

  const pag = await pedir('GET', '/mas/copia')
  assert.equal(pag.statusCode, 200)
  assert.match(pag.body, /Copia de seguridad/)
  assert.equal((await pedir('GET', '/m/copia/copia.js')).statusCode, 200)

  assert.equal((await pedir('POST', '/api/copia/revisar', { texto: 'hola' })).statusCode, 400)
  assert.equal((await pedir('POST', '/api/copia/revisar', {})).statusCode, 400)
  // Una copia de más de 1 MB (fotos): entra igual.
  const grande = conCambios((o) => { o.tablas.recomendaciones = [{ texto: 'x'.repeat(2 * 1024 * 1024) }] })
  const rev = await pedir('POST', '/api/copia/revisar', { texto: grande })
  assert.equal(rev.statusCode, 200, rev.body)
  assert.equal(rev.json().origen, 'vieja')
  const imp = await pedir('POST', '/api/copia/importar', { texto: grande })
  assert.equal(imp.statusCode, 200, imp.body)
  assert.ok(imp.json().total > 20)
  const otra = await pedir('POST', '/api/copia/importar', { texto: grande })
  assert.equal(otra.statusCode, 409)
  assert.match(otra.json().error, /ya se importó/)

  const exp = await pedir('GET', '/api/copia/exportar?descargar=1')
  assert.equal(exp.statusCode, 200)
  assert.match(exp.headers['content-disposition'], /attachment; filename="sek-2026-11-23\.json"/)
  assert.equal(exp.json().app, 'sek')
  const est = (await pedir('GET', '/api/copia')).json()
  assert.ok(est.ultimaExportacion)
  assert.equal(est.importaciones.length, 1)
  await app.close()
})
