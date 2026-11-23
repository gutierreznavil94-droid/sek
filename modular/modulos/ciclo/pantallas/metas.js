// Pantalla Metas con fecha: crear, «Lo logré» / «No llegué», corregir y borrar. Pide a /api/ciclo/metas.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, fecha, hoja } = CICLO

  const cuando = (m) => (m.dias === 0 ? 'hoy' : m.dias === 1 ? 'mañana' : `faltan ${m.dias} días`)

  function editar(m) {
    hoja(m ? 'Editar meta' : 'Nueva meta', `
      <label>Qué querés lograr <input name="titulo" required maxlength="200" value="${esc(m?.titulo)}" placeholder="Ej.: terminar el capítulo 1 del manga"></label>
      <div class="rejilla-2">
        <label>Para cuándo <input type="date" name="fecha" required value="${m ? m.fecha : ''}"></label>
        <label>XP si la cumplís <input type="number" name="xp" min="0" max="1000" inputmode="numeric" value="${m?.xp ?? 15}"></label>
      </div>
      <label>Nota (opcional) <input name="nota" maxlength="500" value="${esc(m?.nota)}"></label>
      ${m ? '<button type="button" class="peligro" data-borrar>Borrar meta</button>' : ''}`,
    async (v) => {
      const cuerpo = { titulo: v.titulo, fecha: v.fecha, xp: Number(v.xp || 0), nota: v.nota }
      pintar(m ? await api(`/api/ciclo/metas/${m.id}`, cuerpo, 'PUT') : await api('/api/ciclo/metas', cuerpo))
      mensaje('Meta guardada')
    })
    const b = document.querySelector('dialog.hoja [data-borrar]')
    if (b) b.onclick = seguro(async () => {
      if (!confirm('¿Borrar esta meta? Si dio XP, se anula.')) return
      pintar(await api(`/api/ciclo/metas/${m.id}`, undefined, 'DELETE'))
      document.querySelector('dialog.hoja').close()
    })
  }

  async function resolver(m, lograda, motivo) {
    const r = await api(`/api/ciclo/metas/${m.id}/resolver`, { lograda, motivo })
    pintar(r)
    if (!lograda) mensaje('Anotado. Queda en el historial.')
    else mensaje(r.resultado.xp > 0 ? `Meta cumplida: +${r.resultado.xp} XP` : r.resultado.conTope ? 'Meta cumplida (ya sumaste XP de 2 metas hoy)' : 'Meta cumplida')
  }

  function fila(m, clase) {
    const li = document.createElement('li')
    li.className = `meta ${clase}`
    const extra = clase === 'pendiente' ? cuando(m) : clase === 'vencida' ? 'esperando respuesta' : clase === 'cumplida' ? `cumplida${m.cumplidaEl && m.cumplidaEl !== m.fecha ? ' el ' + fecha(m.cumplidaEl) : ''}` : 'no cumplida'
    li.innerHTML = `<span class="punto" aria-hidden="true"></span>
      <div class="crece"><span class="que">${esc(m.titulo)}</span><span class="detalle">${fecha(m.fecha)} · ${extra}${m.xp ? ` · ${m.xp} XP` : ''}</span></div>
      <div class="botones"></div>`
    const bs = li.querySelector('.botones')
    const boton = (t, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = `mini ${cls}`; b.textContent = t; b.onclick = seguro(fn); bs.appendChild(b) }
    if (clase === 'vencida' || clase === 'pendiente') {
      boton('Lo logré', 'principal', () => resolver(m, true))
      if (clase === 'vencida') boton('No llegué', 'peligro', () => resolver(m, false))
    }
    if (clase === 'cumplida') boton('No la logré', '', () => resolver(m, false, 'Corrección desde Metas'))
    if (clase === 'no_cumplida') boton('Sí la logré', '', () => resolver(m, true, 'Corrección desde Metas'))
    if (clase === 'cumplida' || clase === 'no_cumplida') boton('Pendiente', '', async () => { pintar(await api(`/api/ciclo/metas/${m.id}/reabrir`, {})) })
    li.querySelector('.crece').onclick = () => editar(m)
    return li
  }

  function pintar(r) {
    const grupos = { vencidas: 'vencida', pendientes: 'pendiente', cumplidas: 'cumplida', noCumplidas: 'no_cumplida' }
    let total = 0
    for (const [g, clase] of Object.entries(grupos)) {
      const ul = $(`#${g}`)
      ul.innerHTML = ''
      for (const m of r[g]) ul.appendChild(fila(m, clase))
      $(`#sec-${g}`).hidden = !r[g].length
      total += r[g].length
    }
    $('#vacio').hidden = total > 0
  }

  $('#nueva').onclick = () => editar(null)
  barra('ciclo')
  seguro(async () => pintar(await api('/api/ciclo/metas')))()
})()
