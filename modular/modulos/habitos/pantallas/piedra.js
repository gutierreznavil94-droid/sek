// La piedra de la forja, dibujada simple (SVG): 6 grietas que se abren con los pedazos y el kanji que se ve más
// a medida que se juntan días válidos. La piedra Shinobi animada vendrá del módulo temas.
(function () {
  'use strict'
  const GRIETAS = [
    'M50 8 L46 24 L53 34 L47 46',
    'M88 40 L74 44 L68 56 L58 58',
    'M16 62 L30 60 L36 70 L44 66',
    'M70 88 L64 74 L70 66',
    'M22 22 L32 32 L30 42 L38 48',
    'M80 20 L70 30 L62 28 L56 40',
  ]
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  /** p = { kanji, validos, necesarios, pedazos, hechoHoy } → texto SVG. */
  function piedra(p) {
    const completa = p.validos >= p.necesarios
    const ver = completa ? 1 : Math.min(0.55, (p.validos / Math.max(1, p.necesarios)) * 0.55)
    const clase = ['hb-piedra', p.hechoHoy ? 'hecho' : '', completa ? 'completa' : ''].join(' ')
    const grietas = GRIETAS.map((d, i) => `<path class="grieta ${i < p.pedazos ? 'abierta' : ''}" d="${d}"/>`).join('')
    return `<svg class="${clase}" viewBox="0 0 100 100" aria-hidden="true">
      <path class="roca" d="M50 6 L78 14 L94 40 L88 72 L66 94 L32 92 L10 74 L6 42 L22 14 Z"/>
      <text class="kanji-piedra" x="50" y="52" style="opacity:${ver.toFixed(2)}">${esc(p.kanji)}</text>
      ${completa ? '' : grietas}
    </svg>`
  }

  window.SEK_PIEDRA = { piedra }
})()
