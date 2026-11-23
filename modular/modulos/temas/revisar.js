'use strict'
/**
 * Temas · cuentas puras (sin base): revisar el archivo de un tema subido y armar la definición que ve la pantalla.
 * Traído de src/temas/propios.ts y temas.ts de la app vieja. Lo usa solo ventanilla.js.
 *
 * Un tema subido es un archivo `.sektema` (texto JSON) con nombre, colores, emojis e imágenes.
 * No trae código ni estilos: solo datos que se revisan uno por uno; lo que no sirve se descarta.
 * Lo que el archivo no trae se toma de Shinobi, así nada se rompe.
 */

const FORMATO_TEMA = 'sek-tema'
const EXTENSION_TEMA = '.sektema'

/** Nombres de color que puede traer un tema (los mismos de los widgets y de Organización). */
const COLORES_TEMA = [
  'color-fondo', 'color-tarjeta', 'color-tarjeta-2', 'color-borde', 'color-texto', 'color-texto-2', 'color-texto-3',
  'color-principal', 'color-hecho', 'color-aviso', 'color-con-alguien',
  'color-importancia-alta', 'color-importancia-media', 'color-importancia-baja',
  'color-papel', 'color-papel-2', 'color-peligro',
]

/** Color del tema (nombre genérico) → variables de comun/pantalla/estilo.css. */
const VARIABLES_DE_COLOR = {
  'color-principal': ['--acento'],
  'color-fondo': ['--fondo'],
  'color-tarjeta': ['--fondo-2'],
  'color-tarjeta-2': ['--fondo-3'],
  'color-borde': ['--borde'],
  'color-texto': ['--texto'],
  'color-texto-2': ['--texto-2'],
  'color-texto-3': ['--texto-3'],
  'color-papel': ['--papel'],
  'color-papel-2': ['--papel-2'],
  'color-tinta': ['--tinta'],
  'color-hecho': ['--verde'],
  'color-aviso': ['--ambar'],
  'color-con-alguien': ['--violeta'],
  'color-peligro': ['--peligro'],
}

const MB = 1024 * 1024
const MAX_IMAGEN = 4 * MB
const MAX_VIDEO = 8 * MB
const MAX_TOTAL = 16 * MB
/** Tamaño máximo del texto del archivo (imágenes y 3 videos en base64). Las rutas aceptan hasta esto. */
const MAX_ARCHIVO = Math.ceil(MAX_TOTAL * 1.4 + 3 * MAX_VIDEO * 1.37)
const HEX = /^#[0-9a-f]{6}$/i
const IMAGEN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const VIDEO = /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/=]+$/
const NOMBRES_VIDEO = ['lluvia', 'rayos', 'pc']

class TemaInvalido extends Error {}

const texto = (v, max) => {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[<>]/g, '').trim()
  return t ? t.slice(0, max) : undefined
}
const imagen = (v, nombre) => {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || !IMAGEN.test(v)) throw new TemaInvalido(`La imagen «${nombre}» no es PNG, JPG ni WebP.`)
  if (v.length > MAX_IMAGEN * 1.37) throw new TemaInvalido(`La imagen «${nombre}» pesa más de 4 MB. Achicala y probá de nuevo.`)
  return v
}
const video = (v, nombre) => {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || !VIDEO.test(v)) throw new TemaInvalido(`El video «${nombre}» no es MP4 ni WebM.`)
  if (v.length > MAX_VIDEO * 1.37) throw new TemaInvalido(`El video «${nombre}» pesa más de 8 MB. Achicalo y probá de nuevo.`)
  return v
}
const porNombre = (o, leer) => {
  const d = o && typeof o === 'object' ? o : {}
  const r = {}
  for (const n of NOMBRES_VIDEO) { const v = leer(d[n], n); if (v) r[n] = v }
  return Object.keys(r).length ? r : undefined
}
const uno = (v, opciones) => (opciones.includes(v) ? v : undefined)
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Luminosidad de un color (0 oscuro, 1 claro). */
function luz(hex) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

