// Editar una rutina, igual que la v0.88.27 (EditarRutina de Rutinas.tsx): nombre, días, duración y si está
// activa; los bloques en orden, cada uno se abre para editarlo; sumar ejercicio, temporizador, rondas o casilla.
// Se guarda solo (PUT /api/entreno/rutinas/:id) y, si algo no se acepta, queda un borrador en este celu.
// También: «¿Es el mismo ejercicio?», sumar un ejercicio a otras rutinas y ver su progreso.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const id = new URLSearchParams(location.search).get('id')
  const idUrl = encodeURIComponent(id || '')
  const BORRADOR = 'sek-borrador-rutina-' + id
  const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']]
  const kg = (p) => (!p ? 'peso corporal' : `${String(p).replace('.', ',')} kg`)
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  let rutina = null
  let detalle = { otras: [], enlaces: {}, preguntas: [] }
  let abierto = null
  let timer = null
  let enCurso = false

  function descripcion(b) {
    if (b.tipo === 'ejercicio') return `${b.series} × ${b.reps}${b.repsExtra ? ` + ${b.repsExtra}${b.admiteAyuda ? ' ayuda' : ''}` : ''} · ${kg(b.peso)} · ${mmss(b.descanso || 0)}`
    if (b.tipo === 'rondas') return b.rondas.map((x) => `${x.segundos} s`).join(' + ')
    if (b.tipo === 'casilla') return 'casilla'
    return `${b.segundos} s${b.peso ? ` · ${b.peso} kg` : ''}`
  }

  // ---------- Guardado automático ----------
  function estado(texto, clase) { const e = $('#guardado'); if (!e) return; e.textContent = texto; e.className = `guardado-auto ${clase}` }
  function programar(ya) {
    clearTimeout(timer)
    try { localStorage.setItem(BORRADOR, JSON.stringify(rutina)) } catch (e) { /* sin lugar: igual se guarda */ }
    estado('Guardando…', 'guardando')
    timer = setTimeout(guardar, ya ? 0 : 1000)
  }
  async function guardar() {
    clearTimeout(timer)
    try {
      detalle = await api('/api/entreno/rutinas/' + idUrl, rutina, 'PUT')
      // En el lugar: conectar() y los editores abiertos guardan referencias a estos objetos.
      rutina.bloques.forEach((b) => { const x = detalle.rutina.bloques.find((y) => y.id === b.id); if (x) Object.assign(b, x) })
      try { localStorage.removeItem(BORRADOR) } catch (e) { /* nada */ }
      estado('✓ Se guarda solo', 'listo')
      pintarEnlaces()
    } catch (e) {
      estado(`Sin guardar: ${e.message}. Lo que escribiste queda en el teléfono hasta que lo corrijas.`, 'error')
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) guardar() })

  // ---------- Pantalla ----------
  const num = (etq, campo, valor, paso = 1) => `<div class="campo"><label>${etq}</label><input type="number" inputmode="decimal" step="${paso}" value="${valor ?? 0}" data-num="${campo}"></div>`
  function editor(b) {
    const enlazadas = detalle.enlaces[b.id] || []
    let h = `<div class="col" style="gap: 8px; margin-top: 6px;">
      <div class="campo"><label>Nombre</label><input value="${esc(b.nombre)}" data-txt="nombre"></div>
      ${enlazadas.length ? `<p class="enlace-aviso">🔗 Es el mismo ejercicio que en ${esc(enlazadas.join(', '))}: lo que cambies o mejores acá se actualiza allá también.</p>` : ''}`
    if (b.tipo === 'ejercicio') {
      h += `<div class="rejilla-2">
          <div class="campo"><label>Grupo</label><input value="${esc(b.grupo || '')}" data-txt="grupo"></div>
          ${num('Series', 'series', b.series)}${num('Reps actuales', 'reps', b.reps)}${num(b.admiteAyuda ? 'Con ayuda (+)' : 'Extra (+)', 'repsExtra', b.repsExtra)}
          ${num('Reps tope', 'repsTope', b.repsTope)}${num('Peso (kg, 0 = corporal)', 'peso', b.peso, 0.5)}${num('Descanso (s)', 'descanso', b.descanso, 15)}${num('Sombra (s)', 'sombra', b.sombra, 5)}
        </div>
        <div class="campo"><label>Nota</label><input value="${esc(b.nota || '')}" data-txt="nota"></div>
        <label class="fila" style="gap: 8px;"><input type="checkbox" data-chk="admiteAyuda" ${b.admiteAyuda ? 'checked' : ''}><span>Admite reps con ayuda <span class="texto-3 chico">(se anotan aparte: «8 +3 ayuda»; no cuentan para récord ni para subir peso, sí para el volumen)</span></span></label>
        <p class="ayuda"><b>Reps actuales</b>: las que hiciste la vez pasada en la serie 1 con ${kg(b.peso)}${b.tramoDesde ? ` (desde el ${b.tramoDesde.slice(8)}/${b.tramoDesde.slice(5, 7)})` : ''}; cada vez que las superás es récord y quedan las nuevas. Al llegar a ${b.repsTope}, subís el peso: ahí empieza un tramo nuevo y la primera sesión fija las reps actuales.</p>`
    }
    if (b.tipo === 'calentamiento' || b.tipo === 'temporizador') {
      const crono = b.tipo === 'temporizador' && b.modo === 'cronometro'
      h += `<div class="rejilla-2">${num(crono ? 'Objetivo (s) · sube 1 s solo al superarlo' : 'Segundos', 'segundos', b.segundos, crono ? 1 : 5)}${num('Peso (kg)', 'peso', b.peso, 0.5)}
        ${crono ? num('Descanso después, sin sombra (s)', 'descansoDespues', b.descansoDespues ?? 60, 15) : ''}
        ${b.tipo === 'temporizador' ? `<div class="campo"><label>Tipo</label><button type="button" class="boton" data-modo>${crono ? 'Cronómetro (cuenta para arriba)' : 'Cuenta regresiva'}</button></div>` : ''}</div>`
    }
    if (b.tipo === 'rondas') {
      h += b.rondas.map((x, i) => `<div class="rejilla-2"><div class="campo"><label>Ronda ${i + 1} (s)</label><input type="number" inputmode="decimal" step="5" value="${x.segundos}" data-ronda="${i}" data-r="segundos"></div>
        <div class="campo"><label>Texto</label><input value="${esc(x.texto)}" data-ronda="${i}" data-r="texto"></div></div>`).join('')
      h += `<div class="rejilla-2">${num('Descanso entre rondas (s)', 'descansoEntre', b.descansoEntre ?? 60, 15)}
        <div class="campo"><label>Rondas</label><div class="fila" style="gap: 6px;"><button type="button" class="boton chico" data-mas-ronda>+ ronda</button><button type="button" class="boton chico" data-menos-ronda ${b.rondas.length <= 1 ? 'disabled' : ''}>− ronda</button></div></div></div>`
    }
    const sumar = (b.tipo === 'ejercicio' || b.tipo === 'temporizador') && detalle.otras.some((o) => !(detalle.enlaces[b.id] || []).includes(o.nombre))
    h += `<div class="botonera">${b.tipo === 'ejercicio' ? '<button type="button" class="boton" data-grafico>Ver progreso</button>' : ''}${sumar ? '<button type="button" class="boton" data-sumar>🔗 Sumar a otra rutina</button>' : ''}
      <button type="button" class="boton peligro" data-quitar>${enlazadas.length ? 'Quitar de esta rutina' : 'Quitar'}</button></div></div>`
    return h
  }

  function pintar() {
    const r = rutina
    $('#caja').innerHTML = `<section class="tarjeta">
        <div class="campo"><label for="r-nombre">Nombre</label><input id="r-nombre" value="${esc(r.nombre)}"></div>
        <div class="campo"><label>Días</label><div class="dias-semana">${DIAS.map(([d, t]) => `<button type="button" class="${r.dias.includes(d) ? 'activo' : ''}" data-dia="${d}" aria-pressed="${r.dias.includes(d)}">${t}</button>`).join('')}</div></div>
        <div class="rejilla-2">
          <div class="campo"><label for="r-min">Duración (min)</label><input id="r-min" type="number" inputmode="numeric" value="${r.minutos}"></div>
          <div class="campo"><label>Activa</label><button type="button" class="boton ${r.activa ? 'ok' : ''}" id="r-activa">${r.activa ? 'Sí' : 'Pausada'}</button></div>
        </div>
      </section>
      <div id="preguntas" class="col" style="gap: 8px;"></div>
      <span class="seccion-titulo">Bloques en orden</span>
      <div class="col" style="gap: 8px;" id="bloques">${r.bloques.map((b, i) => `<div class="tarjeta compacta bloque-ed ${esc(b.tipo)}" data-id="${esc(b.id)}">
          <div class="fila"><button type="button" class="crece bloque-ed-cab" data-abrir><span class="texto-3 mono chico">${i + 1}</span> <b>${esc(b.nombre)}</b><span class="texto-3 chico"> · ${esc(descripcion(b))}</span><span class="enlace-chip" data-chip hidden></span></button>
            <button type="button" class="boton chico suave" aria-label="Subir" data-mover="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="boton chico suave" aria-label="Bajar" data-mover="1" ${i === r.bloques.length - 1 ? 'disabled' : ''}>↓</button></div>
          ${abierto === b.id ? editor(b) : ''}</div>`).join('') || '<p class="vacio">Sumá ejercicios y demás con los botones de abajo.</p>'}</div>
      <div class="rejilla-2">
        <button type="button" class="boton" data-nuevo="ejercicio">+ Ejercicio</button><button type="button" class="boton" data-nuevo="temporizador">+ Temporizador</button>
        <button type="button" class="boton" data-nuevo="rondas">+ Rondas</button><button type="button" class="boton" data-nuevo="casilla">+ Casilla</button>
      </div>
      <p class="ayuda">Los cambios valen desde el próximo entreno.${enCurso ? ' Tenés esta rutina en curso: si la cambiás ahora, el entreno de hoy ya toma los cambios.' : ''}</p>
      <p class="guardado-auto listo" role="status" id="guardado">✓ Se guarda solo</p>
      <button type="button" class="boton suave ancho" id="borrar">Borrar rutina</button>`
    conectar()
    pintarEnlaces()
  }

  function pintarEnlaces() {
    document.querySelectorAll('.bloque-ed').forEach((el) => {
      const n = (detalle.enlaces[el.dataset.id] || []).length
      const chip = el.querySelector('[data-chip]')
      chip.hidden = !n
      chip.textContent = n ? `🔗 En ${n + 1} rutinas` : ''
    })
    const caja = $('#preguntas')
    if (!caja) return
    caja.innerHTML = detalle.preguntas.map((p, i) => `<section class="tarjeta compacta col" style="gap: 8px;"><p style="margin: 0;">«${esc(p.nombre)}» ya está en <b>${esc(p.otraRutina)}</b>. ¿Es el mismo ejercicio?</p>
      <p class="texto-2 chico" style="margin: 0;">Si es el mismo, se enlazan: desde ahora se actualizan juntos, con un solo historial.</p>
      <button type="button" class="boton primario" data-si="${i}">Sí, el mismo: se actualiza en las dos</button><button type="button" class="boton" data-no="${i}">No, es otro</button></section>`).join('')
    const responder = (p, si) => seguro(async () => {
      await guardar()
      detalle = await api(`/api/entreno/rutinas/${idUrl}/es-el-mismo`, { bloqueId: p.bloqueId, otroBloqueId: p.otroBloqueId, esElMismo: si })
      rutina = detalle.rutina
      if (si) avisar(`Enlazado con ${p.otraRutina}: se actualizan juntos.`, { tipo: 'ok' })
      pintar()
    })
    caja.querySelectorAll('[data-si]').forEach((b) => { b.onclick = responder(detalle.preguntas[Number(b.dataset.si)], true) })
    caja.querySelectorAll('[data-no]').forEach((b) => { b.onclick = responder(detalle.preguntas[Number(b.dataset.no)], false) })
  }

  function nuevoBloque(tipo) {
    const nid = (tipo === 'ejercicio' ? 'ej-' : 'bl-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    if (tipo === 'ejercicio') return { id: nid, tipo, nombre: 'Nuevo ejercicio', series: 2, reps: 8, repsTope: 12, peso: 0, descanso: 90, sombra: 30 }
    if (tipo === 'rondas') return { id: nid, tipo, nombre: 'Rondas', rondas: [{ segundos: 60, texto: 'Ronda 1' }, { segundos: 60, texto: 'Ronda 2' }], descansoEntre: 60 }
    if (tipo === 'casilla') return { id: nid, tipo, nombre: 'Nueva casilla' }
    return { id: nid, tipo: 'temporizador', nombre: 'Temporizador', segundos: 60, modo: 'cuenta' }
  }

  function conectar() {
    const r = rutina
    $('#r-nombre').oninput = (e) => { r.nombre = e.target.value; programar() }
    $('#r-min').oninput = (e) => { r.minutos = Number(e.target.value) || 0; programar() }
    $('#r-activa').onclick = (e) => { r.activa = !r.activa; e.target.classList.toggle('ok', r.activa); e.target.textContent = r.activa ? 'Sí' : 'Pausada'; programar(true) }
    document.querySelectorAll('[data-dia]').forEach((b) => {
      b.onclick = () => {
        const d = Number(b.dataset.dia)
        r.dias = r.dias.includes(d) ? r.dias.filter((x) => x !== d) : [...r.dias, d]
        b.classList.toggle('activo', r.dias.includes(d)); b.setAttribute('aria-pressed', String(r.dias.includes(d)))
        programar()
      }
    })
    document.querySelectorAll('[data-nuevo]').forEach((btn) => {
      btn.onclick = () => {
        const nb = nuevoBloque(btn.dataset.nuevo)
        // Los ejercicios van antes del kick boxing; lo demás, al final (antes de estirar).
        const k = nb.tipo === 'ejercicio' ? r.bloques.findIndex((b) => b.tipo === 'rondas') : r.bloques.findIndex((b) => b.tipo === 'casilla')
        r.bloques.splice(k >= 0 ? k : r.bloques.length, 0, nb)
        abierto = nb.id
        pintar(); programar(true)
      }
    })
    $('#borrar').onclick = () => confirmar('¿Borrar esta rutina?', `«${r.nombre}» deja de aparecer en tus rutinas y en el entreno. Los entrenos que ya hiciste con ella quedan guardados en el historial, con sus récords.`, 'Sí, borrar', async () => {
      clearTimeout(timer)
      const x = await api('/api/entreno/rutinas/' + idUrl, undefined, 'DELETE')
      try { localStorage.removeItem(BORRADOR) } catch (e) { /* nada */ }
      avisar(x.resultado === 'eliminada' ? 'Rutina borrada' : 'Rutina borrada. Sus entrenos siguen en el historial.', { tipo: 'ok' })
      setTimeout(() => { location.href = '/entreno' }, 700)
    })
    document.querySelectorAll('.bloque-ed').forEach((el) => {
      const i = r.bloques.findIndex((b) => b.id === el.dataset.id)
      const b = r.bloques[i]
      el.querySelector('[data-abrir]').onclick = () => { abierto = abierto === b.id ? null : b.id; pintar() }
      el.querySelectorAll('[data-mover]').forEach((m) => {
        m.onclick = () => { const j = i + Number(m.dataset.mover); [r.bloques[i], r.bloques[j]] = [r.bloques[j], r.bloques[i]]; pintar(); programar(true) }
      })
      if (abierto !== b.id) return
      el.querySelectorAll('[data-txt]').forEach((x) => { x.oninput = () => { b[x.dataset.txt] = x.value || (x.dataset.txt === 'nombre' ? '' : undefined); programar() } })
      el.querySelectorAll('[data-num]').forEach((x) => {
        x.oninput = () => {
          const k = x.dataset.num, v = Number(x.value)
          b[k] = (k === 'repsExtra' || (k === 'peso' && b.tipo !== 'ejercicio')) ? (v > 0 ? v : undefined) : v
          programar()
        }
      })
      el.querySelectorAll('[data-chk]').forEach((x) => { x.onchange = () => { b[x.dataset.chk] = x.checked || undefined; programar(); pintar() } })
      el.querySelectorAll('[data-r]').forEach((x) => { x.oninput = () => { const k = Number(x.dataset.ronda); b.rondas[k][x.dataset.r] = x.dataset.r === 'segundos' ? Number(x.value) : x.value; programar() } })
      const q = (s) => el.querySelector(s)
      if (q('[data-modo]')) q('[data-modo]').onclick = () => { b.modo = b.modo === 'cronometro' ? 'cuenta' : 'cronometro'; pintar(); programar(true) }
      if (q('[data-mas-ronda]')) q('[data-mas-ronda]').onclick = () => { b.rondas.push({ segundos: 60, texto: `Ronda ${b.rondas.length + 1}` }); pintar(); programar(true) }
      if (q('[data-menos-ronda]')) q('[data-menos-ronda]').onclick = () => { b.rondas.pop(); pintar(); programar(true) }
      q('[data-quitar]').onclick = () => { r.bloques.splice(i, 1); abierto = null; pintar(); programar(true) }
      if (q('[data-grafico]')) q('[data-grafico]').onclick = () => progreso(b)
      if (q('[data-sumar]')) q('[data-sumar]').onclick = () => sumarAOtra(b)
      q('[data-txt="nombre"]').onblur = () => { if (timer) guardar() }
    })
  }

  function sumarAOtra(b) {
    let elegidas = []
    const otras = detalle.otras.filter((o) => !(detalle.enlaces[b.id] || []).includes(o.nombre))
    const h = hoja('Sumar a otra rutina', '<div class="col" style="gap: 10px;" data-caja></div>')
    const caja = h.el.querySelector('[data-caja]')
    const pintarH = () => {
      caja.innerHTML = `<p class="texto-2 chico">Elegí a cuáles. Queda el mismo ejercicio en todas: lo que mejores en una (objetivo, peso, reps) se actualiza en las otras, y el historial es uno solo.</p>
        ${otras.map((o) => `<button type="button" class="boton ancho enlace-opcion ${elegidas.includes(o.id) ? 'ok' : ''}" aria-pressed="${elegidas.includes(o.id)}" data-o="${esc(o.id)}">${elegidas.includes(o.id) ? '✓ ' : ''}${esc(o.nombre)}</button>`).join('')}
        <p class="ayuda">Se pone en el mismo lugar que acá (por ejemplo, antes del kick boxing); después lo podés mover.</p>
        <button type="button" class="boton primario" data-ok ${elegidas.length ? '' : 'disabled'}>Sumar</button>`
      caja.querySelectorAll('[data-o]').forEach((x) => { x.onclick = () => { const o = x.dataset.o; elegidas = elegidas.includes(o) ? elegidas.filter((y) => y !== o) : [...elegidas, o]; pintarH() } })
      caja.querySelector('[data-ok]').onclick = seguro(async () => {
        await guardar()
        const res = await api(`/api/entreno/rutinas/${idUrl}/sumar-bloque`, { bloqueId: b.id, destinos: elegidas })
        detalle = res
        h.cerrar()
        avisar(res.sumadas === 1 ? 'Sumado a 1 rutina: quedan enlazados.' : `Sumado a ${res.sumadas} rutinas: quedan enlazados.`, { tipo: 'ok' })
        pintar()
      })
    }
    pintarH()
  }

  /** «Ver progreso»: peso de cada entreno (barras) y repeticiones totales (línea), como GraficoEjercicio. */
  async function progreso(b) {
    const h = hoja(b.nombre, '<p class="vacio">Cargando…</p>')
    const cuerpo = h.el.querySelector('.hoja-cuerpo')
    try {
      const d = await api('/api/entreno/ejercicios/' + encodeURIComponent(b.id))
      const pts = d.puntos.map((p) => ({ ...p, total: p.series.reduce((t, x) => t + x.reps + (x.repsExtra || 0), 0) }))
      let svg = ''
      if (pts.length) {
        const W = 320, H = 140, pi = 30, pd = 30, pa = 14, pb = 22, ancho = W - pi - pd, alto = H - pa - pb
        const maxP = Math.max(1, ...pts.map((p) => p.peso)), maxR = Math.max(1, ...pts.map((p) => p.total)), minR = Math.min(...pts.map((p) => p.total))
        const rango = Math.max(1, maxR - Math.min(minR, maxR - 4)), base = maxR - rango, paso = ancho / pts.length
        const x = (i) => pi + paso * i + paso / 2, y = (r) => pa + alto - ((r - base) / rango) * alto * 0.9
        svg = `<svg class="grafico-ejercicio" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Progreso en ${pts.length} entrenos">
          <line x1="${pi}" x2="${W - pd}" y1="${pa + alto}" y2="${pa + alto}" class="eje"></line>
          ${pts.map((p, i) => { const hh = p.peso ? (p.peso / maxP) * alto * 0.85 : 2; return `<rect x="${x(i) - Math.min(14, paso * 0.32)}" width="${Math.min(28, paso * 0.64)}" y="${pa + alto - hh}" height="${hh}" rx="3" class="barra-peso ${p.record ? 'record' : ''}"></rect>` }).join('')}
          <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')}" class="linea-reps" fill="none"></path>
          ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.total)}" r="3.5" class="punto-reps"></circle>${p.record ? `<text x="${x(i)}" y="${y(p.total) - 8}" text-anchor="middle" class="estrella">★</text>` : ''}`).join('')}
          <text x="${pi - 4}" y="${pa + 8}" text-anchor="end" class="etq">${String(maxP).replace('.', ',')}</text><text x="${pi - 4}" y="${pa + 20}" text-anchor="end" class="etq">kg</text>
          <text x="${W - pd + 4}" y="${y(maxR) + 4}" class="etq reps">${maxR}</text><text x="${W - pd + 4}" y="${y(maxR) + 16}" class="etq reps">reps</text>
          ${pts.map((p, i) => (pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="etq">${p.fecha.slice(8)}/${p.fecha.slice(5, 7)}</text>` : '')).join('')}
        </svg><p class="ayuda">Barras: peso de cada entreno · línea: repeticiones totales · ★ récord.</p>`
      }
      cuerpo.innerHTML = `<div class="fila entre"><span class="texto-2">Récord <span class="texto-3 chico">(mejor serie)</span></span><b class="mono">${d.record ? `${d.record.reps} reps · ${kg(d.record.peso)}` : '—'}</b></div>
        ${svg || '<p class="ayuda">Todavía no hay entrenos con este ejercicio. Después del primero vas a ver acá cómo suben el peso y las repeticiones.</p>'}`
    } catch (e) { cuerpo.innerHTML = `<p class="ayuda">${esc(e.message)}</p>` }
  }

  seguro(async () => {
    if (!id) { $('#caja').innerHTML = '<p class="vacio">Esta rutina ya no está.</p>'; return }
    try { detalle = await api('/api/entreno/rutinas/' + idUrl) } catch (e) { $('#caja').innerHTML = '<p class="vacio">Esta rutina ya no está.</p>'; return }
    rutina = detalle.rutina
    let borrador = null
    try { borrador = JSON.parse(localStorage.getItem(BORRADOR) || 'null') } catch (e) { /* nada */ }
    const en = await api('/api/entreno/en-curso').catch(() => null)
    enCurso = !!(en && en.vista && en.vista.rutina.id === id)
    pintar()
    if (borrador && borrador.id === rutina.id) { rutina = borrador; pintar(); programar(true) }
  })()
})()
