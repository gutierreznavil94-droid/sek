// Series rápidas: tocar para sumar, deshacer, ver los últimos 14 días, responder la propuesta de subir y editar.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const datosForm = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, k === 'nombre' ? v : Number(v)]))

  function pintar(r) {
    const cont = $('#series')
    cont.innerHTML = r.series.length ? '' : '<p class="chico apagado">No tenés series rápidas activas.</p>'
    for (const x of r.series) {
      const c = x.contador
      const max = Math.max(1, ...x.porDia.map((d) => Math.max(d.total, d.cuota)))
      const div = document.createElement('section')
      div.className = 'tarjeta'
      div.innerHTML = `
        <div class="fila entre"><h2>${esc(c.nombre)}</h2><span class="chico">${x.repsHoy} × ${x.series} series</span></div>
        <div class="fila entre"><span class="grande">${x.hoy}</span><span class="chico ${x.extraLogradoHoy ? 'record' : x.metaLogradaHoy ? 'ok' : ''}">cuota ${x.cuotaHoy}${x.metaLogradaHoy ? ' ✓' : ''} · extra ${x.extraHoy}${x.extraLogradoHoy ? ' ✓' : ''}</span></div>
        <div class="barra-progreso"><span style="width:${Math.min(100, (100 * x.hoy) / Math.max(1, x.cuotaHoy))}%"></span></div>
        <div class="botones">
          <button class="principal" data-toque>+${c.cantidadPorToque}</button>
          <input type="number" inputmode="numeric" min="1" placeholder="Otra cantidad" data-cantidad style="width:150px" aria-label="Otra cantidad">
          <button class="mini" data-otra>Sumar</button>
          <button class="mini" data-deshacer ${x.toquesHoy ? '' : 'disabled'}>Deshacer último</button>
        </div>
        ${x.propuesta ? `<div class="bloque pregunta"><p>Cumpliste la cuota 3 días seguidos. ¿Subís de ${x.propuesta.de} a <b>${x.propuesta.a}</b> por serie (cuota ${x.propuesta.cuota})?</p><div class="botones"><button class="mini principal" data-si>Sí, subir</button><button class="mini" data-no>Todavía no</button></div></div>` : ''}
        <div><span class="chico">Últimos 14 días</span><div class="barritas">${x.porDia.map((d, i) => `<span class="${d.total >= d.cuota ? 'ok' : ''}${i === 13 ? ' hoy' : ''}" style="height:${Math.max(3, (100 * d.total) / max)}%" title="${d.fecha}: ${d.total} de ${d.cuota}"></span>`).join('')}</div></div>
        <p class="chico">Semana: ${x.semana} · Días con cuota: ${x.diasConMeta} · con extra: ${x.diasConExtra}${x.record ? ` · Récord: ${x.record.total} (${x.record.fecha})` : ''}</p>
        <details><summary>Editar</summary>
          <form class="campos" data-editar>
            <label class="ancho">Nombre <input name="nombre" value="${esc(c.nombre)}" required></label>
            <label>Reps por serie <input name="cantidadPorToque" type="number" inputmode="numeric" min="1" value="${c.cantidadPorToque}"></label>
            <label>Series por día <input name="seriesPorDia" type="number" inputmode="numeric" min="1" value="${x.series}"></label>
            <label>XP de la cuota <input name="xpMetaDiaria" type="number" inputmode="numeric" min="0" value="${c.xpMetaDiaria}"></label>
            <label>XP del extra <input name="xpExtra" type="number" inputmode="numeric" min="0" value="${c.xpExtra ?? 5}"></label>
            <p class="ayuda ancho">La cuota es reps × series. Los cambios valen desde hoy; los días pasados conservan la cuota que tenían.</p>
            <button class="principal" type="submit">Guardar</button>
            <button type="button" class="peligro" data-pausar>Pausar</button>
          </form>
        </details>`
      const id = encodeURIComponent(c.id)
      const en = (sel, fn) => { const el = div.querySelector(sel); if (el) el.onclick = seguro(fn) }
      const toque = async (cantidad) => {
        const t = await api(`/api/series/${id}/toque`, cantidad ? { cantidad } : {})
        if (t.toque.xp && t.toque.metaLograda) { mensaje(t.toque.extraLogrado ? '¡Extra del día!' : '¡Cuota del día!'); SEK.evento('logro', { modulo: 'entreno' }) }
        pintar(t)
      }
      en('[data-toque]', () => toque())
      en('[data-otra]', () => { const n = Number(div.querySelector('[data-cantidad]').value); if (!(n > 0)) throw new Error('Poné una cantidad'); return toque(n) })
      en('[data-deshacer]', async () => pintar(await api(`/api/series/${id}/deshacer`, {})))
      en('[data-si]', async () => { pintar(await api(`/api/series/${id}/propuesta`, { acepta: true })); mensaje('¡Subiste las reps por serie!') })
      en('[data-no]', async () => pintar(await api(`/api/series/${id}/propuesta`, { acepta: false })))
      en('[data-pausar]', async () => { await api('/api/series', { id: c.id, activo: false }); mensaje('Serie pausada.'); cargar() })
      div.querySelector('[data-editar]').onsubmit = seguro(async (e) => {
        e.preventDefault()
        const d = datosForm(e.target)
        await api('/api/series', { id: c.id, ...d, metaDiaria: undefined })
        mensaje('Guardado.')
        cargar()
      })
      cont.appendChild(div)
    }
    const pausadas = (r.todas || []).filter((c) => !c.activo)
    if (pausadas.length) {
      const div = document.createElement('section')
      div.className = 'tarjeta'
      div.innerHTML = '<h3>Pausadas</h3>' + pausadas.map((c) => `<div class="item"><div class="texto"><b>${esc(c.nombre)}</b></div><button class="mini" data-activar="${esc(c.id)}">Activar</button></div>`).join('')
      div.onclick = seguro(async (e) => {
        const b = e.target.closest('[data-activar]')
        if (!b) return
        await api('/api/series', { id: b.dataset.activar, activo: true })
        cargar()
      })
      cont.appendChild(div)
    }
  }

  const cargar = seguro(async () => pintar(await api('/api/series')))
  $('#form-nueva').onsubmit = seguro(async (e) => {
    e.preventDefault()
    await api('/api/series', datosForm(e.target))
    e.target.reset()
    $('#nueva').open = false
    mensaje('Serie rápida creada.')
    cargar()
  })
  barra('entreno')
  cargar()
})()