/** Mezcla dos colores hex: `cuanto` es cuánto del segundo (0 a 1). */
function mezclar(a, b, cuanto) {
  const p = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h).trim()); return m ? m.slice(1).map((x) => parseInt(x, 16)) : null }
  const x = p(a)
  const y = p(b)
  if (!x || !y) return a
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * cuanto).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Lee el texto de un archivo de tema y devuelve solo lo que sirve. Si no es un tema, avisa por qué (TemaInvalido). */
function revisarTema(textoArchivo) {
  if (typeof textoArchivo !== 'string') throw new TemaInvalido('Ese archivo no es un tema de SEK.')
  if (textoArchivo.length > MAX_ARCHIVO) throw new TemaInvalido('El archivo es demasiado grande (más de 16 MB).')
  let d
  try { d = JSON.parse(textoArchivo) } catch { throw new TemaInvalido('Ese archivo no es un tema de SEK.') }
  if (!d || typeof d !== 'object' || d.formato !== FORMATO_TEMA) throw new TemaInvalido('Ese archivo no es un tema de SEK.')
  if (d.version !== 1) throw new TemaInvalido('Este tema es de una versión más nueva de SEK. Actualizá la app.')
  const nombre = texto(d.nombre, 30)
  if (!nombre) throw new TemaInvalido('Al tema le falta el nombre.')

  const colores = {}
  const c = d.colores && typeof d.colores === 'object' ? d.colores : {}
  for (const k of COLORES_TEMA) if (typeof c[k] === 'string' && HEX.test(c[k])) colores[k] = c[k].toUpperCase()

  const simbolos = {}
  for (const [k, v] of Object.entries(d.simbolos && typeof d.simbolos === 'object' ? d.simbolos : {}).slice(0, 300)) {
    const valor = texto(v, 12)
    if (k.length <= 4 && valor) simbolos[k] = valor
  }

  const a = d.adornos && typeof d.adornos === 'object' ? d.adornos : {}
  const adornos = sinVacios({
    aves: uno(a.aves, ['pajaros', 'estrellas']),
    cumplir: uno(a.cumplir, ['corte', 'chispazo']),
    animaciones: uno(a.animaciones, ['shinobi', 'hada']),
    numerosComunes: a.numerosComunes === true ? true : undefined,
  })

  const im = d.imagenes && typeof d.imagenes === 'object' ? d.imagenes : {}
  const widget = Array.isArray(im.widget) ? im.widget.slice(0, 4).map((x, i) => imagen(x, `widget ${i + 1}`)).filter(Boolean) : []
  const imagenes = sinVacios({
    fondo: imagen(im.fondo, 'fondo'),
    vistaPrevia: imagen(im.vistaPrevia, 'vista previa'),
    personaje: imagen(im.personaje, 'personaje'),
    widget: widget.length ? widget : undefined,
    alarma: imagen(im.alarma, 'alarma'),
    videos: porNombre(im.videos, video),
    cuadros: porNombre(im.cuadros, imagen),
  })

  const w = d.widget && typeof d.widget === 'object' ? d.widget : {}
  const e = d.escenas && typeof d.escenas === 'object' ? d.escenas : {}
  const frases = Array.isArray(d.frases) ? d.frases.map((f) => texto(f, 120)).filter(Boolean).slice(0, 40) : []
  const claro = typeof d.claro === 'boolean' ? d.claro : colores['color-fondo'] ? luz(colores['color-fondo']) > 0.6 : false

  return sinVacios({
    formato: FORMATO_TEMA,
    version: 1,
    nombre,
    descripcion: texto(d.descripcion, 120),
    personaje: texto(d.personaje, 30),
    saludo: texto(d.saludo, 160),
    claro,
    colores,
    simbolos,
    adornos,
    frases: frases.length ? frases : undefined,
    imagenes,
    widget: sinVacios({ titulo: texto(w.titulo, 30), estiloTitulo: texto(w.estiloTitulo, 80) }),
    escenas: sinVacios({ tension: texto(e.tension, 400), noCumpli: texto(e.noCumpli, 400) }),
  })
}

/** Id del tema según su nombre: subir de nuevo uno con el mismo nombre lo actualiza. */
function idDeTema(nombre) {
  const s = String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `propio-${s || 'tema'}`
}

/** Las imágenes y videos de un archivo, con un nombre corto cada una (para servirlas por dirección, no adentro del JSON). */
function mediosDe(archivo) {
  const im = archivo.imagenes || {}
  const r = {}
  for (const n of ['fondo', 'vistaPrevia', 'personaje', 'alarma']) if (im[n]) r[n] = im[n]
  ;(im.widget || []).forEach((x, i) => { r[`widget-${i + 1}`] = x })
  for (const n of NOMBRES_VIDEO) {
    if (im.videos && im.videos[n]) r[`video-${n}`] = im.videos[n]
    if (im.cuadros && im.cuadros[n]) r[`cuadro-${n}`] = im.cuadros[n]
  }
  return r
}

