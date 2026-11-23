/*
 * El tema en cada pantalla. Lo carga comun/pantalla/marco.js en todas las páginas (no hay que sumarlo a mano).
 * - Pide /api/temas/activo y aplica el tema: variables de color de comun/pantalla/estilo.css, letras, data-tema.
 *   Guarda las variables en el navegador para que la próxima pantalla arranque ya pintada (marco.js las pone).
 * - SEK.icono(nombre) pasa a responder con el tema elegido: kanji (texto) o ícono dibujado (<svg>).
 * - Escucha los eventos visuales genéricos (SEK.evento → 'sek-evento' en document) y los dibuja a la manera del tema.
 * - Muestra los avisos que llegaron del servidor (subir de nivel) una sola vez.
 * - Prende la lluvia de fondo (lluvia.js) si la persona no la apagó.
 * - Tema subido: cambia los kanjis por emojis (sin-kanjis.js).
 * Ofrece SEK.tema: { listo, actual, icono, color, frase, fondo, escena, medio, efecto }.
 * Sin librerías. Nada de acá puede romper una pantalla: todo va con try.
 */
(function () {
  'use strict'
  if (window.SEK && window.SEK.tema) return
  const raiz = document.documentElement
  const BASE = '/m/temas/'
  const CLAVE_VARIABLES = 'sek-tema-variables'
  const quieto = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  let actual = null
  let lluvia = 'lluvia'
  let listoResolver
  const listo = new Promise((r) => { listoResolver = r })

  // ---------- Hoja propia del tema (vidrio de las tarjetas con lluvia, capas de efectos) ----------
  ;(function () {
    if (document.querySelector('link[data-tema-css]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = BASE + 'tema.css'
    l.dataset.temaCss = ''
    document.head.appendChild(l)
  })()

  // ---------- Aplicar ----------
  let variablesPuestas = []
  function aplicar(t) {
    for (const v of variablesPuestas) raiz.style.removeProperty(v)
    variablesPuestas = Object.keys(t.variables || {})
    for (const [k, v] of Object.entries(t.variables || {})) raiz.style.setProperty(k, v)
    raiz.dataset.tema = t.id
    if (t.propio) raiz.dataset.temaPropio = t.claro ? 'claro' : 'oscuro'
    else delete raiz.dataset.temaPropio
    raiz.style.colorScheme = t.claro ? 'light' : 'dark'
    try { localStorage.setItem(CLAVE_VARIABLES, JSON.stringify(t.variables || {})) } catch (e) { /* sin almacenamiento */ }
  }

  // ---------- Íconos ----------
  const ICONO_SVG = (cuerpo) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`
  /** Kanji o texto del tema; si no hay, el ícono dibujado; si tampoco, ''. */
  function icono(nombre) {
    if (!actual) return ''
    const k = actual.iconos && actual.iconos[nombre]
    if (k) return actual.propio && actual.adornos && actual.adornos.simbolos && actual.adornos.simbolos[k] ? actual.adornos.simbolos[k] : k
    const s = actual.svg && actual.svg[nombre]
    return s ? ICONO_SVG(s) : ''
  }
  const color = (nombre) => (actual && actual.colores && actual.colores[nombre]) || ''
  const frase = () => { const f = (actual && actual.frases) || []; return f.length ? f[Math.floor(Math.random() * f.length)] : '' }
  /** Fondo animado por nombre (lluvia, rayos, pc): { video, imagen } o null. */
  const fondo = (nombre) => (actual && actual.medios && actual.medios.fondos && (actual.medios.fondos[nombre] || actual.medios.fondos.lluvia)) || null
  /** Escena en video del tema ('juego/jugando'): { video, inicio, quieto, fin } o null si el tema no trae escenas (usar la versión simple). */
  function escena(nombre) {
    const c = actual && actual.medios && actual.medios.escenas
    if (!c) return null
    const b = c + nombre
    return { video: b + '.mp4', inicio: b + '-inicio.webp', quieto: b + '-quieto.jpg', fin: b + '-fin.jpg' }
  }
  /** Otro archivo del tema por nombre: 'sprite', 'tajo', 'grano', 'personaje'. */
  const medio = (nombre) => (actual && actual.medios && actual.medios[nombre]) || null

  // ---------- Efectos de los eventos visuales ----------
  const ROJO = () => color('color-principal') || '#C8102E'
  const TINTA = () => color('color-tinta') || '#121110'
  const PAPEL = () => color('color-papel') || '#F1EBDF'

  function animar(el, cuadros, opciones) {
    if (!el || quieto() || typeof el.animate !== 'function') return null
    return el.animate(cuadros, opciones)
  }
  /** Una capa fija encima de la pantalla, en el lugar del elemento (o toda la pantalla). Se borra sola. */
  function capa(d, ms) {
    if (quieto()) return null
    const r = d && d.elemento && d.elemento.getBoundingClientRect ? d.elemento.getBoundingClientRect() : null
    const c = document.createElement('div')
    c.className = 'tema-capa'
    c.setAttribute('aria-hidden', 'true')
    Object.assign(c.style, { left: `${r ? r.left : 0}px`, top: `${r ? r.top : 0}px`, width: `${r ? r.width : innerWidth}px`, height: `${r ? r.height : innerHeight}px` })
    document.body.appendChild(c)
    setTimeout(() => c.remove(), ms)
    return c
  }

  // Común: lo simple (un pulso, un fundido, un temblor). Es lo que usa un tema sin efectos propios.
  const pulso = (escala, ms) => (d) => animar(d.elemento, [{ transform: 'scale(1)' }, { transform: `scale(${escala})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' })
  const temblor = (d) => animar(d.elemento, [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 300 })
  const fundido = (d) => animar(d.elemento, [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out' })
  const nada = () => undefined
  const COMUN = {
    completar: pulso(1.04, 260),
    aparecer: (d) => animar(d.elemento, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' }),
    logro: pulso(1.08, 500), recompensa: pulso(1.06, 400), alerta: temblor, descanso: fundido, dormir: fundido,
    pelear: temblor, robo: temblor, duda: temblor, jugar: pulso(1.03, 300), pausa: fundido, quieto: nada,
    'forja-paso': pulso(1.04, 260), 'forja-pedazo': temblor, 'forja-completa': pulso(1.12, 700), 'xp-perdida': temblor,
    'xp.nivel': (d) => nivel(d, false),
  }

  // Shinobi: tinta, sello hanko y rojo en líneas finas.
  function sello(d) {
    const c = capa(d, 900)
    if (!c) return
    const s = document.createElement('span')
    s.className = 'tema-sello'
    s.textContent = icono('icono-sello-hecho') || '済'
    c.appendChild(s)
    animar(s, [
      { transform: 'rotate(-12deg) scale(2.4)', opacity: 0 },
      { transform: 'rotate(-12deg) scale(.92)', opacity: 1, offset: 0.55 },
      { transform: 'rotate(-12deg) scale(1)', opacity: 0.9, offset: 0.75 },
      { transform: 'rotate(-12deg) scale(1)', opacity: 0 },
    ], { duration: 880, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'forwards' })
    for (let i = 0; i < 3; i++) {
      const g = document.createElement('i')
      Object.assign(g.style, { position: 'absolute', right: `${18 + i * 9}px`, top: '50%', width: '5px', height: '5px', borderRadius: '50%', background: i === 1 ? ROJO() : TINTA() })
      c.appendChild(g)
      animar(g, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(i - 1) * 22}px, ${-18 - i * 6}px)`, opacity: 0 }], { duration: 600, delay: 220, easing: 'ease-out', fill: 'forwards' })
    }
  }
  function estallido(d, cantidad) {
    const c = capa({}, 1500)
    if (!c) return
    const r = d && d.elemento && d.elemento.getBoundingClientRect ? d.elemento.getBoundingClientRect() : null
    const cx = r ? r.left + r.width / 2 : innerWidth / 2
    const cy = r ? r.top + r.height / 2 : innerHeight * 0.38
    const colores = [TINTA(), ROJO(), PAPEL()]
    for (let i = 0; i < cantidad; i++) {
      const g = document.createElement('i')
      const t = 4 + Math.random() * 7
      Object.assign(g.style, { position: 'absolute', left: `${cx}px`, top: `${cy}px`, width: `${t}px`, height: `${t}px`, borderRadius: '50%', background: colores[i % 3], boxShadow: i % 3 === 2 ? '0 0 0 1px rgba(0,0,0,.4)' : 'none' })
      c.appendChild(g)
      const ang = Math.random() * Math.PI * 2
      const dist = 60 + Math.random() * 140
      animar(g, [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist + 60}px)) scale(1)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' })
    }
  }
  function tajo(d) {
    const c = capa(d, 700)
    if (!c) return
    const l = document.createElement('i')
    Object.assign(l.style, { position: 'absolute', left: '-10%', top: '50%', width: '120%', height: '3px', background: ROJO(), boxShadow: `0 0 10px ${ROJO()}`, transformOrigin: 'left center' })
    c.appendChild(l)
    animar(l, [{ transform: 'rotate(-14deg) scaleX(0)', opacity: 1 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 1, offset: 0.4 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 0 }], { duration: 640, easing: 'ease-out', fill: 'forwards' })
    temblor(d)
  }
  function brilloRojo(d) {
    const c = capa(d, 900)
    if (!c) return
    const l = document.createElement('i')
    Object.assign(l.style, { position: 'absolute', left: '0', bottom: '0', width: '100%', height: '2px', background: ROJO(), boxShadow: `0 0 12px ${ROJO()}`, transformOrigin: 'left center' })
    c.appendChild(l)
    animar(l, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.6 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 880, easing: 'ease-out', fill: 'forwards' })
  }
  const pincel = (d) => animar(d.elemento, [{ clipPath: 'inset(0 100% 0 0)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
  function alerta(d) {
    animar(d.elemento, [{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: `0 0 0 2px ${ROJO()}, 0 0 18px ${ROJO()}88` }, { boxShadow: '0 0 0 0 transparent' }], { duration: 700 })
    temblor(d)
  }
  const SHINOBI = {
    ...COMUN,
    completar: sello, aparecer: pincel, logro: (d) => estallido(d, 70), recompensa: brilloRojo, alerta,
    pelear: tajo, robo: tajo, duda: alerta, jugar: COMUN.completar, 'forja-completa': brilloRojo,
    'forja-paso': nada, 'forja-pedazo': nada, 'xp-perdida': nada,
    'xp.nivel': (d) => nivel(d, true),
  }

  /** Subiste de nivel: un cartel grande en el centro (kanji del tema y el número). Con tinta, en Shinobi. */
  function nivel(d, tinta) {
    const n = d && (d.nivel || d.texto)
    const c = document.createElement('div')
    c.className = 'tema-nivel'
    c.setAttribute('role', 'status')
    c.innerHTML = `<div class="tema-nivel-caja"><span class="kanji">${icono('icono-nivel') || '段'}</span><strong>Nivel ${Number(n) || ''}</strong><span class="chico">${frase()}</span></div>`
    c.addEventListener('click', () => c.remove())
    document.body.appendChild(c)
    setTimeout(() => c.remove(), quieto() ? 2500 : 3200)
    animar(c.firstChild, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,1.2,.4,1)' })
    if (tinta) estallido({ elemento: c.firstChild }, 60)
  }

  /** Dibuja un evento con los efectos del tema (Shinobi o Común). Nunca rompe. */
  function efecto(nombre, detalle) {
    try {
      const usaShinobi = actual && !actual.propio && (actual.adornos || {}).animaciones !== 'hada'
      const tabla = usaShinobi ? SHINOBI : COMUN
      const fn = tabla[nombre] || COMUN[nombre]
      if (fn) fn(detalle || {})
    } catch (e) { /* una animación rota nunca rompe la app */ }
  }
  document.addEventListener('sek-evento', (e) => { listo.then(() => efecto(e.detail && e.detail.nombre, e.detail)) })

  // ---------- Cargar ----------
  function cargarScript(nombre) {
    return new Promise((ok) => {
      const s = document.createElement('script')
      s.src = BASE + nombre
      s.onload = ok
      s.onerror = ok
      document.head.appendChild(s)
    })
  }

  async function arrancar() {
    if (location.pathname.startsWith('/entrar')) return listoResolver(null) // sin sesión todavía: queda lo de estilo.css
    let r
    try {
      const resp = await fetch('/api/temas/activo', { credentials: 'same-origin' })
      if (!resp.ok) return listoResolver(null) // sin sesión (entrar) o sin servidor: queda lo de estilo.css
      r = await resp.json()
    } catch (e) { return listoResolver(null) }
    actual = r.tema
    lluvia = r.lluvia || 'lluvia'
    aplicar(actual)
    window.SEK.tema.actual = actual
    if (actual.propio) await cargarScript('sin-kanjis.js').then(() => { try { window.SEK.sinKanjis && window.SEK.sinKanjis(actual.adornos && actual.adornos.simbolos) } catch (e) { /* nada */ } })
    if (lluvia !== 'apagada' && !actual.propio && !document.body.hasAttribute('data-sin-lluvia')) {
      await cargarScript('lluvia.js')
      try { window.SEK.lluvia && window.SEK.lluvia.prender(lluvia) } catch (e) { /* nada */ }
    }
    try { document.dispatchEvent(new CustomEvent('sek-tema', { detail: { tema: actual } })) } catch (e) { /* nada */ }
    listoResolver(actual)
    for (const a of r.avisos || []) efecto(a.nombre, a)
  }

  window.SEK = window.SEK || {}
  window.SEK.tema = { listo, actual: null, icono, color, frase, fondo, escena, medio, efecto, aplicar: (t) => { actual = t; aplicar(t) } }
  if (document.body) arrancar()
  else document.addEventListener('DOMContentLoaded', arrancar)
})()
