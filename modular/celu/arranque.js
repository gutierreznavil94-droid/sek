'use strict'
/**
 * El arranque en el celu (lo junta esbuild en www/sek.js). Corre UNA vez, en la página madre:
 * 1. Prepara PGlite (wasm y datos del paquete) y abre la base del teléfono.
 * 2. Aplica las migraciones que vienen adentro.
 * 3. Sin cuentas: si no hay nadie crea a la persona del celu (id 1) y una sesión que dura años.
 * 4. Deja `SEK_LOCAL(pedido)` para que cada pantalla le pida datos a su módulo, sin internet.
 */
const base = require('../comun/base')
const { migrar } = require('../comun/migrar')
const sesion = require('../comun/sesion')
const { crearApp } = require('../app')

const TOKEN = 'sek_token'

/** Muestra en la pantalla de carga en qué paso va (si algo se traba, se ve dónde). */
function paso(texto) { try { if (globalThis.SEK_PASO) globalThis.SEK_PASO(texto) } catch { /* sin pantalla */ } }

/** Baja un archivo del paquete contando los MB, para que se vea que avanza. */
async function bajar(url, nombre, cuenta) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`no se pudo bajar ${nombre} (${r.status})`)
  if (!r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer())
  const lector = r.body.getReader()
  const partes = []
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    partes.push(value)
    cuenta(value.length)
  }
  const total = partes.reduce((s, p) => s + p.length, 0)
  const todo = new Uint8Array(total)
  let i = 0
  for (const p of partes) { todo.set(p, i); i += p.length }
  return todo
}

async function prepararPglite() {
  let bajado = 0
  const cuenta = (n) => { bajado += n; paso(`Bajando la base… ${(bajado / 1048576).toFixed(1)} de 13 MB`) }
  paso('Bajando la base…')
  const [bytesWasm, bytesDatos] = await Promise.all([
    bajar('/pglite/postgres.wasm', 'postgres.wasm', cuenta),
    bajar('/pglite/postgres.data', 'postgres.data', cuenta),
  ])
  paso('Preparando la base…')
  let wasm
  try { wasm = await WebAssembly.compile(bytesWasm) } catch (e) { throw new Error(`este navegador no deja correr la base (WebAssembly): ${e.message}`) }
  // relaxedDurability: guarda en la memoria del teléfono sin esperar a cada consulta (si no, cada pantalla tarda segundos).
  globalThis.SEK_PGLITE_OPCIONES = { wasmModule: wasm, fsBundle: new Blob([bytesDatos]), relaxedDurability: true }
}

/** Abre la base guardada; si el navegador no deja guardar (o se traba), sigue en memoria. */
async function abrirBase() {
  paso('Abriendo la base…')
  const espera = new Promise((_, no) => setTimeout(() => no(new Error('tardó demasiado')), 20000))
  try {
    await Promise.race([base.abrir(), espera])
  } catch (e) {
    paso('Sin memoria del navegador: los datos duran mientras esté abierta…')
    base.usarBase()
    await base.abrir()
    globalThis.SEK_SIN_GUARDAR = e.message
  }
}

function guardado() { try { return localStorage.getItem(TOKEN) } catch { return null } }
function guardar(t) { try { localStorage.setItem(TOKEN, t) } catch { /* sin memoria del navegador: se crea otra al abrir */ } }

/** La persona del celu. No hay cuentas: el celu es suyo. La clave es al azar y no se usa. */
async function personaDelCelu() {
  const ya = await base.una('SELECT id FROM usuarios ORDER BY id LIMIT 1')
  if (ya) return ya.id
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
  const u = await sesion.crearUsuario({ nombre: 'Shinobi', email: 'yo@sek.celu', clave: azar })
  for (const fn of sesion.alCrearCuenta) await fn(u.id)
  return u.id
}

async function sesionDelCelu() {
  const t = guardado()
  if (t && await sesion.usuarioDeToken(t)) return t
  const { token } = await sesion.crearSesion(await personaDelCelu())
  guardar(token)
  return token
}

async function arrancar() {
  const t0 = performance.now()
  await prepararPglite()
  await abrirBase()
  paso('Poniendo todo en orden…')
  await migrar({ silencio: true })
  paso('Casi…')
  const token = await sesionDelCelu()
  const app = crearApp({ logger: false })
  await app.ready()
  const cookie = `${sesion.COOKIE}=${token}`

  /** Un pedido local: { method, url, headers, payload }. Devuelve lo mismo que inject. */
  globalThis.SEK_LOCAL = (pedido) => app.inject({ ...pedido, headers: { ...(pedido.headers || {}), cookie } })
  // Al salir de la app (o pasar a otra), guardar ya lo que falte.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') base.guardarYa().catch(() => {}) })
  window.addEventListener('pagehide', () => { base.guardarYa().catch(() => {}) })
  globalThis.SEK_ARRANQUE_MS = Math.round(performance.now() - t0)
}

globalThis.SEK_ARRANCAR = arrancar
