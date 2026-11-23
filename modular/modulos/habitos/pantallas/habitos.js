// «掟 Mi código», igual que la v0.88.27 (MiCodigo.tsx y Forja.tsx de la app vieja) pero en HTML+JS, sobre el
// guerrero bajo la lluvia: la forja de hábitos (la piedra Shinobi que se rompe, temas/piedra.js), los ya forjados
// y las reglas por momento o por área, con el juramento al jurar una (juramento.js). Pide todo a /api/habitos.
// La caída («No cumplí») está en Desafíos y las fotos en Progreso, como en la app vieja.
(function () {
  'use strict'
  const { api, $, seguro, evento } = SEK
  const { esc, avisar, hoja } = SEK.v88
  SEK.v88.montar({ activo: 'progreso', companero: 'esquina' })
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  let r = null
  let vista = 'momento'
  try { vista = localStorage.getItem('codigo-vista') === 'area' ? 'area' : 'momento' } catch (e) { /* sin almacenamiento */ }

  const NUMERALES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  /** Número de la regla con numerales a pincel: 一 … 十, 十一 … 二十. Más de 20, números comunes. */
  function numeral(n) {
    if (n <= 10) return NUMERALES[n - 1]
    if (n < 20) return `十${NUMERALES[n - 11]}`
    if (n === 20) return '二十'
    return String(n)
  }
  const fechaCorta = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : '')
  const TRAZO_GRUPO = '<svg class="codigo-grupo-trazo" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true"><path d="M2,5 C40,2 90,7 140,4 C170,2 190,5 198,4"/></svg>'

  /** Hoja con «¿Seguro?»: dos botones. */
  function confirmar(titulo, texto, si, fn) {
    const h = hoja(titulo, `<p class="chico texto-2">${esc(texto)}</p><div class="rejilla-2"><button type="button" class="boton suave" data-no>Cancelar</button><button type="button" class="boton peligro" data-si>${esc(si)}</button></div>`)
    h.el.querySelector('[data-no]').onclick = h.cerrar
    h.el.querySelector('[data-si]').onclick = seguro(async () => { h.cerrar(); await fn() })
  }

  // ---------- Forja ----------
  let golpeDe = null // id del hábito recién marcado (su piedra hace el golpe una vez)
  function caminoHtml(e) {
    const marcas = new Set(e.pedazosEn)
    let validos = 0
    return `<div class="forja-camino" role="list" aria-label="Camino de la forja">${e.camino.map((d, i) => {
      if (d.estado === 'cumplido' || d.estado === 'perdonado') validos++
      const pedazo = (d.estado === 'cumplido' || d.estado === 'perdonado') && marcas.has(validos)
      return `<i role="listitem" class="fc-dia ${d.estado} ${pedazo ? 'pedazo' : ''} ${i >= e.duracion ? 'extra' : ''}" title="${d.fecha}: ${d.estado}"></i>`
    }).join('')}</div>`
  }
  function piedraGrande(x) {
    const h = x.habito, e = x.estado
    const piedra = SEK_PIEDRA_SHINOBI({ id: h.id, kanji: h.kanji, validos: e.validos, necesarios: e.necesarios, tam: 96, reducido: reducido(), golpe: golpeDe === h.id })
    return `<div class="forja-grande" data-id="${esc(h.id)}">
      <button type="button" class="forja-grande-piedra" aria-label="${esc(h.nombre)}: tocá si lo hiciste hoy; mantené apretado para opciones">${piedra}</button>
      <div class="forja-grande-texto">
        <b>${esc(h.nombre)}</b>
        <span class="chico texto-2">Día ${Math.min(e.diaActual, e.duracion)} de ${e.duracion} · <b class="texto">${e.validos}</b> / ${e.necesarios} válidos</span>
        <span class="muy-chico texto-3">${e.completo ? 'Forjado' : `Faltan ${e.faltan}`} · ${e.hechoHoy ? 'hoy ✓' : 'hoy sin marcar'} · ${e.perdonUsadoSemana ? 'falla perdonada usada esta semana' : 'tenés 1 falla perdonada esta semana'}${e.cerradas ? ` · ${e.cerradas} grieta${e.cerradas > 1 ? 's' : ''} cerrada${e.cerradas > 1 ? 's' : ''}` : ''}</span>
        ${caminoHtml(e)}
      </div>
    </div>`
  }

  function pintarForja() {
    const f = r.forja
    $('#en-forja').innerHTML = f.enForja.map(piedraGrande).join('')
    golpeDe = null
    $('#forja-vacia').hidden = f.enForja.length > 0
    $('#forjados-caja').hidden = !f.forjados.length
    $('#forjados').innerHTML = f.forjados.map((x) => `<div class="codigo-regla forja-regla"><span class="forja-regla-kanji" aria-hidden="true">${esc(x.habito.kanji)}</span><span class="codigo-texto">${esc(x.habito.nombre)}</span><span class="codigo-otra">鍛 · forjado ${fechaCorta(x.habito.forjadoEn)}</span></div>`).join('')
    // Tocar = marcar (o desmarcar) hoy; mantener apretado = opciones.
    document.querySelectorAll('.forja-grande').forEach((el) => {
      const x = f.enForja.find((y) => y.habito.id === el.dataset.id)
      const b = el.querySelector('.forja-grande-piedra')
      let largo = 0, fue = false
      b.addEventListener('pointerdown', () => { fue = false; largo = setTimeout(() => { fue = true; opciones(x) }, 550) })
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(largo))
      b.addEventListener('contextmenu', (e) => e.preventDefault())
      b.onclick = seguro(async () => { if (fue) { fue = false; return } await tocar(x, b) })
    })
  }

  async function tocar(x, el) {
    const h = x.habito
    const { resultado: res, resumen } = await api(`/api/habitos/forja/${encodeURIComponent(h.id)}/tocar`, {})
    if (res.marcado) golpeDe = h.id
    pintar(resumen)
    if (res.marcado) {
      evento('forja-paso', { elemento: el, texto: h.nombre })
      if (res.forjado) {
        evento('forja-completa', { elemento: el, texto: h.nombre })
        avisar(`${h.kanji} ${h.nombre}: forjado. +${res.xp} XP`, { tipo: 'ok' })
        setTimeout(() => SEK_JURAMENTO({ texto: h.nombre, grupo: '鍛 Hábito forjado', kanjiSello: h.kanji }), reducido() ? 200 : 1700)
      } else {
        if (res.pedazo) evento('forja-pedazo', { elemento: el, texto: h.nombre })
        avisar(`${h.nombre}: día ${res.estado.validos} de ${res.estado.necesarios}${res.xp ? ` · +${res.xp} XP` : ''}`, { tipo: 'ok' })
      }
      if (res.nuevoNivel) evento('logro', { nivel: res.nuevoNivel })
    } else avisar(`${h.nombre}: desmarcado hoy`)
  }

  function opciones(x) {
    const h = x.habito
    const o = hoja(`${h.kanji} ${h.nombre}`, `<p class="chico texto-2">Tocá la piedra para marcar el día; tocá de nuevo hoy para desmarcarlo.</p>
      <button type="button" class="boton suave ancho" data-abandonar>Abandonar este hábito</button>`)
    o.el.querySelector('[data-abandonar]').onclick = () => {
      o.cerrar()
      confirmar('¿Abandonar este hábito?', 'Sale de la forja. La XP que ganaste se queda.', 'Abandonar', async () => {
        pintar(await api(`/api/habitos/forja/${encodeURIComponent(h.id)}/abandonar`, {}))
        avisar('Hábito abandonado')
      })
    }
  }

  function nuevoHabito() {
    if (r.forja.enForja.length >= r.forja.config.maximo) return avisar('Terminá uno antes de empezar otro')
    const cfg = r.forja.config
    const h = hoja('鍛 Forjar hábito', `
      <div class="campo"><label>El hábito</label><input name="nombre" maxlength="80" placeholder="Ej.: Leer 10 minutos" autocomplete="off"></div>
      <div class="campo"><label>Su kanji (queda escondido en la piedra)</label><div class="forja-kanjis" role="radiogroup" aria-label="Kanji" data-kanjis></div></div>
      <p class="ayuda">Dura ${cfg.dias} días. Se forja con ${cfg.validos} días válidos: cada semana te perdona 1 falla. +${cfg.xpDia} XP por día y +${cfg.xpForjado} al forjarse.</p>
      <button type="button" class="boton primario ancho" data-empezar disabled>鍛 Empezar la forja</button>`)
    const c = h.el
    const nombre = c.querySelector('[name=nombre]')
    const caja = c.querySelector('[data-kanjis]')
    const empezar = c.querySelector('[data-empezar]')
    let sugeridos = [], kanji = ''
    const elegido = () => kanji || sugeridos[0] || ''
    const listo = () => { empezar.disabled = !nombre.value.trim() || !elegido() }
    function chips() {
      const propio = sugeridos.includes(kanji) ? '' : kanji
      caja.innerHTML = sugeridos.map((k) => `<button type="button" role="radio" aria-checked="${elegido() === k}" class="${elegido() === k ? 'activa' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('')
        + `<input class="forja-kanji-propio" value="${esc(propio)}" placeholder="Otro" aria-label="Escribir otro kanji">`
      caja.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { kanji = b.dataset.k; chips(); listo() } })
      const otro = caja.querySelector('input')
      otro.oninput = () => { kanji = [...otro.value.trim()].slice(-1).join(''); caja.querySelectorAll('[data-k]').forEach((b) => { const s = b.dataset.k === elegido(); b.classList.toggle('activa', s); b.setAttribute('aria-checked', String(s)) }); listo() }
    }
    let espera = null
    async function sugerir() {
      sugeridos = (await api(`/api/habitos/kanjis?nombre=${encodeURIComponent(nombre.value)}`)).kanjis
      chips(); listo()
    }
    nombre.oninput = () => { clearTimeout(espera); espera = setTimeout(seguro(sugerir), 250); listo() }
    empezar.onclick = seguro(async () => {
      const k = elegido(), n = nombre.value.trim()
      const { resumen } = await api('/api/habitos/forja', { nombre: n, kanji: k })
      h.cerrar()
      pintar(resumen)
      avisar(`${k} ${n}: empieza la forja`, { tipo: 'ok' })
    })
    seguro(sugerir)()
    nombre.focus()
  }

  // ---------- Mi código ----------
  const info = (lista, id) => lista.find((x) => x.id === id) || lista[lista.length - 1]
  const ordenEn = (x) => (vista === 'area' ? x.orden : x.ordenMomento)
  const delGrupo = (g) => r.codigo.filter((x) => (vista === 'area' ? x.grupo : x.momento) === g).sort((a, b) => ordenEn(a) - ordenEn(b))

  function pintarCodigo() {
    document.querySelectorAll('[data-vista]').forEach((b) => { const s = b.dataset.vista === vista; b.classList.toggle('activa', s); b.setAttribute('aria-selected', String(s)) })
    const grupos = vista === 'area' ? r.grupos : r.momentos
    $('#codigo').innerHTML = grupos.map((g) => {
      const lista = delGrupo(g.id)
      if (!lista.length) return ''
      return `<section class="codigo-grupo" aria-label="${esc(g.nombre)}">
        <div class="codigo-grupo-titulo"><span class="codigo-grupo-kanji" aria-hidden="true">${esc(g.kanji)}</span><span class="codigo-grupo-nombre">${esc(g.nombre)}</span>${TRAZO_GRUPO}</div>
        ${lista.map((x, i) => {
          const otra = vista === 'area' ? info(r.momentos, x.momento) : info(r.grupos, x.grupo)
          return `<button type="button" class="codigo-regla" data-regla="${esc(x.id)}" aria-label="Regla ${i + 1}: ${esc(x.texto)} (${esc(otra.nombre)}). Tocá para editar">
            <span class="codigo-marca" aria-hidden="true">${esc(otra.kanji)}</span>
            <span class="codigo-numero" aria-hidden="true">${numeral(i + 1)}</span>
            <span class="codigo-texto">${esc(x.texto)}</span>
            <span class="codigo-otra" aria-hidden="true" title="${esc(otra.nombre)}">${esc(otra.kanji)} · ${esc(otra.nombre)}</span>
          </button>`
        }).join('')}
      </section>`
    }).join('')
    $('#codigo').querySelectorAll('[data-regla]').forEach((b) => {
      const x = r.codigo.find((y) => y.id === b.dataset.regla)
      b.onclick = () => editorRegla(x, delGrupo(vista === 'area' ? x.grupo : x.momento))
    })
    $('#codigo-vacio').hidden = r.codigo.length > 0
    $('#sello').hidden = !r.codigo.length
    $('#sello').setAttribute('aria-label', `${r.codigo.length} ${r.codigo.length === 1 ? 'regla jurada' : 'reglas juradas'}`)
    $('#sello-n').textContent = r.codigo.length
  }

  /** Cambio de vista: las reglas se disuelven en tinta y se rearman en su nuevo grupo (0,4 s). */
  function cambiarVista(v) {
    if (v === vista) return
    try { localStorage.setItem('codigo-vista', v) } catch (e) { /* sin almacenamiento */ }
    const lista = $('#codigo')
    if (reducido()) { vista = v; pintarCodigo(); return }
    lista.classList.add('sale')
    setTimeout(() => { vista = v; pintarCodigo(); lista.classList.remove('sale'); lista.classList.add('entra') }, 200)
    setTimeout(() => lista.classList.remove('entra'), 400)
  }

  const etiquetas = (opciones, valor, nombre) => `<div class="codigo-etiquetas" role="radiogroup" aria-label="${nombre}" data-grupo="${nombre}">${opciones.map((o) =>
    `<button type="button" role="radio" aria-checked="${o.id === valor}" class="${o.id === valor ? 'activa' : ''}" data-v="${esc(o.id)}"><span class="codigo-etiqueta-kanji" aria-hidden="true">${esc(o.kanji)}</span><span>${esc(o.nombre)}</span></button>`).join('')}</div>`

  function editorRegla(x, lista) {
    const nueva = !x
    const h = hoja(nueva ? 'Nueva regla' : 'Editar regla', `
      <div class="campo"><label>La regla</label><textarea name="texto" rows="3" maxlength="300" placeholder="Ej.: Flexiones cada vez que pierdo el foco">${esc(x ? x.texto : '')}</textarea></div>
      <div class="campo"><label>Momento</label>${etiquetas(r.momentos, x ? x.momento : 'siempre', 'Momento')}</div>
      <div class="campo"><label>Área</label>${etiquetas(r.grupos, x ? x.grupo : 'cuerpo', 'Área')}</div>
      ${nueva ? '' : `<div class="rejilla-2"><button type="button" class="boton" data-mover="-1" ${lista[0].id === x.id ? 'disabled' : ''}>↑ Subir</button><button type="button" class="boton" data-mover="1" ${lista[lista.length - 1].id === x.id ? 'disabled' : ''}>↓ Bajar</button></div>
      <p class="ayuda">Subir y bajar ordena ${vista === 'area' ? 'la vista por área' : 'la vista por momento'}; la otra vista guarda su propio orden.</p>`}
      <button type="button" class="boton primario ancho" data-guardar>${nueva ? '誓 Jurar esta regla' : 'Guardar'}</button>
      ${nueva ? '' : '<button type="button" class="boton suave ancho" data-borrar>Borrar regla</button>'}`)
    const c = h.el
    c.querySelectorAll('[data-grupo]').forEach((g) => g.querySelectorAll('[data-v]').forEach((b) => {
      b.onclick = () => g.querySelectorAll('[data-v]').forEach((o) => { o.classList.toggle('activa', o === b); o.setAttribute('aria-checked', String(o === b)) })
    }))
    const texto = c.querySelector('[name=texto]')
    const guardar = c.querySelector('[data-guardar]')
    const listo = () => { guardar.disabled = !texto.value.trim() }
    texto.oninput = listo
    listo()
    const elegido = (n) => c.querySelector(`[data-grupo="${n}"] [aria-checked="true"]`).dataset.v
    const datos = () => ({ texto: texto.value, momento: elegido('Momento'), grupo: elegido('Área') })
    guardar.onclick = seguro(async () => {
      if (nueva) {
        const d = datos()
        const { regla, resumen } = await api('/api/habitos/codigo', d)
        h.cerrar()
        pintar(resumen)
        SEK_JURAMENTO({ texto: regla.texto, grupo: `${info(r.momentos, regla.momento).nombre} · ${info(r.grupos, regla.grupo).nombre}` })
      } else {
        pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}`, datos(), 'PUT'))
        h.cerrar()
        avisar('Regla guardada', { tipo: 'ok' })
      }
    })
    c.querySelectorAll('[data-mover]').forEach((b) => {
      b.onclick = seguro(async () => { pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}/mover`, { dir: Number(b.dataset.mover), vista })); h.cerrar() })
    })
    const borrar = c.querySelector('[data-borrar]')
    if (borrar) borrar.onclick = () => confirmar('¿Borrar esta regla?', `«${x.texto}» sale de tu código.`, 'Borrar', async () => {
      h.cerrar()
      pintar(await api(`/api/habitos/codigo/${encodeURIComponent(x.id)}`, undefined, 'DELETE'))
      avisar('Regla borrada')
    })
    if (nueva) texto.focus()
  }

  // ---------- Todo ----------
  function pintar(res) {
    r = res
    pintarForja()
    pintarCodigo()
  }

  $('#nuevo-habito').onclick = () => r && nuevoHabito()
  $('#nueva-regla').onclick = () => r && editorRegla(null)
  document.querySelectorAll('[data-vista]').forEach((b) => { b.onclick = () => r && cambiarVista(b.dataset.vista) })

  seguro(async () => {
    const res = await api('/api/habitos')
    pintar(res)
    // El guerrero de fondo, el mismo día que en Progreso (lluvia o rayos según el Día 1 del ciclo).
    const c = await api('/api/ciclo/dia').catch(() => null)
    if (window.SEK_FONDO_PROGRESO) SEK_FONDO_PROGRESO({ hoy: res.hoy, diaUno: c && c.dia && c.dia.ciclo ? c.dia.ciclo.inicio : null, vista: 'codigo' })
  })()
})()
