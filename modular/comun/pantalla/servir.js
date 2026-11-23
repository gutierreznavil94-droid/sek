'use strict'
/**
 * Sirve los archivos de las pantallas (sin librerías):
 *   /comun/<archivo>          → comun/pantalla/<archivo>
 *   /m/<modulo>/<archivo>     → modulos/<modulo>/pantallas/<archivo>
 * y una ayuda para que cada módulo sirva su página HTML en su dirección (`pagina`).
 *
 * En la compu (pruebas) lee el archivo y lo manda. En el celu los archivos ya están en el paquete
 * (www/comun, www/m/<modulo>): se manda vacío con el encabezado `X-SEK-Archivo` y la página madre lo abre.
 */
const CELU = typeof SEK_CELU !== 'undefined' && SEK_CELU

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
}
const TEXTO = /^(text\/|application\/json|image\/svg)/

/** Camino relativo seguro (nada de ../ ni de raros). null si no sirve. */
function limpio(relativa) {
  const partes = String(relativa || '').split('/').filter((p) => p && p !== '.')
  if (!partes.length || partes.some((p) => p === '..' || !/^[\w.\-]+$/.test(p))) return null
  return partes.join('/')
}

function extension(nombre) { const i = nombre.lastIndexOf('.'); return i < 0 ? '' : nombre.slice(i).toLowerCase() }

/** Manda `carpeta/archivo` (carpeta: 'comun' o 'm/<modulo>'). */
function enviar(respuesta, carpeta, relativa) {
  const archivo = limpio(relativa)
  if (!archivo) return respuesta.code(404).send({ error: 'No existe.' })
  const tipo = TIPOS[extension(archivo)] || 'application/octet-stream'
  if (CELU) return respuesta.header('Content-Type', tipo).header('X-SEK-Archivo', `${carpeta}/${archivo}`).send('')
  const fs = require('node:fs')
  const path = require('node:path')
  const raiz = path.join(__dirname, '..', '..')
  const disco = carpeta === 'comun'
    ? path.join(raiz, 'comun', 'pantalla', archivo)
    : path.join(raiz, 'modulos', carpeta.slice(2), 'pantallas', archivo)
  if (!fs.existsSync(disco) || !fs.statSync(disco).isFile()) return respuesta.code(404).send({ error: 'No existe.' })
  respuesta.header('Content-Type', tipo)
  respuesta.header('Cache-Control', 'no-cache')
  return respuesta.send(TEXTO.test(tipo) ? fs.readFileSync(disco, 'utf8') : fs.readFileSync(disco))
}

async function rutas(app) {
  app.get('/comun/*', async (pedido, respuesta) => enviar(respuesta, 'comun', pedido.params['*']))
  app.get('/m/:modulo/*', async (pedido, respuesta) => {
    const { modulo } = pedido.params
    if (!/^[a-z0-9-]+$/.test(modulo)) return respuesta.code(404).send({ error: 'No existe.' })
    return enviar(respuesta, `m/${modulo}`, pedido.params['*'])
  })
}

/** Manda la página HTML de un módulo. Uso en rutas.js: `respuesta => pagina(respuesta, 'juego', 'juego.html')`. */
function pagina(respuesta, modulo, archivo) { return enviar(respuesta, `m/${modulo}`, archivo) }

/** Manda una página de comun/pantalla (entrar, inicio). */
function paginaComun(respuesta, archivo) { return enviar(respuesta, 'comun', archivo) }

module.exports = { rutas, pagina, paginaComun, limpio }
