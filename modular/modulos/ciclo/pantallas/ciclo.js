// Pantalla Ciclo: dónde estoy, fases con objetivos, cierre de fase, empezar o mover el ciclo.
// Pide todo a /api/ciclo (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, fecha, hoja } = CICLO
  let datos = null

  const opcionesAtributos = (sel) => datos.atributos.map((a) => `<option value="${esc(a.id)}"${a.id === sel ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')

  function editarObjetivo(fase, o) {
    hoja(o ? 'Editar objetivo' : `Nuevo objetivo · fase ${fase.numero}`, `
      <label>Objetivo <input name="titulo" required minlength="3" maxlength="200" value="${esc(o?.titulo)}" placeholder="Ej.: entrenar 3 veces por semana"></label>
      <label>Atributo <select name="atributoId">${opcionesAtributos(o?.atributoId)}</select></label>
      <label>Indicador medible <input name="indicador" required minlength="3" maxlength="300" value="${esc(o?.indicador)}" placeholder="Ej.: entrenamientos hechos / previstos"></label>
      <div class="rejilla-2">
        <label>Línea de base <input name="lineaBase" maxlength="100" value="${esc(o?.lineaBase)}" placeholder="Ej.: 1/3"></label>
        <label>Meta <input name="meta" maxlength="100" value="${esc(o?.meta)}" placeholder="Ej.: 3/3"></label>
      </div>`, async (v) => {
      pintar(o ? await api(`/api/ciclo/objetivos/${o.id}`, v, 'PUT') : await api('/api/ciclo/objetivos', { ...v, faseNumero: fase.numero }))
      mensaje('Objetivo guardado')
    })
  }

  function editarFase(f) {
    hoja(`Fase ${f.numero}`, `
      <label>Foco <input name="foco" required minlength="2" maxlength="200" value="${esc(f.foco)}"></label>
      <label>Qué se mide <textarea name="queSeMide" rows="3" maxlength="2000">${esc(f.queSeMide)}</textarea></label>`,
    async (v) => { pintar(await api(`/api/ciclo/fases/${f.id}`, v, 'PUT')) })
  }

  function cerrarFase(f, esUltima) {
    const objs = f.objetivos.map((o) => `<label>${esc(o.titulo)} <span class="ayuda">${esc(o.indicador)}${o.lineaBase ? ' · base ' + esc(o.lineaBase) : ''}${o.meta ? ' · meta ' + esc(o.meta) : ''}</span>
      <input name="r:${esc(o.id)}" maxlength="500" value="${esc(o.resultado)}" placeholder="Resultado real"></label>`).join('')
    hoja(esUltima ? 'Cerrar el ciclo' : `Cerrar la fase ${f.numero}`, `
      ${objs || '<p class="chico apagado">No definiste objetivos para esta fase.</p>'}
      <label>Qué aprendí y qué ajusto <textarea name="notas" rows="4" maxlength="4000"></textarea></label>
      ${esUltima ? '<p class="ayuda">Después podés empezar un ciclo nuevo. Nivel, XP e historial se conservan.</p>' : ''}`,
    async (v) => {
      const resultados = {}
      for (const [k, x] of Object.entries(v)) if (k.startsWith('r:')) resultados[k.slice(2)] = x
      pintar(await api(`/api/ciclo/fases/${f.id}/cerrar`, { notas: v.notas, resultados }))
      mensaje(esUltima ? 'Ciclo cerrado. Cuando quieras, empezá uno nuevo.' : `Fase ${f.numero} cerrada`)
    }, { boton: esUltima ? 'Cerrar ciclo' : 'Cerrar fase' })
  }

  function tarjetaFase(f, i) {
    const esUltima = i === datos.fases.length - 1
    const nombreAtr = (id) => (datos.atributos.find((a) => a.id === id) || {}).nombre || 'Sin atributo'
    const s = document.createElement('section')
    s.className = 'tarjeta fase' + (f.actual ? ' actual' : '')
    s.innerHTML = `
      <div class="fila entre">
        <span class="titulo-fase">Fase ${f.numero} · días ${f.diaInicio}–${f.diaFin}</span>
        <button class="mini" type="button" data-fase>✎</button>
      </div>
      <div class="chico"><b>${esc(f.foco)}</b>${f.queSeMide ? `<div>${esc(f.queSeMide)}</div>` : ''}<div class="apagado">${fecha(f.desde)} a ${fecha(f.hasta)}</div></div>
      ${f.cerradaEn ? `<p class="cerrada">✓ Cerrada${f.notasCierre ? ': ' + esc(f.notasCierre) : ''}</p>` : ''}
      <ul class="lista">${f.objetivos.map((o) => `
        <li><div class="crece"><b class="chico">${esc(o.titulo)}</b>
          <span class="detalle">${esc(nombreAtr(o.atributoId))} · ${esc(o.indicador)}${o.lineaBase ? ' · base ' + esc(o.lineaBase) : ''}${o.meta ? ' · meta ' + esc(o.meta) : ''}${o.resultado ? ' · resultado ' + esc(o.resultado) : ''}</span></div>
          <button class="mini" type="button" data-editar="${esc(o.id)}" aria-label="Editar">✎</button>
          <button class="mini" type="button" data-quitar="${esc(o.id)}" aria-label="Quitar">✕</button></li>`).join('')}
      </ul>
      <div class="botones">
        <button class="mini" type="button" data-nuevo>+ Objetivo</button>
        ${f.sePuedeCerrar ? `<button class="mini principal" type="button" data-cerrar>${esUltima ? 'Cerrar ciclo' : 'Cerrar fase'}</button>` : ''}
      </div>`
    s.querySelector('[data-fase]').onclick = () => editarFase(f)
    s.querySelector('[data-nuevo]').onclick = () => editarObjetivo(f, null)
    const c = s.querySelector('[data-cerrar]')
    if (c) c.onclick = () => cerrarFase(f, esUltima)
    s.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editarObjetivo(f, f.objetivos.find((o) => o.id === b.dataset.editar)) })
    s.querySelectorAll('[data-quitar]').forEach((b) => {
      b.onclick = seguro(async () => {
        if (!confirm('¿Quitar este objetivo? Se archiva y queda en el historial.')) return
        pintar(await api(`/api/ciclo/objetivos/${b.dataset.quitar}`, undefined, 'DELETE'))
      })
    })
    return s
  }

  function pintar(r) {
    datos = r
    const hay = !!r.ciclo
    $('#sin-ciclo').hidden = hay
    $('#donde').hidden = !hay
    $('#ajustes-ciclo').hidden = !hay
    $('#anteriores').textContent = r.ciclosAnteriores.length ? `Ciclos anteriores: ${r.ciclosAnteriores.map((c) => `${c.numero} (desde el ${fecha(c.inicio)})`).join(', ')}` : ''
    $('#metas-desc').innerHTML = r.metasVencidas ? `<span class="cuenta">${r.metasVencidas} esperan tu respuesta</span>` : 'Qué querés lograr y para cuándo'
    const fases = $('#fases')
    fases.innerHTML = ''
    if (!hay) { $('#form-iniciar').inicio.value = r.hoy; return }
    const c = r.ciclo
    $('#dia').innerHTML = r.diaCero ? 'Día 0 <small>calentamiento</small>'
      : r.noEmpezado ? `Empieza <small>el ${fecha(c.inicio)}</small>`
        : r.terminado ? `Terminado <small>${c.duracionDias} días</small>`
          : `Día ${r.dia} <small>de ${c.duracionDias}</small>`
    $('#fase-foco').textContent = r.fase ? `Fase ${r.fase.numero} · ${r.fase.foco}` : ''
    $('#barra').style.width = Math.round(r.progreso * 100) + '%'
    $('#desde-hasta').textContent = `${fecha(c.inicio)} → ${fecha(r.fechaFin)}`
    $('#numero').textContent = `Ciclo ${c.numero}`
    $('#ajuste').hidden = !r.ajuste
    $('#ajuste').textContent = r.ajuste ? `Ajuste de ayer: ${r.ajuste}` : ''
    r.fases.forEach((f, i) => fases.appendChild(tarjetaFase(f, i)))
  }

  $('#form-iniciar').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    pintar(await api('/api/ciclo/iniciar', { inicio: f.inicio.value, duracionDias: Number(f.duracionDias.value), diaCero: f.diaCero.checked }))
    mensaje(`Ciclo iniciado. Día 1: ${fecha(f.inicio.value)}`)
  })

  $('#cambiar-inicio').onclick = () => hoja('Cambiar el Día 1', `
    <label>Nuevo Día 1 <input type="date" name="inicio" required value="${datos.ciclo.inicio}"></label>
    <p class="ayuda">Las metas automáticas se mueven; las tuyas quedan. El XP no se toca.</p>`,
  async (v) => { pintar(await api('/api/ciclo/inicio', v)); mensaje(`Día 1: ${fecha(v.inicio)}`) })

  $('#nuevo-ciclo').onclick = () => hoja('Empezar un ciclo nuevo', `
    <label>Día 1 <input type="date" name="inicio" required value="${datos.hoy}"></label>
    <label>Duración <select name="duracionDias"><option value="90">90 días</option><option value="60">60 días</option><option value="120">120 días</option><option value="180">180 días</option><option value="365">365 días</option></select></label>
    <label class="interruptor"><input type="checkbox" name="diaCero"> <span>Día 0 de calentamiento</span></label>
    <p class="ayuda">El ciclo ${datos.ciclo.numero} se cierra. Nivel, XP e historial quedan.</p>`,
  async (v) => {
    pintar(await api('/api/ciclo/iniciar', { inicio: v.inicio, duracionDias: Number(v.duracionDias), diaCero: v.diaCero }))
    mensaje('Ciclo nuevo en marcha')
  }, { boton: 'Empezar ciclo nuevo' })

  barra('ciclo')
  seguro(async () => pintar(await api('/api/ciclo')))()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) seguro(async () => pintar(await api('/api/ciclo')))() })
})()
