// Gráficos de Progreso: SVG a mano, sin librerías. Usan los colores generales (var(--acento), var(--verde)…).
// Devuelven el texto del <svg> para ponerlo con innerHTML. Los valores null quedan como hueco.
(function () {
  'use strict'

  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const diaMes = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}` }

  /** Barras: [{ valor, etiqueta?, titulo?, clase? }]. Con negativos dibuja la línea del 0. */
  function barras(puntos, { alto = 120, ancho = 320, unidad = '' } = {}) {
    if (!puntos.length) return ''
    const vals = puntos.map((p) => p.valor ?? 0)
    const max = Math.max(1, ...vals)
    const min = Math.min(0, ...vals)
    const rango = max - min || 1
    const y0 = 6 + ((max - 0) / rango) * (alto - 22)
    const paso = ancho / puntos.length
    const w = Math.max(2, paso * 0.7)
    const cuerpo = puntos.map((p, i) => {
      const x = i * paso + (paso - w) / 2
      if (p.valor === null || p.valor === undefined) return `<rect x="${x}" y="${y0 - 1}" width="${w}" height="2" class="g-vacio"><title>${esc(p.titulo || '')}sin dato</title></rect>`
      const h = Math.max(1, (Math.abs(p.valor) / rango) * (alto - 22))
      const y = p.valor >= 0 ? y0 - h : y0
      const clase = p.clase || (p.valor < 0 ? 'g-menos' : 'g-mas')
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${clase}"><title>${esc(p.titulo || '')}${p.valor}${esc(unidad)}</title></rect>`
    }).join('')
    const marcas = puntos.length <= 10
      ? puntos.map((p, i) => p.etiqueta ? `<text x="${(i * paso + paso / 2).toFixed(1)}" y="${alto - 2}" class="g-texto" text-anchor="middle">${esc(p.etiqueta)}</text>` : '').join('')
      : [0, puntos.length - 1].map((i) => puntos[i].etiqueta ? `<text x="${i === 0 ? 0 : ancho}" y="${alto - 2}" class="g-texto" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(puntos[i].etiqueta)}</text>` : '').join('')
    return `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" role="img" preserveAspectRatio="none"><line x1="0" x2="${ancho}" y1="${y0}" y2="${y0}" class="g-cero"/>${cuerpo}${marcas}</svg>`
  }

  /** Línea: [{ valor, etiqueta? }]. Para peso, reps, acumulado. */
  function linea(puntos, { alto = 120, ancho = 320, unidad = '' } = {}) {
    const con = puntos.map((p, i) => ({ ...p, i })).filter((p) => p.valor !== null && p.valor !== undefined)
    if (!con.length) return ''
    const vals = con.map((p) => p.valor)
    const max = Math.max(...vals)
    const min = Math.min(...vals)
    const rango = max - min || 1
    const paso = puntos.length > 1 ? ancho / (puntos.length - 1) : 0
    const xy = (p) => [p.i * paso, 8 + (1 - (p.valor - min) / rango) * (alto - 28)]
    const d = con.map((p, k) => { const [x, y] = xy(p); return `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
    const pts = con.map((p) => { const [x, y] = xy(p); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="g-punto"><title>${esc(p.titulo || '')}${p.valor}${esc(unidad)}</title></circle>` }).join('')
    const pie = `<text x="0" y="${alto - 2}" class="g-texto">${esc(puntos[0].etiqueta || '')}</text><text x="${ancho}" y="${alto - 2}" class="g-texto" text-anchor="end">${esc(puntos[puntos.length - 1].etiqueta || '')}</text>`
    const tope = `<text x="${ancho}" y="10" class="g-texto" text-anchor="end">${max}${esc(unidad)}</text>`
    return `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" role="img" preserveAspectRatio="none"><path d="${d}" class="g-linea"/>${pts}${pie}${tope}</svg>`
  }

  /** Miniatura (para los botones de sección). */
  function mini(valores) {
    const v = valores.filter((x) => x !== null && x !== undefined)
    if (v.length < 2) return ''
    return linea(valores.map((valor) => ({ valor })), { alto: 22, ancho: 70 }).replace('class="grafico"', 'class="grafico mini"').replace(/<text[^>]*>[^<]*<\/text>/g, '')
  }

  /**
   * 道 La montaña: el acumulado de XP día por día del ciclo, con lo neto de cada día abajo y las marcas
   * (▼ caída, ◆ forja, • día marcado). `camino` viene de /api/progreso; `duracion` = días del ciclo.
   */
  function montana(camino, duracion, { alto = 170, ancho = 340 } = {}) {
    if (!camino.length) return ''
    const total = Math.max(duracion, camino.length)
    const paso = ancho / Math.max(1, total - 1)
    const max = Math.max(1, ...camino.map((d) => d.acumulado))
    const arriba = 18
    const base = alto - 34
    const y = (v) => base - (v / max) * (base - arriba)
    const pts = camino.map((d, i) => [i * paso, y(d.acumulado)])
    const linea = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ')
    const area = `${linea} L${pts[pts.length - 1][0].toFixed(1)},${base} L0,${base} Z`
    const maxNeto = Math.max(1, ...camino.map((d) => Math.abs(d.neto)))
    const netos = camino.map((d, i) => {
      if (!d.neto) return ''
      const h = (Math.abs(d.neto) / maxNeto) * 14
      return `<rect x="${(i * paso - Math.max(1, paso * 0.35)).toFixed(1)}" y="${d.neto > 0 ? alto - 16 - h : alto - 16}" width="${Math.max(2, paso * 0.7).toFixed(1)}" height="${h.toFixed(1)}" class="${d.neto > 0 ? 'g-mas' : 'g-menos'}"><title>Día ${d.dia} · ${diaMes(d.fecha)} · ${d.neto > 0 ? '+' : ''}${d.neto} XP (+${d.ganado} / −${d.perdido})</title></rect>`
    }).join('')
    const marcas = camino.map((d, i) => {
      const [x, yy] = pts[i]
      const t = `Día ${d.dia} · ${diaMes(d.fecha)} · ${d.acumulado} XP${d.pilares ? ` · ${d.pilares.hechos}/${d.pilares.total} pilares` : ''}${d.marca ? ` · ${d.marca}` : ''}`
      const r = []
      if (d.caida) r.push(`<path d="M${(x - 4).toFixed(1)},${(yy - 10).toFixed(1)} h8 l-4,7 z" class="g-caida"><title>${esc(t)} · caída superada</title></path>`)
      else if (d.forja) r.push(`<rect x="${(x - 3).toFixed(1)}" y="${(yy - 10).toFixed(1)}" width="6" height="6" transform="rotate(45 ${x.toFixed(1)} ${(yy - 7).toFixed(1)})" class="g-forja"><title>${esc(t)} · forja</title></rect>`)
      if (d.marca) r.push(`<circle cx="${x.toFixed(1)}" cy="${(yy + 7).toFixed(1)}" r="2.5" class="g-marca"><title>${esc(t)}</title></circle>`)
      return r.join('')
    }).join('')
    const ult = pts[pts.length - 1]
    const hoy = `<circle cx="${ult[0].toFixed(1)}" cy="${ult[1].toFixed(1)}" r="5" class="g-hoy"><title>Hoy · ${camino[camino.length - 1].acumulado} XP</title></circle>`
    const pie = `<text x="0" y="${alto - 1}" class="g-texto">Día 1</text><text x="${ancho}" y="${alto - 1}" class="g-texto" text-anchor="end">Día ${total}</text>`
    return `<svg class="grafico montana" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="La montaña de XP del ciclo"><path d="${area}" class="g-area"/><path d="${linea}" class="g-linea"/>${netos}${marcas}${hoy}${pie}</svg>`
  }

  /** Anillo de un pilar: porcentaje hecho de lo programado. */
  function anillo(nombre, hechos, total) {
    const v = total ? hechos / total : 0
    const c = 2 * Math.PI * 24
    return `<div class="anillo"><svg viewBox="0 0 56 56" aria-hidden="true"><circle class="fondo" cx="28" cy="28" r="24"/><circle class="valor" cx="28" cy="28" r="24" stroke-dasharray="${(v * c).toFixed(1)} ${c.toFixed(1)}"/><text x="28" y="28">${total ? Math.round(v * 100) + '%' : '—'}</text></svg><span class="chico">${esc(nombre)}</span><span class="chico apagado">${hechos} de ${total}</span></div>`
  }

  window.SEK = window.SEK || {}
  window.SEK.grafico = { barras, linea, mini, montana, anillo, diaMes, esc }
})()
