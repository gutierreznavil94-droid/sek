// Contadores (series rápidas), igual que la v0.88.27 (Contadores.tsx): cada contador con su cuota, extra y XP,
// editar, crear y cargar a mano. Pide a /api/series (rutas de su módulo) y los atributos a /api/ciclo.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const extraDe = (cuota) => Math.ceil(cuota * 1.5)
  let atributos = []

  function editar(c) {
    let atr = c ? c.atributoIds || [] : ['fisico']
    const h = hoja(c ? `Editar ${c.nombre}` : 'Nuevo contador', `
      <div class="campo"><label for="c-nombre">Nombre</label><input id="c-nombre" maxlength="60" value="${esc(c ? c.nombre : '')}" placeholder="Ej.: Sentadillas"></div>
      <div class="rejilla-2">
        <div class="campo"><label for="c-reps">Reps por serie</label><input id="c-reps" type="number" inputmode="numeric" min="1" value="${c ? c.cantidadPorToque : 10}"><span class="ayuda">Cada toque suma esto.</span></div>
        <div class="campo"><label for="c-series">Series por día</label><input id="c-series" type="number" inputmode="numeric" min="1" value="${c ? c.seriesPorDia || 5 : 5}"><span class="ayuda">5 por defecto.</span></div>
        <div class="campo"><label for="c-cuota">Cuota diaria</label><input id="c-cuota" type="number" inputmode="numeric" min="1"><span class="ayuda" data-cuota-ayuda></span></div>
        <div class="campo"><label for="c-extra">Extra</label><input id="c-extra" type="number" inputmode="numeric" min="1"><span class="ayuda">1,5 × la cuota si lo dejás así.</span></div>
        <div class="campo"><label for="c-xp">XP de la cuota</label><input id="c-xp" type="number" inputmode="numeric" min="0" max="100" value="${c ? c.xpMetaDiaria ?? 10 : 10}"></div>
        <div class="campo"><label for="c-xpextra">XP del extra</label><input id="c-xpextra" type="number" inputmode="numeric" min="0" max="100" value="${c ? c.xpExtra ?? 5 : 5}"></div>
      </div>
      <div class="campo"><label>Atributo que alimenta</label><div class="chips" data-atr></div></div>
      <label class="fila chico" style="gap: 8px;"><input type="checkbox" id="c-subida" ${c && c.sinSubida ? '' : 'checked'}> Proponer subir las reps cada 3 días</label>
      <label class="fila chico" style="gap: 8px;"><input type="checkbox" id="c-amano" ${c && c.cuotaAMano ? 'checked' : ''}> Cuota a mano (en vez de reps × series)</label>
      ${c ? `<label class="fila chico" style="gap: 8px;"><input type="checkbox" id="c-activo" ${c.activo ? 'checked' : ''}> Activo (aparece en Hoy)</label>` : ''}
      <button type="button" class="boton primario ancho" data-guardar>Guardar</button>`)
    const q = (s) => h.el.querySelector(s)
    const n = (s) => Number(q(s).value)
    const cuota = q('#c-cuota'), extra = q('#c-extra'), amano = q('#c-amano')
    let extraTocado = !!(c && c.metaExtra !== undefined && c.metaExtra !== extraDe(c.metaDiaria))
    cuota.value = c ? c.metaDiaria : 50
    extra.value = c ? c.metaExtra ?? extraDe(c.metaDiaria) : extraDe(50)
    const recalcular = () => {
      if (!amano.checked) cuota.value = n('#c-reps') * n('#c-series')
      cuota.readOnly = !amano.checked
      q('[data-cuota-ayuda]').textContent = amano.checked ? 'Fija: no cambia al subir las reps' : `${n('#c-reps')} × ${n('#c-series')} series`
      if (!extraTocado) extra.value = extraDe(Number(cuota.value) || 0)
    }
    ;['#c-reps', '#c-series', '#c-cuota'].forEach((s) => q(s).addEventListener('input', recalcular))
    amano.onchange = recalcular
    extra.addEventListener('input', () => { extraTocado = true })
    recalcular()
    const pintarAtr = () => {
      q('[data-atr]').innerHTML = atributos.map((a) => `<button type="button" class="${atr.includes(a.id) ? 'activo' : ''}" aria-pressed="${atr.includes(a.id)}" data-a="${esc(a.id)}">${esc(a.nombre)}</button>`).join('')
      q('[data-atr]').querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { const id = b.dataset.a; atr = atr.includes(id) ? atr.filter((x) => x !== id) : [...atr, id]; pintarAtr() } })
    }
    pintarAtr()
    q('[data-guardar]').onclick = seguro(async () => {
      const cuerpo = {
        ...(c ? { id: c.id } : {}), nombre: q('#c-nombre').value.trim(), cantidadPorToque: n('#c-reps'), seriesPorDia: n('#c-series'),
        cuotaAMano: amano.checked, metaDiaria: Number(cuota.value), metaExtra: Number(extra.value), xpMetaDiaria: n('#c-xp'), xpExtra: n('#c-xpextra'),
        atributoIds: atr, sinSubida: !q('#c-subida').checked, ...(c ? { activo: q('#c-activo').checked } : {}),
      }
      await api('/api/series', cuerpo)
      h.cerrar()
      avisar('Contador guardado. Vale de hoy en adelante.', { tipo: 'ok' })
      cargar()
    })
  }

  function aMano(c) {
    const h = hoja(`${c.nombre}: cargar a mano`, `
      <div class="campo"><label for="m-cant">Cantidad</label><input id="m-cant" type="number" inputmode="numeric" min="1" value="${c.cantidadPorToque}"></div>
      <button type="button" class="boton primario ancho" data-sumar>Sumar ${c.cantidadPorToque}</button>`)
    const cant = h.el.querySelector('#m-cant'), b = h.el.querySelector('[data-sumar]')
    cant.oninput = () => { b.textContent = `Sumar ${cant.value}`; b.disabled = !(Number(cant.value) > 0) }
    b.onclick = seguro(async () => {
      const r = await api(`/api/series/${encodeURIComponent(c.id)}/toque`, { cantidad: Number(cant.value) })
      h.cerrar()
      avisar(`${c.nombre}: ${r.toque.total} hoy${r.toque.xp ? ` · +${r.toque.xp} XP` : ''}`, { tipo: 'ok' })
      cargar()
    })
  }

  function pintar(d) {
    const res = (id) => d.series.find((x) => x.contador.id === id)
    $('#lista').innerHTML = d.todas.length ? d.todas.map((c, i) => {
      const r = res(c.id)
      const subidas = (r && r.escalonesReps) || []
      return `<section class="tarjeta compacta"><div class="fila entre">
        <div class="col" style="gap: 0;"><b>${esc(c.nombre)}${c.activo ? '' : '<span class="etiqueta" style="margin-left: 6px;">inactivo</span>'}</b>
          <span class="chico texto-3">${c.cantidadPorToque} por serie × ${c.seriesPorDia || 5} series · cuota ${c.metaDiaria} (+${c.xpMetaDiaria ?? 10} XP) · extra ${c.metaExtra ?? extraDe(c.metaDiaria)} (+${c.xpExtra ?? 5} XP)</span>
          ${subidas.length > 1 ? `<span class="linea-cuota">Reps por serie: ${subidas.map((x, k) => (k === 0 ? `${x.reps}` : `${x.reps} (${esc(fechaLegible(x.desde))})`)).join(' → ')}</span>` : ''}
          ${r ? `<span class="chico texto-2">Hoy ${r.hoy} · semana ${r.semana} · total ${r.total}${r.record ? ` · récord ${r.record.total}` : ''}</span>` : ''}</div>
        <div class="col" style="gap: 4px;"><button type="button" class="boton chico" data-editar="${i}">Editar</button>${c.activo ? `<button type="button" class="boton chico suave" data-mano="${i}">Cargar a mano</button>` : ''}</div>
      </div></section>`
    }).join('') : '<p class="vacio">Sin contadores. Sumá uno con «+ Nuevo».</p>'
    $('#lista').querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editar(d.todas[Number(b.dataset.editar)]) })
    $('#lista').querySelectorAll('[data-mano]').forEach((b) => { b.onclick = () => aMano(d.todas[Number(b.dataset.mano)]) })
  }

  const cargar = seguro(async () => pintar(await api('/api/series')))
  $('#nuevo').onclick = () => editar(null)
  seguro(async () => { const c = await api('/api/ciclo').catch(() => null); atributos = (c && c.atributos) || [] })()
  cargar()
})()
