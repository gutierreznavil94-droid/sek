/*
 * Lo común en JavaScript para todas las pantallas (se carga con <script src="/comun/marco.js">).
 * - SEK.api(ruta, datos?)   pide a las rutas del servidor. Con datos hace POST. Tira Error con el mensaje del servidor.
 * - SEK.barra(activo)       dibuja la barra de abajo. Los módulos se anotan en SEK.MENU.
 * - SEK.mensaje(texto, mal) aviso corto abajo.
 * - SEK.$(selector)         atajo de document.querySelector.
 * - SEK.minutos(n)          "1 h 05 min".
 * Sin librerías.
 */
(function () {
  'use strict'

  /** Botones de la barra de abajo. Cada módulo nuevo con pantalla principal se suma acá (kanji del tema). */
  const MENU = [
    { id: 'hoy', texto: 'Hoy', kanji: '今', ruta: '/hoy' },
    { id: 'juego', texto: 'Juego', kanji: '遊', ruta: '/juego' },
    { id: 'xp', texto: 'Nivel', kanji: '段', ruta: '/xp' },
    { id: 'mas', texto: 'Más', kanji: '他', ruta: '/mas' },
  ]

  async function api(ruta, datos, metodo) {
    const opciones = { method: metodo || (datos === undefined ? 'GET' : 'POST'), headers: {}, credentials: 'same-origin' }
    if (datos !== undefined) { opciones.headers['Content-Type'] = 'application/json'; opciones.body = JSON.stringify(datos) }
    const r = await fetch(ruta, opciones)
    if (r.status === 401 && !location.pathname.startsWith('/entrar')) { location.href = '/entrar'; throw new Error('Tenés que entrar primero.') }
    const cuerpo = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(cuerpo.error || 'Algo falló.')
    return cuerpo
  }

  function barra(activo) {
    const nav = document.createElement('nav')
    nav.className = 'barra-abajo'
    nav.setAttribute('aria-label', 'Secciones')
    for (const m of MENU) {
      const a = document.createElement('a')
      a.href = m.ruta
      if (m.id === activo) { a.className = 'activo'; a.setAttribute('aria-current', 'page') }
      a.innerHTML = `<span class="kanji" aria-hidden="true">${m.kanji}</span><span>${m.texto}</span>`
      nav.appendChild(a)
    }
    document.body.appendChild(nav)
  }

  let timer = null
  function mensaje(texto, mal) {
    let el = document.querySelector('.mensaje')
    if (!el) { el = document.createElement('div'); el.className = 'mensaje'; el.setAttribute('role', 'status'); document.body.appendChild(el) }
    el.textContent = texto
    el.classList.toggle('mal', !!mal)
    el.hidden = false
    clearTimeout(timer)
    timer = setTimeout(() => { el.hidden = true }, 3500)
  }

  function minutos(n) {
    const m = Math.max(0, Math.round(n))
    const h = Math.floor(m / 60)
    return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`
  }

  /** Envuelve un manejador: si falla, muestra el error en vez de romper. */
  function seguro(fn) {
    return async (...args) => { try { await fn(...args) } catch (e) { mensaje(e.message, true) } }
  }

  window.SEK = { api, barra, mensaje, minutos, seguro, MENU, $: (s) => document.querySelector(s) }
})()
