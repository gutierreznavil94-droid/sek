// Pantalla Copia de seguridad: traer datos (app vieja o esta) y guardar una copia. Pide solo a /api/copia.
(function () {
  'use strict'
  const { api, $, seguro, mensaje, barra } = SEK

  const escapar = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
  const de = (origen) => (origen === 'vieja' ? 'app vieja' : 'esta app')
  let nombres = {}

  function error(texto) {
    $('#error').textContent = texto || ''
    $('#error').hidden = !texto
  }

  function filas(lista) {
    return lista.map((p) => `<li class="${p.filas ? '' : 'cero'}"><span>${escapar(p.nombre)}</span><b>${p.filas}</b></li>`).join('')
  }

  async function revisar() {
    error('')
    $('#listo').hidden = true
    try {
      const r = await api('/api/copia/revisar', { texto: $('#texto').value })
      $('#vista-de').textContent = `De la ${de(r.origen)} · ${fecha(r.exportado)}`
      $('#partes').innerHTML = filas(r.partes) + `<li><span>Ajustes</span><b>${r.ajustes}</b></li>`
      $('#sin-usar').hidden = !r.sinUsar.length
      $('#sin-usar-lista').innerHTML = r.sinUsar.map((x) => `<li><span>${escapar(x.tabla)}<span class="motivo">${escapar(x.motivo)}</span></span><b>${x.filas}</b></li>`).join('')
      $('#ya').hidden = !r.yaImportada
      $('#ya').textContent = r.yaImportada ? `Esta copia ya se importó el ${fecha(r.yaImportada)}.` : ''
      $('#importar').disabled = !!r.yaImportada
      $('#vista').hidden = false
      $('#vista').scrollIntoView({ behavior: 'smooth' })
    } catch (e) {
      $('#vista').hidden = true
      error(e.message)
    }
  }

  async function importar() {
    $('#importar').disabled = true
    try {
      const r = await api('/api/copia/importar', { texto: $('#texto').value })
      $('#vista').hidden = true
      $('#texto').value = ''
      $('#revisar').disabled = true
      $('#listo-partes').innerHTML = filas(Object.entries(r.resultado).map(([k, n]) => ({ nombre: nombres[k] || k, filas: n })))
        + `<li><span><b>Total</b></span><b>${r.total}</b></li>`
      $('#listo').hidden = false
      mensaje(`Importado: ${r.total} cosas`)
      await cargarEstado()
    } catch (e) {
      error(e.message)
      $('#importar').disabled = false
    }
  }

  async function copiarTexto() {
    const r = await api('/api/copia/exportar')
    const texto = JSON.stringify(r)
    const caja = $('#copiado')
    caja.value = texto
    caja.hidden = false
    try {
      await navigator.clipboard.writeText(texto)
      mensaje('Copia copiada. Pegala en un mail o una nota para guardarla.')
    } catch (e) {
      caja.focus()
      caja.select()
      mensaje('Tocá el cuadro, «Seleccionar todo» y «Copiar».')
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

  $('#texto').addEventListener('input', () => { $('#revisar').disabled = !$('#texto').value.trim(); $('#vista').hidden = true })
  $('#archivo').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    $('#texto').value = await f.text()
    $('#revisar').disabled = false
    ev.target.value = ''
    revisar()
  })
  $('#revisar').addEventListener('click', revisar)
  $('#importar').addEventListener('click', importar)
  $('#cancelar').addEventListener('click', () => { $('#vista').hidden = true })
  $('#copiar').addEventListener('click', seguro(copiarTexto))
  $('#descargar').addEventListener('click', () => setTimeout(() => seguro(cargarEstado)(), 1500))
  barra('mas')
  seguro(cargarEstado)()
})()
