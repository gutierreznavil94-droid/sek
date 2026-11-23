/*
 * La cabecera que se hace polvo (igual que Desintegrar.tsx de la v0.88.27). Va en comun/ porque la cabecera
 * es de todas las pantallas. La usa SEK.v88.montar si este archivo está cargado antes que v88.js.
 *
 * Al bajar (pasado el 30 % del alto de la cabecera) se dispara una animación con tiempo propio:
 *   1. Desintegración (0–0,6 s): se deshace en polvo de tinta desde el borde izquierdo.
 *   2. Reunión (0,6–1,1 s): el polvo se arremolina y forma 5 pájaros de tinta.
 *   3. Vuelo (1,1–2,2 s): los pájaros aletean y se van.
 * Al volver arriba, la cabecera se rearma con un fundido. Con «reducir movimiento», solo fundidos.
 * Con horario (Hoy): la barra del horario sigue al hueco de la cabecera y, cuando la cabecera se va, «aterriza» arriba.
 * Pájaro torpe: el 10 % de las veces (nunca dos seguidas) uno se choca con el borde derecho y dice «¡agh!».
 *
 *   SEK_POLVO({ cabecera, barra, mini, lienzo, lienzoTorpe }) → { mover }
 */
(function () {
  'use strict'
  const PROB_TORPE = 0.1
  const TORPE = { sale: 2.15, choca: 2.95, globo: 3.0, finGlobo: 3.7, sacude: 3.6, vuela: 3.9, fin: 4.9 }
  const AVES = 5
  const POLVO = 260
  const DUR = 2.3
  const TINTA = '#121110'
  const PAPEL = 'rgba(241, 235, 223, 0.95)'

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const suave = (v) => { const x = clamp(v); return x * x * (3 - 2 * x) }
  function azar(semilla) { let s = semilla; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 } }
  const quieto = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  function siguienteEstado(estado, avance, terminoAnimacion, terminoRearmado) {
    if (estado === 'armada' && avance > 0.3) return 'animando'
    if (estado === 'animando' && terminoAnimacion) return avance < 0.15 ? 'rearmando' : 'ausente'
    if (estado === 'ausente' && avance < 0.15) return 'rearmando'
    if (estado === 'rearmando' && terminoRearmado) return 'armada'
    return estado
  }

  function tocaTorpe() {
    let ultimo = false, forzar = false
    try { ultimo = localStorage.getItem('pajaro-torpe-ultimo') === '1'; forzar = localStorage.getItem('pajaro-torpe-forzar') === '1'; localStorage.removeItem('pajaro-torpe-forzar') } catch (e) { /* sin almacenamiento */ }
    const sale = forzar || (!ultimo && Math.random() < PROB_TORPE)
    try { localStorage.setItem('pajaro-torpe-ultimo', sale ? '1' : '0') } catch (e) { /* sin almacenamiento */ }
    return sale
  }

  function puntoDeAve(r) {
    if (r() < 0.18) return [(r() - 0.5) * 0.12, (r() - 0.5) * 0.08]
    const a = r() * 2 - 1
    return [a * 0.5, -Math.abs(a) * 0.22 + Math.abs(a) ** 2 * 0.12 + (r() - 0.5) * 0.05]
  }

  function dibujarAve(ctx, x, y, e, cuadro) {
    const alto = [0.42, 0.12, -0.18][cuadro] * e
    const m = e / 2
    ctx.beginPath()
    ctx.moveTo(x - m, y - alto)
    ctx.quadraticCurveTo(x - m * 0.45, y - alto * 0.2 - e * 0.05, x, y)
    ctx.quadraticCurveTo(x + m * 0.45, y - alto * 0.2 - e * 0.05, x + m, y - alto)
    ctx.quadraticCurveTo(x + m * 0.4, y - alto * 0.05 + e * 0.06, x, y + e * 0.08)
    ctx.quadraticCurveTo(x - m * 0.4, y - alto * 0.05 + e * 0.06, x - m, y - alto)
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(241, 235, 223, 0.9)'
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.fillStyle = TINTA
    ctx.fill()
  }

  /** El pájaro torpe (silueta de tinta con borde de papel), mirando a la derecha. Mareado: ojo en «x». */
  function dibujarPajaroTorpe(c, e, cuadro, mareado) {
    c.save()
    c.lineJoin = 'round'
    c.lineCap = 'round'
    const trazo = () => { c.strokeStyle = PAPEL; c.lineWidth = Math.max(1.6, e * 0.05); c.stroke(); c.fillStyle = TINTA; c.fill() }
    const alzada = [-0.75, -0.2, 0.45][cuadro]
    c.save()
    c.globalAlpha *= 0.85
    c.beginPath()
    c.moveTo(-e * 0.05, -e * 0.05)
    c.quadraticCurveTo(-e * 0.25, e * alzada * 0.6 - e * 0.1, -e * 0.42, e * alzada * 0.7)
    c.quadraticCurveTo(-e * 0.2, e * alzada * 0.25, e * 0.1, e * 0.02)
    c.closePath()
    trazo()
    c.restore()
    c.beginPath()
    c.moveTo(-e * 0.3, 0); c.lineTo(-e * 0.62, -e * 0.14); c.lineTo(-e * 0.56, e * 0.02); c.lineTo(-e * 0.64, e * 0.14)
    c.closePath()
    trazo()
    c.beginPath(); c.ellipse(0, 0, e * 0.36, e * 0.19, -0.08, 0, Math.PI * 2); trazo()
    const hx = e * 0.34, hy = -e * 0.1
    c.beginPath(); c.arc(hx, hy, e * 0.14, 0, Math.PI * 2); trazo()
    c.beginPath()
    c.moveTo(hx + e * 0.12, hy - e * 0.04); c.lineTo(hx + e * 0.3, hy + e * 0.01); c.lineTo(hx + e * 0.12, hy + e * 0.05)
    c.closePath()
    c.fillStyle = PAPEL; c.fill()
    c.strokeStyle = PAPEL
    c.fillStyle = PAPEL
    if (mareado) {
      const r = e * 0.045
      c.lineWidth = Math.max(1.2, e * 0.03)
      c.beginPath()
      c.moveTo(hx + e * 0.03 - r, hy - e * 0.03 - r); c.lineTo(hx + e * 0.03 + r, hy - e * 0.03 + r)
      c.moveTo(hx + e * 0.03 + r, hy - e * 0.03 - r); c.lineTo(hx + e * 0.03 - r, hy - e * 0.03 + r)
      c.stroke()
    } else {
      c.beginPath(); c.arc(hx + e * 0.04, hy - e * 0.03, e * 0.035, 0, Math.PI * 2); c.fill()
    }
    c.beginPath()
    c.moveTo(-e * 0.12, -e * 0.04)
    c.quadraticCurveTo(-e * 0.05, e * alzada - e * 0.12, e * 0.2, e * alzada * 1.05)
    c.quadraticCurveTo(e * 0.08, e * alzada * 0.4, e * 0.14, e * 0.04)
    c.closePath()
    trazo()
    c.restore()
  }

  function iniciar({ cabecera: cab, barra: ba, mini: mi, lienzo: cv, lienzoTorpe: cvT }) {
    const ctx = cv.getContext('2d')
    const ctxT = cvT ? cvT.getContext('2d') : null
    const sinMovimiento = quieto()
    let torpe = false

    // ---- La barra del horario: sigue al hueco mientras está la cabecera; fija arriba cuando no ----
    let barraFija = null
    let hastaTransicion = 0
    const ponerBarra = (fija, animar) => {
      if (!ba) return
      const h = document.getElementById('hueco-horario')
      const y = fija || !h ? 0 : Math.max(0, h.getBoundingClientRect().top)
      if (animar && !sinMovimiento) hastaTransicion = performance.now() + 270
      ba.style.transition = performance.now() < hastaTransicion ? 'transform 0.25s ease-out, box-shadow 0.25s ease-out' : ''
      ba.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
      if (fija !== barraFija) { barraFija = fija; ba.classList.toggle('fija', fija) }
    }
    let ancho = 0, alto = 0, arriba = 0, dpr = 1
    let estado = 'armada'
    let t0 = 0, tRearme = 0, rafAnim = 0, rafScroll = 0, ultimo = 0, fijo = 0
    let aves = []
    let polvo = []
    let corrida = 0

    const medir = () => {
      const t = cab.style.transform
      cab.style.transform = ''
      const r = cab.getBoundingClientRect()
      cab.style.transform = t
      arriba = r.top + window.scrollY
      alto = r.height + 30
      ancho = window.innerWidth
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(ancho * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
      if (cvT) { cvT.width = cv.width; cvT.height = cv.height }
    }
    const avance = () => Math.max(0, window.scrollY) / alto
    const topeCabecera = () => arriba - Math.max(0, window.scrollY) * 0.65

    const mostrarMini = (v) => {
      if (ba) { mi.style.opacity = '0'; return }
      mi.style.transition = 'opacity 0.45s ease, transform 0.45s ease'
      mi.style.opacity = v ? '1' : '0'
      mi.style.transform = v ? 'translate3d(0,0,0)' : 'translate3d(0,-6px,0)'
    }
    function pedir() { if (!rafScroll) rafScroll = requestAnimationFrame(alDesplazar) }

    const prepararAnimacion = () => {
      torpe = tocaTorpe()
      tocado = false
      const r = azar(97 + (corrida++ % 7))
      const top = fijo
      aves = Array.from({ length: AVES }, (_, k) => {
        const lado = r() < 0.3 ? -1 : 1
        return {
          cx: ancho * (0.14 + 0.18 * k + (r() - 0.5) * 0.06),
          cy: Math.max(110, top + alto * 0.35) + r() * alto * 0.3,
          vx: lado * (50 + r() * 110), vy: -(80 + r() * 100),
          curva: (r() - 0.5) * 60, fase: r() * 3, envergadura: 30 + r() * 12, fin: 2.0 + r() * 0.3,
        }
      })
      polvo = Array.from({ length: POLVO }, (_, i) => {
        const u = r(), v = r()
        const ave = Math.min(AVES - 1, Math.floor(u * AVES))
        const [ox, oy] = puntoDeAve(r)
        return { u, v, te: u * 0.48 + r() * 0.08, ave: i % 4 === 0 ? (ave + 1) % AVES : ave, ox, oy, vx: 30 + r() * 90, vy: -(15 + r() * 50), r: 1 + r() * 1.6, x: 0, papel: r() < 0.55, y: 0, vivo: false, giro: (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2) }
      })
    }
    let tocado = false

    const centroAve = (a, t) => {
      const tf = Math.max(0, t - 0.6)
      const dx = a.curva * Math.sin(tf * 2.2)
      const imp = Math.max(0, t - 1.1) ** 1.35
      return [a.cx + dx + a.vx * imp, a.cy - tf * 14 + a.vy * imp]
    }

    const dibujarTorpe = (c, t) => {
      const e = 50
      const x0 = -e * 0.8, y0 = Math.max(110, fijo + alto * 0.5)
      const borde = ancho - e * 0.66
      let x = x0, y = y0, cuadro = Math.floor((t * 10) % 3), giro = 0
      if (t < TORPE.choca) {
        const k = suave((t - TORPE.sale) / (TORPE.choca - TORPE.sale))
        x = x0 + (borde - x0) * k
        y = y0 - 10 * Math.sin(k * Math.PI)
      } else if (t < TORPE.vuela) {
        tocado = true
        const k = clamp((t - TORPE.choca) / 0.18)
        x = borde - 18 * Math.sin(k * Math.PI * 0.5)
        y = y0 + 8 * k
        cuadro = 2
        giro = -0.35 * (1 - k)
        if (t >= TORPE.sacude) { const s2 = (t - TORPE.sacude) / 0.2; x += Math.sin(s2 * Math.PI * 6) * 3 * (1 - clamp(s2)); cuadro = Math.floor((t * 16) % 3) }
      } else {
        const k = (t - TORPE.vuela) / (TORPE.fin - TORPE.vuela)
        x = borde - 18 - 30 * k
        y = y0 + 8 - (y0 + 80) * k ** 1.3
      }
      c.save(); c.translate(x, y); c.rotate(giro); c.globalAlpha = 1
      dibujarPajaroTorpe(c, e, cuadro, t >= TORPE.choca && t < TORPE.vuela)
      c.restore()
      if (t > TORPE.choca && t < TORPE.choca + 1.2) {
        const k = (t - TORPE.choca) / 1.2
        for (const [dx, fase] of [[-6, 0], [7, 1.7]]) {
          const px = borde - 10 + dx + Math.sin(k * 6 + fase) * 6
          const py = y0 + k * 70
          c.globalAlpha = 1 - k
          c.save(); c.translate(px, py); c.rotate(Math.sin(k * 5 + fase) * 0.8)
          c.beginPath(); c.ellipse(0, 0, 8, 2.6, 0, 0, Math.PI * 2)
          c.fillStyle = TINTA; c.fill(); c.strokeStyle = 'rgba(241, 235, 223, 0.85)'; c.lineWidth = 0.8; c.stroke()
          c.restore()
        }
      }
      if (t >= TORPE.globo && t < TORPE.finGlobo + 0.1) {
        const a = t < TORPE.finGlobo ? clamp((t - TORPE.globo) / 0.08) : 1 - clamp((t - TORPE.finGlobo) / 0.1)
        const gw = 66, gh = 28
        const gx = borde - gw - 34, gy = y0 - 74
        c.globalAlpha = a
        const globo = () => {
          c.beginPath()
          if (typeof c.roundRect === 'function') c.roundRect(gx, gy, gw, gh, [11, 14, 10, 13]); else c.rect(gx, gy, gw, gh)
          c.moveTo(gx + gw - 18, gy + gh); c.lineTo(gx + gw + 4, gy + gh + 14); c.lineTo(gx + gw - 32, gy + gh)
        }
        globo(); c.fillStyle = '#F4EFE6'; c.fill()
        c.strokeStyle = '#151413'; c.lineWidth = 2.4; c.stroke()
        c.save(); c.translate(0.8, -0.6); c.globalAlpha = a * 0.45; c.lineWidth = 1; globo(); c.stroke(); c.restore()
        c.globalAlpha = a
        c.fillStyle = '#151413'; c.font = "900 16px 'Pincel', system-ui, sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('¡agh!', gx + gw / 2, gy + gh / 2 + 1)
      }
      c.globalAlpha = 1
    }

    const cuadroAnimacion = (ahora) => {
      rafAnim = 0
      const t = (ahora - t0) / 1000
      const dt = Math.min(0.05, ultimo ? (ahora - ultimo) / 1000 : 0.016)
      ultimo = ahora
      const frente = -20 + 140 * suave(t / 0.6)
      const mascara = `linear-gradient(100deg, transparent ${frente.toFixed(1)}%, #000 ${(frente + 18).toFixed(1)}%)`
      cab.style.setProperty('-webkit-mask-image', mascara)
      cab.style.setProperty('mask-image', mascara)
      cab.style.opacity = String(Math.max(0, 1 - suave(t / 0.45)).toFixed(3))
      if (t > 0.45 && mi.style.opacity !== '1') mostrarMini(true)
      if (t > 0.5 && !barraFija) ponerBarra(true, true)
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, ancho, window.innerHeight)
        const top = fijo
        const reunion = suave((t - 0.6) / 0.5)
        const fundePolvo = 1 - suave((t - 1.0) / 0.15)
        if (fundePolvo > 0) {
          for (const g of polvo) {
            if (!g.vivo) {
              if (t < g.te) continue
              g.vivo = true
              g.x = g.u * ancho
              g.y = top + g.v * alto
            }
            g.x += g.vx * dt
            g.y += g.vy * dt
            g.vx *= 0.995
            let x = g.x, y = g.y
            if (reunion > 0) {
              const a = aves[g.ave]
              const [cx, cy] = centroAve(a, t)
              const tx = cx + g.ox * a.envergadura, ty = cy + g.oy * a.envergadura
              const ang = (1 - reunion) * g.giro
              const rx = x - tx, ry = y - ty
              const rx2 = rx * Math.cos(ang) - ry * Math.sin(ang), ry2 = rx * Math.sin(ang) + ry * Math.cos(ang)
              x = tx + rx2 * (1 - reunion)
              y = ty + ry2 * (1 - reunion)
            }
            const nace = clamp((t - g.te) / 0.12)
            const rad = g.r * (1 - 0.3 * reunion)
            ctx.globalAlpha = nace * fundePolvo * 0.95
            ctx.beginPath()
            ctx.arc(x, y, rad, 0, Math.PI * 2)
            if (g.papel) { ctx.fillStyle = '#F1EBDF'; ctx.fill() }
            else { ctx.fillStyle = TINTA; ctx.fill(); ctx.strokeStyle = 'rgba(241, 235, 223, 0.7)'; ctx.lineWidth = 0.8; ctx.stroke() }
          }
        }
        const aparecen = suave((t - 1.0) / 0.15)
        if (aparecen > 0) {
          for (const a of aves) {
            const vuelo = Math.max(0, t - 1.1)
            const desvanece = 1 - suave((t - (a.fin - 0.45)) / 0.45)
            if (desvanece <= 0) continue
            const [x, y] = centroAve(a, t)
            const cuadro = Math.floor((t * 9 + a.fase) % 3)
            ctx.globalAlpha = aparecen * desvanece
            dibujarAve(ctx, x, y, a.envergadura * (1 - 0.45 * clamp(vuelo / 1.1)), vuelo > 0 ? cuadro : 1)
          }
        }
        ctx.globalAlpha = 1
      }
      if (ctxT) {
        ctxT.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctxT.clearRect(0, 0, ancho, window.innerHeight)
        if (torpe && t >= TORPE.sale) dibujarTorpe(ctxT, t)
        ctxT.globalAlpha = 1
      }
      if (t < (torpe ? TORPE.fin : DUR)) { rafAnim = requestAnimationFrame(cuadroAnimacion); return }
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height) }
      if (ctxT) { ctxT.setTransform(1, 0, 0, 1, 0, 0); ctxT.clearRect(0, 0, cvT.width, cvT.height) }
      cab.style.removeProperty('-webkit-mask-image')
      cab.style.removeProperty('mask-image')
      estado = siguienteEstado(estado, avance(), true, false)
      pedir()
      if (estado === 'rearmando') rearmar()
    }

    const ocultarSinParticulas = () => {
      cab.style.transition = 'opacity 0.5s ease'
      cab.style.opacity = '0'
      cab.style.pointerEvents = 'none'
      mostrarMini(true)
      ponerBarra(true)
      setTimeout(() => {
        if (estado !== 'animando') return
        estado = siguienteEstado(estado, avance(), true, false)
        if (estado === 'rearmando') rearmar()
      }, 520)
    }

    const rearmar = () => {
      cab.style.transition = 'opacity 0.7s ease'
      cab.style.opacity = '1'
      cab.style.pointerEvents = ''
      mostrarMini(false)
      ponerBarra(false, true)
      tRearme = performance.now()
      setTimeout(() => {
        if (estado !== 'rearmando' || performance.now() - tRearme < 690) return
        estado = siguienteEstado(estado, avance(), false, true)
        cab.style.transition = ''
        alDesplazar()
      }, 720)
    }

    function alDesplazar() {
      rafScroll = 0
      const s = Math.max(0, window.scrollY)
      if (estado === 'animando') cab.style.transform = `translate3d(0, ${(fijo - arriba + s).toFixed(1)}px, 0)`
      else cab.style.transform = ''
      if (estado === 'armada' || estado === 'rearmando') ponerBarra(false)
      else if (estado === 'ausente') ponerBarra(true)
      const antes = estado
      if (estado === 'animando' || estado === 'rearmando') return
      estado = siguienteEstado(estado, avance(), false, false)
      if (antes === 'armada' && estado === 'animando') {
        cab.style.transition = ''
        cab.style.pointerEvents = 'none'
        fijo = Math.max(topeCabecera(), Math.min(arriba, 0))
        cab.style.transform = `translate3d(0, ${(fijo - arriba + s).toFixed(1)}px, 0)`
        if (sinMovimiento || !ctx) { ocultarSinParticulas(); return }
        prepararAnimacion()
        t0 = performance.now()
        ultimo = 0
        rafAnim = requestAnimationFrame(cuadroAnimacion)
      } else if (antes === 'ausente' && estado === 'rearmando') {
        rearmar()
      }
    }
    const redimensionar = () => { if (estado === 'armada') medir(); pedir() }
    medir()
    alDesplazar()
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', redimensionar)
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redimensionar).observe(cab)
    // «mover»: para cuando cambia el alto de la cabecera (llegaron los datos)
    return { mover: redimensionar }
  }

  window.SEK_POLVO = iniciar
})()
