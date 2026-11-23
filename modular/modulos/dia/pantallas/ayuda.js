// Ayudas de las pantallas de dia (solo de este módulo): escapar texto, fechas legibles, días de la semana y la hoja de formulario.
(function () {
  'use strict'
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay()
  /** «Lunes 23 de noviembre». */
  const fechaLarga = (f) => { const [, m, d] = f.split('-'); return `${DIAS[diaSemana(f)]} ${Number(d)} de ${MESES[Number(m) - 1]}` }
  const fechaCorta = (f) => { const [, m, d] = f.split('-'); return `${Number(d)} ${MESES[Number(m) - 1].slice(0, 3)}` }
  const mesLargo = (mes) => { const [y, m] = mes.split('-'); return `${MESES[Number(m) - 1]} ${y}` }
  const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

  /**
   * Abre una hoja (sube desde abajo) con un formulario. `campos` es HTML con inputs que tienen name.
   * `alGuardar(valores)` corre al tocar el botón; si tira error, se muestra y la hoja queda abierta.
   * `extra`: HTML de botones de abajo (con data-accion) y `alAccion(nombre, valores)` para ellos.
   */
  function hoja(titulo, campos, alGuardar, { boton = 'Guardar', peligro = false, extra = '', alAccion = null } = {}) {
    const d = document.createElement('dialog')
    d.className = 'hoja'
    d.innerHTML = `<form method="dialog"><div class="fila entre"><h3>${esc(titulo)}</h3><button type="button" class="mini" data-cerrar>Cerrar</button></div>
      ${campos}<p class="chico mal" data-error hidden></p>${alGuardar ? `<button class="${peligro ? 'peligro' : 'principal'}" type="submit">${esc(boton)}</button>` : ''}${extra}</form>`
    document.body.appendChild(d)
    const f = d.querySelector('form')
    const valores = () => { const v = {}; for (const el of f.elements) if (el.name) v[el.name] = el.type === 'checkbox' ? el.checked : el.value; return v }
    const error = (err) => { const p = f.querySelector('[data-error]'); p.textContent = err.message; p.hidden = false }
    d.querySelector('[data-cerrar]').onclick = () => d.close()
    d.addEventListener('close', () => d.remove())
    f.onsubmit = async (e) => { e.preventDefault(); if (!alGuardar) return; try { await alGuardar(valores()); d.close() } catch (err) { error(err) } }
    for (const b of f.querySelectorAll('[data-accion]')) {
      b.type = 'button'
      b.onclick = async () => { try { await alAccion(b.dataset.accion, valores()); d.close() } catch (err) { error(err) } }
    }
    d.showModal()
    const primero = f.querySelector('input:not([type=checkbox]), textarea, select')
    if (primero) primero.focus()
    return d
  }

  /** Casillas de los 7 días (lunes primero) con name="d<n>". */
  const casillasDias = (marcados = []) => [1, 2, 3, 4, 5, 6, 0].map((n) =>
    `<label class="casilla-dia"><input type="checkbox" name="d${n}" ${marcados.includes(n) ? 'checked' : ''}><span>${DIAS_CORTOS[n]}</span></label>`).join('')
  const diasDe = (v) => [0, 1, 2, 3, 4, 5, 6].filter((n) => v[`d${n}`])

  window.DIA = { esc, fechaLarga, fechaCorta, mesLargo, sumarDias, diaSemana, hoja, casillasDias, diasDe, DIAS, DIAS_CORTOS }
})()
