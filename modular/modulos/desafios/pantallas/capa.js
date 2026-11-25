/*
 * Desafíos en el navegador: lo que se dibuja encima de cualquier pantalla. Cargar después de /comun/marco.js:
 *   <script src="/m/desafios/capa.js"></script>
 * Ofrece SEK.desafios:
 *   llegada({ pilarPendiente, pasoDejoCelu, modoSueno })  al abrir Hoy: la frase del día y el Tajo si tocan
 *   botones(contenedor, { fecha })                         pone «進 Tensión» y «No cumplí» (para la cabecera de Hoy)
 *   tension({ prueba }) · noCumpli({ fecha, prueba }) · caida({ origen, prueba }) · duelo(motivo, { prueba })
 *   frase({ dia }) · tajo()
 * Todo devuelve una promesa que termina cuando se cierra. `prueba`: solo se ve, no guarda nada.
 * Las escenas y videos salen del tema (SEK.tema.escena / medio / fondo); si el tema no los trae, la versión simple.
 * Le habla solo a /api/desafios (las rutas de su módulo). Traído de src/ui/Tension.tsx, Tajo.tsx, FraseDuda.tsx,
 * Caida.tsx, Duelo.tsx y src/temas/shinobi/EscenaTension.tsx.
 */
(function () {
  'use strict'
  if (!window.SEK || window.SEK.desafios) return
  const SEK = window.SEK

  if (!document.querySelector('link[data-desafios]')) {
    const l = document.createElement('link')
    l.rel = 'stylesheet'; l.href = '/m/desafios/capa.css'; l.dataset.desafios = ''
    document.head.appendChild(l)
  }

  // Las escenas van como hojas de cuadros en un <canvas> (en el celu los <video> no arrancaban). Viven en este módulo.
  const ESCENAS = '/m/desafios/escenas/'
  let hojaLista = null
  const hojaClip = () => {
    if (window.SEK_HOJA_CLIP) return Promise.resolve()
    if (!hojaLista) hojaLista = new Promise((listo) => { const x = document.createElement('script'); x.src = '/comun/hoja-clip.js'; x.onload = listo; x.onerror = listo; document.head.appendChild(x) })
    return hojaLista
  }

  const reducido = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }
  const vibrar = (p) => { try { if (navigator.vibrate) navigator.vibrate(p) } catch (e) { /* sin vibración */ } }
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
  const escapar = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const tema = async () => { try { if (SEK.tema && SEK.tema.listo) await SEK.tema.listo } catch (e) { /* sin tema */ } return SEK.tema || null }
  const icono = (nombre, defecto) => { try { return SEK.icono(nombre) || defecto } catch (e) { return defecto } }

  function capa(clase, html) {
    const d = document.createElement('div')
    d.className = 'dz-capa ' + clase
    d.setAttribute('role', 'dialog')
    d.innerHTML = html || ''
    document.body.appendChild(d)
    return d
  }
  async function cerrar(d, suave) {
    if (!d || !d.isConnected) return
    if (suave && !reducido()) { d.classList.add('dz-saliendo'); await esperar(380) }
    d.remove()
  }

  /** Aviso abajo con un botón (p. ej. «Deshacer» por 10 s). */
  function aviso(texto, boton, ms) {
    document.querySelectorAll('.dz-aviso').forEach((x) => x.remove())
    const a = document.createElement('div')
    a.className = 'dz-aviso'; a.setAttribute('role', 'status')
    a.innerHTML = `<span>${escapar(texto)}</span>`
    if (boton) {
      const b = document.createElement('button'); b.textContent = boton.texto
      b.onclick = () => { a.remove(); boton.fn() }
      a.appendChild(b)
    }
    document.body.appendChild(a)
    setTimeout(() => a.remove(), ms || 4000)
  }

  // ---------- «Dudar es fracasar» ----------
  /** La frase grande. `dia`: la de todos los días (video del tema detrás y el kanji 斬). Tocar la salta. */
  async function frase({ dia = false } = {}) {
    const t = await tema()
    const quieto = reducido()
    const fondo = dia && t && t.fondo ? t.fondo('rayos') : null
    const video = fondo && (quieto ? (fondo.imagen ? `<img class="fd-video" src="${escapar(fondo.imagen)}" alt="">` : '')
      : `<video class="fd-video" src="${escapar(fondo.video)}" ${fondo.imagen ? `poster="${escapar(fondo.imagen)}"` : ''} autoplay muted loop playsinline></video>`)
    const d = capa(`frase-duda ${dia ? 'fd-dia' : ''} ${quieto ? 'quieto' : ''}`, `
      ${video || ''}<div class="fd-velo" aria-hidden="true"></div>
      ${dia ? `<div class="fd-icono" aria-hidden="true"><span class="dz-kanji">${escapar(icono('kanji-duda', '斬'))}</span></div>` : ''}
      <p class="fd-texto"><span class="fd-palabra fd-p1">Dudar</span><span class="fd-palabra fd-p2">es</span><span class="fd-palabra fd-p3">fracasar</span></p>
      <span class="fd-tajo" aria-hidden="true"></span>`)
    d.setAttribute('aria-label', 'Dudar es fracasar')
    await new Promise((listo) => {
      const fin = setTimeout(listo, dia ? 4600 : 2600)
      d.addEventListener('click', () => { clearTimeout(fin); listo() })
    })
    await cerrar(d, true)
  }

  // ---------- El Tajo ----------
  /**
   * Al volver después de horas con un pilar pendiente: la pantalla se corta como papel (video del tema, el blanco se vuelve
   * transparente, así el papel que se corta es la propia pantalla). Igual que Tajo.tsx de la v0.88.27: sin velo ni
   * desenfoque, un toque lo cierra en cualquier momento y, si nadie toca, se cierra solo a los 15 s.
   */
  async function tajo() {
    const t = await tema()
    const src = t && t.medio ? t.medio('tajo') : null
    const quieto = reducido()
    const d = capa('dz-tajo', `
      <svg width="0" height="0" aria-hidden="true"><filter id="dz-tajo-luma" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -3 -5.9 -1.1 0 7.2"/></filter></svg>
      ${src && !quieto ? `<video class="dz-tajo-video" muted playsinline preload="auto" disablepictureinpicture>
        <source src="${escapar(src.replace(/\.mp4$/, '.webm'))}" type="video/webm"><source src="${escapar(src)}" type="video/mp4"></video>` : ''}`)
    d.setAttribute('aria-label', 'Tenés un pilar pendiente')
    const w = innerWidth, h = innerHeight, largo = Math.hypot(w, h)
    const angulo = Math.atan2(h, -w) * 180 / Math.PI
    const hoja = () => {
      const r = document.createElement('div')
      r.className = 'dz-tajo-riel'
      r.style.width = largo + 'px'; r.style.setProperty('--largo', largo + 'px')
      r.style.transform = `translate(-50%, -50%) rotate(${angulo}deg)`
      r.innerHTML = '<div class="dz-tajo-hoja"></div>'
      d.appendChild(r)
      vibrar([30, 40, 80])
    }
    const v = d.querySelector('video')
    if (v) {
      let cortado = false
      v.addEventListener('timeupdate', () => { if (!cortado && v.currentTime >= 1.0) { cortado = true; hoja() } })
      const p = v.play(); if (p && p.catch) p.catch(() => { /* queda la pantalla y el toque lo cierra */ })
    } else {
      // Sin video (o con «reducir movimiento»): una línea roja que corta en diagonal.
      const l = document.createElement('div')
      l.className = 'dz-tajo-linea'
      l.style.width = largo + 'px'
      l.style.transform = `translate(-50%, -50%) rotate(${angulo}deg)`
      l.style.transformOrigin = 'center'
      d.appendChild(l)
      vibrar([30, 40, 80])
    }
    await new Promise((fin) => {
      d.addEventListener('pointerdown', fin)
      d.addEventListener('keydown', fin)
      setTimeout(fin, 15000)
    })
    await cerrar(d, false)
  }

  /** Tormenta de fondo del duelo (como FondoLluvia «hoy»): nubes a tinta arriba y lluvia fina en diagonal. */
  function tormenta(c) {
    const ctx = c.getContext('2d')
    const W = c.width = innerWidth, H = c.height = innerHeight
    const nubes = Array.from({ length: 9 }, (_, i) => ({ x: (i / 8) * W * 1.2 - W * 0.1, y: H * (0.02 + (i % 3) * 0.05), r: W * (0.28 + (i % 4) * 0.06), v: 4 + (i % 3) * 3 }))
    const gotas = Array.from({ length: 90 }, () => ({ x: Math.random() * W * 1.3, y: Math.random() * H, l: 10 + Math.random() * 18, v: 500 + Math.random() * 400, a: 0.12 + Math.random() * 0.3 }))
    let antes = performance.now()
    const dibujar = (ahora) => {
      if (!c.isConnected) return
      const dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora
      ctx.clearRect(0, 0, W, H)
      for (const n of nubes) {
        n.x += n.v * dt; if (n.x - n.r > W) n.x = -n.r
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        g.addColorStop(0, 'rgba(120,120,118,0.35)'); g.addColorStop(1, 'rgba(120,120,118,0)')
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r, n.r * 0.45, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.lineWidth = 1.2; ctx.lineCap = 'round'
      for (const g of gotas) {
        g.y += g.v * dt; g.x -= g.v * dt * 0.12
        if (g.y > H) { g.y = -g.l; g.x = Math.random() * W * 1.3 }
        ctx.strokeStyle = `rgba(220,220,215,${g.a})`
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.l * 0.12, g.y + g.l); ctx.stroke()
      }
      if (!reducido()) requestAnimationFrame(dibujar)
    }
    requestAnimationFrame(dibujar)
  }

  // ---------- Duelo de flexiones ----------
  /** Pide las flexiones de la serie rápida (la serie; después de «No cumplí», la serie más la mitad) y las anota como una serie hecha. */
  async function duelo(motivo, { prueba = false } = {}) {
    const c = await SEK.api('/api/desafios/duelo/' + encodeURIComponent(motivo))
    const nombre = c.nombre || 'Flexiones'
    // Como la v0.88.27 (DueloComun): tormenta de Hoy detrás, 力 grande, «Flexiones · 14», la cuenta y «Listo».
    const d = document.createElement('div')
    d.className = 'dq-capa simple' + (reducido() ? ' quieto' : '')
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', `${nombre} · ${c.reps}`)
    d.innerHTML = `<canvas class="dz-dq-lluvia" aria-hidden="true"></canvas><span class="dq-vineta" aria-hidden="true"></span>
      <button type="button" class="dq-escena dq-simple dz-golpe" aria-label="Una flexión">
        <span class="dq-kanji" aria-hidden="true">${escapar(icono('kanji-fuerza', '力'))}</span>
        <span class="dq-titulo">${escapar(nombre)} · <b>${c.reps}</b></span>
        <span class="dq-cuenta grande" aria-live="polite"><span class="dz-hechas">0</span> <span class="texto-3">/ ${c.reps}</span></span>
        <span class="dq-nota">Tocá por cada ${/flexi/i.test(nombre) ? 'flexión' : 'una'}</span>
      </button>
      <div class="dq-abajo"><button type="button" class="dq-listo dz-listo">Listo</button><button type="button" class="dq-no dz-ahora-no">Ahora no</button></div>`
    document.body.appendChild(d)
    tormenta(d.querySelector('.dz-dq-lluvia'))
    let hechas = 0
    let terminado = false
    const resultado = await new Promise((fin) => {
      const terminar = async () => {
        if (terminado) return
        terminado = true
        d.classList.add('dq-tajo-fase')
        SEK.evento('pelear', { elemento: d.querySelector('.dq-kanji') })
        vibrar(60)
        await esperar(reducido() ? 300 : 1100)
        if (prueba) return fin({ reps: c.reps, xp: 0, prueba: true })
        try { fin(await SEK.api('/api/desafios/duelo', { motivo, reps: c.reps })) } catch (e) { SEK.mensaje(e.message, true); fin(null) }
      }
      d.querySelector('.dz-golpe').onclick = () => {
        if (terminado) return
        hechas = Math.min(hechas + 1, c.reps)
        d.querySelector('.dz-hechas').textContent = hechas
        vibrar(15)
        if (hechas >= c.reps) terminar()
      }
      d.querySelector('.dz-listo').onclick = () => { hechas = c.reps; d.querySelector('.dz-hechas').textContent = hechas; terminar() }
      d.querySelector('.dz-ahora-no').onclick = () => { if (!terminado) { terminado = true; fin(null) } }
    })
    await cerrar(d, true)
    if (resultado && !resultado.prueba) {
      SEK.mensaje(`${resultado.reps} ${nombre.toLowerCase()} · una serie hecha${resultado.xp > 0 ? ` · +${resultado.xp} XP` : ''}${resultado.anotado === false ? ' (sin serie rápida: no se anotó)' : ''}`)
      if (resultado.nuevoNivel) SEK.evento('logro', {})
    }
    return resultado
  }

  // ---------- La caída ----------
  /** Guarda la caída (−XP y la marca del día), muestra la escena y al «Levantarme» sigue el duelo. Después, «Deshacer» 10 s. */
  async function caida({ origen = 'boton', fecha = null, prueba = false } = {}) {
    const desdeTension = origen === 'tension'
    let r = null
    if (!prueba) r = await SEK.api(desdeTension ? '/api/desafios/tension/soltar' : '/api/desafios/no-cumpli', desdeTension || !fecha ? {} : { fecha })
    const xp = r ? r.caida.xp : 0
    const t = await tema()
    const conEscena = !!(t && t.escena && t.escena('caida/t6-tumba-regreso'))
    if (conEscena) await hojaClip()
    if (conEscena && window.SEK_HOJA_CLIP) await escenaCaida(xp, desdeTension)
    else {
      // Tema sin escenas: la versión simple.
      const s = capa('dz-caida', `
        <div class="dz-kanji" aria-hidden="true">${escapar(icono('icono-caida', '墓'))}</div>
        <div class="dz-titulo">${desdeTension ? 'No le diste la mano.' : 'Caíste.'}</div>
        ${xp > 0 ? `<div class="dz-xp-menos">−${xp} XP</div>` : ''}
        <p class="dz-texto">Queda la marca. El día sigue: nuevo round.</p>
        <div class="dz-botones"><button type="button" class="principal dz-levantarme">Levantarme</button></div>`)
      SEK.evento('xp-perdida', { elemento: s.querySelector('.dz-kanji') })
      vibrar([80, 60, 80])
      await new Promise((fin) => { s.querySelector('.dz-levantarme').onclick = fin })
      await cerrar(s, true)
    }
    await duelo(desdeTension ? 'tension' : 'caida', { prueba })
    if (r) {
      aviso(xp > 0 ? `Caída anotada · −${xp} XP` : 'Caída anotada', {
        texto: 'Deshacer',
        fn: SEK.seguro(async () => { await SEK.api('/api/desafios/caidas/' + encodeURIComponent(r.caida.id), undefined, 'DELETE'); SEK.mensaje('Caída deshecha: volvió la XP') }),
      }, 10000)
    }
    return r
  }

  /**
   * La caída del tema Shinobi, como la v0.88.27 (EscenaCaida.tsx), con hojas de cuadros en vez de videos:
   * 1. Te arrasan (desde el botón): el rival corriendo, cada vez más y más grandes, hasta gris oscuro (2,5 s).
   * 2. Fundido de tinta. 3. La tumba: la mano sale de la tierra con acercamiento lento, lluvia y terrones.
   * 4. Destello y renacer: 甦, «NUEVO ROUND» y «Levantarme». Desde Tensión arranca en la tumba, desde negro.
   */
  function escenaCaida(xp, desdeTension) {
    const quieto = reducido()
    const d = capa('dz-cd', `<button type="button" class="dz-cd-saltar">Saltar</button>`)
    d.setAttribute('aria-label', 'Caída: nuevo round')
    const lluvia = Array.from({ length: 46 }, (_, i) => `<path d="M${(i * 53 + (i % 3) * 17) % 380} ${(i * 97) % 680 - 40} l-7 30"/>`).join('')
    return new Promise((resolver) => {
      let fase = ''
      let reloj = 0
      const poner = (f) => { fase = f; d.className = 'dz-capa dz-cd ' + f + (desdeTension ? ' desde-negro' : '') }
      const fin = () => { clearTimeout(reloj); d.remove(); resolver() }
      const renacer = () => {
        if (fase === 'renacer') return
        clearTimeout(reloj)
        d.querySelectorAll('.dz-cd-lienzo, .dz-cd-tinta, .dz-cd-lluvia, .dz-cd-terrones, .dz-cd-destello').forEach((x) => x.remove())
        if (!d.querySelector('.dz-cd-marco')) tumba(true)
        poner('renacer')
        vibrar([80, 60, 80, 60, 240])
        d.querySelector('.dz-cd-saltar').remove()
        const f = document.createElement('div')
        f.className = 'dz-cd-final'
        f.innerHTML = `<div class="dz-cd-kanji" aria-hidden="true">甦</div><div class="dz-cd-frase">Caíste. No terminaste.</div>
          <div class="dz-cd-round">NUEVO ROUND</div><div class="dz-cd-precio">${xp > 0 ? `−${xp} XP · el precio de volver` : 'sin XP que perder · seguís'}</div>
          <button type="button" class="dz-cd-boton">Levantarme</button>`
        d.appendChild(f)
        SEK.evento('xp-perdida', { elemento: f.querySelector('.dz-cd-kanji') })
        f.querySelector('.dz-cd-boton').onclick = fin
      }
      d.querySelector('.dz-cd-saltar').onclick = renacer
      const destello = () => {
        poner('destello')
        const x = document.createElement('div'); x.className = 'dz-cd-destello'; d.appendChild(x)
        reloj = setTimeout(renacer, 300)
      }
      function tumba(quieta) {
        poner('tumba')
        const m = document.createElement('div')
        m.className = 'dz-cd-marco'
        m.innerHTML = quieta || quieto
          ? `<img class="dz-cd-clip" src="${ESCENAS}caida/t6-tumba-regreso-fin.jpg" alt="">`
          : `<canvas class="dz-cd-clip"></canvas><svg class="dz-cd-lluvia" viewBox="0 0 360 640" preserveAspectRatio="none" aria-hidden="true"><g stroke="#cfd2d0" stroke-width="0.9" opacity="0.32">${lluvia}</g></svg>
             <div class="dz-cd-terrones" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map((i) => `<i style="--i:${i}"></i>`).join('')}</div>`
        m.insertAdjacentHTML('beforeend', '<div class="dz-cd-vineta" aria-hidden="true"></div>')
        d.insertBefore(m, d.firstChild)
        if (quieta) return
        if (quieto) { reloj = setTimeout(renacer, 1200); return }
        // La tumba termina cuando termina el clip (con un tope por si se traba).
        reloj = setTimeout(destello, 9000)
        window.SEK_HOJA_CLIP(m.querySelector('canvas')).tocar(ESCENAS + 'caida/t6-tumba-regreso', { alFin: () => { if (fase === 'tumba') { clearTimeout(reloj); destello() } } })
      }
      const tinta = () => {
        poner('tinta')
        d.querySelectorAll('.dz-cd-lienzo').forEach((x) => x.remove())
        const x = document.createElement('div'); x.className = 'dz-cd-tinta'; d.insertBefore(x, d.firstChild)
        reloj = setTimeout(() => { x.remove(); tumba(false) }, 500)
      }
      const arrasan = async () => {
        poner('arrasan')
        const c = document.createElement('canvas'); c.className = 'dz-cd-lienzo'; d.insertBefore(c, d.firstChild)
        let hoja = null
        try { hoja = await window.SEK_HOJA_CLIP(document.createElement('canvas')).cargar(ESCENAS + 'caida/r7-rival-corre') } catch (e) { /* silueta */ }
        estampida(c, hoja, 2500)
        reloj = setTimeout(tinta, 2500)
      }
      vibrar([80, 60, 80])
      if (quieto || desdeTension) tumba(false); else arrasan()
    })
  }

  /** «Te arrasan»: el rival corriendo dibujado muchas veces, cada vez más seguido, más grande y más rápido. */
  function estampida(c, hoja, duracion) {
    const ctx = c.getContext('2d')
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const W = c.clientWidth || innerWidth
    const H = c.clientHeight || innerHeight
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); ctx.scale(dpr, dpr)
    const rivales = []
    const inicio = performance.now()
    let proximo = 0, ultimo = inicio, azar = 7
    const rnd = () => { azar = (azar * 9301 + 49297) % 233280; return azar / 233280 }
    const cuadro = (ahora) => {
      if (!c.isConnected) return
      const t = Math.min(1, (ahora - inicio) / duracion)
      const dt = Math.min(0.05, Math.max(0, (ahora - ultimo) / 1000))
      ultimo = ahora
      while (proximo <= t) {
        const alto = H * (0.22 + 1.25 * t * t + rnd() * 0.2)
        rivales.push({ x: -alto * 0.9 - rnd() * W * 0.3, base: H * (0.45 + rnd() * 0.5) + alto * 0.35, alto, vel: W * (0.7 + 2.6 * t + rnd() * 0.5), desfase: rnd() * 4 })
        proximo += 0.07 - 0.05 * t
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#e9e1d0'
      ctx.fillRect(0, 0, W, H)
      rivales.sort((a, b) => a.alto - b.alto)
      const k = hoja ? Math.floor(((ahora - inicio) / 1000) * hoja.h.fps) % hoja.h.n : 0
      for (const r of rivales) {
        r.x += r.vel * dt
        if (r.x > W + r.alto) continue
        const ancho = r.alto * 1.03
        const y = r.base - r.alto
        ctx.globalCompositeOperation = 'multiply'
        ctx.globalAlpha = Math.min(0.8, 0.45 + 0.3 * r.alto / H)
        if (hoja) {
          const [w, h] = hoja.h.celda
          const kk = (k + Math.floor(r.desfase * 3)) % hoja.h.n
          ctx.drawImage(hoja.img, (kk % hoja.h.columnas) * w, Math.floor(kk / hoja.h.columnas) * h, w, h, r.x, y, ancho, r.alto)
        } else { ctx.fillStyle = '#2e2e2e'; ctx.fillRect(r.x + ancho * 0.3, y, ancho * 0.4, r.alto) }
        // La espada desenvainada, hacia atrás desde la mano
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.9
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1.5, r.alto * 0.022); ctx.lineCap = 'round'
        const mx = r.x + ancho * 0.22, my = y + r.alto * 0.42
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ancho * 0.55, my - r.alto * 0.18); ctx.stroke()
        ctx.strokeStyle = '#d8d8d4'; ctx.lineWidth = Math.max(0.6, r.alto * 0.007)
        ctx.beginPath(); ctx.moveTo(mx - ancho * 0.06, my - r.alto * 0.02); ctx.lineTo(mx - ancho * 0.53, my - r.alto * 0.175); ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      // Al final todo queda gris oscuro
      const gris = Math.max(0, (t - 0.55) / 0.45)
      if (gris > 0) { ctx.fillStyle = `rgba(38,38,38,${Math.min(1, gris * gris * 1.1)})`; ctx.fillRect(0, 0, W, H) }
      if (t < 1) requestAnimationFrame(cuadro)
    }
    requestAnimationFrame(cuadro)
  }

  /** «No cumplí»: primero «¿Seguro?», después la caída. */
  async function noCumpli({ fecha = null, prueba = false } = {}) {
    let xp = 20
    try { xp = (await SEK.api('/api/desafios')).xpCaida } catch (e) { /* queda 20 */ }
    const d = capa('dz-confirmar', `
      <div class="dz-titulo">¿Seguro?</div>
      <p class="dz-texto">${xp > 0 ? `Perdés ${xp} XP y queda la marca.` : 'Queda la marca.'} El día sigue: no se reinicia nada.</p>
      <div class="dz-botones"><button type="button" class="principal dz-si">Sí, caí</button><button type="button" class="dz-no">Volver</button></div>`)
    const si = await new Promise((fin) => { d.querySelector('.dz-si').onclick = () => fin(true); d.querySelector('.dz-no').onclick = () => fin(false) })
    await cerrar(d)
    if (!si) return null
    return caida({ origen: 'boton', fecha, prueba })
  }

  // ---------- Tensión ----------
  const SIGUE = { 't1-mirada': 't1b-charcos', 't1b-charcos': 't3-mano', 't3-mano': 't3b-espera', 't4a-se-tira': 't4c-carga-llanura' }
  const CORTE = { 't4a-se-tira': 'tinta', 't4c-carga-llanura': 'negro', 't4b-derrota': 'negro' }

  /** La escena del tema (hojas de cuadros en un <canvas>). Devuelve 'mano', 'soltar' o 'salir'. */
  function escenaTension(t, cfg) {
    const quieto = reducido()
    const d = capa('dz-tn', `<img class="dz-tn-clip dz-tn-debajo" alt=""><canvas class="dz-tn-clip" aria-hidden="true"></canvas><div class="dz-tn-vineta" aria-hidden="true"></div>
      <button type="button" class="dz-tn-salir">Salir</button>`)
    d.setAttribute('aria-label', 'Tensión')
    const debajo = d.querySelector('.dz-tn-debajo')
    const clip = window.SEK_HOJA_CLIP(d.querySelector('canvas'))
    const archivo = (c) => ESCENAS + 'tension/' + c
    const prever = (c) => { if (!quieto && c) clip.cargar(archivo(c)).catch(() => undefined) }
    const corte = (tipo) => { const x = document.createElement('div'); x.className = 'dz-tn-corte ' + tipo; d.appendChild(x); setTimeout(() => x.remove(), 1000) }

    return new Promise((resolver) => {
      let actual = null
      let elegido = false
      const salir = (que) => { clip.parar(); d.remove(); resolver(que) }
      d.querySelector('.dz-tn-salir').onclick = () => salir('salir')

      const terminoClip = (c) => {
        if (c !== actual) return
        if (c === 't3b-espera') return
        if (c === 't4b-derrota') { corte('negro'); return setTimeout(() => salir('soltar'), 420) }
        if (c === 't4c-carga-llanura') { corte('negro'); return setTimeout(final, 380) }
        if (SIGUE[c]) ir(SIGUE[c], CORTE[c])
      }
      const ir = (c, tipo) => {
        const cambiar = () => {
          actual = c
          // Precarga lo que puede venir.
          prever(SIGUE[c])
          if (c === 't3-mano' || c === 't3b-espera') { prever('t4a-se-tira'); prever('t4b-derrota') }
          if (c === 't3b-espera') espera(); else d.querySelectorAll('.dz-tn-mano, .dz-tn-soltar').forEach((x) => x.remove())
          if (quieto) {
            debajo.src = archivo(c) + '-fin.jpg'
            if (c !== 't3b-espera') setTimeout(() => terminoClip(c), 1500)
            return
          }
          // Mientras carga, el canvas sigue con el último cuadro del clip anterior: nunca pantalla negra.
          clip.tocar(archivo(c), {
            bucle: c === 't3b-espera',
            alFin: (ok) => { if (ok) return terminoClip(c); debajo.src = archivo(c) + '-fin.jpg'; setTimeout(() => terminoClip(c), 1500) },
          })
        }
        if (!tipo) return cambiar()
        corte(tipo)
        setTimeout(cambiar, tipo === 'tinta' ? 280 : 380)
      }
      const espera = () => {
        const mano = document.createElement('button')
        mano.type = 'button'; mano.className = 'dz-tn-mano'; mano.setAttribute('aria-label', 'Darle la mano')
        mano.innerHTML = '<span class="dz-tn-aro"></span><span class="dz-tn-tocalo">Tocalo</span>'
        mano.onclick = () => { if (elegido) return; elegido = true; ir('t4a-se-tira', 'tinta') }
        const soltar = document.createElement('button')
        soltar.type = 'button'; soltar.className = 'dz-tn-soltar'; soltar.textContent = 'No le doy la mano'
        soltar.onclick = () => { if (elegido) return; elegido = true; ir('t4b-derrota') }
        d.appendChild(mano); d.appendChild(soltar)
      }
      const final = () => {
        vibrar([60, 40, 200])
        const f = document.createElement('div')
        f.className = 'dz-tn-final'; f.setAttribute('role', 'button'); f.tabIndex = 0
        f.innerHTML = `<div class="dz-kanji">${escapar(cfg.kanji)}</div>${cfg.frase ? `<div class="dz-frase">${escapar(cfg.frase)}</div>` : ''}`
        f.onclick = () => salir('mano')
        d.appendChild(f)
      }
      ir('t1-mirada')
    })
  }

  /** Versión simple (tema sin escenas): la pregunta y dos botones. */
  async function tensionSimple(cfg) {
    const d = capa('dz-tn-simple', `
      <div class="dz-kanji" aria-hidden="true">${escapar(icono('kanji-mano', '手'))}</div>
      <div class="dz-titulo">Te tienden la mano.</div>
      <p class="dz-texto">Tomarla es avanzar aunque no tengas ganas.</p>
      <div class="dz-botones"><button type="button" class="principal dz-mano">Le doy la mano</button>
      <button type="button" class="dz-enlace dz-soltar">No le doy la mano</button><button type="button" class="dz-enlace dz-salir">Salir</button></div>`)
    const que = await new Promise((fin) => {
      d.querySelector('.dz-mano').onclick = () => fin('mano')
      d.querySelector('.dz-soltar').onclick = () => fin('soltar')
      d.querySelector('.dz-salir').onclick = () => fin('salir')
    })
    if (que !== 'mano') { await cerrar(d); return que }
    d.innerHTML = `<div class="dz-kanji">${escapar(cfg.kanji)}</div>${cfg.frase ? `<div class="dz-frase frase">${escapar(cfg.frase)}</div>` : ''}`
    SEK.evento('logro', { elemento: d.querySelector('.dz-kanji') })
    vibrar([60, 40, 200])
    await new Promise((fin) => { d.onclick = fin; setTimeout(fin, 4000) })
    await cerrar(d, true)
    return 'mano'
  }

  /** Tensión: la frase, la escena (¿le das la mano?) y después el duelo (mano) o la caída (no). */
  async function tension({ prueba = false } = {}) {
    let cfg = { kanji: '進', frase: 'Avanzá igual.' }
    try { cfg = (await SEK.api('/api/desafios')).config.tension } catch (e) { /* lo de siempre */ }
    await frase()
    const t = await tema()
    const conEscenas = !!(t && t.escena && t.escena('tension/t1-mirada'))
    if (conEscenas) await hojaClip()
    const que = conEscenas ? await escenaTension(t, cfg) : await tensionSimple(cfg)
    if (que === 'mano') return duelo('tension', { prueba })
    if (que === 'soltar') return caida({ origen: 'tension', prueba })
    return null
  }

  // ---------- Para Hoy ----------
  /** Pone «進 Tensión» (si está prendida) y «No cumplí» en un contenedor (la cabecera de Hoy). */
  async function botones(contenedor, { fecha = null } = {}) {
    let cfg = { activa: true, kanji: '進' }
    try { cfg = (await SEK.api('/api/desafios')).config.tension } catch (e) { /* lo de siempre */ }
    const caja = document.createElement('div')
    caja.className = 'dz-botones-hoy'
    if (cfg.activa) {
      const t = document.createElement('button')
      t.type = 'button'; t.innerHTML = `<span class="kanji" aria-hidden="true">${escapar(cfg.kanji || '進')}</span>Tensión`
      t.onclick = SEK.seguro(() => tension())
      caja.appendChild(t)
    }
    const n = document.createElement('button')
    n.type = 'button'; n.className = 'rojo'; n.textContent = 'No cumplí'; n.setAttribute('aria-label', 'No cumplí mi palabra')
    n.onclick = SEK.seguro(() => noCumpli({ fecha }))
    caja.appendChild(n)
    contenedor.appendChild(caja)
    return caja
  }

  let mirando = false
  /** Anota la última vez a la vista cuando la pantalla se oculta o se cierra (para el Tajo). */
  function mirarVisibilidad() {
    if (mirando) return
    mirando = true
    const anotar = () => { try { if (navigator.sendBeacon) navigator.sendBeacon('/api/desafios/vista'); else SEK.api('/api/desafios/vista', {}).catch(() => undefined) } catch (e) { /* nunca rompe */ } }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') anotar() })
    addEventListener('pagehide', anotar)
  }

  /** Al llegar a Hoy: la frase una vez por día. */
  async function llegada(estado = {}) {
    mirarVisibilidad()
    const r = await SEK.api('/api/desafios/llegada', {
      pilarPendiente: !!estado.pilarPendiente, pasoDejoCelu: !!estado.pasoDejoCelu, modoSueno: !!estado.modoSueno,
    })
    if (r.frase) await frase({ dia: true })
    // El Tajo ya no sale adentro de SEK (Navil, 25/11): lo abre Android encima de la app donde te pasaste (Más → Apps que te atrapan).
    return r
  }

  SEK.desafios = { llegada, botones, tension, noCumpli, caida, duelo, frase, tajo }
})()
