/*
 * «道 El camino» de Progreso, igual que CaminoMontana de la app vieja (src/temas/shinobi/Camino.tsx):
 * el progreso no es lineal. Un trazo de pincel que sube y baja como la ladera de una montaña, un punto por día
 * del ciclo; la altura es la XP neta del día, con una línea base fina en 0. Tocar un día muestra su detalle.
 *
 *   SEK_CAMINO(caja, dias, duracion)   dias: [{ fecha, dia, neto, ganado, perdido, acumulado, pilares, caida, forja, marca }]
 */
(function () {
  'use strict'
  const W = 360, H = 62, X0 = 10, X1 = 350, ARRIBA = 8, ABAJO = 60

  /** Catmull-Rom → muchos puntos: curvas suaves, sin quiebres de polígono. */
  function suave(ps, pasos = 10) {
    if (ps.length < 3) return ps
    const out = []
    for (let i = 0; i < ps.length - 1; i++) {
      const p0 = ps[Math.max(0, i - 1)], p1 = ps[i], p2 = ps[i + 1], p3 = ps[Math.min(ps.length - 1, i + 2)]
      for (let k = 0; k < pasos; k++) {
        const t = k / pasos, t2 = t * t, t3 = t2 * t
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
      }
    }
    out.push(ps[ps.length - 1])
    return out
  }
  const linea = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

  /** Cinta de pincel: el grosor respira a lo largo del trazo, entra fino y termina en punta (hoy). */
  function pincel(ps, base) {
    const n = ps.length
    if (n < 2) return ''
    const izq = [], der = []
    for (let i = 0; i < n; i++) {
      const a = ps[Math.max(0, i - 4)], b = ps[Math.min(n - 1, i + 4)]
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      const t = i / (n - 1)
      const entra = Math.min(1, t * 14)
      const punta = Math.min(1, (1 - t) * 9)
      const respira = 1 + 0.28 * Math.sin(t * 23) + 0.16 * Math.sin(t * 61 + 1)
      const w = (base * entra * (0.25 + 0.75 * punta) * respira) / 2
      izq.push([ps[i][0] - (dy / l) * w, ps[i][1] + (dx / l) * w])
      der.push([ps[i][0] + (dy / l) * w, ps[i][1] - (dx / l) * w])
    }
    return linea([...izq, ...der.reverse()]) + ' Z'
  }

  window.SEK_CAMINO = function (caja, dias, duracion) {
    const { esc, fechaLegible } = SEK.v88
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = Math.max(dias.length, 2)
    const xDe = (i) => X0 + ((X1 - X0) * i) / (total - 1)
    const valores = dias.map((d) => d.neto)
    if (valores.length === 1) valores.push(valores[0])
    const min = Math.min(0, ...valores), max = Math.max(0, ...valores, min + 30)
    const yDe = (v) => ABAJO - 5 - ((v - min) / (max - min)) * (ABAJO - ARRIBA - 9)
    const base = yDe(0)
    const puntos = valores.map((v, i) => [xDe(i), yDe(v)])
    const camino = suave(puntos, total > 40 ? 4 : 10)
    const ladera = camino.length > 1 ? `${linea(camino)} L${camino[camino.length - 1][0].toFixed(1)},${H} L${camino[0][0].toFixed(1)},${H} Z` : ''
    const ultimo = puntos[dias.length - 1] || puntos[puntos.length - 1]
    const radio = Math.max(5, Math.min(14, (X1 - X0) / Math.max(dias.length, 1) / 2 + 2))
    let marcas = ''
    dias.forEach((x, i) => {
      const p = puntos[i]
      const forjaVisible = x.forja && !dias.slice(Math.max(0, i - 3), i).some((y) => y.forja)
      if (x.caida || x.neto < 0) marcas += `<circle class="camino-caida" cx="${p[0]}" cy="${Math.min(H - 2, p[1] + 6)}" r="2"/>`
      if (forjaVisible) marcas += `<text class="camino-k forja" x="${p[0]}" y="${Math.min(H, p[1] + (x.caida ? 15 : 10))}" text-anchor="middle">鍛</text>`
      if (x.marca) marcas += `<g transform="translate(${p[0]} ${Math.max(5, p[1] - 9)})"><rect class="camino-sello" x="-5" y="-5" width="10" height="10" rx="1.5"/><text class="camino-k sello" y="0.5" text-anchor="middle" dominant-baseline="central">印</text></g>`
      marcas += `<circle class="camino-toque" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="${radio}"/>`
    })
    caja.innerHTML = `<div class="camino ${reducido ? 'quieto' : ''}">
      <h2 class="camino-frase"><span class="camino-titulo-k" aria-hidden="true">道</span> El progreso no es lineal.</h2>
      <svg class="camino-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="El camino: ${dias.length} días de ${duracion}">
        <defs>
          <linearGradient id="cm-aguada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3735" stop-opacity="0.85"/><stop offset="1" stop-color="#141312" stop-opacity="0"/></linearGradient>
          <filter id="cm-brillo" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
        </defs>
        ${ladera ? `<path class="camino-ladera" d="${ladera}" fill="url(#cm-aguada)"/>` : ''}
        <line class="camino-base" x1="${X0}" x2="${X1}" y1="${base}" y2="${base}"/>
        <g class="camino-trazo">
          <path class="camino-brillo" d="${linea(camino)}" filter="url(#cm-brillo)"/>
          <path class="camino-sombra" d="${pincel(camino, 4)}" transform="translate(1.6 1.8)"/>
          <path class="camino-tinta" d="${pincel(camino, 4)}"/>
          <path class="camino-alma" d="${linea(camino.slice(1, -1))}"/>
        </g>
        ${marcas}
        ${ultimo ? `<circle class="camino-hoy" pointer-events="none" cx="${ultimo[0]}" cy="${ultimo[1]}" r="2.6"/>` : ''}
        <circle class="camino-elegido" pointer-events="none" r="5" style="display: none;"/>
      </svg>
      <p class="camino-pie av-nota">Día ${dias.length} de ${duracion} · tocá un día</p>
    </div>`
    const pie = caja.querySelector('.camino-pie')
    const elegido = caja.querySelector('.camino-elegido')
    let sel = null
    caja.querySelectorAll('.camino-toque').forEach((c) => {
      c.addEventListener('click', () => {
        const i = Number(c.dataset.i)
        sel = sel === i ? null : i
        if (sel === null) { elegido.style.display = 'none'; pie.textContent = `Día ${dias.length} de ${duracion} · tocá un día`; return }
        const d = dias[i]
        elegido.setAttribute('cx', puntos[i][0]); elegido.setAttribute('cy', puntos[i][1]); elegido.style.display = ''
        const p = d.pilares || { hechos: 0, total: 0 }
        const etiqueta = `Día ${d.dia} · ${fechaLegible(d.fecha)} · ${p.total ? `${p.hechos}/${p.total} pilares` : 'sin pilares'}`
        pie.innerHTML = `<b>${esc(etiqueta)}</b> · <span class="camino-mas">+${d.ganado}</span>${d.perdido ? ` / <span class="camino-menos">−${d.perdido}</span>` : ''} · neto ${d.neto > 0 ? '+' : d.neto < 0 ? '−' : ''}${Math.abs(d.neto)} · total ${d.acumulado ?? 0}${d.marca ? ` · 印 ${esc(d.marca)}` : ''}${d.caida ? ' · caída, seguiste' : ''}${d.forja ? ' · 鍛 forja' : ''}`
      })
    })
  }
})()
