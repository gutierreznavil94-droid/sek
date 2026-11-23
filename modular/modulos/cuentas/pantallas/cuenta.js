// Pantalla Más → Cuenta: quién sos, cambiar contraseña y salir.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK

  $('#form').addEventListener('submit', seguro(async (e) => {
    e.preventDefault()
    if ($('#nueva').value !== $('#repetir').value) return mensaje('Las dos contraseñas nuevas no son iguales.', true)
    await api('/api/cuentas/clave', { actual: $('#actual').value, nueva: $('#nueva').value, repetir: $('#repetir').value })
    $('#form').reset()
    mensaje('Contraseña cambiada')
  }))
  $('#salir').addEventListener('click', seguro(async () => { await api('/api/sesion/salir', {}); location.href = '/entrar' }))

  barra('mas')
  seguro(async () => {
    const r = await api('/api/cuentas')
    $('#nombre').textContent = r.usuario.nombre
    $('#email').textContent = r.usuario.email
  })()
})()
