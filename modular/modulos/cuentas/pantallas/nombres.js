// Pantalla Más → Nombres: nombre de la app, el tuyo y los de las fases. Guarda con PUT /api/cuentas/ajustes.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK

  function pintarFases(fases) {
    $('#fases').innerHTML = ''
    fases.forEach((f, i) => {
      const label = document.createElement('label')
      label.textContent = `Fase ${i + 1} `
      const input = document.createElement('input')
      input.className = 'fase'
      input.maxLength = 30
      input.value = f
      label.appendChild(input)
      $('#fases').appendChild(label)
    })
  }

  function pintar(a) {
    $('#nombreApp').value = a.nombreApp
    $('#nombrePersona').value = a.nombrePersona
    pintarFases(a.nombresFases)
  }

  $('#form').addEventListener('submit', seguro(async (e) => {
    e.preventDefault()
    const r = await api('/api/cuentas/ajustes', {
      nombreApp: $('#nombreApp').value,
      nombrePersona: $('#nombrePersona').value,
      nombresFases: [...document.querySelectorAll('.fase')].map((x) => x.value),
    }, 'PUT')
    pintar(r.ajustes)
    mensaje('Nombres guardados')
  }))

  barra('mas')
  seguro(async () => pintar((await api('/api/cuentas')).ajustes))()
})()
