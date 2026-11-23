// Pantalla Desafíos (Más → Desafíos). Pide todo a /api/desafios (las rutas de su módulo); lo que se ve encima lo hace capa.js.
(function () {
  'use strict'
  const { api, $, seguro, mensaje } = SEK
  const escapar = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const hora = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  function pintar(r) {
    const c = r.config
    $('#kanji-tension').textContent = c.tension.kanji
    $('#ir-tension').hidden = !c.tension.activa
    $('#hoy').textContent = `${r.iniciosHoy} 3·2·1 · ${r.caidasHoy} ${r.caidasHoy === 1 ? 'caída' : 'caídas'}`
    $('#duelo-texto').textContent = `Tensión pide ${r.duelo.tension.reps} ${r.duelo.tension.nombre.toLowerCase()}; «No cumplí» pide ${r.duelo.caida.reps} y saca ${r.xpCaida} XP.`
    $('#inicios').innerHTML = r.inicios.length
      ? r.inicios.map((i) => `<li><span>${escapar(i.accion)}</span><span class="chico">${i.fecha === r.hoy ? hora(i.iniciado || i.creado) : escapar(i.fecha)}</span></li>`).join('')
      : '<li class="chico">Todavía no usaste el 3·2·1.</li>'
    $('#tension-activa').checked = c.tension.activa
    $('#tension-kanji').value = c.tension.kanji
    $('#tension-frase').value = c.tension.frase
    $('#duelo-serie').innerHTML = '<option value="">La de flexiones (o la primera)</option>' +
      r.series.map((s) => `<option value="${escapar(s.id)}">${escapar(s.nombre)} (${s.reps})</option>`).join('')
    $('#duelo-serie').value = c.duelo.contadorId || ''
    $('#duelo-sin-serie').value = c.duelo.repsSinSerie
    $('#frase-dia').checked = c.fraseDelDia
    $('#tajo-activo').checked = c.tajo.activo
    $('#tajo-horas').value = c.tajo.horas
    $('#inicio-xp').value = c.inicio.xp
    $('#inicio-max').value = c.inicio.maxPorDia
  }

  const cargar = async () => pintar(await api('/api/desafios'))
  const numero = (s) => Number($(s).value)

  $('#form-config').addEventListener('submit', seguro(async (e) => {
    e.preventDefault()
    pintar(await api('/api/desafios/config', {
      tension: { activa: $('#tension-activa').checked, kanji: $('#tension-kanji').value, frase: $('#tension-frase').value },
      duelo: { contadorId: $('#duelo-serie').value || null, repsSinSerie: numero('#duelo-sin-serie') },
      fraseDelDia: $('#frase-dia').checked,
      tajo: { activo: $('#tajo-activo').checked, horas: numero('#tajo-horas') },
      inicio: { xp: numero('#inicio-xp'), maxPorDia: numero('#inicio-max') },
    }, 'PUT'))
    mensaje('Guardado')
  }))

  const d = SEK.desafios
  $('#ir-tension').onclick = seguro(async () => { await d.tension(); await cargar() })
  $('#ir-no-cumpli').onclick = seguro(async () => { await d.noCumpli(); await cargar() })
  $('#ir-321').onclick = () => { location.href = '/desafios/321' }
  $('#probar-frase').onclick = seguro(() => d.frase({ dia: true }))
  $('#probar-tajo').onclick = seguro(() => d.tajo())
  $('#probar-tension').onclick = seguro(() => d.tension({ prueba: true }))
  $('#probar-caida').onclick = seguro(() => d.caida({ prueba: true }))
  $('#probar-duelo').onclick = seguro(() => d.duelo('tension', { prueba: true }))

  SEK.v88.montar({ activo: 'mas', companero: 'esquina' })
  seguro(cargar)()
})()
