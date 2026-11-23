// Editor de una rutina, con guardado automático (PUT /api/entreno/rutinas/:id). Si el servidor no acepta
// lo escrito, queda un borrador en este celu y se avisa qué falta.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const id = new URLSearchParams(location.search).get('id')
  const DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']]
  const TIPOS = { ejercicio: 'Ejercicio', calentamiento: 'Calentamiento', temporizador: 'Temporizador', cronometro: 'Cronómetro', rondas: 'Rondas', casilla: 'Casilla' }
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const BORRADOR = 'sek-borrador-rutina-' + id
  let rutina = null
  let detalle = { otras: [], enlaces: {}, preguntas: [] }
  let timer = null

  const tipoDe = (b) => (b.tipo === 'temporizador' && b.modo === 'cronometro' ? 'cronometro' : b.tipo)
  const nuevoBloqueId = () => 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

  function nuevoBloque(tipo) {
    const b = { id: nuevoBloqueId() }
    if (tipo === 'ejercicio') return { ...b, tipo, nombre: 'Ejercicio nuevo', series: 2, reps: 8, repsTope: 12, peso: 0, descanso: 90, sombra: 30 }
    if (tipo === 'calentamiento') return { ...b, tipo, nombre: 'Calentamiento', segundos: 180 }
    if (tipo === 'temporizador') return { ...b, tipo, nombre: 'Temporizador', segundos: 60, modo: 'cuenta' }
    if (tipo === 'cronometro') return { ...b, tipo: 'temporizador', modo: 'cronometro', nombre: 'Colgarse en barra', segundos: 30, peso: 0, descansoDespues: 60 }
    if (tipo === 'rondas') return { ...b, tipo, nombre: 'Rondas', rondas: [{ segundos: 60, texto: 'Ronda 1' }], descansoEntre: 60 }
    return { ...b, tipo: 'casilla', nombre: 'Estirar' }
  }

  // Campos de cada tipo: [clave, texto, tipo de input, ayuda]
  const CAMPOS = {
    ejercicio: [
      ['nombre', 'Nombre', 'text', '', 'ancho'], ['grupo', 'Músculo', 'text', 'Pecho, espalda, pierna…'],
      ['series', 'Series', 'number', 'Cuántas veces lo hacés'], ['reps', 'Reps actuales', 'number', 'Lo que hacés hoy en la serie 1. Sube sola cuando lo superás'],
      ['repsTope', 'Tope de reps', 'number', 'Al llegar, te pregunta si subís el peso'], ['peso', 'Peso (kg)', 'number', '0 = peso del cuerpo'],
      ['repsExtra', 'Reps extra', 'number', 'El «+3» de «12 + 3» (opcional)'], ['descanso', 'Descanso (s)', 'number', 'Entre series'],
      ['sombra', 'Sombra (s)', 'number', 'Boxeo de sombra al principio del descanso. 0 = sin sombra'],
      ['admiteAyuda', 'Las extra son con ayuda', 'checkbox', 'No cuentan para récord'], ['nota', 'Nota', 'text', '', 'ancho'],
    ],
    calentamiento: [['nombre', 'Nombre', 'text', '', 'ancho'], ['segundos', 'Tiempo (s)', 'number', ''], ['nota', 'Nota', 'text', '', 'ancho']],
    temporizador: [['nombre', 'Nombre', 'text', '', 'ancho'], ['segundos', 'Tiempo (s)', 'number', 'Cuenta para abajo'], ['veces', 'Veces', 'number', ''], ['nota', 'Nota', 'text', '', 'ancho']],
    cronometro: [
      ['nombre', 'Nombre', 'text', '', 'ancho'], ['segundos', 'Objetivo (s)', 'number', 'Si lo superás, sube 1 s solo'], ['peso', 'Peso (kg)', 'number', ''],
      ['descansoDespues', 'Descanso después (s)', 'number', ''], ['nota', 'Nota', 'text', '', 'ancho'],
    ],
    rondas: [['nombre', 'Nombre', 'text', '', 'ancho'], ['descansoEntre', 'Descanso entre rondas (s)', 'number', '']],
    casilla: [['nombre', 'Nombre', 'text', '', 'ancho'], ['nota', 'Nota', 'text', '', 'ancho']],
  }

  function estado(texto, mal) { const e = $('#estado'); e.textContent = texto; e.className = 'estado-guardado' + (mal ? ' mal' : '') }

  function programarGuardado(ya) {
    clearTimeout(timer)
    try { localStorage.setItem(BORRADOR, JSON.stringify(rutina)) } catch (e) { /* sin lugar: igual se guarda en el servidor */ }
    estado('Guardando…')
    timer = setTimeout(guardar, ya ? 0 : 700)
  }

  async function guardar() {
    try {
      detalle = await api('/api/entreno/rutinas/' + encodeURIComponent(id), rutina, 'PUT')
      rutina = { ...rutina, bloques: rutina.bloques.map((b) => detalle.rutina.bloques.find((x) => x.id === b.id) || b) }
      try { localStorage.removeItem(BORRADOR) } catch (e) { /* nada */ }
      estado('Guardado ✓')
      pintarEnlaces()
    } catch (e) {
      estado('No se guardó: ' + e.message, true)
    }
  }

  function pintarCabecera() {
    $('#nombre').value = rutina.nombre
    $('#minutos').value = rutina.minutos
    $('#activa').checked = rutina.activa
    $('#dias').innerHTML = DIAS.map(([d, t]) => `<label><input type="checkbox" value="${d}" ${rutina.dias.includes(d) ? 'checked' : ''}>${t}</label>`).join('')
    $('#dias').onchange = () => { rutina.dias = [...$('#dias').querySelectorAll('input:checked')].map((i) => Number(i.value)); programarGuardado() }
  }

  function campo(b, [clave, texto, tipo, ayuda, clase]) {
    const valor = b[clave]
    if (tipo === 'checkbox') return `<label class="${clase || ''}" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-campo="${clave}" ${valor ? 'checked' : ''} style="width:auto;min-height:0"> ${texto}${ayuda ? ` <span class="ayuda">(${ayuda})</span>` : ''}</label>`
    return `<label class="${clase || ''}">${texto}<input data-campo="${clave}" type="${tipo}" ${tipo === 'number' ? 'inputmode="decimal" min="0" step="any"' : ''} value="${esc(valor ?? '')}">${ayuda ? `<span class="ayuda">${ayuda}</span>` : ''}</label>`
  }

  function pintarBloques() {
    const cont = $('#bloques')
    cont.innerHTML = rutina.bloques.length ? '' : '<p class="chico apagado">Sumá ejercicios y demás con los botones de abajo.</p>'
    rutina.bloques.forEach((b, i) => {
      const t = tipoDe(b)
      const div = document.createElement('div')
      div.className = 'bloque'
      div.dataset.id = b.id
      let html = `<div class="fila entre"><span class="tipo">${TIPOS[t] || t}</span><span class="enlace" data-enlace></span></div>
        <div class="campos">${(CAMPOS[t] || CAMPOS.casilla).map((c) => campo(b, c)).join('')}</div>`
      if (t === 'rondas') {
        html += '<div class="lista" data-rondas>' + b.rondas.map((r, j) => `<div class="fila" data-ronda="${j}"><input type="number" inputmode="numeric" min="1" value="${r.segundos}" data-r="segundos" style="width:90px" aria-label="Segundos de la ronda ${j + 1}"><input value="${esc(r.texto)}" data-r="texto" style="flex:1;width:auto" aria-label="Texto de la ronda ${j + 1}"><button class="mini" data-quitar-ronda="${j}" aria-label="Quitar ronda">✕</button></div>`).join('') + '</div><button class="mini" data-sumar-ronda>+ Ronda</button>'
      }
      html += `<div class="botones">
        <button class="mini" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
        <button class="mini" data-mover="1" ${i === rutina.bloques.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
        ${(b.tipo === 'ejercicio' || b.tipo === 'temporizador') && detalle.otras.length ? '<button class="mini" data-sumar-a>Sumar a otra rutina</button>' : ''}
        <button class="mini peligro" data-quitar>Quitar</button></div>
        <div data-sumar-panel hidden class="lista"></div>`
      div.innerHTML = html
      cont.appendChild(div)
    })
    pintarEnlaces()
  }

  function pintarEnlaces() {
    for (const div of document.querySelectorAll('.bloque')) {
      const otras = detalle.enlaces[div.dataset.id]
      div.querySelector('[data-enlace]').textContent = otras ? '⛓ También en: ' + otras.join(', ') : ''
    }
    $('#preguntas').innerHTML = ''
    for (const p of detalle.preguntas) {
      const div = document.createElement('div')
      div.className = 'tarjeta pregunta'
      div.innerHTML = `<p>¿<b>${esc(p.nombre)}</b> es el mismo ejercicio que el de <b>${esc(p.otraRutina)}</b>?</p><p class="ayuda">Si es el mismo, comparten historial, récords y peso.</p><div class="botones"><button class="mini principal" data-si>Sí, es el mismo</button><button class="mini" data-no>No, es otro</button></div>`
      const responder = (si) => seguro(async () => {
        clearTimeout(timer)
        detalle = await api(`/api/entreno/rutinas/${encodeURIComponent(id)}/es-el-mismo`, { bloqueId: p.bloqueId, otroBloqueId: p.otroBloqueId, esElMismo: si })
        rutina = detalle.rutina
        pintarBloques()
      })
      div.querySelector('[data-si]').onclick = responder(true)
      div.querySelector('[data-no]').onclick = responder(false)
      $('#preguntas').appendChild(div)
    }
  }

  const bloqueDe = (el) => rutina.bloques.find((b) => b.id === el.closest('.bloque').dataset.id)

  $('#bloques').addEventListener('input', (e) => {
    const b = bloqueDe(e.target)
    if (!b) return
    const c = e.target.dataset.campo
    if (c) {
      if (e.target.type === 'checkbox') b[c] = e.target.checked || undefined
      else if (e.target.type === 'number') b[c] = e.target.value === '' ? undefined : Number(e.target.value)
      else b[c] = e.target.value
    }
    const r = e.target.dataset.r
    if (r) {
      const j = Number(e.target.closest('[data-ronda]').dataset.ronda)
      b.rondas[j][r] = r === 'segundos' ? Number(e.target.value) : e.target.value
    }
    programarGuardado()
  })

  $('#bloques').addEventListener('click', seguro(async (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    const b = bloqueDe(btn)
    const i = rutina.bloques.indexOf(b)
    if (btn.dataset.mover) {
      const j = i + Number(btn.dataset.mover)
      ;[rutina.bloques[i], rutina.bloques[j]] = [rutina.bloques[j], rutina.bloques[i]]
    } else if (btn.hasAttribute('data-quitar')) {
      if (btn.dataset.seguro !== '1') { btn.dataset.seguro = '1'; btn.textContent = '¿Seguro? Tocá de nuevo'; return }
      rutina.bloques.splice(i, 1)
    } else if (btn.hasAttribute('data-sumar-ronda')) {
      b.rondas.push({ segundos: 60, texto: `Ronda ${b.rondas.length + 1}` })
    } else if (btn.dataset.quitarRonda !== undefined) {
      if (b.rondas.length > 1) b.rondas.splice(Number(btn.dataset.quitarRonda), 1)
    } else if (btn.hasAttribute('data-sumar-a')) {
      const panel = btn.closest('.bloque').querySelector('[data-sumar-panel]')
      panel.hidden = !panel.hidden
      panel.innerHTML = detalle.otras.map((o) => `<label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" value="${esc(o.id)}" style="width:auto;min-height:0"> ${esc(o.nombre)}</label>`).join('') + '<button class="mini principal" data-sumar-ok>Sumar (queda enlazado)</button>'
      return
    } else if (btn.hasAttribute('data-sumar-ok')) {
      const destinos = [...btn.closest('[data-sumar-panel]').querySelectorAll('input:checked')].map((x) => x.value)
      clearTimeout(timer)
      await guardar()
      const r = await api(`/api/entreno/rutinas/${encodeURIComponent(id)}/sumar-bloque`, { bloqueId: b.id, destinos })
      detalle = r
      mensaje(`Sumado a ${r.sumadas} rutina${r.sumadas === 1 ? '' : 's'}.`)
    } else return
    pintarBloques()
    programarGuardado(true)
  }))

  for (const btn of document.querySelectorAll('[data-nuevo]')) {
    btn.onclick = () => { rutina.bloques.push(nuevoBloque(btn.dataset.nuevo)); pintarBloques(); programarGuardado(true) }
  }
  $('#nombre').oninput = () => { rutina.nombre = $('#nombre').value; programarGuardado() }
  $('#minutos').oninput = () => { rutina.minutos = Number($('#minutos').value) || 30; programarGuardado() }
  $('#activa').onchange = () => { rutina.activa = $('#activa').checked; programarGuardado(true) }
  $('#borrar').onclick = seguro(async () => {
    const b = $('#borrar')
    if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Seguro? Tocá de nuevo para borrar'; return }
    clearTimeout(timer)
    const r = await api('/api/entreno/rutinas/' + encodeURIComponent(id), undefined, 'DELETE')
    try { localStorage.removeItem(BORRADOR) } catch (e) { /* nada */ }
    mensaje(r.resultado === 'eliminada' ? 'Rutina borrada.' : 'Rutina borrada (sus entrenos quedan en el historial).')
    setTimeout(() => { location.href = '/entreno' }, 800)
  })

  seguro(async () => {
    detalle = await api('/api/entreno/rutinas/' + encodeURIComponent(id))
    rutina = detalle.rutina
    let borrador = null
    try { borrador = JSON.parse(localStorage.getItem(BORRADOR) || 'null') } catch (e) { /* nada */ }
    if (borrador && borrador.id === rutina.id) { rutina = borrador; estado('Recuperé lo que no se había guardado'); programarGuardado(true) }
    pintarCabecera()
    pintarBloques()
  })()
  barra('entreno')
})()
