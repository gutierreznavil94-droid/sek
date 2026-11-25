// El entreno, igual que la v0.88.27 (Entreno.tsx): pantalla completa con el celu en la mano.
// Sin entreno en curso: «Hoy toca», la lista de bloques y Empezar. En curso: un bloque a la vez (ejercicio
// con peso y «Serie hecha», temporizador, rondas, cronómetro de colgarse o casilla), el descanso con sombra /
// descansá / acomodá y «¿cuántas hiciste?», los bloques de hoy y el resumen al terminar.
// Todo vive en el servidor (cerrar la app no lo pierde); los relojes corren acá con la hora del servidor.
(function () {
  'use strict'
  const { api, $, seguro } = SEK
  const { esc, avisar, hoja, confirmar } = SEK.v88
  SEK.v88.montar({ completa: 'entreno-app' })
  const poner_caja = (html) => { $('#caja').outerHTML = html }
  const kg = (p) => (!p ? 'peso corporal' : `${String(p).replace('.', ',')} kg`)
  const pesoTxt = (v) => (v === 0 ? 'corporal' : `${String(v).replace('.', ',')} kg`)
  const reloj = (seg) => { const s = Math.max(0, Math.ceil(seg)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
  const reps = (x) => `${x.reps}${x.repsExtra ? `+${x.repsExtra}` : ''}${x.ayuda ? ` +${x.ayuda} ayuda` : ''}`
  const tot = (x) => x.reps + (x.repsExtra || 0)
  const vibrar = (p) => { try { if ('vibrate' in navigator) navigator.vibrate(p) } catch (e) { /* sin vibración */ } }
  let vista = null, desfase = 0, clave = '', avisos = new Set()
  const ahora = () => Date.now() + desfase
  const C = () => vista.constantes

  // ---------- Pantalla despierta mientras hay un entreno ----------
  let bloqueo = null
  const despierta = () => { try { if (navigator.wakeLock && !bloqueo) navigator.wakeLock.request('screen').then((b) => { bloqueo = b; b.addEventListener('release', () => { bloqueo = null }) }).catch(() => {}) } catch (e) { /* sin wake lock */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && vista) despierta() })

  async function accion(nombre, datos) {
    const r = await api(`/api/entreno/sesiones/${vista.sesion.id}/${nombre}`, datos || {})
    poner(r.vista)
    return r.resultado
  }
  function poner(v) { vista = v; desfase = v.ahora - Date.now(); clave = ''; pintar() }

  // ---------- Cálculos (los mismos que calculo.js del módulo) ----------
  function faseActual(d, t) {
    let pasado = (t - d.inicio) / 1000
    const total = d.fases.reduce((s, f) => s + f.segundos, 0)
    const totalRestante = Math.max(0, Math.ceil(total - pasado))
    for (let i = 0; i < d.fases.length; i++) {
      const f = d.fases[i]
      if (pasado < f.segundos) return { indice: i, fase: f, restante: Math.ceil(f.segundos - pasado), totalRestante }
      pasado -= f.segundos
    }
    return null
  }
  function duracion(s, t) {
    const desde = s.primerMovimiento
    if (!desde) return 0
    const marcas = [desde, ...s.series.map((x) => x.instante), ...(s.tiempos || []).map((x) => x.instante), (s.reloj && s.reloj.inicio) || 0, (s.descanso && s.descanso.inicio) || 0, t].filter((x) => x >= desde && x <= t).sort((a, b) => a - b)
    let total = 0
    for (let i = 1; i < marcas.length; i++) total += Math.min(C().PAUSA_MAXIMA_S, (marcas[i] - marcas[i - 1]) / 1000)
    return total
  }
  function rondaActual(tramos, inicio, t) {
    let p = (t - inicio) / 1000
    for (let i = 0; i < tramos.length; i++) { if (p < tramos[i].segundos) return { indice: i, restante: Math.ceil(tramos[i].segundos - p) }; p -= tramos[i].segundos }
    return null
  }
  const tramosDe = (b) => (b.tipo === 'rondas' ? b.tramos : Array.from({ length: b.veces || 1 }, (_, i) => ({ segundos: b.segundos, texto: '', ronda: i, descanso: false })))
  const bloque = () => vista.bloques.find((b) => b.id === vista.actual)
  /** Lo que sigue después de un bloque: el próximo sin terminar. */
  function siguiente(desdeId) {
    const i = vista.bloques.findIndex((b) => b.id === desdeId)
    return vista.bloques.slice(i + 1).find((b) => !b.terminado) || vista.bloques.find((b) => !b.terminado && b.id !== desdeId)
  }
  function resumenBloque(b) {
    if (b.tipo === 'ejercicio') return `${b.series} × ${b.reps}${b.repsExtra ? (b.admiteAyuda ? ` +${b.repsExtra} ayuda` : `+${b.repsExtra}`) : ''} · ${b.peso ? `${String(b.peso).replace('.', ',')} kg` : 'corporal'}`
    if (b.tipo === 'rondas') return `${b.rondas.length} × ${reloj(b.rondas[0] ? b.rondas[0].segundos : 0)}${b.rondas.length > 1 && (b.descansoEntre ?? 60) > 0 ? ` · ${reloj(b.descansoEntre ?? 60)} entre` : ''}`
    if (b.tipo === 'casilla') return '✓'
    return `${b.veces && b.veces > 1 ? `${b.veces} × ` : ''}${reloj(b.segundos)}${b.peso ? ` · ${b.peso} kg` : ''}`
  }
  function textoSigue(b) {
    if (b.tipo === 'ejercicio') return `${kg(b.pesoHoy)} · ${b.series} ${b.series === 1 ? 'serie' : 'series'} × ${b.objetivo ?? b.reps}${b.repsExtra ? (b.admiteAyuda ? ` +${b.repsExtra} ayuda` : `+${b.repsExtra}`) : ''} reps`
    return resumenBloque(b)
  }
  function tarjetaSigue(b, grande, titulo) {
    if (!b) return `<div class="entreno-sigue"><span class="seccion-titulo">${esc(titulo || 'Sigue')}</span><b>Terminar el entreno</b></div>`
    return `<div class="entreno-sigue ${grande ? 'grande' : ''}" aria-label="Lo que sigue"><span class="seccion-titulo">${esc(titulo || (grande ? 'Acomodá para' : 'Sigue'))}</span>
      <b class="nombre">${esc(b.nombre)}</b><span class="mono datos">${esc(textoSigue(b))}</span>${b.nota ? `<span class="entreno-nota">«${esc(b.nota)}»</span>` : ''}</div>`
  }
  /** Verde si superó la misma serie de la vez pasada (mismo peso), gris si la igualó. Más peso también es verde. */
  function marcaSerie(x, ref) {
    if (!ref) return ''
    if (x.peso > ref.peso) return 'mejor'
    if (x.peso < ref.peso) return ''
    const a = x.reps + (x.repsExtra || 0)
    return a > tot(ref) ? 'mejor' : a === tot(ref) ? 'igual' : ''
  }
  function textoSeries(series) {
    if (!series.length) return ''
    const p = series[0].peso
    return series.every((x) => x.peso === p) ? `${series.map((x) => `S${x.n} ${reps(x)}`).join(' · ')} · ${kg(p)}` : series.map((x) => `S${x.n} ${reps(x)} × ${kg(x.peso)}`).join(' · ')
  }
  /** − valor + (como Stepper de la vieja). `escribible`: tocar el número deja escribirlo. */
  const stepper = (k, etq, valor, formato, { marca = '', compacto = false } = {}) => `<div class="stepper ${marca} ${compacto ? 'compacto' : ''}" data-stepper="${k}">
      <span class="etiqueta">${esc(etq)}</span>
      <div class="fila"><button type="button" class="boton grande" data-menos aria-label="Menos ${esc(etq)}">−</button><button type="button" class="valor mono" data-valor>${esc(formato(valor))}</button><button type="button" class="boton grande" data-mas aria-label="Más ${esc(etq)}">+</button></div></div>`
  function conectarStepper(raiz, k, { valor, paso, min = 0, escribible = false, alCambiar }) {
    const el = raiz.querySelector(`[data-stepper="${k}"]`)
    if (!el) return
    const redondear = (v) => Math.round(v * 100) / 100
    el.querySelector('[data-menos]').onclick = seguro(() => alCambiar(Math.max(min, redondear(valor - paso))))
    el.querySelector('[data-mas]').onclick = seguro(() => alCambiar(redondear(valor + paso)))
    if (escribible) {
      el.querySelector('[data-valor]').onclick = (e) => {
        const inp = document.createElement('input')
        inp.className = 'valor mono'; inp.type = 'number'; inp.inputMode = 'decimal'; inp.step = '0.5'; inp.value = valor
        e.currentTarget.replaceWith(inp); inp.focus()
        const listo = seguro(async () => { const v = Number(String(inp.value).replace(',', '.')); if (Number.isFinite(v) && v >= min && v !== valor) await alCambiar(redondear(v)); else pintar() })
        inp.onblur = listo
        inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur() }
      }
    }
  }

  // ---------- Antes de empezar ----------
  async function empezarVista() {
    const nada = () => null
    const [e, ac, pil] = await Promise.all([api('/api/entreno'), api('/api/dia/acciones').catch(nada), api('/api/dia/pilares').catch(nada)])
    const rutinas = e.rutinas.filter((r) => r.activa)
    const delDia = e.hoy.rutina
    const ent = ac && ac.acciones.find((a) => a.tipo === 'entrenamiento')
    const limite = ent && ent.horaLimiteInicio
    const hayPilar = !!(pil && pil.pilares.some((p) => p.accion.tipo === 'entrenamiento' && p.compromiso && p.estado === 'pendiente'))
    const hhmm = new Date().toTimeString().slice(0, 5)
    const tarde = hayPilar && limite && hhmm > limite ? limite : null
    let elegida = (delDia && delDia.id) || (rutinas[0] && rutinas[0].id)
    function dibujar() {
      const r = rutinas.find((x) => x.id === elegida)
      const n = r ? r.bloques.filter((b) => b.tipo === 'ejercicio').length : 0
      poner_caja(`<div id="caja" class="col" style="gap: 14px;">
        <div class="fila entre"><a href="/hoy" class="texto-2">‹ Hoy</a><a href="/entreno" class="texto-2 chico">Editar rutinas</a></div>
        <div class="col" style="gap: 4px;"><span class="seccion-titulo">${delDia ? 'Hoy toca' : 'Hoy es día libre'}</span><h1 class="entreno-titulo">${esc(r ? r.nombre : 'Sin rutinas')}</h1>
          ${r ? `<span class="texto-2">~${r.minutos} min · ${n} ejercicios · ${r.bloques.length} bloques</span>` : ''}</div>
        <div class="chips">${rutinas.map((x) => `<button type="button" class="${x.id === elegida ? 'activo' : ''}" data-r="${esc(x.id)}">${esc(x.nombre.split(' · ')[0])}</button>`).join('')}</div>
        ${!rutinas.length ? '<p class="ayuda">Todavía no tenés rutinas. Armá la tuya o elegí un plan en Mis rutinas.</p><a href="/entreno" class="boton primario grande ancho">Ir a Mis rutinas</a>' : ''}
        ${r ? `<ol class="entreno-lista">${r.bloques.map((b) => `<li><span class="crece">${esc(b.nombre)}${b.tipo === 'ejercicio' && b.grupo ? `<span class="texto-3"> · ${esc(b.grupo)}</span>` : ''}</span><span class="texto-3 mono chico">${esc(resumenBloque(b))}</span></li>`).join('')}</ol>` : ''}
        ${r && tarde ? `<p class="entreno-tarde" role="status"><b>Pasaron las ${esc(tarde)}:</b> el entreno cuenta, pero el pilar queda tarde (sin su XP). Las mejoras y récords se guardan igual.</p>` : ''}
        ${r && !tarde && delDia && limite ? `<p class="ayuda centro">Empezalo hasta las ${esc(limite)} para que cuente el pilar; la hora en que terminás no importa.</p>` : ''}
        ${r ? `<button type="button" class="boton primario grande ancho entreno-empezar" id="empezar">${tarde ? 'Empezar igual' : 'Empezar entreno'}</button>` : ''}
      </div>`)
      document.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { elegida = b.dataset.r; dibujar() } })
      const em = $('#empezar')
      if (em) em.onclick = seguro(async () => { poner(await api('/api/entreno/empezar', { rutinaId: elegida })); despierta(); arrancarTic() })
    }
    dibujar()
  }

  // ---------- En curso ----------
  function pintar() {
    const s = vista.sesion
    const t = ahora()
    const b = bloque()
    const d = s.descanso ? faseActual(s.descanso, t) : null
    const hechos = vista.bloques.filter((x) => x.terminado).length
    let cuerpo
    if (s.descanso && d) cuerpo = descanso(d)
    else if (!b) cuerpo = `<section class="entreno-fin col"><span class="entreno-k" aria-hidden="true">鍛</span><h1 class="entreno-titulo">Todo hecho</h1>
        <p class="texto-2">${s.series.length} series anotadas. Terminá para guardar y marcar el pilar.</p>
        <button type="button" class="boton primario grande ancho" data-terminar>Terminar entreno</button>
        ${s.series.length ? '<button type="button" class="boton suave" data-deshacer>Deshacer la última serie</button>' : ''}</section>`
    else if (b.tipo === 'ejercicio') cuerpo = ejercicio(b)
    else if (b.tipo === 'casilla') cuerpo = `<section class="col entreno-bloque"><span class="seccion-titulo">Para cerrar</span><h1 class="entreno-titulo">${esc(b.nombre)}</h1>${b.nota ? `<p class="entreno-nota">${esc(b.nota)}</p>` : ''}
        <button type="button" class="entreno-casilla" data-marcar><span class="caja" aria-hidden="true">✓</span> Listo, estiré</button></section>`
    else if (b.tipo === 'temporizador' && b.modo === 'cronometro') cuerpo = cronometro(b, t)
    else cuerpo = temporizador(b, t)
    poner_caja(`<div id="caja" class="col" style="gap: 12px;">
      <div class="fila entre entreno-cab"><a href="/hoy" class="texto-2">‹ Hoy</a><span class="mono texto-2" aria-label="Duración del entreno" data-t="duracion">${reloj(duracion(s, t))}</span>
        <button type="button" class="boton chico suave" data-bloques>Bloques ${hechos}/${s.orden.length}</button></div>
      <div class="entreno-camino"><div class="entreno-puntos" aria-hidden="true">${vista.bloques.map((x, i) => `<span class="${x.terminado ? (x.saltado ? 'saltado' : 'hecho') : ''} ${x.id === vista.actual ? 'actual' : ''}"></span>`).join('')}</div></div>
      ${lineaAhora(b, d)}
      ${cuerpo}
      ${b && !(s.descanso && d) ? `<div class="fila entre entreno-pie"><button type="button" class="enlace texto-3" data-saltar>Saltar ${b.tipo === 'ejercicio' ? 'ejercicio' : 'bloque'}</button>${s.series.length && b.tipo === 'ejercicio' ? '<button type="button" class="enlace texto-3" data-deshacer>Deshacer serie</button>' : ''}</div>` : ''}
      <div class="entreno-reiniciar"><button type="button" class="boton chico contorno-papel" data-reiniciar>↺ Reiniciar</button></div>
    </div>`)
    clave = claveDe(t)
    conectar()
  }

  function lineaAhora(b, d) {
    const s = vista.sesion
    let ah = '', despues = ''
    if (s.descanso && d) {
      const u = ultima()
      const faltan = u ? u.b.series - u.b.hechas.length : 0
      ah = d.fase.tipo === 'preparar' || d.fase.tipo === 'sombra' ? 'Sombra' : d.fase.tipo === 'acomodar' ? 'Acomodá' : 'Descanso'
      const sig = sigueDescanso()
      despues = u && faltan > 0 ? `${u.b.nombre} · serie ${u.x.n + 1}` : sig ? sig.nombre : 'Terminar'
    } else if (b) {
      ah = b.tipo === 'ejercicio' ? `${b.nombre} · serie ${Math.min(b.hechas.length + 1, b.series)}/${b.series}` : b.nombre
      const sig = siguiente(b.id)
      despues = sig ? sig.nombre : 'Terminar'
    } else ah = 'Todo hecho'
    return `<div class="entreno-linea" aria-live="polite"><span><span class="texto-3">Ahora:</span> <b>${esc(ah)}</b></span>${despues ? `<span><span class="texto-3">Después:</span> <b>${esc(despues)}</b></span>` : ''}</div>`
  }
  /** La última serie anotada y su ejercicio (para «¿cuántas hiciste?» en el descanso). */
  function ultima() {
    const s = vista.sesion
    if (s.descanso && s.descanso.origen) return null
    const x = s.series[s.series.length - 1]
    const b = x && vista.bloques.find((y) => y.id === x.bloqueId)
    return b && b.tipo === 'ejercicio' ? { x, b } : null
  }
  function sigueDescanso() {
    const s = vista.sesion
    if (s.descanso && s.descanso.origen) return bloque()
    const u = ultima()
    return u ? siguiente(u.b.id) : bloque()
  }

  function descanso(d) {
    const s = vista.sesion, f = d.fase
    const total = s.descanso.fases.reduce((a, x) => a + x.segundos, 0)
    const despuesDeBarra = !!s.descanso.origen
    if (f.tipo === 'preparar') {
      return `<section class="col entreno-descanso preparar" aria-live="assertive"><p class="entreno-fase centro">Sombra en</p>
        <div class="entreno-321 mono" data-t="restante">${d.restante}</div>
        <p class="ayuda centro">Estos 3 s ya cuentan dentro del descanso de ${reloj(total)}.</p>
        <button type="button" class="enlace texto-3 chico centro" data-deshacer>Deshacer la serie</button></section>`
    }
    const u = ultima()
    const faltan = u ? u.b.series - u.b.hechas.length : 0
    const sig = sigueDescanso()
    const ambar = d.totalRestante <= C().AVISO_FIN_DESCANSO_S
    const pct = Math.max(0, Math.min(100, (d.restante / f.segundos) * 100))
    const ref = u ? u.b.ultimaVez.find((a) => a.n === u.x.n) : null
    return `<section class="col entreno-descanso ${f.tipo} ${ambar ? 'ambar' : ''}" aria-live="polite" data-descanso>
      <div class="fila entre entreno-fase-fila"><h1 class="entreno-fase">${f.tipo === 'acomodar' ? 'Acomodá' : despuesDeBarra ? 'Descanso' : esc(f.texto)}</h1><span class="entreno-reloj mono" data-t="restante">${reloj(d.restante)}</span></div>
      <div class="entreno-barra"><div style="width: ${pct}%;" data-t="barra"></div></div>
      <p class="entreno-alistate" data-t="alistate" ${ambar ? '' : 'hidden'}>Alistate: ${esc(faltan > 0 && u ? `serie ${u.x.n + 1} de ${u.b.nombre}` : sig ? sig.nombre : 'terminar')} en <span data-t="total">${reloj(d.totalRestante)}</span></p>
      ${despuesDeBarra ? `<p class="ayuda">Después de colgarse: descanso de ${reloj(f.segundos)}, sin sombra.</p>` : ''}
      ${s.descanso.fases.length > 1 ? `<p class="ayuda">${s.descanso.fases.filter((x) => x.tipo !== 'preparar').map((x) => `${x.tipo === 'sombra' ? 'Sombra' : 'Descansá'} ${reloj(x.segundos)}`).join(' → ')} · total ${reloj(total)}</p>` : ''}
      ${u && faltan > 0 ? `<div class="entreno-ahora"><span class="seccion-titulo">Ahora</span><b class="te-queda">Te queda ${faltan} ${faltan === 1 ? 'serie' : 'series'} de ${esc(u.b.nombre)}</b>
          <span class="mono datos">${kg(u.b.pesoHoy)} · objetivo ${u.b.objetivo ?? u.b.reps}${u.b.repsExtra ? (u.b.admiteAyuda ? ` +${u.b.repsExtra} ayuda` : `+${u.b.repsExtra}`) : ''} reps</span>
          ${tarjetaSigue(siguiente(u.b.id), false, 'Para alistar')}</div>`
        : tarjetaSigue(sig, true, despuesDeBarra ? 'Sigue' : undefined)}
      ${u ? `<div class="entreno-cuantas col" style="gap: 10px;">
          ${stepper('cuantas', `${u.b.nombre} · serie ${u.x.n}${u.x.segundos !== undefined && u.x.segundos !== null ? ` · ${u.x.segundos} s` : ''} · ¿cuántas hiciste?`, u.x.reps, String, { marca: marcaSerie(u.x, ref) })}
          ${u.b.admiteAyuda ? stepper('ayuda', 'Con ayuda (no cuentan para récord)', u.x.ayuda || 0, (v) => `+${v}`) : u.b.repsExtra !== undefined ? stepper('extra', 'Extra', u.x.repsExtra || 0, (v) => `+${v}`) : ''}
          ${ref ? `<p class="ayuda">La vez pasada: ${reps(ref)} × ${kg(ref.peso)} · se guarda solo</p>` : ''}</div>` : ''}
      <div class="botonera"><button type="button" class="boton grande" data-alargar>+30 s</button><button type="button" class="boton grande primario" data-fin-descanso>Saltar descanso</button></div>
      ${despuesDeBarra ? '' : '<button type="button" class="enlace texto-3 chico centro" data-deshacer>Deshacer la serie</button>'}
    </section>`
  }

  function ejercicio(b) {
    const n = b.hechas.length + 1
    const ant = b.ultimaVez
    const sug = b.sugerencia
    const peso = b.pesoHoy
    const primera = b.hechas.length === 0
    const pesoAntes = ant.length ? ant[0].peso : b.peso
    const marcaPeso = ant.length ? (peso > pesoAntes ? 'mejor' : peso === pesoAntes ? 'igual' : '') : ''
    return `<section class="col entreno-bloque"><span class="seccion-titulo">${esc(b.grupo || 'Ejercicio')}</span><h1 class="entreno-titulo">${esc(b.nombre)}</h1>
      ${b.nota ? `<p class="entreno-nota">«${esc(b.nota)}»</p>` : ''}
      <p class="texto-2 chico">${ant.length ? `La vez pasada: <b>${esc(textoSeries(ant))}</b>` : 'Primera vez con la app: arrancá con lo de tu planilla.'}${b.record ? ` · <span class="entreno-record">Récord: <b>${b.record.reps} × ${kg(b.record.peso)}</b></span>` : ''}</p>
      ${primera && sug && sug.subirPeso ? `<div class="entreno-sugerencia peso"><span>▲ ${esc(sug.texto)}</span><span class="chico">Si subís, poné el peso nuevo con − / + o tocando el número. Lo que hagas hoy con el peso nuevo queda como tus reps actuales.</span></div>` : ''}
      ${stepper('peso', primera ? 'Peso de hoy' : 'Peso', peso, pesoTxt, { marca: marcaPeso, compacto: !primera })}
      <div class="entreno-objetivo"><span class="entreno-serie">Serie ${Math.min(n, b.series)} de ${b.series}</span>
        <span class="mono"><b>${b.objetivo ?? b.reps}</b>${b.repsExtra ? (b.admiteAyuda ? `<b class="entreno-ayuda"> +${b.repsExtra} ayuda</b>` : `<b>+${b.repsExtra}</b>`) : ''} reps</span></div>
      ${n === 1 && sug && !sug.subirPeso ? `<p class="ayuda">${esc(sug.texto)} Una más que las actuales ya es récord.</p>` : ''}
      ${n === 1 && ant.length > 0 && peso !== b.peso ? `<p class="ayuda">Peso nuevo: tramo nuevo. Lo que hagas hoy en la serie 1 queda como tus reps actuales con ${kg(peso)}.</p>` : ''}
      ${n > 1 && ant.find((x) => x.n === n) ? `<p class="ayuda">Objetivo de la serie ${n}: lo que hiciste en la serie ${n} la vez pasada. Si sale un poco menos, no resta.</p>` : ''}
      <button type="button" class="boton primario grande ancho entreno-hecha" data-serie>Serie hecha</button>
      <p class="ayuda centro">Las repeticiones las anotás en el descanso.</p>
      ${b.hechas.length ? `<div class="entreno-hoy chico">${b.hechas.map((x) => `<button type="button" class="marca ${marcaSerie(x, ant.find((a) => a.n === x.n))}" data-corregir="${x.n}">S${x.n}: ${reps(x)} × ${kg(x.peso)}${x.segundos !== undefined && x.segundos !== null ? `<span class="texto-3"> · ${x.segundos} s</span>` : ''} ✎</button>`).join('')}</div>` : ''}
      ${b.admiteAyuda ? '<p class="ayuda">Las reps con ayuda quedan en el historial y suman al volumen, pero no cuentan para el récord ni para subir peso.</p>' : ''}
    </section>`
  }

  function cronometro(b, t) {
    const s = vista.sesion
    const corriendo = s.reloj && s.reloj.bloqueId === b.id ? s.reloj : null
    const hist = b.historial
    const peso = (s.pesos && s.pesos[b.id]) ?? (hist && hist.ultimo ? hist.ultimo.peso : b.peso || 0)
    const objetivo = b.segundos
    const texto = (x) => `${reloj(x.segundos)} · ${kg(x.peso)}`
    let h = `<section class="col entreno-bloque entreno-timer cronometro"><span class="seccion-titulo">${esc(b.nota || 'Cronómetro')}</span><h1 class="entreno-titulo">${esc(b.nombre)}</h1>
      <p class="texto-2 chico">${hist && hist.ultimo ? `La vez pasada: <b>${texto(hist.ultimo)}</b>${hist.record && (hist.record.segundos !== hist.ultimo.segundos || hist.record.peso !== hist.ultimo.peso) ? ` · récord <b>${texto(hist.record)}</b>` : ''}` : `Todavía sin tiempos. Objetivo: ${objetivo} s.`}</p>`
    if (!corriendo) {
      h += `${stepper('peso-crono', 'Peso', peso, pesoTxt, { marca: hist && hist.ultimo ? (peso > hist.ultimo.peso ? 'mejor' : peso === hist.ultimo.peso ? 'igual' : '') : '' })}
        ${stepper('objetivo', 'Objetivo', objetivo, (v) => `${v} s`)}
        <div class="entreno-reloj mono">0:00</div>
        <button type="button" class="boton primario grande ancho entreno-hecha" data-reloj>Empezar</button>
        <p class="ayuda centro">Si superás ${objetivo} s, la próxima vez el objetivo sube a ${objetivo + 1} s (solo 1 s, aunque lo pases por mucho). Tenés ${C().PREPARACION_S} s para colgarte; al tocar «Listo» se descuentan ${C().DESCUENTO_S} s.</p>`
    } else {
      const pasado = (t - corriendo.inicio) / 1000
      if (pasado < C().PREPARACION_S) {
        h += `<p class="entreno-fase centro">Acomodate y colgate</p><div class="entreno-reloj mono entreno-prep" data-t="prep">${Math.ceil(C().PREPARACION_S - pasado)}</div>
          <div class="botonera"><button type="button" class="boton grande" data-parar>Cancelar</button><button type="button" class="boton grande primario" data-saltar-prep>Ya estoy colgado</button></div>`
      } else {
        const seg = pasado - C().PREPARACION_S
        const enPantalla = objetivo + C().DESCUENTO_S
        const verde = objetivo && seg > enPantalla
        h += `<p class="entreno-fase centro ${verde ? 'ok' : ''}" data-t="crono-fase">${verde ? `¡Superaste ${reloj(objetivo)}! Seguí` : `Colgado · con ${kg(peso)}`}</p>
          <div class="entreno-reloj mono ${verde ? 'verde' : ''}" data-t="crono">${reloj(Math.floor(seg))}</div>
          ${objetivo > 0 ? `<div class="entreno-barra cronometro"><div style="width: ${Math.min(100, (seg / enPantalla) * 100)}%;" data-t="crono-barra"></div></div><p class="ayuda centro">Objetivo: ${objetivo} s · se pone verde en ${reloj(enPantalla)} (por los ${C().DESCUENTO_S} s que se descuentan)</p>` : ''}
          <button type="button" class="boton primario grande ancho entreno-hecha" data-listo-crono>Listo</button><button type="button" class="enlace texto-3" data-parar>Reiniciar</button>`
      }
    }
    return h + '</section>'
  }

  function temporizador(b, t) {
    const s = vista.sesion
    const corriendo = s.reloj && s.reloj.bloqueId === b.id ? s.reloj : null
    const tramos = tramosDe(b)
    const nRondas = b.tipo === 'rondas' ? b.rondas.length : tramos.length
    const preparando = !!corriendo && t < corriendo.inicio
    const ronda = corriendo && !preparando ? rondaActual(tramos, corriendo.inicio, t) : null
    const tramo = ronda ? tramos[ronda.indice] : tramos[0]
    const ambar = !!(ronda && tramo.descanso && ronda.restante <= C().AVISO_FIN_DESCANSO_S)
    const total = tramos.reduce((x, y) => x + y.segundos, 0)
    const pct = ronda ? (ronda.restante / tramo.segundos) * 100 : 100
    const proxima = ronda && tramo.descanso && b.tipo === 'rondas' ? b.rondas[tramo.ronda] : null
    let h = `<section class="col entreno-bloque entreno-timer ${b.tipo} ${tramo.descanso && ronda ? 'en-descanso' : ''} ${ambar ? 'ambar' : ''}">
      <span class="seccion-titulo">${b.tipo === 'calentamiento' ? 'Para arrancar' : b.tipo === 'rondas' ? 'Rondas' : esc(b.nota || 'Temporizador')}</span><h1 class="entreno-titulo">${esc(b.nombre)}</h1>`
    const notas = [b.tipo === 'calentamiento' ? b.nota : null, b.peso ? `con ${b.peso} kg` : null, b.veces ? `${b.veces} vez` : null].filter(Boolean)
    if (b.tipo !== 'rondas' && notas.length) h += `<p class="entreno-nota">${esc(notas.join(' · '))}</p>`
    if (b.tipo === 'rondas') {
      h += `<div class="col" style="gap: 6px;">${b.rondas.map((x, i) => `<div>${i > 0 && (b.descansoEntre ?? 60) > 0 ? `<div class="entreno-ronda descanso ${ronda && tramo.descanso && tramo.ronda === i ? 'actual' : ''}"><span class="mono">${reloj(b.descansoEntre ?? 60)}</span><span>Descanso</span></div>` : ''}
        <div class="entreno-ronda ${ronda && !tramo.descanso && tramo.ronda === i ? 'actual' : ronda && i < tramo.ronda ? 'paso' : ''}"><span class="mono">R${i + 1} · ${reloj(x.segundos)}</span><span>${esc(x.texto)}</span></div></div>`).join('')}</div>`
    }
    if (preparando) {
      h += `<p class="entreno-fase centro">Preparate</p><div class="entreno-reloj mono entreno-prep" data-t="prep">${Math.ceil((corriendo.inicio - t) / 1000)}</div>
        <button type="button" class="boton grande ancho" data-saltar-prep>Arrancar ya</button>`
    } else {
      h += `<div class="entreno-reloj mono" data-t="ronda">${reloj(ronda ? ronda.restante : tramo.segundos)}</div><div class="entreno-barra"><div style="width: ${pct}%;" data-t="ronda-barra"></div></div>`
      if (b.tipo === 'rondas' && ronda) h += tramo.descanso ? `<p class="entreno-fase centro">Descanso · sigue R${tramo.ronda + 1}: ${esc(proxima ? proxima.texto : '')}</p>` : `<p class="entreno-fase centro">Ronda ${tramo.ronda + 1} de ${nRondas}: ${esc(tramo.texto)}</p>`
      h += !corriendo
        ? `<button type="button" class="boton primario grande ancho" data-reloj>Empezar · ${reloj(total)}</button><p class="ayuda centro">Arranca con 5 s para prepararte (un toque los saltea).</p>`
        : '<div class="botonera"><button type="button" class="boton grande" data-parar>Reiniciar</button><button type="button" class="boton grande ok" data-marcar>Listo</button></div>'
    }
    return h + '</section>'
  }

  // ---------- Botones ----------
  function conectar() {
    const s = vista.sesion, b = bloque()
    const en = (sel, fn) => document.querySelectorAll(sel).forEach((el) => { el.onclick = seguro(fn) })
    en('[data-terminar]', terminar)
    en('[data-deshacer]', () => accion('deshacer'))
    en('[data-saltar]', () => accion('saltar', { bloqueId: b.id }))
    en('[data-marcar]', async () => { await accion('marcar', { bloqueId: b.id }); if (b.tipo !== 'casilla') avisar(`${b.nombre}: listo`, { tipo: 'ok' }) })
    en('[data-reloj]', () => accion('reloj', { bloqueId: b.id }))
    en('[data-saltar-prep]', () => accion('saltar-preparacion'))
    en('[data-parar]', () => accion('parar-reloj'))
    en('[data-alargar]', () => accion('alargar', { segundos: 30 }))
    en('[data-fin-descanso]', () => accion('fin-descanso'))
    en('[data-serie]', async () => { await accion('serie', { bloqueId: b.id, reps: b.objetivo ?? b.reps, ...(b.repsExtra ? (b.admiteAyuda ? { ayuda: b.repsExtra } : { repsExtra: b.repsExtra }) : {}), peso: b.pesoHoy }); vibrar(60); SEK.v88.animar({ tipo: 'parry' }) })
    en('[data-listo-crono]', async () => {
      const peso = (s.pesos && s.pesos[b.id]) ?? (b.historial && b.historial.ultimo ? b.historial.ultimo.peso : b.peso || 0)
      const r = await accion('cronometro', { bloqueId: b.id, peso })
      if (r && r.subio) avisar(`Récord. Próxima vez: ${r.objetivo} s`, { tipo: 'ok' })
      else if (r) avisar(`${b.nombre}: ${reloj(r.tiempo.segundos)}${peso ? ` con ${kg(peso)}` : ''} (ya descontados ${C().DESCUENTO_S} s)`, { tipo: 'ok' })
    })
    en('[data-bloques]', bloquesDeHoy)
    en('[data-reiniciar]', () => confirmar('¿Reiniciar la rutina desde cero?', 'Se borra lo de hoy: series, pesos, tiempos y el XP de este entreno. Lo de días anteriores no se toca.', 'Reiniciar', () => accion('reiniciar')))
    document.querySelectorAll('[data-corregir]').forEach((el) => { el.onclick = () => corregir(b, b.hechas.find((x) => x.n === Number(el.dataset.corregir))) })
    // Steppers
    if (b && b.tipo === 'ejercicio') conectarStepper(document, 'peso', { valor: b.pesoHoy, paso: 0.5, escribible: true, alCambiar: (v) => accion('peso', { bloqueId: b.id, peso: v }) })
    if (b && b.tipo === 'temporizador' && b.modo === 'cronometro') {
      const peso = (s.pesos && s.pesos[b.id]) ?? (b.historial && b.historial.ultimo ? b.historial.ultimo.peso : b.peso || 0)
      conectarStepper(document, 'peso-crono', { valor: peso, paso: 0.5, escribible: true, alCambiar: (v) => accion('peso', { bloqueId: b.id, peso: v }) })
      conectarStepper(document, 'objetivo', { valor: b.segundos, paso: 1, min: 1, escribible: true, alCambiar: async (v) => { await accion('objetivo', { bloqueId: b.id, nombre: b.nombre, segundos: v }) } })
    }
    const u = s.descanso && ultima()
    if (u) {
      const guardarCorr = (c) => accion('corregir', { bloqueId: u.b.id, n: u.x.n, ...c })
      conectarStepper(document, 'cuantas', { valor: u.x.reps, paso: 1, alCambiar: (v) => guardarCorr({ reps: v }) })
      conectarStepper(document, 'ayuda', { valor: u.x.ayuda || 0, paso: 1, alCambiar: (v) => guardarCorr({ ayuda: v }) })
      conectarStepper(document, 'extra', { valor: u.x.repsExtra || 0, paso: 1, alCambiar: (v) => guardarCorr({ repsExtra: v }) })
    }
  }

  /** Corregir una serie ya anotada (reps, extra o ayuda y peso); se guarda solo. */
  function corregir(b, x) {
    const h = hoja(`Corregir serie ${x.n}`, '<div class="col" style="gap: 10px;" data-c></div>')
    const c = h.el.querySelector('[data-c]')
    const ref = b.ultimaVez.find((a) => a.n === x.n)
    const dibujar = () => {
      const y = (vista.bloques.find((z) => z.id === b.id) || b).hechas.find((z) => z.n === x.n) || x
      c.innerHTML = `${stepper('r', `¿Cuántas hiciste? · serie ${y.n}`, y.reps, String, { marca: marcaSerie(y, ref) })}
        ${b.admiteAyuda ? stepper('a', 'Con ayuda (no cuentan para récord)', y.ayuda || 0, (v) => `+${v}`) : b.repsExtra !== undefined ? stepper('e', 'Extra', y.repsExtra || 0, (v) => `+${v}`) : ''}
        ${stepper('p', 'Peso', y.peso, pesoTxt, { compacto: true })}
        ${ref ? `<p class="ayuda">La vez pasada: ${reps(ref)} × ${kg(ref.peso)} · se guarda solo</p>` : ''}`
      const g = (cambio) => async () => { await accion('corregir', { bloqueId: b.id, n: y.n, ...cambio }); dibujar() }
      conectarStepper(c, 'r', { valor: y.reps, paso: 1, alCambiar: (v) => g({ reps: v })() })
      conectarStepper(c, 'a', { valor: y.ayuda || 0, paso: 1, alCambiar: (v) => g({ ayuda: v })() })
      conectarStepper(c, 'e', { valor: y.repsExtra || 0, paso: 1, alCambiar: (v) => g({ repsExtra: v })() })
      conectarStepper(c, 'p', { valor: y.peso, paso: 0.5, escribible: true, alCambiar: (v) => g({ peso: v })() })
    }
    dibujar()
  }

  function bloquesDeHoy() {
    const h = hoja('Bloques de hoy', '<div class="col" style="gap: 10px;" data-c></div>')
    const c = h.el.querySelector('[data-c]')
    const dibujar = () => {
      const v = vista
      c.innerHTML = `<p class="ayuda">Tocá uno para ir. Con las flechas cambiás el orden.</p>
        <ol class="entreno-lista editable">${v.bloques.map((b, i) => `<li class="${b.id === v.actual ? 'actual' : ''}">
          <button type="button" class="crece entreno-ir" data-ir="${esc(b.id)}"><span class="${b.terminado ? (b.saltado ? 'texto-3 tachado' : 'texto-3') : ''}">${b.terminado && !b.saltado ? '✓ ' : ''}${esc(b.nombre)}</span>${b.tipo === 'ejercicio' ? `<span class="texto-3 mono chico"> ${b.hechas.length}/${b.series}</span>` : ''}</button>
          <button type="button" class="boton chico suave" aria-label="Subir" data-m="-1" data-id="${esc(b.id)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="boton chico suave" aria-label="Bajar" data-m="1" data-id="${esc(b.id)}" ${i === v.bloques.length - 1 ? 'disabled' : ''}>↓</button></li>`).join('')}</ol>
        <div class="botonera"><button type="button" class="boton" data-ya>Terminar ya</button><button type="button" class="boton peligro" data-descartar>Descartar</button></div>`
      c.querySelectorAll('[data-ir]').forEach((x) => { x.onclick = seguro(async () => { h.cerrar(); await accion('ir', { bloqueId: x.dataset.ir }) }) })
      c.querySelectorAll('[data-m]').forEach((x) => { x.onclick = seguro(async () => { await accion('mover', { bloqueId: x.dataset.id, delta: Number(x.dataset.m) }); dibujar() }) })
      c.querySelector('[data-ya]').onclick = seguro(async () => { h.cerrar(); await terminar() })
      c.querySelector('[data-descartar]').onclick = () => { h.cerrar(); confirmar('¿Descartar el entreno?', 'Se borran las series de hoy y el pilar vuelve a pendiente.', 'Descartar', async () => { await api(`/api/entreno/sesiones/${vista.sesion.id}`, undefined, 'DELETE'); vista = null; empezarVista() }) }
    }
    dibujar()
  }

  // ---------- Al terminar ----------
  async function terminar() {
    const r = await accion('terminar')
    vibrar([100, 60, 100, 60, 300])
    if (r && r.xpExtra) SEK.evento && SEK.evento('logro', { modulo: 'entreno' })
    SEK.evento && SEK.evento('completar', { modulo: 'entreno' })
    resumen(r)
  }
  function resumen(r) {
    parar()
    const x = r.resumen
    const records = x.ejercicios.filter((e) => e.record)
    const tiempos = vista.sesion.tiempos || []
    poner_caja(`<section id="caja" class="col entreno-resumen" style="gap: 14px;">
      <span class="entreno-k" aria-hidden="true">鍛</span><h1 class="entreno-titulo centro">Entreno terminado</h1><p class="texto-2 centro">${esc(vista.rutina.nombre)}</p>
      <div class="entreno-stats"><div><b class="mono">${x.minutos}</b><span>min</span></div><div><b class="mono">${x.series}</b><span>series</span></div>
        <div><b class="mono">${x.volumen.toLocaleString('es-AR')}</b><span>kg de volumen</span></div><div><b class="mono">${records.length}</b><span>récords</span></div></div>
      <div class="tarjeta compacta col">
        <div class="fila entre"><span>Por mejorar <span class="texto-3 chico">(+5 récord · +10 subir peso)</span></span><b class="mono">${x.xpExtra > 0 ? `+${x.xpExtra} XP` : '—'}</b></div>
        ${x.xpSinTope > x.xpExtra ? `<p class="ayuda">Llegaste al tope de ${C().TOPE_XP_EXTRA} XP extra por entreno (sumabas ${x.xpSinTope}).</p>` : ''}
        ${r.motivoSinXp ? `<p class="ayuda">${esc(r.motivoSinXp)}</p>` : ''}
      </div>
      <ul class="entreno-lista resumen">${x.ejercicios.map((e) => `<li class="${e.record || e.subioPeso ? 'mejor' : e.igual ? 'igual' : ''}">
          <div class="fila entre" style="width: 100%;"><span class="crece">${e.record ? '★ ' : e.subioPeso ? '▲ ' : e.igual ? '= ' : ''}${esc(e.nombre)}</span><b class="mono">${e.xp ? `+${e.xp} XP` : ''}</b></div>
          <span class="chico texto-3 mono">S1 ${e.marca.reps} × ${kg(e.marca.peso)}${e.antes ? ` · antes ${e.antes.reps} × ${kg(e.antes.peso)}` : ''}</span>
          <span class="chico xp-detalle">${esc([e.record ? `+5 récord: superaste tus ${e.actuales} actuales` : null, e.subioPeso ? '+10 subiste el peso: tramo nuevo' : null].filter(Boolean).join(' · ') || (e.antes ? (e.marca.peso === e.antes.peso && e.marca.reps >= e.actuales ? `Igual que tus ${e.actuales} actuales` : 'Sin récord esta vez (no resta)') : 'Primera vez: queda como tus reps actuales'))}</span></li>`).join('')}</ul>
      ${tiempos.map((y) => `<div class="fila entre entreno-tiempo"><span>${esc(y.nombre)}</span><b class="mono">${reloj(y.segundos)} · ${kg(y.peso)}</b></div>`).join('')}
      <p class="ayuda centro">★ récord: superaste tus reps actuales · ▲ subiste el peso · gris: igualaste.</p>
      <a class="boton primario grande ancho" href="/hoy">Volver a Hoy</a>
      <button type="button" class="enlace texto-3 centro" id="reabrir">Reabrir para corregir una serie</button></section>`)
    $('#reabrir').onclick = seguro(async () => { await accion('reabrir'); arrancarTic(); avisar('Entreno reabierto: el XP extra vuelve cuando lo termines.') })
  }

  // ---------- Relojes ----------
  function claveDe(t) {
    const s = vista.sesion
    const d = s.descanso ? faseActual(s.descanso, t) : null
    const r = s.reloj
    let k = `${s.paso}:${s.series.length}:${d ? d.indice : 'x'}:${d && d.totalRestante <= C().AVISO_FIN_DESCANSO_S ? 'a' : ''}`
    if (r) {
      const p = (t - r.inicio) / 1000
      const b = vista.bloques.find((x) => x.id === r.bloqueId)
      if (b && b.tipo === 'temporizador' && b.modo === 'cronometro') k += `:c${p < C().PREPARACION_S ? 'p' : p - C().PREPARACION_S > b.segundos + C().DESCUENTO_S ? 'v' : 'c'}`
      else if (b) { const ro = p < 0 ? 'p' : rondaActual(tramosDe(b), r.inicio, t); k += `:r${ro === 'p' ? 'p' : ro ? ro.indice : 'fin'}` }
    }
    return k
  }
  function tic() {
    if (!vista || !document.getElementById('caja') || vista.sesion.estado === 'terminada') return
    const t = ahora()
    const s = vista.sesion
    const k = claveDe(t)
    // Vibraciones como la vieja: preparación, a 10 s y a 3 s del final del descanso, al cambiar de fase.
    const d = s.descanso ? faseActual(s.descanso, t) : null
    if (d) {
      const id = (x) => `${s.descanso.inicio}:${x}`
      if (d.fase.tipo === 'preparar' && !avisos.has(id(`p${d.restante}`))) { avisos.add(id(`p${d.restante}`)); vibrar(d.restante === 1 ? 160 : 70) }
      if (d.totalRestante <= C().AVISO_FIN_DESCANSO_S && d.totalRestante > 3 && !avisos.has(id('10'))) { avisos.add(id('10')); vibrar(120) }
      if (d.totalRestante <= 3 && d.totalRestante > 0 && !avisos.has(id('3'))) { avisos.add(id('3')); vibrar([80, 60, 80]) }
    }
    if (k !== clave) {
      if (clave && clave.split(':')[0] === k.split(':')[0]) vibrar(k.includes(':x') && clave.includes(':x') ? [200, 100, 200] : 200)
      // El temporizador terminó solo: el bloque queda hecho.
      const r = s.reloj
      const b = r && vista.bloques.find((x) => x.id === r.bloqueId)
      if (b && !(b.tipo === 'temporizador' && b.modo === 'cronometro') && k.endsWith(':rfin')) { clave = k; seguro(async () => { await accion('marcar', { bloqueId: b.id }); avisar(`${b.nombre}: listo`, { tipo: 'ok' }) })(); return }
      // El descanso terminó: se vuelve a pedir la vista (el servidor lo cierra solo).
      if (s.descanso && !d) { clave = k; seguro(async () => poner(await api('/api/entreno/sesiones/' + s.id)))(); return }
      pintar()
      return
    }
    const pon = (sel, txt) => { const el = document.querySelector(`[data-t="${sel}"]`); if (el && el.textContent !== txt) el.textContent = txt }
    const ancho = (sel, pct) => { const el = document.querySelector(`[data-t="${sel}"]`); if (el) el.style.width = `${pct}%` }
    pon('duracion', reloj(duracion(s, t)))
    if (d) {
      pon('restante', d.fase.tipo === 'preparar' ? String(d.restante) : reloj(d.restante))
      ancho('barra', Math.max(0, Math.min(100, (d.restante / d.fase.segundos) * 100)))
      pon('total', reloj(d.totalRestante))
    }
    const r = s.reloj
    if (r) {
      const b = vista.bloques.find((x) => x.id === r.bloqueId)
      const p = (t - r.inicio) / 1000
      if (b && b.tipo === 'temporizador' && b.modo === 'cronometro') {
        if (p < C().PREPARACION_S) pon('prep', String(Math.ceil(C().PREPARACION_S - p)))
        else { const seg = p - C().PREPARACION_S; pon('crono', reloj(Math.floor(seg))); ancho('crono-barra', Math.min(100, (seg / (b.segundos + C().DESCUENTO_S)) * 100)) }
      } else if (b) {
        if (p < 0) pon('prep', String(Math.ceil(-p)))
        else { const tr = tramosDe(b); const ro = rondaActual(tr, r.inicio, t); if (ro) { pon('ronda', reloj(ro.restante)); ancho('ronda-barra', (ro.restante / tr[ro.indice].segundos) * 100) } }
      }
    }
  }
  let intervalo = null
  const arrancarTic = () => { if (!intervalo) intervalo = setInterval(tic, 250) }
  const parar = () => { clearInterval(intervalo); intervalo = null }

  seguro(async () => {
    const id = new URLSearchParams(location.search).get('id')
    const v = id ? await api('/api/entreno/sesiones/' + encodeURIComponent(id)) : (await api('/api/entreno/en-curso')).vista
    if (!v) return empezarVista()
    poner(v)
    despierta()
    arrancarTic()
  })()
})()
