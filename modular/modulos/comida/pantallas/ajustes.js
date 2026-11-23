// Ajustes de Comida: objetivo, peso, agua y fruta. Pide todo a /api/comida/ajustes.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const FACTOR = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 }
  let envases = []
  let principal = null

  // La misma cuenta que modulos/comida/calculo.js (solo para mostrar mientras se escribe; la que vale es la del servidor).
  function calcular(d) {
    if (!(d.peso > 25 && d.altura > 100 && d.edad > 10)) return null
    const basal = 10 * d.peso + 6.25 * d.altura - 5 * d.edad + (d.sexo === 'hombre' ? 5 : -161)
    const kcal = basal * FACTOR[d.actividad] * (d.meta === 'bajar' ? 0.8 : d.meta === 'ganar' ? 1.1 : 1)
    return { kcal: Math.round(kcal / 50) * 50, proteina: Math.round((d.peso * (d.meta === 'mantener' ? 1.4 : 1.8)) / 5) * 5 }
  }

  const fo = $('#objetivo')
  const leerObjetivo = () => ({ peso: Number(fo.peso.value), altura: Number(fo.altura.value), edad: Number(fo.edad.value), sexo: fo.sexo.value, actividad: fo.actividad.value, meta: fo.meta.value })
  function mostrarCalculo() {
    const c = calcular(leerObjetivo())
    $('#calc-kcal').textContent = c ? c.kcal : '—'
    $('#calc-prot').textContent = c ? c.proteina : '—'
    $('#a-mano').hidden = !fo.manual.checked
    if (fo.manual.checked && c && !fo.kcal.value) { fo.kcal.value = c.kcal; fo.proteina.value = c.proteina }
  }
  fo.oninput = mostrarCalculo
  fo.onsubmit = seguro(async (e) => {
    e.preventDefault()
    const d = { ...leerObjetivo(), manual: fo.manual.checked }
    if (d.manual) { d.kcal = Number(fo.kcal.value); d.proteina = Number(fo.proteina.value) }
    pintar(await api('/api/comida/objetivo', d, 'PUT'))
    mensaje('Objetivo guardado')
  })

  $('#peso').onsubmit = seguro(async (e) => {
    e.preventDefault()
    pintar(await api('/api/comida/peso', { kg: Number(e.target.kg.value) }))
    e.target.reset()
    mensaje('Peso guardado')
  })

  function pintarEnvases() {
    const cont = $('#envases')
    cont.innerHTML = envases.map((e, i) => `<div class="co-envase">
      <input type="radio" name="principal" value="${i}" ${e.id === principal ? 'checked' : ''} aria-label="Suma con un toque">
      <input data-campo="nombre" data-i="${i}" value="${esc(e.nombre)}" aria-label="Nombre" maxlength="30">
      <input data-campo="ml" data-i="${i}" type="number" inputmode="numeric" min="1" value="${e.ml}" aria-label="ml">
      <button type="button" data-borrar="${i}" aria-label="Quitar ${esc(e.nombre)}" ${envases.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('')
    for (const r of cont.querySelectorAll('input[type=radio]')) r.onchange = () => { principal = envases[Number(r.value)].id }
    for (const x of cont.querySelectorAll('[data-campo]')) x.oninput = () => { envases[Number(x.dataset.i)][x.dataset.campo] = x.dataset.campo === 'ml' ? Number(x.value) : x.value }
    for (const b of cont.querySelectorAll('[data-borrar]')) b.onclick = () => { envases.splice(Number(b.dataset.borrar), 1); pintarEnvases() }
  }
  $('#envase-nuevo').onclick = () => { envases.push({ id: `env-${Date.now()}`, nombre: '', ml: 500 }); pintarEnvases(); $('#envases').lastElementChild.querySelector('[data-campo=nombre]').focus() }
  $('#agua').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const ml = e.target.objetivoMl.value
    pintar(await api('/api/comida/agua/config', { envases, principal, objetivoMl: ml === '' || Number(ml) <= 0 ? null : Number(ml), enHoy: e.target.enHoy.value }, 'PUT'))
    mensaje('Agua guardada')
  })

  $('#fruta').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    pintar(await api('/api/comida/fruta/config', { usar: f.usar.checked, nombre: f.nombre.value, objetivo1: Number(f.objetivo1.value), objetivo2: Number(f.objetivo2.value) }, 'PUT'))
    mensaje('Fruta guardada')
  })

  function pintar(a) {
    const o = a.objetivo
    if (o) {
      for (const k of ['peso', 'altura', 'edad', 'sexo', 'actividad', 'meta']) fo[k].value = o[k]
      fo.manual.checked = !!o.manual
      fo.kcal.value = o.kcal
      fo.proteina.value = o.proteina
    } else {
      fo.sexo.value = 'hombre'; fo.actividad.value = 'moderado'; fo.meta.value = 'mantener'
    }
    mostrarCalculo()
    $('#peso').hidden = !o
    const ps = a.pesos
    const min = Math.min(...ps.map((p) => p.kg)) - 1
    const max = Math.max(...ps.map((p) => p.kg)) + 1
    $('#pesos').innerHTML = ps.map((p) => `<span style="height:${Math.round(((p.kg - min) / (max - min)) * 100)}%" title="${p.fecha}: ${p.kg} kg"></span>`).join('')
    $('#pesos-texto').textContent = ps.length > 1 ? `De ${ps[0].kg} a ${ps[ps.length - 1].kg} kg (${ps.length} pesos).` : ps.length ? `${ps[0].kg} kg` : ''
    const ag = a.agua
    envases = ag.config.envases.map((e) => ({ ...e }))
    principal = ag.config.principal
    pintarEnvases()
    $('#agua').objetivoMl.value = ag.config.objetivoMl || ''
    $('#agua').enHoy.value = ag.config.enHoy || 'chica'
    $('#agua-calculo').textContent = ag.pesoUsado ? `Calculado: 35 ml × ${ag.pesoUsado} kg ≈ ${ag.calculado} ml. Ahora: ${ag.objetivo} ml.` : `Sin peso cargado: ${ag.calculado} ml. Ahora: ${ag.objetivo} ml.`
    const fr = $('#fruta')
    fr.usar.checked = a.fruta.usar !== false
    fr.nombre.value = a.fruta.nombre
    fr.objetivo1.value = a.fruta.objetivo1
    fr.objetivo2.value = a.fruta.objetivo2
    $('#fuentes').innerHTML = Object.values(a.fuentes).map((t) => `<li>${esc(t)}</li>`).join('')
  }

  barra('comida')
  seguro(async () => pintar(await api('/api/comida/ajustes')))()
})()
