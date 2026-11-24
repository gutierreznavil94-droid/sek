/*
 * «鍛 En forja» en Hoy, igual que FilaForjaHoy de la v0.88.27 (Forja.tsx): hasta 3 piedras chicas.
 * Tocar = marcar (o desmarcar) hoy; mantener apretado = opciones. Si no hay hábitos en forja, no aparece.
 * Necesita /comun/v88.js, /m/temas/piedra.js y /m/habitos/juramento.js antes. Le habla solo a /api/habitos.
 *   SEK.forjaHoy(contenedor) → promesa (pinta la fila adentro del contenedor)
 */
(function () {
  'use strict'
  if (!window.SEK || window.SEK.forjaHoy) return
  const SEK = window.SEK
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  let caja = null
  let golpeDe = null

  function piedraChica(x) {
    const { esc } = SEK.v88
    const piedra = window.SEK_PIEDRA_SHINOBI
      ? SEK_PIEDRA_SHINOBI({ id: x.id, kanji: x.kanji, validos: x.validos, necesarios: x.necesarios, tam: 42, reducido: reducido(), golpe: golpeDe === x.id })
      : `<span class="forja-kanji-titulo">${esc(x.kanji)}</span>`
    return `<button type="button" class="forja-chica ${x.hechoHoy ? 'hecho' : ''}" data-id="${esc(x.id)}" aria-label="${esc(x.nombre)}: ${x.validos} de ${x.necesarios}. ${x.hechoHoy ? 'Hecho hoy' : 'Tocá si lo hiciste hoy'}">
      ${piedra}<span class="forja-nombre">${esc(x.nombre)}</span><span class="forja-cuenta mono">${x.hechoHoy ? '✓ ' : ''}${x.validos} / ${x.necesarios}</span></button>`
  }

  async function pintar() {
    const r = await SEK.api('/api/habitos/hoy')
    const lista = r.enForja
    golpeDe = golpeDe && lista.some((x) => x.id === golpeDe) ? golpeDe : null
    caja.hidden = !lista.length
    if (!lista.length) { caja.innerHTML = ''; return }
    const columnas = lista.length > 1 ? ` en-columnas" style="grid-template-columns: repeat(${lista.length}, 1fr);` : ''
    caja.innerHTML = `<span class="seccion-titulo"><span class="forja-kanji-titulo" aria-hidden="true">鍛</span>En forja <span class="seccion-nota">(tocá la piedra si lo hiciste hoy)</span></span>
      <div class="forja-fila${columnas}">${lista.map(piedraChica).join('')}</div>`
    golpeDe = null
    caja.querySelectorAll('.forja-chica').forEach((b) => {
      const x = lista.find((y) => y.id === b.dataset.id)
      let largo = 0, fue = false
      b.addEventListener('pointerdown', () => { fue = false; largo = setTimeout(() => { fue = true; opciones(x) }, 550) })
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(largo))
      b.addEventListener('contextmenu', (e) => e.preventDefault())
      b.onclick = SEK.seguro(async () => { if (fue) { fue = false; return } await tocar(x, b) })
    })
  }

  async function tocar(x, el) {
    const { avisar } = SEK.v88
    const { resultado: res } = await SEK.api(`/api/habitos/forja/${encodeURIComponent(x.id)}/tocar`, {})
    if (res.marcado) golpeDe = x.id
    await pintar()
    if (res.marcado) {
      SEK.evento('forja-paso', { elemento: el, texto: x.nombre })
      if (res.forjado) {
        SEK.evento('forja-completa', { elemento: el, texto: x.nombre })
        avisar(`${x.kanji} ${x.nombre}: forjado. +${res.xp} XP`, { tipo: 'ok' })
        if (window.SEK_JURAMENTO) setTimeout(() => SEK_JURAMENTO({ texto: x.nombre, grupo: '鍛 Hábito forjado', kanjiSello: x.kanji }), reducido() ? 200 : 1700)
      } else {
        if (res.pedazo) SEK.evento('forja-pedazo', { elemento: el, texto: x.nombre })
        avisar(`${x.nombre}: día ${res.estado.validos} de ${res.estado.necesarios}${res.xp ? ` · +${res.xp} XP` : ''}`, { tipo: 'ok' })
      }
      if (res.nuevoNivel) SEK.evento('logro', { nivel: res.nuevoNivel })
    } else avisar(`${x.nombre}: desmarcado hoy`)
  }

  function opciones(x) {
    const { hoja, confirmar, avisar } = SEK.v88
    const o = hoja(`${x.kanji} ${x.nombre}`, `<p class="chico texto-2">Tocá la piedra para marcar el día; tocá de nuevo hoy para desmarcarlo.</p>
      <button type="button" class="boton suave ancho" data-abandonar>Abandonar este hábito</button>`)
    o.el.querySelector('[data-abandonar]').onclick = () => {
      o.cerrar()
      confirmar('¿Abandonar este hábito?', 'Sale de la forja. La XP que ganaste se queda.', 'Abandonar', async () => {
        await SEK.api(`/api/habitos/forja/${encodeURIComponent(x.id)}/abandonar`, {})
        await pintar()
        avisar('Hábito abandonado')
      })
    }
  }

  SEK.forjaHoy = function (contenedor) {
    caja = contenedor
    return pintar()
  }
})()
