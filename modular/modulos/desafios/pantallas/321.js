// 3·2·1: elegís qué vas a empezar, cuenta atrás grande, «Empieza ahora». «Empecé» lo anota (con su XP) en /api/desafios/inicios.
// Acepta ?accion=…&compromiso=…&id=… (lo usan Hoy y «Siguiente acción») y &auto=1 para arrancar contando.
(function () {
  'use strict'
  const { api, $, seguro, mensaje, evento } = SEK
  const p = new URLSearchParams(location.search)
  let compromisoId = p.get('compromiso') || null
  const idGuardado = Number(p.get('id')) || null
  const volver = /^\/[a-z0-9/_-]*$/i.test(p.get('volver') || '') && !(p.get('volver') || '').startsWith('//') ? p.get('volver') : '/hoy'
  let reloj = null

  const ver = (que) => { for (const s of ['elegir', 'cuenta', 'ahora']) $('#' + s).hidden = s !== que }
  const vibrar = (x) => { try { if (navigator.vibrate) navigator.vibrate(x) } catch (e) { /* sin vibración */ } }

  function contar() {
    const texto = $('#accion').value.trim()
    if (!texto) return
    $('#texto-cuenta').textContent = 'Ahora: ' + texto
    $('#texto-ahora').textContent = texto
    ver('cuenta')
    let n = 3
    const pintar = () => { const el = $('#numero'); el.textContent = n; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '' }
    pintar()
    clearInterval(reloj)
    reloj = setInterval(() => {
      n--
      if (n > 0) return pintar()
      clearInterval(reloj)
      ver('ahora')
      vibrar(200)
      evento('aparecer', { elemento: document.querySelector('.dz-ahora') })
    }, 1000)
  }

  $('#form-accion').addEventListener('submit', (e) => { e.preventDefault(); contar() })
  $('#accion').addEventListener('input', () => { compromisoId = null })
  $('#empece').onclick = seguro(async () => {
    const datos = { accion: $('#accion').value.trim() }
    if (compromisoId) datos.compromisoId = compromisoId
    if (idGuardado) datos.id = idGuardado
    const r = await api('/api/desafios/inicios', datos)
    evento('completar', { elemento: $('#empece') })
    mensaje(r.xp > 0 ? `Empezaste. +${r.xp} XP` : `Empezaste. ${r.motivoSinXp || ''}`)
    setTimeout(() => { location.href = volver }, 900)
  })
  $('#no-empece').onclick = () => { location.href = volver }

  // Las últimas acciones, para tocar y no escribir de nuevo.
  seguro(async () => {
    const { inicios } = await api('/api/desafios/inicios')
    const vistas = [...new Set(inicios.map((i) => i.accion))].slice(0, 6)
    $('#ultimas').innerHTML = ''
    for (const a of vistas) {
      const b = document.createElement('button')
      b.type = 'button'; b.textContent = a
      b.onclick = () => { $('#accion').value = a; compromisoId = null }
      $('#ultimas').appendChild(b)
    }
  })()

  if (p.get('accion')) $('#accion').value = p.get('accion').slice(0, 120)
  if (p.get('auto') && p.get('accion')) contar()
  else $('#accion').focus()
})()
