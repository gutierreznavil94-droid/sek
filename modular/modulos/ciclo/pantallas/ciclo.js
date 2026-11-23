// Pantalla Nuevo ciclo, igual que la v0.88.27 (Inicio.tsx «nuevo»): cambiar la fecha del Día 1 o empezar un
// ciclo nuevo. Sin ciclo, elegir el Día 1. Pide a /api/ciclo (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const DURACIONES = [[90, '90 días (3 fases de 30)'], [60, '60 días (2 fases de 30)'], [120, '120 días (4 fases de 30)'], [180, '180 días (6 fases de 30)'], [365, '365 días (13 fases de 30)']]
  const opciones = DURACIONES.map(([n, t]) => `<option value="${n}">${t}</option>`).join('')

  function pintar(r) {
    $('#cargando').hidden = true
    const caja = $('#caja')
    if (!r.ciclo) {
      caja.innerHTML = `<h1>Empezá tu ciclo</h1>
        <section class="tarjeta">
          <p class="texto-2 chico">Elegí el Día 1. El día va de 00:00 a 00:00 en tu zona horaria. Las fases son etapas para medir, no desbloquean nada.</p>
          <div class="campo"><label for="f-inicio">Día 1</label><input id="f-inicio" type="date" value="${esc(r.hoy)}"></div>
          <div class="campo"><label for="f-dur">Duración</label><select id="f-dur">${opciones}</select></div>
          <label class="fila chico" style="gap: 8px;"><input type="checkbox" id="f-cero"> Día 0 de calentamiento (el día antes: suma XP, nunca resta)</label>
          <button type="button" class="boton primario grande ancho" id="empezar">Empezar ciclo</button>
        </section>`
    } else {
      const c = r.ciclo
      const diaTexto = r.noEmpezado ? 'Todavía no empezó.' : r.terminado ? 'Ya terminó.' : r.diaCero ? 'Hoy es el día 0.' : `Hoy es el día ${r.dia}.`
      caja.innerHTML = `<section class="tarjeta">
          <div class="tarjeta-cab"><h2>Ciclo ${c.numero}: cambiar la fecha de inicio</h2></div>
          <p class="texto-2 chico">Empezó el ${esc(fechaLegible(c.inicio))}. Cambiar la fecha mueve el Día 1 y las metas automáticas; el XP, el nivel y los registros no se tocan.</p>
          <div class="campo"><label for="f-mover">Nueva fecha del Día 1</label><input id="f-mover" type="date" value="${esc(c.inicio)}">
            <span class="ayuda">El día va de 00:00 a 00:00 (tu hora). ${diaTexto}</span></div>
          <button type="button" class="boton primario ancho" id="mover" disabled>Cambiar fecha de inicio</button>
        </section>
        <section class="tarjeta">
          <div class="tarjeta-cab"><h2>Empezar un ciclo nuevo</h2></div>
          <p class="texto-2 chico">El ciclo ${c.numero} se cerrará. Tu nivel, tu XP y todo el historial se conservan.</p>
          <div class="campo"><label for="f-inicio">Fecha de inicio del ciclo nuevo</label><input id="f-inicio" type="date" value="${esc(r.hoy)}"></div>
          <div class="campo"><label for="f-dur">Duración</label><select id="f-dur">${opciones}</select></div>
          <button type="button" class="boton primario grande ancho" id="empezar">Empezar nuevo ciclo</button>
        </section>
        ${r.ciclosAnteriores.length ? `<p class="chico texto-3">Ciclos anteriores: ${r.ciclosAnteriores.map((x) => `${x.numero} (desde el ${esc(fechaLegible(x.inicio))})`).join(', ')}</p>` : ''}`
      const mover = $('#f-mover'), bm = $('#mover')
      mover.addEventListener('input', () => { bm.disabled = !mover.value || mover.value === c.inicio })
      bm.onclick = seguro(async () => {
        pintar(await api('/api/ciclo/inicio', { inicio: mover.value }))
        avisar(`Día 1: ${fechaLegible(mover.value)}`, { tipo: 'ok' })
      })
    }
    $('#empezar').onclick = seguro(async () => {
      const inicio = $('#f-inicio').value
      if (!inicio) throw new Error('Elegí la fecha del Día 1.')
      const cero = $('#f-cero')
      pintar(await api('/api/ciclo/iniciar', { inicio, duracionDias: Number($('#f-dur').value), diaCero: !!(cero && cero.checked) }))
      avisar(`Ciclo en marcha. Día 1: ${fechaLegible(inicio)}`, { tipo: 'ok' })
    })
  }

  seguro(async () => pintar(await api('/api/ciclo')))()
})()
