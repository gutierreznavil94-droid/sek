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

  var q = new URLSearchParams(location.search)
  var ruta = q.get('__ruta')
  if (ruta) history.replaceState(history.state, '', ruta)

  /** Un archivo del paquete (estilos, scripts, fuentes, medios del tema): se pide normal. */
  function esArchivo(camino) { return /^\/(comun|m|pglite)\//.test(camino) && /\.[a-z0-9]+$/i.test(camino) }
  function local(url) {
    var u = new URL(url, location.href)
    return u.origin === location.origin && !esArchivo(u.pathname) ? u.pathname + u.search : null
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
    return new Response(sinCuerpo ? null : r.body, { status: r.statusCode, headers: cab })
  }

  var fetchReal = window.fetch.bind(window)
  window.fetch = function (entrada, init) {
    var url = typeof entrada === 'string' || entrada instanceof URL ? String(entrada) : entrada.url
    var camino = local(url)
    if (!camino) return fetchReal(entrada, init)
    if (!init && typeof entrada === 'object' && !(entrada instanceof URL)) init = { method: entrada.method, headers: entrada.headers }
    return pedir(camino, init)
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
