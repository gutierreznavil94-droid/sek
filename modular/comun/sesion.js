'use strict'
/**
 * Personas y sesiones. De acá sale siempre quién está usando la app (`pedido.usuario`).
 * Contraseñas con hash (PBKDF2 de WebCrypto: anda igual en el celu y en la compu, sin librerías). La sesión es una cookie con un token al azar
 * que se guarda en la base; salir la borra.
 */
const crypto = globalThis.crypto
const { una, consulta } = require('./base')
const { ahora } = require('./reloj')
const config = require('./config')
const { ErrorSek, sinSesion, datoInvalido } = require('./errores')

const COOKIE = 'sek_sesion'

const VUELTAS = 100000
const aHex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('')
const deHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)))
const azar = (n) => crypto.getRandomValues(new Uint8Array(n))

async function derivar(clave, sal, vueltas) {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: vueltas }, llave, 256)
}

/** 'pbkdf2:<vueltas>:<sal>:<hash>'. Nunca guarda la contraseña. */
async function hashear(clave) {
  const sal = azar(16)
  return `pbkdf2:${VUELTAS}:${aHex(sal)}:${aHex(await derivar(clave, sal, VUELTAS))}`
}

async function claveCorrecta(clave, guardado) {
  const [tipo, vueltas, sal, hash] = String(guardado).split(':')
  if (tipo !== 'pbkdf2' || !sal || !hash || !(Number(vueltas) > 0)) return false
  const calc = aHex(await derivar(clave, deHex(sal), Number(vueltas)))
  // Comparación sin cortar antes (mismo tiempo siempre).
  let dif = calc.length ^ hash.length
  for (let i = 0; i < Math.max(calc.length, hash.length); i++) dif |= (calc.charCodeAt(i) || 0) ^ (hash.charCodeAt(i) || 0)
  return dif === 0
}

function normalizarEmail(email) { return String(email || '').trim().toLowerCase() }

async function crearUsuario({ nombre, email, clave }, tx = null) {
  const e = normalizarEmail(email)
  if (!String(nombre || '').trim()) throw datoInvalido('Falta el nombre.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw datoInvalido('El email no parece válido.')
  if (String(clave || '').length < 8) throw datoInvalido('La contraseña necesita al menos 8 caracteres.')
  const ya = await una('SELECT id FROM usuarios WHERE email = $1', [e], tx)
  if (ya) throw new ErrorSek('Ya hay una cuenta con ese email.', 409)
  return una('INSERT INTO usuarios (nombre, email, clave_hash, creado) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email',
    [String(nombre).trim(), e, await hashear(clave), ahora()], tx)
}

async function crearSesion(usuarioId, tx = null) {
  const token = aHex(azar(32))
  const vence = ahora() + config.diasSesion * 86400000
  await consulta('INSERT INTO sesiones (token, usuario_id, vence) VALUES ($1, $2, $3)', [token, usuarioId, vence], tx)
  return { token, vence }
}

/** Devuelve { usuario, token } o tira 401. */
async function entrar(email, clave) {
  const u = await una('SELECT id, nombre, email, clave_hash FROM usuarios WHERE email = $1', [normalizarEmail(email)])
  if (!u || !(await claveCorrecta(String(clave || ''), u.clave_hash))) throw new ErrorSek('Email o contraseña incorrectos.', 401)
  const s = await crearSesion(u.id)
  return { usuario: { id: u.id, nombre: u.nombre, email: u.email }, ...s }
}

/**
 * Cambia la contraseña. Pide la actual. Cierra las demás sesiones abiertas (otros teléfonos o compus)
 * y deja viva solo la de `tokenQueQueda`.
 */
async function cambiarClave(usuarioId, actual, nueva, tokenQueQueda = null, tx = null) {
  const u = await una('SELECT clave_hash FROM usuarios WHERE id = $1', [usuarioId], tx)
  if (!u || !(await claveCorrecta(String(actual || ''), u.clave_hash))) throw new ErrorSek('La contraseña actual no es esa.', 400)
  if (String(nueva || '').length < 8) throw datoInvalido('La contraseña nueva necesita al menos 8 caracteres.')
  await consulta('UPDATE usuarios SET clave_hash = $2 WHERE id = $1', [usuarioId, await hashear(nueva)], tx)
  await consulta('DELETE FROM sesiones WHERE usuario_id = $1 AND token IS DISTINCT FROM $2', [usuarioId, tokenQueQueda], tx)
}

async function salir(token) {
  if (token) await consulta('DELETE FROM sesiones WHERE token = $1', [token])
}

async function usuarioDeToken(token) {
  if (!token) return null
  return una(`SELECT u.id, u.nombre, u.email FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
              WHERE s.token = $1 AND s.vence > $2`, [token, ahora()])
}

function leerCookie(pedido, nombre = COOKIE) {
  const cab = pedido.headers.cookie || ''
  for (const parte of cab.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim())
  }
  return null
}

function ponerCookie(respuesta, token, vence) {
  const partes = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Expires=${new Date(vence).toUTCString()}`]
  if (config.produccion) partes.push('Secure')
  respuesta.header('Set-Cookie', partes.join('; '))
}

function borrarCookie(respuesta) {
  respuesta.header('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
}

/** preHandler de Fastify: deja la persona en `pedido.usuario` o corta con 401 (API) / manda a /entrar (páginas). */
async function requiereUsuario(pedido, respuesta) {
  const u = await usuarioDeToken(leerCookie(pedido))
  if (u) { pedido.usuario = u; return }
  if (pedido.method === 'GET' && !pedido.url.startsWith('/api/')) return respuesta.redirect('/entrar')
  throw sinSesion()
}

/** Rutas de entrar, crear cuenta y salir. Las registra app.js. */
async function rutas(app) {
  app.post('/api/sesion/crear-cuenta', async (pedido, respuesta) => {
    const { nombre, email, clave } = pedido.body || {}
    const u = await crearUsuario({ nombre, email, clave })
    for (const fn of alCrearCuenta) await fn(u.id)
    const s = await crearSesion(u.id)
    ponerCookie(respuesta, s.token, s.vence)
    return { usuario: u }
  })
  app.post('/api/sesion/entrar', async (pedido, respuesta) => {
    const { email, clave } = pedido.body || {}
    const r = await entrar(email, clave)
    ponerCookie(respuesta, r.token, r.vence)
    return { usuario: r.usuario }
  })
  app.post('/api/sesion/salir', async (pedido, respuesta) => {
    await salir(leerCookie(pedido))
    borrarCookie(respuesta)
    return { ok: true }
  })
  app.get('/api/sesion/yo', { preHandler: requiereUsuario }, async (pedido) => ({ usuario: pedido.usuario }))
}

/**
 * Lo que corre al crear una cuenta (cada módulo que necesite datos iniciales se anota desde app.js).
 * Ej.: `sesion.alCrearCuenta.push((id) => dia.sembrar(id))`.
 */
const alCrearCuenta = []

module.exports = { COOKIE, crearUsuario, entrar, salir, cambiarClave, crearSesion, usuarioDeToken, leerCookie, requiereUsuario, rutas, alCrearCuenta, hashear, claveCorrecta }
