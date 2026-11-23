/*
 * El compañero del tema (igual que Companero.tsx + companero/rutina.ts de la v0.88.27): el shinobi chiquito que
 * camina por el borde de abajo de Hoy y queda quieto en una esquina en Calendario, Comida y Más.
 * Vive en temas porque aparece en varias pantallas y sus dibujos son del tema (tema.json → medios.sprite).
 * En Hoy tiene una rutina: camina, corre, trepa a botones y tarjetas, se sienta, cae y rueda, voltereta, se estira,
 * alerta. Tocarlo: se frena y habla con un globo a pincel que lo sigue. Otro toque lo cierra.
 *
 *   SEK_COMPANERO({ lugar: 'pasea' | 'esquina' })
 *   Para probar desde la consola: __companero('saltar'), __companero('voltereta')…
 */
(function () {
  'use strict'
  const MARGEN = 10
  const GLOBO_MS = 6000
  const ANCHO_GLOBO = 220
  const ALTO_PUNTA = 420
  const ESCALONES = 'main .pilar-bloque, main .pilar-tarjeta, main .co-tarjeta, main .agua-tarjeta, main .boton, main .contador-boton, main .tarjeta'
  const HOJA_BASE = {
    celda: [48, 35], columnas: 16, filas: 13,
    clips: { caminar: { desde: 0, n: 48, fps: 33.6 }, frenar: { desde: 48, n: 55, fps: 33.6 }, quieto: { desde: 103, n: 105, fps: 12 } },
    pasoCuadro: 0.3348, frenoAvance: 5.8,
  }
  const FRASES_DEFECTO = ['Un paso hoy vale más que diez mañana.', 'Ya estás acá: eso ya es entrenar.', 'La lluvia no para y vos tampoco.']

  // ---------- La rutina (rutina.ts) ----------
  const CLIP_DE = {
    quieto: ['quieto', 'quieto'], caminar: ['caminar', 'caminar'], correr: ['correr', 'caminar'], saltar: ['saltar', 'caminar'],
    enEscalon: ['quieto', 'quieto'], sentado: ['sentado', 'quieto'], caerRodar: ['caerRodar', 'caminar'], voltereta: ['voltereta', 'caminar'],
    estirarse: ['estirarse', 'quieto'], alerta: ['alerta', 'quieto'], saltoGiro: ['saltoGiro', 'quieto'],
  }
  const PREFERIDO = { saltar: 'trepa' }
  function clipPara(hoja, m) {
    const p = PREFERIDO[m]
    if (p && hoja.clips[p]) return { nombre: p, clip: hoja.clips[p], propio: true }
    const [clip, sino] = CLIP_DE[m]
    if (hoja.clips[clip]) return { nombre: clip, clip: hoja.clips[clip], propio: true }
    return { nombre: sino, clip: hoja.clips[sino] || HOJA_BASE.clips[sino], propio: clip === sino }
  }
  const PESOS = { quieto: 30, caminar: 30, correr: 8, saltar: 10, sentado: 6, voltereta: 3, estirarse: 5, alerta: 2 }
  function sortear(opciones) {
    const total = opciones.reduce((s, o) => s + o[1], 0)
    let r = Math.random() * total
    for (const [m, p] of opciones) { r -= p; if (r < 0) return m }
    return opciones[opciones.length - 1][0]
  }
  function elegirMovimiento(c) {
    if (c.enEscalon) return sortear([['enEscalon', 30], ['sentado', 25], ['caerRodar', 35], ['estirarse', 8], ['alerta', 4]].filter(([m]) => m !== c.anterior || m === 'enEscalon'))
    return sortear(Object.keys(PESOS).filter((m) => m !== 'saltar' || c.hayEscalon).filter((m) => m === 'quieto' || m === 'caminar' || m !== c.anterior).map((m) => [m, PESOS[m]]))
  }
  const DURACION = { quieto: [2, 6], enEscalon: [2, 5], sentado: [4, 9], estirarse: [1.6, 2.4], alerta: [1.2, 1.8], voltereta: [0.7, 0.7], saltoGiro: [0.7, 0.7] }
  const duracionDe = (m) => { const d = DURACION[m] || [1, 1]; return d[0] + Math.random() * (d[1] - d[0]) }
  const SALTO = { altoMin: 18, altoMax: 175, alcance: 170, duracion: 0.62 }
  function escalonCercano(lista, x, anchoCuerpo) {
    let mejor = null, dist = Infinity
    for (const e of lista) {
      if (e.alto < SALTO.altoMin || e.alto > SALTO.altoMax || e.der - e.izq < anchoCuerpo + 8) continue
      const d = Math.abs(Math.max(e.izq, Math.min(e.der - anchoCuerpo, x)) - x)
      if (d > SALTO.alcance) continue
      if (d < dist) { dist = d; mejor = e }
    }
    return mejor
  }
  const apoyoEn = (e, x, anchoCuerpo) => Math.max(e.izq, Math.min(e.der - anchoCuerpo, x))
  function arcoSalto(t, y0, y1) { const k = Math.max(0, Math.min(1, t)); const extra = Math.max(24, (y1 - y0) * 0.35); return y0 + (y1 - y0) * k + extra * 4 * k * (1 - k) }
  function caida(t, y0) { const k = Math.max(0, Math.min(1, t)); return y0 * (1 - k * k) }

  // ---------- Qué dice (services/companero.ts, lo esencial) ----------
  const hoyTexto = () => new Date().toLocaleDateString('en-CA')
  function estado() {
    try { const x = JSON.parse(localStorage.getItem('sek-companero') || 'null'); if (x && x.fecha === hoyTexto()) return x } catch (e) { /* sin almacenamiento */ }
    return { fecha: hoyTexto(), consejos: [], frases: [], hablo: false }
  }
  const guardar = (e) => { try { localStorage.setItem('sek-companero', JSON.stringify(e)) } catch (x) { /* sin almacenamiento */ } }
  function frases() { const t = window.SEK && SEK.tema && SEK.tema.actual; const f = (t && t.frases) || []; return f.length ? f : FRASES_DEFECTO }
  function fraseSuelta(usadas) {
    const f = frases()
    let libres = f.map((_, i) => i).filter((i) => !usadas.includes(i))
    if (!libres.length) libres = f.map((_, i) => i)
    const indice = libres[Math.floor(Math.random() * libres.length)]
    return { indice, texto: f[indice] }
  }
  const minutos = (h) => { const [a, b] = String(h).split(':').map(Number); return a * 60 + b }
  /** Lo del día que usan los consejos. /api/dia/hoy es el pedido más pesado: se recuerda 2 min entre pantallas. */
  async function diaDeHoy() {
    try { const x = JSON.parse(sessionStorage.getItem('sek-companero-dia') || 'null'); if (x && Date.now() - x.t < 120000) return x.d } catch (e) { /* sin almacenamiento */ }
    const h = await SEK.api('/api/dia/hoy')
    const d = { racha: h.racha, aplican: h.aplican, cumplidos: h.cumplidos, pilares: (h.pilares || []).map((p) => ({ compromiso: p.compromiso && { estado: p.compromiso.estado }, horaLimite: p.horaLimite, accion: p.accion && { id: p.accion.id, nombre: p.accion.nombre, tipo: p.accion.tipo, horaLimiteInicio: p.accion.horaLimiteInicio } })) }
    try { sessionStorage.setItem('sek-companero-dia', JSON.stringify({ t: Date.now(), d })) } catch (e) { /* sin almacenamiento */ }
    return d
  }
  async function consejos() {
    let d
    try { d = await diaDeHoy() } catch (e) { return [] }
    const r = []
    const ahora = new Date()
    const min = ahora.getHours() * 60 + ahora.getMinutes()
    for (const p of d.pilares || []) {
      if (!p.compromiso || p.compromiso.estado !== 'pendiente') continue
      const ent = p.accion.tipo === 'entrenamiento'
      const lim = ent ? p.accion.horaLimiteInicio || p.horaLimite : p.horaLimite
      if (!lim) continue
      const faltan = minutos(lim) - min
      if (faltan >= 0 && faltan <= 30) r.push({ clave: `pilar:${p.accion.id}`, texto: `${p.accion.nombre} empieza hasta las ${lim}. Arranquemos.`, accion: ent ? { etiqueta: 'Empezar', ruta: '/entreno/sesion' } : null })
    }
    if (d.racha >= 3) r.push({ clave: 'racha', texto: `${d.racha} días seguidos. No lo cortes hoy.` })
    if (d.aplican > 0 && d.cumplidos === d.aplican) r.push({ clave: 'completo', texto: 'Día completo. Mañana seguimos.' })
    return r
  }

  async function iniciar({ lugar = 'pasea' } = {}) {
    // tema.js puede terminar de cargar después: se espera hasta 5 s a que esté y a que traiga el tema
    for (let i = 0; i < 50 && !(window.SEK && SEK.tema && SEK.tema.listo); i++) await new Promise((r) => setTimeout(r, 100))
    if (window.SEK && SEK.tema && SEK.tema.listo) { try { await SEK.tema.listo } catch (e) { /* sigue */ } }
    const sprite = window.SEK && SEK.tema && SEK.tema.medio && SEK.tema.medio('sprite')
    if (!sprite) return // tema sin hoja de sprites: no hay compañero
    try { if (localStorage.getItem('companero-dormido')) return } catch (e) { /* sigue */ }
    let hoja = HOJA_BASE
    try { const r = await fetch(sprite.replace(/\.webp$/, '.json')); if (r.ok) { const h = await r.json(); if (h && h.clips && h.celda) hoja = h } } catch (e) { /* hoja base */ }
    const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const [W, H] = hoja.celda

    const raiz = document.createElement('div')
    raiz.className = 'companero'
    raiz.innerHTML = `
      <svg class="companero-filtro" width="0" height="0" aria-hidden="true"><filter id="globo-pincel" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="ruido"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="ruido" scale="2.6" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></svg>
      <div class="companero-caja" style="width: ${W}px; height: ${H}px;">
        <button type="button" class="companero-boton" style="width: ${W}px; height: ${H}px;" aria-label="Tocar al compañero">
          <div class="shinobi-capa" style="background-image: url(${sprite}); background-size: ${hoja.columnas * W}px ${hoja.filas * H}px; width: ${W}px; height: ${H}px;"></div>
        </button>
      </div>`
    ;(document.querySelector('.app') || document.body).appendChild(raiz)
    const el = raiz.querySelector('.companero-caja')
    const c = raiz.querySelector('.shinobi-capa')
    const boton = raiz.querySelector('.companero-boton')

    // ---- El globo ----
    let globoEl = null, puntaSvg = null, punta = null, timerGlobo = 0, hablando = false
    const globoPos = { x: MARGEN, y: 0 }
    function callar() {
      if (!globoEl) return
      clearTimeout(timerGlobo)
      const g = globoEl, p = puntaSvg
      g.classList.add('saliendo'); p.classList.add('saliendo')
      globoEl = null; punta = null; puntaSvg = null
      boton.setAttribute('aria-label', 'Tocar al compañero')
      setTimeout(() => { g.remove(); p.remove(); hablando = false; pasea = calcularPasea(); if (pasea && dur === Infinity) siguiente() }, 260)
    }
    function decir(texto, accion) {
      if (globoEl) { globoEl.remove(); puntaSvg.remove() }
      hablando = true
      pasea = false
      if (mov !== 'saltar' && mov !== 'caerRodar' && mov !== 'caminar' && mov !== 'correr') { quedarse(escalon ? 'enEscalon' : 'quieto'); dur = Infinity }
      puntaSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      puntaSvg.setAttribute('class', 'companero-punta'); puntaSvg.setAttribute('width', '100%'); puntaSvg.setAttribute('height', String(ALTO_PUNTA))
      punta = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      puntaSvg.appendChild(punta)
      globoEl = document.createElement('div')
      globoEl.className = 'companero-globo'
      globoEl.setAttribute('role', 'status')
      globoEl.style.width = ANCHO_GLOBO + 'px'
      globoEl.innerHTML = '<span></span>'
      globoEl.querySelector('span').textContent = texto
      if (accion) {
        const b = document.createElement('button')
        b.type = 'button'; b.className = 'boton chico primario'; b.textContent = accion.etiqueta
        b.onclick = (e) => { e.stopPropagation(); callar(); location.href = accion.ruta }
        globoEl.appendChild(b)
      }
      globoEl.onclick = callar
      globoEl.style.transform = `translate(${globoPos.x}px, ${-globoPos.y}px)`
      raiz.insertBefore(puntaSvg, el); raiz.insertBefore(globoEl, el)
      boton.setAttribute('aria-label', 'Cerrar lo que dice el compañero')
      timerGlobo = setTimeout(callar, GLOBO_MS)
    }
    async function tocar() {
      if (globoEl) return callar()
      const lista = await consejos()
      if (lista[0]) return decir(lista[0].texto, lista[0].accion)
      const e = estado()
      const f = fraseSuelta(e.frases)
      guardar({ ...e, frases: [...e.frases, f.indice] })
      decir(f.texto)
    }
    boton.onclick = tocar
    // Habla solo una vez por día al abrir (o un consejo nuevo), si no hay un Tajo en pantalla.
    const cuandoLibre = (fn, ms) => { const intentar = () => { if (document.querySelector('.tajo, .dz-capa')) return setTimeout(intentar, 5000); fn() }; setTimeout(intentar, ms) }
    // Espera a que la pantalla termine sus propios pedidos: el compañero no tiene apuro.
    new Promise((ok) => setTimeout(ok, 2500)).then(consejos).then((lista) => {
      const e = estado()
      if (e.consejos.length < 3) {
        const c1 = lista.find((x) => !e.consejos.includes(x.clave))
        if (c1) { guardar({ ...e, consejos: [...e.consejos, c1.clave], hablo: true }); return cuandoLibre(() => decir(c1.texto, c1.accion), 1200) }
      }
      if (!e.hablo) { const f = fraseSuelta(e.frases); guardar({ ...e, frases: [...e.frases, f.indice], hablo: true }); cuandoLibre(() => decir(f.texto), 1500) }
    })

    // ---- El bucle ----
    const ancho = () => Math.max(120, raiz.clientWidth || window.innerWidth)
    const b = { x: MARGEN, y: 0, dir: 1 }
    if (lugar === 'esquina') b.x = ancho() - W - MARGEN
    const calcularPasea = () => lugar === 'pasea' && !reducido && !hablando
    let pasea = calcularPasea()
    let mov = 'quieto', anterior = 'quieto', f = 0, t = 0, dur = 1.5 + Math.random() * 2, objetivo = 0
    let salto = { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 0 } }
    let escalon = null, giro = 0, id = 0, antes = performance.now()

    const pintar = (nombre, cuadro, unaVez) => {
      const clip = hoja.clips[nombre] || HOJA_BASE.clips.quieto
      const n = unaVez ? Math.min(clip.n - 1, Math.floor(cuadro)) : Math.floor(cuadro) % clip.n
      const i = clip.desde + Math.max(0, n)
      c.style.backgroundPosition = `${-(i % hoja.columnas) * W}px ${-Math.floor(i / hoja.columnas) * H}px`
    }
    const escalones = () => {
      const base = raiz.getBoundingClientRect()
      const lista = []
      for (const e of document.querySelectorAll(ESCALONES)) {
        const r = e.getBoundingClientRect()
        if (r.width < 20 || r.top < 0) continue
        lista.push({ izq: r.left - base.left, der: r.right - base.left, alto: base.bottom - r.top, el: e })
      }
      return lista
    }
    const altoDe = (e) => raiz.getBoundingClientRect().bottom - e.el.getBoundingClientRect().top
    function quedarse(m) { mov = m; t = 0; f = 0; dur = duracionDe(m) }
    const caminarHasta = (m, minDist) => {
      const min = MARGEN, max = ancho() - W - MARGEN
      let destino = min + Math.random() * (max - min)
      if (Math.abs(destino - b.x) < minDist) destino = b.x < (min + max) / 2 ? max : min
      objetivo = destino
      b.dir = destino > b.x ? 1 : -1
      mov = m; f = 0; t = 0
    }
    const bajar = () => {
      salto = { desde: { x: b.x, y: b.y }, hasta: { x: b.x, y: 0 } }
      escalon = null
      b.dir = b.x < ancho() / 2 ? 1 : -1
      mov = 'caerRodar'; t = 0; f = 0; giro = 0
    }
    function siguiente() {
      if (mov !== 'frenar') anterior = mov
      if (!pasea) { quedarse(escalon ? 'enEscalon' : 'quieto'); dur = Infinity; return }
      const cerca = escalonCercano(escalones(), b.x, W)
      const m = elegirMovimiento({ enEscalon: escalon !== null, hayEscalon: cerca !== null, anterior })
      if (m === 'caminar') return caminarHasta('caminar', 60)
      if (m === 'correr') return caminarHasta('correr', 140)
      if (m === 'saltar' && cerca) {
        const x1 = apoyoEn(cerca, b.x, W)
        salto = { desde: { x: b.x, y: b.y }, hasta: { x: x1, y: cerca.alto } }
        escalon = cerca
        if (Math.abs(x1 - b.x) > 4) b.dir = x1 > b.x ? 1 : -1
        mov = 'saltar'; t = 0; f = 0
        return
      }
      if (m === 'caerRodar') return bajar()
      giro = 0
      quedarse(m)
    }
    const ubicar = () => {
      const cp = mov !== 'frenar' ? clipPara(hoja, mov) : null
      const baja = cp && cp.propio ? cp.clip.bajar || 0 : 0
      el.style.transform = `translate(${b.x}px, ${-(b.y - baja)}px)`
      c.style.transform = `${b.dir < 0 ? 'scaleX(-1) ' : ''}${giro ? `rotate(${giro}deg)` : ''}`
    }
    const llevarGlobo = (dt) => {
      if (!globoEl) return
      const w = ancho()
      const gx1 = Math.max(8, Math.min(w - ANCHO_GLOBO - 8, b.x + W / 2 - ANCHO_GLOBO / 2))
      const gy1 = b.y + H + 30
      const k = 1 - Math.exp(-dt / 0.12)
      globoPos.x += (gx1 - globoPos.x) * k
      globoPos.y += (gy1 - globoPos.y) * k
      globoEl.style.transform = `translate(${globoPos.x}px, ${-globoPos.y}px)`
      if (!punta) return
      const cabezaX = b.x + W / 2 + b.dir * 2
      const cabezaY = b.y + H - 6
      const baseX = Math.max(globoPos.x + 22, Math.min(globoPos.x + ANCHO_GLOBO - 22, cabezaX))
      const baseY = globoPos.y - 1.5
      const Y = (y) => ALTO_PUNTA - y
      const lado = cabezaX < baseX ? -1 : 1
      punta.setAttribute('d', `M ${baseX - 10} ${Y(baseY)} Q ${baseX - 8 + lado * 9} ${Y((baseY + cabezaY) / 2 + 4)} ${cabezaX} ${Y(cabezaY)} Q ${baseX + 9 + lado * 9} ${Y((baseY + cabezaY) / 2 - 2)} ${baseX + 10} ${Y(baseY)} Z`)
    }

    const cuadro = (ahora) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000)
      antes = ahora
      if (mov === 'quieto' || mov === 'enEscalon' || mov === 'sentado' || mov === 'estirarse' || mov === 'alerta') {
        t += dt
        const { nombre, clip, propio } = clipPara(hoja, mov)
        const unaVez = clip.unaVez != null ? clip.unaVez : propio && (mov === 'estirarse' || mov === 'alerta')
        pintar(nombre, reducido ? 0 : t * (clip.fps || 12), unaVez)
        if (propio && clip.unaVez && dur !== Infinity && dur < clip.n / (clip.fps || 12) + 1) dur = clip.n / (clip.fps || 12) + 1
        if (escalon) { const alto = altoDe(escalon); if (alto < SALTO.altoMin || alto > SALTO.altoMax) bajar(); else b.y = alto }
        if (t > dur) siguiente()
      } else if (mov === 'caminar' || mov === 'correr') {
        const { nombre, clip } = clipPara(hoja, mov)
        const fps = clip.fps || 33.6
        const vel = mov === 'correr' ? (clipPara(hoja, 'correr').propio ? 3.2 : 2.1) : 1
        f += dt * fps * vel
        b.x += b.dir * hoja.pasoCuadro * dt * fps * vel
        pintar(nombre, f)
        if (!pasea || (b.dir > 0 ? b.x >= objetivo - hoja.frenoAvance : b.x <= objetivo + hoja.frenoAvance)) { mov = 'frenar'; f = 0 }
      } else if (mov === 'frenar') {
        const clip = hoja.clips.frenar
        f += dt * (clip.fps || 33.6)
        pintar('frenar', f, true)
        if (f >= clip.n) { b.x += b.dir * hoja.frenoAvance; quedarse('quieto'); siguiente() }
      } else if (mov === 'saltar') {
        t += dt
        const { nombre, clip, propio } = clipPara(hoja, 'saltar')
        const total = propio ? clip.n / (clip.fps || 24) : SALTO.duracion
        const k = Math.min(1, t / total)
        const [a0, a1] = propio && clip.aire ? clip.aire : [0, 1]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        b.x = salto.desde.x + (salto.hasta.x - salto.desde.x) * kk
        b.y = arcoSalto(kk, salto.desde.y, salto.hasta.y)
        pintar(nombre, propio ? k * clip.n : 0, propio)
        if (k >= 1) { b.x = salto.hasta.x; b.y = salto.hasta.y; quedarse('enEscalon'); if (!pasea) dur = Infinity }
      } else if (mov === 'caerRodar' && clipPara(hoja, 'caerRodar').propio) {
        t += dt
        const { nombre, clip } = clipPara(hoja, 'caerRodar')
        const k = Math.min(1, t / (clip.n / (clip.fps || 24)))
        const [a0, a1] = clip.aire || [0, 0.3]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        b.y = caida(kk, salto.desde.y)
        if (k > a0 && k < a1) b.x = Math.max(MARGEN, Math.min(ancho() - W - MARGEN, b.x + b.dir * 24 * dt))
        pintar(nombre, k * clip.n, true)
        if (k >= 1) { b.y = 0; quedarse('quieto'); if (!pasea) dur = Infinity }
      } else if (mov === 'caerRodar') {
        t += dt
        if (t < 0.42) { b.y = caida(t / 0.42, salto.desde.y); b.x += b.dir * 30 * dt; pintar('caminar', 0) }
        else if (t < 0.95) { b.y = 0; b.x = Math.max(MARGEN, Math.min(ancho() - W - MARGEN, b.x + b.dir * 110 * dt)); giro = b.dir * ((t - 0.42) / 0.53) * 360; pintar('caminar', f += dt * 40) }
        else { giro = 0; b.y = 0; quedarse('quieto') }
      } else if (mov === 'voltereta' || mov === 'saltoGiro') {
        t += dt
        const { nombre, clip, propio } = clipPara(hoja, mov)
        const total = propio ? clip.n / (clip.fps || 24) : 0.7
        const k = Math.min(1, t / total)
        const [a0, a1] = propio && clip.aire ? clip.aire : [0, 1]
        const kk = Math.max(0, Math.min(1, (k - a0) / (a1 - a0)))
        const y0 = escalon ? altoDe(escalon) : 0
        b.y = kk > 0 && kk < 1 ? arcoSalto(kk, y0, y0) : y0
        if (mov === 'voltereta' && kk > 0 && kk < 1) b.x = Math.max(MARGEN, Math.min(ancho() - W - MARGEN, b.x - b.dir * 40 * dt))
        if (!propio) giro = (mov === 'voltereta' ? -b.dir : b.dir) * k * 360
        pintar(nombre, propio ? k * clip.n : 0, propio)
        if (k >= 1) { giro = 0; b.y = y0; quedarse(escalon ? 'enEscalon' : 'quieto') }
      }
      ubicar()
      llevarGlobo(dt)
      id = requestAnimationFrame(cuadro)
    }
    const arrancar = () => { cancelAnimationFrame(id); antes = performance.now(); id = requestAnimationFrame(cuadro) }
    window.__companero = (m) => {
      if (m === 'saltar') { const e = escalonCercano(escalones(), b.x, W); if (!e) return; const x1 = apoyoEn(e, b.x, W); salto = { desde: { x: b.x, y: b.y }, hasta: { x: x1, y: e.alto } }; escalon = e; b.dir = x1 >= b.x ? 1 : -1; mov = 'saltar'; t = 0; f = 0; return }
      if (m === 'caminar' || m === 'correr') return caminarHasta(m, m === 'correr' ? 140 : 60)
      if (m === 'caerRodar') return bajar()
      giro = 0; quedarse(m)
    }
    // Festejos del tema: completar → salto con giro; logro → voltereta; alerta → desenvaina.
    const GESTO = { completar: 'saltoGiro', logro: 'voltereta', alerta: 'alerta', aparecer: 'alerta' }
    document.addEventListener('sek-evento', (ev) => {
      const m = GESTO[ev.detail && ev.detail.nombre]
      if (!m || reducido || mov === 'saltar' || mov === 'caerRodar') return
      giro = 0
      quedarse(m)
      if (!pasea) dur = Math.max(dur, 2.5)
    })
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? arrancar() : cancelAnimationFrame(id)))
    if (!pasea) { quedarse('quieto'); dur = Infinity }
    ubicar()
    arrancar()
  }

  window.SEK_COMPANERO = iniciar
})()
