// Una sección de Progreso a pantalla completa, igual que la v0.88.27 (Progreso.tsx de la app vieja, /progreso/xp…),
// sobre el guerrero bajo la lluvia. /progreso/seccion?cual=xp|metas|sueno|fuerza|series|pilares|comida
// Lee las rutas /api/progreso/… de su módulo y, para lo que es de otro módulo, su ruta (/api/series, /api/ciclo/metas,
// /api/xp/…, /api/comida). Solo muestra: no cambia nada.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, fechaLegible, litros } = SEK.v88
  SEK.v88.montar({ activo: 'progreso', companero: 'esquina' })

  const NOMBRE = { xp: 'XP', pilares: 'Pilares', metas: 'Metas', sueno: 'Sueño', fuerza: 'Fuerza', series: 'Series rápidas', comida: 'Comida' }
  const cual = NOMBRE[new URLSearchParams(location.search).get('cual')] ? new URLSearchParams(location.search).get('cual') : 'xp'
  $('#titulo').textContent = NOMBRE[cual]
  document.title = `SEK · ${NOMBRE[cual]}`

  const sumarDias = (f, n) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  const difDias = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)
  const lunesDe = (f) => sumarDias(f, -((new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7))
  const diaMes = (f) => fechaLegible(f).split(' ').slice(1).join(' ')
  const duracion = (min) => { const h = Math.floor(min / 60); const m = Math.round(min % 60); return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min` }
  const kg = (n) => `${String(n).replace('.', ',')} kg`
  const nota = (t, estilo = '') => `<div class="av-nota"${estilo ? ` style="${estilo}"` : ''}>${t}</div>`
  const seg = (rango, id) => `<div class="seg oscuro" role="tablist" data-seg="${id}">${['semana', 'mes', 'ciclo'].map((r) => `<button type="button" role="tab" data-rango="${r}" aria-selected="${rango === r}" class="${rango === r ? 'activo' : ''}">${r === 'semana' ? 'Semana' : r === 'mes' ? 'Mes' : 'Ciclo'}</button>`).join('')}</div>`
  /** Un toque elige; otro toque en lo mismo, suelta. */
  const alternar = (actual, nuevo) => (actual === nuevo ? null : nuevo)
  const caja = $('#tarjetas')

  // El guerrero de fondo: el mismo que en el resumen (pide el día del ciclo a /api/progreso).
  let fondo = null
  function ponerFondo(r) { if (!fondo && window.SEK_FONDO_PROGRESO) fondo = SEK_FONDO_PROGRESO({ hoy: r.hoy, diaUno: r.ciclo && r.ciclo.inicio, vista: 'codigo' }) }

  // ======================= XP =======================
  async function xp() {
    const [r, niveles] = await Promise.all([api('/api/progreso'), api('/api/xp/niveles')])
    ponerFondo(r)
    let rango = 'semana'
    let sel = null
    caja.innerHTML = `<section class="av-tarjeta" id="xp-grafico"></section><section class="av-tarjeta xp-historial" id="xp-historial" aria-label="Historial de XP"></section>`
    const conCiclo = r.ciclo && !r.ciclo.noEmpezado
    function pintar() {
      const t = $('#xp-grafico')
      if (!conCiclo) { t.innerHTML = `<div class="av-tarjeta-titulo"><span>XP</span>${seg(rango, 'xp')}</div>${nota(`El gráfico empieza el Día 1${r.ciclo ? ` (${fechaLegible(r.ciclo.inicio)})` : ''}.`, 'text-align: center; padding: 18px 0;')}`; enganchar(); return }
      t.innerHTML = `<div class="av-tarjeta-titulo"><span>XP</span>${seg(rango, 'xp')}</div>${graficoXp(r, niveles.base, rango, sel)}`
      enganchar()
      const svg = t.querySelector('svg')
      svg.onclick = (e) => {
        const g = svg._m
        const rect = svg.getBoundingClientRect()
        const px = ((e.clientX - rect.left) / rect.width) * 360
        const dia = Math.round(g.d0 + ((px - 6) / g.ancho) * (g.d1 - g.d0))
        const cerca = g.visibles.reduce((m, p) => (!m || Math.abs(p.dia - dia) < Math.abs(m.dia - dia) ? p : m), null)
        sel = cerca ? alternar(sel, cerca.dia) : null
        pintar()
      }
    }
    function enganchar() { caja.querySelectorAll('[data-seg=xp] [data-rango]').forEach((b) => { b.onclick = () => { rango = b.dataset.rango; sel = null; pintar() } }) }
    pintar()
    historialXp(r.hoy)
  }

  /**
   * Gráfico de XP: línea gruesa del acumulado con área, puntos donde subiste de nivel, línea punteada hasta el
   * próximo nivel y, debajo, las barras del XP de cada día. Tocar un punto muestra el detalle del día.
   */
  function graficoXp(r, base, rango, sel) {
    const W = 360, H = 150, HB = 56, mi = { arriba: 14, abajo: 14, izq: 6, der: 6 }
    const c = r.ciclo, n = r.nivel, total = n.xpTotal, hoy = r.hoy
    const serie = r.camino.map((d) => ({ fecha: d.fecha, dia: d.dia, xp: d.neto, acumulado: d.acumulado, pilares: d.pilares }))
    const faltan = n.xpInicioSiguiente - total
    const diaHoy = Math.max(1, Math.min(c.duracionDias, difDias(c.inicio, hoy) + 1))
    let d0, d1
    if (rango === 'ciclo') { d0 = 1; d1 = c.duracionDias } else {
      const k = rango === 'semana' ? 7 : 30
      d1 = diaHoy; d0 = Math.max(1, d1 - k + 1)
      if (d1 - d0 + 1 < k) d1 = Math.min(c.duracionDias, d0 + k - 1)
    }
    const visibles = serie.filter((p) => p.dia >= d0 && p.dia <= d1)
    const minY = Math.min(total, ...visibles.map((p) => p.acumulado - p.xp))
    const maxY = Math.max(total, ...visibles.map((p) => p.acumulado))
    const yMin = rango === 'ciclo' ? 0 : Math.max(0, Math.floor(minY * 0.9))
    const yMax = Math.max(Math.ceil(n.xpInicioSiguiente * 1.06), Math.ceil(maxY * 1.1), yMin + 50)
    const ancho = W - mi.izq - mi.der, alto = H - mi.arriba - mi.abajo
    const x = (dia) => mi.izq + ((dia - d0) / Math.max(1, d1 - d0)) * ancho
    const y = (v) => mi.arriba + alto - ((v - yMin) / (yMax - yMin)) * alto
    const xpPara = (k) => (base * (k - 1) * k) / 2
    const subidas = []
    for (const p of visibles) {
      const antes = p.acumulado - p.xp
      for (let k = 2; k < 400; k++) { const u = xpPara(k); if (u > p.acumulado) break; if (u > antes) subidas.push({ dia: p.dia, nivel: k, xp: p.acumulado }) }
    }
    const maxBarra = Math.max(1, ...visibles.map((p) => p.xp))
    const ruta = visibles.map((p, i) => `${i ? 'L' : 'M'}${x(p.dia).toFixed(1)},${y(p.acumulado).toFixed(1)}`).join(' ')
    const ultimo = visibles[visibles.length - 1]
    const area = ultimo ? `${ruta} L${x(ultimo.dia).toFixed(1)},${y(yMin).toFixed(1)} L${x(visibles[0].dia).toFixed(1)},${y(yMin).toFixed(1)} Z` : ''
    const puntoHoy = visibles.find((p) => p.fecha === hoy)
    const s = sel !== null ? visibles.find((p) => p.dia === sel) : null
    const anchoBarra = Math.max(2, (ancho / Math.max(1, d1 - d0 + 1)) * 0.6)
    const yMeta = y(n.xpInicioSiguiente)
    const animar = !matchMedia('(prefers-reduced-motion: reduce)').matches
    const barras = visibles.map((p) => {
      const baseY = H + HB - 6
      const h = p.xp > 0 ? Math.max(4, (p.xp / maxBarra) * (HB - 14)) : 2
      return `<rect class="barra-dia ${p.xp === 0 ? 'cero' : ''} ${sel === p.dia ? 'sel' : ''} ${p.fecha === hoy ? 'hoy' : ''}" x="${x(p.dia) - anchoBarra / 2}" y="${baseY - h}" width="${anchoBarra}" height="${h}" rx="${Math.min(3, anchoBarra / 3)}"/>`
    }).join('')
    const svg = `<svg class="grafico" viewBox="0 0 ${W} ${H + HB}" role="img" aria-label="XP acumulado: ${total} XP al día ${diaHoy}. Te faltan ${faltan} XP para el nivel ${n.nivel + 1}">
      <defs><linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--acento)" stop-opacity="0.45"/><stop offset="100%" stop-color="var(--acento)" stop-opacity="0.02"/></linearGradient></defs>
      <line class="meta-linea" x1="${mi.izq}" x2="${W - mi.der}" y1="${yMeta}" y2="${yMeta}"/>
      <text class="meta-etq" x="${W - mi.der}" y="${yMeta - 4}" text-anchor="end">Nivel ${n.nivel + 1} · faltan ${faltan} XP</text>
      ${area ? `<path class="area" d="${area}"/>` : ''}
      ${ruta ? `<path class="linea gruesa ${animar ? 'dibujo' : ''}" d="${ruta}"/>` : ''}
      ${subidas.map((u) => `<g class="subida"><circle cx="${x(u.dia)}" cy="${y(u.xp)}" r="9"/><text x="${x(u.dia)}" y="${y(u.xp) + 3.5}" text-anchor="middle">${u.nivel}</text></g>`).join('')}
      ${s ? `<g><line class="sel-linea" x1="${x(s.dia)}" x2="${x(s.dia)}" y1="${mi.arriba}" y2="${H + HB - 4}"/><circle class="sel-punto" cx="${x(s.dia)}" cy="${y(s.acumulado)}" r="4"/></g>` : ''}
      ${puntoHoy ? `<circle class="hoy-punto ${animar ? 'late' : ''}" cx="${x(puntoHoy.dia)}" cy="${y(puntoHoy.acumulado)}" r="5"/>` : ''}
      <text class="eje" x="${mi.izq}" y="${H - 2}">día ${d0}</text>
      <text class="eje" x="${W - mi.der}" y="${H - 2}" text-anchor="end">día ${d1}</text>
      ${barras}
    </svg>`
    const info = s
      ? `<div class="grafico-info"><span><b>${fechaLegible(s.fecha)}</b> <span class="av-nota">· día ${s.dia}</span></span><span class="av-mono">${s.xp >= 0 ? '+' : '−'}${Math.abs(s.xp)} XP <span class="av-nota">· ${s.acumulado} total</span></span><span class="pil" title="${s.pilares.hechos} de ${s.pilares.total} pilares">${Array.from({ length: s.pilares.total }, (_, i) => `<i class="${i < s.pilares.hechos ? 'cumplido' : s.fecha < hoy ? 'omitido' : ''}"></i>`).join('')}</span></div>`
      : nota(`hoy +${r.secciones.xp.hoy} · esta semana +${r.secciones.xp.semana} · desde el Día 1 (${fechaLegible(c.inicio)}). Tocá un punto para ver ese día.`)
    // Guarda la escala en el svg para el toque (se lee en xp()).
    setTimeout(() => { const el = $('#xp-grafico svg'); if (el) el._m = { d0, d1, ancho, visibles } })
    return `<div class="col" style="gap: 6px;">${svg}${info}</div>`
  }

  /** Historial de XP por día: lo que sumó y lo que restó, con su nombre («−8 XP · Entrenamiento sin hacer»). */
  async function historialXp(hoy) {
    let dias = 7
    const { movimientos } = await api('/api/xp/historial?cantidad=200')
    const validos = movimientos.filter((m) => !m.anulado)
    function pintar() {
      const desde = sumarDias(hoy, -(dias - 1))
      const porDia = new Map()
      for (const m of validos) if (m.fecha >= desde && m.fecha <= hoy) porDia.set(m.fecha, [...(porDia.get(m.fecha) || []), m])
      const masViejo = validos.some((m) => m.fecha < desde)
      const grupos = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]))
      $('#xp-historial').innerHTML = `<div class="av-tarjeta-titulo"><span>Historial de XP</span></div>
        ${grupos.length ? '' : '<p class="av-nota" style="margin: 0;">Sin XP en estos días.</p>'}
        ${grupos.map(([f, l]) => {
          l.sort((a, b) => a.creado - b.creado)
          const mas = l.filter((x) => x.cantidad > 0).reduce((s, x) => s + x.cantidad, 0)
          const menos = -l.filter((x) => x.cantidad < 0).reduce((s, x) => s + x.cantidad, 0)
          return `<div class="xp-dia"><div class="xp-dia-cab"><b>${f === hoy ? 'Hoy' : fechaLegible(f)}</b><span class="av-mono">+${mas}${menos > 0 ? ` / <span class="xp-menos">−${menos}</span>` : ''}</span></div>
            ${l.map((x) => `<div class="xp-linea ${x.cantidad < 0 ? 'resta' : ''}"><span class="av-mono xp-cant">${x.cantidad < 0 ? `−${-x.cantidad}` : `+${x.cantidad}`} XP</span><span class="xp-desc">${esc(x.descripcion)}</span></div>`).join('')}</div>`
        }).join('')}
        ${masViejo ? '<button type="button" class="boton chico suave ancho" data-mas>Ver más</button>' : ''}`
      const b = $('#xp-historial [data-mas]')
      if (b) b.onclick = () => { dias += 7; pintar() }
    }
    pintar()
  }

  // ======================= Metas =======================
  async function metas() {
    const [r, m] = await Promise.all([api('/api/progreso'), api('/api/ciclo/metas')])
    ponerFondo(r)
    const hoy = r.hoy
    const conCiclo = r.ciclo && !r.ciclo.noEmpezado
    const inicio = conCiclo ? r.ciclo.inicio : hoy
    const fin = r.ciclo ? r.ciclo.fechaFin : sumarDias(hoy, 89)
    // Cada meta en su fecha, con su estado: cumplida, no cumplida (o vencida sin respuesta) o pendiente.
    const todas = [...m.cumplidas.map((x) => ({ ...x, e: 'cumplida' })), ...m.noCumplidas.map((x) => ({ ...x, e: 'no' })), ...m.vencidas.map((x) => ({ ...x, e: x.fecha < hoy ? 'no' : 'pend' })), ...m.pendientes.map((x) => ({ ...x, e: 'pend' }))]
    let rango = 'semana'
    let sel = null
    caja.innerHTML = '<section class="av-tarjeta" id="metas"></section>'
    function pintar() {
      const grupos = []
      if (rango === 'semana') { const l = lunesDe(hoy); for (let i = 0; i < 7; i++) { const f = sumarDias(l, i); grupos.push({ etq: 'LMXJVSD'[i], desde: f, hasta: f }) } }
      else if (rango === 'mes') { for (let f = hoy.slice(0, 8) + '01'; f.slice(0, 7) === hoy.slice(0, 7); f = sumarDias(f, 1)) grupos.push({ etq: String(Number(f.slice(8))), desde: f, hasta: f }) }
      else { for (let f = inicio, k = 1; f <= fin; f = sumarDias(f, 7), k++) grupos.push({ etq: `S${k}`, desde: f, hasta: sumarDias(f, 6) < fin ? sumarDias(f, 6) : fin }) }
      const filas = grupos.map((g) => { const l = todas.filter((x) => x.fecha >= g.desde && x.fecha <= g.hasta); return { ...g, metas: l, c: l.filter((x) => x.e === 'cumplida').length, n: l.filter((x) => x.e === 'no').length, p: l.filter((x) => x.e === 'pend').length } })
      const max = Math.max(1, ...filas.map((f) => f.c + f.n + f.p))
      const enCiclo = todas.filter((x) => x.fecha >= inicio && x.fecha <= fin)
      const cumplidas = enCiclo.filter((x) => x.e === 'cumplida').length
      const resueltas = enCiclo.filter((x) => x.e !== 'pend').length
      const W = 300, H = 80, paso = W / filas.length, ancho = Math.max(3, Math.min(26, paso * 0.62))
      const elegida = sel !== null ? filas[sel] : null
      $('#metas').innerHTML = `<div class="av-tarjeta-titulo"><span>Metas</span>${seg(rango, 'metas')}</div>
        ${!enCiclo.length ? nota('Todavía no pusiste metas. Tocá un día en el calendario para agregar una.', 'text-align: center; padding: 14px 0;') : `
        <div class="metas-resumen"><span class="av-grande">${cumplidas}<span class="metas-de">/${enCiclo.length}</span></span><span class="av-nota">cumplidas en el ciclo${resueltas ? ` · ${Math.round((100 * cumplidas) / resueltas)} %` : ''}</span></div>
        <svg class="grafico-metas" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="Metas: ${cumplidas} cumplidas de ${enCiclo.length}">
          ${filas.map((f, i) => {
            const xx = i * paso + (paso - ancho) / 2
            const hC = (H * f.c) / max, hN = (H * f.n) / max, hP = (H * f.p) / max
            return `<g data-i="${i}" style="cursor: pointer;"><rect x="${i * paso}" y="0" width="${paso}" height="${H + 14}" fill="transparent"/>
              ${f.c + f.n + f.p === 0 ? `<rect class="gm-vacia" x="${xx}" y="${H - 2}" width="${ancho}" height="2" rx="1"/>` : ''}
              ${hC ? `<rect class="gm-cumplida" x="${xx}" y="${H - hC}" width="${ancho}" height="${hC}" rx="2"/>` : ''}
              ${hN ? `<rect class="gm-no" x="${xx}" y="${H - hC - hN}" width="${ancho}" height="${hN}" rx="2"/>` : ''}
              ${hP ? `<rect class="gm-pend" x="${xx}" y="${H - hC - hN - hP}" width="${ancho}" height="${hP}" rx="2"/>` : ''}
              ${sel === i ? `<rect class="gm-sel" x="${xx - 2}" y="0" width="${ancho + 4}" height="${H}" rx="3"/>` : ''}
              ${filas.length <= 14 || i % 5 === 0 ? `<text class="eje" x="${i * paso + paso / 2}" y="${H + 11}" text-anchor="middle">${f.etq}</text>` : ''}</g>`
          }).join('')}
        </svg>
        <div class="leyenda-metas av-nota"><i class="gm-cumplida"></i>cumplidas <i class="gm-no"></i>no cumplidas <i class="gm-pend"></i>pendientes</div>
        ${elegida ? `<div class="metas-elegidas"><span class="av-nota">${elegida.desde === elegida.hasta ? fechaLegible(elegida.desde) : `${fechaLegible(elegida.desde)} a ${fechaLegible(elegida.hasta)}`}</span>
          ${elegida.metas.length ? elegida.metas.map((x) => `<div class="fila chico" style="gap: 8px;"><span>${x.e === 'cumplida' ? '✓' : x.e === 'no' ? '✕' : '·'}</span><span>${esc(x.titulo)}</span><span class="av-nota">${diaMes(x.fecha)}</span></div>`).join('') : '<span class="av-nota">Sin metas.</span>'}</div>` : ''}`}`
      caja.querySelectorAll('[data-seg=metas] [data-rango]').forEach((b) => { b.onclick = () => { rango = b.dataset.rango; sel = null; pintar() } })
      caja.querySelectorAll('.grafico-metas [data-i]').forEach((g) => { g.onclick = () => { sel = alternar(sel, Number(g.dataset.i)); pintar() } })
    }
    pintar()
    caja.insertAdjacentHTML('beforeend', '<a href="/ciclo/metas" class="boton ancho">Mis metas ›</a>')
  }

  // ======================= Sueño =======================
  async function sueno() {
    const [p, s] = await Promise.all([api('/api/progreso'), api('/api/progreso/sueno')])
    ponerFondo(p)
    const r = s.resumen
    const m = r.mejora
    const ultimas = r.noches.slice(-7)
    const tope = Math.max(r.objetivoMinutos + 60, ...ultimas.map((n) => n.minutos))
    const flecha = (a, b, mejorEsMas) => {
      if (a === null || b === null || Math.abs(a - b) < 5) return ''
      const sube = a > b
      return `<span class="${sube === mejorEsMas ? 'av-verde' : 'av-rojo'}">${sube ? ' ↑' : ' ↓'}</span>`
    }
    caja.innerHTML = `<a href="/sueno" class="av-tarjeta av-tocable" style="display: block; color: inherit;" aria-label="Sueño. Tocá para abrir la pantalla Sueño">
      <div class="av-tarjeta-titulo"><span>Sueño</span><span class="av-nota">esta semana ›</span></div>
      ${ultimas.length ? `<div class="av-sueno">
        <div class="av-sueno-cifras">
          <div><b class="av-mono">${m.semana !== null ? duracion(m.semana) : '—'}${flecha(m.semana, m.semanaAnterior, true)}</b><span class="av-nota">por noche</span></div>
          <div><b class="av-mono">${m.regularidad !== null ? `±${m.regularidad}′` : '—'}${flecha(m.regularidad, m.regularidadAnterior, false)}</b><span class="av-nota">regularidad</span></div>
          <div><b class="av-mono">${m.racha}</b><span class="av-nota">a horario</span></div>
        </div>
        <svg class="av-sueno-mini" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="100" y1="${40 - (r.objetivoMinutos / tope) * 38}" y2="${40 - (r.objetivoMinutos / tope) * 38}" class="av-sueno-objetivo"/>
          ${ultimas.map((n, i) => { const w = 100 / 7; const h = (n.minutos / tope) * 38; return `<rect x="${i * w + w * 0.2}" y="${40 - h}" width="${w * 0.6}" height="${h}" rx="1.5" class="${n.minutos >= r.objetivoMinutos - 15 ? 'ok' : ''}"/>` }).join('')}
        </svg>
      </div>` : nota('Con la primera noche registrada aparece acá cómo dormís.')}
    </a>`
  }

  // ======================= Fuerza =======================
  async function fuerza() {
    const [p, f] = await Promise.all([api('/api/progreso'), api('/api/progreso/fuerza')])
    ponerFondo(p)
    const hoy = p.hoy
    let diaSel = null
    let ejSel = f.ejercicios[0] ? f.ejercicios[0].id : null
    let puntoSel = null
    const cache = new Map()
    caja.innerHTML = '<section class="av-tarjeta" id="entrenos"></section><section class="av-tarjeta" id="ejercicios"></section>'
    function pintarEntrenos() {
      const dias = f.dias || []
      const hechos = dias.filter((d) => d.hecho).length
      const el = diaSel ? dias.find((d) => d.fecha === diaSel) : null
      $('#entrenos').innerHTML = `<div class="av-tarjeta-titulo"><span>Entrenos cumplidos</span><span class="av-nota">${hechos} de ${f.programados} programados</span></div>
        ${dias.length ? `<div class="sr-dias" role="list" aria-label="Entrenos por día del ciclo">${dias.map((d) => `<button type="button" role="listitem" data-dia="${d.fecha}" class="sr-dia ${d.hecho ? 'cuota' : d.programado ? 'no' : 'libre'} ${d.fecha === hoy ? 'hoy' : ''} ${diaSel === d.fecha ? 'sel' : ''}" aria-label="${fechaLegible(d.fecha)}: ${d.hecho ? 'entrenaste' : d.programado ? 'tocaba y no hubo entreno' : 'día libre'}"></button>`).join('')}</div>
          <div class="sr-leyenda" aria-hidden="true"><span><i class="sr-dia no"></i>tocaba</span><span><i class="sr-dia cuota"></i>entrenaste</span><span><i class="sr-dia libre"></i>libre</span></div>
          <div class="av-nota sr-detalle">${el ? `<b>${fechaLegible(el.fecha)}</b> · ${el.hecho ? 'entrenaste ✓' : el.programado ? 'tocaba y no hubo entreno' : 'día libre'}`
            : `Récords del ciclo <b>${f.records.length}</b>${f.ultimaSubida ? ` · última subida: <b>${esc(f.ultimaSubida.nombre)}</b> ${kg(f.ultimaSubida.de)} → ${kg(f.ultimaSubida.a)}, ${diaMes(f.ultimaSubida.fecha)}` : ' · todavía sin subidas de peso'}`}</div>` : nota('Empieza el Día 1.')}`
      $('#entrenos').querySelectorAll('[data-dia]').forEach((b) => { b.onclick = () => { diaSel = alternar(diaSel, b.dataset.dia); pintarEntrenos() } })
    }
    async function pintarEjercicios() {
      const t = $('#ejercicios')
      const cab = '<div class="av-tarjeta-titulo"><span>Peso y reps por ejercicio</span><a href="/entreno" class="enlace av-nota">Mis rutinas ›</a></div>'
      if (!f.ejercicios.length) { t.innerHTML = cab + nota('Con tu primer entreno en modo juego aparecen acá el peso y las reps de cada ejercicio.'); return }
      const ej = f.ejercicios.find((e) => e.id === ejSel) || f.ejercicios[0]
      const chips = `<div class="av-chips" role="tablist" aria-label="Ejercicio">${f.ejercicios.map((e) => `<button type="button" role="tab" data-ej="${esc(e.id)}" aria-selected="${e.id === ej.id}" class="av-chip ${e.id === ej.id ? 'activa' : ''}">${esc(e.nombre)}</button>`).join('')}</div>`
      if (!cache.has(ej.id)) { t.innerHTML = cab + chips + nota('Cargando…'); cache.set(ej.id, await api(`/api/progreso/fuerza/${encodeURIComponent(ej.id)}`)) }
      t.innerHTML = cab + chips + graficosEjercicio(cache.get(ej.id), ej.nombre, hoy, puntoSel)
      t.querySelectorAll('[data-ej]').forEach((b) => { b.onclick = seguro(async () => { ejSel = b.dataset.ej; puntoSel = null; await pintarEjercicios() }) })
      t.querySelectorAll('[data-punto]').forEach((g) => { g.onclick = () => { puntoSel = alternar(puntoSel, Number(g.dataset.punto)); pintarEjercicios() } })
    }
    pintarEntrenos()
    await pintarEjercicios()
  }

  /** Arriba la escalera del peso (un escalón por subida) y abajo las reps de la serie 1, que arrancan de nuevo en cada tramo. */
  function graficosEjercicio(d, nombre, hoy, sel) {
    const { puntos, tramos } = d
    if (!puntos.length) return nota(`Todavía no hay entrenos con ${esc(nombre)}.`)
    const W = 320, HP = 74, HR = 96, mi = { izq: 10, der: 34, arriba: 18, abajo: 16 }
    const inicio = puntos[0].fecha
    const total = Math.max(1, difDias(inicio, hoy))
    const x = (f) => mi.izq + (Math.min(total, Math.max(0, difDias(inicio, f))) / total) * (W - mi.izq - mi.der)
    const pesos = tramos.map((t) => t.peso)
    const pMin = Math.min(...pesos), pMax = Math.max(...pesos)
    const yP = (p) => mi.arriba + (1 - (pMax === pMin ? 0.5 : (p - pMin) / (pMax - pMin))) * (HP - mi.arriba - mi.abajo)
    const rMin = Math.max(0, Math.min(...puntos.map((p) => p.reps)) - 1), rMax = Math.max(...puntos.map((p) => p.reps)) + 1
    const yR = (r) => mi.arriba + (1 - (r - rMin) / Math.max(1, rMax - rMin)) * (HR - mi.arriba - mi.abajo)
    const conTiempo = puntos.filter((q) => q.segundos !== undefined && q.segundos !== null)
    const sMin = conTiempo.length ? Math.min(...conTiempo.map((q) => q.segundos)) : 0
    const sMax = conTiempo.length ? Math.max(...conTiempo.map((q) => q.segundos)) : 1
    const yS = (s) => mi.arriba + (1 - (sMax === sMin ? 0.5 : (s - sMin) / (sMax - sMin))) * (HR - mi.arriba - mi.abajo)
    let escalera = ''
    tramos.forEach((t, i) => { const x0 = x(t.desde), x1 = i + 1 < tramos.length ? x(tramos[i + 1].desde) : x(hoy); escalera += `${i ? ' L' : 'M'}${x0.toFixed(1)},${yP(t.peso).toFixed(1)} L${x1.toFixed(1)},${yP(t.peso).toFixed(1)}` })
    const p = sel !== null ? puntos[sel] : null
    const fin = puntos[puntos.length - 1]
    return `<div class="av-progresion">
      <div class="sr-sub">Peso</div>
      <svg class="sr-escalones av-prog-peso" viewBox="0 0 ${W} ${HP}" role="img" aria-label="Peso de ${esc(nombre)}">
        <line class="sr-base" x1="${mi.izq}" x2="${W - mi.der}" y1="${HP - mi.abajo}" y2="${HP - mi.abajo}"/>
        <path class="sr-linea" d="${escalera}"/>
        ${tramos.map((t, i) => `<g><circle cx="${x(t.desde)}" cy="${yP(t.peso)}" r="${i ? 4.5 : 3.5}" class="${i ? 'sr-punto subida' : 'sr-punto'}"/><text x="${x(t.desde)}" y="${yP(t.peso) - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}" class="sr-valor">${kg(t.peso).replace(' kg', '')}</text>${i ? `<text x="${x(t.desde)}" y="${HP - 3}" text-anchor="middle" class="sr-fecha">${diaMes(t.desde)}</text>` : ''}</g>`).join('')}
        <text x="${W - mi.der + 4}" y="${yP(tramos[tramos.length - 1].peso) + 4}" class="sr-valor fin">kg</text>
      </svg>
      <div class="sr-sub">Reps · serie 1 <span class="texto-3">· en gris, tiempo por serie</span></div>
      <svg class="sr-escalones av-prog-reps" viewBox="0 0 ${W} ${HR}" role="img" aria-label="Reps de la serie 1 de ${esc(nombre)}">
        <line class="sr-base" x1="${mi.izq}" x2="${W - mi.der}" y1="${HR - mi.abajo}" y2="${HR - mi.abajo}"/>
        ${tramos.slice(1).map((t) => `<line class="av-prog-corte" x1="${x(t.desde)}" x2="${x(t.desde)}" y1="${mi.arriba - 10}" y2="${HR - mi.abajo}"/>`).join('')}
        ${tramos.map((t) => `<path class="sr-linea av-prog-tramo ${t.indice % 2 ? 'alt' : ''}" d="${puntos.filter((q) => q.tramo === t.indice).map((q, i) => `${i ? 'L' : 'M'}${x(q.fecha).toFixed(1)},${yR(q.reps).toFixed(1)}`).join(' ')}"/>`).join('')}
        ${conTiempo.length ? `<path class="av-prog-tiempo" d="${conTiempo.map((q, i) => `${i ? 'L' : 'M'}${x(q.fecha).toFixed(1)},${yS(q.segundos).toFixed(1)}`).join(' ')}"/><text x="${W - mi.der + 4}" y="${yS(conTiempo[conTiempo.length - 1].segundos) + 15}" class="sr-cuota fin">${conTiempo[conTiempo.length - 1].segundos} s</text>` : ''}
        ${puntos.map((q, i) => `<g class="sr-paso ${sel === i ? 'sel' : ''}" data-punto="${i}"><rect x="${x(q.fecha) - 12}" y="${yR(q.reps) - 18}" width="24" height="34" fill="transparent"/><circle cx="${x(q.fecha)}" cy="${yR(q.reps)}" r="${q.record ? 4.5 : 3}" class="sr-punto ${q.tramo % 2 ? 'alt' : ''} ${q.record ? 'subida' : ''}"/>${q.record ? `<text x="${x(q.fecha)}" y="${yR(q.reps) - 8}" text-anchor="middle" class="av-prog-estrella">★</text>` : ''}</g>`).join('')}
        <text x="${W - mi.der + 4}" y="${yR(fin.reps) + 4}" class="sr-valor fin">${fin.reps}</text>
      </svg>
      <div class="av-nota">${p
        ? `<b>${fechaLegible(p.fecha)}</b> · ${kg(p.peso)} · ${p.series.map((q) => `S${q.n} ${q.reps}${q.ayuda ? `+${q.ayuda}` : ''}`).join(' · ')}${p.record ? ' · ★ récord' : ''} · tiempo por serie ${p.segundos !== undefined && p.segundos !== null ? `${p.segundos} s` : '—'}`
        : `${puntos.length} ${puntos.length === 1 ? 'entreno' : 'entrenos'} · ${tramos.length === 1 ? 'un solo peso' : `${tramos.length - 1} ${tramos.length === 2 ? 'subida' : 'subidas'} de peso`} · ${puntos.filter((q) => q.record).length} récords · tocá un punto`}</div>
    </div>`
  }

  // ======================= Series rápidas =======================
  async function series() {
    const [p, s] = await Promise.all([api('/api/progreso'), api('/api/series')])
    ponerFondo(p)
    const hoy = p.hoy
    const inicioCiclo = p.ciclo && !p.ciclo.noEmpezado ? p.ciclo.inicio : hoy
    const sel = {}
    caja.innerHTML = '<section class="av-tarjeta" id="series"></section>'
    function pintar() {
      $('#series').innerHTML = `<div class="av-tarjeta-titulo"><span>Series rápidas</span><span class="av-nota">hoy · semana · récord</span></div>
        ${s.series.length ? s.series.map((c) => serieRapida(c, hoy, inicioCiclo, sel[c.contador.id] || {})).join('') : nota('Todavía no tenés series rápidas.')}`
      $('#series').querySelectorAll('[data-c]').forEach((el) => {
        el.onclick = () => {
          const o = sel[el.dataset.c] = sel[el.dataset.c] || {}
          if (el.dataset.dia) o.dia = alternar(o.dia, el.dataset.dia)
          else o.esc = alternar(o.esc ?? null, Number(el.dataset.esc))
          pintar()
        }
      })
    }
    pintar()
  }

  /** Una serie rápida: el resumen de hoy, los escalones de reps por serie y la tira de días (no llegó, cuota, extra). */
  function serieRapida(c, hoy, inicioCiclo, sel) {
    const id = esc(c.contador.id)
    const nombre = c.contador.nombre.toLowerCase()
    const dias = (c.porDia || []).filter((x) => x.fecha >= inicioCiclo)
    const cuotaDias = dias.filter((x) => x.total >= x.cuota).length
    const extraDias = dias.filter((x) => x.total >= x.extra).length
    const elegido = sel.dia ? dias.find((x) => x.fecha === sel.dia) : null
    const W = 320, H = 92, mi = { arriba: 22, abajo: 18, izq: 8, der: 30 }
    const inicio = dias[0] ? dias[0].fecha : hoy
    const pasos = (c.escalonesReps.length ? c.escalonesReps : [{ desde: inicio, reps: c.repsHoy, cuota: c.cuotaHoy }]).map((e) => ({ ...e, desde: e.desde < inicio ? inicio : e.desde }))
    const total = Math.max(1, difDias(inicio, hoy))
    const yMin = Math.min(...pasos.map((q) => q.reps)) - 1
    const yMax = Math.max(Math.max(...pasos.map((q) => q.reps)) + 1, yMin + 3)
    const x = (f) => mi.izq + (Math.min(total, Math.max(0, difDias(inicio, f))) / total) * (W - mi.izq - mi.der)
    const y = (r) => mi.arriba + (1 - (r - yMin) / (yMax - yMin)) * (H - mi.arriba - mi.abajo)
    let ruta = ''
    pasos.forEach((q, i) => { const x0 = x(q.desde), x1 = i + 1 < pasos.length ? x(pasos[i + 1].desde) : x(hoy); ruta += `${i ? ' L' : 'M'}${x0.toFixed(1)},${y(q.reps).toFixed(1)} L${x1.toFixed(1)},${y(q.reps).toFixed(1)}` })
    const pe = sel.esc !== undefined && sel.esc !== null ? pasos[sel.esc] : null
    const ult = pasos[pasos.length - 1]
    return `<div class="av-atributo sr-bloque">
      <div class="av-atributo-fila"><span>${esc(c.contador.nombre)} <span class="av-nota">· ${c.repsHoy} por serie × ${c.series}</span></span><span class="av-mono"><b class="${c.metaLogradaHoy ? 'av-rojo' : ''}">${c.hoy}</b><span class="av-nota">/${c.cuotaHoy}</span> · ${c.semana} · ${c.record ? c.record.total : '—'}</span></div>
      <div class="av-barra fina" aria-hidden="true"><div style="width: ${Math.min(100, (100 * c.hoy) / Math.max(1, c.cuotaHoy))}%;"></div></div>
      <div class="sr-sub">Reps por serie</div>
      <svg class="sr-escalones" viewBox="0 0 ${W} ${H}" role="img" aria-label="Reps por serie de ${esc(nombre)}">
        <line class="sr-base" x1="${mi.izq}" x2="${W - mi.der}" y1="${H - mi.abajo}" y2="${H - mi.abajo}"/>
        <path class="sr-linea" d="${ruta}"/>
        ${pasos.map((q, i) => `<g class="sr-paso ${sel.esc === i ? 'sel' : ''}" data-c="${id}" data-esc="${i}"><rect x="${x(q.desde) - 16}" y="${y(q.reps) - 22}" width="32" height="40" fill="transparent"/><circle cx="${x(q.desde)}" cy="${y(q.reps)}" r="${i ? 4.5 : 3.5}" class="${i ? 'sr-punto subida' : 'sr-punto'}"/><text x="${x(q.desde)}" y="${y(q.reps) - 9}" text-anchor="${i === 0 ? 'start' : 'middle'}" class="sr-valor">${q.reps}<tspan class="sr-cuota"> ·${q.cuota}</tspan></text>${i ? `<text x="${x(q.desde)}" y="${H - 4}" text-anchor="middle" class="sr-fecha">${diaMes(q.desde)}</text>` : ''}</g>`).join('')}
        <text x="${W - mi.der + 4}" y="${y(ult.reps) + 4}" class="sr-valor fin">${ult.reps}</text>
        <text x="${W - mi.der + 4}" y="${y(ult.reps) + 15}" class="sr-cuota fin">${ult.cuota}</text>
      </svg>
      <div class="av-nota">${pe
        ? (sel.esc === 0 ? `${pe.reps} por serie desde el inicio · cuota ${pe.cuota}` : `Subiste a ${pe.reps} por serie el ${fechaLegible(pe.desde)} · cuota ${pe.cuota}`)
        : pasos.length > 1 ? `${pasos.length - 1} ${pasos.length === 2 ? 'subida' : 'subidas'} en el ciclo · en gris, la cuota · tocá un punto` : 'Todavía sin subidas: la propuesta llega tras 3 días seguidos en cuota. En gris, la cuota del día.'}</div>
      <div class="sr-sub">Cumplimiento por día</div>
      ${dias.length ? `<div class="sr-dias" role="list" aria-label="Cumplimiento por día de ${esc(nombre)}">${dias.map((d) => { const e = d.total >= d.extra ? 'extra' : d.total >= d.cuota ? 'cuota' : 'no'; return `<button type="button" role="listitem" data-c="${id}" data-dia="${d.fecha}" class="sr-dia ${e} ${d.fecha === hoy ? 'hoy' : ''} ${sel.dia === d.fecha ? 'sel' : ''}" aria-label="${fechaLegible(d.fecha)}: ${d.total} de ${d.cuota}"></button>` }).join('')}</div>
        <div class="sr-leyenda" aria-hidden="true"><span><i class="sr-dia no"></i>no llegó</span><span><i class="sr-dia cuota"></i>cuota</span><span><i class="sr-dia extra"></i>extra</span></div>
        <div class="av-nota sr-detalle">${elegido
          ? `<b>${fechaLegible(elegido.fecha)}</b> · ${elegido.total} ${esc(nombre)} · cuota ${elegido.cuota} · extra ${elegido.extra}${elegido.total >= elegido.extra ? ' · extra ✓' : elegido.total >= elegido.cuota ? ' · cuota ✓' : ''}`
          : `Cuota cumplida <b>${cuotaDias}</b> ${cuotaDias === 1 ? 'día' : 'días'} · Extra <b>${extraDias}</b> ${extraDias === 1 ? 'día' : 'días'} · tocá un día`}</div>` : nota('Empieza el Día 1.')}
    </div>`
  }

  // ======================= Pilares =======================
  /** Anillo de tinta: el arco lleno es lo cumplido. */
  function anillo(nombre, valor, texto) {
    const rr = 26, c = 2 * Math.PI * rr, v = Math.max(0, Math.min(1, valor ?? 0))
    return `<div class="av-anillo ${valor === null ? 'sin-dias' : ''}" role="img" aria-label="${esc(valor === null ? `${nombre}: ${texto}` : `${nombre}: ${Math.round(v * 100)} %`)}">
      <svg viewBox="0 0 64 64"><circle class="enso-fondo" cx="32" cy="32" r="${rr}" fill="none" stroke-width="4.5" stroke-dasharray="${c * 0.94} ${c}" transform="rotate(-80 32 32)" stroke-linecap="round"/><circle class="enso-valor ${v < 0.75 ? 'bajo' : ''}" cx="32" cy="32" r="${rr}" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="${c * v * 0.94} ${c}" transform="rotate(-80 32 32)"/><text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#f3efe6">${valor === null ? '—' : Math.round(v * 100)}</text></svg>
      <span class="av-anillo-nombre">${esc(nombre)}</span><span class="av-nota">${esc(texto)}</span></div>`
  }
  async function pilares() {
    const [p, r] = await Promise.all([api('/api/progreso'), api('/api/progreso/pilares')])
    ponerFondo(p)
    caja.innerHTML = `<section class="av-tarjeta">
        <div class="av-tarjeta-titulo"><span>Pilares en el ciclo</span><span class="av-nota">${r.diasCumplidos} de ${r.diasContados} días cumplidos</span></div>
        <div class="av-pilares">${r.lista.map((x) => anillo(x.nombre, x.programados ? x.hechos / x.programados : null, x.programados ? `${x.hechos} de ${x.programados}` : `0 de 0 · sin días de ${x.id === 'entrenamiento' ? 'entreno' : 'este pilar'} todavía`)).join('')}</div>
      </section>
      ${r.atributos.length ? `<section class="av-tarjeta"><div class="av-tarjeta-titulo"><span>Atributos</span><span class="av-nota">tocá uno para el detalle</span></div>
        ${r.atributos.map((a, i) => `<div class="av-atributo av-tocable" role="button" tabindex="0" data-a="${i}"><div class="av-atributo-fila"><span>${esc(a.nombre)}</span><span class="av-mono">${a.valor ?? '—'}${a.tendencia ? `<span class="${a.tendencia > 0 ? 'av-sube' : 'av-baja'}"> ${a.tendencia > 0 ? '▲' : '▼'}${Math.abs(a.tendencia)}</span>` : ''}</span></div><div class="av-barra fina" aria-hidden="true"><div style="width: ${a.valor ?? 0}%;"></div></div></div>`).join('')}
      </section>` : ''}`
    caja.querySelectorAll('[data-a]').forEach((el) => {
      const abrir = () => {
        const a = r.atributos[Number(el.dataset.a)]
        if (fondo) fondo.pausar(true)
        const h = SEK.v88.hoja(a.nombre, `<p class="chico texto-2">${esc(a.descripcion || '')}</p>
          <div class="fila entre"><span>Valor</span><b class="grande">${a.valor ?? 'datos insuficientes'}</b></div>
          <p class="chico">${a.cumplidos} cumplidos de ${a.programados} programados entre ${fechaLegible(a.desde)} y ${fechaLegible(a.hasta)} (${a.ventanaDias} días).${a.valor === null ? ` Hacen falta al menos ${a.minimoProgramados} compromisos programados en la ventana.` : ''}</p>
          ${a.porAccion && a.porAccion.length ? `<table class="tabla"><thead><tr><th>Acción</th><th class="num">Cumplidos</th><th class="num">Programados</th></tr></thead><tbody>${a.porAccion.map((x) => `<tr><td>${esc(x.nombre || x.accionId)}</td><td class="num">${x.cumplidos}</td><td class="num">${x.programados}</td></tr>`).join('')}</tbody></table>` : ''}
          <p class="ayuda">Fórmula: 100 × cumplidos / programados, con el peso de cada acción. Lo pendiente de hoy no cuenta.</p>`)
        const fm = h.el.parentElement
        new MutationObserver((_, o) => { if (!fm.isConnected) { o.disconnect(); if (fondo) fondo.pausar(false) } }).observe(fm.parentElement, { childList: true })
      }
      el.onclick = abrir
      el.onkeydown = (e) => { if (e.key === 'Enter') abrir() }
    })
  }

  // ======================= Comida =======================
  async function comida() {
    const [p, r, hoyC] = await Promise.all([api('/api/progreso'), api('/api/progreso/comida'), api('/api/comida').catch(() => null)])
    ponerFondo(p)
    const hoy = p.hoy
    const o = hoyC && hoyC.objetivo
    // Peso
    const pesos = r.pesos.slice(-30)
    const W = 300, H = 110
    const min = pesos.length ? Math.min(...pesos.map((x) => x.kg)) - 0.5 : 0
    const max = pesos.length ? Math.max(...pesos.map((x) => x.kg)) + 0.5 : 1
    const x = (i) => (pesos.length < 2 ? W / 2 : 10 + (i * (W - 20)) / (pesos.length - 1))
    const y = (k) => H - 14 - ((k - min) / (max - min || 1)) * (H - 28)
    // Promedio por semana (solo días cargados), de lunes a domingo
    const semanas = []
    for (let l = lunesDe(r.desde); l <= r.hasta; l = sumarDias(l, 7)) {
      const del = (lista) => lista.filter((d) => d.fecha >= l && d.fecha <= sumarDias(l, 6) && d.valor !== null && d.valor !== undefined)
      const k = del(r.kcal), pr = del(r.proteina)
      semanas.push({ desde: l, dias: k.length, kcal: k.length ? Math.round(k.reduce((s, d) => s + d.valor, 0) / k.length) : null, proteina: pr.length ? Math.round(pr.reduce((s, d) => s + d.valor, 0) / pr.length) : null })
    }
    const maxK = Math.max(o ? o.kcal || 0 : 0, ...semanas.map((s) => s.kcal || 0)) * 1.1 || 1
    const maxP = Math.max(o ? o.proteina || 0 : 0, ...semanas.map((s) => s.proteina || 0)) * 1.1 || 1
    const esta = semanas[semanas.length - 1]
    // Agua y fruta: últimos 14 días
    const objAgua = hoyC ? hoyC.agua.objetivo : 2500
    const agua14 = r.agua.slice(-14)
    const aguaSem = semanas.map((s) => { const l = r.agua.filter((d) => d.fecha >= s.desde && d.fecha <= sumarDias(s.desde, 6) && d.valor > 0); return { desde: s.desde, litros: l.length ? Math.round((l.reduce((a, d) => a + d.valor, 0) / l.length) / 100) / 10 : null, llego: l.filter((d) => d.valor >= objAgua).length } })
    const aEsta = aguaSem[aguaSem.length - 1]
    const fr = hoyC ? hoyC.fruta : { nombre: 'Fruta', objetivo1: 1, objetivo2: 2 }
    const fruta14 = r.fruta.slice(-14)
    const fruta7 = r.fruta.slice(-7).reduce((s, d) => s + d.valor, 0)
    caja.innerHTML = `<div class="col" style="gap: 12px;">
      <section class="av-tarjeta">
        <div class="fila entre"><b>Peso</b><span class="chico texto-2">${pesos.length ? kg(pesos[pesos.length - 1].kg) : 'sin datos'}</span></div>
        ${pesos.length ? `<svg viewBox="0 0 ${W} ${H}" class="co-curva" role="img" aria-label="Curva de peso"><polyline points="${pesos.map((q, i) => `${x(i)},${y(q.kg)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${pesos.map((q, i) => `<circle cx="${x(i)}" cy="${y(q.kg)}" r="${i === pesos.length - 1 ? 4 : 2.4}" class="${i === pesos.length - 1 ? 'ultimo' : ''}"/>`).join('')}<text x="4" y="11" class="co-eje">${max.toFixed(1)}</text><text x="4" y="${H - 2}" class="co-eje">${min.toFixed(1)}</text></svg>`
          : '<p class="chico texto-2">Guardá tu peso en Comida para ver la curva.</p>'}
      </section>
      <section class="av-tarjeta">
        <div class="fila entre"><b>Promedio por semana</b><span class="chico texto-3">solo días cargados</span></div>
        <div class="co-semanas">${semanas.map((s) => `<div class="co-semana" title="Semana del ${fechaLegible(s.desde)}"><div class="co-col"><div class="k ${o && s.kcal && s.kcal > o.kcal * 1.1 ? 'pasado' : ''}" style="height: ${((s.kcal || 0) / maxK) * 100}%;"></div></div><div class="co-col"><div class="p" style="height: ${((s.proteina || 0) / maxP) * 100}%;"></div></div><span>${s.desde.slice(8)}/${s.desde.slice(5, 7)}</span></div>`).join('')}</div>
        <div class="fila chico texto-2" style="gap: 4px 14px; flex-wrap: wrap;"><span><i class="co-punto k"></i> calorías</span><span><i class="co-punto p"></i> proteína</span>${o ? `<span>objetivo ${Number(o.kcal).toLocaleString('es-AR')} kcal · ${o.proteina} g</span>` : ''}</div>
        ${esta && esta.kcal ? `<p class="chico">Esta semana: <b>${esta.kcal.toLocaleString('es-AR')} kcal</b> y <b>${esta.proteina ?? 0} g</b> de proteína por día (${esta.dias} día${esta.dias === 1 ? '' : 's'} cargado${esta.dias === 1 ? '' : 's'}).</p>` : ''}
      </section>
      <section class="av-tarjeta">
        <div class="fila entre"><b>Agua</b><span class="chico texto-2">objetivo ${litros(objAgua)}</span></div>
        <div class="sr-dias agua-dias" aria-label="Últimos 14 días de agua">${agua14.map((d) => `<span class="sr-dia ${d.valor >= objAgua ? 'cuota' : d.valor > 0 ? 'parcial' : 'no'} ${d.fecha === hoy ? 'hoy' : ''}" title="${d.fecha}: ${litros(d.valor)}"></span>`).join('')}</div>
        <div class="sr-leyenda"><span><i class="sr-dia no"></i> no llegaste</span><span><i class="sr-dia parcial"></i> algo</span><span><i class="sr-dia cuota"></i> llegaste</span></div>
        <div class="agua-semanas">${aguaSem.map((s) => `<div class="agua-semana"><div class="agua-col"><div style="height: ${Math.min(100, (((s.litros || 0) * 1000) / (objAgua * 1.3)) * 100)}%;" class="${s.litros !== null && s.litros * 1000 >= objAgua ? 'llego' : ''}"></div></div><b class="mono chico">${s.litros !== null ? `${s.litros.toLocaleString('es-AR')} L` : '—'}</b><span>${s.desde.slice(8)}/${s.desde.slice(5, 7)}</span></div>`).join('')}</div>
        <p class="chico texto-2" style="margin: 0;">${aEsta && aEsta.litros !== null ? `Esta semana: <b>${aEsta.litros.toLocaleString('es-AR')} L por día</b>, llegaste ${aEsta.llego} día${aEsta.llego === 1 ? '' : 's'}.` : 'Esta semana todavía sin agua cargada.'}</p>
      </section>
      <section class="av-tarjeta">
        <div class="fila entre"><b>${esc(fr.nombre || 'Fruta')}</b><span class="chico texto-2">objetivo ${fr.objetivo1} · extra ${fr.objetivo2}</span></div>
        <div class="sr-dias" aria-label="Últimos 14 días de fruta">${fruta14.map((d) => `<span class="sr-dia ${d.valor >= fr.objetivo2 ? 'extra' : d.valor >= fr.objetivo1 ? 'cuota' : d.valor > 0 ? 'parcial' : 'no'} ${d.fecha === hoy ? 'hoy' : ''}" title="${d.fecha}: ${d.valor}"></span>`).join('')}</div>
        <p class="chico texto-2" style="margin: 0;">Últimos 7 días: <b>${fruta7}</b> ${fruta7 === 1 ? 'fruta' : 'frutas'}.</p>
      </section>
      <a href="/comida" class="boton ancho">Ver la comida de hoy</a>
    </div>`
  }

  const PINTAR = { xp, metas, sueno, fuerza, series, pilares, comida }
  seguro(async () => {
    await PINTAR[cual]()
    $('#cargando').hidden = true
  })()
})()
