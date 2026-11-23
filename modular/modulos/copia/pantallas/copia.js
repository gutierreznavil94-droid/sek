// Más → Copia de seguridad, igual que la v0.88.27 (Copia.tsx): exportar (archivo o texto) e importar.
// Importar muestra primero qué trae (en una hoja) y se suma a lo que hay. Pide solo a /api/copia.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })

  const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
  const de = (origen) => (origen === 'vieja' ? 'app vieja' : 'esta app')
  let nombres = {}

  function error(texto) {
    $('#error').textContent = texto || ''
    $('#error').hidden = !texto
  }
  const filas = (lista) => lista.map((p) => `<li class="${p.filas ? '' : 'cero'}"><span>${esc(p.nombre)}</span><b>${p.filas}</b></li>`).join('')

  async function revisar(texto) {
    error('')
    $('#listo').hidden = true
    let r
    try { r = await api('/api/copia/revisar', { texto }) } catch (e) { return error(e.message) }
    const sinUsar = r.sinUsar.length ? `<details class="zona-escondida"><summary>Lo que no se trae</summary><ul class="cp-partes">${r.sinUsar.map((x) => `<li><span>${esc(x.tabla)}<span class="motivo">${esc(x.motivo)}</span></span><b>${x.filas}</b></li>`).join('')}</ul></details>` : ''
    const h = hoja('¿Importar esta copia?', `
      <p class="chico texto-2">De la ${de(r.origen)} · ${fecha(r.exportado)}</p>
      <ul class="cp-partes">${filas(r.partes)}<li><span>Ajustes</span><b>${r.ajustes}</b></li></ul>
      ${sinUsar}
      <p class="chico texto-2">Se suma a lo que ya tenés. Si algo falla, no entra nada.</p>
      ${r.yaImportada ? `<p class="chico" style="color: var(--peligro, #e0644a);">Esta copia ya se importó el ${fecha(r.yaImportada)}.</p>` : ''}
      <div class="rejilla-2"><button type="button" class="boton suave" data-no>Cancelar</button><button type="button" class="boton primario" data-si ${r.yaImportada ? 'disabled' : ''}>Importar</button></div>`)
    h.el.querySelector('[data-no]').onclick = h.cerrar
    h.el.querySelector('[data-si]').onclick = seguro(async (e) => {
      e.currentTarget.disabled = true
      try {
        const res = await api('/api/copia/importar', { texto })
        h.cerrar()
        $('#texto').value = ''
        $('#revisar').disabled = true
        $('#listo-partes').innerHTML = filas(Object.entries(res.resultado).map(([k, n]) => ({ nombre: nombres[k] || k, filas: n })))
          + `<li><span><b>Total</b></span><b>${res.total}</b></li>`
        $('#listo').hidden = false
        avisar(`Importado: ${res.total} cosas`, { tipo: 'ok' })
        await cargarEstado()
      } catch (err) {
        h.cerrar()
        error(err.message)
      }
    })
  }

  async function copiarTexto() {
    const texto = JSON.stringify(await api('/api/copia/exportar'))
    $('#copiado').value = texto
    $('#copiado-caja').hidden = false
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Copia copiada. Pegala en un mail o una nota para guardarla.', { tipo: 'ok' })
    } catch (e) {
      $('#copiado').focus()
      $('#copiado').select()
      avisar('Seleccioná todo el texto de abajo y copialo.')
    }
    await cargarEstado()
  }

  async function cargarEstado() {
    const r = await api('/api/copia')
    nombres = Object.fromEntries(r.modulos.map((m) => [m.clave, m.nombre]))
    $('#ultima').textContent = r.ultimaExportacion ? fecha(r.ultimaExportacion) : 'nunca'
    $('#historial').hidden = !r.importaciones.length
    $('#historial-lista').innerHTML = r.importaciones.map((x) => `<li><span>${fecha(x.creado)}<span class="motivo">de la ${de(x.origen)}, armada el ${fecha(x.exportado)}</span></span><b>${x.total}</b></li>`).join('')
  }

  $('#texto').addEventListener('input', () => { $('#revisar').disabled = !$('#texto').value.trim() })
  $('#copiado').addEventListener('focus', (e) => e.target.select())
  $('#archivo').addEventListener('change', seguro(async (ev) => {
    const f = ev.target.files && ev.target.files[0]
    ev.target.value = ''
    if (f) await revisar(await f.text())
  }))
  $('#revisar').addEventListener('click', seguro(() => revisar($('#texto').value)))
  $('#copiar').addEventListener('click', seguro(copiarTexto))
  $('#descargar').addEventListener('click', () => {
    setTimeout(seguro(cargarEstado), 1500)
    avisar('Copia exportada. Guardala en Drive, Telegram o el correo.', { tipo: 'ok' })
  })
  seguro(cargarEstado)()
})()
