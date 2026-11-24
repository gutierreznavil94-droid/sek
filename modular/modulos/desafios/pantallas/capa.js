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

  // ---------- Duelo de flexiones ----------
  /** Pide las flexiones de la serie rápida (la serie; después de «No cumplí», la serie más la mitad) y las anota como una serie hecha. */
  async function duelo(motivo, { prueba = false } = {}) {
    const c = await SEK.api('/api/desafios/duelo/' + encodeURIComponent(motivo))
    const nombre = c.nombre || 'Flexiones'
    const d = capa('dz-duelo', `
      <div class="dz-titulo">${escapar(icono('kanji-fuerza', '力'))} ${escapar(nombre)}</div>
      <p class="dz-texto">${motivo === 'caida' ? 'Nuevo round: la serie más la mitad.' : motivo === 'tension' ? 'Avanzá igual: una serie.' : 'Una serie.'} Tocá el círculo con cada una.</p>
      <div class="dz-cuenta" aria-live="polite"><span class="dz-hechas">0</span><small> / ${c.reps}</small></div>
      <button type="button" class="dz-golpe" aria-label="Una más">${escapar(icono('kanji-golpe', '撃'))}</button>
      <div class="dz-botones">
        <button type="button" class="principal dz-listo">Listo, hice las ${c.reps}</button>
        <button type="button" class="dz-enlace dz-ahora-no">Ahora no</button>
      </div>`)
    let hechas = 0
    let terminado = false
    const resultado = await new Promise((fin) => {
      const terminar = async () => {
        if (terminado) return
        terminado = true
        d.classList.add('tajo')
        SEK.evento('pelear', { elemento: d.querySelector('.dz-golpe') })
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
    if (!prueba) r = await SEK.api(desdeTension ? '/api/desafios/tension/soltar' : '/api/desafios/no-cumpli', desdeTension ? {} : { fecha })
    const xp = r ? r.caida.xp : 0
    const t = await tema()
    const esc = t && t.escena ? t.escena('caida/t6-tumba-regreso') : null
    const d = capa('dz-caida', `
      ${esc && !reducido() ? `<video class="dz-caida-video" src="${escapar(esc.video)}" poster="${escapar(esc.inicio)}" autoplay muted playsinline></video>` : ''}
      <div class="dz-kanji" aria-hidden="true">${escapar(icono('icono-caida', '墓'))}</div>
      <div class="dz-titulo">${desdeTension ? 'No le diste la mano.' : 'Caíste.'}</div>
      ${xp > 0 ? `<div class="dz-xp-menos">−${xp} XP</div>` : ''}
      <p class="dz-texto">Queda la marca. El día sigue: nuevo round.</p>
      <div class="dz-botones"><button type="button" class="principal dz-levantarme">Levantarme</button></div>`)
    SEK.evento('xp-perdida', { elemento: d.querySelector('.dz-kanji') })
    vibrar([80, 60, 80])
    await new Promise((fin) => { d.querySelector('.dz-levantarme').onclick = fin })
    await cerrar(d, true)
    await duelo(desdeTension ? 'tension' : 'caida', { prueba })
    if (r) {
      aviso(xp > 0 ? `Caída anotada · −${xp} XP` : 'Caída anotada', {
        texto: 'Deshacer',
        fn: SEK.seguro(async () => { await SEK.api('/api/desafios/caidas/' + encodeURIComponent(r.caida.id), undefined, 'DELETE'); SEK.mensaje('Caída deshecha: volvió la XP') }),
      }, 10000)
    }
    return r
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

  /** La escena en video del tema. Devuelve 'mano', 'soltar' o 'salir'. */
  function escenaTension(t, cfg) {
    const quieto = reducido()
    const d = capa('dz-tn', `<img class="dz-tn-clip dz-tn-debajo" alt=""><div class="dz-tn-vineta" aria-hidden="true"></div>
      <button type="button" class="dz-tn-salir">Salir</button>`)
    d.setAttribute('aria-label', 'Tensión')
    const debajo = d.querySelector('.dz-tn-debajo')
    const videos = {}
    const archivo = (c) => t.escena('tension/' + c)
    const prever = (c) => {
      if (quieto || !c || videos[c]) return
      const v = document.createElement('video')
      v.className = 'dz-tn-clip oculto'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = archivo(c).video
      if (c === 't3b-espera') v.loop = true
      d.insertBefore(v, d.querySelector('.dz-tn-vineta'))
      videos[c] = v
    }
    const corte = (tipo) => { const x = document.createElement('div'); x.className = 'dz-tn-corte ' + tipo; d.appendChild(x); setTimeout(() => x.remove(), 1000) }

    return new Promise((resolver) => {
      let actual = null
      let elegido = false
      const salir = (que) => { d.remove(); resolver(que) }
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
          if (actual) debajo.src = archivo(actual).fin // el último cuadro queda debajo: nunca pantalla negra
          actual = c
          for (const [k, v] of Object.entries(videos)) if (k !== c) { v.classList.add('oculto'); v.pause() }
          // Precarga lo que puede venir.
          prever(SIGUE[c])
          if (c === 't3-mano' || c === 't3b-espera') { prever('t4a-se-tira'); prever('t4b-derrota') }
          if (c === 't3b-espera') espera(); else d.querySelectorAll('.dz-tn-mano, .dz-tn-soltar').forEach((x) => x.remove())
          if (quieto) {
            debajo.src = archivo(c).fin
            if (c !== 't3b-espera') setTimeout(() => terminoClip(c), 1500)
            return
          }
          prever(c)
          const v = videos[c]
          v.onended = () => terminoClip(c)
          v.onerror = () => { debajo.src = archivo(c).fin; setTimeout(() => terminoClip(c), 1500) }
          v.classList.remove('oculto')
          try { v.currentTime = 0 } catch (e) { /* sin datos todavía */ }
          const p = v.play(); if (p && p.catch) p.catch(() => undefined)
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

  /** Al llegar a Hoy: la frase una vez por día y el Tajo si volviste después de horas con un pilar pendiente. */
  async function llegada(estado = {}) {
    mirarVisibilidad()
    const r = await SEK.api('/api/desafios/llegada', {
      pilarPendiente: !!estado.pilarPendiente, pasoDejoCelu: !!estado.pasoDejoCelu, modoSueno: !!estado.modoSueno,
    })
    if (r.frase) await frase({ dia: true })
    if (r.tajo) await tajo()
    return r
  }

  SEK.desafios = { llegada, botones, tension, noCumpli, caida, duelo, frase, tajo }
})()
