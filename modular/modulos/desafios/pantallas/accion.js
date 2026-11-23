// /desafios/tension y /desafios/no-cumpli: hacen la escena entera (capa.js) y vuelven a ?volver= (Hoy por defecto).
(function () {
  'use strict'
  const { $, mensaje } = SEK
  const pedido = new URLSearchParams(location.search).get('volver') || ''
  const volver = /^\/[a-z0-9/_-]*$/i.test(pedido) && !pedido.startsWith('//') ? pedido : '/hoy'
  $('#volver').href = volver
  const fecha = new URLSearchParams(location.search).get('fecha') || null
  const hacer = location.pathname.endsWith('/no-cumpli') ? () => SEK.desafios.noCumpli({ fecha }) : () => SEK.desafios.tension()
  hacer()
    .then(() => { setTimeout(() => { location.href = volver }, document.querySelector('.dz-aviso') ? 10000 : 300) })
    .catch((e) => { mensaje(e.message, true); $('#estado').textContent = 'No se pudo.' })
})()
