// Pantalla de Hábitos (Mi código): forja, reglas y caída. Pide todo a /api/habitos (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje, evento } = SEK
  const { piedra } = SEK_PIEDRA
  let r = null // el último resumen
  let vista = 'momento'
  try { vista = localStorage.getItem('habitos-vista') === 'area' ? 'area' : 'momento' } catch (e) { /* sin almacenamiento */ }

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const fechaCorta = (f) => { const [, m, d] = String(f).split('-'); return `${Number(d)}/${Number(m)}` }
  const NUMERALES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  /** Número de la regla a pincel: 一 … 十, 十一 … 二十; después, números comunes. */
  function numeral(n) {
    if (n <= 10) return NUMERALES[n - 1]
    if (n < 20) return `十${NUMERALES[n - 11]}`
    if (n === 20) return '二十'
    return String(n)
  }

  // ---------- Hoja (dialog) ----------
  const hoja = $('#hoja')
  function abrirHoja(titulo, html) {
    $('#hoja-titulo').textContent = titulo
    $('#hoja-cuerpo').innerHTML = html
    if (!hoja.open) hoja.showModal()
    return $('#hoja-cuerpo')
  }
  const cerrarHoja = () => { if (hoja.open) hoja.close() }
  // Enter en un campo no cierra la hoja: solo el ✕.
  hoja.querySelector('form').onsubmit = (e) => { if (!e.submitter || e.submitter.value !== 'cerrar') e.preventDefault() }

  // ---------- Forja ----------
  function habitoHtml(x) {
    const h = x.habito
    const e = x.estado
    const marcas = new Set(e.pedazosEn)
    let validos = 0
    const camino = e.camino.map((d, i) => {
      if (d.estado === 'cumplido' || d.estado === 'perdonado') validos++
      const pedazo = (d.estado === 'cumplido' || d.estado === 'perdonado') && marcas.has(validos)
      return `<i class="${d.estado} ${pedazo ? 'pedazo' : ''} ${i >= e.duracion ? 'extra' : ''}" title="${d.fecha}: ${d.estado}"></i>`
    }).join('')
    const nota = [
      e.completo ? 'Forjado' : `Faltan ${e.faltan}`,
      e.hechoHoy ? 'hoy ✓' : 'hoy sin marcar',
      e.perdonUsadoSemana ? 'falla perdonada usada esta semana' : 'tenés 1 falla perdonada esta semana',
      e.cerradas ? `${e.cerradas} grieta${e.cerradas > 1 ? 's' : ''} cerrada${e.cerradas > 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' · ')
    return `<div class="hb-habito" data-id="${esc(h.id)}">
      <button type="button" class="hb-piedra-boton" data-tocar aria-label="${esc(h.nombre)}: ${e.validos} de ${e.necesarios}. ${e.hechoHoy ? 'Hecho hoy, tocá para desmarcar' : 'Tocá si lo hiciste hoy'}">
        ${piedra({ kanji: h.kanji, validos: e.validos, necesarios: e.necesarios, pedazos: e.pedazos, hechoHoy: e.hechoHoy })}
      </button>
      <div class="hb-datos">
        <b>${esc(h.nombre)}</b>
        <span class="chico">Día ${Math.min(e.diaActual, e.duracion)} de ${e.duracion} · <b>${e.validos}</b> / ${e.necesarios} válidos</span>
        <span class="chico apagado">${nota}</span>
        <div class="hb-camino" role="img" aria-label="Camino de la forja">${camino}</div>
        <button type="button" class="hb-opciones" data-opciones>Opciones</button>
      </div>
    </div>`
  }

  function pintarForja() {
    const f = r.forja
    $('#en-forja').innerHTML = f.enForja.map(habitoHtml).join('')
    $('#forja-vacia').hidden = f.enForja.length > 0
    $('#forjados-tarjeta').hidden = !f.forjados.length
    $('#forjados').innerHTML = f.forjados.map((x) => `<li><span class="kanji" aria-hidden="true">${esc(x.habito.kanji)}</span><span>${esc(x.habito.nombre)}</span><span class="chico apagado">forjado el ${fechaCorta(x.habito.forjadoEn)}</span></li>`).join('')
    for (const el of document.querySelectorAll('.hb-habito')) {
      const id = el.dataset.id
      const x = f.enForja.find((y) => y.habito.id === id)
      el.querySelector('[data-tocar]').onclick = seguro(() => tocar(x, el))
      el.querySelector('[data-opciones]').onclick = () => opcionesHabito(x)
    }
  }

  async function tocar(x, el) {
    const { resultado: res, resumen } = await api(`/api/habitos/forja/${encodeURIComponent(x.habito.id)}/tocar`, {})
    const h = x.habito
    if (res.marcado) {
      evento('forja-paso', { elemento: el, texto: h.nombre })
      if (res.forjado) {
        evento('forja-completa', { elemento: el, texto: h.nombre })
        mensaje(`${h.kanji} ${h.nombre}: forjado. +${res.xp} XP`)
      } else {
        if (res.pedazo) evento('forja-pedazo', { elemento: el, texto: h.nombre })
        mensaje(`${h.nombre}: día ${res.estado.validos} de ${res.estado.necesarios}${res.xp ? ` · +${res.xp} XP` : ''}`)
      }
      if (res.nuevoNivel) evento('logro', { nivel: res.nuevoNivel })
    } else mensaje(`${h.nombre}: desmarcado hoy`)
    pintar(resumen)
  }

  function opcionesHabito(x) {
    const h = x.habito
    const c = abrirHoja(`${h.kanji} ${h.nombre}`, `
      <p class="chico">Tocá la piedra para marcar el día; tocá de nuevo hoy para desmarcarlo.</p>
      <label>Nombre <input name="nombre" maxlength="80" value="${esc(h.nombre)}"></label>
      <label>Kanji <input name="kanji" maxlength="4" value="${esc(h.kanji)}"></label>
      <button type="button" class="principal" data-guardar>Guardar</button>
      <button type="button" class="peligro" data-abandonar>Abandonar este hábito</button>`)
    c.querySelector('[data-guardar]').onclick = seguro(async () => {
      pintar(await api(`/api/habitos/forja/${encodeURIComponent(h.id)}`, { nombre: c.querySelector('[name=nombre]').value, kanji: c.querySelector('[name=kanji]').value }, 'PUT'))
      cerrarHoja()
      mensaje('Hábito guardado')
    })
    c.querySelector('[data-abandonar]').onclick = () => confirmar('¿Abandonar este hábito?', 'Sale de la forja. La XP que ganaste se queda.', 'Abandonar', async () => {
      pintar(await api(`/api/habitos/forja/${encodeURIComponent(h.id)}/abandonar`, {}))
      mensaje('Hábito abandonado')
    })
  }

  function nuevoHabito() {
    if (r.forja.enForja.length >= r.forja.config.maximo) return mensaje('Terminá uno antes de empezar otro', true)
    const cfg = r.forja.config
    const c = abrirHoja('鍛 Forjar hábito', `
      <label>El hábito <input name="nombre" maxlength="80" placeholder="Ej.: Leer 10 minutos" autocomplete="off"></label>
      <div><span class="chico">Su kanji (queda escondido en la piedra)</span><div class="hb-chips" role="radiogroup" aria-label="Kanji" data-kanjis></div></div>
      <p class="chico">Dura ${cfg.dias} días. Se forja con ${cfg.validos} días válidos: cada semana te perdona 1 falla. +${cfg.xpDia} XP por día y +${cfg.xpForjado} al forjarse.</p>
      <button type="button" class="principal" data-empezar disabled>鍛 Empezar la forja</button>`)
    const nombre = c.querySelector('[name=nombre]')
    const caja = c.querySelector('[data-kanjis]')
    const empezar = c.querySelector('[data-empezar]')
    let elegido = ''
    let tocado = false // si la persona eligió uno, no lo cambia la sugerencia
    let propio = ''
    let sugeridos = []
    const listo = () => { empezar.disabled = !nombre.value.trim() || !(propio || elegido) }
    function chips() {
      caja.innerHTML = sugeridos.map((k) => `<button type="button" role="radio" aria-checked="${!propio && k === elegido}" data-k="${esc(k)}"><span class="kanji">${esc(k)}</span></button>`).join('') +
        `<input aria-label="Escribir otro kanji" placeholder="Otro" maxlength="4" value="${esc(propio)}">`
      for (const b of caja.querySelectorAll('[data-k]')) b.onclick = () => { elegido = b.dataset.k; tocado = true; propio = ''; chips(); listo() }
      const otro = caja.querySelector('input')
      otro.oninput = () => { propio = [...otro.value.trim()].slice(-1).join(''); for (const b of caja.querySelectorAll('[data-k]')) b.setAttribute('aria-checked', String(!propio && b.dataset.k === elegido)); listo() }
    }
    let espera = null
    async function sugerir() {
      const { kanjis } = await api(`/api/habitos/kanjis?nombre=${encodeURIComponent(nombre.value)}`)
      sugeridos = kanjis
      if (!tocado || !sugeridos.includes(elegido)) elegido = sugeridos[0]
      chips(); listo()
    }
    nombre.oninput = () => { clearTimeout(espera); espera = setTimeout(seguro(sugerir), 250); listo() }
    empezar.onclick = seguro(async () => {
      const k = propio || elegido
      const { resumen } = await api('/api/habitos/forja', { nombre: nombre.value.trim(), kanji: k })
      cerrarHoja()
      pintar(resumen)
      mensaje(`${k} ${nombre.value.trim()}: empieza la forja`)
      evento('aparecer', { texto: nombre.value.trim() })
    })
    seguro(sugerir)()
    nombre.focus()
  }

  // ---------- Mi código ----------
  const info = (lista, id) => lista.find((x) => x.id === id) || lista[lista.length - 1]
  const ordenEn = (x) => (vista === 'area' ? x.orden : x.ordenMomento)
  const delGrupo = (g) => r.codigo.filter((x) => (vista === 'area' ? x.grupo : x.momento) === g).sort((a, b) => ordenEn(a) - ordenEn(b))

  function pintarCodigo() {
    for (const b of document.querySelectorAll('[data-vista]')) b.setAttribute('aria-selected', String(b.dataset.vista === vista))
    const grupos = vista === 'area' ? r.grupos : r.momentos
    const div = $('#codigo')
    div.innerHTML = ''
    for (const g of grupos) {
      const lista = delGrupo(g.id)
      if (!lista.length) continue
      const sec = document.createElement('section')
      sec.className = 'hb-grupo'
      sec.innerHTML = `<h3><span class="kanji" aria-hidden="true">${g.kanji}</span>${g.nombre}</h3>`
      lista.forEach((x, i) => {
        const otra = vista === 'area' ? info(r.momentos, x.momento) : info(r.grupos, x.grupo)
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'hb-regla'
        b.setAttribute('aria-label', `Regla ${i + 1}: ${x.texto} (${otra.nombre}). Tocá para editar`)
        b.innerHTML = `<span class="hb-numero" aria-hidden="true">${numeral(i + 1)}</span><span class="hb-regla-texto">${esc(x.texto)}</span><span class="hb-otra" aria-hidden="true"><span class="kanji">${otra.kanji}</span> ${otra.nombre}</span>`
        b.onclick = () => editorRegla(x, lista)
        sec.appendChild(b)
      })
      div.appendChild(sec)
    }
    $('#codigo-vacio').hidden = r.codigo.length > 0
    $('#sello').hidden = !r.codigo.length
    $('#sello-n').textContent = r.codigo.length
  }

  function chipsEtiquetas(opciones, valor, nombre) {
    return `<div><span class="chico">${nombre}</span><div class="hb-chips" role="radiogroup" aria-label="${nombre}" data-grupo="${nombre}">${opciones.map((o) =>
      `<button type="button" role="radio" aria-checked="${o.id === valor}" data-v="${o.id}"><span class="kanji" aria-hidden="true">${o.kanji}</span> ${o.nombre}</button>`).join('')}</div></div>`
  }
  function activarChips(c) {
    for (const g of c.querySelectorAll('[data-grupo]')) {
      for (const b of g.querySelectorAll('[data-v]')) b.onclick = () => { for (const o of g.querySelectorAll('[data-v]')) o.setAttribute('aria-checked', String(o === b)) }
    }
  }
  const elegidoEn = (c, nombre) => c.querySelector(`[data-grupo="${nombre}"] [aria-checked="true"]`).dataset.v

  function editorRegla(x, lista) {
    const nueva = !x
    const c = abrirHoja(nueva ? 'Nueva regla' : 'Editar regla', `
      <label>La regla <textarea name="texto" rows="3" maxlength="300" placeholder="Ej.: Flexiones cada vez que pierdo el foco">${esc(x ? x.texto : '')}</textarea></label>
      ${chipsEtiquetas(r.momentos, x ? x.momento : 'siempre', 'Momento')}
      ${chipsEtiquetas(r.grupos, x ? x.grupo : 'cuerpo', 'Área')}
      ${nueva ? '' : `<div class="hb-dos"><button type="button" data-mover="-1" ${lista[0].id === x.id ? 'disabled' : ''}>↑ Subir</button><button type="button" data-mover="1" ${lista[lista.length - 1].id === x.id ? 'disabled' : ''}>↓ Bajar</button></div>
      <p class="chico apagado">Subir y bajar ordena la vista ${vista === 'area' ? 'por área' : 'por momento'}; la otra vista guarda su propio orden.</p>`}
      <button type="button" class="principal" data-guardar>${nueva ? '誓 Jurar esta regla' : 'Guardar'}</button>
      ${nueva ? '' : '<button type="button" class="peligro" data-borrar>Borrar regla</button>'}`)
    activarChips(c)
    const datos = () => ({ texto: c.querySelector('[name=texto]').value, momento: elegidoEn(c, 'Momento'), grupo: elegidoEn(c, 'Área') })
    c.querySelector('[data-guardar]').onclick = seguro(async () => {
      if (nueva) {
        const { regla, resumen } = await api('/api/habitos/codigo', datos())
        pintar(resumen)
        evento('logro', { texto: regla.texto })
        mensaje('Regla jurada 誓')
      } else {
        pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}`, datos(), 'PUT'))
        mensaje('Regla guardada')
      }
      cerrarHoja()
    })
    for (const b of c.querySelectorAll('[data-mover]')) {
      b.onclick = seguro(async () => { pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}/mover`, { dir: Number(b.dataset.mover), vista })); cerrarHoja() })
    }
    const borrar = c.querySelector('[data-borrar]')
    if (borrar) borrar.onclick = () => confirmar('¿Borrar esta regla?', `«${x.texto}» sale de tu código.`, 'Borrar', async () => {
      pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}`, undefined, 'DELETE'))
      mensaje('Regla borrada')
    })
    if (nueva) c.querySelector('[name=texto]').focus()
  }

  // ---------- Caída ----------
  let timerDeshacer = null
  function pintarCaida() {
    const k = r.caida
    $('#caida-texto').textContent = k.xp > 0
      ? `Si fallaste, decilo: perdés ${k.xp} XP y queda la marca del día. El día sigue: no se reinicia nada.`
      : 'Si fallaste, decilo: queda la marca del día. El día sigue: no se reinicia nada.'
    $('#caida-total').textContent = k.total ? `Caídas superadas: ${k.total}${k.hoy.length ? ` · hoy: ${k.hoy.length}` : ''}` : ''
  }

  function noCumpli() {
    confirmar('¿Seguro?', r.caida.xp > 0 ? `Perdés ${r.caida.xp} XP y queda la marca. El día sigue: no se reinicia nada.` : 'Queda la marca. El día sigue: no se reinicia nada.', 'Sí, caí', async () => {
      const { caida, resumen } = await api('/api/habitos/caidas', { origen: 'boton' })
      pintar(resumen)
      evento('caida', { xp: caida.xp })
      const bar = $('#deshacer')
      $('#deshacer-texto').textContent = caida.xp > 0 ? `Caída anotada · −${caida.xp} XP` : 'Caída anotada'
      bar.hidden = false
      clearTimeout(timerDeshacer)
      timerDeshacer = setTimeout(() => { bar.hidden = true }, r.caida.deshacerMs)
      $('#deshacer-boton').onclick = seguro(async () => {
        clearTimeout(timerDeshacer)
        bar.hidden = true
        const d = await api(`/api/habitos/caidas/${encodeURIComponent(caida.id)}/deshacer`, {})
        pintar(d.resumen)
        if (d.deshecha) mensaje('Caída deshecha: volvió la XP')
      })
    }, 'Volver')
  }

  // ---------- Confirmar ----------
  function confirmar(titulo, texto, si, fn, no = 'Cancelar') {
    const c = abrirHoja(titulo, `<p>${esc(texto)}</p><div class="hb-dos"><button type="button" data-no>${esc(no)}</button><button type="button" class="principal" data-si>${esc(si)}</button></div>`)
    c.querySelector('[data-no]').onclick = cerrarHoja
    c.querySelector('[data-si]').onclick = seguro(async () => { cerrarHoja(); await fn() })
  }

  // ---------- Ajustes ----------
  function pintarAjustes() {
    const f = $('#ajustes')
    if (f.contains(document.activeElement)) return
    for (const k of ['dias', 'validos', 'xpDia', 'xpForjado', 'maximo']) f[k].value = r.forja.config[k]
    f.caidaXp.value = r.caida.xp
  }
  $('#ajustes').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    const forja = {}
    for (const k of ['dias', 'validos', 'xpDia', 'xpForjado', 'maximo']) forja[k] = Number(f[k].value)
    document.activeElement.blur()
    pintar(await api('/api/habitos/config', { forja, caidaXp: Number(f.caidaXp.value) }))
    mensaje('Ajustes guardados')
  })

  // ---------- Todo ----------
  function pintar(res) {
    r = res
    pintarForja()
    pintarCodigo()
    pintarCaida()
    pintarAjustes()
  }

  $('#nuevo-habito').onclick = () => r && nuevoHabito()
  $('#nueva-regla').onclick = () => r && editorRegla(null)
  $('#no-cumpli').onclick = () => r && noCumpli()
  for (const b of document.querySelectorAll('[data-vista]')) {
    b.onclick = () => {
      vista = b.dataset.vista
      try { localStorage.setItem('habitos-vista', vista) } catch (e) { /* sin almacenamiento */ }
      if (r) pintarCodigo()
    }
  }

  barra('habitos')
  seguro(async () => pintar(await api('/api/habitos')))()
})()
