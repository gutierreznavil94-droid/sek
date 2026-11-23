// Pantalla de Sueño. Pide todo a /api/sueno (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje, evento } = SEK
  const CLAVE_AVISO = 'sek-dormir-cerrado'
  const NOMBRE_FUENTE = { estimado: 'estimado', corregido: 'corregido', reloj: 'reloj' }
  const CAMPOS = [{ k: 'acostado', t: 'Me acosté' }, { k: 'dormido', t: 'Me dormí' }, { k: 'levantado', t: 'Me levanté' }]
  let r = null
  let rango = 'semana'
  let editando = null // { noche, n }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const hora = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const duracion = (min) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min` }
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const fechaCorta = (f) => { const [a, m, d] = f.split('-').map(Number); return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d}` }
  const fechaLarga = (f) => { const [, m, d] = f.split('-').map(Number); return `${fechaCorta(f)} ${MESES[m - 1]}` }
  const avisoCerrado = (noche) => { try { return localStorage.getItem(CLAVE_AVISO) === noche } catch (e) { return false } }

  function pintar(d) {
    r = d
    if (d.modo) { location.href = '/sueno/modo'; return }
    // Aviso para alistarse (tocar lo cierra por esta noche: vive en el teléfono)
    $('#aviso').hidden = !(d.aviso.mostrar && !avisoCerrado(d.aviso.noche))
    $('#aviso').textContent = d.aviso.frase + ' (tocá para cerrar)'
    // Esta noche
    $('#noche-hora').textContent = `«Dejo celu» a las ${d.ajustes.horaDejarCelu}`
    const e = d.estaNoche
    $('#noche-estado').innerHTML = e
      ? (e.cumplido ? `<span class="ok">Dejaste el celu a las ${e.hora}: a horario ✓</span>` : `<span class="aviso">Dejaste el celu a las ${e.hora}: ${e.retrasoMinutos} min tarde</span>`)
      : `Tocalo cuando dejes el celu. A tiempo da +${d.ajustes.xpDejoCelu} XP; después de las ${d.ajustes.horaLimiteCelu} ya no se registra.`
    $('#dejo-celu').hidden = !!e
    $('#deshacer').hidden = !e
    // Anoche
    const n = d.anoche
    if (n) {
      const dormido = n.dormidoRango ? hora((n.dormidoRango[0] + n.dormidoRango[1]) / 2) : hora(n.dormido)
      $('#anoche-grande').innerHTML = `Anoche · ${duracion(n.minutos)}${n.estimado ? ' <span class="apagado chico">aprox.</span>' : ''}`
      $('#anoche-chica').innerHTML = `dejé el celu ${hora(n.acostado)} · dormido ${dormido} · desperté ${hora(n.levantado)} · ${n.cumplido ? '<span class="ok">a horario ✓</span>' : '<span class="apagado">tarde</span>'}${n.despertares ? ` · ${n.despertares === 3 ? '3+' : n.despertares} despertares` : ''}`
      $('#anoche-veredicto').hidden = false
      $('#anoche-veredicto').textContent = n.veredicto.texto
      $('#anoche-veredicto').className = 'chico veredicto ' + n.veredicto.tono
    } else {
      $('#anoche-grande').textContent = 'Anoche · sin registro'
      $('#anoche-chica').textContent = 'Se completa solo con «Dejo celu» · tocá para cargarlo a mano'
      $('#anoche-veredicto').hidden = true
    }
    // Gráfico
    for (const b of document.querySelectorAll('[data-rango]')) { const sel = b.dataset.rango === d.rango; b.classList.toggle('activo', sel); b.setAttribute('aria-selected', sel) }
    $('#grafico').innerHTML = d.noches.length ? grafico(d.noches, [d.ajustes.horaDormido, d.ajustes.finVentana], d.adaptacion.etapas.length - 1) : '<p class="chico">Con la primera noche registrada aparece acá el gráfico.</p>'
    $('#grafico-ayuda').textContent = d.noches.length ? `Cada barra va de cuando te dormiste a cuando te levantaste; el punto es «Dejo celu» (verde si fue a tiempo). La franja verde es tu ventana ideal (${d.ajustes.horaDormido} a ${d.ajustes.finVentana}). Borde claro: corregida a mano. Tocá una barra para corregirla.` : ''
    pintarAdaptacion(d.adaptacion)
    pintarMejora(d.mejora)
  }

  /** Una barra por noche sobre un eje de 20:00 a 08:00 (SVG). */
  function grafico(noches, ventana, ultimaEtapa) {
    const min = 20 * 60, max = 32 * 60, W = 340, x0 = 46
    const fila = noches.length > 16 ? 11 : 20
    const alto = fila - 6
    const H = fila * noches.length + 22
    const x = (m) => ((Math.max(min, Math.min(max, m)) - min) / (max - min)) * (W - x0 - 4) + x0
    const aMin = (hm) => { const [h, m] = hm.split(':').map(Number); const t = h * 60 + m; return t < 12 * 60 ? t + 1440 : t }
    const v0 = aMin(ventana[0]), v1 = aMin(ventana[1])
    const cada = noches.length > 16 ? 5 : 1
    let s = `<svg class="grafico" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Sueño de ${noches.length} noches">`
    s += `<rect x="${x(v0)}" y="0" width="${Math.max(0, x(v1) - x(v0))}" height="${H - 16}" class="g-ventana"/>`
    for (const h of [20, 22, 24, 26, 28, 30, 32]) s += `<line x1="${x(h * 60)}" y1="0" x2="${x(h * 60)}" y2="${H - 16}" class="g-eje"/><text x="${x(h * 60)}" y="${H - 4}" text-anchor="middle" class="g-hora">${String(h % 24).padStart(2, '0')}</text>`
    noches.forEach((n, i) => {
      const y = 3 + i * fila
      const clase = n.reloj ? 'reloj' : n.corregido ? 'corregida' : 'estimada'
      const etapa = n.etapa === 0 ? 'acostumbrando' : n.etapa === ultimaEtapa ? 'estable' : 'asentando'
      s += `<g class="g-noche" role="button" tabindex="0" data-noche="${n.noche}" aria-label="${fechaCorta(n.noche)}: ${duracion(n.minutos)}. Tocá para corregir">`
      s += `<rect x="0" y="${y - 2}" width="${W}" height="${fila}" fill="transparent"/>`
      s += `<rect x="${x0}" y="${y - 2}" width="${W - x0 - 4}" height="${fila}" class="g-etapa ${etapa}"/>`
      if (i % cada === 0) s += `<text x="0" y="${y + alto - 3}" class="g-hora">${fechaCorta(n.noche)}</text>`
      s += `<rect x="${x(n.dormido)}" y="${y}" width="${Math.max(3, x(n.levantado) - x(n.dormido))}" height="${alto}" rx="${alto / 2.5}" class="g-barra ${clase}"/>`
      s += `<circle cx="${x(n.acostado)}" cy="${y + alto / 2}" r="${Math.min(3, alto / 3)}" class="g-punto${n.cumplido ? ' ok' : ''}"/></g>`
    })
    return s + '</svg>'
  }

  // ---------- Adaptación ----------
  let semanaViendo = null
  function pintarAdaptacion(ad) {
    const actual = ad.actual.semana
    if (semanaViendo === null) semanaViendo = actual
    const total = ad.ultimaSemana
    let acum = 0
    const tramos = ad.etapas.map((e, i) => { const desde = acum + 1; const semanas = i === ad.etapas.length - 1 || e.semanas <= 0 ? 1 : e.semanas; acum += semanas; return { i, nombre: e.nombre, desde, semanas } })
    const pos = (w) => `${((Math.min(total, Math.max(1, w)) - 0.5) / total) * 100}%`
    let h = tramos.map((t) => `<div class="sh-tramo ${t.i < ad.actual.indice ? 'pasado' : t.i === ad.actual.indice ? 'actual' : ''}" style="flex-grow:${t.semanas}"><span>${esc(t.nombre)}</span></div>`).join('')
    h += tramos.filter((t) => t.i > ad.actual.indice).map((t) => `<button type="button" class="sh-punto" data-semana="${t.desde}" style="left:${pos(t.desde)}" aria-label="Qué pasa en ${esc(t.nombre)}"></button>`).join('')
    h += `<button type="button" class="sh-marca" data-semana="${actual}" style="left:${pos(actual)}" aria-label="Estás en la semana ${actual}: volver a hoy"></button>`
    $('#etapas-barra').innerHTML = h
    const d = discurso(semanaViendo, ad.etapas)
    const titulo = d.titulo.charAt(0).toLowerCase() + d.titulo.slice(1)
    $('#discurso').innerHTML = `<b>${semanaViendo === actual ? 'Hoy' : 'Más adelante'}, ${esc(titulo)}.</b> ${esc(d.texto)}`
    // Formulario
    $('#ad-desde').value = ad.inicio
    $('#ad-tol').value = ad.tolerancia
    $('#ad-etapas').innerHTML = ad.etapas.map((e, i) => `
      <fieldset class="etapa-edicion" data-i="${i}">
        <input aria-label="Nombre de la etapa ${i + 1}" data-k="nombre" value="${esc(e.nombre)}">
        <div class="rejilla-2">
          <label>Semanas${i === ad.etapas.length - 1 ? ' (0 = sin fin)' : ''} <input type="number" data-k="semanas" min="0" max="12" inputmode="numeric" value="${e.semanas}"></label>
          <label>Despertares normales <input type="number" data-k="despertaresNormales" min="0" max="5" inputmode="numeric" value="${e.despertaresNormales}"></label>
          <label>Horas mínimas <input type="number" data-k="horasMin" step="0.5" min="3" max="14" inputmode="decimal" value="${e.horasMin}"></label>
          <label>Horas máximas <input type="number" data-k="horasMax" step="0.5" min="3" max="14" inputmode="decimal" value="${e.horasMax}"></label>
        </div>
      </fieldset>`).join('')
  }

  /** Lo que te cuenta el shinobi de una semana (igual que calculo.discursoDeSemana del servidor). */
  function discurso(semana, etapas) {
    let acum = 0, i = 0
    for (; i < etapas.length - 1; i++) { if (etapas[i].semanas <= 0 || semana <= acum + etapas[i].semanas) break; acum += etapas[i].semanas }
    const e = etapas[i]
    const ultima = i === etapas.length - 1
    const h = (n) => String(n).replace('.', ',')
    const esperado = `Esperá ${h(e.horasMin)} a ${h(e.horasMax)} h`
    const d = e.despertaresNormales
    const desp = d === 0 ? 'ya casi no deberías despertarte' : d === 1 ? 'despertarte una vez es normal' : `despertarte hasta ${d} veces es normal`
    const titulo = `Semana ${semana} · ${e.nombre}`
    if (i === 0) return { titulo, texto: `Lo importante es acostarte a horario. ${esperado}; ${desp}. Si dormís menos, no pasa nada: el cuerpo se está acostumbrando.` }
    if (!ultima) return { titulo, texto: `El cuerpo se asienta. ${esperado}; ${desp}. Si hay varias noches cortas seguidas, fijate qué las cambia.` }
    return { titulo, texto: `Ya es tu ritmo. ${esperado}; ${desp}. Una noche mala suelta ya no es adaptación: buscá la causa.` }
  }

  function pintarMejora(m) {
    const flecha = (ahora, antes, mejorEsMas) => {
      if (ahora === null || antes === null || Math.abs(ahora - antes) < 5) return ''
      const sube = ahora > antes
      const bien = sube === mejorEsMas
      return ` <span class="${bien ? 'ok' : 'mal'}" aria-label="${bien ? 'mejor' : 'peor'} que la semana anterior">${sube ? '↑' : '↓'}</span>`
    }
    $('#cifras').innerHTML = `
      <div><b>${m.semana !== null ? duracion(m.semana) : '—'}${flecha(m.semana, m.semanaAnterior, true)}</b><span>por noche esta semana${m.semanaAnterior !== null ? ` (antes ${duracion(m.semanaAnterior)})` : ''}</span></div>
      <div><b>${m.regularidad !== null ? `±${m.regularidad} min` : '—'}${flecha(m.regularidad, m.regularidadAnterior, false)}</b><span>cuánto varía la hora de dormirte (menos es mejor)</span></div>
      <div><b>${m.racha}</b><span>${m.racha === 1 ? 'noche seguida' : 'noches seguidas'} a horario</span></div>`
  }

  // ---------- Editar una noche ----------
  function abrirNoche(noche, n) {
    editando = { noche, n }
    $('#dlg-noche-titulo').textContent = `Noche del ${fechaLarga(noche)}`
    $('#campos-noche').innerHTML = CAMPOS.map((c) => `
      <label>${c.t}${n ? ` <span class="apagado">· ${NOMBRE_FUENTE[n.fuentes[c.k]]}</span>` : ''}
        <input type="time" data-k="${c.k}" value="${n ? hora(n[c.k]) : ''}">
        ${n && n.fuentes[c.k] === 'corregido' ? `<button type="button" class="enlace" data-volver="${c.k}">Volver a lo estimado</button>` : ''}
        ${c.k === 'dormido' && n && n.dormidoRango ? `<span class="apagado">Estimado entre ${hora(n.dormidoRango[0])} y ${hora(n.dormidoRango[1])}.</span>` : ''}
      </label>`).join('')
    $('#n-despertares').value = n && n.despertares !== undefined && n.despertares !== null ? String(n.despertares) : ''
    $('#n-ayuda-nueva').hidden = !!n
    $('#dlg-noche').showModal()
  }

  async function guardarNoche() {
    const { noche, n } = editando
    const cambios = {}
    for (const inp of document.querySelectorAll('#campos-noche input[data-k]')) {
      const antes = n ? hora(n[inp.dataset.k]) : ''
      if (inp.value && inp.value !== antes) cambios[inp.dataset.k] = inp.value
    }
    const dAntes = n && n.despertares !== undefined && n.despertares !== null ? String(n.despertares) : ''
    const dAhora = $('#n-despertares').value
    if (dAhora !== dAntes) cambios.despertares = dAhora === '' ? null : Number(dAhora)
    if (!Object.keys(cambios).length) return
    pintar(await api(`/api/sueno/noches/${noche}?rango=${rango}`, cambios, 'PUT'))
    mensaje('Noche corregida')
  }

  async function cargar() { pintar(await api(`/api/sueno?rango=${rango}`)) }

  // ---------- Eventos ----------
  $('#dejo-celu').addEventListener('click', seguro(async () => {
    const x = await api('/api/sueno/dejo-celu', {})
    evento('dormir', { cumplido: x.cumplido })
    if (x.cumplido) evento('completar', { xp: x.xp })
    location.href = '/sueno/modo'
  }))
  $('#deshacer').addEventListener('click', seguro(async () => {
    pintar(await api('/api/sueno/deshacer', { noche: r.noche }))
    mensaje('«Dejo celu» deshecho')
  }))
  $('#aviso').addEventListener('click', () => { try { localStorage.setItem(CLAVE_AVISO, r.aviso.noche) } catch (e) { /* sin almacenamiento */ } $('#aviso').hidden = true })
  $('#anoche').addEventListener('click', () => abrirNoche(r.anoche ? r.anoche.noche : r.anocheFecha, r.anoche))
  for (const b of document.querySelectorAll('[data-rango]')) b.addEventListener('click', seguro(async () => { rango = b.dataset.rango; await cargar() }))
  const elegirBarra = (ev) => {
    const g = ev.target.closest('[data-noche]')
    if (!g) return
    const n = r.noches.find((x) => x.noche === g.dataset.noche)
    if (n) abrirNoche(n.noche, n)
  }
  $('#grafico').addEventListener('click', elegirBarra)
  $('#grafico').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') elegirBarra(ev) })

  $('#form-noche').addEventListener('submit', seguro(async (ev) => {
    if (ev.submitter && ev.submitter.value === 'guardar') { ev.preventDefault(); await guardarNoche(); $('#dlg-noche').close() }
  }))
  $('#campos-noche').addEventListener('click', seguro(async (ev) => {
    const k = ev.target.dataset && ev.target.dataset.volver
    if (!k) return
    pintar(await api(`/api/sueno/noches/${editando.noche}/estimado?rango=${rango}`, { campo: k }))
    $('#dlg-noche').close()
    mensaje('Volvió a lo estimado')
  }))

  $('#etapas-barra').addEventListener('click', (ev) => {
    const s = ev.target.dataset && ev.target.dataset.semana
    if (s) { semanaViendo = Number(s); pintarAdaptacion(r.adaptacion) }
  })
  $('#editar-adaptacion').addEventListener('click', () => {
    const f = $('#form-adaptacion')
    f.hidden = !f.hidden
    $('#editar-adaptacion').textContent = f.hidden ? 'Editar' : 'Cerrar'
  })
  $('#form-adaptacion').addEventListener('submit', seguro(async (ev) => {
    ev.preventDefault()
    const etapas = [...document.querySelectorAll('#ad-etapas fieldset')].map((fs) => {
      const e = {}
      for (const inp of fs.querySelectorAll('[data-k]')) e[inp.dataset.k] = inp.dataset.k === 'nombre' ? inp.value : Number(inp.value)
      return e
    })
    const d = await api('/api/sueno/adaptacion', { desde: $('#ad-desde').value || null, toleranciaMinutos: Number($('#ad-tol').value), etapas }, 'PUT')
    semanaViendo = null
    pintar(d)
    $('#form-adaptacion').hidden = true
    $('#editar-adaptacion').textContent = 'Editar'
    mensaje('Adaptación guardada')
  }))
  $('#ad-restaurar').addEventListener('click', seguro(async () => {
    semanaViendo = null
    pintar(await api('/api/sueno/adaptacion', undefined, 'DELETE'))
    $('#form-adaptacion').hidden = true
    $('#editar-adaptacion').textContent = 'Editar'
    mensaje('Volvió lo sugerido')
  }))

  $('#abrir-ajustes').addEventListener('click', () => {
    const a = r.ajustes
    $('#aj-celu').value = a.horaDejarCelu
    $('#aj-lat').value = a.latenciaDormirseMinutos
    $('#aj-lat').min = a.latenciaMin
    $('#aj-lat').max = a.latenciaMax
    $('#aj-vent').value = a.horaFinSuenio
    $('#aj-vent-fin').textContent = `y las ${a.finVentana}. Se usa el centro.`
    $('#aj-obj').value = a.objetivoSuenioHoras
    $('#dlg-ajustes').showModal()
  })
  $('#form-ajustes').addEventListener('submit', seguro(async (ev) => {
    if (!ev.submitter || ev.submitter.value !== 'guardar') return
    ev.preventDefault()
    pintar(await api('/api/sueno/ajustes', { horaDejarCelu: $('#aj-celu').value, latenciaDormirseMinutos: Number($('#aj-lat').value), horaFinSuenio: $('#aj-vent').value, objetivoSuenioHoras: Number($('#aj-obj').value) }, 'PUT'))
    $('#dlg-ajustes').close()
    mensaje('Guardado. Vale de esta noche en adelante.')
  }))

  barra('sueno')
  seguro(cargar)()
})()
