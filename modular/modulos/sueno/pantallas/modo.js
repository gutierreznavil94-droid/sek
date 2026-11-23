// Modo sueño: pantalla casi negra con la hora, hasta cuándo dura y a qué hora hay que estar dormido.
// Primero «Buenas noches» (12 s o un toque), después el reloj. Cada vez que se abre de noche, se anota la apertura.
(function () {
  'use strict'
  const { api, $, seguro, evento } = SEK
  let modo = null
  let ajustes = null
  let zona = 'America/Argentina/Cordoba'

  const horaDe = (ms) => new Intl.DateTimeFormat('es-AR', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)

  function mostrar(cual) {
    for (const id of ['saludo', 'reloj', 'buenos-dias']) $('#' + id).hidden = id !== cual
    $('#salir').hidden = cual === 'buenos-dias'
  }

  function pintarReloj() {
    $('#hora').textContent = horaDe(Date.now())
    $('#hasta').textContent = `Modo sueño hasta las ${horaDe(modo.hasta)}`
    $('#dormido').textContent = `A dormir a las ${ajustes.horaDormido}`
    const n = modo.aperturas.length
    $('#aperturas').hidden = n === 0
    $('#aperturas').textContent = `Abriste la app ${n === 1 ? '1 vez' : `${n} veces`} esta noche. Queda anotado, nada más.`
  }

  async function revisar() {
    const r = await api('/api/sueno/modo')
    ajustes = r.ajustes
    zona = ajustes.zonaHoraria || zona
    if (r.buenosDias || !r.modo) { mostrar('buenos-dias'); if (!r.buenosDias) location.href = '/sueno'; return false }
    modo = r.modo
    return true
  }

  async function empezar() {
    if (!(await revisar())) return
    const recien = Date.now() - modo.inicio < 60000
    if (recien) {
      $('#saludo-titulo').textContent = (modo.tarde ? `Registrado a las ${horaDe(modo.inicio)}. ` : '') + 'Buenas noches'
      $('#saludo-resumen').textContent = modo.resumen
      $('#saludo-xp').hidden = modo.tarde
      mostrar('saludo')
      // La escena de la noche (escena.js): «buenas noches» y después durmiendo.
      if (window.SEK_ESCENA_NOCHE) SEK_ESCENA_NOCHE($('#escena-saludo'))
      evento('dormir')
      setTimeout(() => { if (!$('#saludo').hidden) { mostrar('reloj'); pintarReloj() } }, 12000)
    } else {
      // Abrir la app de noche queda anotado (solo la hora).
      const a = await api('/api/sueno/modo/apertura', {})
      modo.aperturas = new Array(a.aperturas).fill(0)
      mostrar('reloj')
      pintarReloj()
    }
    setInterval(seguro(async () => { if (await revisar()) pintarReloj() }), 15000)
  }

  // En el reloj, el shinobi ya durmiendo (una sola vez).
  let escenaReloj = false
  const mostrarSeccion = mostrar
  mostrar = (id) => { mostrarSeccion(id); if (id === 'reloj' && !escenaReloj && window.SEK_ESCENA_NOCHE) { escenaReloj = true; SEK_ESCENA_NOCHE($('#escena-reloj'), { directo: true }) } }
  $('#saludo').addEventListener('click', () => { mostrar('reloj'); pintarReloj() })
  $('#salir').addEventListener('click', () => $('#dlg-salir').showModal())
  $('#dlg-salir').addEventListener('close', seguro(async () => {
    if ($('#dlg-salir').returnValue !== 'salir') return
    await api('/api/sueno/modo/salir', {})
    location.href = '/sueno'
  }))

  seguro(empezar)()
})()
