/*
 * Forja de hábitos, tema Shinobi: la piedra que se rompe y libera el kanji. Igual que PiedraShinobi de la app
 * vieja (src/temas/shinobi/Piedra.tsx), en JS: devuelve el texto del <svg>.
 * - Piedra tallada gris tinta, siempre la misma forma para cada hábito (sale del id).
 * - Signos shinobi grabados casi invisibles (shuriken, kasa, katana y trazos sueltos del kanji).
 * - Cada día válido nuevo (golpe): tajo blanco, temblor, esquirlas y una grieta nueva.
 * - 6 pedazos que caen (7, 12, 17, 21, 25, 28 con 28); debajo, el kanji con la fuente de pincel.
 * - Forjado: la piedra se parte entera y el kanji queda libre, latiendo.
 * Va en temas porque la usa más de una pantalla (Mi código y Hoy). Los estilos .pf-* están en shinobi/visual.css.
 *
 *   SEK_PIEDRA_SHINOBI({ id, kanji, validos, necesarios, tam = 96, reducido = false, golpe = false }) → '<svg…>'
 *   golpe: true justo después de marcar un día (anima la grieta nueva y, si toca, el pedazo que cae).
 */
(function () {
  'use strict'
  const PEDAZOS_BASE = [7, 12, 17, 21, 25, 28]
  function pedazosPara(validos) {
    const v = Math.max(1, Math.round(validos))
    const r = PEDAZOS_BASE.map((p) => Math.max(1, Math.round((p * v) / 28)))
    for (let i = 1; i < r.length; i++) if (r[i] <= r[i - 1]) r[i] = r[i - 1] + 1
    r[r.length - 1] = Math.max(r[r.length - 1], v)
    return r
  }
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  function semillaDe(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function azar(semilla) {
    let a = semilla || 1
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  }
  const camino = (ps) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const desde = (c, ang, r) => [c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r]
  const hacia = (a, b, d) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [a[0] + (dx / l) * d, a[1] + (dy / l) * d] }
  function cinta(ps, w0) {
    const n = ps.length, izq = [], der = []
    for (let i = 0; i < n; i++) {
      const a = ps[Math.max(0, i - 1)], b = ps[Math.min(n - 1, i + 1)]
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      const w = (w0 * (1 - (i / (n - 1)) * 0.88)) / 2
      izq.push([ps[i][0] - (dy / l) * w, ps[i][1] + (dx / l) * w])
      der.push([ps[i][0] + (dy / l) * w, ps[i][1] - (dx / l) * w])
    }
    return camino([...izq, ...der.reverse()]) + ' Z'
  }

  /** Todo sale del id: la misma piedra cada vez que se abre la app. */
  const formas = new Map()
  function formaDe(id, necesarios) {
    const clave = `${id}|${necesarios}`
    if (formas.has(clave)) return formas.get(clave)
    const r = azar(semillaDe(id))
    const j = (m) => (r() * 2 - 1) * m
    const n = 10 + Math.floor(r() * 3)
    const g0 = r() * Math.PI * 2
    const puntas = new Set([Math.floor(r() * n), Math.floor(r() * n), Math.floor(r() * n)])
    const vert = Array.from({ length: n }, (_, i) => {
      const ang = g0 + (i * Math.PI * 2) / n + j(0.12)
      const rad = 39 + j(2.2) + (puntas.has(i) ? 3.5 + r() * 1.5 : 0)
      return [50 + Math.cos(ang) * rad, 51 + Math.sin(ang) * rad * 0.95]
    })
    const contorno = camino(vert) + ' Z'
    const q = [58 + j(1.5), 60 + j(1.5)]
    const angDe = (v) => ((Math.atan2(v[1] - 51, v[0] - 50) * 180) / Math.PI + 360) % 360
    const cerca = (deg) => { let mejor = 0, dm = 999; vert.forEach((v, i) => { const d = Math.abs(((angDe(v) - deg + 540) % 360) - 180); if (d < dm) { dm = d; mejor = i } }); return mejor }
    const cortes = [cerca(175), cerca(340), cerca(25), cerca(75), cerca(125)]
    const tonos = ['luz', 'medio', 'sombra', 'baja', 'medio']
    const facetas = []
    for (let c = 0; c < 5; c++) {
      const i0 = cortes[c], i1 = cortes[(c + 1) % 5]
      if (i0 === i1) continue
      const ps = [q]
      for (let i = i0; ; i = (i + 1) % n) { ps.push(vert[i]); if (i === i1) break }
      facetas.push({ d: camino(ps) + ' Z', tono: tonos[c] })
    }
    const bordesLuz = [], bajos = []
    for (let i = 0; i < n; i++) {
      const a = vert[i], b = vert[(i + 1) % n]
      const mx = (a[0] + b[0]) / 2 - 50, my = (a[1] + b[1]) / 2 - 51, ml = Math.hypot(mx, my) || 1
      const luz = (mx / ml) * -0.6 + (my / ml) * -0.8
      if (luz > 0.45) bordesLuz.push(camino([hacia(a, b, 1.5), hacia(b, a, 1.5)]))
      if (my / ml > 0.55) bajos.push(camino([a, b]))
    }
    const centro = [50 + j(5), 50 + j(5)]
    const a0 = r() * Math.PI * 2
    const angs = Array.from({ length: 6 }, (_, i) => a0 + (i * Math.PI) / 3 + j(0.2))
    const troncos = angs.map((a) => {
      const ps = [centro]
      for (const dist of [9, 19, 31, 45, 80]) { const p = desde(centro, a, dist); const per = j(dist > 60 ? 0 : 2.2); ps.push([p[0] - Math.sin(a) * per, p[1] + Math.cos(a) * per]) }
      return ps
    })
    const cunas = angs.map((a, i) => {
      const b = angs[(i + 1) % 6] + (i === 5 ? Math.PI * 2 : 0)
      const arco = [0.25, 0.5, 0.75].map((f) => desde(centro, a + (b - a) * f, 90))
      return camino([...troncos[i], ...arco, ...[...troncos[(i + 1) % 6]].reverse()]) + ' Z'
    })
    const centros = angs.map((a, i) => desde(centro, a + (((angs[(i + 1) % 6] + (i === 5 ? Math.PI * 2 : 0)) - a) / 2), 26))
    const grietas = []
    troncos.forEach((t, i) => { const ps = t.slice(0, 5); grietas.push({ d: camino(ps), cinta: cinta(ps, 2.8 - i * 0.12), ancho: 2.8 - i * 0.12, ang: angs[i], inicio: centro, fin: t[4] }) })
    const alturas = [0.55, 0.3, 0.78, 0.42, 0.66, 0.2]
    for (let k = 0; grietas.length < Math.max(6, necesarios); k++) {
      const ti = (k * 5) % 6, m = Math.floor(k / 6), t = troncos[ti]
      const f = alturas[m % alturas.length] * 4, seg = Math.min(3, Math.floor(f)), u = f - seg
      const ini = [t[seg][0] + (t[seg + 1][0] - t[seg][0]) * u, t[seg][1] + (t[seg + 1][1] - t[seg][1]) * u]
      const lado = (k + m) % 2 ? 1 : -1
      const ang = angs[ti] + lado * (0.55 + r() * 0.4)
      const largo = Math.max(6, 16 - m * 1.6 + j(3))
      const ps = [ini]
      for (let s = 1; s <= 3; s++) ps.push(desde(ini, ang + j(0.25), (largo * s) / 3))
      const ancho = Math.max(0.9, 1.6 - m * 0.12)
      grietas.push({ d: camino(ps), cinta: cinta(ps, ancho), ancho, ang, inicio: ini, fin: ps[3] })
    }
    const sx = 24 + r() * 14, sy = 22 + r() * 12
    const shur = []
    for (let i = 0; i < 8; i++) shur.push(desde([sx, sy], (i * Math.PI) / 4 + 0.3, i % 2 ? 2 : 6))
    const kx = 58 + r() * 14, ky = 70 + r() * 8
    const kasa = `M${kx - 12},${ky} Q${kx},${ky - 9} ${kx + 12},${ky} M${kx - 14},${ky + 1.5} L${kx + 14},${ky + 1.5}`
    const kax = 62 + r() * 10, kay = 18 + r() * 8
    const katana = `M${kax},${kay} L${kax + 18},${kay + 26} M${kax + 2.5},${kay + 6} L${kax + 7},${kay + 2.8}`
    const trazos = Array.from({ length: 3 }, (_, i) => ({ x: 28 + i * 13 + j(4), y: 34 + j(10), w: 10 + r() * 6, h: 9 + r() * 7 }))
    const f = { contorno, luz: bordesLuz.join(' '), facetas, brasa: bajos.join(' '), centro, cunas, centros, grietas, signos: { shuriken: camino(shur) + ' Z', kasa, katana, trazos } }
    formas.set(clave, f)
    return f
  }

  /** Lenguas de fuego que suben despacio desde detrás de la piedra. */
  const LENGUAS = [
    { ang: -Math.PI * 0.5, alto: 1.15, ancho: 1.1, curva: 1.5, demora: 0, dura: 1.9 },
    { ang: -Math.PI * 0.68, alto: 0.95, ancho: 0.9, curva: -2, demora: 0.5, dura: 2.2 },
    { ang: -Math.PI * 0.32, alto: 1, ancho: 0.95, curva: 2, demora: 0.9, dura: 2 },
    { ang: -Math.PI * 0.84, alto: 0.7, ancho: 0.8, curva: -2.5, demora: 0.3, dura: 2.4 },
    { ang: -Math.PI * 0.16, alto: 0.75, ancho: 0.8, curva: 2.5, demora: 1.2, dura: 2.3 },
    { ang: -Math.PI * 0.98, alto: 0.45, ancho: 0.7, curva: -2, demora: 0.7, dura: 2.6 },
    { ang: -Math.PI * 0.02, alto: 0.5, ancho: 0.7, curva: 2, demora: 1.5, dura: 2.5 },
  ]
  let cuenta = 0

  window.SEK_PIEDRA_SHINOBI = function ({ id, kanji, validos, necesarios, tam = 96, reducido = false, golpe = false }) {
    const u = `p${++cuenta}`
    const forma = formaDe(String(id), necesarios)
    const umbrales = pedazosPara(necesarios)
    const v = Math.max(0, Math.min(validos, necesarios))
    const completo = v >= necesarios
    const caidos = umbrales.filter((p) => v >= p).length
    const caidosAntes = umbrales.filter((p) => v - 1 >= p).length
    // Golpe: solo si se acaba de sumar un día (y hay movimiento).
    const g = golpe && !reducido && v > 0 ? { grieta: v - 1, pedazo: caidos > caidosAntes ? caidos - 1 : null, forjado: completo } : null
    const visibles = completo && !(g && g.forjado) ? [] : forma.cunas.map((_, i) => i).filter((i) => i >= caidos || (!!g && i >= caidosAntes))
    const grietas = forma.grietas.slice(0, v)
    const fuego = completo ? 1 : Math.pow(v / Math.max(1, necesarios), 1.3)
    const grueso = tam < 80 ? 1.6 : 1
    const signos = Math.min(0.9, 0.42 + v * 0.017)
    const nueva = g ? forma.grietas[g.grieta] : null
    const tajo = nueva ? [desde(nueva.fin, nueva.ang, 30), desde(nueva.fin, nueva.ang + Math.PI, 70)] : null
    const k = esc(kanji)
    const fs = completo ? 62 : 50
    const lenguas = LENGUAS.map((l) => {
      const base = completo ? 20 : 33
      const p = desde([50, 52], l.ang, base)
      const h = (completo ? 26 : 8 + 24 * fuego) * l.alto
      const w = (completo ? 7 : 6) * l.ancho
      return `<path class="pf-lengua" fill="url(#pl${u})" d="M${(p[0] - w).toFixed(1)},${p[1].toFixed(1)} Q${(p[0] - w * 0.7).toFixed(1)},${(p[1] - h * 0.55).toFixed(1)} ${(p[0] + l.curva).toFixed(1)},${(p[1] - h).toFixed(1)} Q${(p[0] + w * 0.8).toFixed(1)},${(p[1] - h * 0.5).toFixed(1)} ${(p[0] + w).toFixed(1)},${p[1].toFixed(1)} Z" style="animation-delay: ${l.demora}s; animation-duration: ${l.dura}s; transform-origin: ${p[0].toFixed(1)}px ${p[1].toFixed(1)}px;"/>`
    }).join('')
    const pedazos = visibles.map((i) => {
      const cae = g && (g.pedazo === i || g.forjado)
      const c = forma.centros[i]
      const dx = (c[0] - forma.centro[0]) * (g && g.forjado ? 1.6 : 0.6)
      const dy = g && g.forjado ? (c[1] - forma.centro[1]) * 1.6 : 70
      const gr = grietas.map((x, n) => `<g class="${g && n === g.grieta ? 'pf-grieta nueva' : 'pf-grieta'}">
          <path d="${x.cinta}" class="pf-grieta-luz" transform="translate(0.5 0.7)"/>
          <path d="${x.d}" class="pf-grieta-tinta" stroke-width="${x.ancho * grueso}" pathLength="1"/>
          ${g && n === g.grieta ? `<path d="${x.d}" class="pf-grieta-abre" stroke-width="${x.ancho * grueso}" pathLength="1"/>` : ''}
          <path d="${x.d}" class="pf-grieta-brillo" stroke-width="${x.ancho * grueso * 1.3}" style="opacity: ${0.35 + fuego * 0.6};" pathLength="1"/>
          <path d="${x.d}" class="pf-grieta-roja" stroke-width="${Math.max(0.5, x.ancho * grueso * 0.45)}" pathLength="1"/></g>`).join('')
      return `<g clip-path="url(#pw${u}${i})" class="${cae ? (g.forjado ? 'pf-pedazo estalla' : 'pf-pedazo cae') : 'pf-pedazo'}" style="--dx: ${dx.toFixed(1)}px; --dy: ${dy.toFixed(1)}px; --rot: ${(i % 2 ? 1 : -1) * (14 + i * 4)}deg; transform-origin: ${c[0].toFixed(1)}px ${c[1].toFixed(1)}px;">
        <g clip-path="url(#pc${u})">
          ${forma.facetas.map((f) => `<path d="${f.d}" class="pf-faceta ${f.tono}"/>`).join('')}
          <g class="pf-signos" style="opacity: ${signos};"><path d="${forma.signos.shuriken}"/><path d="${forma.signos.kasa}" class="linea"/><path d="${forma.signos.katana}" class="linea"/>
            ${forma.signos.trazos.map((_, n) => `<text clip-path="url(#pt${u}${n})" x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="64" class="pf-trazo">${k}</text>`).join('')}</g>
          ${gr}
        </g>
        <path d="${forma.luz}" class="pf-luz" clip-path="url(#pc${u})"/>
        <path d="${forma.contorno}" class="pf-borde"/>
      </g>`
    }).join('')
    let golpeSvg = ''
    if (g && tajo) {
      const esquirlas = Array.from({ length: 6 }, (_, n) => {
        const a = nueva.ang + Math.PI / 2 + (n - 2.5) * 0.5
        const p = nueva.fin
        return `<path class="pf-esquirla" d="M${p[0]},${p[1]} l2.2,-1 l-0.6,2.4 Z" style="--ex: ${(Math.cos(a) * (14 + n * 3)).toFixed(1)}px; --ey: ${(Math.sin(a) * (14 + n * 3) - 8).toFixed(1)}px; animation-delay: ${0.12 + n * 0.02}s;"/>`
      }).join('')
      const polvo = g.pedazo !== null || g.forjado ? Array.from({ length: 6 }, (_, n) => {
        const c = g.forjado ? forma.centro : forma.centros[g.pedazo || 0]
        return `<circle class="pf-polvo" cx="${c[0] + (n - 2.5) * 5}" cy="${Math.min(94, c[1] + 26)}" r="${2 + (n % 3) * 0.8}" style="animation-delay: ${0.7 + n * 0.04}s;"/>`
      }).join('') : ''
      golpeSvg = `<g class="pf-golpe" aria-hidden="true"><circle class="pf-destello" cx="${nueva.inicio[0]}" cy="${nueva.inicio[1]}" r="20"/><path class="pf-tajo" d="${camino(tajo)}" pathLength="1"/>${esquirlas}${polvo}</g>`
    }
    return `<svg class="piedra-forja ${completo ? 'forjada' : ''} ${g ? 'golpe' : ''} ${g && g.forjado ? 'estallando' : ''} ${reducido ? 'quieta' : ''}" viewBox="-6 -6 112 116" width="${tam}" height="${(tam * 116) / 112}" role="img" aria-label="${completo ? `Forjado: ${k}` : `Piedra: ${v} de ${necesarios} días`}">
      <defs>
        <linearGradient id="pg${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C766F"/><stop offset="1" stop-color="#47433F"/></linearGradient>
        <radialGradient id="ph${u}" cx="0.5" cy="0.5" r="0.55"><stop offset="0" stop-color="#0c0b0a" stop-opacity="0.8"/><stop offset="0.7" stop-color="#0c0b0a" stop-opacity="0.45"/><stop offset="1" stop-color="#0c0b0a" stop-opacity="0"/></radialGradient>
        <radialGradient id="pa${u}" cx="0.5" cy="0.55" r="0.5"><stop offset="0" stop-color="#ff7a2e" stop-opacity="0.95"/><stop offset="0.45" stop-color="#e0213b" stop-opacity="0.7"/><stop offset="1" stop-color="#b0101f" stop-opacity="0"/></radialGradient>
        <linearGradient id="pl${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a3a" stop-opacity="0.95"/><stop offset="0.5" stop-color="#e0213b" stop-opacity="0.75"/><stop offset="1" stop-color="#e0213b" stop-opacity="0"/></linearGradient>
        <clipPath id="pc${u}"><path d="${forma.contorno}"/></clipPath>
        ${forma.cunas.map((d, i) => `<clipPath id="pw${u}${i}"><path d="${d}"/></clipPath>`).join('')}
        ${forma.signos.trazos.map((t, i) => `<clipPath id="pt${u}${i}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}"/></clipPath>`).join('')}
      </defs>
      <ellipse class="pf-sombra" cx="50" cy="99" rx="${completo ? 26 : 40}" ry="5"/>
      ${fuego > 0.03 ? `<g class="pf-aura" aria-hidden="true" style="opacity: ${Math.min(1, 0.15 + fuego * 0.85)};"><circle class="pf-aura-brasa" cx="50" cy="52" r="${(completo ? 34 : 40) + fuego * 16}" fill="url(#pa${u})" style="opacity: ${completo ? 0.9 : fuego * 0.8};"/>${lenguas}</g>` : ''}
      ${!completo && caidos > 0 ? `<path d="${forma.contorno}" fill="url(#ph${u})"/>` : ''}
      <g ${completo ? '' : `clip-path="url(#pc${u})"`}><g class="pf-kanji ${completo ? 'arde' : ''}">
        <text class="pf-kanji-sombra" x="54" y="56" text-anchor="middle" dominant-baseline="central" font-size="${fs}">${k}</text>
        <text class="pf-kanji-tinta" x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="${fs}">${k}</text>
      </g></g>
      ${!completo ? `<path d="${forma.brasa}" class="pf-brasa-borde" style="opacity: ${0.35 + fuego * 0.4};"/>` : ''}
      ${caidos === 0 ? `<path d="${forma.contorno}" class="pf-faceta medio"/>` : ''}
      ${pedazos}
      ${golpeSvg}
    </svg>`
  }
})()
