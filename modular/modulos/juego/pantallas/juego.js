// Pantalla Juego, igual que la v0.88.27 (Juego.tsx de la app vieja) pero en HTML+JS.
// Temporizador con el ensō que se cierra con los minutos de hoy contra el límite; la escena del shōji (escena.js);
// Hoy y la semana; Mis juegos del celu (solo Android); los últimos 7 días; el historial por día con corregir y borrar.
// Pide a: /api/juego (resumen), /api/juego/historial, empezar/pausar/seguir/terminar, manual, PUT y DELETE de sesiones.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'juego', companero: 'esquina' })

  const escena = window.SEK_ESCENA_JUEGO ? SEK_ESCENA_JUEGO($('#escena')) : null
  let r = null // resumen de /api/juego
  let llego = 0 // cuándo llegó el resumen: el reloj corre sin volver a pedir
  let historial = []
  let abierto = null
  let cuantos = 7
  let buscada = null
  let sinJuego = null

  const sumarDias = (f, n) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const dosCifras = (n) => String(n).padStart(2, '0')
  // Fechas y horas en la zona horaria de los ajustes (como la vieja), no en la del navegador.
  const zona = () => (r && r.zonaHoraria) || undefined
  function partes(ms) {
    const o = {}
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: zona(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(ms)) o[x.type] = x.value
    return o
  }
  const fechaDe = (ms) => { const o = partes(ms); return `${o.year}-${o.month}-${o.day}` }
  const hora = (ms) => { const o = partes(ms); return `${o.hour}:${o.minute}` }
  const aLocal = (ms) => `${fechaDe(ms)}T${hora(ms)}`
  /** '2026-11-23T20:00' en la zona de los ajustes → instante en ms. */
  function instanteDe(texto) {
    const [f, h] = String(texto).split('T')
    if (!f || !h) return NaN
    const [y, m, d] = f.split('-').map(Number)
    const [hh, mm] = h.split(':').map(Number)
    const buscado = Date.UTC(y, m - 1, d, hh, mm)
    let t = buscado
    for (let i = 0; i < 2; i++) { const o = partes(t); t += buscado - Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute) }
    return t
  }
  function duracionLegible(min) {
    const m = Math.max(0, Math.round(min))
    const h = Math.floor(m / 60)
    return h === 0 ? `${m % 60} min` : `${h} h ${dosCifras(m % 60)} min`
  }
  function tiempo(ms) {
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}:${dosCifras(m)}:${dosCifras(s % 60)}` : `${dosCifras(m)}:${dosCifras(s % 60)}`
  }
  /** Lo jugado de una sesión (sin las pausas), como duracionMs de la app vieja. */
  function duracionMs(s, ahora) {
    const fin = s.fin ?? ahora
    let cursor = s.inicio
    let total = 0
    for (const p of [...(s.pausas || [])].sort((a, b) => a.desde - b.desde)) {
      const desde = Math.max(p.desde, cursor)
      const hasta = Math.min(p.hasta ?? fin, fin)
      if (desde > cursor) total += Math.min(desde, fin) - cursor
      cursor = Math.max(cursor, hasta)
    }
    return total + Math.max(0, fin - cursor)
  }

  // ---------- Lo que cambia cada segundo ----------
  function extraMin() { return r && r.activa && !r.pausada ? (Date.now() - llego) / 60000 : 0 }
  function minutosHoy() { return Math.round(r.minutosHoy + extraMin()) }
  function estado(m) { return m >= r.limiteHoy ? 'superado' : m >= (r.limiteHoy * r.avisoPorcentaje) / 100 ? 'cerca' : 'ok' }
  const claseDe = (e) => (e === 'superado' ? 'bajo' : e === 'cerca' ? 'medio' : '')

  function enso(progreso, e) {
    const p = Math.max(0.07, Math.min(1, progreso))
    const rad = 40
    const a0 = -100
    const a1 = a0 + p * 345
    const punto = (a) => [50 + rad * Math.cos((a * Math.PI) / 180), 50 + rad * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = punto(a0)
    const [x1, y1] = punto(a1)
    const d = `M${x0.toFixed(2)},${y0.toFixed(2)} A${rad},${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
    const caja = $('#enso')
    caja.className = `enso ${e}`
    caja.querySelector('.enso-trazo').setAttribute('d', d)
    const seco = caja.querySelector('.enso-seco')
    if (p > 0.15) seco.setAttribute('d', d); else seco.removeAttribute('d')
  }

  function tic() {
    if (!r) return
    const m = minutosHoy()
    const e = estado(m)
    const activa = r.activa
    enso(m / Math.max(1, r.limiteHoy), e)
    $('#segundos').textContent = activa ? tiempo(r.minutosSesion * 60000 + extraMin() * 60000) : '00:00'
    $('#segundos').className = `juego-segundos ${claseDe(e)}`
    $('#estado-sesion').textContent = activa ? (r.pausada ? 'En pausa' : `Jugando desde las ${hora(activa.inicio)}`) : 'Sin sesión activa'
    $('#hoy-texto').textContent = `${m} / ${r.limiteHoy} min`
    $('#hoy-texto').className = `mono ${claseDe(e)}`
    $('#hoy-barra').className = `barra ${e === 'superado' ? 'bajo' : e === 'cerca' ? 'medio' : 'ok'}`
    $('#hoy-barra').firstElementChild.style.width = `${Math.min(100, (100 * m) / Math.max(1, r.limiteHoy))}%`
    const aviso = $('#hoy-aviso')
    aviso.hidden = e === 'ok'
    aviso.className = `chico ${claseDe(e)}`
    aviso.textContent = e === 'superado' ? `Superaste el límite de hoy por ${m - r.limiteHoy} min.` : e === 'cerca' ? `Te quedan ${r.limiteHoy - m} min.` : ''
    $('#semana-texto').textContent = duracionLegible(r.minutosSemana + extraMin())
    $('#semana-limite').textContent = `(límite ${duracionLegible(r.limiteSemana)})`
  }

  // ---------- Lo que cambia al recibir datos ----------
  function pintar(nuevo) {
    r = nuevo
    llego = Date.now()
    const activa = !!r.activa
    $('#iniciar').hidden = activa
    $('#botones-activa').hidden = !activa
    $('#reanudar').hidden = !r.pausada
    $('#pausar').hidden = !!r.pausada
    // Con el temporizador corriendo, la lluvia del fondo va más lenta y tenue (concentración).
    document.documentElement.classList.toggle('juego-corriendo', activa && !r.pausada)
    if (escena) escena.poner({ activa, pausada: !!r.pausada })
    pintarSieteDias()
    tic()
  }

  function pintarSieteDias() {
    const extra = minutosHoy() - r.minutosHoy
    $('#barras').innerHTML = r.ultimos7.map((d) => {
      const m = d.minutos + (d.fecha === r.hoy ? extra : 0)
      const alto = Math.min(100, (100 * m) / Math.max(1, d.limite * 1.5))
      return `<div class="${m === 0 ? 'sin' : m > d.limite ? 'bajo' : 'ok'}" title="${esc(fechaLegible(d.fecha))}: ${m} de ${d.limite} min" style="height: ${Math.max(3, alto)}%;"></div>`
    }).join('')
    $('#barras-etq').innerHTML = r.ultimos7.map((d) => `<div>${esc(fechaLegible(d.fecha).split(' ')[0])}</div>`).join('')
  }

  // ---------- Historial agrupado por día: una barra desplegable por día (solo una abierta) y un buscador arriba ----------
  function dias() {
    const lista = []
    for (const s of historial) {
      const f = fechaDe(s.inicio)
      const ult = lista[lista.length - 1]
      if (ult && ult.fecha === f) ult.sesiones.push(s)
      else lista.push({ fecha: f, sesiones: [s] })
    }
    return lista
  }

  function pintarHistorial() {
    const caja = $('#historial')
    if (!historial.length) { caja.innerHTML = '<p class="vacio">Todavía no hay sesiones.</p>'; return }
    const hoy = r ? r.hoy : fechaDe(Date.now())
    const ahora = Date.now()
    const lista = dias()
    caja.innerHTML = `<div class="hj">
      <label class="hj-buscar"><span class="texto-3 chico">Buscar día</span><input type="date" value="${buscada || hoy}" max="${hoy}"></label>
      ${sinJuego ? `<p class="vacio hj-sin">Sin juego ese día (${esc(fechaLegible(sinJuego))}).</p>` : ''}
      ${lista.slice(0, cuantos).map((dia) => {
        const este = abierto === dia.fecha
        const min = dia.sesiones.reduce((t, s) => t + duracionMs(s, ahora), 0) / 60000
        const n = dia.sesiones.length
        return `<div id="hj-${dia.fecha}" class="hj-dia ${este ? 'abierto' : ''}">
          <button type="button" class="hj-barra" aria-expanded="${este}" data-dia="${dia.fecha}">
            <span>${esc(fechaLegible(dia.fecha))}${dia.fecha === hoy ? ' · hoy' : ''}</span>
            <span class="texto-3">${duracionLegible(min)} · ${n} ${n === 1 ? 'sesión' : 'sesiones'}</span>
            <span class="hj-flecha" aria-hidden="true">▾</span>
          </button>
          ${este ? `<div class="hj-sesiones">${dia.sesiones.map((s) => {
            const ms = duracionMs(s, ahora)
            const np = (s.pausas || []).length
            const detalle = `${np > 0 ? `${np} pausa${np > 1 ? 's' : ''} · ` : ''}${s.nota || ''}`
            return `<div class="fila entre chico hj-sesion ${s.fin && ms < 60000 ? 'cero' : ''}">
              <div><div>${hora(s.inicio)}–${s.fin ? hora(s.fin) : '…'}</div><div class="texto-3 muy-chico">${esc(detalle)}</div></div>
              <div class="fila" style="gap: 4px;">
                <b class="mono">${duracionLegible(ms / 60000)}</b>
                ${s.fin ? `<button class="boton chico suave" data-editar="${s.id}" aria-label="Corregir">✎</button>` : ''}
                <button class="boton chico suave" data-borrar="${s.id}" aria-label="Borrar">🗑</button>
              </div>
            </div>`
          }).join('')}</div>` : ''}
        </div>`
      }).join('')}
      ${lista.length > cuantos ? '<button type="button" class="boton chico suave hj-mas" data-mas>Ver más</button>' : ''}
    </div>`
    caja.querySelector('.hj-buscar input').onchange = (e) => buscar(e.target.value)
    caja.querySelectorAll('[data-dia]').forEach((b) => { b.onclick = () => { abierto = abierto === b.dataset.dia ? null : b.dataset.dia; pintarHistorial() } })
    caja.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => editar(historial.find((s) => String(s.id) === b.dataset.editar)) })
    caja.querySelectorAll('[data-borrar]').forEach((b) => { b.onclick = () => borrar(historial.find((s) => String(s.id) === b.dataset.borrar)) })
    const mas = caja.querySelector('[data-mas]')
    if (mas) mas.onclick = () => { cuantos += 7; pintarHistorial() }
  }

  function buscar(f) {
    buscada = f
    if (!f) return
    const lista = dias()
    const i = lista.findIndex((x) => x.fecha === f)
    if (i < 0) { sinJuego = f; abierto = null; pintarHistorial(); return }
    sinJuego = null
    abierto = f
    if (i >= cuantos) cuantos = i + 1
    pintarHistorial()
    setTimeout(() => { const el = document.getElementById(`hj-${f}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 60)
  }

  // ---------- Hojas: corregir / añadir a mano, borrar y la explicación ----------
  function editar(sesion) {
    const hoy = r ? r.hoy : fechaDe(Date.now())
    const h = hoja(sesion ? 'Corregir sesión' : 'Añadir sesión a mano', `
      <div class="campo"><label>Inicio</label><input type="datetime-local" name="inicio" value="${sesion ? aLocal(sesion.inicio) : `${hoy}T20:00`}"></div>
      <div class="campo"><label>Fin</label><input type="datetime-local" name="fin" value="${sesion && sesion.fin ? aLocal(sesion.fin) : `${hoy}T21:00`}"></div>
      <div class="campo"><label>Motivo</label><input name="motivo" placeholder="Ej.: me olvidé de iniciar el temporizador"></div>
      <p class="error" hidden></p>
      <button class="boton primario ancho" data-guardar>Guardar</button>`)
    const campo = (n) => h.el.querySelector(`[name=${n}]`).value
    const error = h.el.querySelector('.error')
    h.el.querySelector('[data-guardar]').onclick = async () => {
      try {
        const ti = instanteDe(campo('inicio'))
        const tf = instanteDe(campo('fin'))
        const motivo = campo('motivo').trim()
        if (!(tf > ti)) throw new Error('El fin debe ser después del inicio.')
        if (tf - ti > 16 * 3600000) throw new Error('Una sesión no puede durar más de 16 horas.')
        if (!motivo) throw new Error('Escribí el motivo: queda en el historial.')
        pintar(sesion
          ? await api(`/api/juego/sesiones/${sesion.id}`, { inicio: ti, fin: tf, motivo }, 'PUT')
          : await api('/api/juego/manual', { inicio: ti, fin: tf, nota: motivo }))
        avisar('Guardado con registro de corrección', { tipo: 'ok' })
        h.cerrar()
        await cargarHistorial()
      } catch (e) {
        error.textContent = e.message
        error.hidden = false
      }
    }
  }

  function borrar(sesion) {
    const h = hoja('¿Borrar esta sesión?', `
      <p class="texto-2">Queda registrado en el historial que se borró.</p>
      <div class="fila" style="gap: 8px;"><button class="boton ancho" data-no>Cancelar</button><button class="boton peligro ancho" data-si>Borrar</button></div>`)
    h.el.querySelector('[data-no]').onclick = h.cerrar
    h.el.querySelector('[data-si]').onclick = seguro(async () => {
      h.cerrar()
      pintar(await api(`/api/juego/sesiones/${sesion.id}`, undefined, 'DELETE'))
      await cargarHistorial()
    })
  }

  $('#explicar').onclick = () => {
    if (!r) return
    hoja('Cómo funciona', `
      <p>Iniciás, pausás y finalizás. Si marcás tus juegos del celu (más abajo), su tiempo se suma solo. La sesión activa queda guardada en el teléfono, así que cerrar la app no la pierde.</p>
      <p class="texto-2 chico">Registrar el juego no da XP. Respetar el límite del día (${r.limiteHoy} min hoy: ${r.limiteSemanaDia} de lunes a viernes, ${r.limiteFinde} sábados, domingos y feriados) sí, y se resuelve al cerrar el día. Los avisos del límite se eligen en Más → Alarmas (Notificación, Alarma o Nada).</p>`)
  }

  // ---------- Botones del temporizador ----------
  const accion = (ruta, despues) => seguro(async () => { pintar(await api(ruta, {})); if (despues) despues(); await cargarHistorial() })
  $('#iniciar').onclick = accion('/api/juego/empezar')
  $('#pausar').onclick = accion('/api/juego/pausar')
  $('#reanudar').onclick = accion('/api/juego/seguir')
  $('#finalizar').onclick = accion('/api/juego/terminar', () => avisar('Sesión guardada'))
  $('#anadir').onclick = () => editar(null)

  async function cargarHistorial() {
    historial = (await api('/api/juego/historial?cantidad=3000')).sesiones || []
    pintarHistorial()
  }
  const cargar = seguro(async () => { pintar(await api('/api/juego')); await cargarHistorial() })

  cargar()
  setInterval(tic, 1000)
  // Cada 30 s vuelve a pedir (como la vieja), y al volver a la app también.
  setInterval(() => { if (!document.hidden) seguro(async () => pintar(await api('/api/juego')))() }, 30000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar() })
})()
