// Pantalla de inicio de Entreno: lo de hoy, series rápidas, mis rutinas, planes y últimos entrenos. Pide todo a /api/entreno.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const diasTexto = (d) => (d.length ? [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => DIAS[x]).join(' · ') : 'Sin días')

  async function empezar(rutinaId) {
    await api('/api/entreno/empezar', { rutinaId })
    location.href = '/entreno/sesion'
  }

  function pintar(d) {
    const h = d.hoy
    $('#hoy-fecha').textContent = h.fecha
    const botones = $('#hoy-botones')
    botones.innerHTML = ''
    if (h.enCurso) {
      $('#hoy-texto').textContent = 'Tenés un entreno sin terminar.'
      botones.innerHTML = '<a class="boton principal" href="/entreno/sesion">Seguir el entreno</a>'
    } else if (h.hecho) {
      $('#hoy-texto').innerHTML = '<span class="ok">Entreno de hoy hecho.</span>'
    } else if (h.rutina) {
      $('#hoy-texto').textContent = `Toca: ${h.rutina.nombre} (unos ${h.rutina.minutos} min).`
      const b = document.createElement('button')
      b.className = 'principal'
      b.textContent = 'Empezar entreno'
      b.onclick = seguro(() => empezar(h.rutina.id))
      botones.appendChild(b)
    } else {
      $('#hoy-texto').textContent = d.rutinas.length ? 'Hoy no toca entrenar. Si querés, empezá cualquier rutina de abajo.' : 'Todavía no tenés rutinas: elegí cómo empezar.'
    }

    $('#series').innerHTML = h.series.length ? '' : '<p class="chico apagado">Sin series rápidas.</p>'
    for (const s of h.series) {
      const div = document.createElement('div')
      div.className = 'item'
      const pct = Math.min(100, (100 * s.hoy) / Math.max(1, s.cuota))
      div.innerHTML = `<div class="texto" style="flex:1"><b>${esc(s.nombre)}</b>
        <span class="chico ${s.extraLogrado ? 'record' : s.metaLograda ? 'ok' : ''}">${s.hoy} de ${s.cuota}${s.extraLogrado ? ' · extra ✓' : s.metaLograda ? ' · cuota ✓' : ''}</span>
        <div class="barra-progreso"><span style="width:${pct}%"></span></div></div>`
      const b = document.createElement('button')
      b.className = 'principal mini'
      b.textContent = `+${s.porToque}`
      b.setAttribute('aria-label', `Sumar ${s.porToque} ${s.nombre}`)
      b.onclick = seguro(async () => {
        const r = await api(`/api/series/${encodeURIComponent(s.id)}/toque`, {})
        if (r.toque.xp && r.toque.metaLograda) { mensaje(r.toque.extraLogrado ? '¡Extra!' : '¡Cuota del día!'); SEK.evento('logro', { modulo: 'entreno' }) }
        cargar()
      })
      div.appendChild(b)
      $('#series').appendChild(div)
    }

    $('#rutinas').innerHTML = d.rutinas.length ? '' : '<p class="chico apagado">Sin rutinas todavía.</p>'
    for (const r of d.rutinas) {
      const div = document.createElement('div')
      div.className = 'item' + (r.activa ? '' : ' pausada')
      div.innerHTML = `<div class="texto"><b>${esc(r.nombre)}</b><span class="chico">${diasTexto(r.dias)} · ${r.bloques.length} bloques${r.activa ? '' : ' · pausada'}</span></div>
        <div class="botones"><a class="boton mini" href="/entreno/rutina?id=${encodeURIComponent(r.id)}">Editar</a></div>`
      if (!h.enCurso) {
        const b = document.createElement('button')
        b.className = 'mini'
        b.textContent = 'Empezar'
        b.onclick = seguro(() => empezar(r.id))
        div.querySelector('.botones').appendChild(b)
      }
      $('#rutinas').appendChild(div)
    }

    $('#elegir').open = !d.rutinas.length
    $('#planes').innerHTML = ''
    const opciones = [
      ...d.planes.map((p) => ({ titulo: p.nombre, texto: p.descripcion, eleccion: { modo: 'plan', planId: p.id } })),
      { titulo: 'De a poco', texto: 'Una rutina cortita de cuerpo completo. ' + d.ideas[0], eleccion: { modo: 'poco' } },
      { titulo: 'Desde cero', texto: 'Sin rutinas: las armás vos con «+ Rutina».', eleccion: { modo: 'cero' } },
    ]
    for (const o of opciones) {
      const div = document.createElement('div')
      div.className = 'item'
      div.innerHTML = `<div class="texto"><b>${esc(o.titulo)}</b><span class="chico">${esc(o.texto)}</span></div>`
      const b = document.createElement('button')
      b.className = 'mini'
      b.textContent = 'Elegir'
      b.onclick = seguro(async () => {
        const r = await api('/api/entreno/eleccion', { eleccion: o.eleccion, reemplazar: $('#reemplazar').checked })
        mensaje(`Listo: ${r.cargadas} rutina${r.cargadas === 1 ? '' : 's'} nueva${r.cargadas === 1 ? '' : 's'}${r.borradas ? `, ${r.borradas} borrada${r.borradas === 1 ? '' : 's'}` : ''}.`)
        cargar()
      })
      div.appendChild(b)
      $('#planes').appendChild(div)
    }

    $('#historial').innerHTML = d.historial.length
      ? d.historial.map((e) => `<div class="item"><div class="texto"><b>${esc(e.rutina)}</b><span class="chico">${e.fecha} · ${e.minutos} min · ${e.series} series${e.xpExtra ? ` · <span class="record">+${e.xpExtra} XP</span>` : ''}</span></div></div>`).join('')
      : '<p class="chico apagado">Todavía no terminaste ningún entreno.</p>'
  }

  const cargar = seguro(async () => pintar(await api('/api/entreno')))
  $('#nueva-rutina').onclick = seguro(async () => {
    const r = await api('/api/entreno/rutinas', {})
    location.href = '/entreno/rutina?id=' + encodeURIComponent(r.id)
  })
  barra('entreno')
  cargar()
})()