/** Un `data:` → { tipo, bytes }. */
function decodificar(dataUrl) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl || '')
  return m ? { tipo: m[1], bytes: Buffer.from(m[2], 'base64') } : null
}

/**
 * Convierte el archivo en una definición como la de los temas que trae la app, completando con `base` (Shinobi)
 * lo que falte. Las imágenes no viajan adentro: van como direcciones (`urlMedio(nombre)`).
 */
function aDefinicion(archivo, id, base, urlMedio) {
  const m = mediosDe(archivo)
  const u = (n) => (m[n] ? urlMedio(n) : undefined)
  const colores = { ...(archivo.colores || {}) }
  // Fondo claro sin color de texto: texto oscuro, si no queda blanco sobre blanco.
  if (archivo.claro) {
    if (!colores['color-texto']) colores['color-texto'] = '#2B2522'
    if (!colores['color-texto-2']) colores['color-texto-2'] = '#5A524C'
    if (!colores['color-texto-3']) colores['color-texto-3'] = '#857C74'
    if (!colores['color-peligro']) colores['color-peligro'] = '#C0304A'
    if (colores['color-tarjeta']) colores['color-tarjeta'] = mezclar(colores['color-tarjeta'], '#FFFFFF', 0.35)
    if (colores['color-tarjeta-2']) colores['color-tarjeta-2'] = mezclar(colores['color-tarjeta-2'], '#FFFFFF', 0.3)
  }
  const fondos = {}
  for (const n of NOMBRES_VIDEO) {
    const video = u(`video-${n}`) || u('video-lluvia')
    const imagenQuieta = u(`cuadro-${n}`) || u('fondo') || u('cuadro-lluvia')
    if (video || imagenQuieta) fondos[n] = sinVacios({ video, imagen: imagenQuieta })
  }
  return {
    id,
    nombre: archivo.nombre,
    descripcion: archivo.descripcion || 'Tema subido por vos. Lo ves solo vos.',
    personaje: archivo.personaje || 'tu compañero',
    saludo: archivo.saludo || 'Soy {personaje}. Desde hoy vamos juntos: un día a la vez.',
    nombreApp: base.nombreApp,
    acento: colores['color-principal'] || base.acento,
    kanjis: true,
    claro: archivo.claro === true,
    propio: true,
    vistaPrevia: sinVacios({ imagen: u('vistaPrevia') || u('fondo') || u('cuadro-lluvia') || base.vistaPrevia.imagen }),
    // Sin escenas, sprite ni Tajo propios: esas partes usan su versión simple.
    medios: { fondos, escenas: null, sprite: null, tajo: null, grano: null, personaje: u('personaje') || null },
    adornos: sinVacios({ ...(archivo.adornos || {}), simbolos: archivo.simbolos }),
    colores: { ...base.colores, ...colores, 'color-principal': colores['color-principal'] || base.acento },
    fuentes: { ...base.fuentes },
    iconos: { ...base.iconos },
    frases: archivo.frases || base.frases,
    widget: sinVacios({ fondos: (archivo.imagenes?.widget || []).map((_, i) => urlMedio(`widget-${i + 1}`)), alarma: u('alarma'), ...(archivo.widget || {}) }),
    ideasEscenas: archivo.escenas || {},
    orden: 100,
  }
}

/** Variables CSS que pone la pantalla para un tema (las de comun/pantalla/estilo.css). */
function variablesCss(def) {
  const v = {}
  const col = def.colores || {}
  for (const [nombre, vars] of Object.entries(VARIABLES_DE_COLOR)) if (col[nombre]) for (const x of vars) v[x] = col[nombre]
  if (def.acento) v['--acento'] = def.acento
  v['--acento-2'] = mezclar(v['--acento'] || '#C8102E', '#000000', 0.17)
  if (def.fuentes && def.fuentes['fuente-decorativa']) v['--pincel'] = def.fuentes['fuente-decorativa']
  return v
}

module.exports = {
  FORMATO_TEMA, EXTENSION_TEMA, COLORES_TEMA, MAX_ARCHIVO, TemaInvalido,
  revisarTema, idDeTema, mediosDe, decodificar, aDefinicion, variablesCss, mezclar,
}
