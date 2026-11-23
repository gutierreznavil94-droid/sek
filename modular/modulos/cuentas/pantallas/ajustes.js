// Pantalla Más → Ajustes. Pide a /api/cuentas y guarda con PUT /api/cuentas/ajustes.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const CAMPOS = ['zonaHoraria', 'diaInicioSemana', 'limiteJuegoSemana', 'limiteJuegoFinde', 'avisoJuegoPorcentaje']
  const NUMEROS = new Set(['diaInicioSemana', 'limiteJuegoSemana', 'limiteJuegoFinde', 'avisoJuegoPorcentaje'])

  function pintar(ajustes, zonas) {
    const lista = zonas.includes(ajustes.zonaHoraria) ? zonas : [ajustes.zonaHoraria, ...zonas]
    $('#zonaHoraria').innerHTML = ''
    for (const z of lista) $('#zonaHoraria').add(new Option(z, z))
    for (const k of CAMPOS) $('#' + k).value = String(ajustes[k])
  }

  $('#form').addEventListener('submit', seguro(async (e) => {
    e.preventDefault()
    const cambios = {}
    for (const k of CAMPOS) cambios[k] = NUMEROS.has(k) ? Number($('#' + k).value) : $('#' + k).value
    await api('/api/cuentas/ajustes', cambios, 'PUT')
    mensaje('Ajustes guardados')
  }))

  barra('mas')
  seguro(async () => { const r = await api('/api/cuentas'); pintar(r.ajustes, r.zonas) })()
})()
