// Pantalla Identidad, igual que la v0.88.27 (Identidad.tsx): yo ideal y obstáculos. Pide a /api/ciclo.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { avisar } = SEK.v88
  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  let guardada = null

  const vision = $('#vision'), obstaculos = $('#obstaculos'), boton = $('#guardar')
  const revisar = () => {
    const cambiado = guardada && (vision.value !== guardada.vision || obstaculos.value !== guardada.obstaculos)
    boton.disabled = !cambiado || vision.value.trim().length < 10
  }
  const poner = (i) => { guardada = { vision: i.vision || '', obstaculos: i.obstaculos || '' }; vision.value = guardada.vision; obstaculos.value = guardada.obstaculos; revisar() }

  vision.addEventListener('input', revisar)
  obstaculos.addEventListener('input', revisar)
  boton.onclick = seguro(async () => {
    const r = await api('/api/ciclo/identidad', { vision: vision.value.trim(), obstaculos: obstaculos.value.trim() }, 'PUT')
    poner(r.identidad)
    avisar('Identidad guardada', { tipo: 'ok' })
  })
  seguro(async () => poner((await api('/api/ciclo')).identidad))()
})()
