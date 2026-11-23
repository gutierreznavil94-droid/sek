'use strict'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { prepararBase, personaDePrueba, terminar } = require('../../comun/prueba')
const eventos = require('../../comun/eventos')
const { obtenerAjustes } = require('../../comun/ajustes')
const { ultimos } = require('../../comun/historial')
const { transaccion } = require('../../comun/base')
const revisar = require('./revisar')
const catalogo = require('./catalogo')
const temas = require('./ventanilla')
const { crearApp } = require('../../app')

before(prepararBase)
after(terminar)

// PNG de 1×1 (rojo).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const archivoTema = (extra = {}) => JSON.stringify({
  formato: 'sek-tema', version: 1, nombre: 'Gatitos rosa', descripcion: 'Rosa y suave',
  colores: { 'color-principal': '#e0559b', 'color-fondo': '#fff4f8', 'color-tarjeta': '#ffe3ef', 'color-raro': '#000000', 'color-texto': 'rojo' },
  simbolos: { 水: '💧', 'muy largo': '🙃' },
  adornos: { aves: 'estrellas', cumplir: 'chispazo', animaciones: 'hada', otra: 'x' },
  frases: ['Vamos <b>bien</b>', '', 'Un día a la vez'],
  imagenes: { fondo: PNG, widget: [PNG, PNG] },
  ...extra,
})

test('Shinobi viene con la app y sus variables son las de comun/pantalla/estilo.css (no cambia nada)', () => {
  const s = catalogo.base()
  assert.equal(s.id, 'shinobi')
  assert.equal(s.propio, false)
  assert.equal(s.iconos['icono-hoy'], '今')
  assert.ok(s.svg['icono-hecho'].includes('<path'), 'trae los íconos dibujados')
  assert.equal(s.medios.fondos.lluvia.video, '/m/temas/shinobi/fondos/lluvia.mp4')
  assert.equal(s.medios.escenas, '/m/temas/shinobi/escenas/')
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'comun', 'pantalla', 'estilo.css'), 'utf8')
  const enCss = Object.fromEntries([...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]))
  for (const [k, v] of Object.entries(revisar.variablesCss(s))) {
    if (enCss[k]) assert.equal(v.toLowerCase(), enCss[k], `${k} de Shinobi tiene que ser igual al de estilo.css`)
  }
})

test('los archivos de Shinobi que nombra su tema.json existen (escenas, fondos, sprite, Tajo)', () => {
  const raiz = path.join(__dirname, 'pantallas')
  const s = catalogo.base()
  const archivo = (url) => path.join(raiz, url.replace('/m/temas/', ''))
  for (const f of Object.values(s.medios.fondos)) { assert.ok(fs.existsSync(archivo(f.video)), f.video); assert.ok(fs.existsSync(archivo(f.imagen)), f.imagen) }
  for (const u of [s.medios.sprite, s.medios.tajo, s.medios.grano, s.vistaPrevia.imagen]) assert.ok(fs.existsSync(archivo(u)), u)
  // Las escenas de Juego (té) y de Sueño (samurái, noche) viven en sus módulos: solo las usa esa pantalla.
  for (const e of ['caida/r7-rival-corre', 'tension/t1-mirada']) assert.ok(fs.existsSync(archivo(s.medios.escenas + e + '.mp4')), e)
})

test('revisar un tema subido: se queda solo con lo que sirve', () => {
  const a = revisar.revisarTema(archivoTema())
  assert.equal(a.nombre, 'Gatitos rosa')
  assert.deepEqual(a.colores, { 'color-principal': '#E0559B', 'color-fondo': '#FFF4F8', 'color-tarjeta': '#FFE3EF' })
  assert.deepEqual(a.simbolos, { 水: '💧' })
  assert.deepEqual(a.adornos, { aves: 'estrellas', cumplir: 'chispazo', animaciones: 'hada' })
  assert.deepEqual(a.frases, ['Vamos bbien/b', 'Un día a la vez'], 'sin < ni >')
  assert.equal(a.claro, true, 'fondo claro se deduce del color')
  assert.equal(a.imagenes.widget.length, 2)
  assert.equal(revisar.idDeTema('Gatitos Rosá!'), 'propio-gatitos-rosa')
})

test('revisar un tema subido: avisa claro qué está mal', () => {
  assert.throws(() => revisar.revisarTema('hola'), /no es un tema de SEK/)
  assert.throws(() => revisar.revisarTema(JSON.stringify({ formato: 'otro' })), /no es un tema de SEK/)
  assert.throws(() => revisar.revisarTema(JSON.stringify({ formato: 'sek-tema', version: 2, nombre: 'x' })), /versión más nueva/)
  assert.throws(() => revisar.revisarTema(JSON.stringify({ formato: 'sek-tema', version: 1 })), /falta el nombre/)
  assert.throws(() => revisar.revisarTema(archivoTema({ imagenes: { fondo: 'data:text/html;base64,PHNjcmlwdD4=' } })), /no es PNG, JPG ni WebP/)
  assert.throws(() => revisar.revisarTema(archivoTema({ imagenes: { videos: { lluvia: PNG } } })), /no es MP4 ni WebM/)
})

