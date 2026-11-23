/**
 * Va arriba de cada pantalla en el celu (lo pone herramientas/armar-celu.js). La pantalla vive adentro
 * de la página madre, que tiene la base. Esto hace que la pantalla no note la diferencia:
 * - deja la dirección linda (/juego en vez de /m/juego/juego.html?__ruta=...);
 * - fetch('/api/...') le pregunta a su módulo ahí mismo (SEK_LOCAL), sin internet;
 * - los enlaces a otra pantalla los abre la página madre;
 * - las imágenes y videos que salen de /api/ se muestran desde la base.
 */
(function () {
  var madre = window.parent
  if (madre === window || !madre.SEK_LOCAL) return

  // Para verla en un link (herramientas/armar-web.js) la app vive en una subcarpeta: la madre dice cuál es
  // (SEK_RAIZ) y las direcciones del paquete se resuelven desde ahí con un <base>.
  var raiz = madre.SEK_RAIZ || null
  if (raiz && !document.querySelector('base')) {
    var base = document.createElement('base')
    base.href = raiz
    document.head ? document.head.prepend(base) : document.documentElement.prepend(base)
  }
  if (raiz) {
    Object.defineProperty(window, 'SEK_IR_WEB', { configurable: true, set: function (v) { madre.SEK_IR(String(v)) } })
  }

  var q = new URLSearchParams(location.search)
  var ruta = q.get('__ruta')
  if (ruta) history.replaceState(history.state, '', ruta)

  /** Un archivo del paquete (estilos, scripts, fuentes, medios del tema): se pide normal. */
  function esArchivo(camino) { return /^\/(comun|m|pglite)\//.test(camino) && /\.[a-z0-9]+$/i.test(camino) }
  function local(url) {
    var u = new URL(url, document.baseURI)
    if (u.origin !== location.origin) return null
    var camino = u.pathname
    if (raiz && u.href.indexOf(raiz) === 0) camino = '/' + u.href.slice(raiz.length).split(/[?#]/)[0]
    return !esArchivo(camino) ? camino + u.search : null
  }

  async function pedir(camino, init) {
    init = init || {}
    var headers = {}
    if (init.headers) new Headers(init.headers).forEach(function (v, k) { headers[k] = v })
    var cuerpo = init.body
    if (cuerpo instanceof Blob) cuerpo = await cuerpo.text()
    var r = await madre.SEK_LOCAL({ method: init.method || 'GET', url: camino, headers: headers, payload: cuerpo })
    var cab = new Headers()
    Object.keys(r.headers).forEach(function (k) { if (k !== 'set-cookie') cab.set(k, String(r.headers[k])) })
    var sinCuerpo = r.statusCode === 204 || r.statusCode === 304
    var cuerpoR = r.body
    // En el link, los archivos que nombran las respuestas (/m/temas/...) se piden desde la raíz de la app.
    if (raiz && typeof cuerpoR === 'string' && /json/.test(cab.get('content-type') || '')) cuerpoR = cuerpoR.replace(/"\/(comun|m|pglite)\//g, '"$1/')
    return new Response(sinCuerpo ? null : cuerpoR, { status: r.statusCode, headers: cab })
  }

  var fetchReal = window.fetch.bind(window)
  window.fetch = function (entrada, init) {
    var url = typeof entrada === 'string' || entrada instanceof URL ? String(entrada) : entrada.url
    var camino = local(url)
    if (!camino) return fetchReal(entrada, init)
    if (!init && typeof entrada === 'object' && !(entrada instanceof URL)) init = { method: entrada.method, headers: entrada.headers }
    return pedir(camino, init)
  }

  // sendBeacon('/api/...') (avisos al ocultarse): también local.
  if (navigator.sendBeacon) {
    var beaconReal = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = function (url, datos) {
      var camino = local(url)
      if (!camino) return beaconReal(url, datos)
      pedir(camino, { method: 'POST', body: typeof datos === 'string' ? datos : undefined }).catch(function () {})
      return true
    }
  }

  // Enlaces a otra pantalla: los abre la madre (más rápido que cargar la página madre adentro).
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
    var a = e.target.closest && e.target.closest('a[href]')
    if (!a || a.target || a.hasAttribute('download')) return
    var camino = local(a.href)
    if (!camino || camino.indexOf('/api/') === 0) return
    e.preventDefault()
    madre.SEK_IR(camino)
  })

  // Medios que salen de /api/ (fotos de hábitos, temas subidos): blob desde la base.
  var hechos = new WeakMap()
  async function medio(el) {
    var src = el.getAttribute('src')
    if (!src || hechos.get(el) === src) return
    var camino = local(src)
    if (!camino || camino.indexOf('/api/') !== 0) return
    hechos.set(el, src)
    try {
      var r = await pedir(camino)
      if (!r.ok) return
      var blob = URL.createObjectURL(await r.blob())
      hechos.set(el, blob)
      el.setAttribute('src', blob)
    } catch (err) { /* queda sin imagen */ }
  }
  function revisar(raiz) {
    if (raiz.matches && raiz.matches('img,video,audio,source')) medio(raiz)
    if (raiz.querySelectorAll) raiz.querySelectorAll('img[src],video[src],audio[src],source[src]').forEach(medio)
  }
  new MutationObserver(function (cambios) {
    cambios.forEach(function (c) {
      if (c.type === 'attributes') medio(c.target)
      else c.addedNodes.forEach(revisar)
    })
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
  document.addEventListener('DOMContentLoaded', function () { revisar(document) })
})()
