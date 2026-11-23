/*
 * El guerrero bajo la lluvia (o los rayos): el video vertical de fondo de Progreso, igual que VideoDeFondo de la
 * app vieja (src/ui/paginas/Progreso.tsx). Animación de una sola pantalla → vive en el módulo progreso.
 * Los archivos son del tema (SEK.tema.fondo('lluvia'|'rayos'|'pc')): otro tema puede traer los suyos.
 *
 *   SEK_FONDO_PROGRESO({ hoy, diaUno }) → { pausar(si), oscurecer(0..0.3) }
 *
 * - Día 1 del ciclo lluvia, Día 2 rayos, Día 3 lluvia… (sin ciclo cuenta desde el 1 nov 2026).
 * - En pantallas anchas (computadora) va el video horizontal «pc».
 * - El video se baja entero y se reproduce desde la memoria (blob): anda sin conexión y sin pedir por partes.
 * - Si el teléfono no lo deja arrancar solo, queda la imagen quieta del video y un ▶; si tampoco anda con ▶,
 *   el ▶ se va y queda la imagen (nada que no funcione a la vista).
 * - El vidrio de tarjetas, cabecera y barra se tiñe según el video (--vidrio-a); en los relámpagos sube (--destello).
 */
(function () {
  'use strict'
  const VIDEOS = {
    lluvia: { vidrio: 0.5 },
    rayos: { vidrio: 0.45, destellos: [[2.5, 3.8], [6.5, 8.2]] },
    pc: { vidrio: 0.55 },
  }
  const CICLO = ['lluvia', 'rayos']
  const DIA_UNO_REFERENCIA = '2026-11-01'
  const VIDRIO_EN_DESTELLO = 0.66
  const HORIZONTAL = '(min-aspect-ratio: 1/1) and (min-width: 900px)'

  const dias = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)
  function delDia(hoy, diaUno) {
    const n = dias(diaUno || DIA_UNO_REFERENCIA, hoy)
    return CICLO[((n % CICLO.length) + CICLO.length) % CICLO.length]
  }
  function destello(t, lista) {
    if (!lista) return 0
    const r = 0.15
    let m = 0
    for (const [a, b] of lista) {
      if (t >= a && t <= b) m = 1
      else if (t > a - r && t < a) m = Math.max(m, (t - (a - r)) / r)
      else if (t > b && t < b + r) m = Math.max(m, 1 - (t - b) / r)
    }
    return m
  }

  window.SEK_FONDO_PROGRESO = function ({ hoy, diaUno }) {
    const id = matchMedia(HORIZONTAL).matches ? 'pc' : delDia(hoy, diaUno)
    const cfg = VIDEOS[id]
    let medio = null
    const raiz = document.documentElement.style
    raiz.setProperty('--vidrio-a', String(cfg.vidrio))
    raiz.setProperty('--vidrio-destello', String(VIDRIO_EN_DESTELLO))
    raiz.setProperty('--destello', '0')

    const caja = document.createElement('div')
    caja.className = 'av-fondo'
    caja.setAttribute('aria-hidden', 'true')
    if (id === 'pc') caja.dataset.orientacion = 'horizontal'
    caja.innerHTML = '<div class="av-oscuro" style="opacity: 0;"></div><div class="av-tapa-arriba" style="opacity: 0;"></div>'
    document.body.appendChild(caja)
    const oscuro = caja.querySelector('.av-oscuro')
    const tapa = caja.querySelector('.av-tapa-arriba')
    let pausado = false
    let v = null
    let boton = null
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches && localStorage.getItem('sek-fondo-movimiento') !== 'si'

    function quitarBoton() { if (boton) { boton.remove(); boton = null } }
    function ponerBoton() {
      if (boton || !v) return
      boton = document.createElement('button')
      boton.className = 'av-play'
      boton.type = 'button'
      boton.setAttribute('aria-label', 'Ver el video en movimiento')
      boton.textContent = '▶'
      boton.onclick = () => {
        try { localStorage.setItem('sek-fondo-movimiento', 'si') } catch (e) { /* sin almacenamiento */ }
        v.play().then(mostrarVideo).catch(() => quitarBoton())
      }
      document.body.appendChild(boton)
    }
    function mostrarVideo() {
      quitarBoton()
      v.style.opacity = '1'
    }
    function ajustar() {
      if (!v) return
      if (document.hidden || pausado) { v.pause(); return }
      v.play().then(mostrarVideo).catch(ponerBoton)
    }

    /** El tema carga aparte (tema.js): se espera hasta 3 s; si no llega, los archivos de Shinobi. */
    async function delTema() {
      for (let i = 0; i < 30 && !(window.SEK.tema && SEK.tema.listo); i++) await new Promise((ok) => setTimeout(ok, 100))
      try { if (window.SEK.tema) { await SEK.tema.listo; const m = SEK.tema.fondo(id); if (m) return m } } catch (e) { /* respaldo */ }
      return { video: `/m/temas/shinobi/fondos/${id}.mp4`, imagen: `/m/temas/shinobi/fondos/${id}.jpg` }
    }

    async function arrancar() {
      medio = await delTema()
      if (medio.imagen) {
        const img = document.createElement('img')
        img.className = 'av-video av-cuadro'
        img.alt = ''
        img.src = medio.imagen
        caja.insertBefore(img, oscuro)
      }
      if (!medio.video) return
      let src = medio.video
      try {
        const r = await fetch(medio.video)
        if (r.ok) src = URL.createObjectURL(new Blob([await r.blob()], { type: 'video/mp4' }))
      } catch (e) { /* desde la dirección directa */ }
      v = document.createElement('video')
      v.className = 'av-video'
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true
      for (const a of ['muted', 'playsinline', 'loop', 'disablepictureinpicture']) v.setAttribute(a, '')
      v.preload = 'auto'
      if (medio.imagen) v.poster = medio.imagen
      v.style.opacity = '0'
      v.style.transition = 'opacity .4s'
      v.src = src
      caja.insertBefore(v, oscuro)
      // Arrancó de verdad (el tiempo avanza): recién ahí se ve el video sobre la imagen.
      v.addEventListener('timeupdate', () => { if (v.currentTime > 0.05) mostrarVideo() })
      v.addEventListener('canplay', ajustar, { once: true })
      v.addEventListener('error', () => { v.remove(); v = null; quitarBoton() })
      if (quieto) { ponerBoton(); return }
      ajustar()
      // Si en 4 s no avanzó (el teléfono lo frena), queda la imagen con ▶.
      setTimeout(() => { if (v && v.currentTime < 0.05 && !pausado) ponerBoton() }, 4000)
      // Relámpagos: el vidrio sube para que se siga leyendo.
      if (cfg.destellos) {
        const paso = () => { if (v) raiz.setProperty('--destello', destello(v.currentTime, cfg.destellos).toFixed(2)); requestAnimationFrame(paso) }
        requestAnimationFrame(paso)
      }
    }
    document.addEventListener('visibilitychange', ajustar)
    // Primer toque en cualquier lado: si estaba frenado, prueba de nuevo.
    document.addEventListener('pointerdown', () => { if (v && v.paused && !pausado && !quieto) ajustar() }, { passive: true })
    // Que la página arranque primero; el video después (no frena la primera pintada).
    setTimeout(arrancar, 300)

    return {
      pausar(si) { pausado = !!si; ajustar() },
      oscurecer(o) { oscuro.style.opacity = String(o); tapa.style.opacity = String(Math.min(1, o / 0.3)) },
    }
  }
})()
