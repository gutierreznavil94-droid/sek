// Pantalla Comida, igual que la v0.88.27 (Comida.tsx): anillos de calorías y proteína, «+ Comí», el agua con
// sus tomas y las franjas del día. La hoja «Comí» busca, usa frecuentes y comidas guardadas, repite lo de
// ayer, carga un alimento propio o lo busca por código de barras. Pide todo a /api/comida.
// Extra de la nueva: ‹ › para mirar o corregir días pasados.
(function () {
  'use strict'
  const { api, $, seguro, evento } = SEK
  const { esc, avisar, hoja, confirmar, fechaLegible, litros, cantimplora } = SEK.v88
  SEK.v88.montar({ companero: 'esquina' })
  const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const num = (n) => Math.round(n).toLocaleString('es-AR')
  const hora = (t) => new Date(t).toTimeString().slice(0, 5)
  const PUEDE_ESCANEAR = 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

  let r = null // último resumen de /api/comida
  let fecha = null // null = hoy
  let ultra = 0
  const conFecha = (url) => (fecha ? `${url}${url.includes('?') ? '&' : '?'}fecha=${fecha}` : url)
  const cuerpo = (x) => (fecha ? { ...x, fecha } : x)

  // ---------- Dibujo ----------
  /** Anillo de calorías o proteína: verde mientras va bien, ámbar al pasarse más del 10 %, nunca rojo. */
  function anillo(valor, objetivo, etiqueta, unidad, tam, alPasarse = true) {
    const c = 2 * Math.PI * 42
    const p = objetivo > 0 ? valor / objetivo : 0
    const estado = valor <= 0 ? 'vacio' : alPasarse && p > 1.1 ? 'pasado' : 'bien'
    return `<div class="co-anillo ${estado}" style="width: ${tam}px; height: ${tam}px;" role="img" aria-label="${etiqueta}: ${num(valor)} de ${num(objetivo)} ${unidad}">
      <svg viewBox="0 0 100 100"><circle class="fondo" cx="50" cy="50" r="42"></circle><circle class="valor" cx="50" cy="50" r="42" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-hasta="${c * (1 - Math.min(1, p))}"></circle></svg>
      <div class="co-anillo-centro"><b>${num(valor)}</b><span>${tam >= 110 ? `de ${num(objetivo)} ${unidad}` : unidad}</span></div></div>`
  }
  function barraFina(nombre, valor, objetivo) {
    const p = objetivo ? Math.min(1, valor / objetivo) : 0
    return `<div class="co-barra-fina"><span class="chico texto-2">${nombre}</span><div><div style="width: ${p * 100}%;" class="${valor > objetivo * 1.1 ? 'pasado' : ''}"></div></div><span class="chico mono texto-3">${Math.round(valor)} g</span></div>`
  }

  function pintar(res) {
    r = res
    const esHoy = r.fecha === r.hoy
    $('#dia-nombre').textContent = esHoy ? fechaLegible(r.fecha) : r.fecha === sumarDias(r.hoy, -1) ? `Ayer · ${fechaLegible(r.fecha)}` : fechaLegible(r.fecha)
    $('#dia-despues').hidden = esHoy
    const o = r.objetivo, t = r.totales, a = r.agua
    const franjas = r.franjas.map((f) => `<section class="co-franja">
        <div class="fila entre"><span class="seccion-titulo">${esc(f.nombre)}</span><span class="chico texto-3 mono">${f.lista.length ? `${num(f.totales.kcal)} kcal` : ''}</span></div>
        ${f.lista.map((x) => `<button type="button" class="co-item" data-item="${x.id}"><span>${esc(x.nombre)}${x.up ? '<span class="co-up" title="Ultraprocesado">UP</span>' : ''}<span class="texto-3 chico"> · ${x.gramos} g</span></span><span class="mono chico co-item-num">${num(x.kcal)} kcal · ${Math.round(x.p)} g</span></button>`).join('')}
        <div class="co-franja-acciones">${o ? `<button type="button" class="enlace chico" data-agregar="${f.id}">+ agregar</button>` : ''}${f.lista.length > 1 ? `<button type="button" class="enlace chico" data-guardar="${f.id}">guardar como comida</button>` : ''}</div>
      </section>`).join('')
    const envase = (id) => (a.envases.find((e) => e.id === id) || {}).nombre || 'agua'
    $('#cuerpo').innerHTML = `
      ${!o ? `<section class="tarjeta"><p>Para ver tus anillos, primero calculá tu objetivo: calorías y proteína por día.</p><a href="/comida/ajustes" class="boton primario ancho">Calcular mi objetivo</a></section>`
        : `<section class="co-resumen">
          <div class="co-anillos-grandes">${anillo(t.kcal, o.kcal, 'Calorías', 'kcal', 150)}${anillo(t.p, o.proteina, 'Proteína', 'g prot.', 112, false)}</div>
          ${t.kcal === 0 ? '<p class="centro texto-2">Cargá tu primera comida.</p>' : `<div class="co-barras">${barraFina('Carbos', t.c, Math.round((o.kcal * 0.5) / 4))}${barraFina('Grasas', t.g, Math.round((o.kcal * 0.28) / 9))}</div>`}
        </section>
        <button type="button" class="boton primario grande ancho" data-comi>+ Comí</button>`}
      <section class="co-franja agua-en-comida">
        <div class="fila entre"><span class="seccion-titulo">Agua</span><span class="chico texto-3 mono">${litros(a.ml)} de ${litros(a.objetivo)}</span></div>
        <div class="fila" style="gap: 12px; align-items: center;">
          <button type="button" class="agua-boton chico" data-tomar aria-label="Tomé ${esc(a.principal.nombre)} ${a.principal.ml} ml">${cantimplora(a.nivel, 56)}</button>
          <div class="col crece" style="gap: 2px;">
            ${a.tomas.length ? '' : `<span class="chico texto-2">Todavía nada. Tocá la cantimplora: suma ${esc(a.principal.nombre.toLowerCase())} ${a.principal.ml} ml.</span>`}
            ${a.tomas.map((x) => `<button type="button" class="co-item" data-toma="${x.id}" aria-label="Borrar toma de ${x.ml} ml"><span>${hora(x.instante)}<span class="texto-3 chico"> · ${esc(envase(x.envase))}</span></span><span class="mono chico co-item-num">${x.ml} ml ✕</span></button>`).join('')}
          </div>
        </div>
      </section>
      ${franjas}
      ${ultra > 0 ? `<p class="ayuda centro">${ultra} ultraprocesado${ultra === 1 ? '' : 's'} esta semana.</p>` : ''}
      <p class="ayuda centro"><a href="/comida/ajustes">Objetivo y pilar de comida</a></p>`
    $('#cargando').hidden = true
    $('#cuerpo').hidden = false
    requestAnimationFrame(() => document.querySelectorAll('.co-anillo .valor').forEach((c) => { c.style.strokeDashoffset = c.dataset.hasta }))
    conectar()
  }

  function conectar() {
    const q = (s) => document.querySelectorAll(s)
    const comi = $('[data-comi]')
    if (comi) comi.onclick = () => cargarComida()
    q('[data-agregar]').forEach((b) => { b.onclick = () => cargarComida(b.dataset.agregar) })
    q('[data-guardar]').forEach((b) => { b.onclick = () => guardarComida(b.dataset.guardar) })
    q('[data-item]').forEach((b) => { b.onclick = () => editarItem(r.franjas.flatMap((f) => f.lista).find((x) => String(x.id) === b.dataset.item)) })
    $('[data-tomar]').onclick = seguro(async () => {
      const x = await api('/api/comida/agua', cuerpo({}))
      r.agua = { ...r.agua, ...x.dia }
      pintar(r)
      if (x.recienLlego) { evento('logro', { modulo: 'comida', que: 'agua' }); avisar('¡Llegaste al agua de hoy!', { tipo: 'ok' }) }
    })
    q('[data-toma]').forEach((b) => {
      b.onclick = seguro(async () => {
        const t = r.agua.tomas.find((x) => String(x.id) === b.dataset.toma)
        const x = await api(conFecha(`/api/comida/agua/tomas/${b.dataset.toma}`), undefined, 'DELETE')
        r.agua = { ...r.agua, ...x.dia }
        pintar(r)
        avisar(`Borré ${t ? t.ml : ''} ml`)
      })
    })
  }

  const cargar = seguro(async () => {
    const [res, prog] = await Promise.all([api(conFecha('/api/comida')), api('/api/comida/progreso').catch(() => null)])
    if (prog && prog.comida) ultra = prog.comida.ultraprocesadosSemana || 0
    pintar(res)
  })

  // ---------- Editar lo cargado y guardar una franja ----------
  function editarItem(x) {
    const h = hoja(x.nombre, `<div class="campo"><label for="co-ed-g">Cantidad (g)</label><input id="co-ed-g" type="number" inputmode="numeric" value="${x.gramos}"></div>
      <div class="botonera"><button type="button" class="boton peligro" data-quitar>Quitar</button><button type="button" class="boton primario" data-ok>Guardar</button></div>`)
    h.el.querySelector('[data-quitar]').onclick = seguro(async () => { pintar(await api(conFecha(`/api/comida/registros/${x.id}`), undefined, 'DELETE')); h.cerrar(); avisar('Quitado') })
    h.el.querySelector('[data-ok]').onclick = seguro(async () => {
      const g = Number(h.el.querySelector('#co-ed-g').value)
      if (!(g > 0)) return avisar('Poné los gramos.')
      pintar(await api(conFecha(`/api/comida/registros/${x.id}`), cuerpo({ gramos: g }), 'PUT')); h.cerrar()
    })
  }
  function guardarComida(franja) {
    const f = r.franjas.find((x) => x.id === franja)
    const h = hoja('Guardar comida', `<p class="chico texto-2">${esc(f.lista.map((i) => i.nombre).join(' · '))}. Después se carga de un toque.</p>
      <div class="campo"><label for="co-gn">Nombre</label><input id="co-gn" value="${esc(f.nombre)} de siempre" maxlength="60"></div>
      <button type="button" class="boton primario ancho" data-ok>Guardar</button>`)
    h.el.querySelector('[data-ok]').onclick = seguro(async () => {
      const nombre = h.el.querySelector('#co-gn').value.trim()
      if (!nombre) return avisar('Ponele un nombre.')
      pintar(await api('/api/comida/guardadas', cuerpo({ nombre, franja }))); h.cerrar(); avisar('Comida guardada', { tipo: 'ok' })
    })
  }

  // ---------- Hoja «Comí» ----------
  function cargarComida(franjaInicial) {
    let franja = franjaInicial || r.franjaAhora || 'almuerzo'
    const h = hoja('Comí', '')
    const cuerpoHoja = h.el.querySelector('.hoja-cuerpo')
    const titulo = (t) => { h.el.querySelector('h2').textContent = t }
    let parar = null // apaga la cámara al salir de Escanear
    const cerrarTodo = h.cerrar
    h.cerrar = () => { if (parar) parar(); cerrarTodo() }
    h.el.querySelector('.cerrar').onclick = h.cerrar
    h.el.parentElement.onclick = h.cerrar

    const agregar = async (alimento, gramos, nombre, kcal) => {
      const x = await api('/api/comida/registros', cuerpo({ alimento, gramos, franja }))
      h.cerrar(); pintar(x)
      evento('completar', { modulo: 'comida' })
      avisar(nombre ? `${nombre} · ${num(kcal)} kcal` : 'Anotado', { tipo: 'ok' })
    }

    function buscar() {
      if (parar) { parar(); parar = null }
      const nombreFranja = r.franjas.find((f) => f.id === franja).nombre
      titulo(`Comí · ${nombreFranja}`)
      const ayer = r.franjas.find((f) => f.id === franja).hayAyer
      cuerpoHoja.innerHTML = `<div class="co-cargar">
        <div class="co-franjas" role="group" aria-label="Franja">${r.franjas.map((f) => `<button type="button" class="${f.id === franja ? 'activo' : ''}" data-f="${f.id}">${esc(f.nombre)}</button>`).join('')}</div>
        <input class="co-buscar" type="search" placeholder="Buscar: milanesa, huevo, mate…" aria-label="Buscar alimento" id="co-q">
        <div class="co-lista" id="co-res" hidden></div>
        <div class="col" id="co-atajos" style="gap: 10px;">
          ${r.frecuentes.length ? `<span class="seccion-titulo">Frecuentes · un toque</span><div class="co-chips">${r.frecuentes.map((f, i) => `<button type="button" data-frec="${i}">${esc(f.nombre)}<span> ${num(f.kcal)} kcal</span></button>`).join('')}</div>` : ''}
          <div class="co-atajos">
            ${PUEDE_ESCANEAR ? '<button type="button" class="boton" data-escanear>▥ Escanear</button>' : '<button type="button" class="boton" data-escanear>▥ Código</button>'}
            <button type="button" class="boton" data-propio>+ Propio</button>
            ${ayer ? '<button type="button" class="boton" data-ayer>↻ Repetir ayer</button>' : ''}
          </div>
          ${r.guardadas.length ? `<span class="seccion-titulo">Comidas guardadas</span><div class="co-chips">${r.guardadas.map((g) => `<button type="button" data-guardada="${g.id}">${esc(g.nombre)}</button>`).join('')}</div><p class="ayuda">Mantené apretada una comida guardada para borrarla.</p>` : ''}
          ${r.frecuentes.length ? '' : '<p class="ayuda">Lo que cargues va a aparecer acá arriba para repetirlo de un toque.</p>'}
        </div></div>`
      const q = (s) => cuerpoHoja.querySelector(s)
      cuerpoHoja.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { franja = b.dataset.f; buscar() } })
      cuerpoHoja.querySelectorAll('[data-frec]').forEach((b) => { b.onclick = seguro(async () => { const f = r.frecuentes[Number(b.dataset.frec)]; await agregar(f.alimento, f.gramos, f.nombre, f.kcal) }) })
      q('[data-escanear]').onclick = escanear
      q('[data-propio]').onclick = () => propio({})
      const ay = q('[data-ayer]')
      if (ay) ay.onclick = seguro(async () => { const x = await api('/api/comida/repetir-ayer', cuerpo({ franja })); h.cerrar(); pintar(x); avisar(`${x.copiadas} cosa${x.copiadas === 1 ? '' : 's'} de ayer`, { tipo: 'ok' }) })
      cuerpoHoja.querySelectorAll('[data-guardada]').forEach((b) => {
        const g = r.guardadas.find((x) => String(x.id) === b.dataset.guardada)
        b.onclick = seguro(async () => { const x = await api(`/api/comida/guardadas/${g.id}/cargar`, cuerpo({ franja })); h.cerrar(); pintar(x); avisar(`${g.nombre}: ${x.cargadas} cosa${x.cargadas === 1 ? '' : 's'}`, { tipo: 'ok' }) })
        b.oncontextmenu = (e) => {
          e.preventDefault()
          confirmar(`¿Borrar «${g.nombre}»?`, 'Lo que ya cargaste con ella queda como está.', 'Borrar', async () => { const x = await api(conFecha(`/api/comida/guardadas/${g.id}`), undefined, 'DELETE'); pintar(x); buscar() })
        }
      })
      let espera = null
      const input = q('#co-q')
      input.oninput = () => {
        clearTimeout(espera)
        const texto = input.value.trim()
        q('#co-atajos').hidden = !!texto
        q('#co-res').hidden = !texto
        if (!texto) return
        espera = setTimeout(seguro(async () => {
          const { alimentos } = await api(`/api/comida/alimentos?q=${encodeURIComponent(texto)}`)
          if (input.value.trim() !== texto) return
          q('#co-res').innerHTML = alimentos.map((a, i) => `<button type="button" class="co-opcion" data-a="${i}"><span>${esc(a.n)}<span class="texto-3 chico"> · ${esc(a.por)}</span></span><span class="mono chico texto-2">${num((a.kcal * a.gr) / 100)} kcal</span></button>`).join('') ||
            '<p class="chico texto-2">No está en la tabla. <button type="button" class="enlace" data-sin>Cargalo como propio</button></p>'
          q('#co-res').querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => cantidad(alimentos[Number(b.dataset.a)]) })
          const sin = q('[data-sin]')
          if (sin) sin.onclick = () => propio({ nombre: texto })
        }), 200)
      }
      setTimeout(() => input.focus(), 60)
    }

    function cantidad(a, inicial) {
      if (parar) { parar(); parar = null }
      titulo(a.n)
      let gramos = inicial || a.gr
      cuerpoHoja.innerHTML = `<div class="co-cargar">
        <p class="chico texto-2">Porción: ${esc(a.por)} (${a.gr} g)</p>
        <div class="co-porciones" role="group" aria-label="Porciones">${[0.5, 1, 2].map((x) => `<button type="button" data-x="${x}">${x === 0.5 ? '½' : x}</button>`).join('')}
          <label class="co-gramos"><input type="number" inputmode="numeric" min="1" id="co-g" aria-label="Gramos"><span>g</span></label></div>
        <div class="co-previa" id="co-previa"></div>
        ${a.up ? '<p class="ayuda">Marcado como ultraprocesado (solo para saberlo, no resta nada).</p>' : ''}
        <div class="botonera"><button type="button" class="boton" data-volver>‹ Volver</button><button type="button" class="boton primario" data-agregar-ya>Agregar</button></div>
        ${a.fuente === 'off' ? '<p class="ayuda">Datos de Open Food Facts (ODbL).</p>' : ''}</div>`
      const q = (s) => cuerpoHoja.querySelector(s)
      const g = q('#co-g')
      const previa = () => {
        const f = gramos / 100
        q('#co-previa').innerHTML = `<div><b>${num(a.kcal * f)}</b><span>kcal</span></div><div><b>${Math.round(a.p * f)}</b><span>g prot.</span></div><div class="chico"><b>${Math.round(a.c * f)}</b><span>carbos</span></div><div class="chico"><b>${Math.round(a.g * f)}</b><span>grasas</span></div>`
        cuerpoHoja.querySelectorAll('[data-x]').forEach((b) => b.classList.toggle('activo', Math.abs(gramos / a.gr - Number(b.dataset.x)) < 0.01))
        q('[data-agregar-ya]').disabled = !(gramos > 0)
      }
      g.value = gramos
      g.oninput = () => { gramos = Number(g.value) || 0; previa() }
      cuerpoHoja.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => { gramos = Math.round(a.gr * Number(b.dataset.x)); g.value = gramos; previa() } })
      q('[data-volver]').onclick = buscar
      q('[data-agregar-ya]').onclick = seguro(() => agregar(a.id, gramos, a.n, (a.kcal * gramos) / 100))
      previa()
    }

    function propio({ nombre = '', codigo = '' }) {
      if (parar) { parar(); parar = null }
      titulo('Alimento propio')
      cuerpoHoja.innerHTML = `<div class="co-cargar">
        ${codigo ? `<p class="chico texto-2">Código ${esc(codigo)}: no lo encontramos. Cargalo una vez y queda guardado.</p>` : ''}
        <div class="campo"><label for="pr-n">Nombre</label><input id="pr-n" value="${esc(nombre)}" maxlength="80"></div>
        <div class="co-dos"><div class="campo"><label for="pr-p">Porción</label><input id="pr-p" value="1 porción" maxlength="40"></div><div class="campo"><label for="pr-g">Gramos</label><input id="pr-g" type="number" inputmode="numeric" value="100"></div></div>
        <div class="co-dos"><div class="campo"><label for="pr-k">Calorías</label><input id="pr-k" type="number" inputmode="numeric"></div><div class="campo"><label for="pr-pr">Proteína (g)</label><input id="pr-pr" type="number" inputmode="decimal"></div></div>
        <div class="co-dos"><div class="campo"><label for="pr-c">Carbos (opcional)</label><input id="pr-c" type="number" inputmode="decimal"></div><div class="campo"><label for="pr-gr">Grasas (opcional)</label><input id="pr-gr" type="number" inputmode="decimal"></div></div>
        <label class="fila chico" style="gap: 8px;"><input type="checkbox" id="pr-up">Es ultraprocesado</label>
        <p class="ayuda">Los valores son de la porción. Queda guardado y aparece en frecuentes.</p>
        <div class="botonera"><button type="button" class="boton" data-volver>‹ Volver</button><button type="button" class="boton primario" data-seguir>Seguir</button></div></div>`
      const q = (s) => cuerpoHoja.querySelector(s)
      const revisar = () => { q('[data-seguir]').disabled = !q('#pr-n').value.trim() || !q('#pr-k').value }
      q('#pr-n').oninput = revisar; q('#pr-k').oninput = revisar; revisar()
      q('[data-volver]').onclick = buscar
      q('[data-seguir]').onclick = seguro(async () => {
        const n = (s) => (q(s).value === '' ? undefined : Number(q(s).value))
        const { alimento } = await api('/api/comida/alimentos', {
          nombre: q('#pr-n').value.trim(), porcion: q('#pr-p').value.trim() || '1 porción', gramos: n('#pr-g') || 100, kcal: n('#pr-k'), proteina: n('#pr-pr') || 0,
          ...(n('#pr-c') !== undefined ? { carbos: n('#pr-c') } : {}), ...(n('#pr-gr') !== undefined ? { grasas: n('#pr-gr') } : {}),
          up: q('#pr-up').checked, ...(codigo ? { codigo } : {}),
        })
        cantidad(alimento)
      })
      setTimeout(() => q('#pr-n').focus(), 60)
    }

    function escanear() {
      titulo(PUEDE_ESCANEAR ? 'Escanear' : 'Código de barras')
      cuerpoHoja.innerHTML = `<div class="co-cargar">
        ${PUEDE_ESCANEAR ? '<div class="co-camara"><video muted playsinline></video><span class="co-mira" aria-hidden="true"></span><span class="co-camara-estado" hidden>Buscando en Open Food Facts…</span></div>' : ''}
        <p class="chico texto-2" id="co-msg">${PUEDE_ESCANEAR ? 'Apuntá al código de barras del paquete.' : 'Escribí el número que está abajo de las barras.'}</p>
        <div class="co-dos"><input type="text" inputmode="numeric" placeholder="O escribí el número" aria-label="Número del código" id="co-cod"><button type="button" class="boton" data-buscar disabled>Buscar</button></div>
        <button type="button" class="boton ancho" data-volver>‹ Volver</button></div>`
      const q = (s) => cuerpoHoja.querySelector(s)
      const consultar = seguro(async (codigo) => {
        codigo = String(codigo).replace(/\D/g, '')
        const est = q('.co-camara-estado'); if (est) est.hidden = false
        const x = await api(`/api/comida/codigo/${codigo}`)
        if (x.alimento) return cantidad(x.alimento)
        if (x.motivo === 'sin_internet') avisar('Sin internet: cargalo a mano.')
        propio({ codigo })
      })
      q('#co-cod').oninput = () => { q('[data-buscar]').disabled = q('#co-cod').value.replace(/\D/g, '').length < 8 }
      q('[data-buscar]').onclick = () => consultar(q('#co-cod').value)
      q('[data-volver]').onclick = buscar
      if (!PUEDE_ESCANEAR) return setTimeout(() => q('#co-cod').focus(), 60)
      let vivo = true, flujo = null
      parar = () => { vivo = false; if (flujo) flujo.getTracks().forEach((t) => t.stop()) }
      ;(async () => {
        try {
          flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          const video = q('video')
          if (!vivo || !video) return parar()
          video.srcObject = flujo
          await video.play()
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
          while (vivo) {
            const res = await det.detect(video).catch(() => [])
            if (res[0] && res[0].rawValue) { parar(); try { navigator.vibrate && navigator.vibrate(40) } catch (e) { /* nada */ } return consultar(res[0].rawValue) }
            await new Promise((ok) => setTimeout(ok, 250))
          }
        } catch (e) {
          if (q('#co-msg')) q('#co-msg').textContent = 'No se pudo abrir la cámara. Escribí el número del código.'
        }
      })()
    }

    buscar()
  }

  // ---------- Días ----------
  $('#dia-antes').onclick = () => { fecha = sumarDias(r.fecha, -1); cargar() }
  $('#dia-despues').onclick = () => { const f = sumarDias(r.fecha, 1); fecha = f >= r.hoy ? null : f; cargar() }

  seguro(async () => {
    await cargar()
    // Desde «+ Comí» de Hoy: abre la hoja directo.
    if (new URLSearchParams(location.search).get('cargar') && r && r.objetivo) cargarComida()
  })()
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.fondo-modal')) cargar() })
})()
