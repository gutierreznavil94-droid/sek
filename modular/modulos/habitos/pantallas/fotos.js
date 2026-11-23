// Fotos de progreso y días marcados. Pide todo a /api/habitos/fotos y /api/habitos/marcas.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje } = SEK
  let fotos = []
  let comparar = false
  let elegidas = []

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const legible = (f) => { const [a, m, d] = f.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]} ${a}` }
  const src = (f) => `/api/habitos/fotos/${encodeURIComponent(f.id)}/imagen`
  const titulo = (f) => `${f.dia ? `Día ${f.dia} · ` : ''}${legible(f.fecha)}`

  const hoja = $('#hoja')
  hoja.querySelector('form').onsubmit = (e) => { if (!e.submitter || e.submitter.value !== 'cerrar') e.preventDefault() }
  function abrirHoja(t, html) { $('#hoja-titulo').textContent = t; $('#hoja-cuerpo').innerHTML = html; if (!hoja.open) hoja.showModal(); return $('#hoja-cuerpo') }
  const cerrarHoja = () => { if (hoja.open) hoja.close() }

  /** Achica la foto antes de mandarla (máx. 1080 px de lado), en webp (o jpg si el navegador no puede). */
  async function achicar(archivo, lado = 1080) {
    const url = URL.createObjectURL(archivo)
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la foto.')); i.src = url })
      const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * k)
      c.height = Math.round(img.naturalHeight * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const webp = c.toDataURL('image/webp', 0.8)
      return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function pintarFotos() {
    $('#fotos-cuenta').textContent = fotos.length ? `${fotos.length} foto${fotos.length > 1 ? 's' : ''}` : ''
    $('#fotos-vacio').hidden = fotos.length > 0
    $('#comparar').hidden = fotos.length < 2
    $('#comparar').textContent = comparar ? 'Listo' : 'Comparar'
    $('#comparar-ayuda').hidden = !comparar
    $('#fotos-ayuda').hidden = comparar || !fotos.length
    const div = $('#fotos')
    div.innerHTML = ''
    for (const f of fotos) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'hb-foto'
      if (comparar) b.setAttribute('aria-pressed', String(elegidas.includes(f.id)))
      b.setAttribute('aria-label', `Foto ${titulo(f)}`)
      b.innerHTML = `<img src="${src(f)}" alt="" loading="lazy"><span>${esc(f.dia ? `Día ${f.dia}` : legible(f.fecha))}</span>`
      b.onclick = () => (comparar ? elegir(f) : verFoto(f))
      div.appendChild(b)
    }
    const par = elegidas.map((id) => fotos.find((f) => f.id === id)).filter(Boolean)
    $('#par').hidden = !(comparar && par.length === 2)
    $('#par').innerHTML = par.length === 2 ? par.map((f) => `<figure><img src="${src(f)}" alt=""><figcaption>${esc(titulo(f))}</figcaption></figure>`).join('') : ''
  }

  function elegir(f) {
    elegidas = elegidas.includes(f.id) ? elegidas.filter((x) => x !== f.id) : [...elegidas.slice(-1), f.id]
    pintarFotos()
  }

  function verFoto(f) {
    const c = abrirHoja(titulo(f), `<img class="hb-grande" src="${src(f)}" alt=""><button type="button" class="peligro" data-borrar>Borrar esta foto</button>`)
    c.querySelector('[data-borrar]').onclick = () => {
      const c2 = abrirHoja('¿Borrar esta foto?', '<p>Se borra para siempre.</p><div class="hb-dos"><button type="button" data-no>Cancelar</button><button type="button" class="principal" data-si>Borrar</button></div>')
      c2.querySelector('[data-no]').onclick = cerrarHoja
      c2.querySelector('[data-si]').onclick = seguro(async () => { cerrarHoja(); pintar(await api(`/api/habitos/fotos/${encodeURIComponent(f.id)}`, undefined, 'DELETE')); mensaje('Foto borrada') })
    }
  }

  function pintarMarcas(marcas) {
    const ul = $('#marcas')
    ul.innerHTML = marcas.length ? '' : '<li class="chico apagado">Todavía no marcaste ningún día.</li>'
    for (const m of [...marcas].reverse()) {
      const li = document.createElement('li')
      li.className = 'hb-marca'
      li.innerHTML = `<span class="kanji" aria-hidden="true">印</span><b>${esc(legible(m.fecha))}</b><span class="chico">${esc(m.texto)}</span>`
      const q = document.createElement('button')
      q.type = 'button'
      q.className = 'hb-opciones'
      q.textContent = 'Quitar'
      q.setAttribute('aria-label', `Quitar la marca del ${legible(m.fecha)}`)
      q.onclick = seguro(async () => { pintar(await api(`/api/habitos/marcas/${m.fecha}`, undefined, 'DELETE')); mensaje('Marca quitada') })
      li.appendChild(q)
      ul.appendChild(li)
    }
  }

  function pintar(r) {
    fotos = r.fotos
    elegidas = elegidas.filter((id) => fotos.some((f) => f.id === id))
    pintarFotos()
    pintarMarcas(r.marcas)
  }

  $('#subir').onclick = () => $('#archivo').click()
  $('#archivo').onchange = seguro(async (e) => {
    const a = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!a) return
    const imagen = await achicar(a)
    const r = await api('/api/habitos/fotos', { imagen })
    pintar(r)
    mensaje(`Foto guardada${r.foto.dia ? ` · Día ${r.foto.dia}` : ''}`)
  })
  $('#comparar').onclick = () => { comparar = !comparar; elegidas = []; pintarFotos() }
  $('#marcar').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    pintar(await api(`/api/habitos/marcas/${f.fecha.value}`, { texto: f.texto.value }, 'PUT'))
    f.texto.value = ''
    mensaje('Día marcado 印')
  })
  // Por defecto, hoy (el servidor no deja marcar días que no pasaron).
  const hoy = new Date()
  $('#marcar').fecha.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  $('#marcar').fecha.max = $('#marcar').fecha.value

  barra('habitos')
  seguro(async () => pintar(await api('/api/habitos/fotos')))()
})()
