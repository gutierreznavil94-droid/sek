// 3·2·1, igual que la v0.88.27 (Protocolo321.tsx): elegís qué vas a empezar (con el hueco libre de ahora y los
// pendientes de hoy para tocar), cuenta atrás grande, «Empieza ahora». «Empecé» lo anota con su XP en
// /api/desafios/inicios. Acepta ?accion=…&compromiso=…&id=… (Hoy y Siguiente acción) y &auto=1 para arrancar contando.
(function () {
  'use strict'
  const { api, seguro, evento } = SEK
  const { esc, avisar } = SEK.v88
  SEK.v88.montar({ completa: 'app-321' })
  const caja = document.getElementById('caja')
  const p = new URLSearchParams(location.search)
  const v = p.get('volver') || ''
  const volver = /^\/[a-z0-9/_-]*$/i.test(v) && !v.startsWith('//') ? v : '/hoy'
  const idGuardado = Number(p.get('id')) || null
  let texto = (p.get('accion') || '').slice(0, 120)
  let compromisoId = p.get('compromiso') || null
  let datos = { momento: null, pendientes: [], hoy: null }
  const cerrar = () => { if (history.length > 1) history.back(); else location.href = volver }

  function elegir() {
    caja.className = 'contenido'
    const m = datos.momento
    const hay = SEK.hueco.texto(m)
    const pend = datos.pendientes.filter((c) => c.accion.tipo !== 'limite_juego' && c.accion.tipo !== 'acostarse')
    caja.innerHTML = `<div class="fila entre"><h1>3 · 2 · 1</h1><button type="button" class="boton chico suave" data-cerrar>Cerrar</button></div>
      <p class="texto-2">Cuando aparece la resistencia, no negociás: contás 3, 2, 1 y empezás. ¿Qué vas a empezar?</p>
      <section class="tarjeta">
        <div class="campo"><label for="accion">Acción</label><input id="accion" maxlength="120" autocomplete="off" value="${esc(texto)}" placeholder="Ej.: ponerme las zapatillas"></div>
        ${hay ? `<p class="hor-hueco chico">${hay}</p>` : ''}
        ${pend.length ? `<div class="chips">${pend.map((c) => `<button type="button" class="${compromisoId === c.id ? 'activo' : ''}" data-c="${esc(c.id)}">${esc(c.accion.nombre)}${m && !m.ahora && c.accion.minutosMinimos && c.accion.minutosMinimos <= m.libres ? '<span class="texto-3"> · entra</span>' : ''}</button>`).join('')}</div>` : ''}
        <button type="button" class="boton primario grande ancho" data-contar>Contar</button>
      </section>`
    const input = caja.querySelector('#accion'), contarB = caja.querySelector('[data-contar]')
    const revisar = () => { contarB.disabled = !input.value.trim() }
    input.oninput = () => { texto = input.value; compromisoId = null; caja.querySelectorAll('[data-c]').forEach((b) => b.classList.remove('activo')); revisar() }
    caja.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { const c = pend.find((x) => x.id === b.dataset.c); texto = c.accion.nombre; compromisoId = c.id; elegir() } })
    caja.querySelector('[data-cerrar]').onclick = cerrar
    contarB.onclick = contar
    revisar()
    if (!texto) input.focus()
  }

  function contar() {
    if (!texto.trim()) return
    let n = 3
    caja.className = 'contenido cuenta'
    const pintar = () => { caja.innerHTML = `<div class="numero acento" aria-live="assertive">${n}</div><p class="texto-2">Ahora: ${esc(texto)}</p>` }
    pintar()
    const t = setInterval(() => {
      n--
      if (n > 0) return pintar()
      clearInterval(t)
      ahora()
    }, 1000)
  }

  function ahora() {
    caja.innerHTML = `<div class="grande dz-ahora" style="font-size: 2.6rem;">Empieza ahora</div><p class="texto-2">${esc(texto)}</p>
      <button type="button" class="boton ok grande ancho" data-empece>Empecé</button><button type="button" class="boton suave" data-no>No empecé</button>`
    try { if (navigator.vibrate) navigator.vibrate(200) } catch (e) { /* sin vibración */ }
    evento('aparecer', { elemento: caja.querySelector('.dz-ahora') })
    caja.querySelector('[data-no]').onclick = () => { location.href = volver }
    caja.querySelector('[data-empece]').onclick = seguro(async () => {
      const d = { accion: texto.trim() }
      if (compromisoId) d.compromisoId = compromisoId
      if (idGuardado) d.id = idGuardado
      const r = await api('/api/desafios/inicios', d)
      SEK.hueco.marcarUsado('321', datos.hoy)
      evento('completar', { elemento: caja.querySelector('[data-empece]') })
      avisar(r.xp > 0 ? `Empezaste. +${r.xp} XP${r.nuevoNivel ? ` · ¡Nivel ${r.nuevoNivel}!` : ''}` : `Empezaste. ${r.motivoSinXp || ''}`, { tipo: 'ok' })
      setTimeout(() => { location.href = volver }, 900)
    })
  }

  seguro(async () => {
    if (p.get('auto') && texto) { contar(); datos = await SEK.hueco.cargar(); return }
    datos = await SEK.hueco.cargar()
    elegir()
  })()
})()
