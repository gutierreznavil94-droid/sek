/*
 * La escena de Juego del tema Shinobi, igual que JuegoShinobi + VideoEscena de la app vieja (src/temas/shinobi/Escenas.tsx):
 * sin jugar, el papel en blanco (pelean); al empezar, «a jugar» (con el marco épico) y después «jugando» en bucle;
 * en pausa, entran a tomar té (te-entra → te-bucle) y al seguir salen (te-sale → jugando); al terminar, una mancha de
 * tinta y vuelve al papel. Los clips viven en este módulo (/m/juego/escenas/), porque solo los usa esta pantalla.
 * Sin pantallas negras: el clip que sigue ya está precargado y abajo queda el último cuadro del anterior.
 * Con movimiento reducido (o si un clip no carga): un cuadro quieto.
 *
 *   const e = SEK_ESCENA_JUEGO(caja)   e.poner({ activa, pausada })
 */
(function () {
  'use strict'
  const BASE = '/m/juego/escenas/'
  const BUCLE = ['pelea', 'jugando', 'te-bucle']
  const SIGUE = { 'a-jugar': 'jugando', 'te-entra': 'te-bucle', 'te-sale': 'jugando' }
  const PRECARGA = { pelea: ['a-jugar'], 'a-jugar': ['jugando'], jugando: ['te-entra'], 'te-entra': ['te-bucle'], 'te-bucle': ['te-sale'], 'te-sale': ['jugando'] }
  const NOTA = {
    pelea: 'Cuando empieces a jugar, se sientan a jugar', 'a-jugar': 'Dejan de pelear y se sientan a jugar', jugando: 'Jugando, concentrados',
    'te-entra': 'Pausa: té', 'te-bucle': 'Pausa: té', 'te-sale': 'De vuelta a jugar',
  }
  const ruta = (c) => (c === 'pelea' ? 'pelea/pelea' : `juego/${c}`)
  const src = (c, ext) => `${BASE}${ruta(c)}${ext}`

  window.SEK_ESCENA_JUEGO = function (caja) {
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
    caja.innerHTML = '<div class="tema-juego"><div class="tema-ventanilla" aria-hidden="true"><span class="tema-sello">遊</span><div class="tema-escena">'
      + '<img class="tema-escena-clip" data-fin alt=""><img class="tema-escena-clip" data-inicio alt=""><img class="tema-escena-clip arriba" data-quieto alt="">'
      + '</div></div><span class="sl-casa-nota"></span></div>'
    const raiz = caja.firstElementChild
    const ventanilla = raiz.querySelector('.tema-ventanilla')
    const escena = raiz.querySelector('.tema-escena')
    const imgFin = escena.querySelector('[data-fin]')
    const imgInicio = escena.querySelector('[data-inicio]')
    const imgQuieto = escena.querySelector('[data-quieto]')
    const nota = raiz.querySelector('.sl-casa-nota')
    imgInicio.onerror = () => { imgInicio.style.display = 'none' }
    const videos = new Map()
    const roto = new Set()
    let clip = null
    let anterior = null
    let espera = 0

    function seguir() { const s = SIGUE[clip]; if (s) ir(s) }

    function pintar() {
      const enBlanco = clip === 'pelea'
      const quieto = !enBlanco && (reducido || roto.has(clip))
      const bucle = BUCLE.includes(clip)
      ventanilla.classList.toggle('epico', clip === 'a-jugar')
      nota.textContent = NOTA[clip]
      const ver = (img, url) => { if (url) { if (img.getAttribute('src') !== url) img.src = url; img.style.display = '' } else img.style.display = 'none' }
      ver(imgFin, anterior && !enBlanco ? src(anterior, '-fin.jpg') : null)
      ver(imgInicio, !enBlanco && !quieto ? src(clip, '-inicio.webp') : null)
      ver(imgQuieto, quieto ? src(clip, '-quieto.jpg') : null)
      const montados = reducido ? [] : [...(enBlanco ? [] : [clip]), ...PRECARGA[clip].filter((c) => c !== clip)]
      for (const [c, v] of videos) if (!montados.includes(c)) { v.pause(); v.remove(); videos.delete(c) }
      for (const c of montados) {
        let v = videos.get(c)
        if (!v) {
          v = document.createElement('video')
          v.muted = true; v.playsInline = true; v.preload = 'auto'
          v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
          v.src = src(c, '.mp4')
          v.onended = () => { if (c === clip) seguir() }
          v.onerror = () => { roto.add(c); if (c === clip) pintar() }
          escena.appendChild(v)
          videos.set(c, v)
        }
        v.className = `tema-escena-clip ${c === clip && !roto.has(c) ? 'arriba' : 'oculto'}`
        v.loop = c === clip && bucle
      }
      clearTimeout(espera)
      if (!bucle && quieto) espera = setTimeout(seguir, 1200)
    }

    function ir(nuevo) {
      if (nuevo === clip) return
      anterior = clip
      clip = nuevo
      pintar()
      const v = videos.get(clip)
      if (v && !reducido && clip !== 'pelea') { try { v.currentTime = 0 } catch (e) { /* sin datos todavía */ } v.play().catch(() => {}) }
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
