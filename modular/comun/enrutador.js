'use strict'
/**
 * El enrutador de SEK: la misma forma que Fastify (app.get, app.post, app.register, preHandler, schema),
 * pero sin servidor. Corre igual en el celu y en las pruebas: un pedido entra por `app.inject(...)`
 * (las pantallas lo hacen con `SEK.api`) y sale una respuesta, sin internet.
 *
 * Lo que entiende de los schema (JSON Schema): type (también lista de tipos), properties, required, enum,
 * minimum, maximum, minLength, maxLength, pattern, items, minItems, maxItems, anyOf, default.
 * Como Fastify, convierte texto a número o booleano cuando el schema lo pide (sobre todo en querystring).
 */

class ErrorValidacion extends Error {
  constructor(mensaje) { super(mensaje); this.validation = true; this.statusCode = 400 }
}

// ---------- Validación ----------

function tipoDe(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (Number.isInteger(v)) return 'integer'
  return typeof v
}

function encaja(v, t) {
  const real = tipoDe(v)
  if (t === 'number') return real === 'number' || real === 'integer'
  return real === t
}

/** Intenta convertir texto (o lo que venga) al tipo pedido. Devuelve { ok, valor }. */
function convertir(v, t) {
  if (encaja(v, t)) return { ok: true, valor: v }
  if (t === 'number' || t === 'integer') {
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      const n = Number(v)
      if (t === 'integer' && !Number.isInteger(n)) return { ok: false }
      return { ok: true, valor: n }
    }
    if (typeof v === 'boolean') return { ok: true, valor: v ? 1 : 0 }
    return { ok: false }
  }
  if (t === 'boolean') {
    if (v === 'true' || v === '1' || v === 1) return { ok: true, valor: true }
    if (v === 'false' || v === '0' || v === 0) return { ok: true, valor: false }
    return { ok: false }
  }
  if (t === 'string' && (typeof v === 'number' || typeof v === 'boolean')) return { ok: true, valor: String(v) }
  if (t === 'null' && v === '') return { ok: true, valor: null }
  if (t === 'array' && v !== undefined && v !== null && !Array.isArray(v)) return { ok: true, valor: [v] }
  return { ok: false }
}

/** Valida (y convierte) `valor` contra `schema`. Devuelve el valor final o tira ErrorValidacion. */
function validar(valor, schema, donde) {
  if (!schema || typeof schema !== 'object') return valor
  let v = valor
  if (schema.anyOf) {
    for (const opcion of schema.anyOf) {
      try { return validar(v, opcion, donde) } catch (e) { if (!e.validation) throw e }
    }
    throw new ErrorValidacion(`${donde} must match a schema in anyOf`)
  }
  if (schema.type) {
    const tipos = Array.isArray(schema.type) ? schema.type : [schema.type]
    let ok = false
    for (const t of tipos) if (encaja(v, t)) { ok = true; break }
    if (!ok) {
      for (const t of tipos) { const c = convertir(v, t); if (c.ok) { v = c.valor; ok = true; break } }
    }
    if (!ok) throw new ErrorValidacion(`${donde} must be ${tipos.join(',')}`)
  }
  if (schema.enum && !schema.enum.some((e) => e === v)) throw new ErrorValidacion(`${donde} must be equal to one of the allowed values`)
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) throw new ErrorValidacion(`${donde} must be >= ${schema.minimum}`)
    if (schema.maximum !== undefined && v > schema.maximum) throw new ErrorValidacion(`${donde} must be <= ${schema.maximum}`)
  }
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) throw new ErrorValidacion(`${donde} must NOT have fewer than ${schema.minLength} characters`)
    if (schema.maxLength !== undefined && v.length > schema.maxLength) throw new ErrorValidacion(`${donde} must NOT have more than ${schema.maxLength} characters`)
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(v)) throw new ErrorValidacion(`${donde} must match pattern "${schema.pattern}"`)
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) throw new ErrorValidacion(`${donde} must NOT have fewer than ${schema.minItems} items`)
    if (schema.maxItems !== undefined && v.length > schema.maxItems) throw new ErrorValidacion(`${donde} must NOT have more than ${schema.maxItems} items`)
    if (schema.items) v = v.map((x, i) => validar(x, schema.items, `${donde}/${i}`))
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const props = schema.properties || {}
    const salida = { ...v }
    for (const [k, sub] of Object.entries(props)) {
      if (salida[k] === undefined && sub && sub.default !== undefined) salida[k] = JSON.parse(JSON.stringify(sub.default))
      if (salida[k] !== undefined) salida[k] = validar(salida[k], sub, `${donde}/${k}`)
    }
    for (const r of schema.required || []) if (salida[r] === undefined) throw new ErrorValidacion(`${donde} must have required property '${r}'`)
    v = salida
  }
  return v
}

