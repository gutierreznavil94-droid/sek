/*
 * Las escenas de Sueño del tema Shinobi (SuenoShinobi y NocheShinobi de la app vieja, src/temas/shinobi/Escenas.tsx):
 * - Sueño: el samurái sentado junto a la cama, en bucle (tarjeta «Tu adaptación»).
 * - Noche (modo sueño): «buenas noches» una vez y después «durmiendo» en bucle; `directo` arranca durmiendo.
 * Viven en este módulo (/m/sueno/escenas/) porque solo las usa Sueño. Se dibujan como hojas de cuadros en un <canvas>
 * (comun/pantalla/hoja-clip.js): los <video> no arrancaban en el celu. Con movimiento reducido: un cuadro quieto.
 *
 *   SEK_ESCENA_SUENO(caja)                 SEK_ESCENA_NOCHE(caja, { directo: false })
 */
(function () {
  'use strict'
  const BASE = '/m/sueno/escenas/'

  function marco(caja, clase) {
    caja.innerHTML = `<div class="tema-ventanilla ${clase}" aria-hidden="true"><span class="tema-sello">眠</span><div class="tema-escena">`
      + '<canvas class="tema-escena-clip arriba"></canvas><img class="tema-escena-clip arriba" alt="" hidden></div></div>'
    return { lienzo: caja.querySelector('canvas'), quieto: caja.querySelector('img') }
  }
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  window.SEK_ESCENA_SUENO = function (caja) {
    const { lienzo, quieto } = marco(caja, 'tema-sueno')
    if (reducido()) { quieto.src = `${BASE}sueno/sentado-quieto.jpg`; quieto.hidden = false; return }
    SEK_HOJA_CLIP(lienzo).tocar(`${BASE}sueno/sentado`, { bucle: true, alFin: () => { quieto.src = `${BASE}sueno/sentado-quieto.jpg`; quieto.hidden = false } })
  }

  window.SEK_ESCENA_NOCHE = function (caja, { directo = false } = {}) {
    const { lienzo, quieto } = marco(caja, 'tema-noche')
    const ver = (c) => { quieto.src = `${BASE}noche/${c}-quieto.jpg`; quieto.hidden = false }
    if (reducido()) { ver('durmiendo'); return }
    const clips = SEK_HOJA_CLIP(lienzo)
    const durmiendo = () => clips.tocar(`${BASE}noche/durmiendo`, { bucle: true, alFin: () => ver('durmiendo') })
    clips.cargar(`${BASE}noche/durmiendo`).catch(() => {})
    if (directo) durmiendo()
    else clips.tocar(`${BASE}noche/buenas-noches`, { alFin: durmiendo })
  }
})()
