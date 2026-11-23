'use strict'
/**
 * Sirve los archivos de las pantallas (sin librerías):
 *   /comun/<archivo>          → comun/pantalla/<archivo>
 *   /m/<modulo>/<archivo>     → modulos/<modulo>/pantallas/<archivo>
 * y una ayuda para que cada módulo sirva su página HTML en su dirección (`pagina`).
 */
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..', '..')
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
}

/** Ruta segura dentro de `carpeta` (nada de ../). null si se sale. */
function dentroDe(carpeta, relativa) {
  const final = path.resolve(carpeta, '.' + path.sep + relativa)
  return final.startsWith(carpeta + path.sep) ? final : null
}

function enviar(respuesta, archivo) {
  if (!archivo || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return respuesta.code(404).send({ error: 'No existe.' })
  const tipo = TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream'
  respuesta.header('Content-Type', tipo)
  respuesta.header('Cache-Control', 'no-cache')
  return respuesta.send(fs.createReadStream(archivo))
}

async function rutas(app) {
  const comun = path.join(RAIZ, 'comun', 'pantalla')
  app.get('/comun/*', async (pedido, respuesta) => enviar(respuesta, dentroDe(comun, pedido.params['*'])))
  app.get('/m/:modulo/*', async (pedido, respuesta) => {
    const { modulo } = pedido.params
    if (!/^[a-z0-9-]+$/.test(modulo)) return respuesta.code(404).send({ error: 'No existe.' })
    const carpeta = path.join(RAIZ, 'modulos', modulo, 'pantallas')
    return enviar(respuesta, dentroDe(carpeta, pedido.params['*']))
  })
}

/** Manda la página HTML de un módulo. Uso en rutas.js: `respuesta => pagina(respuesta, 'juego', 'juego.html')`. */
function pagina(respuesta, modulo, archivo) {
  return enviar(respuesta, dentroDe(path.join(RAIZ, 'modulos', modulo, 'pantallas'), archivo))
}

/** Manda una página de comun/pantalla (entrar, inicio). */
function paginaComun(respuesta, archivo) {
  return enviar(respuesta, dentroDe(path.join(RAIZ, 'comun', 'pantalla'), archivo))
}

module.exports = { rutas, pagina, paginaComun, dentroDe }