// ---------- Rutas ----------

function compilar(ruta) {
  const nombres = []
  const partes = ruta.split('/').map((p) => {
    if (p.startsWith(':')) { nombres.push(p.slice(1)); return '([^/]+)' }
    if (p === '*') { nombres.push('*'); return '(.*)' }
    return p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  })
  return { re: new RegExp('^' + partes.join('/') + '$'), nombres }
}

function separarUrl(url) {
  const i = url.indexOf('?')
  const camino = i < 0 ? url : url.slice(0, i)
  const query = {}
  if (i >= 0) {
    for (const par of url.slice(i + 1).split('&')) {
      if (!par) continue
      const j = par.indexOf('=')
      const k = decodeURIComponent((j < 0 ? par : par.slice(0, j)).replace(/\+/g, ' '))
      const val = j < 0 ? '' : decodeURIComponent(par.slice(j + 1).replace(/\+/g, ' '))
      if (query[k] === undefined) query[k] = val
      else query[k] = [].concat(query[k], val)
    }
  }
  return { camino, query }
}

/** La respuesta que recibe cada ruta (misma forma que la de Fastify en lo que usa SEK). */
function nuevaRespuesta() {
  const r = {
    statusCode: 200,
    headers: {},
    cuerpo: undefined,
    enviado: false,
    code(n) { r.statusCode = n; return r },
    status(n) { r.statusCode = n; return r },
    header(k, v) {
      const clave = k.toLowerCase()
      if (clave === 'set-cookie' && r.headers[clave]) r.headers[clave] = [].concat(r.headers[clave], v)
      else r.headers[clave] = v
      return r
    },
    type(t) { r.headers['content-type'] = t; return r },
    redirect(a, b) {
      const [estado, destino] = typeof a === 'number' ? [a, b] : [typeof b === 'number' ? b : 302, a]
      r.statusCode = estado; r.headers.location = destino; r.enviado = true; r.cuerpo = ''
      return r
    },
    send(c) { r.cuerpo = c; r.enviado = true; return r },
  }
  return r
}

