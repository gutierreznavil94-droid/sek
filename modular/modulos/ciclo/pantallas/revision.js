// Pantalla Revisión: diaria en 3 pasos (qué cumplí, obstáculo, ajuste) o semanal (?tipo=semanal).
// ?fecha=AAAA-MM-DD para revisar otro día. Pide a /api/ciclo/revision.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, fecha } = CICLO
  const q = new URLSearchParams(location.search)
  const tipo = q.get('tipo') === 'semanal' ? 'semanal' : 'diaria'
  const fechaPedida = /^\d{4}-\d{2}-\d{2}$/.test(q.get('fecha') || '') ? q.get('fecha') : null
  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
  let d = null
  let obstaculo = ''

  function irA(n) {
    document.querySelectorAll('#diaria [data-paso]').forEach((s) => { s.hidden = s.dataset.paso !== String(n) })
    document.querySelectorAll('.pasos i').forEach((i, k) => i.classList.toggle('hecho', k < n))
    $('#paso-texto').textContent = `paso ${n} de 3`
    if (n === 3) $('#ajuste').focus()
  }

  function pintarDiaria() {
    const esHoy = d.periodo === d.hoy
    $('#titulo').textContent = `省 Revisión ${esHoy ? 'de hoy' : 'del ' + fecha(d.periodo)}`
    const ul = $('#hechos')
    ul.innerHTML = d.hechos.length
      ? d.hechos.map((h) => `<li><div class="crece"><span class="chico">${esc(h.que)}</span></div><span class="ok">+${h.xp}</span></li>`).join('') +
        d.restas.map((h) => `<li><div class="crece"><span class="chico apagado">${esc(h.que)}</span></div><span class="mal">${h.xp}</span></li>`).join('')
      : '<li class="chico apagado">Todavía nada sumó XP este día.</li>'
    $('#balance').innerHTML = `Ese día: <span class="ok">+${d.balance.mas}</span> / <span class="mal">−${d.balance.menos}</span> XP`
    const r = d.revision ? d.revision.respuestas : {}
    obstaculo = r.obstaculo || ''
    $('#detalle').value = r.detalle || ''
    $('#ajuste').value = r.ajuste || ''
    $('#guardar-diaria').textContent = d.revision ? 'Actualizar' : 'Listo'
    const chips = $('#obstaculos')
    chips.innerHTML = ''
    for (const o of d.obstaculos) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = o
      b.setAttribute('aria-pressed', String(o === obstaculo))
      b.onclick = () => {
        obstaculo = o
        chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
        setTimeout(() => irA(3), 180)
      }
      chips.appendChild(b)
    }
    $('#diaria').hidden = false
    irA(1)
  }

  function pintarSemanal() {
    $('#titulo').textContent = '週 Revisión semanal'
    $('#semana-titulo').textContent = `Del ${fecha(d.desde)} al ${fecha(d.hasta)}`
    $('#semana-dias').innerHTML = d.porDia.map((x, i) => `<li><div class="crece"><span class="chico">${DIAS[i]} ${fecha(x.fecha)}</span></div><span class="${x.xp === null || x.xp === 0 ? 'apagado' : x.xp < 0 ? 'mal' : 'ok'}">${x.xp === null ? '—' : (x.xp > 0 ? '+' : '') + x.xp + ' XP'}</span></li>`).join('')
    $('#semana-total').textContent = `En la semana: ${d.xpTotal} XP`
    const r = d.revision ? d.revision.respuestas : {}
    const f = $('#form-semanal')
    f.queFunciono.value = r.queFunciono || ''
    f.queCambiar.value = r.queCambiar || ''
    $('#guardar-semanal').textContent = d.revision ? 'Actualizar' : 'Guardar'
    $('#semanal').hidden = false
  }

  document.querySelectorAll('[data-ir]').forEach((b) => { b.onclick = () => irA(Number(b.dataset.ir)) })
  $('#ajuste').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#guardar-diaria').click() })

  $('#guardar-diaria').onclick = seguro(async () => {
    const r = await api('/api/ciclo/revision', { tipo: 'diaria', periodo: d.periodo, respuestas: { obstaculo, detalle: $('#detalle').value.trim(), ajuste: $('#ajuste').value.trim() } })
    mensaje(r.nueva ? 'Revisión lista' : 'Revisión actualizada')
    setTimeout(() => { location.href = '/ciclo' }, 600)
  })

  $('#form-semanal').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    const r = await api('/api/ciclo/revision', { tipo: 'semanal', periodo: d.periodo, respuestas: { queFunciono: f.queFunciono.value.trim(), queCambiar: f.queCambiar.value.trim() } })
    mensaje(r.nueva ? 'Revisión semanal guardada' : 'Revisión actualizada')
    d.revision = r.revision
    $('#guardar-semanal').textContent = 'Actualizar'
  })

  barra('ciclo')
  seguro(async () => {
    d = await api(`/api/ciclo/revision?tipo=${tipo}${fechaPedida ? '&fecha=' + fechaPedida : ''}`)
    if (tipo === 'diaria') pintarDiaria()
    else pintarSemanal()
  })()
})()
