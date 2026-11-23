// Cierre de fase con números: «Base / fase anterior / esta fase», atributos y objetivos.
// Pide a /api/progreso/fase/:numero. Solo muestra: cerrar la fase se hace en Ciclo.
(function () {
  'use strict'
  const { api, $, seguro, barra } = SEK
  const { esc, diaMes } = SEK.grafico

  const nada = (v) => v === null || v === undefined
  const celda = (v, unidad = '') => (nada(v) ? '—' : `${v}${unidad}`)
  const par = (x) => (x ? `${x.hechos ?? x.cumplidas}/${x.previstos ?? x.total}` : null)

  function pintar(r) {
    $('#cargando').hidden = true
    const f = r.fase
    $('#titulo').textContent = r.esUltima ? `Fin del ciclo ${r.ciclo.numero}` : `Cierre de la fase ${f.numero}`
    document.title = `SEK · ${$('#titulo').textContent}`
    $('#sub').textContent = `${f.foco ? f.foco + ' · ' : ''}días ${f.diaInicio}–${f.diaFin} (${diaMes(f.desde)} a ${diaMes(f.hasta)})${r.enCurso ? ' · todavía en curso' : ''}${f.cerradaEn ? ' · cerrada' : ''}`
    if (!r.empezo) { $('#sub').textContent += ' · todavía no empezó'; return }

    const { base, anterior, esta } = r.numeros
    const col = r.esUltima ? 'Ciclo' : `Fase ${f.numero}`
    const fila = (etiqueta, sacar, unidad = '') => `<tr><td>${etiqueta}</td><td class="num apagado">${celda(sacar(base), unidad)}</td>${anterior ? `<td class="num chico">${celda(sacar(anterior), unidad)}</td>` : ''}<td class="num"><b>${celda(sacar(esta), unidad)}</b></td></tr>`
    $('#tabla').innerHTML = `<thead><tr><th>Indicador</th><th class="num">Base</th>${anterior ? `<th class="num">Fase ${f.numero - 1}</th>` : ''}<th class="num">${col}</th></tr></thead><tbody>
      ${fila('Cumplimiento', (x) => x.cumplimiento, ' %')}
      ${fila('Entrenamientos hechos / previstos', (x) => par(x.entrenos))}
      ${fila('Noches a hora / registradas', (x) => par(x.noches))}
      ${fila('Juego por día', (x) => x.juegoPorDia, ' min')}
      ${fila('XP ganada', (x) => x.xp)}
      ${fila('Inicios con 3-2-1', (x) => x.inicios)}
    </tbody>`
    $('#resultados').hidden = false

    if (r.atributos.length) {
      $('#atributos').hidden = false
      $('#a-lista').innerHTML = r.atributos.map((a) => `<div class="fila entre chico"><span>${esc(a.nombre)}</span><span><span class="apagado">${celda(a.inicio)}</span> → <b>${celda(a.fin)}</b></span></div>`).join('')
    }
    if (r.objetivos.length) {
      $('#objetivos').hidden = false
      $('#o-lista').innerHTML = r.objetivos.map((o) => `<div class="chico"><b>${esc(o.titulo)}</b><br><span class="apagado">${esc(o.indicador || '')}${o.lineaBase ? ` · base: ${esc(o.lineaBase)}` : ''}${o.meta ? ` · meta: ${esc(o.meta)}` : ''}</span>${o.resultado ? `<br>Resultado: ${esc(o.resultado)}` : ''}</div>`).join('')
    }
    if (f.cerradaEn) $('#ir-ciclo').hidden = true
  }

  const numero = Number(new URLSearchParams(location.search).get('numero')) || 1
  barra('mas')
  seguro(async () => pintar(await api(`/api/progreso/fase/${numero}`)))()
})()
