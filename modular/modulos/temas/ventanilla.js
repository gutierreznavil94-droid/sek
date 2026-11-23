'use strict'
/**
 * Temas · la única puerta del módulo.
 * Lo visual de SEK: qué tema eligió cada persona, los temas que trae la app (Shinobi), los que sube cada persona
 * (archivo .sektema) y los avisos visuales que llegan del servidor (subir de nivel).
 * No usa ningún otro módulo: solo comun/. Escucha el aviso `xp.nivel` (lo conecta rutas.js con `conectar()`).
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const catalogo = require('./catalogo')
const revisar = require('./revisar')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { escuchar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const INTENSIDADES = ['apagada', 'llovizna', 'lluvia', 'tormenta']
const AVISOS_QUE_ESCUCHA = ['xp.nivel']

const urlMedio = (clave) => (nombre) => `/api/temas/propios/${encodeURIComponent(clave)}/medio/${nombre}`

/** De una fila de temas_propios (con o sin imágenes) a la definición que ve la pantalla. */
function definicionPropia(fila) {
  const a = fila.archivo
  // Sin imágenes en la fila (listado liviano): las direcciones salen de las marcas tiene_*.
  if (!a.imagenes && (fila.tiene_vista || fila.tiene_fondo || fila.tiene_cuadro)) {
    a.imagenes = {}
    if (fila.tiene_vista) a.imagenes.vistaPrevia = 'x'
    if (fila.tiene_fondo) a.imagenes.fondo = 'x'
    if (fila.tiene_cuadro) a.imagenes.cuadros = { lluvia: 'x' }
  }
  return revisar.aDefinicion(a, fila.clave, catalogo.base(), urlMedio(fila.clave))
}

/** Lo corto para la lista de temas. */
const tarjeta = (t) => ({ id: t.id, nombre: t.nombre, descripcion: t.descripcion, personaje: t.personaje, acento: t.acento, claro: !!t.claro, propio: !!t.propio, vistaPrevia: t.vistaPrevia, sprite: (t.medios && t.medios.sprite) || null })

/** Todos los temas que puede elegir la persona: los de la app y, después, los que subió. */
async function lista(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const propios = (await datos.propios(usuarioId, tx)).map(definicionPropia)
  const temas = [...catalogo.temasIncluidos(), ...propios]
  const elegido = temas.some((t) => t.id === a.tema) ? a.tema : catalogo.TEMA_POR_DEFECTO
  return { elegido, lluvia: a.lluvia, temas: temas.map(tarjeta), proximos: catalogo.proximos() }
}

/** El tema elegido por la persona, completo (colores, íconos, letras, medios). Si ya no existe, Shinobi. */
async function temaDe(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const incluido = catalogo.incluido(a.tema)
  if (incluido) return incluido
  if (String(a.tema).startsWith('propio-')) {
    const fila = await datos.propio(usuarioId, a.tema, tx)
    if (fila) return definicionPropia(fila)
  }
  return catalogo.base()
}

/** Lo que pide cada pantalla al abrirse: el tema con sus variables CSS, la lluvia y los avisos pendientes (se entregan una vez). */
async function activo(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const tema = await temaDe(usuarioId, tx)
  const avisos = (await datos.tomarAvisos(usuarioId, tx)).sort((x, y) => x.creado - y.creado || x.id - y.id)
    .map((v) => ({ nombre: v.nombre, ...v.datos }))
  return { tema: { ...tema, variables: revisar.variablesCss(tema) }, lluvia: a.lluvia, nombreApp: a.nombreApp, avisos }
}

/** Elige un tema (de la app o uno subido). */
async function elegir(usuarioId, id, tx = null) {
  const antes = (await obtenerAjustes(usuarioId, tx)).tema
  const existe = catalogo.incluido(id) || (String(id).startsWith('propio-') && await datos.propio(usuarioId, id, tx))
  if (!existe) throw noEncontrado('Ese tema')
  await guardarAjustes(usuarioId, { tema: id }, tx)
  if (antes !== id) await anotar(usuarioId, 'temas', 'elegir', { antes, despues: id }, tx)
  return lista(usuarioId, tx)
}

/** Lluvia de fondo: apagada, llovizna, lluvia o tormenta. */
async function guardarLluvia(usuarioId, intensidad, tx = null) {
  if (!INTENSIDADES.includes(intensidad)) throw datoInvalido('La lluvia puede ser: apagada, llovizna, lluvia o tormenta.')
  const antes = (await obtenerAjustes(usuarioId, tx)).lluvia
  await guardarAjustes(usuarioId, { lluvia: intensidad }, tx)
  if (antes !== intensidad) await anotar(usuarioId, 'temas', 'lluvia', { antes, despues: intensidad }, tx)
  return intensidad
}

