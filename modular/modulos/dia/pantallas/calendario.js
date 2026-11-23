// Pantalla Calendario, igual que la v0.88.27 (Calendario.tsx de la app vieja) pero en HTML+JS.
// El mes: cada día con la barrita de pilares, sus íconos (hoy, marcado, fecha clave, caída, feriado) y el río de la forja.
// Tocar un día: metas, fechas clave, horario y pilares de ese día. Mantener apretado: marcarlo (印).
// Pide a: /api/dia/calendario, /api/ciclo, /api/ciclo/metas, /api/habitos (forja), /api/habitos/fotos (marcas),
// /api/habitos/caidas, /api/dia/compromisos, /api/dia/horario/dia, /api/xp/historial.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, iconoPilar } = SEK.v88
  SEK.v88.montar({ activo: 'calendario', companero: 'esquina' })

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay()
  const sumarDias = (f, n) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const otroMes = (m, n) => { const [y, x] = m.split('-').map(Number); return new Date(Date.UTC(y, x - 1 + n, 1)).toISOString().slice(0, 7) }
  const fechaLarga = (f) => `${DIAS[diaSemana(f)]} ${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`
  const diaDelCiclo = (inicio, f) => Math.round((Date.parse(f) - Date.parse(inicio)) / 86400000) + 1
  const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

  let mes = null // 'AAAA-MM'
  let d = null // datos del mes
  let sel = null // día elegido
  let enfocar = false

  /** Todo lo del mes, en paralelo. Lo que no está (un módulo apagado) queda vacío. */
  async function cargar(m) {
    mes = m
    const [cal, ciclo, metas, habitos, fotos] = await Promise.all([
      api(`/api/dia/calendario?mes=${m}`),
      api('/api/ciclo').catch(() => null),
      api('/api/ciclo/metas').catch(() => null),
      api('/api/habitos').catch(() => null),
      api('/api/habitos/fotos').catch(() => null),
    ])
    const caidas = await api(`/api/habitos/caidas?desde=${cal.desde}&hasta=${cal.hasta}`).catch(() => ({ porDia: {} }))
    const forja = new Set()
    if (habitos && habitos.forja) for (const h of [...(habitos.forja.enForja || []), ...(habitos.forja.forjados || [])]) for (const f of h.cumplidos || []) forja.add(f)
    const todas = metas ? [
      ...(metas.pendientes || []).map((x) => ({ ...x, est: 'pendiente' })), ...(metas.vencidas || []).map((x) => ({ ...x, est: 'vencida' })),
      ...(metas.cumplidas || []).map((x) => ({ ...x, est: 'cumplida' })), ...(metas.noCumplidas || []).map((x) => ({ ...x, est: 'no_cumplida' })),
    ] : []
    d = {
      ...cal,
      diasPorFase: (ciclo && ciclo.ciclo && ciclo.ciclo.diasPorFase) || 30,
      metas: todas,
      marcas: new Map(((fotos && fotos.marcas) || []).map((x) => [x.fecha, x])),
      caidas: caidas.porDia || {},
      forja,
    }
    pintar()
  }

  const enCiclo = (f) => d.ciclo && f >= d.ciclo.inicio && f <= d.ciclo.fin
  const esDiaCero = (f) => !!(d.ciclo && d.ciclo.diaCero && d.ciclo.diaCero === f)
  const cuantasCaidas = (f) => { const x = d.caidas[f]; return Array.isArray(x) ? x.length : Number(x) || 0 }

  function pintar() {
    const [a, m] = mes.split('-').map(Number)
    $('#titulo-mes').textContent = `${MESES[m - 1]} ${a}`
    const huecos = (diaSemana(d.desde) + 6) % 7
    const celdas = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<div class="cab">${x}</div>`)
    for (let i = 0; i < huecos; i++) celdas.push('<div class="cal-dia vacio"></div>')
    for (const x of d.dias) {
      const f = x.fecha
      const cero = esDiaCero(f)
      const dentro = enCiclo(f)
      const dia = d.ciclo ? diaDelCiclo(d.ciclo.inicio, f) : 0
      const puntos = dentro || cero ? x.pilares : []
      const completo = f <= d.hoy && puntos.length > 0 && puntos.every((p) => p.estado === 'cumplido' || p.estado === 'descanso') && puntos.some((p) => p.estado === 'cumplido')
      const clases = ['cal-dia', cero ? 'dia-cero' : !dentro ? 'fuera' : '', f === d.hoy ? 'hoy tema-remarque-hoy' : '', sel === f ? 'seleccionado' : '',
        x.excepcion ? 'excepcion' : '', x.feriado ? 'feriado' : '', dentro && (dia - 1) % d.diasPorFase === 0 ? 'fase-inicio' : '', completo ? 'completo' : ''].filter(Boolean)
      // Hasta 2 íconos, por prioridad: hoy → marcado → fecha clave → caída → feriado. Si hay más, «·».
      const iconos = []
      if (f === d.hoy) iconos.push(['今', 'hoy'])
      if (d.marcas.has(f)) iconos.push(['印', 'marca'])
      if (x.fechasClave.length) iconos.push(['印', 'clave'])
      if (cuantasCaidas(f) > 0) iconos.push(['墓', 'caida'])
      if (x.feriado) iconos.push(['祝', 'feriado'])
      const etiqueta = `${fechaLarga(f)}${cero ? ', Día 0: calentamiento' : dentro ? `, día ${dia}` : ''}${cuantasCaidas(f) ? ', caída superada' : ''}${x.fechasClave.length ? `, fecha clave: ${x.fechasClave.map((c) => c.titulo).join(', ')}` : ''}`
      celdas.push(`<div class="${clases.join(' ')}" data-f="${f}" role="button" aria-label="${esc(etiqueta)}">
        <span class="num">${Number(f.slice(8))}</span>${cero ? '<span class="cal-cero" aria-hidden="true">Día 0</span>' : ''}
        ${iconos.length ? `<span class="cal-iconos" aria-hidden="true">${iconos.slice(0, 2).map(([k, c]) => `<span class="cal-icono ${c}">${k}</span>`).join('')}${iconos.length > 2 ? '<span class="cal-mas">·</span>' : ''}</span>` : ''}
        ${puntos.length ? `<span class="cal-barra" aria-hidden="true">${puntos.map((p) => `<i class="${f > d.hoy ? '' : p.estado}"></i>`).join('')}</span>` : ''}
        ${d.forja.has(f) ? `<span class="cal-rio ${d.forja.has(sumarDias(f, -1)) ? 'une-izq' : ''} ${d.forja.has(sumarDias(f, 1)) ? 'une-der' : ''}" aria-hidden="true"></span>` : ''}
      </div>`)
    }
    $('#rejilla').innerHTML = celdas.join('')
    for (const el of $('#rejilla').querySelectorAll('[data-f]')) tocable(el)
    marcaFila()
    seguro(detalle)()
  }

  /** Tocar elige el día; mantener apretado (550 ms) abre «Marcar este día». */
  function tocable(el) {
    let t = null
    let largo = false
    const soltar = () => { if (t) { clearTimeout(t); t = null } }
    el.onpointerdown = () => { largo = false; soltar(); t = setTimeout(() => { largo = true; t = null; marcar(el.dataset.f) }, 550) }
    el.onpointerup = soltar
    el.onpointerleave = soltar
    el.oncontextmenu = (e) => e.preventDefault()
    el.onclick = () => {
      if (largo) { largo = false; return }
      const f = el.dataset.f
      enfocar = sel !== f
      sel = sel === f ? null : f
      pintar()
    }
  }

  function marcaFila() {
    if (!sel) { $('#marca-fila').innerHTML = ''; return }
    const m = d.marcas.get(sel)
    $('#marca-fila').innerHTML = `<div class="fila entre tarjeta compacta cal-marca-fila">${m ? `<span><span class="cal-marca muestra">印</span> ${esc(m.texto)}</span>` : '<span class="texto-3 chico">Sin marca este día</span>'}<button type="button" class="boton chico suave">${m ? 'Editar' : '印 Marcar este día'}</button></div>`
    $('#marca-fila button').onclick = () => marcar(sel)
  }

  function marcar(f) {
    const m = d.marcas.get(f)
    const h = hoja(`印 ${m ? 'Día marcado' : 'Marcar este día'} · ${SEK.v88.fechaLegible(f)}`, `
      <div class="campo"><label>¿Qué pasó ese día?</label><input maxlength="80" value="${esc(m ? m.texto : '')}" placeholder="Ej.: cambié de estilo, primer día sin celu"></div>
      <button type="button" class="boton primario ancho" data-guardar>${m ? 'Guardar' : 'Marcar'}</button>
      ${m ? '<button type="button" class="boton suave ancho" data-quitar>Quitar la marca</button>' : ''}`)
    const campo = h.el.querySelector('input')
    const boton = h.el.querySelector('[data-guardar]')
    const revisar = () => { boton.disabled = !campo.value.trim() }
    campo.oninput = revisar; revisar(); setTimeout(() => campo.focus(), 50)
    boton.onclick = seguro(async () => { await api(`/api/habitos/marcas/${f}`, { texto: campo.value.trim() }, 'PUT'); avisar('Día marcado 印', { tipo: 'ok' }); h.cerrar(); await cargar(mes) })
    if (m) h.el.querySelector('[data-quitar]').onclick = seguro(async () => { await api(`/api/habitos/marcas/${f}`, undefined, 'DELETE'); avisar('Marca quitada'); h.cerrar(); await cargar(mes) })
  }

  function textoPilar(estado, c, esCelu, futuro) {
    if (futuro) return estado === 'descanso' ? 'No aplica' : 'Pendiente'
    switch (estado) {
      case 'cumplido': return c && c.finReal ? `Hecho a las ${hora(c.finReal)}${c.minutos ? ` · ${c.minutos} min` : ''}` : 'Hecho'
      case 'tarde': return `${esCelu ? 'Dejé el celu tarde' : 'Tarde'} · ${(c && c.retrasoMinutos) || 0} min (sin XP)`
      case 'omitido': return 'No cumplido'
      case 'descanso': return 'No aplicaba'
      default: return 'Sin marcar todavía'
    }
  }

  // ---------- Debajo del calendario: el día elegido ----------
  async function detalle() {
    if (!sel) { $('#detalle').innerHTML = ''; return }
    const f = sel
    const x = d.dias.find((y) => y.fecha === f)
    const [comp, horario, xp] = await Promise.all([
      api(`/api/dia/compromisos?fecha=${f}`).catch(() => ({ compromisos: [] })),
      api(`/api/dia/horario/dia?fecha=${f}`).catch(() => null),
      api('/api/xp/historial?cantidad=200').catch(() => ({ movimientos: [] })),
    ])
    if (sel !== f) return
    const compromisos = comp.compromisos || []
    const totalXp = (xp.movimientos || []).filter((r) => r.fecha === f && !r.anulado).reduce((s, r) => s + r.cantidad, 0)
    const cero = esDiaCero(f)
    const dentro = enCiclo(f) || cero
    const dia = d.ciclo ? diaDelCiclo(d.ciclo.inicio, f) : 0
    const corregible = f < d.hoy && Date.parse(d.hoy) - Date.parse(f) <= 2 * 86400000
    const metas = d.metas.filter((m) => m.fecha === f)
    const nCaidas = cuantasCaidas(f)

    const filasMetas = metas.map((m) => `<div class="meta-rapida ${m.est}" data-meta="${esc(m.id)}"><button class="meta-casilla" role="checkbox" aria-checked="${m.est === 'cumplida'}" aria-label="${esc(m.titulo)}">${m.est === 'cumplida' ? '✓' : ''}</button><span class="meta-titulo">${esc(m.titulo)}</span></div>`).join('')
    const bloques = horario ? horario.bloques.filter((b) => b.tipo !== 'dormir') : []
    const huecos = horario ? horario.huecos || [] : []
    const libre = (h) => `${h.desde}–${h.hasta} (${h.minutos >= 60 ? `${Math.floor(h.minutos / 60)} h${h.minutos % 60 ? ` ${h.minutos % 60}` : ''}` : `${h.minutos} min`})`
    const pilares = x.pilares.map((p, i) => {
      const c = compromisos.find((y) => y.accionId === p.accionId)
      const tipo = c && c.accion ? c.accion.tipo : 'compromiso'
      const esCelu = tipo === 'acostarse'
      const corregir = corregible && c && c.estado !== 'reprogramado' && !esCelu
      return `<div class="pilar-fila ${f > d.hoy ? 'futuro' : p.estado}"><span class="punto" aria-hidden="true"></span><span class="icono">${iconoPilar(p.accionId, tipo)}</span>
        <span class="crece col" style="gap: 0;"><b class="chico"><span class="texto-3 mono">${i + 1} </span>${esc(p.nombre)}</b><span class="muy-chico texto-3">${textoPilar(p.estado, c, esCelu, f > d.hoy)}</span></span>
        ${corregir ? `<button class="boton chico suave" data-corregir="${esc(c.id)}" data-a="${c.estado === 'completado' ? 'omitido' : 'completado'}">${c.estado === 'completado' ? 'No lo hice' : 'Sí lo hice'}</button>` : ''}</div>`
    }).join('')

    $('#detalle').innerHTML = `<section class="tarjeta compacta">
      <div class="fila entre"><b>${fechaLarga(f)}${dentro ? `<span class="texto-3 chico"> · ${cero ? 'Día 0, calentamiento ✨' : `día ${dia}`}</span>` : ''}</b><span class="chico texto-3">${f > d.hoy ? '' : `+${totalXp} XP`}${x.porcentaje != null ? ` · ${x.porcentaje} %` : ''}</span></div>
      <div class="metas-del-dia">
        ${f >= d.hoy ? `<form class="campo-meta"><input placeholder="Escribir meta" enterkeyhint="done" aria-label="Escribir meta para ${f}"><button type="submit" class="boton chico" disabled>Guardar</button></form>` : ''}
        ${filasMetas}
        ${f < d.hoy && !metas.length ? '<p class="muy-chico texto-3">Sin metas ese día. En días pasados no se agregan.</p>' : ''}
      </div>
      ${nCaidas ? `<p class="muy-chico texto-2 fila" style="gap: 6px; margin: 2px 0;"><span class="caidas-fila">${'墓'.repeat(nCaidas)}</span>${nCaidas === 1 ? 'Una caída' : `${nCaidas} caídas`} ese día · nuevo round, seguiste</p>` : ''}
      <div class="claves-del-dia">
        ${x.fechasClave.map((fc) => `<button type="button" class="clave-fila" data-fc="${esc(fc.id)}" aria-label="Fecha clave: ${esc(fc.titulo)}. Tocá para editar"><span class="sello-clave grande" aria-hidden="true">印</span><span class="crece col" style="gap: 0;"><b class="chico">${esc(fc.titulo)}</b>${fc.nota || fc.anual || fc.hora ? `<span class="muy-chico texto-3">${esc([fc.hora ? `${fc.hora}${fc.horaFin ? `–${fc.horaFin}` : ''}` : '', fc.nota, fc.anual ? 'cada año' : ''].filter(Boolean).join(' · '))}</span>` : ''}</span></button>`).join('')}
        <button type="button" class="boton chico suave clave-nueva">+ fecha clave</button>
      </div>
      ${bloques.length ? `<div class="hor-dia-lista"><div class="fila entre"><span class="seccion-titulo">Horario</span><a class="chico texto-3" href="/horario">Mi horario ›</a></div>
        ${bloques.map((b) => `<button type="button" class="hor-dia-fila ${b.tipo} ${b.apagado ? 'apagado' : ''}" data-bloque="${esc(b.id)}" ${b.origen === 'fechaClave' ? 'disabled' : ''}><i class="hor-muestra ${b.tipo}" aria-hidden="true"></i><span class="crece">${esc(b.nombre)}<span class="texto-3 chico"> · ${b.desde}–${b.hasta}${b.variable ? ' · hoy' : ''}</span></span><span class="chico texto-3">${b.apagado ? (b.motivoApagado === 'feriado' ? 'feriado' : 'no hay') : f >= d.hoy && b.origen !== 'fechaClave' ? 'apagar' : ''}</span></button>`).join('')}
        ${f >= d.hoy && huecos.length ? `<p class="chico texto-2" style="margin: 0;">Libre: ${huecos.map(libre).join(' · ')}</p>` : ''}</div>` : ''}
      ${!dentro ? '<p class="texto-3 chico">Fuera del ciclo: ese día no se registra nada.</p>' : `<div class="pilares-lista">${pilares}</div>`}
      <button class="boton chico ancho" data-mas>Revisión, feriado y excepción de este día ›</button>
    </section>`

    const sec = $('#detalle')
    const form = sec.querySelector('.campo-meta')
    if (form) {
      const campo = form.querySelector('input'), boton = form.querySelector('button')
      campo.oninput = () => { boton.disabled = !campo.value.trim() }
      if (enfocar) { campo.focus({ preventScroll: false }); enfocar = false }
      form.onsubmit = seguro(async (e) => {
        e.preventDefault()
        const t = campo.value.trim()
        if (!t) return
        await api('/api/ciclo/metas', { titulo: t, fecha: f })
        avisar('Meta guardada', { tipo: 'ok' })
        enfocar = true
        await cargar(mes)
      })
    }
    for (const el of sec.querySelectorAll('[data-meta]')) {
      const m = metas.find((y) => y.id === el.dataset.meta)
      const alternar = seguro(async () => {
        if (m.est === 'cumplida') await api(`/api/ciclo/metas/${encodeURIComponent(m.id)}/reabrir`, {})
        else await api(`/api/ciclo/metas/${encodeURIComponent(m.id)}/resolver`, { lograda: true })
        await cargar(mes)
      })
      el.querySelector('.meta-casilla').onclick = alternar
      el.querySelector('.meta-titulo').onclick = alternar
    }
    for (const el of sec.querySelectorAll('[data-fc]')) el.onclick = () => fechaClave(f, x.fechasClave.find((y) => y.id === el.dataset.fc))
    sec.querySelector('.clave-nueva').onclick = () => fechaClave(f, null)
    for (const el of sec.querySelectorAll('[data-bloque]')) {
      el.onclick = seguro(async () => {
        const b = bloques.find((y) => y.id === el.dataset.bloque)
        if (b.apagado && b.motivoApagado === 'feriado') return avisar('Feriado: los obligatorios no van. Para que vaya, quitá el feriado.')
        await api('/api/dia/horario/apagar', { fecha: f, bloqueId: b.id, apagado: !b.apagado })
        avisar(b.apagado ? `${b.nombre}: vuelve ese día` : `${b.nombre}: ese día no hay`)
        await detalle()
      })
    }
    for (const el of sec.querySelectorAll('[data-corregir]')) {
      el.onclick = seguro(async () => {
        await api(`/api/dia/compromisos/${encodeURIComponent(el.dataset.corregir)}/corregir`, { estado: el.dataset.a, motivo: 'Corrección desde el calendario' })
        avisar('Corregido (queda en el historial)')
        await cargar(mes)
      })
    }
    sec.querySelector('[data-mas]').onclick = () => masDelDia(x, compromisos, totalXp)
  }

  /** La hoja «Revisión, feriado y excepción de este día». */
  function masDelDia(x, compromisos, totalXp) {
    const f = x.fecha
    const cero = esDiaCero(f)
    const dia = d.ciclo ? diaDelCiclo(d.ciclo.inicio, f) : 0
    const fase = Math.floor((dia - 1) / d.diasPorFase) + 1
    const cuentan = compromisos.filter((c) => c.estado !== 'reprogramado')
    const porcentaje = x.porcentaje != null ? x.porcentaje : cuentan.length ? Math.round((100 * cuentan.filter((c) => c.estado === 'completado').length) / cuentan.length) : null
    const otros = compromisos.filter((c) => !c.accion || !c.accion.pilar)
    const finde = !!x.feriado || [0, 6].includes(diaSemana(f))
    const h = hoja(`${fechaLarga(f)}${enCiclo(f) || cero ? (cero ? ' · Día 0' : ` · día ${dia} · fase ${fase}`) : ''}`, `
      <div class="fila entre"><span class="texto-2">Cumplimiento</span><b>${f > d.hoy || porcentaje == null ? '<span class="texto-3">—</span>' : `${porcentaje} %`}</b></div>
      ${x.excepcion ? `<div class="etiqueta medio">Excepción: ${esc(x.excepcion.motivo)}</div>` : ''}
      ${x.feriado ? `<div class="etiqueta">Feriado: ${esc(x.feriado.nombre)} · juego hasta 120 min</div>` : ''}
      ${otros.map((c) => `<div class="compromiso ${c.estado}" style="padding: 8px 0;"><div class="marca" style="width: 22px; height: 22px; font-size: 0.7rem;">${c.estado === 'completado' ? '✓' : c.estado === 'omitido' || c.estado === 'no_registrado' ? '✕' : c.estado === 'reprogramado' ? '→' : ''}</div><div class="crece fila entre"><span class="nombre chico">${esc(c.accion.nombre)}</span><span class="chico texto-3">${esc(String(c.estado).replace('_', ' '))}</span></div></div>`).join('')}
      ${compromisos.length ? '' : '<p class="texto-3 chico">Sin compromisos registrados ese día.</p>'}
      <div class="fila entre chico"><span class="texto-2">XP del día</span><b class="mono">+${totalXp}</b></div>
      ${f === d.hoy ? '<a class="boton chico" href="/ciclo/revision">Revisión diaria</a>' : f < d.hoy ? `<a class="boton chico suave" href="/ciclo/revision?fecha=${f}">Ver revisión de ese día</a>` : ''}
      <div class="separador"></div>
      <div class="fila entre chico"><span class="texto-2">${x.feriado ? 'Feriado' : 'Día común'} · límite de juego como ${finde ? 'fin de semana' : 'día de semana'}</span>
        <button class="boton chico ${x.feriado ? 'suave' : ''}" data-feriado>${x.feriado ? 'Quitar feriado' : 'Marcar feriado'}</button></div>
      ${x.excepcion ? '<button class="boton chico suave" data-excepcion>Quitar excepción</button>' : `<details><summary class="chico texto-2">Marcar como excepción (enfermedad, viaje)</summary>
        <div class="fila" style="margin-top: 8px;"><input class="crece" placeholder="Motivo" maxlength="200" style="background: var(--fondo); border: 1px solid var(--borde); border-radius: 10px; padding: 10px; min-height: 44px;"><button class="boton" data-excepcion disabled>Marcar</button></div></details>`}`)
    const despues = async (texto) => { if (texto) avisar(texto); h.cerrar(); await cargar(mes) }
    h.el.querySelector('[data-feriado]').onclick = seguro(async () => {
      if (x.feriado) { await api(`/api/dia/feriados/${f}`, undefined, 'DELETE'); return despues('Ya no es feriado') }
      await api(`/api/dia/feriados/${f}`, { nombre: 'Feriado' }, 'PUT')
      despues('Marcado como feriado: límite de juego de fin de semana')
    })
    const exc = h.el.querySelector('[data-excepcion]')
    const motivo = h.el.querySelector('details input')
    if (motivo) motivo.oninput = () => { exc.disabled = !motivo.value.trim() }
    exc.onclick = seguro(async () => {
      if (x.excepcion) { await api(`/api/dia/excepciones/${f}`, undefined, 'DELETE'); return despues('') }
      await api(`/api/dia/excepciones/${f}`, { motivo: motivo.value.trim() }, 'PUT')
      despues('Día marcado como excepción: no cuenta en atributos ni racha')
    })
  }

  /** Nueva fecha clave o editar una (印). No da XP. */
  function fechaClave(fecha, fc) {
    const h = hoja(fc ? 'Editar fecha clave' : 'Nueva fecha clave', `
      <p class="ayuda">${SEK.v88.fechaLegible(fc && !fc.anual ? fc.fecha : fecha)}. Queda marcada en el calendario; no da XP ni cuenta como meta.</p>
      <div class="campo"><label>Título</label><input name="titulo" maxlength="80" value="${esc(fc ? fc.titulo : '')}" placeholder="Ej.: Ingreso a la facultad"></div>
      <div class="campo"><label>Nota (opcional)</label><textarea name="nota" rows="2" maxlength="240" placeholder="Ej.: llevar DNI y título">${esc(fc && fc.nota ? fc.nota : '')}</textarea></div>
      <div class="rejilla-2"><div class="campo"><label>Hora (opcional)</label><input type="time" name="hora" value="${esc(fc && fc.hora ? fc.hora : '')}"></div>
        <div class="campo"><label>Hasta</label><input type="time" name="horaFin" value="${esc(fc && fc.horaFin ? fc.horaFin : '')}"></div></div>
      <p class="ayuda" data-ayuda-hora style="margin-top: -6px;">Con hora, ese día cuenta como bloque obligatorio en Mi horario (examen, trámite): sin avisos mientras dura.</p>
      <label class="fila" style="gap: 8px; margin-bottom: 12px;"><input type="checkbox" name="anual" ${fc && fc.anual ? 'checked' : ''}><span>Se repite cada año (cumpleaños, aniversarios)</span></label>
      <button class="boton primario ancho" data-guardar>Guardar</button>
      ${fc ? '<button class="boton suave ancho" style="margin-top: 8px;" data-borrar>Borrar fecha clave</button>' : ''}`)
    const q = (n) => h.el.querySelector(`[name="${n}"]`)
    const guardar = h.el.querySelector('[data-guardar]')
    const revisar = () => {
      guardar.disabled = !q('titulo').value.trim()
      q('horaFin').disabled = !q('hora').value
      h.el.querySelector('[data-ayuda-hora]').hidden = !q('hora').value
    }
    q('titulo').oninput = revisar; q('hora').oninput = revisar; revisar()
    guardar.onclick = seguro(async () => {
      const cuerpo = { titulo: q('titulo').value.trim(), fecha: fc ? fc.fecha : fecha, nota: q('nota').value.trim() || null, anual: q('anual').checked, hora: q('hora').value || null, horaFin: q('hora').value ? q('horaFin').value || null : null }
      if (fc) await api(`/api/dia/fechas-clave/${encodeURIComponent(fc.id)}`, cuerpo, 'PUT')
      else await api('/api/dia/fechas-clave', cuerpo)
      avisar(fc ? 'Fecha clave guardada' : 'Fecha clave marcada 印', { tipo: 'ok' })
      h.cerrar(); await cargar(mes)
    })
    if (fc) {
      const borrar = h.el.querySelector('[data-borrar]')
      borrar.onclick = seguro(async () => {
        // Confirmar en la misma hoja: el primer toque pregunta, el segundo borra.
        if (!borrar.dataset.seguro) { borrar.dataset.seguro = '1'; borrar.textContent = `¿Borrar «${fc.titulo}»${fc.anual ? ' de todos los años' : ''}? Tocá de nuevo`; borrar.classList.add('peligro'); return }
        await api(`/api/dia/fechas-clave/${encodeURIComponent(fc.id)}`, undefined, 'DELETE')
        avisar('Fecha clave borrada'); h.cerrar(); await cargar(mes)
      })
    }
  }

  $('#anterior').onclick = seguro(() => cargar(otroMes(mes, -1)))
  $('#siguiente').onclick = seguro(() => cargar(otroMes(mes, 1)))

  // Desde Hoy: «abrir este día» llega como ?dia=AAAA-MM-DD
  seguro(async () => {
    const pedido = new URLSearchParams(location.search).get('dia')
    if (pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido)) { sel = pedido; enfocar = true; return cargar(pedido.slice(0, 7)) }
    const r = await api('/api/dia/horario/dia') // trae la fecha de hoy en la zona de la persona
    await cargar(r.fecha.slice(0, 7))
  })()
})()
