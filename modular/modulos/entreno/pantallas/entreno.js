// Mis rutinas, igual que la v0.88.27 (Rutinas.tsx): el historial, cada rutina con sus días y ejercicios, sumar
// una rutina, elegir cómo empezar (un plan, de a poco o desde cero) y empezar el entreno. Pide a /api/entreno.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const NOMBRES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const ordenar = (d) => [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const dias = (d) => { const n = ordenar(d).map((x) => NOMBRES[x]); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('') }
  const IDEAS_OCULTAS = 'sek-ideas-rutina-ocultas'
  let datos = null

  function pintar(d) {
    datos = d
    const r = d.rutinas
    $('#intro').textContent = r.length
      ? `${r.length === 1 ? 'Tu rutina' : `Tus ${r.length} rutinas`}, cada una con sus días. Tocá una para ver y editar sus bloques, ejercicios y días. Los cambios valen desde el próximo entreno.`
      : 'Todavía no tenés rutinas. Sumá una y armala a tu manera, o elegí un plan listo.'
    let ocultas = false
    try { ocultas = localStorage.getItem(IDEAS_OCULTAS) === '1' } catch (e) { /* sin almacenamiento */ }
    const ideas = $('#ideas')
    ideas.hidden = ocultas || !r.some((x) => x.id === 'rutina-ejemplo' && x.activa)
    ideas.innerHTML = `<b>Ideas para ir agrandándola</b><ul class="texto-2 chico rutinas-ideas">${d.ideas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <span class="texto-3 chico">Son solo ideas: vos decidís cuándo.</span><button type="button" class="boton chico suave" id="ocultar-ideas">Ocultar ideas</button>`
    $('#ocultar-ideas').onclick = () => { ideas.hidden = true; try { localStorage.setItem(IDEAS_OCULTAS, '1') } catch (e) { /* nada */ } }
    $('#rutinas').innerHTML = r.map((x) => {
      const [nombre, sub] = x.nombre.split(' · ')
      const ej = x.bloques.filter((b) => b.tipo === 'ejercicio')
      return `<a href="/entreno/rutina?id=${encodeURIComponent(x.id)}" class="tarjeta rutina-item">
        <div class="fila entre"><h2>${esc(nombre)}</h2><span class="texto-3 chico">${x.dias.length ? dias(x.dias) : 'Sin días'} · ~${x.minutos} min</span></div>
        <span class="texto-2">${esc(sub || '')}</span>
        <div class="chips-mini">${ej.map((e) => `<span>${esc(e.nombre)}</span>`).join('')}</div>
        ${x.activa ? '' : '<span class="texto-3 chico">Pausada</span>'}</a>`
    }).join('')
    $('#empezar').hidden = !r.length
    $('#empezar').textContent = d.hoy.enCurso ? 'Seguir el entreno' : 'Empezar entreno'
  }

  // ---------- Elegir cómo empezar ----------
  function elegir() {
    const OPCIONES = [
      { modo: 'plan', titulo: 'Mi plan completo', texto: 'Un plan listo desde el día 1, con todos sus días y ejercicios.' },
      { modo: 'poco', titulo: 'De a poco', texto: 'Una rutina cortita para arrancar, con ideas para agrandarla cuando quieras.' },
      { modo: 'cero', titulo: 'Desde cero', texto: 'Sin rutinas: armás tus días y ejercicios a tu manera.' },
    ]
    let e = { modo: 'plan', planId: datos.planes[0] && datos.planes[0].id }
    const hay = datos.rutinas.length
    const h = hoja('Elegir cómo empezar', '<div class="col" style="gap: 10px;" data-caja></div>')
    const caja = h.el.querySelector('[data-caja]')
    const nombreEleccion = () => (e.modo === 'plan' ? (datos.planes.find((p) => p.id === e.planId) || {}).nombre || 'Plan' : e.modo === 'poco' ? 'De a poco' : 'Desde cero')
    const aplicar = seguro(async (reemplazar) => {
      const r = await api('/api/entreno/eleccion', { eleccion: e, reemplazar })
      h.cerrar()
      avisar(e.modo === 'cero' ? 'Listo: sin rutinas. Sumá la primera con «+ Nueva rutina».' : `${nombreEleccion()}: ${r.cargadas === 1 ? '1 rutina cargada' : `${r.cargadas} rutinas cargadas`}`, { tipo: 'ok' })
      cargar()
    })
    function opciones() {
      caja.innerHTML = `<div class="ce" role="radiogroup" aria-label="Cómo empezar a entrenar">${OPCIONES.map((o) => `<div class="ce-opcion ${e.modo === o.modo ? 'elegida' : ''}">
          <button type="button" role="radio" aria-checked="${e.modo === o.modo}" class="ce-opcion-cab" data-modo="${o.modo}"><span class="ce-punto" aria-hidden="true"></span><span class="ce-opcion-texto"><b>${o.titulo}</b><span class="chico texto-2">${o.texto}</span></span></button>
          ${o.modo === 'plan' && e.modo === 'plan' ? `<div class="ce-planes">${datos.planes.map((p) => `<button type="button" class="ce-plan ${e.planId === p.id ? 'elegido' : ''}" aria-pressed="${e.planId === p.id}" data-plan="${esc(p.id)}"><b>${esc(p.nombre)}</b><span class="chico texto-2">${esc(p.descripcion)}</span><span class="chico texto-3">${esc(p.rutinas.map((x) => x.split(' · ')[0]).join(' · '))}</span></button>`).join('')}</div>` : ''}
        </div>`).join('')}</div>
        <p class="ayuda">Después podés editar todo: días, ejercicios, series y pesos.</p>
        <button type="button" class="boton primario" data-seguir>${e.modo === 'cero' ? 'Seguir' : 'Cargar'}</button>`
      caja.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => { e = b.dataset.modo === 'plan' ? { modo: 'plan', planId: datos.planes[0].id } : { modo: b.dataset.modo }; opciones() } })
      caja.querySelectorAll('[data-plan]').forEach((b) => { b.onclick = () => { e = { modo: 'plan', planId: b.dataset.plan }; opciones() } })
      caja.querySelector('[data-seguir]').onclick = () => (hay > 0 ? confirmar() : aplicar(true))
    }
    function confirmar() {
      caja.innerHTML = `<p>${e.modo === 'cero' ? `¿Borrar tus ${hay === 1 ? 'rutina' : `${hay} rutinas`} y empezar desde cero?` : `Ya tenés ${hay === 1 ? '1 rutina' : `${hay} rutinas`}. ¿Qué hacemos con ${hay === 1 ? 'ella' : 'ellas'}?`}</p>
        <p class="texto-2 chico">Tus entrenos, récords e historial quedan guardados igual.</p>
        ${e.modo !== 'cero' ? `<button type="button" class="boton primario" data-sumar>Sumar ${e.modo === 'plan' ? 'el plan' : 'la rutina'} a las mías</button>` : ''}
        <button type="button" class="boton ${e.modo === 'cero' ? 'primario' : ''}" data-reemplazar>${e.modo === 'cero' ? 'Sí, empezar desde cero' : 'Reemplazar mis rutinas'}</button>
        <button type="button" class="boton suave" data-volver>‹ Volver</button>`
      const s = caja.querySelector('[data-sumar]')
      if (s) s.onclick = () => aplicar(false)
      caja.querySelector('[data-reemplazar]').onclick = () => aplicar(true)
      caja.querySelector('[data-volver]').onclick = opciones
    }
    opciones()
  }

  const cargar = seguro(async () => pintar(await api('/api/entreno')))
  $('#nueva').onclick = seguro(async () => {
    const r = await api('/api/entreno/rutinas', {})
    location.href = '/entreno/rutina?id=' + encodeURIComponent(r.id)
  })
  $('#elegir').onclick = () => { if (datos) elegir() }
  cargar()
})()
