'use strict'
/**
 * Arma lo que va adentro del APK en celu/www/ (no se sube al repo: se arma cada vez).
 *   node herramientas/armar-celu.js      (o npm run celu)
 *
 * - www/index.html: la página madre (celu/index.html).
 * - www/sek.js: toda la app junta (esbuild), con las migraciones y los temas adentro.
 * - www/comun/ y www/m/<modulo>/: las pantallas, cada una con /comun/celu-pagina.js arriba.
 * - www/pglite/: el wasm y los datos de PostgreSQL.
 */
const fs = require('node:fs')
const path = require('node:path')
const esbuild = require('esbuild')
const { leerMigraciones } = require('../comun/migrar')
const { leerCarpetas } = require('../modulos/temas/catalogo')

const RAIZ = path.join(__dirname, '..')
const WWW = path.join(RAIZ, 'celu', 'www')
const PAGINA = '<script src="/comun/celu-pagina.js"></script>'

function copiar(desde, hasta) {
  fs.mkdirSync(hasta, { recursive: true })
  for (const e of fs.readdirSync(desde, { withFileTypes: true })) {
    const a = path.join(desde, e.name)
    const b = path.join(hasta, e.name)
    if (e.isDirectory()) copiar(a, b)
    else if (e.name.endsWith('.html')) fs.writeFileSync(b, conPagina(fs.readFileSync(a, 'utf8'), a))
    else fs.copyFileSync(a, b)
  }
}

/** Pone celu-pagina.js primero en <head>, antes que cualquier otro script. */
function conPagina(html, archivo) {
  const m = /<head[^>]*>/i.exec(html)
  if (!m) throw new Error(`${archivo}: no tiene <head>`)
  const i = m.index + m[0].length
  return html.slice(0, i) + '\n' + PAGINA + html.slice(i)
}

async function armar() {
  fs.rmSync(WWW, { recursive: true, force: true })
  fs.mkdirSync(WWW, { recursive: true })

  // Pantallas
  copiar(path.join(RAIZ, 'comun', 'pantalla'), path.join(WWW, 'comun'))
  fs.copyFileSync(path.join(RAIZ, 'celu', 'pagina.js'), path.join(WWW, 'comun', 'celu-pagina.js'))
  for (const modulo of fs.readdirSync(path.join(RAIZ, 'modulos'))) {
    const p = path.join(RAIZ, 'modulos', modulo, 'pantallas')
    if (fs.existsSync(p)) copiar(p, path.join(WWW, 'm', modulo))
  }
  fs.copyFileSync(path.join(RAIZ, 'modulos', 'organizacion', 'modelo.js'), path.join(WWW, 'm', 'organizacion', 'modelo.js'))
  fs.copyFileSync(path.join(RAIZ, 'celu', 'index.html'), path.join(WWW, 'index.html'))

  // PostgreSQL (PGlite)
  const pgl = path.join(RAIZ, 'node_modules', '@electric-sql', 'pglite')
  fs.mkdirSync(path.join(WWW, 'pglite'))
  for (const f of ['postgres.wasm', 'postgres.data']) fs.copyFileSync(path.join(pgl, 'dist', f), path.join(WWW, 'pglite', f))

  // La app junta
  const vacio = path.join(RAIZ, 'celu', 'vacio.js')
  await esbuild.build({
    entryPoints: [path.join(RAIZ, 'celu', 'arranque.js')],
    outfile: path.join(WWW, 'sek.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome100'],
    minify: true,
    sourcemap: false,
    logLevel: 'warning',
    alias: { 'node:fs': vacio, 'node:path': vacio },
    external: ['fs', 'path', 'fs/promises', 'node:fs/promises', 'url', 'module', 'zlib', 'stream', 'crypto', 'child_process', 'os'],
    define: {
      SEK_CELU: 'true',
      SEK_LUGAR_BASE: JSON.stringify('idb://sek'),
      SEK_MIGRACIONES: JSON.stringify(leerMigraciones()),
      SEK_TEMAS: JSON.stringify(leerCarpetas()),
    },
  })

  const peso = (f) => (fs.statSync(path.join(WWW, f)).size / 1048576).toFixed(1) + ' MB'
  console.log(`Listo: ${path.relative(RAIZ, WWW)}  (sek.js ${peso('sek.js')}, postgres.wasm ${peso('pglite/postgres.wasm')}, postgres.data ${peso('pglite/postgres.data')})`)
}

armar().catch((e) => { console.error(e); process.exit(1) })