/** Sube un tema desde el texto del archivo .sektema. Si ya había uno con ese nombre, lo actualiza. Devuelve su id. */
async function subir(usuarioId, textoArchivo, { elegirlo = true } = {}, tx = null) {
  let archivo
  try { archivo = revisar.revisarTema(textoArchivo) } catch (e) {
    if (e instanceof revisar.TemaInvalido) throw datoInvalido(e.message)
    throw e
  }
  const clave = revisar.idDeTema(archivo.nombre)
  await datos.guardar(usuarioId, clave, archivo, ahora(), tx)
  await anotar(usuarioId, 'temas', 'subir', { id: clave, nombre: archivo.nombre }, tx)
  if (elegirlo) await guardarAjustes(usuarioId, { tema: clave }, tx)
  return clave
}

/** Borra un tema subido. Si era el elegido, vuelve a Shinobi. */
async function borrarPropio(usuarioId, id, tx = null) {
  const fila = await datos.propio(usuarioId, id, tx)
  if (!fila) throw noEncontrado('Ese tema')
  await datos.borrar(usuarioId, id, tx)
  await anotar(usuarioId, 'temas', 'borrar', { id, nombre: fila.archivo.nombre }, tx)
  if ((await obtenerAjustes(usuarioId, tx)).tema === id) await guardarAjustes(usuarioId, { tema: catalogo.TEMA_POR_DEFECTO }, tx)
}

/** El archivo .sektema de un tema subido, para volver a compartirlo. { nombreArchivo, texto } */
async function archivoDe(usuarioId, id, tx = null) {
  const fila = await datos.propio(usuarioId, id, tx)
  if (!fila) throw noEncontrado('Ese tema')
  return { nombreArchivo: `${id.replace(/^propio-/, '')}${revisar.EXTENSION_TEMA}`, texto: JSON.stringify(fila.archivo) }
}

/** Una imagen o video de un tema subido: { tipo, bytes }. Nombres: fondo, vistaPrevia, personaje, alarma, widget-N, video-X, cuadro-X. */
async function medio(usuarioId, id, nombre, tx = null) {
  let camino = null
  if (['fondo', 'vistaPrevia', 'personaje', 'alarma'].includes(nombre)) camino = ['imagenes', nombre]
  else if (/^widget-[1-4]$/.test(nombre)) camino = ['imagenes', 'widget', String(Number(nombre.slice(7)) - 1)]
  else if (/^(video|cuadro)-(lluvia|rayos|pc)$/.test(nombre)) { const [q, n] = nombre.split('-'); camino = ['imagenes', q === 'video' ? 'videos' : 'cuadros', n] }
  if (!camino) throw noEncontrado('Esa imagen')
  const f = await datos.parte(usuarioId, id, camino, tx)
  const m = f && revisar.decodificar(f.valor)
  if (!m) throw noEncontrado('Esa imagen')
  return m
}

/**
 * Trae lo de temas de una copia de la app vieja: el tema elegido (ajuste `tema`) y, si vienen, archivos .sektema
 * (texto u objeto). Lo usa el módulo **copia**. Devuelve cuántos temas subidos entraron.
 */
async function importar(usuarioId, { tema, archivos } = {}, tx = null) {
  let n = 0
  for (const a of archivos || []) {
    try { await subir(usuarioId, typeof a === 'string' ? a : JSON.stringify(a), { elegirlo: false }, tx); n++ } catch (e) { if (!(e && e.estado === 400)) throw e }
  }
  if (tema) { try { await elegir(usuarioId, tema, tx) } catch (e) { if (!(e && e.estado === 404)) throw e } }
  return n
}

/** El tema elegido y los temas subidos (archivo completo), con la forma que recibe `importar`. Lo usa el módulo copia. */
async function exportar(usuarioId, tx = null) {
  const archivos = []
  for (const f of await datos.propios(usuarioId, tx)) {
    const completo = await datos.propio(usuarioId, f.clave, tx)
    if (completo) archivos.push(completo.archivo)
  }
  return { tema: (await obtenerAjustes(usuarioId, tx)).tema, archivos }
}

/** Guarda un aviso visual para mostrarlo la próxima vez que se abra una pantalla. */
async function guardarAviso(usuarioId, nombre, detalle = {}, tx = null) {
  await datos.crearAviso(usuarioId, nombre, detalle, ahora(), tx)
}

let conectado = false
/** Empieza a escuchar los avisos de otros módulos (una sola vez). `xp.nivel` → animación de nivel en la próxima pantalla. */
function conectar() {
  if (conectado) return
  conectado = true
  escuchar('xp.nivel', async (d, tx) => {
    if (d && d.usuarioId) await guardarAviso(d.usuarioId, 'xp.nivel', { nivel: d.nivel, xpTotal: d.xpTotal }, tx)
  })
}
/** Pruebas: deja volver a conectar después de `eventos.limpiar()`. */
function desconectar() { conectado = false }

module.exports = {
  INTENSIDADES, AVISOS_QUE_ESCUCHA, EXTENSION_TEMA: revisar.EXTENSION_TEMA, MAX_ARCHIVO: revisar.MAX_ARCHIVO,
  lista, temaDe, activo, elegir, guardarLluvia, subir, borrarPropio, archivoDe, medio, importar, exportar, guardarAviso, conectar, desconectar,
}
