// Pantalla Identidad y atributos: yo ideal, obstáculos y la lista de atributos. Pide a /api/ciclo.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const { esc, hoja } = CICLO
  const form = $('#form-identidad')
  let guardada = { vision: '', obstaculos: '' }

  const cambiado = () => form.vision.value.trim() !== guardada.vision || form.obstaculos.value.trim() !== guardada.obstaculos
  const revisar = () => { $('#guardar-identidad').disabled = !cambiado() || form.vision.value.trim().length < 10 }

  function editarAtributo(a) {
    hoja(a ? 'Editar atributo' : 'Nuevo atributo', `
      <label>Nombre <input name="nombre" required minlength="2" maxlength="100" value="${esc(a?.nombre)}"></label>
      <label>Descripción <input name="descripcion" maxlength="300" value="${esc(a?.descripcion)}"></label>
      <label>Ventana de cálculo (días) <input type="number" name="ventanaDias" min="3" max="60" inputmode="numeric" value="${a?.ventanaDias ?? 14}">
        <span class="ayuda">Cuántos días hacia atrás se miran para calcular el valor. 14 es un buen punto de partida.</span></label>`,
    async (v) => {
      const cuerpo = { nombre: v.nombre, descripcion: v.descripcion, ventanaDias: Number(v.ventanaDias) }
      pintar(a ? await api(`/api/ciclo/atributos/${a.id}`, cuerpo, 'PUT') : await api('/api/ciclo/atributos', cuerpo))
      mensaje('Atributo guardado')
    })
  }

  function pintar(r) {
    guardada = { vision: r.identidad.vision, obstaculos: r.identidad.obstaculos }
    form.vision.value = guardada.vision
    form.obstaculos.value = guardada.obstaculos
    revisar()
    const ul = $('#atributos')
    ul.innerHTML = ''
    for (const a of r.atributos) {
      const li = document.createElement('li')
      li.innerHTML = `<div class="crece"><b class="chico">${esc(a.nombre)}</b><span class="detalle">${esc(a.descripcion)}${a.descripcion ? ' · ' : ''}ventana ${a.ventanaDias} días</span></div>
        <button class="mini" type="button" data-e aria-label="Editar">✎</button><button class="mini" type="button" data-a aria-label="Archivar">Archivar</button>`
      li.querySelector('[data-e]').onclick = () => editarAtributo(a)
      li.querySelector('[data-a]').onclick = seguro(async () => {
        if (!confirm('¿Archivar este atributo? Deja de mostrarse; su historial y lo vinculado quedan.')) return
        pintar(await api(`/api/ciclo/atributos/${a.id}`, undefined, 'DELETE'))
      })
      ul.appendChild(li)
    }
    if (!r.atributos.length) ul.innerHTML = '<li class="chico apagado">No hay atributos. Sumá uno.</li>'
  }

  form.addEventListener('input', revisar)
  form.onsubmit = seguro(async (e) => {
    e.preventDefault()
    pintar(await api('/api/ciclo/identidad', { vision: form.vision.value.trim(), obstaculos: form.obstaculos.value.trim() }, 'PUT'))
    mensaje('Identidad guardada')
  })
  $('#nuevo-atributo').onclick = () => editarAtributo(null)
  barra('ciclo')
  seguro(async () => pintar(await api('/api/ciclo')))()
})()
