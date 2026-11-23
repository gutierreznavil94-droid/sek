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

async function prepararPglite() {
  const [wasm, datos] = await Promise.all([
    fetch('/pglite/postgres.wasm').then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)),
    fetch('/pglite/postgres.data').then((r) => r.blob()),
  ])
  // relaxedDurability: guarda en la memoria del teléfono sin esperar a cada consulta (si no, cada pantalla tarda segundos).
  globalThis.SEK_PGLITE_OPCIONES = { wasmModule: wasm, fsBundle: datos, relaxedDurability: true }
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
  await base.abrir()
  await migrar({ silencio: true })
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