function crearEnrutador(opciones = {}) {
  const rutas = []
  const ganchos = []
  let manejadorError = null

  function agregar(metodo, ruta, a, b) {
    const opts = typeof a === 'function' ? {} : (a || {})
    const fn = typeof a === 'function' ? a : b
    const metodos = Array.isArray(metodo) ? metodo : [metodo]
    for (const m of metodos) {
      const c = compilar(ruta)
      // Como Fastify: lo fijo gana a :param, y :param gana a *.
      const peso = c.nombres.filter((n) => n !== '*').length + (c.nombres.includes('*') ? 100 : 0)
      let i = rutas.length
      while (i > 0 && rutas[i - 1].peso > peso) i--
      rutas.splice(i, 0, { metodo: m, ruta, ...c, peso, opts, fn })
    }
  }

  const app = {
    log: opciones.logger === false ? { error() {}, info() {}, warn() {} } : { error: (...x) => console.error(...x), info() {}, warn: (...x) => console.warn(...x) },
    get: (r, a, b) => agregar('GET', r, a, b),
    post: (r, a, b) => agregar('POST', r, a, b),
    put: (r, a, b) => agregar('PUT', r, a, b),
    patch: (r, a, b) => agregar('PATCH', r, a, b),
    delete: (r, a, b) => agregar('DELETE', r, a, b),
    route: ({ method, url, handler, ...resto }) => agregar(method, url, resto, handler),
    setErrorHandler(fn) { manejadorError = fn },
    addHook(nombre, fn) { if (nombre === 'onRequest' || nombre === 'preHandler') ganchos.push(fn) },
    /** Como Fastify: el plugin recibe (app, opciones). Se corre enseguida (las rutas quedan listas al terminar). */
    register(plugin, opts) { pendientes.push(Promise.resolve().then(() => plugin(app, opts || {}))); return app },
    ready: () => listo(),
    close: async () => {},
    /** Las rutas registradas (para listar pantallas, por ejemplo). */
    rutas: () => rutas.map((r) => ({ metodo: r.metodo, ruta: r.ruta })),
    inject,
  }
  const pendientes = []
  async function listo() { while (pendientes.length) await pendientes.shift() }

  function buscar(metodo, camino) {
    let mismoCamino = false
    for (const r of rutas) {
      const m = r.re.exec(camino)
      if (!m) continue
      mismoCamino = true
      if (r.metodo !== metodo && !(metodo === 'HEAD' && r.metodo === 'GET')) continue
      const params = {}
      r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]) })
      return { r, params }
    }
    return { r: null, mismoCamino }
  }

  /**
   * Un pedido. `opciones`: { method, url, payload, headers, query }.
   * Devuelve { statusCode, headers, body (texto), cuerpo (lo que mandó la ruta), json() }.
   */
  async function inject(opcionesPedido) {
    await listo()
    const o = typeof opcionesPedido === 'string' ? { url: opcionesPedido } : opcionesPedido
    const metodo = String(o.method || 'GET').toUpperCase()
    const { camino, query } = separarUrl(o.url || '/')
    const headers = {}
    for (const [k, v] of Object.entries(o.headers || {})) headers[k.toLowerCase()] = v
    let body = o.payload !== undefined ? o.payload : o.body
    if (typeof body === 'string' && body && /json/.test(headers['content-type'] || 'application/json')) {
      try { body = JSON.parse(body) } catch { /* queda como texto */ }
    }
    const pedido = { method: metodo, url: o.url || '/', headers, query: { ...query, ...(o.query || {}) }, params: {}, body, log: app.log, routeOptions: {} }
    const respuesta = nuevaRespuesta()
    try {
      const { r, params, mismoCamino } = buscar(metodo, camino)
      if (!r) {
        respuesta.code(mismoCamino ? 405 : 404).send({ error: mismoCamino ? 'Ese método no está.' : 'No existe.' })
      } else {
        pedido.params = params
        pedido.routeOptions = { url: r.ruta, config: r.opts.config || {} }
        const s = r.opts.schema || {}
        if (s.params) pedido.params = validar(pedido.params, s.params, 'params')
        if (s.querystring) pedido.query = validar(pedido.query, s.querystring, 'querystring')
        if (s.body) pedido.body = validar(pedido.body, s.body, 'body')
        for (const g of ganchos) { await g(pedido, respuesta); if (respuesta.enviado) break }
        if (!respuesta.enviado) {
          const pre = [].concat(r.opts.onRequest || [], r.opts.preHandler || [])
          for (const p of pre) { await p(pedido, respuesta); if (respuesta.enviado) break }
        }
        if (!respuesta.enviado) {
          const salida = await r.fn(pedido, respuesta)
          if (!respuesta.enviado && salida !== undefined && salida !== respuesta) respuesta.send(salida)
        }
      }
    } catch (error) {
      const r2 = nuevaRespuesta()
      Object.assign(respuesta, { statusCode: 500, headers: r2.headers, cuerpo: undefined, enviado: false })
      if (manejadorError) await manejadorError(error, pedido, respuesta)
      else respuesta.code(error.statusCode || 500).send({ error: error.message })
    }
    return armarSalida(respuesta)
  }

  return app
}

function armarSalida(respuesta) {
  const c = respuesta.cuerpo
  let body
  if (c === undefined || c === null) body = ''
  else if (typeof c === 'string') body = c
  else if (typeof Uint8Array !== 'undefined' && c instanceof Uint8Array) body = c
  else { body = JSON.stringify(c); if (!respuesta.headers['content-type']) respuesta.headers['content-type'] = 'application/json; charset=utf-8' }
  return {
    statusCode: respuesta.statusCode,
    headers: respuesta.headers,
    body,
    cuerpo: c,
    /** Ruta de una página (en el celu, `pagina()` devuelve { pagina: 'm/<modulo>/<archivo>' }). */
    json() { return typeof body === 'string' ? JSON.parse(body) : c },
  }
}

module.exports = { crearEnrutador, validar, ErrorValidacion }
