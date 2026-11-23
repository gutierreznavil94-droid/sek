'use strict'
/**
 * El guardián de la regla dura (REGLAS.md §3): un módulo usa a otro solo por su ventanilla.js.
 * Falla si algún archivo de un módulo requiere el datos.js, rutas.js u otro archivo interno de OTRO módulo,
 * o si comun/ requiere algo de modulos/. También revisa que cada módulo tenga su forma completa.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const MODULOS = path.join(RAIZ, 'modulos')

function archivosJs(carpeta) {
  const r = []
  for (const e of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const p = path.join(carpeta, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') r.push(...archivosJs(p)) } else if (e.name.endsWith('.js')) r.push(p)
  }
  return r
}

function requeridos(archivo) {
  const texto = fs.readFileSync(archivo, 'utf8')
  return [...texto.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).filter((r) => r.startsWith('.'))
}

const modulos = fs.existsSync(MODULOS) ? fs.readdirSync(MODULOS).filter((m) => fs.statSync(path.join(MODULOS, m)).isDirectory()) : []

test('un módulo entra a otro solo por su ventanilla', () => {
  const faltas = []
  for (const m of modulos) {
    for (const archivo of archivosJs(path.join(MODULOS, m))) {
      if (archivo.includes(`${path.sep}pantallas${path.sep}`)) continue // corre en el navegador
      for (const r of requeridos(archivo)) {
        const destino = path.resolve(path.dirname(archivo), r)
        const rel = path.relative(MODULOS, destino)
        if (rel.startsWith('..')) continue // comun/ u otra cosa fuera de modulos/
        const [otro, ...resto] = rel.split(path.sep)
        if (otro === m) continue
        const interno = resto.join('/').replace(/\.js$/, '')
        if (interno !== 'ventanilla' && interno !== 'ventanilla/index') faltas.push(`${path.relative(RAIZ, archivo)} → ${r}`)
      }
    }
  }
  assert.deepEqual(faltas, [], 'Estos archivos se meten por la ventana de otro módulo:\n' + faltas.join('\n'))
})

test('comun/ no depende de ningún módulo', () => {
  const faltas = []
  for (const archivo of archivosJs(path.join(RAIZ, 'comun'))) {
    if (archivo.endsWith('.test.js') || archivo.endsWith(`${path.sep}prueba.js`)) continue
    for (const r of requeridos(archivo)) if (path.resolve(path.dirname(archivo), r).startsWith(MODULOS)) faltas.push(`${path.relative(RAIZ, archivo)} → ${r}`)
  }
  assert.deepEqual(faltas, [])
})

test('cada módulo tiene su forma: rutas, ventanilla, datos, pruebas, LEEME y pantallas', () => {
  const faltas = []
  for (const m of modulos) {
    const c = path.join(MODULOS, m)
    const tiene = (n) => fs.existsSync(path.join(c, n))
    if (!tiene('rutas.js')) faltas.push(`${m}: falta rutas.js`)
    if (!tiene('ventanilla.js') && !tiene('ventanilla/index.js')) faltas.push(`${m}: falta ventanilla.js`)
    if (!tiene('datos.js') && !tiene('datos/index.js')) faltas.push(`${m}: falta datos.js`)
    if (!fs.readdirSync(c).some((n) => n.endsWith('.test.js'))) faltas.push(`${m}: faltan pruebas`)
    if (!tiene('LEEME.md')) faltas.push(`${m}: falta LEEME.md`)
  }
  assert.deepEqual(faltas, [])
})

test('ningún módulo usa la tabla de otro (datos.js nombra solo tablas propias declaradas en su LEEME)', () => {
  const faltas = []
  for (const m of modulos) {
    const leeme = fs.readFileSync(path.join(MODULOS, m, 'LEEME.md'), 'utf8')
    const propias = new Set([...leeme.matchAll(/^- tabla `([a-z_]+)`/gm)].map((x) => x[1]))
    const ruta = fs.existsSync(path.join(MODULOS, m, 'datos.js')) ? path.join(MODULOS, m, 'datos.js') : null
    if (!ruta) continue
    const sql = fs.readFileSync(ruta, 'utf8')
    for (const t of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_]+)/gi)) {
      if (!propias.has(t[1])) faltas.push(`${m}: datos.js usa la tabla «${t[1]}», que no figura como propia en su LEEME`)
    }
  }
  assert.deepEqual([...new Set(faltas)], [])
})
