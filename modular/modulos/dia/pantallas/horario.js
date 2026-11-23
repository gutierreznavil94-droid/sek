// Mi horario, igual que la v0.88.27 (MiHorario.tsx): la grilla de la semana con los bloques fijos, el entreno
// y el dormir; tocar un bloque lo edita, mantenerlo apretado lo copia a otros días. «+ Bloque», plantillas
// (Cursada, Trabajo, Entreno) y los horarios guardados (cambiar, renombrar, crear, borrar). Pide a /api/dia/horario.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar } = SEK.v88
  SEK.v88.montar({ activo: 'calendario', companero: 'esquina' })
  const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0]
  const CORTO = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']
  const LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const H0 = 6, H1 = 24, PX = 22
  const ID_ENTRENO = 'entreno'
  const min = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m }
  const y = (hm) => ((min(hm) - H0 * 60) / 60) * PX
  let d = null // /api/dia/horario

  const bloqueEntreno = () => (d.entreno && d.entreno.activa ? { id: ID_ENTRENO, nombre: d.entreno.nombre, tipo: 'entreno', dias: d.entreno.dias || [], desde: d.entreno.hora || '19:00', hasta: d.entreno.horaLimiteInicio || d.entreno.hora || '19:35' } : null)
  const bloques = () => [...d.activo.bloques, ...(bloqueEntreno() ? [bloqueEntreno()] : [])]

  function grilla() {
    const alto = (H1 - H0) * PX
    const dormir = { desde: (d.sueno && d.sueno.horaDormido) || '23:00', hasta: (d.sueno && d.sueno.horaFinSuenio) || '06:00' }
    const dur = (d.entreno && d.entreno.duracion) || 42
    const horas = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i).filter((h) => h % 2 === 0)
    return `<div class="hor-grilla" style="height: ${alto + 22}px;">
      <div class="hor-horas" aria-hidden="true">${horas.map((h) => `<span style="top: ${22 + (h - H0) * PX}px;">${h}</span>`).join('')}</div>
      ${DIAS_ORDEN.map((ds) => `<div class="hor-col"><div class="hor-cab">${CORTO[ds]}</div><div class="hor-dia" style="height: ${alto}px;">
        ${Array.from({ length: H1 - H0 }, (_, i) => `<i class="hor-raya" style="top: ${i * PX}px;"></i>`).join('')}
        <div class="hor-bloque dormir" style="top: ${Math.max(0, y(dormir.desde))}px; height: ${Math.max(0, alto - Math.max(0, y(dormir.desde)))}px;" aria-hidden="true"></div>
        ${min(dormir.hasta) > H0 * 60 ? `<div class="hor-bloque dormir" style="top: 0; height: ${y(dormir.hasta)}px;" aria-hidden="true"></div>` : ''}
        ${bloques().filter((b) => b.dias.includes(ds)).map((b) => {
          const top = Math.max(0, y(b.desde))
          const fin = b.tipo === 'entreno' ? y(b.hasta) + (dur / 60) * PX : y(b.hasta)
          const h = Math.max(10, Math.min(alto, fin) - top)
          return `<button type="button" class="hor-bloque ${esc(b.tipo)}" style="top: ${top}px; height: ${h}px;" data-b="${esc(b.id)}" aria-label="${esc(b.nombre)}, ${LARGO[ds]} ${esc(b.desde)} a ${esc(b.hasta)}. Tocá para editar"><span>${esc(b.nombre)}</span>${h >= 30 ? `<span class="hor-hora">${esc(b.desde)}</span>` : ''}</button>`
        }).join('')}
      </div></div>`).join('')}
    </div>`
  }

  function pintar() {
    $('#horarios').textContent = `${d.activo.nombre} ▾`
    const be = bloqueEntreno()
    $('#caja').innerHTML = `<section class="tarjeta">${grilla()}
        <div class="hor-leyenda chico texto-2"><span><i class="hor-muestra obligatorio"></i> obligatorio</span><span><i class="hor-muestra entreno"></i> entreno</span><span><i class="hor-muestra otro"></i> otro</span><span><i class="hor-muestra dormir"></i> dormir</span></div>
        <p class="ayuda">Tocá un bloque para editarlo · mantené apretado para copiarlo a otros días. Dormir sale de tus horarios de sueño.</p></section>
      <button type="button" class="boton primario grande ancho" data-nuevo>+ Bloque</button>
      <div class="chips">${d.plantillas.map((p, i) => `<button type="button" data-plantilla="${i}">${esc(p.nombre)}</button>`).join('')}${be ? '<button type="button" data-entreno>Entreno</button>' : ''}</div>
      ${bloques().length ? '' : '<p class="ayuda centro">Todavía sin bloques. Empezá por una plantilla: Cursada, Trabajo o Entreno.</p>'}`
    const q = (s) => document.querySelectorAll(s)
    $('[data-nuevo]').onclick = () => editor()
    q('[data-plantilla]').forEach((b) => { const p = d.plantillas[Number(b.dataset.plantilla)]; b.onclick = () => editor({ id: '', nombre: p.nombre, tipo: p.tipo, dias: p.dias, desde: p.desde, hasta: p.hasta }) })
    const ent = $('[data-entreno]')
    if (ent) ent.onclick = () => editor(be)
    q('[data-b]').forEach((el) => {
      const b = bloques().find((x) => x.id === el.dataset.b)
      let t = null, largo = false
      el.onpointerdown = () => { largo = false; t = setTimeout(() => { largo = true; copiar(b) }, 500) }
      const soltar = () => clearTimeout(t)
      el.onpointerup = soltar; el.onpointerleave = soltar; el.onpointercancel = soltar
      el.oncontextmenu = (e) => e.preventDefault()
      el.onclick = () => { if (largo) { largo = false; return } editor(b) }
    })
  }

  const diasBotones = (lista, elegidos) => `<div class="hor-dias">${lista.map((ds) => `<button type="button" class="${elegidos.includes(ds) ? 'activo' : ''}" aria-pressed="${elegidos.includes(ds)}" data-ds="${ds}">${CORTO[ds]}</button>`).join('')}</div>`
  function conectarDias(raiz, elegidos, alCambiar) {
    raiz.querySelectorAll('[data-ds]').forEach((b) => {
      b.onclick = () => {
        const ds = Number(b.dataset.ds), i = elegidos.indexOf(ds)
        if (i >= 0) elegidos.splice(i, 1); else elegidos.push(ds)
        b.classList.toggle('activo', i < 0); b.setAttribute('aria-pressed', String(i < 0))
        alCambiar()
      }
    })
  }

  // ---------- Editar o crear un bloque ----------
  function editor(b) {
    const esEntreno = !!b && b.id === ID_ENTRENO
    let tipo = (b && b.tipo) || 'obligatorio'
    const dias = [...((b && b.dias) || [1, 2, 3, 4, 5])]
    const ayudaTipo = () => (tipo === 'obligatorio' ? 'Colegio, facultad, trabajo: sin avisos mientras dura; un aviso solo al salir. Los feriados lo apagan.' : 'Cualquier cosa fija de la semana. No calla los avisos.')
    const h = hoja(esEntreno ? 'Entreno' : b && b.id ? 'Editar bloque' : 'Nuevo bloque', `
      <div class="campo"><label for="hb-nombre">Nombre</label><input id="hb-nombre" value="${esc((b && b.nombre) || '')}" placeholder="Ej.: Facultad" maxlength="40"></div>
      ${esEntreno ? '' : `<div class="col" style="gap: 4px;"><span class="seccion-titulo">Tipo</span><div class="chips">${['obligatorio', 'otro'].map((t) => `<button type="button" class="${tipo === t ? 'activo' : ''}" data-tipo="${t}">${t === 'obligatorio' ? 'Obligatorio' : 'Otro'}</button>`).join('')}</div><span class="ayuda" id="hb-ayuda">${ayudaTipo()}</span></div>`}
      <div class="col" style="gap: 4px;"><span class="seccion-titulo">Días</span>${diasBotones(DIAS_ORDEN, dias)}</div>
      <div class="rejilla-2"><div class="campo"><label for="hb-desde">${esEntreno ? 'Hora habitual' : 'Desde'}</label><input id="hb-desde" type="time" value="${esc((b && b.desde) || '08:00')}"></div>
        <div class="campo"><label for="hb-hasta">${esEntreno ? 'Empezar hasta' : 'Hasta'}</label><input id="hb-hasta" type="time" value="${esc((b && b.hasta) || '12:00')}"></div></div>
      ${esEntreno ? '<span class="ayuda">Varía un poco cada día: desde Hoy lo corrés («hoy a las 19:30») sin tocar esto. Si empieza después de «Empezar hasta», el pilar queda tarde.</span>' : ''}
      <button type="button" class="boton primario ancho" data-guardar>Guardar</button>
      ${b && b.id && !esEntreno ? '<button type="button" class="boton suave ancho" data-borrar>Borrar bloque</button>' : ''}`)
    const q = (s) => h.el.querySelector(s)
    const nombre = q('#hb-nombre'), g = q('[data-guardar]')
    const revisar = () => { g.disabled = !nombre.value.trim() || !dias.length }
    nombre.oninput = revisar
    conectarDias(h.el, dias, revisar)
    h.el.querySelectorAll('[data-tipo]').forEach((x) => { x.onclick = () => { tipo = x.dataset.tipo; h.el.querySelectorAll('[data-tipo]').forEach((y2) => y2.classList.toggle('activo', y2 === x)); q('#hb-ayuda').textContent = ayudaTipo() } })
    g.onclick = seguro(async () => {
      const cuerpo = { nombre: nombre.value.trim(), tipo: esEntreno ? 'entreno' : tipo, dias: [...dias].sort(), desde: q('#hb-desde').value, hasta: q('#hb-hasta').value }
      if (b && b.id) await api(`/api/dia/horario/bloques/${encodeURIComponent(b.id)}`, cuerpo, 'PUT')
      else await api('/api/dia/horario/bloques', cuerpo)
      h.cerrar()
      avisar(esEntreno ? 'Entreno guardado: días, hora y «Empezar hasta»' : b && b.id ? 'Bloque guardado' : 'Bloque agregado', { tipo: 'ok' })
      await cargar()
    })
    const borrar = q('[data-borrar]')
    if (borrar) borrar.onclick = () => confirmar('¿Borrar este bloque?', `«${nombre.value.trim() || b.nombre}» sale de la semana.`, 'Borrar', async () => {
      await api(`/api/dia/horario/bloques/${encodeURIComponent(b.id)}`, undefined, 'DELETE'); h.cerrar(); avisar('Bloque borrado'); await cargar()
    })
    revisar()
    if (!b) nombre.focus()
  }

  // ---------- Copiar a otros días ----------
  function copiar(b) {
    const libres = DIAS_ORDEN.filter((ds) => !b.dias.includes(ds))
    const dias = []
    const h = hoja(`Copiar «${b.nombre}» a…`, `${libres.length ? diasBotones(libres, dias) : '<p class="texto-2">Ya está todos los días.</p>'}
      <button type="button" class="boton primario ancho" style="margin-top: 10px;" data-copiar disabled>Copiar</button>`)
    const c = h.el.querySelector('[data-copiar]')
    conectarDias(h.el, dias, () => { c.disabled = !dias.length })
    c.onclick = seguro(async () => {
      if (b.id === ID_ENTRENO) await api(`/api/dia/horario/bloques/${ID_ENTRENO}`, { nombre: b.nombre, tipo: 'entreno', dias: [...new Set([...b.dias, ...dias])].sort(), desde: b.desde, hasta: b.hasta }, 'PUT')
      else await api(`/api/dia/horario/bloques/${encodeURIComponent(b.id)}/copiar`, { dias })
      h.cerrar(); avisar(`${b.nombre}: copiado a ${dias.length} día${dias.length === 1 ? '' : 's'}`, { tipo: 'ok' }); await cargar()
    })
  }

  // ---------- Horarios guardados ----------
  function horarios() {
    const h = hoja('Horarios guardados', '')
    const cuerpo = h.el.querySelector('.hoja-cuerpo')
    const lista = () => {
      const hs = d.config.horarios, activo = d.config.activo
      cuerpo.innerHTML = `<p class="ayuda">Dos horarios distintos (por ejemplo «Cuatrimestre» y «Vacaciones») y los cambiás con un toque.</p>
        ${hs.map((x) => `<div class="fila entre" style="gap: 6px;" data-h="${esc(x.id)}">
          <button type="button" class="boton crece ${x.id === activo ? 'primario' : ''}" data-usar>${esc(x.nombre)}<span class="chico texto-3"> · ${x.bloques.length} bloque${x.bloques.length === 1 ? '' : 's'}</span></button>
          <button type="button" class="boton chico suave" aria-label="Renombrar ${esc(x.nombre)}" data-renombrar>✎</button>
          <button type="button" class="boton chico suave" aria-label="Borrar ${esc(x.nombre)}" data-borrar ${hs.length <= 1 ? 'disabled' : ''}>✕</button></div>`).join('')}
        <div class="fila" style="gap: 6px;"><input class="crece" placeholder="Nuevo horario (ej.: Vacaciones)" maxlength="60" aria-label="Nombre del horario nuevo" id="hh-nuevo"><button type="button" class="boton" data-crear disabled>Crear</button></div>`
      cuerpo.querySelectorAll('[data-h]').forEach((fila) => {
        const x = hs.find((z) => z.id === fila.dataset.h)
        fila.querySelector('[data-usar]').onclick = seguro(async () => {
          if (x.id !== activo) { await api(`/api/dia/horarios/${encodeURIComponent(x.id)}/activar`, {}); avisar(`Horario: ${x.nombre}`, { tipo: 'ok' }); await cargar() }
          h.cerrar()
        })
        fila.querySelector('[data-renombrar]').onclick = () => {
          const inp = document.createElement('input')
          inp.className = 'crece'; inp.value = x.nombre; inp.maxLength = 60; inp.setAttribute('aria-label', 'Nombre del horario')
          fila.querySelector('[data-usar]').replaceWith(inp); inp.focus()
          const listo = seguro(async () => { const n = inp.value.trim(); if (n && n !== x.nombre) { await api(`/api/dia/horarios/${encodeURIComponent(x.id)}`, { nombre: n }, 'PUT'); await cargar() } lista() })
          inp.onblur = listo
          inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur() }
        }
        fila.querySelector('[data-borrar]').onclick = () => confirmar('¿Borrar este horario?', 'Se borran sus bloques. Las excepciones por fecha quedan.', 'Borrar', async () => {
          await api(`/api/dia/horarios/${encodeURIComponent(x.id)}`, undefined, 'DELETE'); avisar('Horario borrado'); await cargar(); lista()
        })
      })
      const nuevo = cuerpo.querySelector('#hh-nuevo'), crear = cuerpo.querySelector('[data-crear]')
      nuevo.oninput = () => { crear.disabled = !nuevo.value.trim() }
      crear.onclick = seguro(async () => {
        const { horario } = await api('/api/dia/horarios', { nombre: nuevo.value.trim() })
        if (horario && horario.id && d.config.activo !== horario.id) await api(`/api/dia/horarios/${encodeURIComponent(horario.id)}/activar`, {}).catch(() => null)
        avisar('Horario creado y en uso. Cargale bloques.', { tipo: 'ok' }); await cargar(); h.cerrar()
      })
    }
    lista()
  }
  $('#horarios').onclick = horarios

  const cargar = seguro(async () => { d = await api('/api/dia/horario'); pintar() })
  cargar()
})()
