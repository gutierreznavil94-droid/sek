// Siguiente acción, igual que la v0.88.27 (SiguienteAccion.tsx): una tarea vaga se vuelve una acción física de
// menos de 5 minutos y sigue al 3·2·1. Muestra el hueco libre de ahora con los compromisos que entran y las
// últimas acciones (empezadas o no) para cerrarlas o lanzarlas. Guarda en /api/desafios/siguiente.
(function () {
  'use strict'
  const { api, seguro, evento } = SEK
  const { esc, fechaLegible } = SEK.v88
  SEK.v88.montar({ completa: 'app-siguiente' })
  const caja = document.getElementById('caja')
  let datos = { momento: null, pendientes: [], hoy: null }
  let recientes = []
  let ambigua = '', concreta = ''
  const cerrar = () => { if (history.length > 1) history.back(); else location.href = '/hoy' }
  const fechaDe = (ms) => new Date(ms).toLocaleDateString('en-CA')
  const duracion = (s) => { const m = Math.round(s / 60); return m < 1 ? `${Math.round(s)} s` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 || ''}`.trim() }
  const a321 = (r) => `/desafios/321?accion=${encodeURIComponent(r.accion)}&id=${r.id}`

  function pintar() {
    const m = datos.momento
    const entran = m && !m.ahora ? datos.pendientes.filter((c) => c.accion.tipo === 'compromiso' && (c.accion.minutosMinimos || 15) <= m.libres) : []
    const hay = SEK.hueco.texto(m, { libres: '', hastaAlistarte: true })
    caja.innerHTML = `<div class="fila entre"><h1>Siguiente acción</h1><button type="button" class="boton chico suave" data-cerrar>Cerrar</button></div>
      ${hay ? `<p class="hor-hueco chico">${hay}${entran.length ? ` Entra: ${entran.map((c, i) => `<button type="button" class="enlace" data-entra="${i}">${esc(c.accion.nombre)}${c.accion.minutosMinimos ? ` ${c.accion.minutosMinimos} min` : ''}</button>`).join(' · ')}` : ''}</p>` : ''}
      <section class="tarjeta">
        <div class="campo"><label for="ambigua">¿Qué tenés que hacer? (vale que sea vago)</label><input id="ambigua" maxlength="200" value="${esc(ambigua)}" placeholder="Ej.: la facultad"></div>
        <div class="campo"><label for="concreta">¿Cuál es la primera acción física, de menos de 5 minutos?</label><input id="concreta" maxlength="120" value="${esc(concreta)}" placeholder="Ej.: abrir el apunte en la página 12">
          <span class="ayuda">Algo que se pueda hacer con el cuerpo ahora: abrir, buscar, escribir una línea, ponerse algo.</span></div>
        <div class="botonera"><button type="button" class="boton primario grande" data-lanzar>3 · 2 · 1 y empezar</button></div>
      </section>
      ${recientes.length ? `<section class="tarjeta"><div class="tarjeta-cab"><h2>Últimas</h2></div><div>${recientes.map((r) => `<div class="col chico" style="padding: 8px 0; border-top: 1px solid var(--borde); gap: 2px;">
          <div class="fila entre"><b>${esc(r.accion)}</b><span class="texto-3 muy-chico">${fechaLegible(fechaDe(r.creado))}</span></div>
          ${r.tareaAmbigua ? `<span class="texto-3">de: ${esc(r.tareaAmbigua)}</span>` : ''}
          <div class="fila entre"><span class="texto-2 muy-chico">${r.iniciado ? `Empezada${r.segundosHastaEmpezar > 0 ? ` a los ${duracion(r.segundosHastaEmpezar)}` : ''}` : 'Sin empezar'}${r.resultado ? ` · ${esc(r.resultado.replace('_', ' '))}` : ''}</span>
            ${r.iniciado && !r.resultado ? `<div class="fila" style="gap: 4px;"><button type="button" class="boton chico suave" data-cerrar-inicio="${r.id}" data-res="hecha">Hecha</button><button type="button" class="boton chico suave" data-cerrar-inicio="${r.id}" data-res="parcial">A medias</button></div>` : ''}
            ${!r.iniciado ? `<a class="boton chico suave" href="${a321(r)}">3-2-1</a>` : ''}</div></div>`).join('')}</div></section>` : ''}`
    const q = (s) => caja.querySelector(s)
    const lanzar = q('[data-lanzar]')
    const revisar = () => { lanzar.disabled = !concreta.trim() }
    q('#ambigua').oninput = (e) => { ambigua = e.target.value }
    q('#concreta').oninput = (e) => { concreta = e.target.value; revisar() }
    caja.querySelectorAll('[data-entra]').forEach((b) => { b.onclick = () => { ambigua = entran[Number(b.dataset.entra)].accion.nombre; pintar(); q('#concreta').focus() } })
    caja.querySelectorAll('[data-cerrar-inicio]').forEach((b) => { b.onclick = seguro(async () => { await api(`/api/desafios/inicios/${b.dataset.cerrarInicio}`, { resultado: b.dataset.res }, 'PUT'); await recargar() }) })
    q('[data-cerrar]').onclick = cerrar
    lanzar.onclick = seguro(async () => {
      const { inicio } = await api('/api/desafios/siguiente', { accion: concreta.trim(), tareaAmbigua: ambigua.trim() })
      SEK.hueco.marcarUsado('siguiente', datos.hoy)
      evento('aparecer', { elemento: lanzar })
      location.href = a321(inicio)
    })
    revisar()
  }

  async function recargar() { recientes = ((await api('/api/desafios/inicios')).inicios || []).slice(0, 15); pintar() }

  seguro(async () => {
    const [d] = await Promise.all([SEK.hueco.cargar(), recargar()])
    datos = d
    pintar()
    const a = caja.querySelector('#ambigua'); if (a && !ambigua) a.focus()
  })()
})()
