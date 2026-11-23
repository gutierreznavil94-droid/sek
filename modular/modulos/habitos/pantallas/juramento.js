/*
 * Momento épico al jurar una regla de «Mi código» o forjar un hábito, igual que Juramento.tsx de la app vieja:
 * la pantalla se oscurece, la regla se escribe con pincel letra por letra, se estampa el sello con rebote y
 * vibración. Dura ~2,8 s; un toque lo salta. Con «reducir movimiento» se muestra quieto y se va solo.
 * Animación de una sola pantalla (Mi código) → vive en el módulo habitos. Estilos .juramento en v88.css.
 *
 *   SEK_JURAMENTO({ texto, grupo, kanjiSello = '誓' }) → Promise (cuando termina)
 */
(function () {
  'use strict'
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  window.SEK_JURAMENTO = function ({ texto, grupo, kanjiSello = '誓' }) {
    return new Promise((listo) => {
      const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
      const letras = [...String(texto)]
      const paso = Math.max(18, Math.min(70, 1100 / Math.max(1, letras.length)))
      const sello = reducido ? 0 : Math.round(380 + letras.length * paso + 150)
      const el = document.createElement('div')
      el.className = `juramento ${reducido ? 'quieto' : ''}`
      el.setAttribute('role', 'dialog')
      el.setAttribute('aria-label', `Regla jurada: ${texto}`)
      el.style.setProperty('--sello', `${sello}ms`)
      el.innerHTML = `<div class="jur-velo"></div>
        <div class="jur-centro">
          <div class="jur-grupo">${esc(grupo)}</div>
          <p class="jur-texto">${letras.map((l, i) => `<span style="animation-delay: ${380 + i * paso}ms;">${esc(l)}</span>`).join('')}</p>
          <svg class="jur-trazo" viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden="true"><path d="M4,9 C60,4 120,11 180,6 C230,3 270,8 296,5"/></svg>
          <div class="jur-sello" aria-hidden="true"><span>${esc(kanjiSello)}</span></div>
        </div>
        <div class="jur-pie">${kanjiSello === '誓' ? '誓 · juramento' : `${esc(kanjiSello)} · forjado`} · tocá para seguir</div>`
      const ids = []
      const fin = () => { ids.forEach((i) => clearTimeout(i)); el.remove(); listo() }
      el.onclick = fin
      if (!reducido && navigator.vibrate) ids.push(setTimeout(() => { try { navigator.vibrate([35, 45, 70]) } catch (e) { /* sin vibración */ } }, sello + 120))
      ids.push(setTimeout(fin, reducido ? 1600 : Math.max(2800, sello + 1200)))
      document.body.appendChild(el)
    })
  }
})()
