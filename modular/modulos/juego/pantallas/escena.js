/*
 * La escena de Juego del tema Shinobi, igual que JuegoShinobi de la app vieja (src/temas/shinobi/Escenas.tsx):
 * sin jugar, el papel en blanco; al empezar, «a jugar» (con el marco épico) y después «jugando» en bucle;
 * en pausa, entran a tomar té (te-entra → te-bucle) y al seguir salen (te-sale → jugando); al terminar, una mancha de
 * tinta y vuelve al papel. Los clips viven en este módulo (/m/juego/escenas/), porque solo los usa esta pantalla.
 * Se dibujan como hojas de cuadros en un <canvas> (comun/pantalla/hoja-clip.js): los <video> no arrancaban en el celu.
 * Con movimiento reducido: un cuadro quieto.
 *
 *   const e = SEK_ESCENA_JUEGO(caja)   e.poner({ activa, pausada })
 */
(function () {
  'use strict'
  const BASE = '/m/juego/escenas/juego/'
  const BUCLE = ['jugando', 'te-bucle']
  const SIGUE = { 'a-jugar': 'jugando', 'te-entra': 'te-bucle', 'te-sale': 'jugando' }
  const PRECARGA = { pelea: ['a-jugar'], 'a-jugar': ['jugando'], jugando: ['te-entra'], 'te-entra': ['te-bucle'], 'te-bucle': ['te-sale'], 'te-sale': ['jugando'] }
  const NOTA = {
    pelea: 'Cuando empieces a jugar, se sientan a jugar', 'a-jugar': 'Dejan de pelear y se sientan a jugar', jugando: 'Jugando, concentrados',
    'te-entra': 'Pausa: té', 'te-bucle': 'Pausa: té', 'te-sale': 'De vuelta a jugar',
  }

  window.SEK_ESCENA_JUEGO = function (caja) {
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
    caja.innerHTML = '<div class="tema-juego"><div class="tema-ventanilla" aria-hidden="true"><span class="tema-sello">遊</span><div class="tema-escena">'
      + '<canvas class="tema-escena-clip arriba"></canvas><img class="tema-escena-clip arriba" data-quieto alt="" hidden>'
      + '</div></div><span class="sl-casa-nota"></span></div>'
    const raiz = caja.firstElementChild
    const ventanilla = raiz.querySelector('.tema-ventanilla')
    const lienzo = raiz.querySelector('canvas')
    const quieto = raiz.querySelector('[data-quieto]')
    const nota = raiz.querySelector('.sl-casa-nota')
    const clips = SEK_HOJA_CLIP(lienzo)
    let clip = null
    let espera = 0

    function ir(nuevo) {
      if (nuevo === clip) return
      clip = nuevo
      clearTimeout(espera)
      ventanilla.classList.toggle('epico', clip === 'a-jugar')
      nota.textContent = NOTA[clip]
      if (clip === 'pelea') { clips.limpiar(); quieto.hidden = true }
      else if (reducido) {
        quieto.src = `${BASE}${clip}-quieto.jpg`
        quieto.hidden = false
        if (SIGUE[clip]) espera = setTimeout(() => ir(SIGUE[clip]), 1200)
      } else {
        const este = clip
        clips.tocar(BASE + este, {
          bucle: BUCLE.includes(este),
          // Si una hoja no carga, sigue igual con la que viene (nunca queda trabada).
          alFin: (ok) => { if (clip !== este) return; if (SIGUE[este]) { if (ok) ir(SIGUE[este]); else espera = setTimeout(() => ir(SIGUE[este]), 1200) } },
        })
      }
      if (!reducido) for (const c of PRECARGA[clip]) clips.cargar(BASE + c).catch(() => {})
    }

    let tinta = 0
    function poner({ activa, pausada }) {
      const objetivo = !activa ? 'pelea' : pausada ? 'te' : 'jugando'
      if (clip === null) { ir(objetivo === 'te' ? 'te-bucle' : objetivo); return }
      if (objetivo === 'pelea') {
        if (clip === 'pelea') return
        const t = document.createElement('div')
        t.className = 'tema-escena-tinta'
        t.setAttribute('aria-hidden', 'true')
        raiz.appendChild(t)
        setTimeout(() => t.remove(), 1200)
        clearTimeout(tinta)
        tinta = setTimeout(() => ir('pelea'), 300)
        return
      }
      if (objetivo === 'te') { if (clip !== 'te-entra' && clip !== 'te-bucle') ir('te-entra'); return }
      if (clip === 'pelea') ir('a-jugar')
      else if (clip === 'te-entra' || clip === 'te-bucle') ir('te-sale')
    }
    return { poner }
  }
})()
