// Pantalla Atributos, igual que la v0.88.27 (Atributos.tsx): cada atributo con su valor de hoy, la ventana y
// las acciones que lo mueven. Crear, editar y archivar. Pide a /api/ciclo (sus rutas) y, para el valor y las
// acciones vinculadas, a /api/dia/atributos y /api/dia/acciones (rutas del módulo dia).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const clase = (v) => (v === null || v === undefined ? '' : v >= 80 ? 'ok' : v >= 50 ? 'medio' : 'bajo')
  let valores = [], acciones = []

  function editar(a) {
    const h = hoja(a ? 'Editar atributo' : 'Nuevo atributo', `
      <div class="campo"><label for="at-nombre">Nombre</label><input id="at-nombre" maxlength="100" value="${esc(a ? a.nombre : '')}" placeholder="Ej.: Claridad mental"></div>
      <div class="campo"><label for="at-desc">Descripción</label><input id="at-desc" maxlength="300" value="${esc(a ? a.descripcion : '')}"></div>
      <div class="campo"><label for="at-ventana">Ventana (días)</label><input id="at-ventana" type="number" inputmode="numeric" min="3" max="60" value="${a ? a.ventanaDias : 14}">
        <span class="ayuda">Cuántos días hacia atrás se miran para calcular el valor. 14 es un buen punto de partida.</span></div>
      <button type="button" class="boton primario ancho" data-guardar>Guardar</button>`)
    const nombre = h.el.querySelector('#at-nombre'), g = h.el.querySelector('[data-guardar]')
    const revisar = () => { g.disabled = nombre.value.trim().length < 2 }
    nombre.addEventListener('input', revisar); revisar()
    g.onclick = seguro(async () => {
      const cuerpo = { nombre: nombre.value.trim(), descripcion: h.el.querySelector('#at-desc').value.trim(), ventanaDias: Math.max(3, Math.min(60, Number(h.el.querySelector('#at-ventana').value) || 14)) }
      pintar(a ? await api(`/api/ciclo/atributos/${encodeURIComponent(a.id)}`, cuerpo, 'PUT') : await api('/api/ciclo/atributos', cuerpo))
      h.cerrar()
      avisar('Atributo guardado', { tipo: 'ok' })
    })
  }

  function pintar(r) {
    $('#cargando').hidden = true
    const lista = $('#lista')
    if (!r.atributos.length) { lista.innerHTML = '<p class="vacio">No hay atributos. Sumá uno con «+ Nuevo».</p>'; return }
    lista.innerHTML = r.atributos.map((a, i) => {
      const v = valores.find((x) => x.atributoId === a.id)
      const valor = v ? v.valor : null
      const vinculadas = acciones.filter((x) => (x.atributoIds || []).includes(a.id)).map((x) => x.nombre)
      return `<section class="tarjeta compacta">
        <div class="fila entre"><div class="crece"><b>${esc(a.nombre)}</b>${a.descripcion ? `<div class="chico texto-2">${esc(a.descripcion)}</div>` : ''}</div>
          <span class="grande ${clase(valor)}">${valor ?? '—'}</span></div>
        <div class="chico texto-3">Ventana: ${a.ventanaDias} días · Acciones: ${vinculadas.length ? esc(vinculadas.join(', ')) : 'ninguna'}</div>
        <div class="fila" style="gap: 6px;"><button type="button" class="boton chico" data-editar="${i}">Editar</button><button type="button" class="boton chico suave" data-archivar="${i}">Archivar</button></div>
      </section>`
    }).join('')
    lista.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editar(r.atributos[Number(b.dataset.editar)]) })
    lista.querySelectorAll('[data-archivar]').forEach((b) => {
      const a = r.atributos[Number(b.dataset.archivar)]
      b.onclick = () => confirmar('¿Archivar atributo?', `«${a.nombre}» deja de mostrarse. Su historial y lo vinculado quedan.`, 'Archivar', async () => {
        pintar(await api(`/api/ciclo/atributos/${encodeURIComponent(a.id)}`, undefined, 'DELETE'))
        avisar('Atributo archivado')
      })
    })
  }

  $('#nuevo').onclick = () => editar(null)
  seguro(async () => {
    const nada = () => null
    const [r, v, ac] = await Promise.all([api('/api/ciclo'), api('/api/dia/atributos').catch(nada), api('/api/dia/acciones').catch(nada)])
    valores = (v && v.atributos) || []
    acciones = ((ac && ac.acciones) || []).filter((x) => x.activa !== false)
    pintar(r)
  })()
})()
