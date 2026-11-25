// Pantalla Hoy, igual que la v0.88.27 (Hoy.tsx de la app vieja) pero en HTML+JS.
// Pide todo a las rutas de los módulos: /api/dia/hoy (el tablero), /api/series, /api/ciclo/metas.
// El marco (cabecera de papel, barra del horario, barra de abajo, avisos) lo arma SEK.v88 (comun/pantalla/v88.js).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, brillo, fechaLegible, litros, avisar, hoja, diaSemana, iconoPilar, cantimplora, manzana } = SEK.v88
  const marco = SEK.v88.montar({ activo: 'hoy', horario: true, companero: 'pasea' })
  const idUrl = (id) => encodeURIComponent(id)
  const sumarDias = (f, n) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const duracion = (min) => { const m = Math.max(0, Math.round(min)); const h = Math.floor(m / 60); return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min` }
  const error = (e) => avisar(e.message || String(e), { tipo: 'bajo' })

  let d = null // /api/dia/hoy
  let series = null // /api/series
  let metas = null // /api/ciclo/metas

  const ICONO_321 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 1.5M9 2h6"></path></svg>'
  const ICONO_REV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path></svg>'
  const ICONO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>'
  const ICONO_SIG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'

  const tieneExtra = (a) => !!(a.minutosExtra && a.minutosMinimos && a.minutosExtra > a.minutosMinimos)
  function estadoBrilloPilar(p) {
    if (p.estado === 'pendiente') return 'pendiente'
    if (p.estado === 'cumplido' || p.estado === 'tarde') return tieneExtra(p.accion) ? (p.compromiso && p.compromiso.extra ? 'maximo' : 'parcial') : 'hecho'
    return null
  }
  const usadoHoy = (que) => { try { return !!localStorage.getItem(`usado-${que}:${d.hoy}`) } catch (e) { return false } }

  // ---------- Cabecera: Tensión y No cumplí ----------
  function botonesArriba() {
    const des = d.tarjetas.desafios
    const b = []
    if (des && des.tension && des.tension.activa !== false && des.tension.ruta) b.push(`<a class="boton-duda" href="${esc(des.tension.ruta)}" aria-label="Tensión: cinemática"><span class="boton-duda-kanji" aria-hidden="true">${esc(des.tension.kanji || '進')}</span>Tensión</a>`)
    if (des && des.noCumpli && des.noCumpli.ruta) b.push(`<a class="boton-duda rojo" href="${esc(des.noCumpli.ruta)}" aria-label="No cumplí mi palabra">No cumplí</a>`)
    marco.huecoExtra.innerHTML = b.length ? `<span class="hoy-arriba">${b.join('')}</span>` : ''
  }

  // ---------- La barra del horario (LineaDelDia) ----------
  const H0 = 6
  const H1 = 24
  async function lineaDelDia() {
    const h = await api('/api/dia/horario/dia').catch(() => null)
    const bloques = ((h && h.bloques) || []).filter((b) => b.tipo !== 'dormir' && !b.apagado)
    const ahora = new Date()
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
    const pct = (m) => `${Math.max(0, Math.min(100, ((m - H0 * 60) / ((H1 - H0) * 60)) * 100))}%`
    const entreno = bloques.find((b) => b.tipo === 'entreno' || b.origen === 'entreno')
    const texto = d.horario && d.horario.texto ? d.horario.texto : 'Mi horario: cargá tus bloques fijos y la app se adapta ›'
    marco.huecoHorario.innerHTML = `<section class="hor-linea" aria-label="Mi horario de hoy">
      <a class="hor-linea-link" href="/horario"><div class="hor-barra" aria-hidden="true">${bloques.map((b) => `<span class="hor-tramo ${esc(b.tipo)}" title="${esc(b.nombre)} ${esc(b.desde)}–${esc(b.hasta)}" style="left: ${pct(b.min)}; width: calc(${pct(b.max)} - ${pct(b.min)});"></span>`).join('')}<span class="hor-ahora" style="left: ${pct(minAhora)};"></span></div><span class="chico texto-2 hor-texto">${esc(texto)}</span></a>
      ${entreno && entreno.min > minAhora - 30 ? '<button class="boton chico suave hor-correr">Hoy a las…</button>' : ''}</section>`
    const correr = marco.huecoHorario.querySelector('.hor-correr')
    if (correr) correr.onclick = () => {
      const h2 = hoja('Entreno de hoy', `<p class="ayuda">Solo hoy. La semana sigue igual.</p><div class="campo"><label>Hoy a las</label><input type="time" value="${esc(entreno.desde)}"></div><button class="boton primario ancho">Guardar</button>`)
      h2.el.querySelector('.primario').onclick = async () => {
        const hora = h2.el.querySelector('input').value
        try { await api('/api/dia/horario/correr-entreno', { fecha: d.hoy, hora }); avisar(`Entreno hoy a las ${hora}`, { tipo: 'ok' }); h2.cerrar(); await recargar() } catch (e) { error(e) }
      }
    }
    marco.mover()
  }

  // ---------- Avisos de una línea ----------
  function avisos() {
    const l = []
    if (d.excepcion) l.push({ tono: 'ambar', texto: `Hoy no cuenta: ${esc(d.excepcion.motivo)}` })
    // Como la v0.88.27: el feriado, las fechas clave y lo que restaría se ven en Calendario, no acá.
    const ahora = Date.now()
    if (d.noche && !revisionHecha() && ahora >= d.noche.instanteAviso && ahora < d.noche.instanteCierre) l.push({ tono: 'rojo', texto: `Revisión diaria <b>ahora</b> · hasta las ${esc(d.noche.horaCierre)}`, accion: '<a href="/ciclo/revision" class="boton chico primario">Empezar</a>' })
    const des = d.tarjetas.desafios
    for (const p of (des && des.pendientes) || []) l.push({ tono: 'rojo', texto: esc(p.texto), accion: p.ruta ? `<a href="${esc(p.ruta)}" class="boton chico primario">Ir</a>` : '' })
    const el = $('#avisos')
    el.hidden = !l.length
    el.innerHTML = l.map((a) => `<div class="aviso-linea ${a.tono || ''}"><span class="crece">${a.texto}</span>${a.accion || ''}</div>`).join('')
  }

  // ---------- Pilares ----------
  function filaPilar(p, i) {
    const c = p.compromiso
    const a = p.accion
    const esCelu = a.tipo === 'acostarse'
    const esEntreno = a.tipo === 'entrenamiento'
    const enCurso = esEntreno && d.tarjetas.entreno && !!d.tarjetas.entreno.enCurso
    const iniciado = p.estado === 'pendiente' && ((c && c.estado === 'iniciado') || enCurso)
    const conExtra = tieneExtra(a) && (p.estado === 'cumplido' || p.estado === 'tarde')
    let detalle
    switch (p.estado) {
      case 'cumplido': {
        const s = d.tarjetas.sueno
        if (esCelu && s && s.estaNoche) detalle = `${esc(s.estaNoche.hora)} · +${p.xpPrevisto} XP`
        else if (c && c.extra) detalle = `✓ ${c.minutos || a.minutosExtra} min · extra ✓`
        else if (conExtra) detalle = `✓ ${(c && c.minutos) || a.minutosMinimos} min · <span class="extra-pendiente">¿${a.minutosExtra} min?</span>`
        else { const min = (c && c.minutos) || a.minutosMinimos; detalle = min ? `✓ ${min} min · +${p.xpPrevisto} XP` : `✓ +${p.xpPrevisto} XP` }
        break
      }
      case 'tarde': detalle = `Tarde · ${(c && c.retrasoMinutos) || 0} min`; break
      case 'omitido': detalle = 'No cumplido'; break
      case 'descanso': detalle = 'Descanso'; break
      default:
        detalle = p.ventanaCerrada ? 'Ya no se registra'
          : p.vencido ? (esCelu ? `Tarde · hasta las ${esc(d.horas.limiteCelu)}` : `Venció ${esc(p.horaLimite)}`)
          : esCelu ? `Dejo celu hasta ${esc(p.horaLimite)}`
          : esEntreno ? (enCurso ? 'En curso' : `Hasta ${esc(a.horaLimiteInicio || p.horaLimite || '—')}`)
          : a.tipo === 'comida_plan' ? 'Se mide al cerrar el día'
          : `Hasta ${esc(p.horaLimite || '—')}${a.minutosMinimos ? ` · ${a.minutosMinimos} min` : ''}`
    }
    const pista = p.estado !== 'pendiente' || p.ventanaCerrada || a.tipo === 'comida_plan' ? '' : esEntreno ? (enCurso ? 'Tocá para seguir' : 'Tocá para empezar') : esCelu ? 'Tocá para registrar' : 'Tocá si lo hiciste'
    let barrita = ''
    if (tieneExtra(a) && p.estado !== 'descanso') {
      const meta = a.minutosMinimos || 0
      const extra = a.minutosExtra
      const hechos = c && c.extra ? Math.max(extra, c.minutos || 0) : p.estado === 'cumplido' || p.estado === 'tarde' ? Math.max(meta, Math.min((c && c.minutos) || meta, extra)) : 0
      const marca = (100 * meta) / extra
      barrita = `<span class="barrita dos-topes pilar-barrita" aria-hidden="true"><i style="width: ${(100 * Math.min(hechos, meta)) / extra}%;"></i><i class="capa-extra" style="left: ${marca}%; width: ${(100 * Math.max(0, Math.min(hechos, extra) - meta)) / extra}%;"></i><b class="marca-cuota" style="left: ${marca}%;"></b></span>`
    }
    const ic = p.estado === 'cumplido' ? '✓' : p.estado === 'tarde' ? '!' : p.estado === 'omitido' ? '✕' : p.estado === 'descanso' ? '–' : iniciado ? '<i class="punto-ambar"></i>' : ''
    const clases = ['pilar-bloque', p.estado, p.vencido ? 'vencido' : '', c && c.extra ? 'extra' : '', iniciado ? 'iniciado' : ''].filter(Boolean).join(' ')
    return `<button type="button" class="${clases}" data-i="${i}" ${brillo(estadoBrilloPilar(p), i)} ${p.estado === 'descanso' ? 'disabled' : ''} aria-label="${esc(a.nombre)}">
      <span class="icono">${iconoPilar(a.id, a.tipo)}</span><span class="nombre">${esc(a.nombre)}</span><span class="detalle">${detalle}</span>${pista ? `<span class="pista">${pista}</span>` : ''}${barrita}
      <span class="estado-ic" aria-hidden="true">${ic}</span>${c && p.estado !== 'descanso' && !esCelu ? '<span class="mas" role="button" aria-label="Más opciones">…</span>' : ''}</button>`
  }

  function pilares() {
    const todos = d.cumplidos === d.aplican && d.aplican > 0
    $('#cuenta-pilares').innerHTML = `<span class="${todos ? 'ok' : ''}">${d.cumplidos}</span><span class="texto-3">/${d.aplican}</span>`
    $('#pilares').innerHTML = d.pilares.map(filaPilar).join('')
    for (const b of $('#pilares').querySelectorAll('.pilar-bloque')) {
      const p = d.pilares[Number(b.dataset.i)]
      b.onclick = (e) => { if (e.target.closest('.mas')) return detallePilar(p); tocarPilar(p, b) }
    }
    $('#linea-noche').textContent = `Alistarse ${d.horas.alistarse} · dejo celu hasta ${d.horas.dejarCelu} · dormido ${d.horas.dormido}`
    const s = d.tarjetas.sueno
    const yaDejo = s && s.estaNoche
    const boton = $('#dejo-celu')
    boton.hidden = !(d.deAlistarse && !yaDejo)
    if (!boton.hidden) {
      const [hh, mm] = d.horas.dejarCelu.split(':').map(Number)
      const ahora = new Date()
      const falta = hh * 60 + mm - (ahora.getHours() * 60 + ahora.getMinutes())
      boton.textContent = `Dejo celu${falta > 0 ? ` · faltan ${duracion(falta)}` : falta < 0 ? ` · ${duracion(-falta)} tarde` : ''}`
    }
    const dej = $('#celu-dejado')
    dej.hidden = !yaDejo
    if (yaDejo) {
      dej.innerHTML = `Celu dejado a las ${esc(s.estaNoche.hora)}${s.estaNoche.cumplido ? ' · a tiempo' : ` · ${s.estaNoche.retrasoMinutos} min tarde`}. <button class="enlace">Deshacer</button>`
      dej.querySelector('button').onclick = seguro(async () => { await api('/api/sueno/deshacer', { noche: s.noche }); avisar('«Dejo celu» deshecho'); await recargar() })
    }
  }

  /** Tocar un pilar (tocarPilar de la vieja). */
  const tocarPilar = (p, el) => {
    const c = p.compromiso
    const a = p.accion
    if (p.estado === 'descanso' || !c) return
    if ((p.estado === 'cumplido' || p.estado === 'tarde') && tieneExtra(a) && !c.extra) return marcarExtra(p, el)
    if (p.estado !== 'pendiente') return detallePilar(p)
    if (a.tipo === 'entrenamiento') { location.href = '/entreno/sesion'; return }
    if (a.tipo === 'comida_plan') { location.href = '/comida'; return }
    if (a.tipo === 'acostarse') {
      if (p.ventanaCerrada) return avisar(`Pasaron las ${d.horas.limiteCelu}: la noche queda sin cumplir.`, { tipo: 'bajo' })
      return dejoCelu()
    }
    return marcarPilar(p, el)
  }

  function flash(el, xp) {
    if (!el) return
    el.classList.add('marcado')
    if (xp > 0) { const f = document.createElement('span'); f.className = 'flash'; f.textContent = `+${xp} XP`; el.appendChild(f) }
    SEK.evento('completar', { elemento: el })
  }

  async function marcarPilar(p, el) {
    const c = p.compromiso
    try {
      const minutos = p.accion.tipo === 'entrenamiento' ? p.accion.duracionMinutos || p.accion.minutosMinimos : undefined
      const r = await api(`/api/dia/compromisos/${idUrl(c.id)}/completar`, minutos ? { minutos } : {})
      flash(el, r.xp)
      // El shinobi corta (como celebrarPilar de la vieja); si subiste de nivel, después el logro grande.
      SEK.v88.animar({ tipo: 'ejecucion', pilar: p.accion.id, titulo: p.accion.nombre })
      SEK.v88.nivel(r.nuevoNivel)
      avisar(r.xp > 0 ? `${p.accion.nombre}: +${r.xp} XP` : `${p.accion.nombre}: ${r.motivoSinXp || 'hecho'}`, {
        tipo: r.xp > 0 ? 'ok' : 'bajo',
        accion: { texto: 'Deshacer', fn: async () => { await api(`/api/dia/compromisos/${idUrl(c.id)}/deshacer`, {}); await recargar() } },
      })
      setTimeout(() => recargar().catch(error), 450)
    } catch (e) { error(e) }
  }

  async function marcarExtra(p, el) {
    const c = p.compromiso
    try {
      const r = await api(`/api/dia/compromisos/${idUrl(c.id)}/extra`, {})
      flash(el, r.xp)
      SEK.v88.animar({ tipo: 'ejecucion', pilar: p.accion.id, titulo: p.accion.nombre })
      SEK.v88.nivel(r.nuevoNivel)
      if (el) el.classList.add('destello-extra')
      avisar(r.xp > 0 ? `${p.accion.nombre}: ${p.accion.minutosExtra} min · extra +${r.xp} XP` : `${p.accion.nombre}: extra (${r.motivoSinXp || 'sin XP'})`, {
        tipo: r.xp > 0 ? 'ok' : 'bajo',
        accion: { texto: 'Deshacer', fn: async () => { await api(`/api/dia/compromisos/${idUrl(c.id)}/deshacer-extra`, {}); await recargar() } },
      })
      setTimeout(() => recargar().catch(error), 1600)
    } catch (e) { error(e) }
  }

  /** «…» de un pilar: marcar con minutos o respuesta, empezar, no lo hago hoy, deshacer. */
  function detallePilar(p) {
    const c = p.compromiso
    const a = p.accion
    if (!c) return
    const pendiente = p.estado === 'pendiente'
    const html = `${a.condicion ? `<p class="chico texto-2">${esc(a.condicion)}</p>` : ''}
      ${pendiente && a.minutosMinimos ? `<div class="campo"><label>Minutos (mínimo ${a.minutosMinimos})</label><input type="number" name="minutos" min="0" max="600" inputmode="numeric" value="${a.minutosMinimos}"></div>` : ''}
      ${pendiente && a.pregunta ? `<div class="campo"><label>${esc(a.pregunta)}</label><textarea name="respuesta" rows="2" maxlength="1000"></textarea></div>` : ''}
      <div class="col" style="gap: 8px;">
        ${pendiente ? '<button class="boton primario ancho" data-a="completar">Marcar hecho</button>' : ''}
        ${pendiente && c.estado === 'pendiente' ? '<button class="boton ancho" data-a="iniciar">Empezar ahora</button>' : ''}
        ${pendiente ? '<button class="boton suave ancho" data-a="omitir">No lo hago hoy</button>' : ''}
        ${!pendiente && c.extra ? '<button class="boton ancho" data-a="deshacer-extra">Deshacer extra</button>' : ''}
        ${!pendiente ? '<button class="boton peligro ancho" data-a="deshacer">Deshacer</button>' : ''}
      </div>`
    const h = hoja(a.nombre, html)
    for (const b of h.el.querySelectorAll('[data-a]')) {
      b.onclick = async () => {
        try {
          const cuerpo = {}
          if (b.dataset.a === 'completar') {
            const m = h.el.querySelector('[name=minutos]')
            const r = h.el.querySelector('[name=respuesta]')
            if (m && m.value) cuerpo.minutos = Number(m.value)
            if (r && r.value) cuerpo.respuesta = r.value
          }
          const res = await api(`/api/dia/compromisos/${idUrl(c.id)}/${b.dataset.a}`, cuerpo)
          h.cerrar()
          if (b.dataset.a === 'completar') avisar(res.xp > 0 ? `${a.nombre}: +${res.xp} XP` : `${a.nombre}: ${res.motivoSinXp || 'hecho'}`, { tipo: res.xp > 0 ? 'ok' : 'bajo' })
          await recargar()
        } catch (e) { error(e) }
      }
    }
  }

  const dejoCelu = async () => {
    try {
      const r = await api('/api/dia/dejo-celu', {})
      SEK.evento('dormir')
      avisar(r.cumplido ? `A tiempo${r.xp ? ` · +${r.xp} XP` : ''}` : 'Registrado, tarde', { tipo: r.cumplido ? 'ok' : 'bajo' })
      // A tiempo: primero la ejecución de «Dormir a horario», después la pantalla de buenas noches.
      if (r.cumplido) { SEK.v88.animar({ tipo: 'ejecucion', pilar: 'acostarse' }); setTimeout(() => { location.href = '/sueno/modo' }, 1900) }
      else location.href = '/sueno/modo'
    } catch (e) { error(e) }
  }

  // ---------- Comida: agua chica, fruta y Objetivo / + Comí ----------
  const BRILLO_FRUTA = { pendiente: 'pendiente', cumplido: 'hecho', superado: 'maximo' }

  /** Agua como tarjeta aparte (Más → Comida → Agua → «Tarjeta aparte»), como TarjetaAgua de la vieja. */
  function aguaAparte(ag) {
    const el = $('#agua-aparte')
    el.hidden = !(ag && ag.enHoy === 'tarjeta')
    if (el.hidden) return
    const pasado = Math.max(0, ag.ml - ag.objetivo), falta = ag.objetivo - ag.ml
    const ml = (n) => (n >= 1000 ? litros(n) : `${n} ml`)
    el.innerHTML = `<button type="button" class="agua-boton" data-agua-grande aria-label="Tomé ${esc(ag.principal.nombre)} de ${ag.principal.ml} ml. Llevás ${litros(ag.ml)} de ${litros(ag.objetivo)}. Mantené apretado para otro envase">${cantimplora(ag.nivel, 60)}</button>
      <div class="agua-texto"><span class="seccion-titulo">Agua</span>
        <b class="agua-numero mono">${ag.llego ? `${litros(ag.ml)}${pasado > 0 ? `<span class="agua-extra"> · +${ml(pasado)}</span>` : ''}` : `${litros(ag.ml)} <span class="texto-3">de ${litros(ag.objetivo)}</span>`}</b>
        <span class="chico texto-2" data-agua-estado>${ag.llego ? (pasado > 0 ? 'Rebalsa: seguís sumando' : 'Objetivo del día cumplido') : ag.tomas.length ? `Faltan ${ml(falta)}` : 'Tocá la cantimplora'}</span>
        <span class="chico texto-3">Un toque = ${esc(ag.principal.nombre.toLowerCase())} ${ag.principal.ml} ml · mantené para más</span></div>`
    conectarAgua(el.querySelector('[data-agua-grande]'), ag, el.querySelector('[data-agua-estado]'))
  }
  /** Un toque suma el envase principal; mantener apretado abre «Tomé…» con los otros y restar el último. */
  function conectarAgua(boton, ag, etiqueta) {
    let largo = null, fueLargo = false
    const tomar = seguro(async (envase) => {
      const r = await api('/api/comida/agua', envase ? { envase } : {})
      const ml = r && r.toma ? r.toma.ml : null
      if (etiqueta) { etiqueta.textContent = ml ? `+${ml}` : '+'; etiqueta.classList.add('suma') }
      if (r && r.recienLlego) avisar(`Llegaste a ${litros(r.dia.objetivo)} de agua. 水`, { tipo: 'ok' })
      setTimeout(() => recargar().catch(error), 900)
    })
    const opciones = () => {
      const ultima = ag.tomas[ag.tomas.length - 1]
      const hora = (t) => new Date(t).toTimeString().slice(0, 5)
      const h = hoja('Agua', `<span class="seccion-titulo">Tomé…</span>
        <div class="agua-envases">${ag.envases.map((e) => `<button type="button" class="boton ${e.id === ag.principal.id ? 'primario' : ''}" data-envase="${esc(e.id)}">${esc(e.nombre)}<span class="chico mono" style="opacity: 0.8;"> ${e.ml} ml</span></button>`).join('')}</div>
        ${ultima ? `<button type="button" class="boton suave ancho" data-restar>Restar el último toque · ${ultima.ml} ml a las ${hora(ultima.instante)}</button>` : ''}
        <p class="ayuda centro"><a href="/comida/ajustes">Envases y objetivo</a> · <a href="/comida">tomas de hoy</a></p>`)
      h.el.querySelectorAll('[data-envase]').forEach((b) => { b.onclick = () => { h.cerrar(); tomar(b.dataset.envase) } })
      const r = h.el.querySelector('[data-restar]')
      if (r) r.onclick = seguro(async () => { await api('/api/comida/agua/deshacer', {}); h.cerrar(); avisar(`Resté ${ultima.ml} ml (${hora(ultima.instante)})`); await recargar() })
    }
    boton.onpointerdown = () => { fueLargo = false; largo = setTimeout(() => { fueLargo = true; largo = null; opciones() }, 480) }
    const soltar = () => { if (largo) { clearTimeout(largo); largo = null } }
    boton.onpointerup = soltar
    boton.onpointerleave = soltar
    boton.onpointercancel = soltar
    boton.oncontextmenu = (e) => e.preventDefault()
    boton.onclick = () => { if (fueLargo) { fueLargo = false; return } tomar() }
  }

  function comida() {
    const c = d.tarjetas.comida
    const el = $('#comida')
    el.hidden = !c
    if (!c) return
    const t = c.totales
    const o = c.objetivo
    const estado = !o ? 'Configurá tu objetivo' : t.kcal === 0 ? 'Sin comidas aún' : `${Math.round(t.kcal).toLocaleString('es-AR')} / ${o.kcal.toLocaleString('es-AR')} kcal · ${Math.round(t.p)} g prot.`
    const f = c.fruta
    const ag = c.agua
    el.innerHTML = `<a class="co-tarjeta-link" href="/comida"><span class="co-kanji" aria-hidden="true">食</span><span class="co-tarjeta-texto"><b>Comida</b><span class="co-tarjeta-estado">${estado}</span></span></a>
      ${ag && ag.enHoy === 'chica' ? `<button type="button" class="agua-boton agua-chica" data-agua aria-label="Agua: llevás ${litros(ag.ml)} de ${litros(ag.objetivo)}. Tocá para sumar ${esc(ag.principal.nombre)} de ${ag.principal.ml} ml; mantené apretado para otro envase">${cantimplora(ag.nivel)}<span class="agua-chica-ml mono">${litros(ag.ml)}</span></button>` : ''}
      ${f && f.usar !== false ? `<button type="button" class="agua-boton agua-chica fruta-chica fruta-${esc(f.estado)}" data-fruta ${brillo(BRILLO_FRUTA[f.estado], 5)} aria-label="${esc(f.nombre)}: ${f.n} de ${f.objetivo2}. Tocá para sumar una; mantené apretado para deshacer">${manzana(f.mordido)}<span class="agua-chica-ml mono">${f.n}/${f.objetivo2}</span></button>` : ''}
      ${o ? '<a class="boton primario co-comi" href="/comida?cargar=1">+ Comí</a>' : '<a class="boton co-comi" href="/comida/ajustes">Objetivo</a>'}`
    aguaAparte(ag)
    const agua = el.querySelector('[data-agua]')
    if (agua) conectarAgua(agua, ag, agua.querySelector('.agua-chica-ml'))
    const fruta = el.querySelector('[data-fruta]')
    if (fruta) {
      let largo = null
      let fueLargo = false
      fruta.onpointerdown = () => { fueLargo = false; largo = setTimeout(async () => { fueLargo = true; largo = null; if (f.n === 0) return; try { const r = await api('/api/comida/fruta/deshacer', {}); avisar(`${f.nombre}: ${r.dia ? r.dia.n : f.n - 1} de ${f.objetivo2} (deshecha la última)`); await recargar() } catch (e) { error(e) } }, 480) }
      const soltar = () => { if (largo) { clearTimeout(largo); largo = null } }
      fruta.onpointerup = soltar
      fruta.onpointerleave = soltar
      fruta.oncontextmenu = (e) => e.preventDefault()
      fruta.onclick = seguro(async () => {
        if (fueLargo) { fueLargo = false; return }
        const r = await api('/api/comida/fruta', {})
        fruta.querySelector('.agua-chica-ml').textContent = '+1'
        fruta.querySelector('.agua-chica-ml').classList.add('suma')
        if (r && r.recienSuperado) avisar(`${f.objetivo2} ${f.objetivo2 === 1 ? 'fruta' : 'frutas'} hoy: segundo objetivo. 果`, { tipo: 'ok' })
        else if (r && r.recienCumplido) avisar(`${f.nombre}: primer objetivo cumplido`, { tipo: 'ok' })
        setTimeout(() => recargar().catch(error), 1400)
      })
    }
  }

  // ---------- Metas de la semana: hoy y los 6 días siguientes ----------
  const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
  function semanaMetas() {
    const todas = metas ? [...(metas.pendientes || []), ...(metas.vencidas || []), ...(metas.cumplidas || []), ...(metas.noCumplidas || [])] : []
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(d.hoy, i))
    const porDia = new Map(dias.map((f) => [f, todas.filter((m) => m.fecha === f)]))
    const deHoy = porDia.get(d.hoy)
    const proxima = dias.slice(1).flatMap((f) => porDia.get(f)).find((m) => m.estado === 'pendiente')
    $('#metas').innerHTML = `<div class="fila entre"><span class="seccion-titulo semana-titulo-simple"><span class="semana-kanji" aria-hidden="true">的</span>Metas${!deHoy.length && !proxima ? '<span class="semana-sin">sin metas esta semana</span>' : ''}</span><a class="enlace semana-mas" href="/ciclo/metas" aria-label="Sumar meta">+ meta</a></div>
      <div class="semana-fila">${dias.map((f, i) => {
        const ms = porDia.get(f)
        const cumplidas = ms.filter((m) => m.estado === 'cumplida').length
        return `<a class="semana-dia ${i === 0 ? 'hoy' : ''}" href="/calendario?dia=${f}" aria-label="${fechaLegible(f)}: ${ms.length ? `${ms.length} meta${ms.length > 1 ? 's' : ''}` : 'sin metas'}"><span class="semana-letra">${i === 0 ? 'hoy' : LETRAS[diaSemana(f)]}</span><span class="semana-num">${Number(f.slice(8))}</span><span class="semana-puntos">${ms.slice(0, 4).map((m, j) => `<span class="semana-punto ${j < cumplidas ? 'cumplida' : 'con-meta'}" style="--cerca: ${1 - i / 7};"></span>`).join('') || '<span class="semana-punto"></span>'}</span></a>`
      }).join('')}</div>
      ${deHoy.length ? `<div class="semana-hoy">${deHoy.map((m) => `<div class="fila chico" style="gap: 8px;"><span>${m.estado === 'cumplida' ? '✓' : '○'}</span><span class="crece">${esc(m.titulo)}</span></div>`).join('')}</div>` : ''}
      ${proxima ? `<div class="muy-chico texto-3 semana-proxima">próxima: <b class="texto-2">${esc(proxima.titulo)}</b> · ${fechaLegible(proxima.fecha)}</div>` : ''}`
  }

  // ---------- Revisión diaria, 3·2·1 y Siguiente acción ----------
  const revision = () => d.compromisos.find((c) => c.accion && c.accion.tipo === 'revision_diaria')
  const revisionHecha = () => { const r = revision(); return !!(r && (r.estado === 'completado' || r.estado === 'cumplido')) }
  // «Apps que te atrapan»: Android te trajo desde otra app (/hoy?atrapado=TikTok&min=32). El 3·2·1 brilla en el centro
  // hasta que lo tocás, como la v0.88.27 (llamado321).
  let llamado = false, llamadoVisto = false
  try { llamado = !!sessionStorage.getItem('sek-llamado321') } catch (e) { /* sin almacenamiento */ }
  const atrapado = new URLSearchParams(location.search)
  if (atrapado.has('atrapado')) {
    llamado = true
    try { sessionStorage.setItem('sek-llamado321', '1') } catch (e) { /* nada */ }
    avisar(`Llevás ${atrapado.get('min') || 'muchos'} min en ${atrapado.get('atrapado') || 'esa app'}. Tocá el 3 · 2 · 1 y arrancá.`, { tipo: 'bajo', ms: 12000 })
    try { history.replaceState(history.state, '', location.pathname) } catch (e) { /* nada */ }
  }
  const apagarLlamado = () => { llamado = false; try { sessionStorage.removeItem('sek-llamado321') } catch (e) { /* nada */ } }
  const boton321 = (u321, r321) => llamado
    ? `<a class="boton grande acceso-medio rojizo llamado-321" href="${esc(r321)}" data-llamado>${['弾', '進', '斬', '忍', '鍛', '志'].map((k, i) => `<span class="l321-icono l321-i${i + 1}" aria-hidden="true">${k}</span>`).join('')}<span class="l321-texto">${ICONO_321}3 · 2 · 1</span><span class="l321-sub">Tocá y arrancá</span></a>`
    : `<a class="boton grande acceso-medio ${u321 ? 'hecha' : 'rojizo'}" ${brillo(u321 ? 'hecho' : 'pendiente', 5)} href="${esc(r321)}">${u321 ? ICONO_OK : ICONO_321}3 · 2 · 1</a>`

  function accesos() {
    const hecha = revisionHecha()
    const pasoElCierre = d.noche && Date.now() >= d.noche.instanteCierre
    const u321 = usadoHoy('321')
    const uSig = usadoHoy('siguiente')
    const des = d.tarjetas.desafios
    const r321 = (des && des.tresDosUno && des.tresDosUno.ruta) || '/desafios/321'
    $('#accesos').innerHTML = `<a class="boton grande revision-baja ${hecha ? 'hecha' : 'rojizo'}" ${brillo(hecha ? 'hecho' : 'pendiente', 4)} href="/ciclo/revision">${hecha ? ICONO_OK : ICONO_REV}${hecha ? 'Revisión diaria hecha' : 'Revisión diaria'}<span class="chico" style="font-weight: 500; opacity: 0.8;">${hecha ? '· ver' : pasoElCierre ? `· sin hacer a las ${esc(d.noche.horaCierre)}` : `· hasta ${esc(d.noche ? d.noche.horaAviso : '')}`}</span></a>
      <div class="rejilla-2">
        ${boton321(u321, r321)}
        <a class="boton grande acceso-medio ${uSig ? 'hecha' : 'rojizo'}" ${brillo(uSig ? 'hecho' : 'pendiente', 6)} href="/desafios/siguiente">${uSig ? ICONO_OK : ICONO_SIG}Siguiente acción</a>
      </div>`
    const l = $('#accesos [data-llamado]')
    if (l) { l.onclick = apagarLlamado; if (!llamadoVisto) { llamadoVisto = true; setTimeout(() => l.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300) } }
  }

  // ---------- Series rápidas ----------
  function botonContador(r, i) {
    const c = r.contador
    const tope = Math.max(1, r.extraHoy)
    const marca = (100 * r.cuotaHoy) / tope
    const capa1 = (100 * Math.min(r.hoy, r.cuotaHoy)) / tope
    const capa2 = (100 * Math.max(0, Math.min(r.hoy, r.extraHoy) - r.cuotaHoy)) / tope
    const falta = r.extraHoy - r.hoy
    const detalle = r.extraLogradoHoy ? `${r.hoy} · extra ✓` : r.metaLogradaHoy ? `${r.hoy} · faltan ${falta} al extra` : `${r.hoy} / ${r.cuotaHoy} hoy`
    const est = r.extraLogradoHoy ? 'maximo' : r.metaLogradaHoy ? 'parcial' : 'pendiente'
    return `<button type="button" class="contador-boton compacto ${r.metaLogradaHoy ? 'logrado' : ''} ${r.extraLogradoHoy ? 'extra' : ''}" data-i="${i}" ${brillo(est, 7 + i)} aria-label="Sumar ${c.cantidadPorToque} ${esc(c.nombre.toLowerCase())}. Hoy ${r.hoy}, cuota ${r.cuotaHoy}, extra ${r.extraHoy}">
      <span class="fila" style="gap: 6px; align-items: baseline;"><span class="mas-n">+${c.cantidadPorToque}</span><span class="nombre">${esc(c.nombre)}</span></span>
      <span class="detalle mono">${detalle}${r.toquesHoy > 0 ? ` · ${r.toquesHoy} serie${r.toquesHoy === 1 ? '' : 's'}` : ''}</span>
      <span class="barrita dos-topes"><i style="width: ${capa1}%;"></i><i class="capa-extra" style="left: ${marca}%; width: ${capa2}%;"></i><b class="marca-cuota" style="left: ${marca}%;"></b></span>
      ${r.toquesHoy > 0 ? '<span class="deshacer" role="button" aria-label="Deshacer último toque">↶</span>' : ''}</button>`
  }

  function seriesRapidas() {
    const lista = series && series.series ? series.series : []
    const el = $('#series')
    el.hidden = !lista.length
    if (!lista.length) return
    const propuestas = lista.filter((r) => r.propuesta)
    el.innerHTML = `<div class="fila entre"><span class="seccion-titulo">Series rápidas</span><a class="chico texto-3" href="/entreno/series">ajustar ›</a></div>
      ${propuestas.map((r) => { const p = r.propuesta; return `<div class="propuesta-cuota" role="group" data-id="${esc(r.contador.id)}"><span><b>¿Subimos a ${p.a} ${esc(r.contador.nombre.toLowerCase())} por serie?</b> <span class="texto-3 chico" style="white-space: nowrap;">${p.de} → ${p.a} · cuota ${p.cuota} · extra ${p.extra}</span></span><span class="fila" style="gap: 6px;"><button class="boton chico primario" data-si>Sí</button><button class="boton chico suave" data-no>Todavía no</button></span></div>` }).join('')}
      <div class="rejilla-2">${lista.map(botonContador).join('')}</div>`
    for (const b of el.querySelectorAll('.contador-boton')) {
      const r = lista[Number(b.dataset.i)]
      b.onclick = async (e) => {
        try {
          if (e.target.closest('.deshacer')) {
            const res = await api(`/api/series/${idUrl(r.contador.id)}/deshacer`, {})
            series = res
            const nuevo = res.series.find((x) => x.contador.id === r.contador.id)
            avisar(`${r.contador.nombre}: ${nuevo ? nuevo.hoy : 0} hoy`)
            return seriesRapidas()
          }
          const res = await api(`/api/series/${idUrl(r.contador.id)}/toque`, {})
          series = res
          SEK.evento('completar', { elemento: b })
          SEK.v88.animar({ tipo: 'parry' })
          const t = res.toque || {}
          SEK.v88.nivel(t.nuevoNivel)
          if (t.extraLogrado && t.xp > 0) avisar(`${r.contador.nombre}: Extra +${t.xp} XP`, { tipo: 'ok' })
          else if (t.xp > 0) avisar(`${r.contador.nombre}: llegaste a la cuota. +${t.xp} XP`, { tipo: 'ok' })
          seriesRapidas()
        } catch (err) { error(err) }
      }
    }
    for (const p of el.querySelectorAll('.propuesta-cuota')) {
      const id = p.dataset.id
      const r = lista.find((x) => x.contador.id === id)
      p.querySelector('[data-si]').onclick = seguro(async () => { series = await api(`/api/series/${idUrl(id)}/propuesta`, { acepta: true }); avisar(`${r.contador.nombre}: ${r.propuesta.a} por serie desde hoy · cuota ${r.propuesta.cuota}`, { tipo: 'ok' }); seriesRapidas() })
      p.querySelector('[data-no]').onclick = seguro(async () => { series = await api(`/api/series/${idUrl(id)}/propuesta`, { acepta: false }); avisar('Te lo vuelvo a proponer en 3 días'); seriesRapidas() })
    }
  }

  // ---------- Otros compromisos (no pilares, sin la revisión ni el límite de juego) ----------
  const ICONO_ESTADO = { completado: '✓', cumplido: '✓', tarde: '!', no_registrado: '✕', omitido: '✕', iniciado: '…', pendiente: '○' }
  function otros() {
    const lista = d.compromisos.filter((c) => c.accion && !c.accion.pilar && !['limite_juego', 'acostarse', 'revision_diaria'].includes(c.accion.tipo))
    const el = $('#otros')
    el.hidden = !lista.length
    if (!lista.length) return
    const pend = lista.filter((c) => c.estado === 'pendiente' || c.estado === 'iniciado').length
    el.innerHTML = `<div class="fila entre"><span class="seccion-titulo">Otros compromisos</span><span class="texto-3 chico">${pend} pendiente${pend === 1 ? '' : 's'}</span></div>
      <div>${lista.map((c, i) => `<button type="button" class="fila-compromiso ${esc(c.estado)}" data-i="${i}"><span class="estado-ic">${ICONO_ESTADO[c.estado] || ''}</span><span class="crece">${esc(c.accion.nombre)}<span class="texto-3 chico">${c.horaPrevista ? ` · ${esc(c.horaPrevista)}` : ''}</span></span></button>`).join('')}</div>`
    for (const b of el.querySelectorAll('[data-i]')) {
      const c = lista[Number(b.dataset.i)]
      b.onclick = () => { if (c.accion.tipo === 'revision_semanal') location.href = '/ciclo/revision?tipo=semanal'; else detallePilar({ accion: c.accion, compromiso: c, estado: c.estado === 'completado' ? 'cumplido' : c.estado }) }
    }
  }

  // ---------- Organización: lo que me toca hoy ----------
  function organizacion() {
    const o = d.tarjetas.organizacion
    const el = $('#organizacion')
    if (!o) { el.innerHTML = ''; return }
    const L = o.limite || 3
    const m = o.tareas || []
    el.innerHTML = `<div class="fr fr-solo-tira"><section class="fr-hoy fr-hoy-chica"><div class="fr-hoy-cab"><span class="fr-kj fr-sombra" aria-hidden="true">陣</span><h2 class="fr-subr">Hoy me toca a mí</h2><span class="fr-etq">${m.length ? `${m.length} en total` : ''}</span><a class="fr-pill fr-ver" href="/organizacion">Organización ›</a></div>
      <div class="fr-tira">${m.length ? m.slice(0, L).map((x, i) => `<div class="fr-chip-tarea" style="--c:${esc(x.frente.color || '')}"><div class="fr-txt"><div class="fr-de"><span>${esc(x.frente.kanji || '')}</span>${esc(x.frente.nombre)}</div><div class="fr-t">${esc(x.tarea.texto)}</div></div><button class="fr-btn-ok" data-i="${i}" aria-label="Marcar hecha: ${esc(x.tarea.texto)}">済</button></div>`).join('') + (m.length > L ? `<a class="fr-mas" href="/organizacion">+${m.length - L} más</a>` : '') : `<div class="fr-vacio">Nada te toca hoy${o.bandeja ? ` · ${o.bandeja} en la Bandeja` : ''}.</div>`}</div></section></div>`
    for (const b of el.querySelectorAll('.fr-btn-ok')) {
      const x = m[Number(b.dataset.i)]
      b.onclick = seguro(async () => {
        await api(`/api/dia/organizacion/${idUrl(x.frente.id)}/${idUrl(x.tarea.id)}/hecha`, {})
        SEK.evento('completar', { elemento: b.closest('.fr-chip-tarea') })
        setTimeout(() => recargar().catch(error), 650)
      })
    }
  }

  // ---------- Antes del Día 1 y sin ciclo ----------
  function antes() {
    const e = d.ciclo
    const faltan = 1 - e.dia
    $('#antes').innerHTML = `<div class="enorme">${faltan}<span class="grande texto-2" style="margin-left: 8px;">${faltan === 1 ? 'día' : 'días'}</span></div>
      <p class="texto-2">El Día 1 es el ${fechaLegible(e.ciclo.inicio)}. Hasta entonces no se registra nada: ni pilares, ni XP, ni descanso.</p>
      <p class="texto-3 chico">Usá estos días para dejar todo configurado.</p>
      <div class="lista-nav compacta"><a href="/ciclo"><span>Fecha de inicio<span class="desc">${fechaLegible(e.ciclo.inicio)}</span></span><span class="flecha">›</span></a><a href="/mas/ajustes"><span>Ajustes<span class="desc">horarios, límite de juego, avisos</span></span><span class="flecha">›</span></a></div>`
  }

  // ---------- Fin de fase y de ciclo (como Hoy.tsx de la vieja) ----------
  function finFase() {
    const e = d.ciclo
    const caja = $('#fin-fase')
    if (e && e.terminado) {
      caja.innerHTML = `<section class="tarjeta"><h2>Ciclo terminado</h2>
        <p class="texto-2">Llegaste al día ${e.ciclo.duracionDias}. Revisá los resultados y empezá el siguiente ciclo: tu nivel y tu historial se conservan.</p>
        <div class="botonera"><a class="boton" href="/progreso/fase?numero=${e.faseNumero}">Ver resultados</a><a class="boton primario" href="/ciclo">Nuevo ciclo</a></div></section>`
    } else if (d.faseSinCerrar) {
      caja.innerHTML = `<div class="fila entre tarjeta compacta"><span>Terminó la fase ${d.faseSinCerrar}.</span><a class="boton chico primario" href="/progreso/fase?numero=${d.faseSinCerrar}">Revisar</a></div>`
    } else caja.innerHTML = ''
    caja.hidden = !caja.innerHTML
  }

  function pintar() {
    botonesArriba()
    const sinCiclo = d.sinCiclo
    const noEmpezado = d.ciclo && d.ciclo.noEmpezado
    $('#empezar').hidden = !sinCiclo
    if (sinCiclo && !$('#form-empezar').inicio.value) $('#form-empezar').inicio.value = d.hoy
    $('#antes').hidden = !noEmpezado
    if (noEmpezado) antes()
    $('#tablero').hidden = sinCiclo || noEmpezado
    if (sinCiclo || noEmpezado) return
    finFase()
    avisos()
    pilares()
    comida()
    if (SEK.forjaHoy) SEK.forjaHoy($('#forja-hoy')).catch(() => {})
    semanaMetas()
    accesos()
    seriesRapidas()
    otros()
    organizacion()
  }

  async function recargar() {
    const [hoy, s, m] = await Promise.all([api('/api/dia/hoy'), api('/api/series').catch(() => null), api('/api/ciclo/metas').catch(() => null)])
    d = hoy
    series = s
    metas = m
    if (d.modoSueno) { location.href = '/sueno/modo'; return }
    pintar()
    lineaDelDia().catch(() => {})
  }

  $('#form-empezar').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    await api('/api/dia/empezar-ciclo', { inicio: f.inicio.value, duracionDias: Number(f.duracionDias.value), diaCero: f.diaCero.checked })
    SEK.evento('logro')
    avisar('¡Arrancó tu ciclo!', { tipo: 'ok' })
    location.reload()
  })
  $('#dejo-celu').onclick = dejoCelu

  // El Tajo y la frase del día (desafios): la app avisa cuando se oculta; al volver, dia decide si toca.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') api('/api/dia/vista', {}).catch(() => {})
    else recargar().then(llegada).catch(() => {})
  })
  async function llegada() {
    if (!d || !window.SEK.desafios || typeof SEK.desafios.llegada !== 'function') return
    const pilarPendiente = d.pilares.some((p) => p.estado === 'pendiente' && p.accion.tipo !== 'acostarse')
    SEK.desafios.llegada({ pilarPendiente, pasoDejoCelu: d.pasoDejoCelu, modoSueno: d.modoSueno })
  }

  ;(async () => {
    try {
      await recargar()
      if (d && !d.sinCiclo && d.ciclo && !d.ciclo.noEmpezado) {
        try { if (!sessionStorage.getItem(`bienvenida:${d.hoy}`)) { sessionStorage.setItem(`bienvenida:${d.hoy}`, '1'); avisar(`Día ${d.ciclo.dia}: ${fechaLegible(d.hoy)}. ¡Vamos!`, { tipo: 'ok' }) } } catch (e) { /* sin almacenamiento */ }
      }
      await llegada()
    } catch (e) { error(e) }
    // Las escenas del shinobi se cargan cuando Hoy ya está quieto, así el primer corte no espera.
    setTimeout(() => SEK.v88.cargarEscenas(), 3000)
  })()
})()