test('elegir, subir, usar y borrar un tema propio', async () => {
  const id = await personaDePrueba()
  let l = await temas.lista(id)
  assert.equal(l.elegido, 'shinobi')
  assert.equal(l.lluvia, 'lluvia')
  assert.ok(l.proximos.length >= 1)

  const clave = await temas.subir(id, archivoTema())
  assert.equal(clave, 'propio-gatitos-rosa')
  l = await temas.lista(id)
  assert.equal(l.elegido, clave, 'al subirlo queda elegido')
  const tarjeta = l.temas.find((t) => t.id === clave)
  assert.equal(tarjeta.propio, true)
  assert.equal(tarjeta.vistaPrevia.imagen, `/api/temas/propios/${clave}/medio/fondo`, 'la imagen va por dirección, no adentro')

  const t = await temas.temaDe(id)
  assert.equal(t.acento, '#E0559B')
  assert.equal(t.colores['color-texto'], '#2B2522', 'fondo claro sin color de texto: texto oscuro')
  assert.equal(t.colores['color-hecho'], '#78BD97', 'lo que no trae sale de Shinobi')
  assert.equal(t.medios.escenas, null, 'sin escenas: las pantallas usan la versión simple')
  assert.equal(t.medios.fondos.lluvia.imagen, `/api/temas/propios/${clave}/medio/fondo`)
  assert.deepEqual(t.widget.fondos, [`/api/temas/propios/${clave}/medio/widget-1`, `/api/temas/propios/${clave}/medio/widget-2`])

  const m = await temas.medio(id, clave, 'fondo')
  assert.equal(m.tipo, 'image/png')
  assert.equal(m.bytes.subarray(1, 4).toString(), 'PNG')
  await assert.rejects(temas.medio(id, clave, 'alarma'), /no existe/)
  await assert.rejects(temas.medio(id, clave, '../nada'), /no existe/)

  // Subir otro con el mismo nombre lo reemplaza.
  await temas.subir(id, archivoTema({ descripcion: 'Versión 2' }))
  l = await temas.lista(id)
  assert.equal(l.temas.filter((x) => x.propio).length, 1)
  assert.equal(l.temas.find((x) => x.id === clave).descripcion, 'Versión 2')

  const a = await temas.archivoDe(id, clave)
  assert.equal(a.nombreArchivo, 'gatitos-rosa.sektema')
  assert.equal(JSON.parse(a.texto).nombre, 'Gatitos rosa')

  await temas.elegir(id, 'shinobi')
  await temas.elegir(id, clave)
  await assert.rejects(temas.elegir(id, 'no-existe'), /no existe/)
  await temas.borrarPropio(id, clave)
  assert.equal((await obtenerAjustes(id)).tema, 'shinobi', 'borrar el que estaba en uso vuelve a Shinobi')
  await assert.rejects(temas.borrarPropio(id, clave), /no existe/)
  const tipos = (await ultimos(id)).filter((h) => h.modulo === 'temas').map((h) => h.tipo)
  assert.deepEqual(tipos.sort(), ['borrar', 'elegir', 'elegir', 'subir', 'subir'])
})

test('cada persona ve solo sus temas subidos', async () => {
  const a = await personaDePrueba('Ana')
  const b = await personaDePrueba('Beto')
  const clave = await temas.subir(a, archivoTema())
  assert.equal((await temas.lista(b)).temas.some((t) => t.id === clave), false)
  await assert.rejects(temas.elegir(b, clave), /no existe/)
  await assert.rejects(temas.medio(b, clave, 'fondo'), /no existe/)
})

test('si el tema elegido ya no está, se ve Shinobi', async () => {
  const id = await personaDePrueba()
  const { guardarAjustes } = require('../../comun/ajustes')
  await guardarAjustes(id, { tema: 'propio-borrado' })
  assert.equal((await temas.temaDe(id)).id, 'shinobi')
  assert.equal((await temas.lista(id)).elegido, 'shinobi')
})

test('lluvia: apagada, llovizna, lluvia o tormenta', async () => {
  const id = await personaDePrueba()
  assert.equal(await temas.guardarLluvia(id, 'tormenta'), 'tormenta')
  assert.equal((await temas.activo(id)).lluvia, 'tormenta')
  await assert.rejects(temas.guardarLluvia(id, 'granizo'), /apagada, llovizna, lluvia o tormenta/)
})

