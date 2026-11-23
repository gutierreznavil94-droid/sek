#!/usr/bin/env node
/*
 * Arma la SEK nueva para VERLA EN UN LINK (sin APK): copia celu/www a celu/web y cambia las direcciones
 * que empiezan con «/» (/comun/, /m/, /pglite/) para que anden aunque la app viva en una subcarpeta.
 * Primero hay que correr herramientas/armar-celu.js.   Uso: node herramientas/armar-web.js
 *
 * - Páginas (.html) y scripts de pantalla (.js): «/comun/x» pasa a «comun/x»; cada página lleva un <base>
 *   que apunta a la raíz (lo pone celu-pagina.js), así se resuelven desde ahí.
 * - Estilos (.css): url(/m/x) pasa a url(../../m/x) según dónde esté el archivo.
 * - location.href = '/hoy' pasa a SEK_IR_WEB = '/hoy' y location.reload() reabre la misma (lo abre la página madre).
 * - La página madre queda en celu/web/index.html, sin <html>/<head> propios (la pone el que publica).
 * La base queda en el navegador de quien mira (IndexedDB); los datos son de prueba.
 */
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const WWW = path.join(RAIZ, 'celu', 'www')
const WEB = path.join(RAIZ, 'celu', 'web')
if (!fs.existsSync(WWW)) { console.error('Falta celu/www: corré antes node herramientas/armar-celu.js'); process.exit(1) }
fs.rmSync(WEB, { recursive: true, force: true })
fs.cpSync(WWW, WEB, { recursive: true })
fs.renameSync(path.join(WEB, 'pglite', 'postgres.data'), path.join(WEB, 'pglite', 'postgres-data.wasm'))

const PREFIJOS = /(["'`(=\s])\/(comun|m|pglite)\//g
function recorrer(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p, fn); else fn(p)
  }
}
let cambiados = 0
recorrer(WEB, (archivo) => {
  const rel = path.relative(WEB, archivo).split(path.sep).join('/')
  const ext = path.extname(archivo)
  if (!['.html', '.css', '.js'].includes(ext) || rel.startsWith('pglite/')) return
  let t = fs.readFileSync(archivo, 'utf8')
  const antes = t
  if (rel === 'sek.js') {
    // El paquete del celu: solo cambian los archivos de PGlite (las rutas /comun/* del enrutador quedan igual).
    // postgres.data va como postgres-data.wasm: el link solo sirve tipos conocidos (se lee igual, como bytes)
    t = t.replace(/(['"])\/pglite\/postgres\.wasm/g, '$1pglite/postgres.wasm').replace(/(['"])\/pglite\/postgres\.data/g, '$1pglite/postgres-data.wasm')
  } else if (ext === '.css') {
    const arriba = '../'.repeat(rel.split('/').length - 1)
    t = t.replace(/url\((["']?)\/(comun|m|pglite)\//g, `url($1${arriba}$2/`)
  } else {
    t = t.replace(PREFIJOS, '$1$2/')
    // Cada página lleva su <base> a la raíz, relativo a dónde está (m/dia/hoy.html → ../../)
    if (ext === '.html' && rel !== 'index.html') t = t.replace(/<head>/i, `<head><base href="${'../'.repeat(rel.split('/').length - 1) || './'}">`)
    t = t.replace(/\blocation\.href\s*=(?!=)/g, 'SEK_IR_WEB =')
    // recargar: la dirección linda (/hoy) no existe como archivo en el link, así que la abre la madre
    t = t.replace(/\blocation\.reload\(\)/g, '(SEK_IR_WEB = location.pathname + location.search)')
  }
  if (t !== antes) { fs.writeFileSync(archivo, t); cambiados++ }
})

// La página madre para el link: igual a la del celu, pero las direcciones son relativas a donde vive.
const madre = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8')
let cuerpo = madre
  .replace(/<!doctype html>/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '')
  .replace(/<head>|<\/head>/gi, '').replace(/<meta charset[^>]*>/i, '').replace(/<meta name="viewport"[^>]*>/i, '')
  .replace("var destino = '/' + archivo", "var destino = archivo")
  .replace("s.src = 'sek.js'", "s.src = 'sek.js'")
  .replace("s.src = '/sek.js'", "s.src = 'sek.js'")
  .replace(/var inicio = [^\n]+/, "var inicio = '/hoy'")
  .replace('<title>SEK</title>', '<title>SEK nueva</title>')
  .replace('(function () {', "window.SEK_RAIZ = new URL('.', location.href).href;\n(function () {")
fs.writeFileSync(path.join(WEB, 'index.html'), cuerpo.trim() + '\n')
console.log(`Listo: celu/web (${cambiados} archivos con direcciones cambiadas)`)
