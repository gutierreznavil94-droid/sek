// Cierre de fase, igual que la v0.88.27 (CierreFase.tsx): base / fase anterior / esta fase, atributos,
// objetivos con su resultado real y «Cerrar fase» (o «Cerrar ciclo» en la última). Los números salen de
// /api/progreso/fase/:numero; el cierre lo hace el módulo ciclo (POST /api/ciclo/fases/:id/cerrar).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'progreso', companero: 'esquina' })

  const numero = Number(new URLSearchParams(location.search).get('numero')) || 1
  const nada = (v) => v === null || v === undefined
  const celda = (v, unidad = '') => (nada(v) ? '—' : `${v}${unidad}`)
  const par = (x) => (x ? `${x.hechos ?? x.cumplidas}/${x.previstos ?? x.total}` : null)
  const clase = (v) => (nada(v) ? '' : v >= 80 ? 'ok' : v >= 50 ? 'medio' : 'bajo')
  const tarjeta = (titulo, html) => `<section class="tarjeta"><div class="tarjeta-cab"><h2>${titulo}</h2></div>${html}</section>`

  function pintar(r) {
    const f = r.fase
    $('#cargando').hidden = true
    $('#titulo').textContent = r.esUltima ? `Fin del ciclo ${r.ciclo.numero}` : `Cierre de la fase ${f.numero}`
    document.title = `SEK · ${$('#titulo').textContent}`
    $('#sub').textContent = `${f.foco ? f.foco + ' · ' : ''}días ${f.diaInicio}–${f.diaFin} (${fechaLegible(f.desde)} a ${fechaLegible(f.hasta)})${r.enCurso ? ' · todavía en curso' : ''}${!r.empezo ? ' · todavía no empezó' : ''}`
    if (!r.empezo) { $('#cuerpo').hidden = true; return }

    const { base, anterior, esta } = r.numeros
    const fila = (etiqueta, sacar, unidad = '') => `<tr><td>${etiqueta}</td><td class="num texto-3">${celda(sacar(base), unidad)}</td>${anterior ? `<td class="num texto-2">${celda(sacar(anterior), unidad)}</td>` : ''}<td class="num"><b>${celda(sacar(esta), unidad)}</b></td></tr>`
    const resultados = tarjeta('Resultados', `<p class="chico texto-2">Línea de base = primeros 7 días del ciclo. Nada se inventa: si no hay registros, aparece «—».</p>
      <table class="tabla"><thead><tr><th>Indicador</th><th class="num">Base</th>${anterior ? `<th class="num">Fase ${f.numero - 1}</th>` : ''}<th class="num">${r.esUltima ? 'Ciclo' : `Fase ${f.numero}`}</th></tr></thead><tbody>
        ${fila('Cumplimiento', (x) => x.cumplimiento, ' %')}
        ${fila('Entrenamientos hechos / previstos', (x) => par(x.entrenos))}
        ${fila('Noches a hora / registradas', (x) => par(x.noches))}
        ${fila('Juego por día', (x) => x.juegoPorDia, ' min')}
        ${fila('Inicios con 3-2-1', (x) => x.inicios)}
        ${fila('XP ganado', (x) => x.xp)}
      </tbody></table>`)

    const atributos = tarjeta('Atributos: inicio y fin de la fase', r.atributos.length
      ? r.atributos.map((a) => `<div class="fila entre chico"><span>${esc(a.nombre)}</span><span><span class="texto-3">${celda(a.inicio)}</span> → <b class="${clase(a.fin)}">${celda(a.fin)}</b></span></div>`).join('')
      : '<p class="chico texto-3">Todavía no hay valores de atributos.</p>')

    const objetivos = tarjeta(`Objetivos de la fase ${f.numero}`, r.objetivos.length
      ? r.objetivos.map((o) => `<div class="col" style="gap: 4px;"><b class="chico">${esc(o.titulo)}</b>
          <span class="muy-chico texto-3">${esc(o.indicador || '')}${o.lineaBase ? ` · base: ${esc(o.lineaBase)}` : ''}${o.meta ? ` · meta: ${esc(o.meta)}` : ''}</span>
          ${f.cerradaEn ? `<span class="chico">${o.resultado ? `Resultado: ${esc(o.resultado)}` : '<span class="texto-3">Sin resultado anotado.</span>'}</span>` : `<input data-objetivo="${esc(o.id)}" maxlength="500" placeholder="Resultado real" value="${esc(o.resultado || '')}">`}</div>`).join('')
      : '<p class="chico texto-3">No definiste objetivos para esta fase. <a href="/ciclo/objetivos">Definirlos</a>.</p>')

    const sigue = r.fases.find((x) => x.numero === f.numero + 1)
    const puede = r.esUltima || !r.enCurso
    const cierre = f.cerradaEn
      ? tarjeta('Fase cerrada', `<p class="chico texto-2" style="white-space: pre-wrap;">${esc(f.notasCierre || 'Sin notas.')}</p>${r.esUltima ? '<a class="boton primario" href="/ciclo">Empezar nuevo ciclo</a>' : ''}`)
      : tarjeta('Cerrar la fase', `<div class="campo"><label for="notas">Qué aprendí y qué ajusto para la siguiente</label><textarea id="notas" rows="4" maxlength="4000"></textarea></div>
        ${sigue ? `<p class="chico texto-2">Después de cerrar vas a poder ajustar los objetivos de la fase ${sigue.numero} (${esc(sigue.foco)}).</p>` : ''}
        ${r.esUltima ? '<p class="chico texto-2">Al cerrar, podés empezar un ciclo nuevo. Nivel, XP e historial se conservan.</p>' : ''}
        <button type="button" class="boton primario ancho" id="cerrar" ${puede ? '' : 'disabled'}>${!puede ? `Se puede cerrar desde el día ${f.diaFin + 1}` : r.esUltima ? 'Cerrar ciclo' : `Cerrar fase ${f.numero}`}</button>`)

    $('#cuerpo').innerHTML = resultados + atributos + objetivos + cierre +
      `<div class="fila entre"><span class="chico texto-3">Cumplimiento en lo que va de la fase: <b class="${clase(esta.cumplimiento)}">${celda(esta.cumplimiento, ' %')}</b></span></div>`
    $('#cuerpo').hidden = false

    const b = $('#cerrar')
    if (b) b.onclick = seguro(async () => {
      const res = {}
      document.querySelectorAll('[data-objetivo]').forEach((i) => { res[i.dataset.objetivo] = i.value.trim() })
      b.disabled = true
      try {
        await api(`/api/ciclo/fases/${encodeURIComponent(f.id)}/cerrar`, { notas: $('#notas').value, resultados: res })
      } finally { b.disabled = false }
      avisar(r.esUltima ? 'Ciclo cerrado. Cuando quieras, empezá uno nuevo.' : `Fase ${f.numero} cerrada`, { tipo: 'ok' })
      setTimeout(() => { location.href = r.esUltima ? '/ciclo' : '/ciclo/objetivos' }, 900)
    })
  }

  seguro(async () => pintar(await api(`/api/progreso/fase/${numero}`)))()
})()
