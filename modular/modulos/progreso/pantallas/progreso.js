// Pantalla Progreso, igual que la v0.88.27 (Progreso.tsx de la app vieja) pero en HTML+JS.
// De fondo el guerrero bajo la lluvia (fondo.js) y encima todo de vidrio: nivel / XP / racha (tocar abre la tabla
// de niveles), «道 El camino» (camino.js), caídas, pilares, los botones de cada sección con su dato clave y su
// miniatura, Mi código, días marcados y fotos. Lee /api/progreso (su módulo) y, para los botones, lo de cada módulo.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, fechaLegible } = SEK.v88
  SEK.v88.montar({ activo: 'progreso', companero: 'esquina' })

  const k = (nombre) => (SEK.tema && SEK.tema.actual && SEK.tema.icono ? SEK.tema.icono(nombre) : nombre) || nombre
  const duracion = (min) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min` }
  const sumarDias = (f, n) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  const lunesDe = (f) => sumarDias(f, -((new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7))
  let fondo = null
  let r = null

  // ---------- El video arranca justo debajo de la cabecera; al bajar se oscurece (hasta 30 %) ----------
  const tinta = document.querySelector('.progreso-tinta')
  const cab = document.querySelector('.cabecera')
  if (cab) {
    const medir = () => tinta.style.setProperty('--av-arriba', `${cab.getBoundingClientRect().bottom}px`)
    medir()
    if (window.ResizeObserver) new ResizeObserver(medir).observe(cab)
  }
  let pendiente = 0
  function alScroll() {
    if (pendiente) return
    pendiente = requestAnimationFrame(() => {
      pendiente = 0
      const h = ($('.av-hueco.resumen') || {}).offsetHeight || 400
      if (fondo) fondo.oscurecer(Math.round(Math.min(1, Math.max(0, scrollY / (h * 0.75))) * 30) / 100)
    })
  }
  addEventListener('scroll', alScroll, { passive: true })

  // ---------- Pintar ----------
  function dato(grande, chico, sub, rojo) {
    return `<div class="av-dato"><span class="av-grande ${rojo ? 'rojo' : ''}">${esc(grande)}</span><span class="av-chico">${esc(chico)}</span>${sub ? `<span class="av-nota">${esc(sub)}</span>` : ''}</div>`
  }

  /** Anillo de tinta: el arco lleno es lo cumplido. */
  function anillo(nombre, valor, texto) {
    const rr = 26
    const c = 2 * Math.PI * rr
    const v = Math.max(0, Math.min(1, valor ?? 0))
    return `<div class="av-anillo ${valor === null ? 'sin-dias' : ''}" role="img" aria-label="${esc(valor === null ? `${nombre}: ${texto}` : `${nombre}: ${Math.round(v * 100)} %`)}">
      <svg viewBox="0 0 64 64">
        <circle class="enso-fondo" cx="32" cy="32" r="${rr}" fill="none" stroke-width="4.5" stroke-dasharray="${c * 0.94} ${c}" transform="rotate(-80 32 32)" stroke-linecap="round"/>
        <circle class="enso-valor ${v < 0.75 ? 'bajo' : ''}" cx="32" cy="32" r="${rr}" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="${c * v * 0.94} ${c}" transform="rotate(-80 32 32)"/>
        <text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#f3efe6">${valor === null ? '—' : Math.round(v * 100)}</text>
      </svg>
      <span class="av-anillo-nombre">${esc(nombre)}</span>
      <span class="av-nota">${esc(texto)}</span>
    </div>`
  }

  /** Miniatura del gráfico de cada sección, bien chica, al lado del dato clave. */
  function miniatura(s, m) {
    const W = 64, H = 18
    const vacio = (y = H - 2) => `<line x1="2" x2="${W - 2}" y1="${y}" y2="${y}" class="mini-vacio"/>`
    const linea = (v) => { const max = Math.max(1, ...v); return v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 2 - (y / max) * (H - 5)).toFixed(1)}`).join(' ') }
    const barras = (v) => { const max = Math.max(1, ...v); const a = W / Math.max(1, v.length); return v.map((y, i) => { const h = Math.max(1.5, (y / max) * (H - 3)); return `<rect x="${i * a + a * 0.18}" width="${a * 0.64}" y="${H - 1 - h}" height="${h}" rx="1"/>` }).join('') }
    let cuerpo = ''
    if (s === 'xp') cuerpo = m.xp.some((x) => x > 0) ? `<path d="${linea(m.xp)}" class="mini-linea"/>` : vacio()
    else if (s === 'metas') cuerpo = m.metas.map((e, i) => `<circle cx="${4 + i * ((W - 8) / 6)}" cy="${H / 2}" r="3" class="mini-punto ${e || 'vacio'}"/>`).join('')
    else if (s === 'sueno') cuerpo = m.sueno.length ? barras(m.sueno) : vacio()
    else if (s === 'fuerza') cuerpo = m.fuerza.some((x) => x > 0) ? barras(m.fuerza) : vacio()
    else if (s === 'series') {
      const v = m.series
      if (v.length < 2) cuerpo = `<path d="M2,${H - 3} H${W / 2} V${H - 8} H${W - 2}" class="mini-vacio" fill="none"/>`
      else { const max = Math.max(1, ...v); const a = (W - 4) / v.length; cuerpo = `<path d="${v.map((y, i) => `${i ? 'L' : 'M'}${(2 + i * a).toFixed(1)},${(H - 2 - (y / max) * (H - 5)).toFixed(1)} H${(2 + (i + 1) * a).toFixed(1)}`).join(' ')}" class="mini-linea"/>` }
    } else if (s === 'comida') {
      const v = m.comida
      if (v.length < 2) cuerpo = vacio(H / 2)
      else { const lo = Math.min(...v), hi = Math.max(...v); cuerpo = `<path d="${v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - ((y - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join(' ')}" class="mini-linea"/>` }
    }
    return `<svg class="mini-grafico ${s}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${cuerpo}</svg>`
  }

  const TUMBA = '<svg viewBox="0 0 20 24" width="12" height="14.4" class="tema-tumba-rota" aria-hidden="true"><path class="tema-tumba-piedra" d="M3 22 L3 9 C3 5 6 2.5 9.4 2.5 L10.6 8 L8.6 12.5 L10.4 16 L9 22 Z"/><path class="tema-tumba-piedra" d="M11 22 L12.4 16.4 L10.8 12.6 L12.8 8.2 L11.2 2.6 C14.4 3 17 5.6 17 9 L17 22 Z" transform="rotate(4 14 22)"/><path class="tema-tumba-grieta" d="M10.2 2.8 L11.6 8.1 L9.7 12.6 L11.4 16.2 L10 21.6"/><path class="tema-tumba-suelo" d="M1 22.5 L19 22.5"/></svg>'

  function pintar(d) {
    r = d
    const n = d.nivel
    $('#cargando').hidden = true
    $('#tarjetas').hidden = false
    $('#flotante').textContent = `Nivel ${n.nivel} · ${n.xpEnNivel} / ${n.xpParaSiguiente} XP`
    $('#nivel').innerHTML = dato(String(n.nivel), 'NIVEL', n.etapa)
      + dato(String(n.xpTotal), 'XP TOTAL', `${n.xpEnNivel} / ${n.xpParaSiguiente} al nivel ${n.nivel + 1}`)
      + dato(String(d.racha), 'RACHA', d.racha === 1 ? 'día seguido' : 'días seguidos', d.racha > 0)
      + `<div class="av-barra" aria-hidden="true"><div style="width: ${Math.round(100 * (n.progreso || 0))}%;"></div></div>`

    const conCiclo = d.ciclo && !d.ciclo.noEmpezado && d.camino.length > 0
    $('#camino').hidden = !conCiclo
    if (conCiclo && window.SEK_CAMINO) SEK_CAMINO($('#camino'), d.camino, d.ciclo.duracionDias)

    $('#caidas').hidden = !d.caidasSuperadas
    $('#caidas').setAttribute('aria-label', `Caídas superadas: ${d.caidasSuperadas}`)
    $('#caidas').innerHTML = `<span class="caidas-fila" aria-hidden="true">${TUMBA}</span><b>${d.caidasSuperadas}</b> · Caídas superadas<span class="texto-3"> · nuevo round cada vez</span>`

    const p = d.pilares
    $('#pilares').hidden = !p.lista.length
    $('#pilares').setAttribute('aria-label', `Pilares en el ciclo: ${p.diasCumplidos} de ${p.diasContados} días cumplidos. Tocá para ver el detalle`)
    $('#pilares').innerHTML = `<div class="av-tarjeta-titulo"><span>Pilares</span><span class="av-nota">${p.diasCumplidos} de ${p.diasContados} días ›</span></div>
      <div class="av-pilares chicos">${p.lista.map((x) => anillo(x.nombre, x.programados ? x.hechos / x.programados : null, '')).join('')}</div>`

    pintarSecciones({})

    $('#marcas').hidden = !d.marcas.length
    $('#marcas').innerHTML = `<span class="marca-sello" aria-hidden="true">印</span> Días marcados: <b>${d.marcas.length}</b><span class="texto-3"> ›</span>`
  }

  /** Los botones de cada sección. `x` trae lo que se pide aparte a cada módulo (llega después, sin frenar lo primero). */
  function pintarSecciones(x) {
    const d = r
    const s = d.secciones
    const hoy = d.hoy
    const lunes = lunesDe(hoy)
    const series = x.series || []
    // Metas de esta semana (lunes a domingo): verde cumplida, gris por venir, roja no cumplida.
    const metas = x.metas ? [...x.metas.pendientes.map((m) => ['gris', m]), ...x.metas.vencidas.map((m) => ['gris', m]), ...x.metas.cumplidas.map((m) => ['verde', m]), ...x.metas.noCumplidas.map((m) => ['roja', m])].filter(([, m]) => m.fecha >= lunes && m.fecha <= sumarDias(lunes, 6)) : []
    const miniMetas = Array.from({ length: 7 }, (_, i) => {
      const f = sumarDias(lunes, i)
      const del = metas.filter(([, m]) => m.fecha === f).map(([e]) => e)
      return !del.length ? null : del.includes('verde') ? 'verde' : del.includes('gris') ? 'gris' : 'roja'
    })
    const kcal = x.comida ? x.comida.kcal.slice(-7).map((y) => y.valor).filter((v) => v !== null && v !== undefined) : []
    const pesos = x.comida ? x.comida.pesos : []
    const mini = {
      xp: s.xp.mini.map((v) => v || 0),
      metas: miniMetas,
      sueno: s.sueno.mini.filter((v) => v !== null && v !== undefined),
      fuerza: x.fuerza ? x.fuerza.volumenPorSemana.slice(-6).map((v) => v.volumen) : [],
      series: series[0] ? series[0].escalonesReps.map((e) => e.reps) : [],
      comida: pesos.slice(-8).map((y) => y.kg),
    }
    const listas = series.filter((c) => c.metaLogradaHoy).length
    const entrenos = x.fuerza ? x.fuerza.entrenos : s.fuerza.semana
    const dc = {
      xp: `+${s.xp.semana} esta semana`,
      metas: metas.length ? `${metas.filter(([e]) => e === 'verde').length}/${metas.length} esta semana` : 'sin metas esta semana',
      sueno: s.sueno.promedio !== null ? `${duracion(Math.round(s.sueno.promedio))} por noche` : 'sin noches aún',
      fuerza: `${entrenos} ${entrenos === 1 ? 'entreno' : 'entrenos'}`,
      series: listas === series.length ? 'cuota ✓' : series.length === 1 ? `${series[0].hoy}/${series[0].cuotaHoy} hoy` : `${listas}/${series.length} cuotas`,
      comida: kcal.length ? `${Math.round(kcal.reduce((a, b) => a + b, 0) / kcal.length).toLocaleString('es-AR')} kcal/día` : pesos.length ? `${pesos[pesos.length - 1].kg} kg` : 'sin cargar aún',
    }
    const SECCIONES = [
      { id: 'xp', kanji: '昇', nombre: 'XP', href: '/progreso/seccion?cual=xp' },
      { id: 'metas', kanji: '目', nombre: 'Metas', href: '/ciclo/metas' },
      { id: 'sueno', kanji: '眠', nombre: 'Sueño', href: '/progreso/seccion?cual=sueno' },
      { id: 'fuerza', kanji: '力', nombre: 'Fuerza', href: '/progreso/seccion?cual=fuerza' },
      { id: 'series', kanji: '連', nombre: 'Series', href: '/progreso/seccion?cual=series' },
      { id: 'comida', kanji: '食', nombre: 'Comida', href: '/progreso/seccion?cual=comida' },
    ].filter((b) => b.id !== 'series' || series.length > 0)
    const reglas = x.habitos ? x.habitos.codigo.length : null
    const forjados = d.forjados || []
    $('#secciones').innerHTML = SECCIONES.map((b) => `<a href="${b.href}" class="av-tarjeta av-seccion-boton"><span class="av-seccion-kanji" aria-hidden="true">${k(b.kanji)}</span><b>${b.nombre}</b>${miniatura(b.id, mini)}<span class="av-nota">${esc(dc[b.id])}</span></a>`).join('')
      + `<a href="/habitos" class="av-tarjeta av-seccion-boton av-codigo-banner" aria-label="Mi código${reglas !== null ? `, ${reglas} ${reglas === 1 ? 'regla' : 'reglas'}` : ''}">
        <span class="av-codigo-fondo" aria-hidden="true">${k('掟')}</span>
        <span class="av-codigo-kanji" aria-hidden="true">${k('掟')}</span>
        <span class="av-codigo-textos">
          <b>Mi código</b>
          <span class="av-nota">Okite · lo que un shinobi no rompe</span>
          ${forjados.length ? `<span class="av-codigo-forjados"><span class="forja-kanji-titulo" aria-hidden="true">鍛</span>${forjados.length} forjado${forjados.length > 1 ? 's' : ''} <span class="av-codigo-forjados-k" aria-hidden="true">${esc(forjados.join(''))}</span></span>` : ''}
        </span>
        <span class="av-codigo-sello" aria-hidden="true"><span>${k('誓')}</span><em>${reglas ?? ''}</em></span>
        <svg class="av-codigo-trazo" viewBox="0 0 300 8" preserveAspectRatio="none" aria-hidden="true"><path d="M3,5 C50,2 110,7 170,4 C220,2 265,6 297,4"/></svg>
      </a>`
  }

  // ---------- Tabla de niveles ----------
  async function verNiveles() {
    const t = await api('/api/xp/niveles')
    if (fondo) fondo.pausar(true)
    const h = hoja('Niveles', `<p class="chico texto-2">Pasar del nivel n al n+1 cuesta ${t.base} × n XP. No hay tope. Al lado de cada nivel alcanzado, la fecha.</p>
      <table class="tabla"><thead><tr><th>Nivel</th><th class="num">XP total</th><th>Etapa</th><th>Alcanzado</th></tr></thead><tbody>
      ${t.filas.map((f) => `<tr${f.nivel === t.actual ? ' style="color: var(--acento); font-weight: 700;"' : ''}><td>${f.nivel}</td><td class="num">${f.xpTotal}</td><td>${esc(f.etapa)}</td><td class="chico texto-3">${f.alcanzado ? fechaLegible(f.alcanzado) : f.nivel === 1 ? 'inicio' : ''}</td></tr>`).join('')}
      </tbody></table>`)
    alCerrar(h, () => fondo && fondo.pausar(false))
  }
  /** Avisa cuando la hoja se va (por ✕, por tocar afuera o por Escape). */
  function alCerrar(h, fn) {
    const fondoModal = h.el.parentElement
    new MutationObserver((_, o) => { if (!fondoModal.isConnected) { o.disconnect(); fn() } }).observe(fondoModal.parentElement, { childList: true })
  }
  $('#nivel').onclick = seguro(verNiveles)
  $('#nivel').onkeydown = (e) => { if (e.key === 'Enter') $('#nivel').click() }

  // ---------- Días marcados ----------
  $('#marcas').onclick = () => {
    if (!r) return
    hoja('印 Días marcados', r.marcas.map((m) => `<div class="fila chico marcas-item"><span class="marca-sello" aria-hidden="true">印</span><b>${fechaLegible(m.fecha)}</b><span class="texto-2">${esc(m.texto)}</span></div>`).join(''))
  }

  // ---------- Fotos ----------
  let fotos = []
  let comparar = false
  let elegidas = []
  const src = (f) => `/api/habitos/fotos/${encodeURIComponent(f.id)}/imagen`
  const tituloFoto = (f) => `${f.dia ? `Día ${f.dia} · ` : ''}${fechaLegible(f.fecha)}`

  function pintarFotos() {
    const caja = $('#fotos')
    const par = elegidas.map((id) => fotos.find((f) => f.id === id)).filter(Boolean)
    caja.innerHTML = `<div class="av-tarjeta-titulo">
        <span><span class="camino-titulo-k" aria-hidden="true">写</span> Fotos</span>
        <span class="fila" style="gap: 6px;">
          ${fotos.length >= 2 ? `<button type="button" class="boton chico ${comparar ? 'primario' : 'suave'}" data-comparar>${comparar ? 'Listo' : 'Comparar'}</button>` : ''}
          <button type="button" class="boton chico" data-subir>+ Foto de hoy</button>
        </span>
      </div>
      ${!fotos.length ? '<p class="av-nota" style="margin: 0;">Opcional: una foto el Día 1, otra el Día 20… queda con el día en que la cargás. Solo en este celu.</p>' : `
        ${comparar ? '<p class="av-nota" style="margin: 0 0 6px;">Elegí dos fotos para verlas lado a lado.</p>' : ''}
        <div class="fotos-fila">${fotos.map((f) => `<button type="button" class="foto-mini ${elegidas.includes(f.id) ? 'elegida' : ''}" data-foto="${esc(f.id)}" aria-label="Foto del día ${f.dia || '—'}, ${fechaLegible(f.fecha)}"><img src="${src(f)}" alt="" loading="lazy"><span class="foto-dia">${f.dia ? `Día ${f.dia}` : fechaLegible(f.fecha)}</span></button>`).join('')}</div>
        ${comparar && par.length === 2 ? `<div class="fotos-par">${par.map((f) => `<figure><img src="${src(f)}" alt=""><figcaption>${f.dia ? `Día ${f.dia}` : ''} · ${fechaLegible(f.fecha)}</figcaption></figure>`).join('')}</div>` : ''}
        ${!comparar ? '<p class="av-nota muy-chico" style="margin: 4px 0 0;">Tocá para verla grande · mantené apretado para borrar.</p>' : ''}`}`
    caja.querySelector('[data-subir]').onclick = () => $('#archivo-foto').click()
    const bc = caja.querySelector('[data-comparar]')
    if (bc) bc.onclick = () => { comparar = !comparar; elegidas = []; pintarFotos() }
    caja.querySelectorAll('[data-foto]').forEach((b) => {
      const f = fotos.find((x) => x.id === b.dataset.foto)
      // Tocar abre; mantener apretado (medio segundo) pregunta si borrar.
      let largo = 0, fue = false
      b.addEventListener('pointerdown', () => { fue = false; largo = setTimeout(() => { fue = true; borrarFoto(f) }, 550) })
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(largo))
      b.addEventListener('contextmenu', (e) => e.preventDefault())
      b.onclick = () => {
        if (fue) return
        if (comparar) { elegidas = elegidas.includes(f.id) ? elegidas.filter((x) => x !== f.id) : [...elegidas.slice(-1), f.id]; pintarFotos(); return }
        hoja(tituloFoto(f), `<img class="foto-grande" src="${src(f)}" alt="">`)
      }
    })
  }
  function borrarFoto(f) {
    const h = hoja('¿Borrar esta foto?', '<p class="chico texto-2">Se borra de este celu.</p><div class="fila" style="gap: 8px;"><button type="button" class="boton suave" data-no style="flex: 1;">Cancelar</button><button type="button" class="boton peligro" data-si style="flex: 1;">Borrar</button></div>')
    h.el.querySelector('[data-no]').onclick = h.cerrar
    h.el.querySelector('[data-si]').onclick = seguro(async () => {
      h.cerrar()
      fotos = (await api(`/api/habitos/fotos/${encodeURIComponent(f.id)}`, undefined, 'DELETE')).fotos
      elegidas = elegidas.filter((id) => id !== f.id)
      pintarFotos()
      avisar('Foto borrada')
    })
  }
  /** Achica la foto antes de guardarla (máx. 1080 px de lado), en webp (o jpg si el celu no puede). */
  async function achicar(archivo, lado = 1080) {
    const url = URL.createObjectURL(archivo)
    try {
      const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer la foto.')); i.src = url })
      const e = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * e)
      c.height = Math.round(img.naturalHeight * e)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const webp = c.toDataURL('image/webp', 0.8)
      return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82)
    } finally { URL.revokeObjectURL(url) }
  }
  $('#archivo-foto').onchange = async (e) => {
    const a = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!a) return
    try {
      const res = await api('/api/habitos/fotos', { imagen: await achicar(a) })
      fotos = res.fotos
      pintarFotos()
      avisar(`Foto guardada${res.foto && res.foto.dia ? ` · Día ${res.foto.dia}` : ''}`, { tipo: 'ok' })
    } catch (err) { avisar(err.message || String(err), { tipo: 'bajo' }) }
  }

  // ---------- Arranque ----------
  seguro(async () => {
    const d = await api('/api/progreso')
    fondo = window.SEK_FONDO_PROGRESO ? SEK_FONDO_PROGRESO({ hoy: d.hoy, diaUno: d.ciclo && d.ciclo.inicio }) : null
    pintar(d)
    pintarFotos()
    alScroll()
    // Lo de cada botón y las fotos, después: no frena la primera pintada.
    const nada = () => null
    const [series, metas, comida, fuerza, habitos, fs] = await Promise.all([
      api('/api/series').then((x) => x.series).catch(nada),
      api('/api/ciclo/metas').catch(nada),
      api('/api/progreso/comida').catch(nada),
      api('/api/progreso/fuerza').catch(nada),
      api('/api/habitos').catch(nada),
      api('/api/habitos/fotos').catch(nada),
    ])
    pintarSecciones({ series: series || [], metas, comida, fuerza, habitos })
    if (fs) { fotos = fs.fotos; pintarFotos() }
  })()
})()
