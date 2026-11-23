// El entreno en curso. Todo vive en el servidor (cerrar la app no lo pierde); los relojes corren acá
// con la hora del servidor (vista.ahora) para no desfasarse.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const kg = (p) => (p === 0 ? 'peso corporal' : `${String(p).replace('.', ',')} kg`)
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
  let vista = null
  let desfase = 0 // hora del servidor − hora de este aparato
  let avisado = false
  const ahora = () => Date.now() + desfase

  async function accion(nombre, datos) {
    const r = await api(`/api/entreno/sesiones/${vista.sesion.id}/${nombre}`, datos || {})
    pintar(r.vista)
    return r.resultado
  }

  function pintar(v) {
    vista = v
    desfase = v.ahora - Date.now()
    avisado = false
    const s = v.sesion
    const terminada = s.estado === 'terminada'
    $('#sin-entreno').hidden = true
    $('#titulo').textContent = '鍛 ' + v.rutina.nombre
    $('#minutos').textContent = `${v.minutos} min`
    $('#acciones').hidden = terminada
    pintarActual()
    pintarLista()
    if (terminada && $('#resumen').hidden) pintarTerminada()
    tic()
  }

  function pintarActual() {
    const v = vista
    const cont = $('#actual')
    const b = v.bloques.find((x) => x.id === v.actual)
    if (v.sesion.estado === 'terminada' || !b) {
      cont.hidden = v.sesion.estado === 'terminada'
      if (!b && v.sesion.estado !== 'terminada') cont.innerHTML = '<h2>¡Todo hecho!</h2><p class="chico">Tocá «Terminar entreno» para guardar.</p>'
      return
    }
    cont.hidden = false
    let html = `<div class="fila entre"><h2>${esc(b.nombre)}</h2>${b.grupo ? `<span class="chico">${esc(b.grupo)}</span>` : ''}</div>${b.nota ? `<p class="chico">${esc(b.nota)}</p>` : ''}`
    const reloj = v.sesion.reloj && v.sesion.reloj.bloqueId === b.id
    if (b.tipo === 'ejercicio') {
      const n = b.hechas.length + 1
      html += `<p>Serie <b>${Math.min(n, b.series)}</b> de ${b.series} · objetivo <b>${b.objetivo ?? '-'}</b> reps${b.repsExtra ? ` + ${b.repsExtra}${b.admiteAyuda ? ' con ayuda' : ''}` : ''}</p>`
      if (b.sugerencia) html += `<p class="chico ${b.sugerencia.subirPeso ? 'aviso' : ''}">${esc(b.sugerencia.texto)}</p>`
      if (b.ultimaVez.length) html += `<p class="chico">La vez pasada: ${b.ultimaVez.map((x) => `${x.reps}${x.repsExtra ? '+' + x.repsExtra : ''}${x.ayuda ? '+' + x.ayuda + 'a' : ''}`).join(' · ')} con ${kg(b.ultimaVez[0].peso)}</p>`
      html += `<div class="campos numero">
        <label>Peso de hoy (kg)<input id="peso" type="number" inputmode="decimal" min="0" step="any" value="${b.pesoHoy}"></label>
        <label>Reps<input id="reps" type="number" inputmode="numeric" min="0" value="${b.objetivo ?? b.reps}"></label>
        ${b.repsExtra ? `<label>${b.admiteAyuda ? 'Con ayuda' : 'Extra'}<input id="extra" type="number" inputmode="numeric" min="0" value="${b.repsExtra}"></label>` : ''}
      </div>
      <button class="principal" id="serie-hecha">Serie hecha</button>`
      if (b.hechas.length) html += `<div class="series-hechas">${b.hechas.map((x) => `<span>S${x.n}: ${x.reps}${x.repsExtra ? '+' + x.repsExtra : ''}${x.ayuda ? '+' + x.ayuda + 'a' : ''} · ${kg(x.peso)}</span>`).join('')}</div>`
    } else if (b.tipo === 'casilla') {
      html += '<button class="principal" id="hecho">Hecho</button>'
    } else if (b.tipo === 'temporizador' && b.modo === 'cronometro') {
      html += `<p class="chico">Objetivo: ${b.segundos} s · ${kg(b.peso ?? 0)}</p>`
      html += reloj
        ? `<div class="cronometro" id="reloj">0</div><label>Peso (kg)<input id="peso-crono" type="number" inputmode="decimal" min="0" step="any" value="${b.peso ?? 0}"></label><button class="principal" id="listo">Listo</button><button class="mini" id="saltar-prep">Ya estoy colgado</button>`
        : '<button class="principal" id="empezar-reloj">Empezar</button>'
    } else {
      html += reloj
        ? `<div class="fase" id="reloj-texto"></div><div class="cronometro" id="reloj">0:00</div><div class="botones"><button class="mini" id="saltar-prep">Saltar preparación</button><button class="mini" id="parar">Parar</button><button class="principal" id="hecho">Hecho</button></div>`
        : `<p class="chico">${b.tipo === 'rondas' ? `${b.rondas.length} ronda${b.rondas.length === 1 ? '' : 's'} de ${mmss(b.rondas[0].segundos)}` : mmss(b.segundos * (b.veces ?? 1))}</p><div class="botones"><button class="principal" id="empezar-reloj">Empezar</button><button id="hecho">Ya lo hice</button></div>`
    }
    html += '<div class="botones"><button class="mini" id="saltar">Saltar</button>' + (vista.sesion.series.length ? '<button class="mini" id="deshacer">Deshacer última serie</button>' : '') + '</div>'
    cont.innerHTML = html
    const en = (sel, fn) => { const el = cont.querySelector(sel); if (el) el.onclick = seguro(fn) }
    en('#serie-hecha', async () => {
      const ex = cont.querySelector('#extra')
      await accion('serie', { bloqueId: b.id, reps: Number($('#reps').value), peso: Number($('#peso').value), ...(ex ? (b.admiteAyuda ? { ayuda: Number(ex.value) } : { repsExtra: Number(ex.value) }) : {}) })
    })
    const peso = cont.querySelector('#peso')
    if (peso) peso.onchange = seguro(() => accion('peso', { bloqueId: b.id, peso: Number(peso.value) }))
    en('#hecho', () => accion('marcar', { bloqueId: b.id }))
    en('#empezar-reloj', () => accion('reloj', { bloqueId: b.id }))
    en('#saltar-prep', () => accion('saltar-preparacion'))
    en('#parar', () => accion('parar-reloj'))
    en('#saltar', () => accion('saltar', { bloqueId: b.id }))
    en('#deshacer', () => accion('deshacer'))
    en('#listo', async () => {
      const r = await accion('cronometro', { bloqueId: b.id, peso: Number($('#peso-crono').value) })
      mensaje(`${r.tiempo.segundos} s${r.subio ? ` · ¡récord! Objetivo nuevo: ${r.objetivo} s` : ''}`)
      if (r.subio) SEK.evento('logro', { modulo: 'entreno' })
    })
  }

  function pintarLista() {
    const v = vista
    $('#bloques').innerHTML = ''
    v.bloques.forEach((b, i) => {
      const div = document.createElement('div')
      div.className = 'item' + (b.id === v.actual ? ' actual' : '') + (b.saltado ? ' saltado' : b.terminado ? ' terminado' : '')
      const detalle = b.tipo === 'ejercicio' ? `${b.hechas.length}/${b.series} series · ${kg(b.pesoHoy)}` : b.tipo === 'temporizador' && b.modo === 'cronometro' && b.tiempo ? `${b.tiempo.segundos} s` : ''
      div.innerHTML = `<div class="texto"><b>${esc(b.nombre)}</b><span class="chico">${detalle}</span></div>`
      if (v.sesion.estado !== 'terminada') {
        const botones = document.createElement('div')
        botones.className = 'botones'
        botones.innerHTML = `<button class="mini" data-m="-1" ${i === 0 ? 'disabled' : ''} aria-label="Antes">↑</button><button class="mini" data-m="1" ${i === v.bloques.length - 1 ? 'disabled' : ''} aria-label="Después">↓</button>${b.id !== v.actual ? '<button class="mini" data-ir>Ir</button>' : ''}`
        botones.onclick = seguro(async (e) => {
          const btn = e.target.closest('button')
          if (!btn) return
          if (btn.dataset.m) await accion('mover', { bloqueId: b.id, delta: Number(btn.dataset.m) })
          else { await accion('ir', { bloqueId: b.id }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
        })
        div.appendChild(botones)
      }
      $('#bloques').appendChild(div)
    })
  }

  function pintarTerminada(resultado) {
    const s = vista.sesion
    const cont = $('#resumen')
    cont.hidden = false
    let html = '<h2>Entreno terminado</h2>'
    if (resultado) {
      const r = resultado.resumen
      html += `<p>${r.minutos} min · ${r.series} series · ${r.volumen} kg movidos</p>`
      html += r.ejercicios.map((e) => `<p class="chico">${esc(e.nombre)}: ${e.marca.reps} con ${kg(e.marca.peso)}${e.record ? ' <span class="record">★ récord +5</span>' : ''}${e.subioPeso ? ' <span class="record">▲ subiste el peso +10</span>' : ''}</p>`).join('')
      html += resultado.xpExtra ? `<p class="record">+${resultado.xpExtra} XP extra por mejorar</p>` : resultado.motivoSinXp ? `<p class="chico">${esc(resultado.motivoSinXp)}</p>` : ''
    } else {
      html += `<p class="chico">${s.series.length} series${s.xpExtra ? ` · +${s.xpExtra} XP extra` : ''}</p>`
    }
    html += '<div class="botones"><a class="boton principal" href="/entreno">Listo</a><button id="reabrir">Reabrir para corregir</button></div>'
    cont.innerHTML = html
    cont.querySelector('#reabrir').onclick = seguro(async () => { cont.hidden = true; await accion('reabrir'); mensaje('Entreno reabierto: el XP extra vuelve cuando lo termines.') })
  }

  function tic() {
    if (!vista) return
    const t = ahora()
    const s = vista.sesion
    // Descanso
    const d = s.descanso
    let enDescanso = false
    if (d) {
      let pasado = (t - d.inicio) / 1000
      for (const f of d.fases) {
        if (pasado < f.segundos) {
          enDescanso = true
          const total = d.fases.reduce((a, x) => a + x.segundos, 0) - (t - d.inicio) / 1000
          $('#descanso-fase').textContent = f.texto
          $('#descanso-reloj').textContent = f.tipo === 'preparar' ? String(Math.ceil(f.segundos - pasado)) : mmss(f.segundos - pasado)
          $('#descanso').className = 'tarjeta descanso' + (f.tipo === 'sombra' ? ' sombra' : '') + (total <= vista.constantes.AVISO_FIN_DESCANSO_S ? ' alistarse' : '')
          if (total <= vista.constantes.AVISO_FIN_DESCANSO_S && !avisado) { avisado = true; try { navigator.vibrate && navigator.vibrate(200) } catch (e) { /* nada */ } }
          break
        }
        pasado -= f.segundos
      }
      const sig = vista.bloques.find((b) => b.id === vista.actual)
      $('#descanso-siguiente').textContent = sig ? 'Sigue: ' + sig.nombre : ''
    }
    $('#descanso').hidden = !enDescanso
    // Reloj del bloque
    const r = s.reloj
    const el = document.getElementById('reloj')
    if (r && el) {
      const b = vista.bloques.find((x) => x.id === r.bloqueId)
      const pasado = (t - r.inicio) / 1000
      const textoEl = document.getElementById('reloj-texto')
      if (b && b.tipo === 'temporizador' && b.modo === 'cronometro') {
        const prep = vista.constantes.PREPARACION_S
        el.textContent = pasado < prep ? `Colgate en ${Math.ceil(prep - pasado)}` : String(Math.floor(pasado - prep))
      } else if (pasado < 0) {
        el.textContent = String(Math.ceil(-pasado))
        if (textoEl) textoEl.textContent = 'Preparate'
      } else if (b && b.tipo === 'rondas') {
        let p = pasado
        let hecho = true
        for (const x of b.tramos) {
          if (p < x.segundos) { el.textContent = mmss(x.segundos - p); if (textoEl) textoEl.textContent = x.descanso ? 'Descanso' : `Ronda ${x.ronda + 1}: ${x.texto}`; hecho = false; break }
          p -= x.segundos
        }
        if (hecho) { el.textContent = '0:00'; if (textoEl) textoEl.textContent = '¡Listo! Tocá Hecho' }
      } else {
        el.textContent = mmss(r.segundos - pasado)
        if (textoEl) textoEl.textContent = r.segundos - pasado <= 0 ? '¡Listo! Tocá Hecho' : b ? b.nombre : ''
      }
    }
  }

  $('#fin-descanso').onclick = seguro(() => accion('fin-descanso'))
  $('#alargar').onclick = seguro(() => accion('alargar', { segundos: 30 }))
  $('#terminar').onclick = seguro(async () => {
    const r = await accion('terminar')
    pintarTerminada(r)
    if (r.xpExtra) SEK.evento('logro', { modulo: 'entreno' })
    SEK.evento('completar', { modulo: 'entreno' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  const dosToques = (btn, texto, fn) => seguro(async () => {
    if (btn.dataset.seguro !== '1') { btn.dataset.seguro = '1'; btn.textContent = texto; setTimeout(() => { btn.dataset.seguro = ''; btn.textContent = btn.dataset.original }, 4000); return }
    await fn()
  })
  for (const b of document.querySelectorAll('#acciones button')) b.dataset.original = b.textContent
  $('#reiniciar').onclick = dosToques($('#reiniciar'), '¿Seguro? Borra lo de hoy', async () => { await accion('reiniciar'); $('#reiniciar').textContent = $('#reiniciar').dataset.original; $('#reiniciar').dataset.seguro = '' })
  $('#descartar').onclick = dosToques($('#descartar'), '¿Seguro? Se borra el entreno', async () => {
    await api(`/api/entreno/sesiones/${vista.sesion.id}`, undefined, 'DELETE')
    location.href = '/entreno'
  })

  seguro(async () => {
    const id = new URLSearchParams(location.search).get('id')
    const v = id ? await api('/api/entreno/sesiones/' + encodeURIComponent(id)) : (await api('/api/entreno/en-curso')).vista
    if (!v) { $('#sin-entreno').hidden = false; $('#todos').hidden = true; return }
    pintar(v)
    setInterval(tic, 250)
  })()
  barra('entreno')
})()
