// Más → Tema y nombres, igual que la v0.88.27 (TemaYNombres.tsx): elegir el tema (tarjetas con su video),
// subir o borrar un tema propio, y los nombres (app, vos y fases). Los nombres se guardan en el módulo cuentas.
// La lluvia de fondo se elige en Ajustes, como en la vieja.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, confirmar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const FASES = ['Disciplina', 'Constancia', 'Mi yo ideal']
  let lista = null

  function vista(t) {
    const vp = t.vistaPrevia || {}
    const fondo = vp.video && !quieto()
      ? `<video src="${esc(vp.video)}" poster="${esc(vp.imagen || '')}" autoplay muted loop playsinline preload="metadata"></video>`
      : vp.imagen ? `<img src="${esc(vp.imagen)}" alt="">` : ''
    const sprite = t.sprite ? `<span class="pv-tema-sprite" aria-hidden="true" style="background-image: url('${esc(t.sprite)}');"></span>` : ''
    return `<span class="pv-tema-vista">${fondo}${sprite}</span>`
  }

  function pintarTemas(r) {
    lista = r
    $('#temas').innerHTML = r.temas.map((t) => {
      const si = t.id === r.elegido
      return `<div class="pv-tema-lugar">
        <button type="button" class="pv-tema ${si ? 'elegido' : ''}" aria-pressed="${si}" data-elegir="${esc(t.id)}" style="--tema-acento: ${esc(t.acento)};">
          ${vista(t)}
          <span class="pv-tema-texto"><b>${esc(t.nombre)}</b><span class="chico texto-2">${esc(t.descripcion)}</span></span>
          ${si ? '<span class="pv-tema-sello" aria-hidden="true">印</span>' : ''}
        </button>
        ${t.propio ? `<button type="button" class="pv-tema-borrar" data-borrar="${esc(t.id)}" aria-label="Borrar el tema ${esc(t.nombre)}">✕</button>` : ''}
      </div>`
    }).join('') + `<label class="pv-tema pv-tema-importar" id="importar">
        <input type="file" class="pv-tema-archivo" id="archivo" accept=".sektema,.json,application/json" aria-label="Importar tema">
        <span class="pv-tema-vista"><span class="pv-tema-pronto">＋</span></span>
        <span class="pv-tema-texto"><b>Importar tema</b><span class="chico texto-2">¿Tenés un archivo de tema (.sektema)? Subilo y queda guardado solo en este celu.</span></span>
      </label>` + (r.proximos || []).map((p) => `<div class="pv-tema apagado" aria-disabled="true">
        <span class="pv-tema-vista"><span class="pv-tema-pronto">?</span></span>
        <span class="pv-tema-texto"><b>${esc(p.nombre)}</b><span class="chico texto-3">${esc(p.pista)}</span></span>
      </div>`).join('')
    $('#archivo').addEventListener('change', seguro(subir))
  }

  // Al cambiar de tema se recarga la página: así el tema nuevo se aplica entero (colores, kanjis, lluvia).
  const recargar = (texto) => { try { sessionStorage.setItem('sek-aviso-tema', texto) } catch (e) { /* sin aviso */ } location.reload() }

  async function subir(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    $('#importar').classList.add('subiendo')
    $('#importar').querySelector('.pv-tema-pronto').textContent = '…'
    try {
      const r = await api('/api/temas/propios', { texto: await f.text() })
      await api('/api/temas/elegido', { id: r.id }, 'PUT')
      recargar('Tema subido. Queda guardado solo en este celu.')
    } finally {
      $('#importar') && $('#importar').classList.remove('subiendo')
    }
  }

  $('#temas').addEventListener('click', seguro(async (e) => {
    const b = e.target.closest('[data-elegir], [data-borrar]')
    if (!b) return
    if (b.dataset.elegir) {
      if (b.dataset.elegir === lista.elegido) return
      await api('/api/temas/elegido', { id: b.dataset.elegir }, 'PUT')
      return recargar('Tema cambiado. Tus datos siguen igual.')
    }
    const t = lista.temas.find((x) => x.id === b.dataset.borrar)
    confirmar(`¿Borrar el tema «${t.nombre}»?`, 'Se borra de este celu. Tus datos no se tocan. Si lo tenés en uso, vuelve Shinobi.', 'Borrar', seguro(async () => {
      await api(`/api/temas/propios/${encodeURIComponent(t.id)}`, undefined, 'DELETE')
      recargar('Tema borrado')
    }))
  }))

  // ---------- Nombres ----------
  function pintarNombres(a) {
    $('#tn-app').value = a.nombreApp || ''
    $('#tn-nombre').value = a.nombrePersona || ''
    const fases = a.nombresFases && a.nombresFases.length ? a.nombresFases : FASES
    $('#fases').innerHTML = fases.map((f, i) => `<div class="campo"><label for="tn-fase-${i}">Fase ${i + 1}</label><input id="tn-fase-${i}" class="tn-fase" maxlength="30" value="${esc(f)}" placeholder="${esc(FASES[i] || '')}"></div>`).join('')
  }

  $('#guardar').addEventListener('click', seguro(async () => {
    const r = await api('/api/cuentas/ajustes', {
      nombreApp: $('#tn-app').value.trim() || 'SEK',
      nombrePersona: $('#tn-nombre').value,
      nombresFases: [...document.querySelectorAll('.tn-fase')].map((x) => x.value),
    }, 'PUT')
    pintarNombres(r.ajustes)
    avisar('Nombres guardados', { tipo: 'ok' })
  }))

  seguro(async () => {
    const [t, c] = await Promise.all([api('/api/temas'), api('/api/cuentas')])
    pintarTemas(t)
    pintarNombres(c.ajustes)
    if (location.hash === '#nombres') $('#nombres').scrollIntoView()
    let aviso = null
    try { aviso = sessionStorage.getItem('sek-aviso-tema'); sessionStorage.removeItem('sek-aviso-tema') } catch (e) { /* nada */ }
    if (aviso) avisar(aviso, { tipo: 'ok' })
  })()
})()
