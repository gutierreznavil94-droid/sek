/*
 * Lluvia de fondo del tema Shinobi, dibujada (canvas, sin video, poco gasto). La carga tema.js si la persona no la apagó.
 * Traída (más corta) de src/ui/FondoLluvia.tsx de la app vieja:
 * - Atrás de todo: lluvia fina en dos capas, en diagonal según la pantalla; nubes a tinta arriba en Hoy;
 *   neblina lenta; un relámpago muy tenue cada 20–40 s que deja ver la silueta de montañas.
 * - Adelante (encima de las tarjetas, sin tomar toques): gotas cercanas, grandes y desenfocadas; el charquito
 *   donde tocás; y cada 45–90 s un rayo (más tenue de 19 a 7 h, para no encandilar).
 * - Intensidad (Más → Tema): llovizna (menos gotas, sin rayo), lluvia, tormenta (más gotas, rayo más seguido).
 * - Con «reducir movimiento» del teléfono queda quieta. Si el celu va lento, baja la cantidad de gotas sola.
 * - Una página puede pedir sin lluvia con <body data-sin-lluvia>.
 * Ofrece SEK.lluvia: { prender(intensidad), apagar() }.
 */
(function () {
  'use strict'
  const COLOR = '236, 234, 229'
  const INTENSIDAD = {
    llovizna: { gotas: 0.5, cerca: 0, rayo: null, relampago: [30000, 60000] },
    lluvia: { gotas: 1, cerca: 1, rayo: [45000, 90000], relampago: [20000, 40000] },
    tormenta: { gotas: 1.45, cerca: 1.8, rayo: [25000, 50000], relampago: [12000, 25000] },
  }
  /** Cómo llueve en cada pantalla (por la dirección). Lo que no está, como en Más. */
  const PERFIL = {
    hoy: { vel: [150, 85], largo: [30, 16], alfa: [0.55, 0.28], area: 6500, diagonal: 0.22, nubes: true },
    juego: { vel: [80, 48], largo: [18, 11], alfa: [0.46, 0.24], area: 12000, diagonal: 0.04 },
    entreno: { vel: [270, 175], largo: [40, 22], alfa: [0.55, 0.3], area: 5200, diagonal: 0.36 },
    calendario: { vel: [95, 58], largo: [24, 14], alfa: [0.5, 0.26], area: 7000, diagonal: 0.04 },
    mas: { vel: [125, 78], largo: [22, 13], alfa: [0.5, 0.27], area: 8000, diagonal: 0.5 },
  }
  const enRango = (r) => r[0] + Math.random() * (r[1] - r[0])
  const quieto = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  let corriendo = null

  function prender(nombreIntensidad) {
    apagar()
    const int = INTENSIDAD[nombreIntensidad] || INTENSIDAD.lluvia
    const seccion = location.pathname.split('/')[1] || 'hoy'
    const perfil = PERFIL[seccion] || PERFIL.mas
    const atrasC = document.createElement('canvas')
    const frenteC = document.createElement('canvas')
    atrasC.className = 'lluvia-fondo'
    frenteC.className = 'lluvia-frente'
    for (const c of [atrasC, frenteC]) { c.setAttribute('aria-hidden', 'true'); document.body.prepend(c) }
    document.documentElement.classList.add('con-lluvia')
    const ctx = atrasC.getContext('2d')
    const fr = frenteC.getContext('2d')
    if (!ctx || !fr) return apagar()

    let w = 0, h = 0, dpr = 1, factor = 1
    const gotas = []
    const cerca = []
    const nubes = []
    const nieblas = []
    const toques = []
    let silueta = []
    let relampago = 0
    let proximoRelampago = performance.now() + enRango(int.relampago)
    let rayo = 0
    let rayoCamino = []
    let proximoRayo = int.rayo ? performance.now() + 15000 + Math.random() * int.rayo[0] : Infinity
    let lentoAcum = 0

    const nueva = (inicial) => {
      const capa = Math.random() < 0.55 ? 0 : 1
      return {
        x: Math.random() * (w + h * Math.abs(perfil.diagonal)) - h * Math.max(0, perfil.diagonal),
        y: inicial ? Math.random() * h : -20,
        largo: perfil.largo[capa ? 0 : 1],
        vel: perfil.vel[capa ? 0 : 1] * (0.85 + Math.random() * 0.3),
        capa,
      }
    }
    const nuevaCerca = (inicial) => ({
      x: Math.random() * (w + h * Math.abs(perfil.diagonal)) - h * Math.max(0, perfil.diagonal),
      y: inicial ? Math.random() * h : -120,
      largo: 70 + Math.random() * 60, vel: 520 + Math.random() * 260, ancho: 3 + Math.random() * 3, a: 0.05 + Math.random() * 0.05,
    })

    function medir() {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      for (const [c, x] of [[atrasC, ctx], [frenteC, fr]]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); x.setTransform(dpr, 0, 0, dpr, 0, 0) }
      gotas.length = 0
      const n = Math.round((w * h / perfil.area) * 1.7 * factor * int.gotas)
      for (let i = 0; i < n; i++) gotas.push(nueva(true))
      cerca.length = 0
      for (let i = 0; i < Math.round((w / 95) * int.cerca * factor); i++) cerca.push(nuevaCerca(true))
      nubes.length = 0
      if (perfil.nubes) {
        const k = Math.max(7, Math.round(w / 55))
        for (let i = 0; i < k; i++) nubes.push({ x: (w * (i + 0.5)) / k + (Math.random() - 0.5) * 40, y: 10 + Math.random() * 90, r: 55 + Math.random() * 45, vel: 2 + Math.random() * 3, a: 0.2 + Math.random() * 0.08 })
      }
      nieblas.length = 0
      for (let i = 0; i < 3; i++) nieblas.push({ x: Math.random() * w, y: h * (0.35 + i * 0.22), r: 140 + Math.random() * 90, vel: 5 + Math.random() * 6, a: 0.05 + Math.random() * 0.03 })
      silueta = []
      for (let k = 0; k <= 10; k++) silueta.push([(w * k) / 10, h * (0.56 + Math.random() * 0.1) - (k % 4 === 2 ? h * 0.08 : 0)])
    }

    function nube(nb) {
      const aclara = Math.max(0, 1 - nb.y / (h * 0.55))
      const a = nb.a * aclara
      if (a <= 0.004) return
      const g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r * 1.5)
      g.addColorStop(0, `rgba(150, 148, 142, ${a})`)
      g.addColorStop(0.6, `rgba(120, 118, 112, ${a * 0.6})`)
      g.addColorStop(1, 'rgba(120, 118, 112, 0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(nb.x, nb.y, nb.r * 1.6, nb.r * 0.62, 0, 0, Math.PI * 2); ctx.fill()
    }

    function caminoRayo() {
      const c = []
      let x = w * (0.2 + Math.random() * 0.6)
      let y = 0
      while (y < h * 0.62) { c.push([x, y]); x += (Math.random() - 0.5) * 46; y += 18 + Math.random() * 26 }
      return [c]
    }

    function cuadro(t, dt) {
      const noche = (() => { const hr = new Date().getHours(); return hr >= 19 || hr < 7 })()
      ctx.clearRect(0, 0, w, h)
      fr.clearRect(0, 0, w, h)
      // Relámpago lejano: la pantalla se aclara apenas y se ve la silueta de las montañas.
      if (t >= proximoRelampago) { relampago = 1; proximoRelampago = t + enRango(int.relampago) }
      if (relampago > 0) {
        ctx.fillStyle = `rgba(${COLOR}, ${0.06 * relampago})`
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = `rgba(10, 10, 10, ${0.35 * relampago})`
        ctx.beginPath(); ctx.moveTo(0, h)
        for (const [x, y] of silueta) ctx.lineTo(x, y)
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
        relampago = Math.max(0, relampago - dt * 1.6)
      }
      for (const nb of nubes) { nb.x += nb.vel * dt; if (nb.x - nb.r * 1.6 > w) nb.x = -nb.r * 1.6; nube(nb) }
      for (const n of nieblas) {
        n.x += n.vel * dt
        if (n.x - n.r > w) n.x = -n.r
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        g.addColorStop(0, `rgba(${COLOR}, ${n.a})`); g.addColorStop(1, `rgba(${COLOR}, 0)`)
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r * 1.8, n.r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.lineCap = 'round'
      for (const g of gotas) {
        g.y += g.vel * dt; g.x += g.vel * dt * perfil.diagonal
        if (g.y > h + 20 || g.x > w + 60 || g.x < -60) Object.assign(g, nueva(false))
        ctx.strokeStyle = `rgba(${COLOR}, ${perfil.alfa[g.capa ? 0 : 1]})`
        ctx.lineWidth = g.capa ? 1.7 : 1.1
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - g.largo * perfil.diagonal, g.y - g.largo); ctx.stroke()
      }
      // Adelante: gotas cercanas, desenfocadas.
      fr.lineCap = 'round'
      for (const g of cerca) {
        g.y += g.vel * dt; g.x += g.vel * dt * perfil.diagonal
        if (g.y > h + 140) Object.assign(g, nuevaCerca(false))
        fr.strokeStyle = `rgba(${COLOR}, ${g.a})`
        fr.lineWidth = g.ancho
        fr.beginPath(); fr.moveTo(g.x, g.y); fr.lineTo(g.x - g.largo * perfil.diagonal, g.y - g.largo); fr.stroke()
      }
      // Charquito donde tocaste: anillo y gotitas que saltan.
      for (let i = toques.length - 1; i >= 0; i--) {
        const q = toques[i]
        q.t += dt
        const k = q.t / 0.9
        if (k >= 1) { toques.splice(i, 1); continue }
        const r = 6 + 34 * (1 - (1 - k) ** 2)
        fr.strokeStyle = `rgba(${COLOR}, ${0.5 * (1 - k)})`
        fr.lineWidth = 1.3
        fr.beginPath(); fr.ellipse(q.x, q.y, r, r * 0.35, 0, 0, Math.PI * 2); fr.stroke()
        fr.fillStyle = `rgba(${COLOR}, ${0.6 * (1 - k)})`
        for (const p of q.gotas) { fr.beginPath(); fr.arc(q.x + p.vx * q.t, q.y + p.vy * q.t + 260 * q.t * q.t, 1.6, 0, Math.PI * 2); fr.fill() }
      }
      // Rayo: se ve un instante y deja un destello suave.
      if (t >= proximoRayo) { rayo = 1; rayoCamino = caminoRayo(); proximoRayo = t + enRango(int.rayo) }
      if (rayo > 0) {
        const fuerza = noche ? 0.45 : 1
        fr.fillStyle = `rgba(${COLOR}, ${0.12 * rayo * fuerza})`
        fr.fillRect(0, 0, w, h)
        fr.strokeStyle = `rgba(255, 255, 255, ${0.85 * rayo * fuerza})`
        fr.lineWidth = 2
        for (const c of rayoCamino) { fr.beginPath(); c.forEach(([x, y], i) => (i ? fr.lineTo(x, y) : fr.moveTo(x, y))); fr.stroke() }
        rayo = Math.max(0, rayo - dt * 2.2)
      }
    }

    let anterior = performance.now()
    let id = 0
    function bucle(t) {
      const dt = Math.min(0.05, (t - anterior) / 1000)
      // Celu lento: menos gotas.
      if (dt > 0.034) lentoAcum += dt; else lentoAcum = Math.max(0, lentoAcum - dt * 0.5)
      if (lentoAcum > 1.5 && factor > 0.4) { factor *= 0.7; lentoAcum = 0; medir() }
      anterior = t
      if (!document.hidden) cuadro(t, dt)
      id = requestAnimationFrame(bucle)
    }
    const alTocar = (e) => {
      if (toques.length > 6) toques.shift()
      toques.push({ x: e.clientX, y: e.clientY, t: 0, gotas: Array.from({ length: 4 }, () => ({ vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90 })) })
    }

    medir()
    window.addEventListener('resize', medir)
    if (quieto()) cuadro(performance.now(), 0)
    else {
      id = requestAnimationFrame(bucle)
      window.addEventListener('pointerdown', alTocar, { passive: true })
    }
    corriendo = () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', medir)
      window.removeEventListener('pointerdown', alTocar)
      atrasC.remove(); frenteC.remove()
      document.documentElement.classList.remove('con-lluvia')
    }
  }

  function apagar() {
    if (corriendo) { corriendo(); corriendo = null }
  }

  window.SEK = window.SEK || {}
  window.SEK.lluvia = { prender, apagar }
})()
