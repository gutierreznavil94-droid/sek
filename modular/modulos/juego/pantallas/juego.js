// Pantalla de Juego. Pide todo a /api/juego (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra, minutos, mensaje } = SEK
  const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  let estado = null
  let base = 0 // instante en que llegó el resumen, para que el reloj corra sin pedir al servidor

  function reloj(min) {
    const s = Math.floor(min * 60)
    const h = Math.floor(s / 3600)
    const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
    const ss = String(s % 60).padStart(2, '0')
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
  }

  function pintar(r) {
    estado = r
    base = Date.now()
    const jugando = !!r.activa
    $('#empezar').hidden = jugando
    $('#pausar').hidden = !jugando || r.pausada
    $('#seguir').hidden = !jugando || !r.pausada
    $('#terminar').hidden = !jugando
    $('#etiqueta-sesion').textContent = !jugando ? 'Sin jugar ahora' : r.pausada ? 'En pausa' : 'Jugando'
    const textos = { ok: ['Dentro del límite', 'ok'], cerca: ['Cerca del límite', 'aviso'], superado: ['Pasaste el límite', 'mal'] }
    const [txt, clase] = textos[r.estado]
    $('#estado-limite').textContent = txt
    $('#estado-limite').className = 'chico ' + clase
    $('#hoy-texto').textContent = `${minutos(r.minutosHoy)} de ${minutos(r.limiteHoy)}`
    $('#hoy-barra').style.width = Math.min(100, (100 * r.minutosHoy) / Math.max(1, r.limiteHoy)) + '%'
    $('#semana-texto').textContent = `${minutos(r.minutosSemana)} de ${minutos(r.limiteSemana)}`
    const max = Math.max(...r.semana.map((d) => Math.max(d.minutos, d.limite)), 1)
    $('#semana').innerHTML = r.semana.map((d, i) => `
      <div class="dia${d.fecha === r.hoy ? ' hoy' : ''}" title="${d.fecha}: ${d.minutos} de ${d.limite} min">
        <div class="columna"><span class="${d.minutos <= d.limite ? 'ok' : ''}" style="height:${(100 * d.minutos) / max}%"></span></div>
        <small>${DIAS[i]}</small>
      </div>`).join('')
    tic()
  }

  function tic() {
    if (!estado) return
    const extra = estado.activa && !estado.pausada ? (Date.now() - base) / 60000 : 0
    $('#reloj').textContent = reloj(estado.minutosSesion + extra)
  }

  const accion = (ruta, datos) => seguro(async () => pintar(await api(ruta, datos || {})))
  $('#empezar').onclick = accion('/api/juego/empezar')
  $('#pausar').onclick = accion('/api/juego/pausar')
  $('#seguir').onclick = accion('/api/juego/seguir')
  $('#terminar').onclick = accion('/api/juego/terminar')
  $('#form-manual').addEventListener('submit', seguro(async (e) => {
    e.preventDefault()
    const inicio = new Date($('#manual-desde').value).getTime()
    const fin = new Date($('#manual-hasta').value).getTime()
    pintar(await api('/api/juego/manual', { inicio, fin }))
    e.target.reset()
    mensaje('Sumado')
  }))

  barra('juego')
  seguro(async () => pintar(await api('/api/juego')))()
  setInterval(tic, 1000)
  // Al volver a la app, refresca (pudo cambiar desde otro dispositivo).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) seguro(async () => pintar(await api('/api/juego')))() })
})()
