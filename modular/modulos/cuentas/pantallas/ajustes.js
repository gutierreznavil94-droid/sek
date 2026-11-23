// Más → Ajustes, igual que la v0.88.27 (Ajustes.tsx) con lo que ya anda en la app nueva:
// lluvia de fondo (módulo temas) y «lo no cumplido resta» (módulo xp) se guardan al tocar;
// juego y fechas (este módulo) y la forja (módulo habitos) se guardan con «Guardar ajustes».
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { avisar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  const CUENTAS = ['zonaHoraria', 'diaInicioSemana', 'limiteJuegoSemana', 'limiteJuegoFinde', 'avisoJuegoPorcentaje']
  const TEXTOS_LLUVIA = { apagada: 'apagada', llovizna: 'llovizna', lluvia: 'lluvia', tormenta: 'tormenta' }
  const fechaCorta = (f) => f.split('-').reverse().join('/')

  function pintarLluvia(valor) {
    document.querySelectorAll('#lluvia [data-lluvia]').forEach((b) => {
      const si = b.dataset.lluvia === valor
      b.classList.toggle('ok', si)
      b.setAttribute('aria-pressed', String(si))
    })
  }

  function pintarResta(r) {
    $('#resta-activa').checked = r.activa
    $('#resta-porcentaje').value = r.porcentaje
    $('#resta-porcentaje').disabled = !r.activa
    const entreno = Math.round((30 * r.porcentaje) / 100)
    $('#resta-ayuda').textContent = `Al cerrar el día, cada pilar o serie rápida que tocaba y no hiciste resta ${r.porcentaje} % de su XP (Entrenamiento da 30 → −${entreno}). No resta en descanso, lo pausado ni la falla perdonada de la forja. La XP nunca baja de 0.` +
      (r.activa && r.desde ? ` Vale desde el ${fechaCorta(r.desde)}; los días de antes no se tocan.` : '')
  }

  function pintarCuentas(a, zonas) {
    const lista = zonas.includes(a.zonaHoraria) ? zonas : [a.zonaHoraria, ...zonas]
    $('#zonaHoraria').innerHTML = ''
    for (const z of lista) $('#zonaHoraria').add(new Option(z, z))
    for (const k of CUENTAS) $('#' + k).value = String(a[k])
  }

  function pintarForja(c) {
    document.querySelectorAll('[data-forja]').forEach((i) => { i.value = c[i.dataset.forja] })
  }

  $('#lluvia').addEventListener('click', seguro(async (e) => {
    const b = e.target.closest('[data-lluvia]')
    if (!b) return
    await api('/api/temas/lluvia', { lluvia: b.dataset.lluvia }, 'PUT')
    pintarLluvia(b.dataset.lluvia)
    try { if (SEK.lluvia) b.dataset.lluvia === 'apagada' ? SEK.lluvia.apagar() : SEK.lluvia.prender(b.dataset.lluvia) } catch (err) { /* sin lluvia */ }
    avisar(`Lluvia: ${TEXTOS_LLUVIA[b.dataset.lluvia]}`)
  }))

  $('#resta-activa').addEventListener('change', seguro(async (e) => {
    const r = await api('/api/xp/resta', { activa: e.target.checked })
    pintarResta(r.resta)
    avisar(e.target.checked ? 'Lo no cumplido resta, desde hoy' : 'Lo no cumplido ya no resta')
  }))
  $('#resta-porcentaje').addEventListener('change', seguro(async (e) => {
    const v = Math.max(10, Math.min(100, Math.round(Number(e.target.value) || 50)))
    pintarResta((await api('/api/xp/resta', { porcentaje: v })).resta)
    avisar('Guardado')
  }))

  $('#guardar').addEventListener('click', seguro(async () => {
    const cambios = {}
    for (const k of CUENTAS) cambios[k] = k === 'zonaHoraria' ? $('#' + k).value : Number($('#' + k).value)
    const forja = {}
    document.querySelectorAll('[data-forja]').forEach((i) => {
      const v = Number(i.value)
      forja[i.dataset.forja] = Math.max(Number(i.dataset.min), Math.min(Number(i.dataset.max), Number.isFinite(v) ? Math.round(v) : 0))
    })
    const r = await api('/api/cuentas/ajustes', cambios, 'PUT')
    const h = await api('/api/habitos/config', { forja })
    for (const k of CUENTAS) $('#' + k).value = String(r.ajustes[k])
    pintarForja(h.forja.config)
    avisar('Ajustes guardados', { tipo: 'ok' })
  }))

  seguro(async () => {
    const [c, t, x, h] = await Promise.all([api('/api/cuentas'), api('/api/temas'), api('/api/xp'), api('/api/habitos')])
    pintarCuentas(c.ajustes, c.zonas)
    pintarLluvia(t.lluvia)
    pintarResta(x.resta)
    pintarForja(h.forja.config)
    $('#cargando').hidden = true
    $('#tarjetas').hidden = false
  })()
})()
