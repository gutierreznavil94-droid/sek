// Pantalla de XP. Pide todo a /api/xp (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, mensaje } = SEK
  let ultimoId = null

  const signo = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
  const balance = (b) => `<span class="xp-mas">+${b.mas}</span> / <span class="xp-menos">−${b.menos}</span>`
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const fechaCorta = (f) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}` }

  function fila(m) {
    const li = document.createElement('li')
    if (m.anulado) li.className = 'anulado'
    li.innerHTML = `
      <div class="linea"><span class="que">${esc(m.descripcion || m.origen)}</span><span class="cantidad ${m.cantidad < 0 ? 'xp-menos' : 'xp-mas'}">${signo(m.cantidad)} XP</span></div>
      <div class="linea chico texto-3"><span>${fechaCorta(m.fecha)} · ${esc(m.origen)}</span>${m.anulado ? `<span>Anulado${m.motivoAnulacion ? ': ' + esc(m.motivoAnulacion) : ''}</span>` : '<button class="boton chico suave anular" type="button">Anular</button>'}</div>`
    const b = li.querySelector('.anular')
    if (b) b.onclick = () => {
      b.hidden = true
      const f = document.createElement('form')
      f.innerHTML = '<input name="motivo" placeholder="¿Por qué? (opcional)" maxlength="200"><button class="boton chico peligro" type="submit">Anular</button>'
      f.onsubmit = seguro(async (e) => {
        e.preventDefault()
        pintar(await api(`/api/xp/movimientos/${m.id}/anular`, { motivo: f.motivo.value.trim() || 'Anulado desde XP' }))
        mensaje('Anulado. Queda en el historial.')
      })
      li.appendChild(f)
      f.motivo.focus()
    }
    return li
  }

  function agregar(movs) {
    const ul = $('#movimientos')
    for (const m of movs) ul.appendChild(fila(m))
    ultimoId = movs.length ? movs[movs.length - 1].id : ultimoId
    $('#mas').hidden = movs.length < 50
    if (!ul.children.length) ul.innerHTML = '<li class="chico texto-2">Todavía no hay XP. Cumplí algo de hoy y aparece acá.</li>'
  }

  function pintar(r) {
    const e = r.estado
    $('#nivel').textContent = e.nivel
    $('#etapa').textContent = e.etapa
    $('#barra').style.width = Math.round(e.progreso * 100) + '%'
    $('#en-nivel').textContent = `${e.xpEnNivel} / ${e.xpParaSiguiente} XP para el nivel ${e.nivel + 1}`
    $('#total').textContent = `${e.xpTotal} XP en total`
    $('#hoy-balance').innerHTML = balance(r.balanceHoy)
    $('#ayer-balance').innerHTML = balance(r.balanceAyer)
    $('#resta-activa').checked = r.resta.activa
    const sel = $('#resta-porcentaje')
    if (![...sel.options].some((o) => Number(o.value) === r.resta.porcentaje)) sel.add(new Option(`${r.resta.porcentaje} %`, r.resta.porcentaje))
    sel.value = String(r.resta.porcentaje)
    sel.disabled = !r.resta.activa
    $('#resta-desde').textContent = r.resta.activa && r.resta.desde ? `Cuenta desde el ${fechaCorta(r.resta.desde)}.` : r.resta.activa ? 'Empieza a contar hoy.' : 'Apagado: lo no cumplido no resta.'
    $('#movimientos').innerHTML = ''
    ultimoId = null
    agregar(r.movimientos)
  }

  $('#resta-activa').onchange = seguro(async (e) => pintar(await api('/api/xp/resta', { activa: e.target.checked })))
  $('#resta-porcentaje').onchange = seguro(async (e) => pintar(await api('/api/xp/resta', { porcentaje: Number(e.target.value) })))
  $('#mas').onclick = seguro(async () => agregar((await api(`/api/xp/historial?antesDe=${ultimoId}`)).movimientos))

  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  seguro(async () => pintar(await api('/api/xp')))()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) seguro(async () => pintar(await api('/api/xp')))() })
})()
