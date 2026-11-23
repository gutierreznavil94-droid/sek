'use strict'
/**
 * Temas · los que trae la app. Cada carpeta de `pantallas/` con un `tema.json` es un tema (hoy: shinobi).
 * Sumar uno = sumar su carpeta; lo que su tema.json no trae se toma de Shinobi, así nada se rompe.
 * Las direcciones de sus archivos quedan completas: `/m/temas/<carpeta>/<archivo>`.
 * Lo usa solo ventanilla.js.
 */
const TEMA_POR_DEFECTO = 'shinobi'

/**
 * Las carpetas de temas: { carpeta: { tema, iconos } }. En el celu vienen adentro del paquete
 * (SEK_TEMAS, lo arma herramientas/armar-celu.js); en la compu se leen de pantallas/.
 */
function leerCarpetas() {
  if (typeof SEK_TEMAS !== 'undefined') return SEK_TEMAS
  const fs = require('node:fs')
  const path = require('node:path')
  const pantallas = path.join(__dirname, 'pantallas')
  const leer = (a) => JSON.parse(fs.readFileSync(a, 'utf8'))
  const salida = {}
  for (const e of fs.readdirSync(pantallas, { withFileTypes: true })) {
    const dir = path.join(pantallas, e.name)
    if (!e.isDirectory() || !fs.existsSync(path.join(dir, 'tema.json'))) continue
    salida[e.name] = { tema: leer(path.join(dir, 'tema.json')), iconos: fs.existsSync(path.join(dir, 'iconos.json')) ? leer(path.join(dir, 'iconos.json')) : null }
  }
  return salida
}

/** Dirección web de un archivo de la carpeta del tema (o null si no hay). */
function url(carpeta, relativa) {
  return relativa ? `/m/temas/${carpeta}/${relativa}` : null
}

function completar(crudo, carpeta, base, iconos) {
  const lleno = Object.fromEntries(Object.entries(crudo).filter(([, v]) => v !== '' && v !== null && v !== undefined))
  const t = base ? { ...base, ...lleno } : lleno
  const m = crudo.medios || {}
  const fondos = {}
  if (m.fondos) for (const n of ['lluvia', 'rayos', 'pc']) fondos[n] = { video: url(carpeta, `${m.fondos}${n}.mp4`), imagen: url(carpeta, `${m.fondos}${n}.jpg`) }
  const vp = crudo.vistaPrevia || {}
  return {
    ...t,
    id: crudo.id || carpeta,
    propio: false,
    claro: crudo.claro === true,
    colores: { ...(base ? base.colores : {}), ...(crudo.colores || {}) },
    fuentes: { ...(base ? base.fuentes : {}), ...(crudo.fuentes || {}) },
    iconos: { ...(base ? base.iconos : {}), ...(crudo.iconos || {}) },
    adornos: { ...(base ? base.adornos : {}), ...(crudo.adornos || {}) },
    vistaPrevia: vp.imagen ? { imagen: url(carpeta, vp.imagen), video: url(carpeta, vp.video) } : (base ? base.vistaPrevia : {}),
    medios: m.fondos || m.escenas ? {
      fondos,
      escenas: url(carpeta, m.escenas),
      sprite: url(carpeta, m.sprite),
      tajo: url(carpeta, m.tajo),
      grano: url(carpeta, m.grano),
      personaje: null,
    } : (base ? base.medios : {}),
    svg: iconos || (base ? base.svg : {}),
  }
}

let cache = null

/** Todos los temas que trae la app, ordenados. El primero que importa es Shinobi (la base). */
function temasIncluidos() {
  if (cache) return cache
  const carpetas = leerCarpetas()
  const de = (c, b) => completar(carpetas[c].tema, c, b, carpetas[c].iconos)
  const base = de(TEMA_POR_DEFECTO, null)
  const otros = Object.keys(carpetas).filter((c) => c !== TEMA_POR_DEFECTO).map((c) => de(c, base))
  cache = [base, ...otros].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
  return cache
}

function base() {
  return temasIncluidos().find((t) => t.id === TEMA_POR_DEFECTO)
}

function incluido(id) {
  return temasIncluidos().find((t) => t.id === id) || null
}

/** Tarjetas «Próximamente» que se muestran al lado de los temas listos. */
function proximos() {
  return require('./proximamente.json').temas
}

module.exports = { leerCarpetas, TEMA_POR_DEFECTO, temasIncluidos, base, incluido, proximos }
