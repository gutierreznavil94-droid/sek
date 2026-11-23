// Pantalla Revisión, igual que la v0.88.27 (RevisionDiaria.tsx y RevisionSemanal.tsx).
// Diaria (3 pasos): qué cumplí y qué no (los pilares del día, con Sí/No para lo que falta marcar hoy), el
// principal obstáculo y un ajuste para mañana. ?fecha=AAAA-MM-DD revisa otro día.
// Semanal (?tipo=semanal): cumplimiento por día, entrenamientos, descanso, juego, XP y atributos, y la
// reflexión breve. ?fecha= elige la semana; ‹ › la mueven.
// Pide a /api/ciclo/revision (su módulo) y, para mostrar, a /api/dia/… y /api/juego (rutas de esos módulos).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, fechaLegible, iconoPilar } = SEK.v88
  const q = new URLSearchParams(location.search)
  const semanal = q.get('tipo') === 'semanal'
  const fechaPedida = /^\d{4}-\d{2}-\d{2}$/.test(q.get('fecha') || '') ? q.get('fecha') : null
  SEK.v88.montar({ activo: semanal ? 'progreso' : 'hoy', companero: 'esquina' })
  const caja = $('#caja')
  const nada = () => null
  const idUrl = encodeURIComponent
  const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const clase = (p) => (p === null || p === undefined ? '' : p >= 80 ? 'ok' : p >= 50 ? 'medio' : 'bajo')
  const pct = (p) => (p === null || p === undefined ? '<span class="texto-3">—</span>' : `<span class="${clase(p)}">${p} %</span>`)

  // ---------------- Diaria ----------------
  const ESTADO = { cumplido: 'Hecho', tarde: 'Tarde', omitido: 'No cumplido', descanso: 'No aplicaba hoy', pendiente: 'Sin marcar' }
  const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  function textoEstado(p) {
    const c = p.compromiso
    if (p.estado === 'cumplido' && c && c.finReal) return `Hecho a las ${hora(c.finReal)}`
    if (p.estado === 'tarde') return `Tarde · ${(c && c.retrasoMinutos) || 0} min`
    return ESTADO[p.estado] || 'Sin marcar'
  }

  let d = null, pil = null, resta = null, juego = null
  let paso = 1, obstaculo = '', detalle = '', ajuste = ''

  async function cargarDiaria() {
    d = await api(`/api/ciclo/revision?tipo=diaria${fechaPedida ? '&fecha=' + fechaPedida : ''}`)
    const esHoy = d.periodo === d.hoy
    ;[pil, resta, juego] = await Promise.all([
      api(`/api/dia/pilares?fecha=${d.periodo}`).catch(nada),
      esHoy ? api('/api/dia/aviso-resta').then((r) => r.aviso).catch(nada) : null,
      esHoy ? api('/api/juego').catch(nada) : null,
    ])
  }

  function pintarDiaria() {
    const esHoy = d.periodo === d.hoy
    const pilares = (pil && pil.pilares) || []
    let html = `<div class="fila entre"><h1>Revisión ${esHoy ? 'de hoy' : `del ${esc(fechaLegible(d.periodo))}`}</h1><span class="chico texto-3 mono">paso ${paso} de 3</span></div>
      <div class="pasos" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= paso ? 'hecho' : ''}"></i>`).join('')}</div>`
    if (paso === 1) {
      const filas = pilares.map((p, i) => {
        const marcar = esHoy && p.estado === 'pendiente' && p.accion.tipo === 'compromiso' && p.compromiso
        return `<div class="pilar-fila ${esc(p.estado)}"><span class="punto" aria-hidden="true"></span><span class="icono">${iconoPilar(p.accion.id, p.accion.tipo)}</span>
          <span class="crece col" style="gap: 0;"><b class="chico">${esc(p.accion.nombre)}</b><span class="muy-chico texto-3">${esc(textoEstado(p))}</span></span>
          ${marcar ? `<span class="fila" style="gap: 4px;"><button type="button" class="boton chico ok" data-si="${i}">Sí</button><button type="button" class="boton chico suave" data-no="${i}">No</button></span>` : ''}</div>`
      }).join('')
      const b = d.balance || { mas: 0, menos: 0 }
      html += `<section class="col" style="gap: 8px;"><span class="seccion-titulo">1 · Qué cumplí y qué no</span>
        <div class="pilares-lista">${filas || '<p class="chico texto-3">No hay pilares ese día.</p>'}</div>
        ${resta ? `<p class="aviso-resta" role="status"><span class="aviso-resta-k" aria-hidden="true">減</span>${esc(resta.texto)}<span class="muy-chico texto-3"> · ${esc(resta.faltantes.map((f) => f.nombre).join(', '))}</span></p>` : ''}
        ${!esHoy && (b.mas > 0 || b.menos > 0) ? `<p class="chico texto-2 mono" style="margin: 0;">Ese día: <span class="ok">+${b.mas}</span>${b.menos > 0 ? ` / <span class="acento">−${b.menos}</span>` : ''} XP</p>` : ''}
        <div class="fila entre chico texto-2"><span>${pil ? `${pil.cumplidos} de ${pil.aplican} pilares` : ''}${juego ? ` · juego ${juego.minutosHoy} / ${juego.limiteHoy} min` : ''}</span></div>
        <button type="button" class="boton primario grande ancho" data-ir="2">Siguiente</button></section>`
    } else if (paso === 2) {
      html += `<section class="col" style="gap: 8px;"><span class="seccion-titulo">2 · Principal obstáculo</span>
        <div class="chips">${d.obstaculos.map((o, i) => `<button type="button" class="${o === obstaculo ? 'activo' : ''}" data-obs="${i}" aria-pressed="${o === obstaculo}">${esc(o)}</button>`).join('')}</div>
        <div class="campo"><input id="detalle" maxlength="1000" placeholder="Detalle (opcional)" value="${esc(detalle)}"></div>
        <div class="botonera"><button type="button" class="boton" data-ir="1">Atrás</button><button type="button" class="boton primario crece" data-ir="3">Siguiente</button></div></section>`
    } else {
      html += `<section class="col" style="gap: 8px;"><span class="seccion-titulo">3 · Ajuste para mañana</span>
        <div class="campo"><input id="ajuste" maxlength="1000" placeholder="Ej.: Entrenar apenas llego" value="${esc(ajuste)}"><span class="ayuda">Una sola línea. Mañana aparece arriba de Hoy.</span></div>
        <div class="botonera"><button type="button" class="boton" data-ir="2">Atrás</button><button type="button" class="boton primario grande crece" id="listo">${d.revision ? 'Actualizar' : 'Listo'}</button></div></section>`
    }
    caja.innerHTML = html
    const det = $('#detalle'), aj = $('#ajuste')
    if (det) det.oninput = () => { detalle = det.value }
    if (aj) { aj.oninput = () => { ajuste = aj.value }; aj.onkeydown = (e) => { if (e.key === 'Enter') guardarDiaria() }; aj.focus() }
    caja.querySelectorAll('[data-ir]').forEach((b) => { b.onclick = () => { paso = Number(b.dataset.ir); pintarDiaria() } })
    caja.querySelectorAll('[data-obs]').forEach((b) => {
      b.onclick = () => {
        obstaculo = d.obstaculos[Number(b.dataset.obs)]
        caja.querySelectorAll('[data-obs]').forEach((x) => { const si = x === b; x.classList.toggle('activo', si); x.setAttribute('aria-pressed', String(si)) })
        setTimeout(() => { paso = 3; pintarDiaria() }, 180)
      }
    })
    caja.querySelectorAll('[data-si]').forEach((b) => {
      const p = pilares[Number(b.dataset.si)]
      b.onclick = seguro(async () => {
        const r = await api(`/api/dia/compromisos/${idUrl(p.compromiso.id)}/completar`, {})
        avisar(r && r.xp > 0 ? `${p.accion.nombre}: +${r.xp} XP` : `${p.accion.nombre}: hecho`, { tipo: 'ok' })
        await cargarDiaria(); pintarDiaria()
      })
    })
    caja.querySelectorAll('[data-no]').forEach((b) => {
      const p = pilares[Number(b.dataset.no)]
      b.onclick = seguro(async () => { await api(`/api/dia/compromisos/${idUrl(p.compromiso.id)}/omitir`, {}); await cargarDiaria(); pintarDiaria() })
    })
    const l = $('#listo')
    if (l) l.onclick = guardarDiaria
  }

  const guardarDiaria = seguro(async () => {
    const r = await api('/api/ciclo/revision', { tipo: 'diaria', periodo: d.periodo, respuestas: { obstaculo, detalle: detalle.trim(), ajuste: ajuste.trim() } })
    avisar(r.nueva ? 'Revisión lista' : 'Revisión guardada', { tipo: 'ok' })
    setTimeout(() => { location.href = '/' }, 700)
  })

  // ---------------- Semanal ----------------
  /** Números de una semana (lunes a domingo) a partir de las rutas de dia y ciclo. */
  async function semana(fecha, acciones) {
    const r = await api(`/api/ciclo/revision?tipo=semanal&fecha=${fecha}`)
    const [cu, pd] = await Promise.all([
      api(`/api/dia/cumplimiento?desde=${r.desde}&hasta=${r.hasta}`).catch(nada),
      api(`/api/dia/pilares-por-dia?desde=${r.desde}&hasta=${r.hasta}`).catch(nada),
    ])
    const dias = (cu && cu.dias) || []
    const cumplidos = dias.reduce((s, x) => s + (x.cumplidos || 0), 0), programados = dias.reduce((s, x) => s + (x.programados || 0), 0)
    const tipo = (id) => (acciones.find((a) => a.id === id) || {}).tipo
    let entrenoH = 0, entrenoP = 0, noches = 0, aHora = 0
    for (const dia of (pd && pd.dias) || []) {
      for (const p of dia.pilares || []) {
        const t = tipo(p.accionId)
        if (t === 'entrenamiento' && dia.fecha <= r.hoy && p.estado !== 'descanso') { entrenoP++; if (p.estado === 'cumplido' || p.estado === 'tarde') entrenoH++ }
        if (t === 'acostarse' && dia.fecha <= r.hoy && p.estado !== 'descanso' && p.estado !== 'pendiente') { noches++; if (p.estado === 'cumplido') aHora++ }
      }
    }
    return { ...r, dias, porcentaje: programados ? Math.round((cumplidos / programados) * 100) : null, cumplidos, programados, entrenoH, entrenoP, noches, aHora }
  }

  function comparar(v, ant, mejorSiSube = true, unidad = '') {
    if (v === null || v === undefined || ant === null || ant === undefined) return ''
    const dif = v - ant
    if (dif === 0) return '<span class="texto-3 muy-chico">= semana anterior</span>'
    const bien = mejorSiSube ? dif > 0 : dif < 0
    return `<span class="muy-chico ${bien ? 'ok' : 'bajo'}">${dif > 0 ? '▲' : '▼'} ${Math.abs(dif)}${unidad} vs. anterior</span>`
  }

  async function pintarSemanal() {
    $('#atras').href = '/progreso'
    $('#atras').textContent = '← Progreso'
    const ac = await api('/api/dia/acciones').catch(nada)
    const acciones = (ac && ac.acciones) || []
    const a = await semana(fechaPedida || new Date().toLocaleDateString('en-CA'), acciones)
    const actual = a.desde <= a.hoy && a.hoy <= a.hasta
    const [b, jg, at] = await Promise.all([
      semana(sumarDias(a.desde, -7), acciones),
      actual ? api('/api/juego').catch(nada) : null,
      actual ? api('/api/dia/atributos').catch(nada) : null,
    ])
    const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
    const porDia = a.porDia.map((x, i) => ({ ...x, ...(a.dias.find((y) => y.fecha === x.fecha) || {}), etq: DIAS[i] }))
    const juegoMin = jg ? jg.minutosSemana : null
    const sobre = jg ? (jg.semana || []).filter((x) => x.limite > 0 && x.minutos > x.limite).length : 0
    const r = a.revision ? a.revision.respuestas : {}
    caja.innerHTML = `<div class="fila entre">
        <a class="boton chico" href="/ciclo/revision?tipo=semanal&fecha=${sumarDias(a.desde, -7)}" aria-label="Semana anterior">‹</a>
        <h1 class="centro">Semana del ${esc(fechaLegible(a.desde))}</h1>
        ${sumarDias(a.desde, 7) > a.hoy ? '<button type="button" class="boton chico" disabled aria-label="Semana siguiente">›</button>' : `<a class="boton chico" href="/ciclo/revision?tipo=semanal&fecha=${sumarDias(a.desde, 7)}" aria-label="Semana siguiente">›</a>`}
      </div>
      ${a.hasta > a.hoy ? '<p class="chico texto-2">La semana todavía no terminó: los números son parciales.</p>' : ''}
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Cumplimiento</h2></div>
        <div class="fila entre"><span class="grande">${pct(a.porcentaje)}</span>${comparar(a.porcentaje, b.porcentaje, true, ' pts')}</div>
        <span class="chico texto-2">${a.cumplidos} de ${a.programados} compromisos</span>
        <div class="barras" style="height: 50px;">${porDia.map((p) => `<div class="${p.porcentaje === null || p.porcentaje === undefined ? 'sin' : clase(p.porcentaje)}" style="height: ${Math.max(4, p.porcentaje || 0)}%;" title="${esc(fechaLegible(p.fecha))}: ${p.porcentaje ?? '—'} %"></div>`).join('')}</div>
        <div class="barras-etq">${porDia.map((p) => `<div>${p.etq}</div>`).join('')}</div>
      </section>
      <div class="rejilla-2">
        <section class="tarjeta compacta"><span class="texto-3 muy-chico">ENTRENAMIENTOS</span><span class="grande">${a.entrenoH} <span class="chico texto-2">/ ${a.entrenoP}</span></span>${comparar(a.entrenoH, b.entrenoH)}</section>
        <section class="tarjeta compacta"><span class="texto-3 muy-chico">DESCANSO A HORA</span><span class="grande">${a.aHora} <span class="chico texto-2">/ ${a.noches}</span></span><span class="muy-chico texto-3">${a.noches ? `${a.noches} noche${a.noches === 1 ? '' : 's'} contadas` : 'sin registros'}</span></section>
        <section class="tarjeta compacta"><span class="texto-3 muy-chico">JUEGO</span><span class="grande">${juegoMin === null ? '—' : `${juegoMin} min`}</span><span class="muy-chico texto-3">${jg ? `${sobre} día${sobre === 1 ? '' : 's'} sobre el límite` : 'solo de la semana actual'}</span></section>
        <section class="tarjeta compacta"><span class="texto-3 muy-chico">XP DE LA SEMANA</span><span class="grande">${a.xpTotal}</span>${comparar(a.xpTotal, b.xpTotal)}</section>
      </div>
      ${at && at.atributos && at.atributos.length ? `<section class="tarjeta"><div class="tarjeta-cab"><h2>Atributos</h2></div>
        ${at.atributos.map((x) => `<div class="fila entre chico"><span>${esc(x.nombre)}</span><span class="fila" style="gap: 8px;">${x.tendencia ? `<span class="muy-chico ${x.tendencia > 0 ? 'ok' : 'bajo'}">${x.tendencia > 0 ? '▲' : '▼'} ${Math.abs(x.tendencia)}</span>` : ''}<b class="${clase(x.valor)}">${x.valor ?? '—'}</b></span></div>`).join('')}</section>` : ''}
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Reflexión breve</h2></div>
        <div class="campo"><label for="funciono">Qué funcionó</label><input id="funciono" maxlength="1000" value="${esc(r.queFunciono || '')}"></div>
        <div class="campo"><label for="cambiar">Qué cambio para la semana que viene</label><input id="cambiar" maxlength="1000" value="${esc(r.queCambiar || '')}"></div>
        <button type="button" class="boton primario ancho" id="guardar">${a.revision ? 'Actualizar' : 'Guardar revisión semanal'}</button>
      </section>`
    const f1 = $('#funciono'), f2 = $('#cambiar'), g = $('#guardar')
    const revisar = () => { g.disabled = !f1.value.trim() && !f2.value.trim() }
    f1.oninput = revisar; f2.oninput = revisar; revisar()
    g.onclick = seguro(async () => {
      const res = await api('/api/ciclo/revision', { tipo: 'semanal', periodo: a.desde, respuestas: { queFunciono: f1.value.trim(), queCambiar: f2.value.trim() } })
      avisar(res.nueva ? 'Revisión semanal guardada' : 'Revisión actualizada', { tipo: 'ok' })
      setTimeout(() => { location.href = '/progreso' }, 700)
    })
  }

  seguro(async () => {
    if (semanal) return pintarSemanal()
    await cargarDiaria()
    const r = d.revision ? d.revision.respuestas : {}
    obstaculo = r.obstaculo || ''; detalle = r.detalle || ''; ajuste = r.ajuste || ''
    pintarDiaria()
  })()
})()
