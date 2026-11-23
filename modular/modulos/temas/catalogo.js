'use strict'
/**
 * Temas · los que trae la app. Cada carpeta de `pantallas/` con un `tema.json` es un tema (hoy: shinobi).
 * Sumar uno = sumar su carpeta; lo que su tema.json no trae se toma de Shinobi, así nada se rompe.
 * Las direcciones de sus archivos quedan completas: `/m/temas/<carpeta>/<archivo>`.
 * Lo usa solo ventanilla.js.
 */
const fs = require('node:fs')
const path = require('node:path')

const PANTALLAS = path.join(__dirname, 'pantallas')
const TEMA_POR_DEFECTO = 'shinobi'

function leerJson(archivo) {
  return JSON.parse(fs.readFileSync(archivo, 'utf8'))
}

/** Dirección web de un archivo de la carpeta del tema (o null si no hay). */
function url(carpeta, relativa) {
  return relativa ? `/m/temas/${carpeta}/${relativa}` : null
}

function completar(crudo, carpeta, base) {
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
    svg: fs.existsSync(path.join(PANTALLAS, carpeta, 'iconos.json')) ? leerJson(path.join(PANTALLAS, carpeta, 'iconos.json')) : (base ? base.svg : {}),
  }
}

let cache = null

/** Todos los temas que trae la app, ordenados. El primero que importa es Shinobi (la base). */
function temasIncluidos() {
  if (cache) return cache
  const carpetas = fs.readdirSync(PANTALLAS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(PANTALLAS, e.name, 'tema.json')))
    .map((e) => e.name)
  const base = completar(leerJson(path.join(PANTALLAS, TEMA_POR_DEFECTO, 'tema.json')), TEMA_POR_DEFECTO, null)
  const otros = carpetas.filter((c) => c !== TEMA_POR_DEFECTO).map((c) => completar(leerJson(path.join(PANTALLAS, c, 'tema.json')), c, base))
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
  return leerJson(path.join(__dirname, 'proximamente.json')).temas
}

module.exports = { TEMA_POR_DEFECTO, temasIncluidos, base, incluido, proximos }
