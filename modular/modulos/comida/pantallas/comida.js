// Pantalla de Comida. Pide todo a /api/comida (las rutas de su módulo).
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje, evento } = SEK
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const litros = (ml) => `${(Math.round(ml / 10) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })} L`
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

  let r = null // último resumen
  let fecha = null // null = hoy
  let franja = 'almuerzo'
  let elegido = null // alimento en la vista de cantidad
  let editando = null

  const conFecha = (url) => (fecha ? `${url}${url.includes('?') ? '&' : '?'}fecha=${fecha}` : url)
  const cuerpo = (x) => (fecha ? { ...x, fecha } : x)

  // ---------- Dibujo ----------

  function anillo(valor, objetivo, etiqueta, unidad, pasarse) {
    const p = objetivo > 0 ? valor / objetivo : 0
    const largo = 2 * Math.PI * 42
    const clase = valor <= 0 ? '' : pasarse && p > 1.1 ? 'pasado' : p >= 0.9 ? 'listo' : ''
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="co-anillo-fondo" cx="50" cy="50" r="42"/>
      <circle class="co-anillo-valor ${clase}" cx="50" cy="50" r="42" stroke-dasharray="${largo}" stroke-dashoffset="${largo * (1 - Math.min(1, p))}"/></svg>
      <div class="co-anillo-texto"><b>${valor}</b><span class="chico">de ${objetivo} ${unidad}</span><span class="chico">${etiqueta}</span></div>`
  }

  function pintarAgua(a) {
    const nivel = Math.max(0, Math.min(1.05, a.nivel))
    $('#agua-nivel').setAttribute('y', String(136 - nivel * 104))
    $('#agua').classList.toggle('lleno', a.llego)
    $('#agua-ml').textContent = litros(a.ml)
    $('#agua-obj').textContent = ` / ${litros(a.objetivo)}`
  }

  function pintarFruta(f) {
    $('#fruta').hidden = f.usar === false
    $('#mordida-1').setAttribute('r', String(Math.min(1, f.mordido / 0.6) * 26))
    $('#mordida-2').setAttribute('r', String(Math.max(0, (f.mordido - 0.6) / 0.4) * 26))
    $('#fruta').className = `co-toma fruta-${f.estado}`
    $('#fruta-n').textContent = f.n
    $('#fruta-obj').textContent = ` / ${f.objetivo1} ${esc(f.nombre.toLowerCase())}`
  }

  function pintar(res) {
    r = res
    const esHoy = r.fecha === r.hoy
    const ds = new Date(r.fecha + 'T12:00:00Z').getUTCDay()
    $('#dia-nombre').textContent = esHoy ? 'Hoy' : r.fecha === sumarDias(r.hoy, -1) ? 'Ayer' : `${DIAS[ds]} ${Number(r.fecha.slice(8))}/${Number(r.fecha.slice(5, 7))}`
    $('#dia-despues').disabled = esHoy
    const o = r.objetivo
    $('#sin-objetivo').hidden = !!o
    $('#con-objetivo').hidden = !o
    if (o) {
      $('#anillo-kcal').innerHTML = anillo(r.totales.kcal, o.kcal, 'calorías', 'kcal', true)
      $('#anillo-prot').innerHTML = anillo(r.totales.p, o.proteina, 'proteína', 'g', false)
    }
    $('#macros').textContent = r.totales.kcal ? `Carbos ${r.totales.c} g · Grasas ${r.totales.g} g${r.estado === 'pasado' ? ' · Te pasaste un poco: mañana se compensa.' : ''}` : ''
    pintarAgua(r.agua)
    pintarFruta(r.fruta)
    const cont = $('#franjas')
    cont.innerHTML = ''
    for (const f of r.franjas) {
      if (!f.lista.length && f.id === 'otro') continue
      const s = document.createElement('section')
      s.className = 'tarjeta co-franja'
      s.innerHTML = `<div class="fila entre"><h3>${f.nombre}</h3><span class="chico">${f.totales.kcal ? `${f.totales.kcal} kcal · ${f.totales.p} g prot.` : ''}</span></div>
        <ul class="co-items">${f.lista.map((x) => `<li><button type="button" data-id="${x.id}"><span>${esc(x.nombre)}${x.up ? ' <span class="aviso" title="Ultraprocesado">●</span>' : ''}</span><span class="chico">${x.gramos} g · ${x.kcal} kcal</span></button></li>`).join('')}</ul>
        <div class="fila"><button type="button" class="chico-boton agregar">+ agregar</button>${f.lista.length > 1 ? '<button type="button" class="chico-boton guardar">guardar como comida</button>' : ''}</div>`
      s.querySelector('.agregar').onclick = () => abrirHoja(f.id)
      const g = s.querySelector('.guardar')
      if (g) g.onclick = seguro(async () => {
        const nombre = prompt(`Nombre para «${f.nombre}» (ej.: ${f.nombre} de siempre)`)
        if (!nombre || !nombre.trim()) return
        pintar(await api('/api/comida/guardadas', cuerpo({ nombre: nombre.trim(), franja: f.id })))
        mensaje('Comida guardada')
      })
      for (const b of s.querySelectorAll('[data-id]')) b.onclick = () => abrirEditar(f.lista.find((x) => String(x.id) === b.dataset.id))
      cont.appendChild(s)
    }
  }

  const cargar = seguro(async () => pintar(await api(conFecha('/api/comida'))))

  // ---------- Hoja «Comí» ----------

  function mostrar(vista) {
    for (const v of ['buscar', 'cantidad', 'propio', 'codigo']) $(`#vista-${v}`).hidden = v !== vista
  }

  function pintarFranjas() {
    $('#elegir-franja').innerHTML = r.franjas.map((f) => `<button type="button" role="radio" aria-checked="${f.id === franja}" class="${f.id === franja ? 'activo' : ''}" data-f="${f.id}">${f.nombre}</button>`).join('')
    for (const b of $('#elegir-franja').children) b.onclick = () => { franja = b.dataset.f; pintarFranjas() }
    const nombre = r.franjas.find((f) => f.id === franja).nombre
    $('#hoja-titulo').textContent = `Comí · ${nombre}`
    $('#repetir-ayer').hidden = !r.franjas.find((f) => f.id === franja).hayAyer
  }

  function abrirHoja(f) {
    franja = f || r.franjaAhora
    pintarFranjas()
    mostrar('buscar')
    $('#buscar').value = ''
    $('#resultados').innerHTML = ''
    $('#atajos').hidden = false
    $('#frecuentes').innerHTML = r.frecuentes.map((x) => `<button type="button" data-a="${esc(x.alimento)}" data-g="${x.gramos}">${esc(x.nombre)} <span class="chico">${x.kcal} kcal</span></button>`).join('')
    $('#titulo-frecuentes').hidden = !r.frecuentes.length
    for (const b of $('#frecuentes').children) b.onclick = seguro(async () => { await agregar(b.dataset.a, Number(b.dataset.g)) })
    $('#guardadas').innerHTML = r.guardadas.map((g) => `<button type="button" data-id="${g.id}">${esc(g.nombre)}</button>`).join('')
    $('#titulo-guardadas').hidden = !r.guardadas.length
    for (const b of $('#guardadas').children) {
      b.onclick = seguro(async () => {
        const x = await api(`/api/comida/guardadas/${b.dataset.id}/cargar`, cuerpo({ franja }))
        $('#hoja').close(); pintar(x); mensaje(`${x.cargadas} cosa${x.cargadas === 1 ? '' : 's'} cargada${x.cargadas === 1 ? '' : 's'}`)
      })
      b.oncontextmenu = seguro(async (e) => {
        e.preventDefault()
        if (!confirm(`¿Borrar la comida guardada «${b.textContent}»?`)) return
        pintar(await api(conFecha(`/api/comida/guardadas/${b.dataset.id}`), undefined, 'DELETE')); abrirHoja(franja)
      })
    }
    $('#hoja').showModal()
    setTimeout(() => $('#buscar').focus(), 50)
  }

  async function agregar(alimento, gramos) {
    const x = await api('/api/comida/registros', cuerpo({ alimento, gramos, franja }))
    $('#hoja').close()
    pintar(x)
    evento('completar', { modulo: 'comida' })
    mensaje('Anotado')
  }

  let espera = null
  $('#buscar').oninput = () => {
    clearTimeout(espera)
    const q = $('#buscar').value.trim()
    $('#atajos').hidden = !!q
    if (!q) { $('#resultados').innerHTML = ''; return }
    espera = setTimeout(seguro(async () => {
      const { alimentos } = await api(`/api/comida/alimentos?q=${encodeURIComponent(q)}`)
      const ul = $('#resultados')
      ul.innerHTML = alimentos.map((a, i) => `<li><button type="button" data-i="${i}"><span>${esc(a.n)}${a.fuente !== 'tabla' ? ' <span class="chico">· propio</span>' : ''}</span><span class="chico">${a.kcal} kcal / 100 g</span></button></li>`).join('') ||
        '<li class="chico">No está en la tabla. <button type="button" class="chico-boton" id="sin-resultado">Cargalo como propio</button></li>'
      for (const b of ul.querySelectorAll('[data-i]')) b.onclick = () => abrirCantidad(alimentos[Number(b.dataset.i)])
      const s = $('#sin-resultado')
      if (s) s.onclick = () => abrirPropio({ nombre: q })
    }), 200)
  }

  function abrirCantidad(a) {
    elegido = a
    $('#hoja-titulo').textContent = a.n
    $('#cant-info').textContent = `Porción: ${a.por} (${a.gr} g)`
    $('#porciones').innerHTML = [0.5, 1, 2].map((x) => `<button type="button" data-x="${x}">${x === 0.5 ? '½' : x} ${x <= 1 ? 'porción' : 'porciones'}</button>`).join('')
    for (const b of $('#porciones').children) b.onclick = () => { $('#gramos').value = Math.round(a.gr * Number(b.dataset.x)); calcularCantidad() }
    $('#gramos').value = a.gr
    calcularCantidad()
    mostrar('cantidad')
  }

  function calcularCantidad() {
    const g = Number($('#gramos').value) || 0
    const f = g / 100
    $('#cant-kcal').textContent = `${Math.round(elegido.kcal * f)} kcal`
    $('#cant-macros').textContent = `Proteína ${Math.round(elegido.p * f)} g · Carbos ${Math.round(elegido.c * f)} g · Grasas ${Math.round(elegido.g * f)} g`
    for (const b of $('#porciones').children) b.classList.toggle('activo', Math.abs(g - elegido.gr * Number(b.dataset.x)) < 1)
    $('#agregar').disabled = !(g > 0)
  }
  $('#gramos').oninput = calcularCantidad
  $('#agregar').onclick = seguro(async () => agregar(elegido.id, Number($('#gramos').value)))

  function abrirPropio(d) {
    const f = $('#vista-propio')
    f.reset()
    if (d && d.nombre) f.nombre.value = d.nombre
    f.codigo.value = (d && d.codigo) || ''
    $('#hoja-titulo').textContent = 'Alimento propio'
    mostrar('propio')
    f.nombre.focus()
  }
  $('#ir-propio').onclick = () => abrirPropio()
  $('#vista-propio').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    const n = (x) => (x.value === '' ? undefined : Number(x.value))
    const { alimento } = await api('/api/comida/alimentos', {
      nombre: f.nombre.value.trim(), porcion: f.porcion.value.trim(), gramos: n(f.gramos) || 100, kcal: n(f.kcal), proteina: n(f.proteina) || 0,
      ...(n(f.carbos) !== undefined ? { carbos: n(f.carbos) } : {}), ...(n(f.grasas) !== undefined ? { grasas: n(f.grasas) } : {}),
      up: f.up.checked, ...(f.codigo.value ? { codigo: f.codigo.value } : {}),
    })
    abrirCantidad(alimento)
  })

  $('#ir-codigo').onclick = () => { $('#vista-codigo').reset(); $('#hoja-titulo').textContent = 'Código de barras'; mostrar('codigo'); $('#vista-codigo').codigo.focus() }
  $('#vista-codigo').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const codigo = e.target.codigo.value.replace(/\D/g, '')
    const x = await api(`/api/comida/codigo/${codigo}`)
    if (x.alimento) return abrirCantidad(x.alimento)
    mensaje(x.motivo === 'sin_internet' ? 'Sin internet: cargalo a mano.' : 'No está en Open Food Facts: cargalo a mano.', true)
    abrirPropio({ codigo })
  })

  $('#repetir-ayer').onclick = seguro(async () => {
    const x = await api('/api/comida/repetir-ayer', cuerpo({ franja }))
    $('#hoja').close(); pintar(x); mensaje(`${x.copiadas} cosa${x.copiadas === 1 ? '' : 's'} de ayer`)
  })
  for (const b of document.querySelectorAll('.volver')) b.onclick = () => { pintarFranjas(); mostrar('buscar') }

  // ---------- Editar ----------

  function abrirEditar(x) {
    editando = x
    $('#editar-titulo').textContent = x.nombre
    $('#editar-gramos').value = x.gramos
    $('#editar').showModal()
  }
  $('#editar-guardar').onclick = seguro(async () => {
    pintar(await api(conFecha(`/api/comida/registros/${editando.id}`), { gramos: Number($('#editar-gramos').value) }, 'PUT'))
    $('#editar').close()
  })
  $('#editar-quitar').onclick = seguro(async () => {
    pintar(await api(conFecha(`/api/comida/registros/${editando.id}`), undefined, 'DELETE'))
    $('#editar').close(); mensaje('Quitado')
  })

  // ---------- Agua y fruta: un toque suma, mantener apretado abre opciones / deshace ----------

  function toqueOMantener(boton, alToque, alMantener) {
    let t = null
    let largo = false
    boton.addEventListener('pointerdown', () => { largo = false; t = setTimeout(() => { largo = true; alMantener() }, 550) })
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) boton.addEventListener(ev, () => clearTimeout(t))
    boton.addEventListener('click', (e) => { e.preventDefault(); if (!largo) alToque() })
    boton.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  const tomar = seguro(async (envase) => {
    const x = await api('/api/comida/agua', cuerpo(envase ? { envase } : {}))
    pintarAgua(x.dia)
    r.agua = { ...r.agua, ...x.dia }
    $('#agua').classList.remove('suma'); void $('#agua').offsetWidth; $('#agua').classList.add('suma')
    if (x.recienLlego) { evento('logro', { modulo: 'comida', que: 'agua' }); mensaje('¡Llegaste al agua de hoy!') }
  })

  toqueOMantener($('#agua'), () => tomar(), () => {
    $('#envases').innerHTML = r.agua.envases.map((e) => `<button type="button" data-id="${esc(e.id)}">${esc(e.nombre)} <span class="chico">${e.ml} ml</span></button>`).join('')
    for (const b of $('#envases').children) b.onclick = () => { $('#hoja-agua').close(); tomar(b.dataset.id) }
    $('#hoja-agua').showModal()
  })
  $('#agua-deshacer').onclick = seguro(async () => {
    const x = await api('/api/comida/agua/deshacer', cuerpo({}))
    pintarAgua(x.dia); $('#hoja-agua').close(); mensaje('Restado')
  })

  toqueOMantener($('#fruta'), seguro(async () => {
    const x = await api('/api/comida/fruta', cuerpo({}))
    pintarFruta(x.dia)
    if (x.recienSuperado || x.recienCumplido) evento(x.recienSuperado ? 'logro' : 'completar', { modulo: 'comida', que: 'fruta' })
  }), seguro(async () => {
    const x = await api('/api/comida/fruta/deshacer', cuerpo({}))
    pintarFruta(x.dia); mensaje('Una fruta menos')
  }))

  // ---------- Días ----------

  $('#dia-antes').onclick = () => { fecha = sumarDias(r.fecha, -1); cargar() }
  $('#dia-despues').onclick = () => { const f = sumarDias(r.fecha, 1); fecha = f >= r.hoy ? null : f; cargar() }
  $('#comi').onclick = () => abrirHoja()

  barra('comida')
  cargar()
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('dialog[open]')) cargar() })
})()
