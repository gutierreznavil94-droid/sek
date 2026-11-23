// Pantalla Objetivos y fases, igual que la v0.88.27 (Objetivos.tsx): una tarjeta por fase con su foco, qué se
// mide y sus objetivos. Editar la fase, sumar, editar o quitar objetivos y cerrar la fase cuando termina.
// Pide todo a /api/ciclo (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  let datos = null
  const idUrl = encodeURIComponent

  /** Hoja con campos; `alGuardar(valores)` corre al tocar el botón. */
  function formulario(titulo, campos, alGuardar, boton = 'Guardar') {
    const h = hoja(titulo, `${campos}<button type="button" class="boton primario ancho" data-guardar>${esc(boton)}</button>`)
    h.el.querySelector('[data-guardar]').onclick = seguro(async () => {
      const v = {}
      h.el.querySelectorAll('[name]').forEach((x) => { v[x.name] = x.value.trim() })
      await alGuardar(v)
      h.cerrar()
    })
    return h
  }

  function editarObjetivo(f, o) {
    const opciones = datos.atributos.map((a) => `<option value="${esc(a.id)}"${o && a.id === o.atributoId ? ' selected' : ''}>${esc(a.nombre)}</option>`).join('')
    formulario(o ? 'Editar objetivo' : `Nuevo objetivo · fase ${f.numero}`, `
      <div class="campo"><label>Objetivo</label><input name="titulo" maxlength="200" value="${esc(o ? o.titulo : '')}" placeholder="Ej.: Entrenar 3 veces por semana"></div>
      <div class="campo"><label>Atributo</label><select name="atributoId">${opciones}</select></div>
      <div class="campo"><label>Indicador medible</label><input name="indicador" maxlength="300" value="${esc(o ? o.indicador : '')}" placeholder="Ej.: entrenamientos hechos / previstos"></div>
      <div class="rejilla-2">
        <div class="campo"><label>Línea de base</label><input name="lineaBase" maxlength="100" value="${esc(o ? o.lineaBase : '')}" placeholder="Ej.: 1/3"></div>
        <div class="campo"><label>Meta</label><input name="meta" maxlength="100" value="${esc(o ? o.meta : '')}" placeholder="Ej.: 3/3"></div>
      </div>`, async (v) => {
      if (v.titulo.length < 3 || v.indicador.length < 3) throw new Error('Escribí el objetivo y cómo se mide (3 letras o más).')
      pintar(o ? await api(`/api/ciclo/objetivos/${idUrl(o.id)}`, v, 'PUT') : await api('/api/ciclo/objetivos', { ...v, faseNumero: f.numero }))
      avisar('Objetivo guardado', { tipo: 'ok' })
    })
  }

  function editarFase(f) {
    formulario(`Fase ${f.numero}`, `
      <div class="campo"><label>Foco</label><input name="foco" maxlength="200" value="${esc(f.foco)}"></div>
      <div class="campo"><label>Qué se mide</label><textarea name="queSeMide" rows="3" maxlength="2000">${esc(f.queSeMide || '')}</textarea></div>`,
    async (v) => {
      if (v.foco.length < 2) throw new Error('Escribí el foco de la fase.')
      pintar(await api(`/api/ciclo/fases/${idUrl(f.id)}`, v, 'PUT'))
      avisar('Fase guardada', { tipo: 'ok' })
    })
  }

  function cerrarFase(f, esUltima) {
    const objs = f.objetivos.map((o) => `<div class="campo"><label>${esc(o.titulo)}</label><input name="r:${esc(o.id)}" maxlength="500" value="${esc(o.resultado || '')}" placeholder="Resultado real">
      <span class="ayuda">${esc(o.indicador)}${o.lineaBase ? ' · base ' + esc(o.lineaBase) : ''}${o.meta ? ' · meta ' + esc(o.meta) : ''}</span></div>`).join('')
    formulario(esUltima ? 'Cerrar el ciclo' : `Cerrar la fase ${f.numero}`, `
      ${objs || '<p class="chico texto-3">No definiste objetivos para esta fase.</p>'}
      <div class="campo"><label>Qué aprendí y qué ajusto</label><textarea name="notas" rows="4" maxlength="4000"></textarea></div>
      ${esUltima ? '<p class="ayuda">Después podés empezar un ciclo nuevo. Nivel, XP e historial se conservan.</p>' : ''}`,
    async (v) => {
      const resultados = {}
      for (const [k, x] of Object.entries(v)) if (k.startsWith('r:')) resultados[k.slice(2)] = x
      pintar(await api(`/api/ciclo/fases/${idUrl(f.id)}/cerrar`, { notas: v.notas, resultados }))
      avisar(esUltima ? 'Ciclo cerrado. Cuando quieras, empezá uno nuevo.' : `Fase ${f.numero} cerrada`, { tipo: 'ok' })
    }, esUltima ? 'Cerrar ciclo' : 'Cerrar fase')
  }

  function pintar(r) {
    datos = r
    $('#cargando').hidden = true
    $('#sin-ciclo').hidden = !!r.ciclo
    const caja = $('#fases')
    if (!r.ciclo) { caja.innerHTML = ''; return }
    const nombreAtr = (id) => (r.atributos.find((a) => a.id === id) || {}).nombre || 'Sin atributo'
    caja.innerHTML = r.fases.map((f, i) => `<section class="tarjeta">
        <div class="tarjeta-cab"><h2><span class="${f.actual ? 'acento' : ''}">Fase ${f.numero} · días ${f.diaInicio}–${f.diaFin}</span></h2><button type="button" class="boton chico suave" data-fase="${i}" aria-label="Editar fase ${f.numero}">✎</button></div>
        <div class="chico"><b>${esc(f.foco)}</b>${f.queSeMide ? `<div class="texto-2">${esc(f.queSeMide)}</div>` : ''}<div class="texto-3 muy-chico">${esc(fechaLegible(f.desde))} a ${esc(fechaLegible(f.hasta))}</div></div>
        ${f.cerradaEn ? `<p class="chico ok" style="margin: 0;">✓ Cerrada${f.notasCierre ? ': ' + esc(f.notasCierre) : ''}</p>` : ''}
        ${f.objetivos.map((o, k) => `<div class="tarjeta compacta col" style="gap: 2px;">
          <div class="fila entre"><b class="chico crece">${esc(o.titulo)}</b><span class="fila" style="gap: 4px;"><button type="button" class="boton chico suave" data-editar="${i}:${k}" aria-label="Editar objetivo">✎</button><button type="button" class="boton chico suave" data-quitar="${i}:${k}" aria-label="Quitar objetivo">✕</button></span></div>
          <span class="muy-chico texto-3">${esc(nombreAtr(o.atributoId))} · ${esc(o.indicador)}${o.lineaBase ? ' · base ' + esc(o.lineaBase) : ''}${o.meta ? ' · meta ' + esc(o.meta) : ''}${o.resultado ? ' · resultado ' + esc(o.resultado) : ''}</span></div>`).join('')}
        <button type="button" class="boton chico" data-nuevo="${i}">+ Objetivo</button>
        ${f.sePuedeCerrar ? `<button type="button" class="boton primario ancho" data-cerrar="${i}">${i === r.fases.length - 1 ? 'Cerrar ciclo' : 'Cerrar fase'}</button>` : ''}
      </section>`).join('')
    const par = (s) => s.split(':').map(Number)
    caja.querySelectorAll('[data-fase]').forEach((b) => { b.onclick = () => editarFase(r.fases[Number(b.dataset.fase)]) })
    caja.querySelectorAll('[data-nuevo]').forEach((b) => { b.onclick = () => editarObjetivo(r.fases[Number(b.dataset.nuevo)], null) })
    caja.querySelectorAll('[data-cerrar]').forEach((b) => { const i = Number(b.dataset.cerrar); b.onclick = () => cerrarFase(r.fases[i], i === r.fases.length - 1) })
    caja.querySelectorAll('[data-editar]').forEach((b) => { const [i, k] = par(b.dataset.editar); b.onclick = () => editarObjetivo(r.fases[i], r.fases[i].objetivos[k]) })
    caja.querySelectorAll('[data-quitar]').forEach((b) => {
      const [i, k] = par(b.dataset.quitar), o = r.fases[i].objetivos[k]
      b.onclick = () => confirmar('¿Quitar objetivo?', `«${o.titulo}» se archiva y queda en el historial.`, 'Quitar', async () => {
        pintar(await api(`/api/ciclo/objetivos/${idUrl(o.id)}`, undefined, 'DELETE'))
      })
    })
  }

  seguro(async () => pintar(await api('/api/ciclo')))()
})()
