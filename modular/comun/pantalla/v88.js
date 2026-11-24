/*
 * El marco de la v0.88.27: la cabecera de papel (Día X de 90, fecha, barra de fases y la franja de pincel),
 * la barra del horario que queda fija arriba, la barra de abajo con sus 6 botones y los avisos de abajo.
 * Es lo que armaba Layout.tsx en la app vieja, en HTML+JS. Lo usan las pantallas que ya se pasaron a
 * «igual que la vieja»; necesita /comun/v88.css, /comun/marco.js y /comun/v88-dibujos.js antes.
 *
 *   SEK.v88.montar({ activo: 'hoy', horario: true })   arma todo alrededor del <main class="contenido">
 *   SEK.v88.montar({ completa: 'entreno-app' })          pantalla completa, sin cabecera ni barra de abajo
 *   SEK.v88.avisar(texto, { tipo: 'ok'|'bajo', accion: { texto, fn } })
 *   SEK.v88.hoja(titulo, html) → { el, cerrar }          hoja que sube desde abajo
 *   SEK.v88.brillo(estado, indice)                        atributos data-brillo y desfase (como brillo.ts)
 *   SEK.v88.fechaLegible('2026-11-23') → 'lun 23 nov'   SEK.v88.litros(ml) → '1,5 L'   SEK.v88.esc(texto)
 */
