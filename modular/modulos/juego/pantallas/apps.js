// «Apps que te atrapan», igual que la v0.88.27 (AppsQueAtrapan.tsx). La config se guarda en /api/juego/vigia y se le
// pasa a Android (plugin Sek: vigiaGuardar). Android mira el tiempo de cada app y, al pasarte, abre el Tajo encima
// de esa app (celu/tajo-encima.html). Al tocar la mano vuelve a SEK: Hoy con el 3·2·1 brillando.
(function () {
  'use strict'
  const { api, seguro, nativo } = SEK
  const { esc, avisar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const caja = document.getElementById('caja')
  const MINUTOS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180]
  const textoMin = (m) => (m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ' y media'))
  let c = null, estado = null, apps = [], minutos = {}, elegir = false, buscar = ''
  let android = false

  async function refrescar() {
    estado = await nativo('vigiaEstado')
    android = !!estado
    const r = await nativo('vigiaApps')
    if (r) {
      try { apps = JSON.parse(r.apps || '[]').sort((a, b) => a.nombre.localeCompare(b.nombre)) } catch (e) { apps = [] }
      minutos = r.minutos || {}
    }
    pintar()
  }

  /** Le pasa la config a Android (en la web no hace nada). */
  const mandar = (v) => nativo('vigiaGuardar', { config: JSON.stringify({ ...v, tajo: true }) })

  async function guardar(nueva, texto) {
    c = nueva
    pintar()
    c = (await api('/api/juego/vigia', nueva, 'PUT')).vigia
    await mandar(c)
    estado = await nativo('vigiaEstado')
    pintar()
    if (texto) avisar(texto, { tipo: 'ok' })
  }

  function pintar() {
    if (!c) return
    const icono = new Map(apps.map((a) => [a.paquete, a.icono]))
    const img = (src) => (src ? `<img src="${esc(src)}" alt="">` : '<span class="vigia-sin-icono" aria-hidden="true">📱</span>')
    const q = buscar.trim().toLowerCase()
    const filtradas = apps.filter((a) => !c.apps.some((x) => x.paquete === a.paquete) && (!q || a.nombre.toLowerCase().includes(q)))
    const off = android ? '' : 'disabled'
    caja.innerHTML = `
      ${android ? '' : '<p class="aviso-chico">Esto funciona solo en la app de Android (APK). Acá ves cómo queda.</p>'}
      ${android && !(estado.uso && estado.encima) ? `<section class="tarjeta"><div class="tarjeta-cab"><h2>Dos permisos de Android</h2></div>
        <div class="fila entre chico"><span class="texto-2">Ver el tiempo de uso de las apps: <b>${estado && estado.uso ? 'listo ✓' : 'falta'}</b></span>
          ${estado && estado.uso ? '' : `<button type="button" class="boton chico primario" data-permiso="uso" ${off}>Dar permiso</button>`}</div>
        <div class="fila entre chico"><span class="texto-2">Aparecer encima de otras apps: <b>${estado && estado.encima ? 'listo ✓' : 'falta'}</b></span>
          ${estado && estado.encima ? '' : `<button type="button" class="boton chico primario" data-permiso="encima" ${off}>Dar permiso</button>`}</div>
        <p class="ayuda">Android abre el ajuste: buscá SEK, activalo y volvé. Sin «aparecer encima» llega como aviso fuerte en vez de abrirse sola. SEK no ve qué hacés dentro de las apps: solo cuántos minutos estuvieron abiertas.</p>
      </section>` : ''}
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Mis apps</h2></div>
        <label class="fila entre"><span><b>Activado</b><br><span class="chico texto-3">${c.activo ? (!android || (estado && estado.activo) ? 'SEK está mirando' : 'Faltan permisos o apps') : 'Apagado'}</span></span>
          <input type="checkbox" class="interruptor" id="activo" ${c.activo ? 'checked' : ''} ${off}></label>
        ${c.apps.length ? '' : '<p class="texto-3 chico">Todavía no elegiste ninguna app.</p>'}
        ${c.apps.map((a, i) => `<div class="vigia-app">${img(icono.get(a.paquete))}
          <span class="crece col" style="gap: 1px;"><b>${esc(a.nombre)}</b><span class="chico texto-3">${minutos[a.paquete] !== undefined ? `Hoy: ${minutos[a.paquete]} min` : 'Te llama al pasarte'}</span></span>
          <select data-min="${i}" aria-label="Minutos por día en ${esc(a.nombre)}" ${off}>${[...new Set([...MINUTOS, a.minutos])].sort((x, y) => x - y).map((m) => `<option value="${m}" ${m === a.minutos ? 'selected' : ''}>${textoMin(m)}</option>`).join('')}</select>
          <button type="button" class="boton chico suave" data-quitar="${i}" aria-label="Quitar ${esc(a.nombre)}" ${off}>✕</button></div>`).join('')}
        <button type="button" class="boton ancho" id="elegir" ${off}>${elegir ? 'Listo' : '+ Elegir app'}</button>
        ${elegir ? `<div class="col"><input class="vigia-buscar" id="buscar" type="search" placeholder="Buscar app…" value="${esc(buscar)}">
          <div class="vigia-lista">${filtradas.map((a) => `<button type="button" class="vigia-app vigia-elegible" data-sumar="${esc(a.paquete)}">${img(a.icono)}<span class="crece">${esc(a.nombre)}</span>${minutos[a.paquete] ? `<span class="chico texto-3">${minutos[a.paquete]} min hoy</span>` : ''}</button>`).join('')}
          ${filtradas.length ? '' : '<p class="texto-3 chico">No hay más apps.</p>'}</div></div>` : ''}
      </section>
      <section class="tarjeta"><div class="tarjeta-cab"><h2>Si seguís</h2></div>
        <label class="fila entre chico"><span class="texto-2">Te vuelve a llamar cada</span>
          <select id="repetir" ${off}>${[5, 10, 15, 30].map((m) => `<option value="${m}" ${m === c.repetir ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
        <p class="ayuda">Los minutos se cuentan por día, desde la medianoche. Solo te llama con la app abierta adelante.</p>
        ${android ? `<p class="ayuda">Última vez que te llamó: <b>${esc((estado && estado.ultimo) || 'todavía nunca')}</b></p>` : ''}
      </section>`
    const q$ = (s) => caja.querySelector(s)
    caja.querySelectorAll('[data-permiso]').forEach((b) => { b.onclick = () => nativo('vigiaPermiso', { cual: b.dataset.permiso }) })
    q$('#activo').onchange = seguro((e) => guardar({ ...c, activo: e.target.checked }, e.target.checked ? 'Listo: SEK te va a llamar cuando te pases.' : 'Apagado.'))
    caja.querySelectorAll('[data-min]').forEach((s) => { s.onchange = seguro(() => guardar({ ...c, apps: c.apps.map((x, i) => (i === Number(s.dataset.min) ? { ...x, minutos: Number(s.value) } : x)) })) })
    caja.querySelectorAll('[data-quitar]').forEach((b) => { b.onclick = seguro(() => guardar({ ...c, apps: c.apps.filter((x, i) => i !== Number(b.dataset.quitar)) })) })
    q$('#elegir').onclick = () => { elegir = !elegir; pintar(); if (elegir && q$('#buscar')) q$('#buscar').focus() }
    if (q$('#buscar')) q$('#buscar').oninput = (e) => {
      buscar = e.target.value; const pos = e.target.selectionStart; pintar()
      const b = q$('#buscar'); b.focus(); try { b.setSelectionRange(pos, pos) } catch (x) { /* nada */ }
    }
    caja.querySelectorAll('[data-sumar]').forEach((b) => {
      b.onclick = seguro(() => {
        const a = apps.find((x) => x.paquete === b.dataset.sumar)
        return guardar({ ...c, activo: true, apps: [...c.apps, { paquete: a.paquete, nombre: a.nombre, minutos: 30 }] }, `${a.nombre}: 30 min por día.`)
      })
    })
    q$('#repetir').onchange = seguro((e) => guardar({ ...c, repetir: Number(e.target.value) }))
  }

  // Al volver de los ajustes de Android se revisan los permisos.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && c) refrescar() })

  seguro(async () => {
    c = (await api('/api/juego/vigia')).vigia
    await refrescar()
    // Android queda al día con lo guardado (por ejemplo después de pasar los datos al APK nuevo).
    if (android && c.apps.length) await mandar(c)
  })()
})()
