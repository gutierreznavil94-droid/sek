// Pantalla Más → Tema: elegir el tema, la lluvia de fondo, subir/compartir/borrar temas propios y probar los efectos.
// Pide solo a las rutas de su módulo (/api/temas…).
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje, evento } = SEK
  const escapar = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  function tarjeta(t, elegido) {
    const esElegido = t.id === elegido
    const fondo = t.vistaPrevia && t.vistaPrevia.imagen ? `background-image:url('${escapar(t.vistaPrevia.imagen)}')` : ''
    return `
      <article class="tema-tarjeta${esElegido ? ' elegido' : ''}" data-id="${escapar(t.id)}">
        <button type="button" class="vista" data-accion="elegir" style="${fondo}" aria-label="Elegir ${escapar(t.nombre)}">
          ${esElegido ? '<span class="marca">En uso</span>' : ''}
          <span class="muestra"><i style="background:${escapar(t.acento)}"></i></span>
        </button>
        <div class="texto"><strong>${escapar(t.nombre)}</strong><span class="desc">${escapar(t.descripcion)}</span></div>
        <div class="acciones">
          ${esElegido ? '' : '<button type="button" class="principal" data-accion="elegir">Usar</button>'}
          ${t.propio ? `<a class="boton" href="/api/temas/propios/${encodeURIComponent(t.id)}/archivo" download>Compartir</a><button type="button" class="peligro" data-accion="borrar">Borrar</button>` : ''}
        </div>
      </article>`
  }

  function pintar(r) {
    $('#temas').innerHTML = r.temas.map((t) => tarjeta(t, r.elegido)).join('') +
      (r.proximos || []).map((p) => `<article class="tema-tarjeta pronto" aria-disabled="true"><div class="vista">？</div><div class="texto"><strong>${escapar(p.nombre)}</strong><span class="desc">${escapar(p.pista)}</span></div></article>`).join('')
    for (const b of document.querySelectorAll('#lluvia button')) b.setAttribute('aria-checked', String(b.dataset.valor === r.lluvia))
  }

  /** Al cambiar de tema, se recarga la página: así el tema nuevo se aplica entero (colores, kanjis, lluvia). */
  const recargar = () => location.reload()

  $('#temas').addEventListener('click', seguro(async (e) => {
    const b = e.target.closest('[data-accion]')
    if (!b) return
    const id = b.closest('[data-id]').dataset.id
    if (b.dataset.accion === 'elegir') {
      await api('/api/temas/elegido', { id }, 'PUT')
      recargar()
    } else if (b.dataset.accion === 'borrar') {
      if (!confirm('¿Borrar este tema? Si lo tenés en uso, vuelve Shinobi.')) return
      await api(`/api/temas/propios/${encodeURIComponent(id)}`, undefined, 'DELETE')
      recargar()
    }
  }))

  $('#lluvia').addEventListener('click', seguro(async (e) => {
    const b = e.target.closest('button[data-valor]')
    if (!b) return
    await api('/api/temas/lluvia', { lluvia: b.dataset.valor }, 'PUT')
    recargar()
  }))

  $('#archivo').addEventListener('change', seguro(async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    mensaje('Subiendo el tema…')
    const texto = await f.text()
    await api('/api/temas/propios', { texto })
    recargar()
  }))

  $('#probar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-evento]')
    if (b) evento(b.dataset.evento, { elemento: b, nivel: 7 })
  })

  barra('mas')
  seguro(async () => pintar(await api('/api/temas')))()
})()
