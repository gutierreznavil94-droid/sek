// Pantalla Metas con fecha, igual que la v0.88.27 (Metas.tsx): esperan respuesta, próximas, cumplidas y no
// cumplidas. Crear, editar, «Lo logré» / «No llegué», corregir y borrar. Pide a /api/ciclo/metas.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const XP_DEFECTO = 15 // el de calculo.js (XP_META)
  const idUrl = encodeURIComponent
  let hoy = null

  const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const cuando = (m) => (m.dias === 0 ? 'hoy' : m.dias === 1 ? 'mañana' : `faltan ${m.dias} días`)

  function editar(m) {
    const h = hoja(m ? 'Editar meta' : 'Nueva meta', `
      <div class="campo"><label for="m-titulo">Qué querés lograr</label><input id="m-titulo" maxlength="200" value="${esc(m ? m.titulo : '')}" placeholder="Ej.: Terminar el capítulo 1"></div>
      <div class="rejilla-2">
        <div class="campo"><label for="m-fecha">Para cuándo</label><input id="m-fecha" type="date" value="${esc(m ? m.fecha : sumarDias(hoy, 7))}"${m ? '' : ` min="${esc(hoy)}"`}></div>
        <div class="campo"><label for="m-xp">XP si la cumplís</label><input id="m-xp" type="number" inputmode="numeric" min="0" max="500" value="${m && m.xp !== null && m.xp !== undefined ? m.xp : XP_DEFECTO}"></div>
      </div>
      <div class="botonera">${[7, 14, 30].map((n) => `<button type="button" class="boton chico" data-dias="${n}">en ${n} días</button>`).join('')}</div>
      <div class="campo"><label for="m-nota">Nota (opcional)</label><input id="m-nota" maxlength="500" value="${esc(m && m.nota ? m.nota : '')}"></div>
      ${m && m.estado && m.estado !== 'pendiente' ? '<button type="button" class="boton ancho" data-reabrir>Volver a pendiente</button>' : ''}
      <button type="button" class="boton primario ancho" data-guardar>${m ? 'Guardar' : 'Crear meta'}</button>
      ${m ? '<button type="button" class="boton peligro ancho" data-borrar>Borrar</button>' : ''}`)
    const q = (s) => h.el.querySelector(s)
    const titulo = q('#m-titulo'), fecha = q('#m-fecha'), g = q('[data-guardar]')
    const revisar = () => { g.disabled = !titulo.value.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.value) }
    titulo.addEventListener('input', revisar); fecha.addEventListener('input', revisar); revisar()
    h.el.querySelectorAll('[data-dias]').forEach((b) => { b.onclick = () => { fecha.value = sumarDias(hoy, Number(b.dataset.dias)); revisar() } })
    g.onclick = seguro(async () => {
      const cuerpo = { titulo: titulo.value.trim(), fecha: fecha.value, xp: Math.max(0, Math.min(500, Number(q('#m-xp').value) || 0)), nota: q('#m-nota').value.trim() }
      pintar(m ? await api(`/api/ciclo/metas/${idUrl(m.id)}`, cuerpo, 'PUT') : await api('/api/ciclo/metas', cuerpo))
      h.cerrar()
      avisar(m ? 'Meta guardada' : `Meta creada para el ${fechaLegible(cuerpo.fecha)}`, { tipo: 'ok' })
    })
    const re = q('[data-reabrir]')
    if (re) re.onclick = seguro(async () => { pintar(await api(`/api/ciclo/metas/${idUrl(m.id)}/reabrir`, {})); h.cerrar() })
    const bo = q('[data-borrar]')
    if (bo) bo.onclick = () => { h.cerrar(); confirmar('¿Borrar meta?', m.titulo, 'Borrar', async () => { pintar(await api(`/api/ciclo/metas/${idUrl(m.id)}`, undefined, 'DELETE')) }) }
  }

  async function resolver(m, lograda, motivo) {
    const r = await api(`/api/ciclo/metas/${idUrl(m.id)}/resolver`, motivo ? { lograda, motivo } : { lograda })
    pintar(r)
    if (lograda && !motivo) { SEK.v88.animar({ tipo: 'ejecucion', pilar: 'meta', estilo: 'vertical' }); SEK.v88.nivel(r.resultado.nuevoNivel) }
    if (motivo) avisar('Corregido (queda en el historial)')
    else if (lograda) avisar(r.resultado.xp > 0 ? `Meta cumplida: +${r.resultado.xp} XP` : r.resultado.conTope ? 'Meta cumplida (ya sumaste XP de 2 metas hoy)' : 'Meta cumplida', { tipo: 'ok' })
  }

  function fila(m, clase) {
    const extra = clase === 'pendiente' ? ` · ${cuando(m)}` : clase === 'vencida' ? ' · esperando respuesta' : clase === 'cumplida' ? ` · +${m.xp ?? XP_DEFECTO} XP` : ' · no cumplida'
    const botones = clase === 'vencida'
      ? '<div class="col" style="gap: 4px;"><button type="button" class="boton chico ok" data-si>Lo logré</button><button type="button" class="boton chico peligro" data-no>No llegué</button></div>'
      : clase === 'cumplida' ? '<button type="button" class="boton chico suave" data-corregir>No la logré</button>'
        : clase === 'no_cumplida' ? '<button type="button" class="boton chico suave" data-corregir>Sí la logré</button>' : ''
    return `<div class="meta-fila ${clase}" data-id="${esc(m.id)}"><span class="punto-estado" aria-hidden="true"></span>
      <div class="crece col" style="gap: 0;" data-abrir role="button" tabindex="0"><span style="font-weight: 600;">${esc(m.titulo)}</span><span class="chico texto-3">${esc(fechaLegible(m.fecha))}${extra}</span></div>${botones}</div>`
  }

  function pintar(r) {
    const grupos = [['vencidas', 'vencida', 'Esperan tu respuesta', ''], ['pendientes', 'pendiente', 'Próximas', ''], ['cumplidas', 'cumplida', `Cumplidas · ${r.cumplidas.length}`, 'ok'], ['noCumplidas', 'no_cumplida', `No cumplidas · ${r.noCumplidas.length}`, 'bajo']]
    const total = grupos.reduce((n, [g]) => n + r[g].length, 0)
    const caja = $('#lista')
    caja.innerHTML = total ? grupos.filter(([g]) => r[g].length).map(([g, clase, titulo, tono]) => `<section class="col" style="gap: 4px;"><span class="seccion-titulo ${tono}">${esc(titulo)}</span><div>${r[g].map((m) => fila(m, clase)).join('')}</div></section>`).join('')
      : '<p class="vacio">Todavía no hay metas. Ejemplo: «Terminar el capítulo 1 del manga» para el 30 de noviembre.</p>'
    const todas = grupos.flatMap(([g, clase]) => r[g].map((m) => [m, clase]))
    caja.querySelectorAll('.meta-fila').forEach((el) => {
      const [m, clase] = todas.find(([x]) => x.id === el.dataset.id)
      const abrir = el.querySelector('[data-abrir]')
      abrir.onclick = () => editar(m)
      abrir.onkeydown = (e) => { if (e.key === 'Enter') editar(m) }
      const si = el.querySelector('[data-si]'), no = el.querySelector('[data-no]'), co = el.querySelector('[data-corregir]')
      if (si) si.onclick = seguro(() => resolver(m, true))
      if (no) no.onclick = seguro(() => resolver(m, false))
      if (co) co.onclick = seguro(() => resolver(m, clase === 'no_cumplida', 'Corrección desde Metas'))
    })
  }

  $('#nueva').onclick = () => editar(null)
  seguro(async () => {
    const r = await api('/api/ciclo/metas')
    hoy = r.hoy || new Date().toLocaleDateString('en-CA')
    pintar(r)
  })()
})()
