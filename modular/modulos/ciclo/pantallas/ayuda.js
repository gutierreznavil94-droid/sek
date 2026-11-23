// Ayudas de las pantallas del ciclo (solo de este módulo): escapar texto, fechas cortas y la hoja de formulario.
(function () {
  'use strict'
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const fecha = (f) => { if (!f) return ''; const [, m, d] = f.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}` }

  /**
   * Abre una hoja con un formulario. `campos` es HTML con inputs que tienen name.
   * `alGuardar(valores)` corre al tocar Guardar; si tira error, se muestra y la hoja queda abierta.
   */
  function hoja(titulo, campos, alGuardar, { boton = 'Guardar', peligro = false } = {}) {
    const d = document.createElement('dialog')
    d.className = 'hoja'
    d.innerHTML = `<form method="dialog"><div class="fila entre"><h3>${esc(titulo)}</h3><button type="button" class="mini" data-cerrar>Cerrar</button></div>
      ${campos}<p class="chico mal" data-error hidden></p><button class="${peligro ? 'peligro' : 'principal'}" type="submit">${esc(boton)}</button></form>`
    document.body.appendChild(d)
    const f = d.querySelector('form')
    d.querySelector('[data-cerrar]').onclick = () => d.close()
    d.addEventListener('close', () => d.remove())
    f.onsubmit = async (e) => {
      e.preventDefault()
      const valores = {}
      for (const el of f.elements) if (el.name) valores[el.name] = el.type === 'checkbox' ? el.checked : el.value
      try { await alGuardar(valores); d.close() } catch (err) { const p = f.querySelector('[data-error]'); p.textContent = err.message; p.hidden = false }
    }
    d.showModal()
    const primero = f.querySelector('input, textarea, select')
    if (primero) primero.focus()
    return d
  }

  window.CICLO = { esc, fecha, hoja }
})()