test('xp.nivel deja un aviso que la próxima pantalla muestra una sola vez (dentro de la misma transacción)', async () => {
  temas.desconectar()
  temas.conectar()
  const id = await personaDePrueba()
  await eventos.avisar('xp.nivel', { usuarioId: id, nivel: 2, xpTotal: 120 })
  await eventos.avisar('xp.nivel', { usuarioId: id, nivel: 3, xpTotal: 310 })
  // Si la transacción de quien avisó vuelve atrás, el aviso tampoco queda.
  await assert.rejects(transaccion(async (tx) => {
    await eventos.avisar('xp.nivel', { usuarioId: id, nivel: 4, xpTotal: 600 }, tx)
    throw new Error('vuelve atrás')
  }))
  const r = await temas.activo(id)
  assert.deepEqual(r.avisos.map((a) => a.nivel), [2, 3])
  assert.equal(r.avisos[0].nombre, 'xp.nivel')
  assert.equal(r.tema.variables['--acento'], '#C8102E')
  assert.deepEqual((await temas.activo(id)).avisos, [], 'ya se mostraron')
})

test('importar de la copia vieja: el tema elegido y los archivos que sirvan', async () => {
  const id = await personaDePrueba()
  const n = await temas.importar(id, { tema: 'propio-gatitos-rosa', archivos: [archivoTema(), 'no es un tema', JSON.parse(archivoTema({ nombre: 'Otro' }))] })
  assert.equal(n, 2)
  assert.equal((await temas.lista(id)).elegido, 'propio-gatitos-rosa')
  assert.equal(await temas.importar(id, { tema: 'que-no-existe' }), 0)
  assert.equal((await temas.lista(id)).elegido, 'propio-gatitos-rosa', 'un tema que no existe no cambia nada')
})

test('rutas: piden sesión, sirven la pantalla y los archivos, suben y borran', async () => {
  const app = crearApp({ logger: false })
  assert.equal((await app.inject({ url: '/api/temas/activo' })).statusCode, 401)
  const r = await app.inject({ method: 'POST', url: '/api/sesion/crear-cuenta', payload: { nombre: 'Tema', email: 'tema@prueba.com', clave: 'clave-segura' } })
  const cookie = r.headers['set-cookie'].split(';')[0]
  const pedir = (o) => app.inject({ ...o, headers: { cookie, ...(o.headers || {}) } })
  assert.equal((await pedir({ url: '/temas' })).statusCode, 200)
  for (const f of ['tema.js', 'tema.css', 'lluvia.js', 'sin-kanjis.js', 'temas.js', 'shinobi/fondos/lluvia.jpg', 'shinobi/companero/camina.webp']) {
    assert.equal((await pedir({ url: `/m/temas/${f}` })).statusCode, 200, f)
  }
  const activo = (await pedir({ url: '/api/temas/activo' })).json()
  assert.equal(activo.tema.id, 'shinobi')
  assert.ok(activo.tema.variables['--fondo'])

  const subida = await pedir({ method: 'POST', url: '/api/temas/propios', payload: { texto: archivoTema() } })
  assert.equal(subida.statusCode, 200)
  assert.equal(subida.json().elegido, 'propio-gatitos-rosa')
  const img = await pedir({ url: '/api/temas/propios/propio-gatitos-rosa/medio/fondo' })
  assert.equal(img.statusCode, 200)
  assert.equal(img.headers['content-type'], 'image/png')
  const arch = await pedir({ url: '/api/temas/propios/propio-gatitos-rosa/archivo' })
  assert.match(arch.headers['content-disposition'], /gatitos-rosa\.sektema/)
  assert.equal((await pedir({ method: 'POST', url: '/api/temas/propios', payload: { texto: 'nada' } })).json().error, 'Ese archivo no es un tema de SEK.')
  assert.equal((await pedir({ method: 'PUT', url: '/api/temas/elegido', payload: { id: 'shinobi' } })).json().elegido, 'shinobi')
  assert.equal((await pedir({ method: 'PUT', url: '/api/temas/lluvia', payload: { lluvia: 'llovizna' } })).json().lluvia, 'llovizna')
  assert.equal((await pedir({ method: 'DELETE', url: '/api/temas/propios/propio-gatitos-rosa' })).statusCode, 200)
  // Un tema grande (más de 1 MB, el tope normal) también entra.
  const grande = archivoTema({ imagenes: { fondo: 'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024) } })
  assert.equal((await pedir({ method: 'POST', url: '/api/temas/propios', payload: { texto: grande } })).statusCode, 200)
  await app.close()
})
