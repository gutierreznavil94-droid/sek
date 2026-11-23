// Pantalla Calendario: el mes con el cumplimiento de cada día, feriados, días que no cuentan y fechas clave. Pide a /api/dia/*.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, fechaLarga, mesLargo, hoja, DIAS_CORTOS, diaSemana } = DIA
  let mes = null
  let d = null
  let elegida = null

  const NOMBRE_ESTADO = { cumplido: 'Cumplido', tarde: 'Tarde', omitido: 'No cumplido', pendiente: 'Pendiente', descanso: 'Descanso' }
  const otroMes = (m, n) => { const [y, x] = m.split('-').map(Number); const t = new Date(Date.UTC(y, x - 1 + n, 1)); return t.toISOString().slice(0, 7) }

  async function cargar(m) {
    mes = m
    d = await api(`/api/dia/calendario?mes=${m}`)
    if (!elegida || elegida.slice(0, 7) !== m) elegida = d.hoy.slice(0, 7) === m ? d.hoy : d.desde
    pintar()
  }

  function enCiclo(f) { return d.ciclo && f >= (d.ciclo.diaCero || d.ciclo.inicio) && f <= d.ciclo.fin }

  function pintar() {
    $('#titulo-mes').textContent = mesLargo(mes)
    const huecos = (diaSemana(d.desde) + 6) % 7 // lunes primero
    const celdas = [1, 2, 3, 4, 5, 6, 0].map((n) => `<div class="nombre-dia">${DIAS_CORTOS[n]}</div>`)
    for (let i = 0; i < huecos; i++) celdas.push('<div class="celda vacia"></div>')
    for (const x of d.dias) {
      const clases = ['celda']
      if (x.hoy) clases.push('hoy')
      if (x.futuro) clases.push('futuro')
      if (x.feriado) clases.push('feriado')
      if (enCiclo(x.fecha)) clases.push('en-ciclo')
      if (x.nivel) clases.push(x.porcentaje >= 75 ? 'nivel-alto' : x.porcentaje >= 50 ? 'nivel-medio' : 'nivel-bajo')
      if (x.fecha === elegida) clases.push('elegida')
      const puntos = x.futuro || !enCiclo(x.fecha) ? '' : x.pilares.filter((p) => p.estado !== 'descanso').map((p) => `<i class="${p.estado}"></i>`).join('')
      const etiqueta = `${fechaLarga(x.fecha)}${x.porcentaje !== null ? `, ${x.porcentaje}%` : ''}${x.feriado ? `, feriado` : ''}`
      celdas.push(`<button class="${clases.join(' ')}" data-f="${x.fecha}" aria-label="${esc(etiqueta)}">
        <span class="num">${Number(x.fecha.slice(8))}</span>${x.fechasClave.length ? '<span class="sello" aria-hidden="true">印</span>' : ''}
        <span class="puntos">${puntos}</span></button>`)
    }
    $('#rejilla').innerHTML = celdas.join('')
    for (const b of $('#rejilla').querySelectorAll('button[data-f]')) b.onclick = () => { elegida = b.dataset.f; pintar() }
    detalle()
  }

  function detalle() {
    const x = d.dias.find((y) => y.fecha === elegida)
    if (!x) { $('#detalle').innerHTML = ''; return }
    const marcaCiclo = d.ciclo && x.fecha === d.ciclo.inicio ? ' · Día 1' : d.ciclo && x.fecha === d.ciclo.diaCero ? ' · Día 0' : d.ciclo && x.fecha === d.ciclo.fin ? ' · último día del ciclo' : ''
    const pil = x.pilares.map((p) => `<div class="fila-pilar"><span>${esc(p.nombre)}</span><span class="${p.estado === 'cumplido' ? 'ok' : p.estado === 'omitido' ? 'mal' : p.estado === 'tarde' ? 'aviso' : 'apagado'}">${NOMBRE_ESTADO[p.estado] || p.estado}</span></div>`).join('')
    const fcs = x.fechasClave.map((fc) => `<button class="linea acento" data-fc="${esc(fc.id)}" style="text-align:left;width:100%"><span class="kanji">印</span> ${esc(fc.titulo)}${fc.hora ? ` · ${esc(fc.hora)}${fc.horaFin ? `–${esc(fc.horaFin)}` : ''}` : ''}${fc.anual ? ' · cada año' : ''}${fc.nota ? `<br><span class="chico">${esc(fc.nota)}</span>` : ''}</button>`).join('')
    const bloques = x.bloques.map((b) => `<div class="fila-pilar"><span>${esc(b.nombre)}</span><span class="apagado">${b.desde}–${b.hasta}</span></div>`).join('')
    $('#detalle').innerHTML = `
      <div class="fila entre"><h3>${esc(fechaLarga(x.fecha))}${marcaCiclo}</h3>${x.porcentaje !== null ? `<span class="contador">${x.porcentaje}%</span>` : ''}</div>
      ${x.feriado ? `<div class="linea ambar">Feriado: ${esc(x.feriado.nombre)}</div>` : ''}
      ${x.excepcion ? `<div class="linea ambar">No cuenta: ${esc(x.excepcion.motivo)}</div>` : ''}
      ${pil ? `<div>${pil}</div>` : '<p class="chico apagado">Sin pilares este día.</p>'}
      ${fcs ? `<div class="lineas">${fcs}</div>` : ''}
      ${bloques ? `<details><summary class="chico">Mi horario ese día</summary>${bloques}</details>` : ''}
      <div class="fila">
        <button class="mini" id="nueva-fc">+ Fecha clave</button>
        <button class="mini" id="feriado">${x.feriado ? 'Quitar feriado' : 'Marcar feriado'}</button>
        ${x.futuro ? '' : `<button class="mini" id="excepcion">${x.excepcion ? 'Que vuelva a contar' : 'Este día no cuenta'}</button>`}
      </div>`
    $('#nueva-fc').onclick = () => fechaClave(x.fecha, null)
    for (const b of $('#detalle').querySelectorAll('[data-fc]')) b.onclick = () => fechaClave(x.fecha, x.fechasClave.find((y) => y.id === b.dataset.fc))
    $('#feriado').onclick = seguro(async () => {
      if (x.feriado) await api(`/api/dia/feriados/${x.fecha}`, undefined, 'DELETE')
      else await feriadoNuevo(x.fecha)
      await cargar(mes)
    })
    if ($('#excepcion')) $('#excepcion').onclick = () => excepcion(x)
  }

  function feriadoNuevo(fecha) {
    return new Promise((listo) => {
      const h = hoja('Marcar feriado', '<label>Nombre<input name="nombre" maxlength="120" value="Feriado"></label><p class="chico">Ese día usa el límite de juego de finde y los bloques obligatorios de Mi horario se apagan.</p>', async (v) => {
        await api(`/api/dia/feriados/${fecha}`, { nombre: v.nombre }, 'PUT')
        mensaje('Feriado marcado')
      }, { boton: 'Marcar' })
      h.addEventListener('close', listo)
    })
  }

  function excepcion(x) {
    if (x.excepcion) {
      return seguro(async () => { await api(`/api/dia/excepciones/${x.fecha}`, undefined, 'DELETE'); await cargar(mes) })()
    }
    hoja('Este día no cuenta', '<label>Por qué<input name="motivo" maxlength="200" placeholder="Enfermedad, viaje…" required></label><p class="chico">No resta XP ni corta la racha.</p>', async (v) => {
      await api(`/api/dia/excepciones/${x.fecha}`, { motivo: v.motivo }, 'PUT')
      await cargar(mes)
    }, { boton: 'Guardar' })
  }

  function fechaClave(fecha, fc) {
    const campos = `
      <label>Título<input name="titulo" maxlength="120" required value="${esc(fc ? fc.titulo : '')}" placeholder="Ingreso a la facultad"></label>
      <label>Fecha<input type="date" name="fecha" required value="${esc(fc ? fc.fecha : fecha)}"></label>
      <div class="fila"><label class="crece">Hora (opcional)<input type="time" name="hora" value="${esc(fc && fc.hora ? fc.hora : '')}"></label>
      <label class="crece">Hasta<input type="time" name="horaFin" value="${esc(fc && fc.horaFin ? fc.horaFin : '')}"></label></div>
      <label class="interruptor"><input type="checkbox" name="anual" ${fc && fc.anual ? 'checked' : ''}> Se repite cada año</label>
      <label>Nota<textarea name="nota" rows="2" maxlength="500">${esc(fc && fc.nota ? fc.nota : '')}</textarea></label>
      <p class="chico">Con hora, ese día es un bloque obligatorio en Mi horario. No da XP.</p>`
    hoja(fc ? 'Fecha clave' : 'Nueva fecha clave', campos, async (v) => {
      const cuerpo = { titulo: v.titulo, fecha: v.fecha, hora: v.hora || null, horaFin: v.hora ? v.horaFin || null : null, anual: v.anual, nota: v.nota || null }
      if (fc) await api(`/api/dia/fechas-clave/${encodeURIComponent(fc.id)}`, cuerpo, 'PUT')
      else await api('/api/dia/fechas-clave', cuerpo)
      await cargar(mes)
    }, { boton: fc ? 'Guardar' : 'Agregar', extra: fc ? '<button class="peligro" data-accion="borrar">Borrar</button>' : '', alAccion: async () => {
      await api(`/api/dia/fechas-clave/${encodeURIComponent(fc.id)}`, undefined, 'DELETE')
      await cargar(mes)
    } })
  }

  $('#anterior').onclick = seguro(() => cargar(otroMes(mes, -1)))
  $('#siguiente').onclick = seguro(() => cargar(otroMes(mes, 1)))
  $('#ir-hoy').onclick = seguro(async () => { elegida = null; await cargar(d.hoy.slice(0, 7)) })

  barra('calendario')
  seguro(async () => {
    const r = await api('/api/dia/horario/dia') // trae la fecha de hoy en la zona de la persona
    await cargar(r.fecha.slice(0, 7))
  })()
})()
