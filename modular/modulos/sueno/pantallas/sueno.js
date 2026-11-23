// Pantalla Sueño, igual que la v0.88.27 (Sueno.tsx de la app vieja) pero en HTML+JS.
// Anoche (tocar corrige), el gráfico de noches (semana, mes, ciclo), «Tu adaptación» con el samurái junto a la cama
// (escena.js), cómo vas mejorando y los ajustes del sueño. Pide todo a /api/sueno (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'sueno', companero: 'esquina' })
  if (window.SEK_ESCENA_SUENO) SEK_ESCENA_SUENO($('#escena'))

  const NOMBRE_FUENTE = { estimado: 'estimado', corregido: 'corregido', reloj: 'reloj' }
  const CAMPOS = [{ k: 'acostado', t: 'Me acosté' }, { k: 'dormido', t: 'Me dormí' }, { k: 'levantado', t: 'Me levanté' }]
  let r = null
  let rango = 'semana'
  let semanaViendo = null
  let editandoAdaptacion = false

  const hora = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const duracion = (min) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min` }
  const corta = (f) => fechaLegible(f).split(' ').slice(0, 2).join(' ')

  function pintar(d) {
    r = d
    if (d.modo) { location.href = '/sueno/modo'; return }
    pintarAnoche(d.anoche)
    for (const b of document.querySelectorAll('[data-rango]')) { const sel = b.dataset.rango === rango; b.classList.toggle('activo', sel); b.setAttribute('aria-selected', String(sel)) }
    $('#grafico').innerHTML = d.noches.length
      ? grafico(d.noches, [d.ajustes.horaDormido, d.ajustes.finVentana], d.adaptacion.etapas.length - 1)
        + `<p class="ayuda">Cada barra va de cuando te dormiste a cuando te levantaste; el punto es «Dejo celu» (verde si fue a tiempo). La franja verde es tu ventana ideal (${esc(d.ajustes.horaDormido)} a ${esc(d.ajustes.finVentana)}). Borde claro: corregida a mano. Tocá una barra para corregirla.</p>`
      : '<p class="texto-2 chico">Con la primera noche registrada aparece acá el gráfico.</p>'
    pintarAdaptacion(d.adaptacion)
    pintarMejora(d.mejora)
  }

  function pintarAnoche(n) {
    if (!n) {
      $('#anoche-grande').textContent = 'Anoche · sin registro'
      $('#anoche-chica').className = 'muy-chico texto-3'
      $('#anoche-chica').textContent = 'Se completa solo con «Dejo celu» · tocá para cargarlo a mano'
      return
    }
    const dormido = n.dormidoRango ? hora((n.dormidoRango[0] + n.dormidoRango[1]) / 2) : hora(n.dormido)
    $('#anoche-grande').innerHTML = `Anoche · ${duracion(n.minutos)}${n.estimado ? '<span class="muy-chico texto-3"> aprox.</span>' : ''}`
    $('#anoche-chica').className = 'anoche-chica texto-2'
    $('#anoche-chica').innerHTML = `dejé el celu ${hora(n.acostado)} · dormido ${dormido} · desperté ${hora(n.levantado)} · ${n.cumplido ? '<span class="texto-verde">a horario ✓</span>' : '<span class="texto-3">tarde</span>'}${n.despertares ? ` · ${n.despertares === 3 ? '3+' : n.despertares} despertares` : ''}`
  }

  /** Una barra por noche sobre un eje de 20:00 a 08:00 (como GraficoNoches de la vieja). */
  function grafico(noches, ventana, ultimaEtapa) {
    const min = 20 * 60, max = 32 * 60, W = 340, x0 = 46
    const fila = noches.length > 16 ? 11 : 20
    const alto = fila - 6
    const H = fila * noches.length + 22
    const x = (m) => ((Math.max(min, Math.min(max, m)) - min) / (max - min)) * (W - x0 - 4) + x0
    const aMin = (hm) => { const [h, m] = hm.split(':').map(Number); const t = h * 60 + m; return t < 12 * 60 ? t + 1440 : t }
    const v0 = x(aMin(ventana[0])), v1 = x(aMin(ventana[1]))
    const cada = noches.length > 16 ? 5 : 1
    let s = `<svg class="sueno-grafico" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Sueño de ${noches.length} noches">`
    s += `<rect x="${v0}" y="0" width="${Math.max(0, v1 - v0)}" height="${H - 16}" class="sueno-ventana"/>`
    s += `<path d="M${v0},2 C${v0 + (v1 - v0) * 0.3},0 ${v0 + (v1 - v0) * 0.7},4 ${v1},1.5" class="sueno-trazo"/>`
    s += `<path d="M${v0},${H - 18} C${v0 + (v1 - v0) * 0.4},${H - 16} ${v0 + (v1 - v0) * 0.6},${H - 20} ${v1},${H - 17.5}" class="sueno-trazo"/>`
    for (const h of [20, 22, 24, 26, 28, 30, 32]) s += `<g><line x1="${x(h * 60)}" y1="0" x2="${x(h * 60)}" y2="${H - 16}" class="sueno-eje"/><text x="${x(h * 60)}" y="${H - 4}" text-anchor="middle" class="sueno-hora">${String(h % 24).padStart(2, '0')}</text></g>`
    noches.forEach((n, i) => {
      const y = 3 + i * fila
      const clase = n.reloj ? 'reloj' : n.corregido ? 'corregida' : 'estimada'
      const etapa = n.etapa < 0 || n.etapa === undefined ? '' : n.etapa === 0 ? 'acostumbrando' : n.etapa === ultimaEtapa ? 'estable' : 'asentando'
      s += `<g class="sueno-noche" role="button" tabindex="0" data-noche="${n.noche}" aria-label="${esc(corta(n.noche))}: ${duracion(n.minutos)}. Tocá para corregir">`
      s += `<rect x="0" y="${y - 2}" width="${W}" height="${fila}" fill="transparent"/>`
      if (etapa) s += `<rect x="${x0}" y="${y - 2}" width="${W - x0 - 4}" height="${fila}" class="sueno-etapa ${etapa}"/>`
      if (i % cada === 0) s += `<text x="0" y="${y + alto - 3}" class="sueno-hora">${esc(corta(n.noche))}</text>`
      s += `<rect x="${x(n.dormido)}" y="${y}" width="${Math.max(3, x(n.levantado) - x(n.dormido))}" height="${alto}" rx="${alto / 2.5}" class="sueno-barra ${clase}"/>`
      s += `<circle cx="${x(n.acostado)}" cy="${y + alto / 2}" r="${Math.min(3, alto / 3)}" class="sueno-punto${n.cumplido ? ' ok' : ''}"/></g>`
    })
    return s + '</svg>'
  }

  // ---------- Tu adaptación: tira de etapas, lo que dice el shinobi y todo editable ----------
  function pintarAdaptacion(ad) {
    const actual = ad.actual.semana
    if (semanaViendo === null) semanaViendo = actual
    const total = ad.ultimaSemana
    let acum = 0
    const tramos = ad.etapas.map((e, i) => { const desde = acum + 1; const semanas = i === ad.etapas.length - 1 || e.semanas <= 0 ? 1 : e.semanas; acum += semanas; return { i, nombre: e.nombre, desde, semanas } })
    const pos = (w) => `${((Math.min(total, Math.max(1, w)) - 0.5) / total) * 100}%`
    const viendo = etapaDe(semanaViendo, ad.etapas)
    let h = tramos.map((t) => `<div class="sh-tramo ${t.i < ad.actual.indice ? 'pasado' : t.i === ad.actual.indice ? 'actual' : ''}" style="flex-grow: ${t.semanas};"><span class="sh-tramo-nombre">${esc(t.nombre)}</span></div>`).join('')
    h += tramos.filter((t) => t.i > ad.actual.indice).map((t) => `<button type="button" class="sh-etapa-boton ${viendo === t.i && semanaViendo !== actual ? 'viendo' : ''}" data-semana="${t.desde}" style="left: ${pos(t.desde)};" aria-label="Qué pasa en ${esc(t.nombre)}"></button>`).join('')
    h += `<button type="button" class="sh-marca ${semanaViendo === actual ? 'viendo' : ''}" data-semana="${actual}" style="left: ${pos(actual)};" aria-label="Estás en la semana ${actual}: volver a hoy"></button>`
    $('#etapas-barra').innerHTML = h
    const d = discurso(semanaViendo, ad.etapas)
    const titulo = d.titulo.charAt(0).toLowerCase() + d.titulo.slice(1)
    $('#discurso').innerHTML = `<b>${semanaViendo === actual ? 'Hoy' : 'Más adelante'}, ${esc(titulo)}.</b> ${esc(d.texto)}`
    pintarFormAdaptacion(ad)
  }

  function etapaDe(semana, etapas) {
    let acum = 0, i = 0
    for (; i < etapas.length - 1; i++) { if (etapas[i].semanas <= 0 || semana <= acum + etapas[i].semanas) break; acum += etapas[i].semanas }
    return i
  }

  /** Lo que te cuenta el shinobi de una semana (igual que calculo.discursoDeSemana del módulo). */
  function discurso(semana, etapas) {
    const i = etapaDe(semana, etapas)
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

  function pintarFormAdaptacion(ad) {
    const f = $('#form-adaptacion')
    f.hidden = !editandoAdaptacion
    $('#editar-adaptacion').textContent = editandoAdaptacion ? 'Cerrar' : 'Editar'
    if (!editandoAdaptacion) return
    const hoy = r.noche || new Date().toISOString().slice(0, 10)
    f.innerHTML = `
      <div class="campo"><label for="ad-desde">Empecé a mejorar mi sueño el</label><input id="ad-desde" type="date" value="${esc(ad.inicio)}" max="${esc(hoy)}"></div>
      ${ad.etapas.map((e, i) => `
        <div class="sueno-etapa-edicion" data-i="${i}">
          <input aria-label="Nombre de la etapa ${i + 1}" data-k="nombre" value="${esc(e.nombre)}">
          <div class="rejilla-2">
            <div class="campo"><label for="ad-sem-${i}">Semanas${i === ad.etapas.length - 1 ? ' (0 = sin fin)' : ''}</label><input id="ad-sem-${i}" data-k="semanas" type="number" inputmode="numeric" min="0" max="12" value="${e.semanas}"></div>
            <div class="campo"><label for="ad-desp-${i}">Despertares normales</label><input id="ad-desp-${i}" data-k="despertaresNormales" type="number" inputmode="numeric" min="0" max="5" value="${e.despertaresNormales}"></div>
            <div class="campo"><label for="ad-min-${i}">Horas mínimas</label><input id="ad-min-${i}" data-k="horasMin" type="number" inputmode="decimal" step="0.5" min="3" max="14" value="${e.horasMin}"></div>
            <div class="campo"><label for="ad-max-${i}">Horas máximas</label><input id="ad-max-${i}" data-k="horasMax" type="number" inputmode="decimal" step="0.5" min="3" max="14" value="${e.horasMax}"></div>
          </div>
        </div>`).join('')}
      <div class="campo"><label for="ad-tol">«A horario»: minutos de tolerancia después de «Dejo celu»</label><input id="ad-tol" type="number" inputmode="numeric" min="0" max="120" value="${ad.tolerancia}" style="width: 110px;"></div>
      <div class="rejilla-2">
        <button type="button" class="boton" data-restaurar>Restaurar lo sugerido</button>
        <button type="button" class="boton primario" data-guardar>Guardar</button>
      </div>`
    f.querySelector('[data-guardar]').onclick = seguro(async () => {
      const desde = $('#ad-desde').value
      if (!/^\d{4}-\d\d-\d\d$/.test(desde) || desde > hoy) return avisar('La fecha de inicio tiene que ser de hoy para atrás', { tipo: 'bajo' })
      const etapas = [...f.querySelectorAll('.sueno-etapa-edicion')].map((x) => {
        const e = {}
        for (const inp of x.querySelectorAll('[data-k]')) e[inp.dataset.k] = inp.dataset.k === 'nombre' ? inp.value : Number(inp.value)
        return e
      })
      const tol = Math.max(0, Math.min(120, Math.round(Number($('#ad-tol').value) || 0)))
      const d = await api(`/api/sueno/adaptacion?rango=${rango}`, { desde, toleranciaMinutos: tol, etapas }, 'PUT')
      editandoAdaptacion = false
      semanaViendo = null
      pintar(d)
      avisar('Adaptación guardada', { tipo: 'ok' })
    })
    f.querySelector('[data-restaurar]').onclick = seguro(async () => {
      const d = await api(`/api/sueno/adaptacion?rango=${rango}`, undefined, 'DELETE')
      editandoAdaptacion = false
      semanaViendo = null
      pintar(d)
      avisar('Volvió lo sugerido', { tipo: 'ok' })
    })
  }

  function pintarMejora(m) {
    const flecha = (ahora, antes, mejorEsMas) => {
      if (ahora === null || antes === null || Math.abs(ahora - antes) < 5) return ''
      const sube = ahora > antes
      const bien = sube === mejorEsMas
      return `<span class="sueno-flecha ${bien ? 'bien' : 'mal'}" aria-label="${bien ? 'mejor' : 'peor'} que la semana anterior">${sube ? '↑' : '↓'}</span>`
    }
    $('#cifras').innerHTML = `
      <div><b>${m.semana !== null ? duracion(m.semana) : '—'} ${flecha(m.semana, m.semanaAnterior, true)}</b><span>por noche esta semana${m.semanaAnterior !== null ? ` (antes ${duracion(m.semanaAnterior)})` : ''}</span></div>
      <div><b>${m.regularidad !== null ? `±${m.regularidad} min` : '—'} ${flecha(m.regularidad, m.regularidadAnterior, false)}</b><span>cuánto varía la hora de dormirte (menos es mejor)</span></div>
      <div><b>${m.racha}</b><span>${m.racha === 1 ? 'noche seguida' : 'noches seguidas'} a horario</span></div>`
  }

  // ---------- Corregir una noche ----------
  function editarNoche(noche, n) {
    const h = hoja(`Noche del ${fechaLegible(noche)}`, `
      ${CAMPOS.map((c) => `
        <div class="campo">
          <label for="sueno-${c.k}">${c.t}${n ? `<span class="texto-3"> · ${NOMBRE_FUENTE[n.fuentes[c.k]] || ''}</span>` : ''}</label>
          <input id="sueno-${c.k}" type="time" data-k="${c.k}" value="${n ? hora(n[c.k]) : ''}">
          ${n && n.fuentes[c.k] === 'corregido' ? `<button type="button" class="enlace chico" data-volver="${c.k}">Volver a lo estimado</button>` : ''}
          ${c.k === 'dormido' && n && n.dormidoRango ? `<span class="ayuda">Estimado entre ${hora(n.dormidoRango[0])} y ${hora(n.dormidoRango[1])}.</span>` : ''}
        </div>`).join('')}
      <div class="campo">
        <label for="sueno-despertares">¿Te despertaste? <span class="texto-3">· opcional</span></label>
        <select id="sueno-despertares">
          <option value="">No lo cargo</option>
          <option value="0">No, dormí de corrido</option>
          <option value="1">1 vez</option>
          <option value="2">2 veces</option>
          <option value="3">3 o más</option>
        </select>
        <span class="ayuda">Si lo cargás, entra en el veredicto de la noche según tu etapa de adaptación. Si no, no se asume nada.</span>
      </div>
      ${!n ? '<p class="ayuda">Si no ponés «me dormí», se calcula con tu latencia. Una noche cargada a mano no cuenta para «Dormir a horario».</p>' : ''}
      <button class="boton primario ancho" data-guardar>Guardar</button>`)
    const dAntes = n && n.despertares !== undefined && n.despertares !== null ? String(n.despertares) : ''
    h.el.querySelector('#sueno-despertares').value = dAntes
    h.el.querySelector('[data-guardar]').onclick = async () => {
      const cambios = {}
      for (const inp of h.el.querySelectorAll('input[data-k]')) {
        const antes = n ? hora(n[inp.dataset.k]) : ''
        if (inp.value && inp.value !== antes) cambios[inp.dataset.k] = inp.value
      }
      const dAhora = h.el.querySelector('#sueno-despertares').value
      if (dAhora !== dAntes) cambios.despertares = dAhora === '' ? null : Number(dAhora)
      if (!Object.keys(cambios).length) return h.cerrar()
      try {
        pintar(await api(`/api/sueno/noches/${noche}?rango=${rango}`, cambios, 'PUT'))
        avisar('Noche corregida', { tipo: 'ok' })
        h.cerrar()
      } catch (e) { avisar(e.message, { tipo: 'bajo' }) }
    }
    h.el.querySelectorAll('[data-volver]').forEach((b) => {
      b.onclick = seguro(async () => {
        pintar(await api(`/api/sueno/noches/${noche}/estimado?rango=${rango}`, { campo: b.dataset.volver }))
        avisar('Volvió a lo estimado')
        h.cerrar()
      })
    })
  }

  // ---------- Ajustes del sueño ----------
  function ajustes() {
    const a = r.ajustes
    const h = hoja('Ajustes del sueño', `
      <div class="rejilla-2">
        <div class="campo"><label for="aj-celu">Hora de «Dejo celu»</label><input id="aj-celu" type="time" value="${esc(a.horaDejarCelu)}"></div>
        <div class="campo"><label for="aj-lat">Minutos hasta dormirte</label><input id="aj-lat" type="number" inputmode="numeric" min="${a.latenciaMin}" max="${a.latenciaMax}" value="${a.latenciaDormirseMinutos}"><span class="ayuda">De ${a.latenciaMin} a ${a.latenciaMax}. Se muestra como rango de ±5.</span></div>
        <div class="campo"><label for="aj-vent">Me levanto entre</label><input id="aj-vent" type="time" value="${esc(a.horaFinSuenio)}"><span class="ayuda">y las ${esc(a.finVentana)}. Se usa el centro.</span></div>
        <div class="campo"><label for="aj-obj">Objetivo (horas)</label><input id="aj-obj" type="number" inputmode="decimal" step="0.5" min="4" max="12" value="${a.objetivoSuenioHoras}"></div>
      </div>
      <label class="fila chico texto-3" style="gap: 8px; margin-top: 4px;"><input type="checkbox" disabled> Reloj inteligente: no conectado (próximamente)</label>
      <button class="boton primario ancho" data-guardar>Guardar</button>`)
    const v = (id) => h.el.querySelector(id).value
    h.el.querySelector('[data-guardar]').onclick = async () => {
      try {
        if (!/^\d\d:\d\d$/.test(v('#aj-celu')) || !/^\d\d:\d\d$/.test(v('#aj-vent'))) throw new Error('Revisá las horas (HH:MM)')
        const objetivo = Number(v('#aj-obj'))
        if (!(objetivo >= 4 && objetivo <= 12)) throw new Error('El objetivo va de 4 a 12 horas')
        pintar(await api(`/api/sueno/ajustes?rango=${rango}`, { horaDejarCelu: v('#aj-celu'), latenciaDormirseMinutos: Math.round(Number(v('#aj-lat'))), horaFinSuenio: v('#aj-vent'), objetivoSuenioHoras: objetivo }, 'PUT'))
        avisar('Guardado. Vale de esta noche en adelante.', { tipo: 'ok' })
        h.cerrar()
      } catch (e) { avisar(e.message, { tipo: 'bajo' }) }
    }
  }

  async function cargar() { pintar(await api(`/api/sueno?rango=${rango}`)) }

  // ---------- Eventos ----------
  $('#anoche').onclick = () => { if (r) editarNoche(r.anoche ? r.anoche.noche : r.anocheFecha, r.anoche) }
  for (const b of document.querySelectorAll('[data-rango]')) b.onclick = seguro(async () => { rango = b.dataset.rango; await cargar() })
  const elegirBarra = (ev) => {
    const g = ev.target.closest('[data-noche]')
    if (!g || !r) return
    const n = r.noches.find((x) => x.noche === g.dataset.noche)
    if (n) editarNoche(n.noche, n)
  }
  $('#grafico').addEventListener('click', elegirBarra)
  $('#grafico').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') elegirBarra(ev) })
  $('#etapas-barra').addEventListener('click', (ev) => {
    const s = ev.target.dataset && ev.target.dataset.semana
    if (s && r) { semanaViendo = Number(s); pintarAdaptacion(r.adaptacion) }
  })
  $('#editar-adaptacion').onclick = () => { if (!r) return; editandoAdaptacion = !editandoAdaptacion; pintarFormAdaptacion(r.adaptacion) }
  $('#abrir-ajustes').onclick = () => { if (r) ajustes() }

  seguro(cargar)()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) seguro(cargar)() })
})()