(function () {
  'use strict'
  const VERSION = '0.18'
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const FASES = ['Disciplina', 'Constancia', 'Mi yo ideal']

  const ICONOS = {
    hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>',
    calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M3 9h18M8 2v4M16 2v4"></path></svg>',
    juego: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M9 2h6"></path></svg>',
    sueno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path></svg>',
    progreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7"></path></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
  }
  const NAV = [
    { id: 'hoy', texto: 'Hoy', ruta: '/hoy' },
    { id: 'calendario', texto: 'Calendario', ruta: '/calendario' },
    { id: 'juego', texto: 'Juego', ruta: '/juego' },
    { id: 'sueno', texto: 'Sueño', ruta: '/sueno' },
    { id: 'progreso', texto: 'Progreso', ruta: '/progreso' },
    { id: 'mas', texto: 'Más', ruta: '/mas' },
  ]

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay()
  const fechaLegible = (f) => { const [, m, d] = f.split('-').map(Number); return `${DIAS[diaSemana(f)]} ${d} ${MESES[m - 1]}` }
  const litros = (ml) => { const l = ml / 1000; return `${(Math.round(l * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: l >= 10 ? 1 : 2 })} L` }
  const brillo = (estado, i) => estado ? `data-brillo="${estado}" style="--brillo-desfase: ${-((i * 0.7) % 3).toFixed(2)}s;"` : ''

  // ---------- Cabecera ----------
  function textoDia(e) {
    if (!e) return '…'
    const faltan = 1 - e.dia
    if (e.diaCero) return 'Día 0 ✨'
    if (e.noEmpezado) return `Empieza en ${faltan} día${faltan === 1 ? '' : 's'}`
    if (e.terminado) return `Ciclo terminado (día ${e.dia})`
    return `Día ${e.dia} de ${e.ciclo.duracionDias}`
  }
  function textoMini(e) {
    if (!e) return ''
    const faltan = 1 - e.dia
    return e.diaCero ? 'Día 0' : e.noEmpezado ? `Día 1 en ${faltan} día${faltan === 1 ? '' : 's'}` : e.terminado ? 'Ciclo terminado' : `Día ${e.dia}`
  }

  function pintarCabecera(cab, e, nombres, hoy) {
    const fecha = fechaLegible(hoy)
    const extraFecha = e && (e.noEmpezado || e.diaCero) ? `<span class="texto-3"> · Día 1: ${fechaLegible(e.ciclo.inicio)}</span>` : ''
    cab.querySelector('.dia').textContent = textoDia(e)
    cab.querySelector('.fecha').innerHTML = `${fecha}${extraFecha}<a class="texto-3 mono" href="/mas" style="font-size: 0.75rem; margin-left: 8px;">v${VERSION}</a>`
    const ciclo = cab.querySelector('.cabecera-ciclo')
    ciclo.textContent = e && e.ciclo.numero > 1 ? `Ciclo ${e.ciclo.numero}` : ''
    ciclo.hidden = !ciclo.textContent
    const barra = cab.querySelector('.barra-fases')
    if (!e || !e.fases || !e.fases.length) { barra.hidden = true; return }
    barra.hidden = false
    barra.innerHTML = e.fases.map((f) => {
      const total = f.diaFin - f.diaInicio + 1
      const hechos = Math.max(0, Math.min(total, e.dia - f.diaInicio + 1))
      const actual = !e.noEmpezado && !e.terminado && f.numero === e.faseNumero
      const nombre = (nombres && nombres[f.numero - 1]) || FASES[f.numero - 1] || f.foco
      return `<div class="tramo ${actual ? 'actual' : ''} ${f.numero === e.fases.length ? 'final' : ''}" style="flex: ${total} 1 0%;"><div class="lleno" style="width: ${(100 * hechos) / total}%;"></div><span class="etq">${f.numero} · ${esc(nombre)}</span></div>`
    }).join('')
    document.querySelector('.app').dataset.fase = e && !e.noEmpezado && !e.terminado ? e.faseNumero : 1
  }

  // ---------- Barra del horario: sigue al hueco de la cabecera y queda fija arriba al bajar ----------
  function seguirHueco(barra) {
    let fija = null
    const mover = () => {
      const h = document.getElementById('hueco-horario')
      const y = h ? Math.max(0, h.getBoundingClientRect().top) : 0
      barra.style.transform = `translate3d(0px, ${y.toFixed(1)}px, 0px)`
      const ahora = y <= 0.5
      if (ahora !== fija) { fija = ahora; barra.classList.toggle('fija', ahora) }
    }
    window.addEventListener('scroll', mover, { passive: true })
    window.addEventListener('resize', mover)
    mover()
    return mover
  }

  /** Arma la app de la v0.88 alrededor del <main class="contenido"> de la página. */
  function montar({ activo = 'hoy', horario = false, companero = null, completa = '' } = {}) {
    const main = document.querySelector('main.contenido') || document.querySelector('main')
    main.classList.add('contenido')
    // Pantalla completa (el entreno): sin cabecera ni barra de abajo, como `app entreno-app` de la vieja.
    if (completa) {
      const app = document.createElement('div')
      app.className = `app ${completa}`
      document.body.insertBefore(app, main)
      app.appendChild(main)
      return { app, listo: Promise.resolve({}), huecoExtra: null, huecoHorario: null, mover: () => {} }
    }
    const app = document.createElement('div')
    app.className = 'app'
    app.dataset.fase = '1'
    app.innerHTML = `
      <header class="cabecera">
        <div class="cabecera-int">
          <div><div class="dia">…</div><div class="fecha"></div></div>
          <div class="fase" style="text-align: right;"><div class="cabecera-ciclo" hidden></div><span id="cabecera-extra" class="cabecera-extra"></span></div>
        </div>
        <a class="barra-fases" href="/ciclo/objetivos" aria-label="Ver detalle de la fase" hidden></a>
        <div id="hueco-horario" class="hueco-horario ${horario ? 'con' : ''}" aria-hidden="true"></div>
        ${window.SEK_DIBUJOS ? window.SEK_DIBUJOS.divisor : ''}
      </header>
      <canvas class="motas-tinta" aria-hidden="true"></canvas>
      <canvas class="motas-torpe" aria-hidden="true"></canvas>
      <div class="dia-mini" aria-hidden="true"></div>
      ${horario ? `<div class="barra-horario-fija"><canvas class="tema-papel-mojado" aria-hidden="true"></canvas><div class="barra-horario-int"><span class="barra-dia" aria-hidden="true"></span><div id="barra-horario-slot" class="barra-horario-slot"></div></div>${window.SEK_DIBUJOS ? window.SEK_DIBUJOS.barraPincel : ''}</div>` : ''}
      <nav class="nav" aria-label="Secciones">${NAV.map((n) => `<a href="${n.ruta}"${n.id === activo ? ' class="activo" aria-current="page"' : ''}>${ICONOS[n.id]}${n.texto}</a>`).join('')}</nav>`
    document.body.insertBefore(app, main)
    app.insertBefore(main, app.querySelector('nav'))
    const barra = app.querySelector('.barra-horario-fija')
    // La cabecera se hace polvo al bajar (v88-polvo.js); si no está cargado, la barra solo sigue al hueco.
    const polvo = window.SEK_POLVO ? window.SEK_POLVO({ cabecera: app.querySelector('.cabecera'), barra, mini: app.querySelector('.dia-mini'), lienzo: app.querySelector('.motas-tinta'), lienzoTorpe: app.querySelector('.motas-torpe') }) : null
    const mover = polvo ? polvo.mover : barra ? seguirHueco(barra) : () => {}
    if (barra && window.SEK_PAPEL_MOJADO) window.SEK_PAPEL_MOJADO(barra.querySelector('.tema-papel-mojado'))
    // El compañero del tema (temas/companero.js): pasea en Hoy, quieto en una esquina en otras.
    if (companero && window.SEK_COMPANERO) window.SEK_COMPANERO({ lugar: companero })

    // Datos de la cabecera: el ciclo (ciclo) y los nombres de las fases (cuentas).
    const listo = Promise.all([
      SEK.api('/api/ciclo').catch(() => null),
      SEK.api('/api/cuentas').catch(() => null),
    ]).then(([c, cu]) => {
      const e = c && c.ciclo ? c : null
      const hoy = (c && c.hoy) || new Date().toLocaleDateString('en-CA')
      pintarCabecera(app.querySelector('.cabecera'), e, cu && cu.ajustes && cu.ajustes.nombresFases, hoy)
      if (barra) barra.querySelector('.barra-dia').textContent = textoMini(e)
      app.querySelector('.dia-mini').textContent = textoMini(e)
      mover()
      return { ciclo: e, ajustes: cu && cu.ajustes }
    })
    return { app, listo, huecoExtra: app.querySelector('#cabecera-extra'), huecoHorario: app.querySelector('#barra-horario-slot'), mover }
  }

  // ---------- Avisos de abajo (como avisar() de la app vieja) ----------
  let timer = null
  function avisar(texto, { tipo = '', accion = null, ms = 3500 } = {}) {
    let el = document.querySelector('.app > .aviso')
    if (el) el.remove()
    el = document.createElement('div')
    el.className = `aviso ${tipo}`
    el.setAttribute('role', 'status')
    el.innerHTML = `<span class="crece"></span>${accion ? `<button class="boton chico suave" data-accion>${esc(accion.texto)}</button>` : ''}<button class="boton chico suave icono" aria-label="Cerrar aviso" style="min-width: 32px;">✕</button>`
    el.querySelector('.crece').textContent = texto
    const cerrar = () => { clearTimeout(timer); el.remove() }
    el.querySelector('[aria-label="Cerrar aviso"]').onclick = cerrar
    if (accion) el.querySelector('[data-accion]').onclick = () => { cerrar(); Promise.resolve(accion.fn()).catch((e) => avisar(e.message, { tipo: 'bajo' })) }
    ;(document.querySelector('.app') || document.body).appendChild(el)
    clearTimeout(timer)
    timer = setTimeout(cerrar, accion ? ms + 2500 : ms)
  }

  // ---------- Hoja que sube desde abajo (como Hoja de componentes.tsx) ----------
  function hoja(titulo, html) {
    const fondo = document.createElement('div')
    fondo.className = 'fondo-modal'
    fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true"><div class="hoja-titulo"><div class="asa"></div><div class="fila entre"><h2></h2><button class="boton chico suave cerrar" aria-label="Cerrar">✕</button></div></div><div class="hoja-cuerpo col" style="gap: 12px;">${html}</div></div>`
    fondo.querySelector('h2').textContent = titulo
    const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', tecla) }
    const tecla = (e) => { if (e.key === 'Escape') cerrar() }
    fondo.onclick = cerrar
    fondo.querySelector('.hoja').onclick = (e) => e.stopPropagation()
    fondo.querySelector('.cerrar').onclick = cerrar
    document.addEventListener('keydown', tecla)
    ;(document.querySelector('.app') || document.body).appendChild(fondo)
    return { el: fondo.querySelector('.hoja'), cerrar }
  }

  /** Hoja con «¿Seguro?» y dos botones (como Confirmar de la vieja). `fn` corre al tocar el botón rojo. */
  function confirmar(titulo, texto, si, fn) {
    const h = hoja(titulo, `<p class="chico texto-2">${esc(texto)}</p><div class="rejilla-2"><button type="button" class="boton suave" data-no>Cancelar</button><button type="button" class="boton peligro" data-si>${esc(si)}</button></div>`)
    h.el.querySelector('[data-no]').onclick = h.cerrar
    h.el.querySelector('[data-si]').onclick = async () => { h.cerrar(); try { await fn() } catch (e) { avisar(e.message, { tipo: 'bajo' }) } }
  }

  window.SEK = window.SEK || {}
  /** Íconos de los pilares (IconoPilar de la vieja; lo usan Hoy, Calendario y la Revisión): pesa, luna, pincel, cubiertos, libro, birrete, meditar, celu, estrella, maletín. */
  function iconoPilar(id, tipo) {
    const s = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`
    if (tipo === 'entrenamiento') return s('<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"></path>')
    if (tipo === 'acostarse') return s('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>')
    if (id === 'manga' || /dibuj|manga|pint/i.test(id)) return s('<path d="M14 4l6 6-9 9H5v-6z"></path><path d="M12 6l6 6"></path>')
    if (tipo === 'comida_plan') return s('<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1-3 4-3 8h3"></path>')
    if (/leer/.test(id)) return s('<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"></path>')
    if (/estudiar/.test(id)) return s('<path d="M2 9l10-5 10 5-10 5z"></path><path d="M6 11v5c3 2 9 2 12 0v-5"></path>')
    if (/meditar/.test(id)) return s('<circle cx="12" cy="5" r="2"></circle><path d="M12 8v5M5 19c2-3 4-4 7-4s5 1 7 4M8 12l4 1 4-1"></path>')
    if (/pantalla/.test(id)) return s('<rect x="7" y="2" width="10" height="20" rx="2"></rect><path d="M4 4l16 16"></path>')
    if (/^p-otro/.test(id)) return s('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"></path>')
    return s('<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"></path>')
  }

  // ---------- Dibujos del agua y la fruta ----------
  /** La cantimplora del agua (Hoy y Comida). `ancho` en px; el alto es 1,5 veces. */
  function cantimplora(nivel, ancho = 20) {
    const lleno = Math.max(0, Math.min(1, nivel || 0))
    const y = 134 - lleno * 100
    return `<svg viewBox="0 0 100 150" width="${ancho}" height="${Math.round(ancho * 1.5)}" class="agua-svg ${nivel >= 0.999 ? 'llena' : ''} ${nivel > 1.001 ? 'rebalsa' : ''}" role="img"><defs><clipPath id="agua-cuerpo"><path d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34 Z"></path></clipPath></defs><path class="agua-fondo" d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34 Z"></path><g clip-path="url(#agua-cuerpo)"><g class="agua-nivel" style="transform: translateY(${y}px);"><path class="agua-ola" d="M-100 4 Q-87 0 -75 4 T-50 4 T-25 4 T0 4 T25 4 T50 4 T75 4 T100 4 T125 4 T150 4 T175 4 T200 4 V140 H-100 Z"></path><path class="agua-ola dos" d="M-100 6 Q-90 2 -80 6 T-60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 T180 6 T200 6 V140 H-100 Z"></path></g></g><path class="agua-trazo fino" d="M17 70 Q50 76 83 70"></path><path class="agua-trazo fino" d="M14 104 Q50 110 86 104"></path><path class="agua-trazo cuerpo" d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34"></path><path class="agua-trazo" d="M38 34 V20 Q38 16 42 16 H58 Q62 16 62 20 V34"></path><rect class="agua-tapa" x="35" y="6" width="30" height="12" rx="4"></rect><path class="agua-trazo fino" d="M38 24 H62 M38 29 H62"></path><path class="agua-trazo cordel" d="M35 12 C 20 14, 12 30, 16 50 M65 12 C 80 14, 88 30, 84 50"></path></svg>`
  }
  const MORDISCOS = [{ x: 94, y: 88, r: 22 }, { x: 6, y: 96, r: 22 }, { x: 88, y: 58, r: 16 }, { x: 12, y: 62, r: 16 }, { x: 86, y: 124, r: 16 }]
  /** La fruta del día, mordida según lo comido (Hoy y Comida). */
  function manzana(mordido, ancho = 20) {
    const trazos = '<path class="tema-manzana-trazo" d="M50 52 C50 40 52 30 57 22"></path><path class="tema-manzana-trazo fino" d="M55 32 C62 22 74 22 78 26 C72 34 62 36 55 32 Z"></path>'
    if (mordido >= 0.999) return `<svg viewBox="0 0 100 150" width="${ancho}" height="${Math.round(ancho * 1.5)}" class="tema-manzana centro" role="img">${trazos}<path class="tema-manzana-cuerpo" d="M36 54 C44 50 56 50 64 54 C58 66 56 78 56 92 C56 106 60 116 64 128 C56 134 44 134 36 128 C40 116 44 106 44 92 C44 78 42 66 36 54 Z"></path></svg>`
    const n = mordido <= 0 ? 0 : Math.min(MORDISCOS.length, Math.max(1, Math.round(mordido / 0.3)))
    return `<svg viewBox="0 0 100 150" width="${ancho}" height="${Math.round(ancho * 1.5)}" class="tema-manzana" role="img">${trazos}<defs><mask id="manzana-m"><rect x="0" y="0" width="100" height="150" fill="#fff"></rect>${MORDISCOS.slice(0, n).map((m) => `<circle cx="${m.x}" cy="${m.y}" r="${m.r}" fill="#000"></circle>`).join('')}</mask></defs><path class="tema-manzana-cuerpo" d="M50 52 C38 42 14 46 13 76 C12 106 30 136 44 136 C47 136 48 134 50 134 C52 134 53 136 56 136 C70 136 88 106 87 76 C86 46 62 42 50 52 Z" mask="url(#manzana-m)"></path></svg>`
  }
  window.SEK.v88 = { VERSION, montar, avisar, hoja, brillo, esc, fechaLegible, litros, diaSemana, iconoPilar, confirmar, cantimplora, manzana }
})()
