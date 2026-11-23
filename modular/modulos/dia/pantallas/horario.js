// Pantalla Mi horario: bloques fijos de la semana, horarios guardados y apagar un bloque solo un día. Pide a /api/dia/horario*.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, hoja, casillasDias, diasDe, DIAS, fechaCorta } = DIA
  let d = null
  const TIPOS = { obligatorio: 'Obligatorio (cursada, trabajo)', otro: 'Otro' }

  async function cargar() { d = await api('/api/dia/horario'); pintar(); await hoyLibre() }

  async function hoyLibre() {
    const h = await api('/api/dia/horario/dia')
    $('#hoy-libre').hidden = false
    $('#momento').textContent = h.momento ? h.momento.texto : ''
    $('#huecos').textContent = h.huecos.length ? `Huecos libres: ${h.huecos.map((x) => `${x.desde}–${x.hasta}`).join(' · ')}` : 'Sin huecos libres hoy.'
  }

  function pintar() {
    $('#pestanas').innerHTML = d.config.horarios.map((h) => `<button class="mini${h.id === d.config.activo ? ' activo' : ''}" data-id="${esc(h.id)}" aria-pressed="${h.id === d.config.activo}">${esc(h.nombre)}</button>`).join('')
    for (const b of $('#pestanas').querySelectorAll('button')) b.onclick = seguro(async () => { await api(`/api/dia/horarios/${encodeURIComponent(b.dataset.id)}/activar`, {}); await cargar() })
    $('#borrar-horario').hidden = d.config.horarios.length <= 1
    $('#plantillas').innerHTML = [
      '<button class="mini" data-p="">+ Bloque</button>',
      ...d.plantillas.map((p, i) => `<button class="mini" data-p="${i}">+ ${esc(p.nombre)} ${p.desde}–${p.hasta}</button>`),
      d.entreno ? '<button class="mini" data-p="entreno">Entreno: días y hora</button>' : '',
    ].join('')
    for (const b of $('#plantillas').querySelectorAll('button')) {
      b.onclick = () => {
        if (b.dataset.p === 'entreno') return editarEntreno()
        const p = b.dataset.p === '' ? null : d.plantillas[Number(b.dataset.p)]
        editar(p ? { nombre: p.nombre, tipo: p.tipo, dias: p.dias, desde: p.desde, hasta: p.hasta } : { nombre: '', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '12:00' }, true)
      }
    }
    $('#semana').innerHTML = d.dias.map((dia) => `
      <section class="dia-horario${dia.fecha === d.hoy ? ' hoy' : ''}">
        <h3>${DIAS[new Date(`${dia.fecha}T12:00:00Z`).getUTCDay()]} <span class="chico">${esc(fechaCorta(dia.fecha))}</span></h3>
        ${dia.bloques.length ? dia.bloques.map((b) => `
          <button class="bloque ${esc(b.tipo)}${b.apagado ? ' apagado' : ''}" data-f="${dia.fecha}" data-id="${esc(b.id)}">
            <span class="horas">${b.desde}–${b.hasta}</span><span class="crece">${esc(b.nombre)}${b.apagado ? ` <span class="chico">(${b.motivoApagado === 'feriado' ? 'feriado' : 'apagado este día'})</span>` : ''}</span>
          </button>`).join('') : '<p class="chico apagado">Libre</p>'}
      </section>`).join('')
    for (const b of $('#semana').querySelectorAll('.bloque')) b.onclick = () => tocarBloque(b.dataset.f, b.dataset.id)
  }

  function tocarBloque(fecha, id) {
    const dia = d.dias.find((x) => x.fecha === fecha)
    const b = dia.bloques.find((x) => x.id === id)
    if (b.id.startsWith('fc:')) { location.href = '/calendario'; return }
    if (b.tipo === 'entreno') return editarEntreno(fecha, b)
    const fijo = d.activo.bloques.find((x) => x.id === id)
    const extra = `<div class="fila">
      <button class="mini" data-accion="apagar">${b.apagado && b.motivoApagado === 'excepcion' ? 'Prender' : 'Apagar'} solo el ${esc(fechaCorta(fecha))}</button>
      <button class="mini" data-accion="copiar">Copiar a otros días</button>
      <button class="mini peligro" data-accion="borrar">Borrar bloque</button></div>`
    editar(fijo, false, { extra, alAccion: async (accion, v) => {
      if (accion === 'apagar') await api('/api/dia/horario/apagar', { fecha, bloqueId: id, apagado: !(b.apagado && b.motivoApagado === 'excepcion') })
      if (accion === 'borrar') await api(`/api/dia/horario/bloques/${encodeURIComponent(id)}`, undefined, 'DELETE')
      if (accion === 'copiar') await api(`/api/dia/horario/bloques/${encodeURIComponent(id)}/copiar`, { dias: diasDe(v) })
      await cargar()
    } })
  }

  function editar(b, nuevo, opciones = {}) {
    const campos = `
      <label>Nombre<input name="nombre" maxlength="80" required value="${esc(b.nombre)}" placeholder="Facultad"></label>
      <label>Tipo<select name="tipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${b.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="fila"><label class="crece">Desde<input type="time" name="desde" required value="${esc(b.desde)}"></label><label class="crece">Hasta<input type="time" name="hasta" required value="${esc(b.hasta)}"></label></div>
      <div class="dias-semana" role="group" aria-label="Días">${casillasDias(b.dias)}</div>`
    hoja(nuevo ? 'Nuevo bloque' : 'Bloque', campos, async (v) => {
      const cuerpo = { nombre: v.nombre, tipo: v.tipo, desde: v.desde, hasta: v.hasta, dias: diasDe(v) }
      if (nuevo) await api('/api/dia/horario/bloques', cuerpo)
      else await api(`/api/dia/horario/bloques/${encodeURIComponent(b.id)}`, cuerpo, 'PUT')
      mensaje('Guardado')
      await cargar()
    }, opciones)
  }

  /** El entreno: días y hora de la semana (escribe en el pilar) o correrlo solo un día. */
  function editarEntreno(fecha, b) {
    const e = d.entreno
    const campos = `
      <p class="chico">Cambia los días y la hora de tu pilar «${esc(e.nombre)}» desde hoy.</p>
      <div class="fila"><label class="crece">Hora<input type="time" name="desde" required value="${esc(e.hora || '19:00')}"></label>
      <label class="crece">Empezar hasta<input type="time" name="hasta" required value="${esc(e.horaLimiteInicio || '20:00')}"></label></div>
      <div class="dias-semana" role="group" aria-label="Días">${casillasDias(e.dias)}</div>
      ${fecha ? `<hr style="border-color:var(--borde);width:100%"><label>Solo el ${esc(fechaCorta(fecha))} a las<input type="time" name="correr" value="${esc(b ? b.desde : '')}"></label>` : ''}`
    hoja('Entreno', campos, async (v) => {
      await api(`/api/dia/horario/bloques/entreno`, { nombre: e.nombre, tipo: 'entreno', desde: v.desde, hasta: v.hasta, dias: diasDe(v) }, 'PUT')
      mensaje('Entreno guardado')
      await cargar()
    }, { boton: 'Guardar la semana', extra: fecha ? '<button class="mini" data-accion="correr">Mover solo ese día</button>' : '', alAccion: async (accion, v) => {
      await api('/api/dia/horario/correr-entreno', { fecha, hora: v.correr })
      mensaje(`Entreno del ${fechaCorta(fecha)} a las ${v.correr}`)
      await cargar()
    } })
  }

  $('#nuevo-horario').onclick = () => hoja('Otro horario', '<label>Nombre<input name="nombre" maxlength="60" placeholder="Vacaciones"></label><label class="interruptor"><input type="checkbox" name="copiar" checked> Copiar los bloques del actual</label>', async (v) => {
    await api('/api/dia/horarios', { nombre: v.nombre, copiar: v.copiar })
    await cargar()
  }, { boton: 'Crear y usar' })
  $('#renombrar').onclick = () => hoja('Renombrar', `<label>Nombre<input name="nombre" maxlength="60" required value="${esc(d.activo.nombre)}"></label>`, async (v) => {
    await api(`/api/dia/horarios/${encodeURIComponent(d.activo.id)}`, { nombre: v.nombre }, 'PUT')
    await cargar()
  })
  $('#borrar-horario').onclick = () => hoja(`Borrar «${d.activo.nombre}»`, '<p class="chico">Se borra con sus bloques. Queda activo otro horario.</p>', async () => {
    await api(`/api/dia/horarios/${encodeURIComponent(d.activo.id)}`, undefined, 'DELETE')
    await cargar()
  }, { boton: 'Borrar', peligro: true })

  barra('horario')
  seguro(cargar)()
})()
