// Pantalla Hoy: el tablero del día. Pide todo a /api/dia/hoy (las rutas de su módulo); cada módulo presta su tarjeta por su ventanilla.
(function () {
  'use strict'
  const { api, $, seguro, barra, mensaje, minutos } = SEK
  const { esc, fechaLarga, hoja } = DIA
  const evento = (nombre, el) => SEK.evento(nombre, { elemento: el })
  let d = null

  const ICONO_ESTADO = { cumplido: '✓', tarde: '!', omitido: '✕', descanso: '–', pendiente: '', iniciado: '…' }

  function cabeza() {
    const partes = [fechaLarga(d.hoy)]
    const c = d.ciclo
    if (c) partes.push(c.noEmpezado ? 'Ciclo sin empezar' : c.diaCero ? 'Día 0, calentamiento' : c.terminado ? 'Ciclo terminado' : `Día ${c.dia} de ${c.ciclo.duracionDias}${c.faseNumero ? ` · Fase ${c.faseNumero}` : ''}`)
    if (d.nivel) partes.push(`Nivel ${d.nivel.nivel}`)
    $('#dia-ciclo').textContent = partes.join(' · ')
    // Tensión y No cumplí: los pone desafios (si está). «No cumplí» va a su pantalla (pide «¿Seguro?», guarda la caída y el duelo).
    const des = d.tarjetas.desafios
    const b = []
    if (des && des.tension && des.tension.activa !== false && des.tension.ruta) b.push(`<a class="boton boton-contorno" href="${esc(des.tension.ruta)}"><span class="kanji" aria-hidden="true">${esc(des.tension.kanji || '進')}</span>Tensión</a>`)
    if (des && des.noCumpli && des.noCumpli.ruta) b.push(`<a class="boton boton-contorno rojo" href="${esc(des.noCumpli.ruta)}">No cumplí</a>`)
    $('#botones-arriba').innerHTML = b.join('')
  }

  function lineas() {
    const l = []
    if (d.ciclo && d.ciclo.terminado) l.push(`<a class="linea acento" href="/ciclo">Terminó tu ciclo. Revisá los resultados y empezá el siguiente ›</a>`)
    if (d.ciclo && d.ciclo.noEmpezado) l.push(`<div class="linea">Tu Día 1 es el ${esc(DIA.fechaCorta(d.ciclo.ciclo.inicio))}. Hasta entonces no cuenta nada.</div>`)
    if (d.excepcion) l.push(`<div class="linea ambar">Hoy no cuenta: ${esc(d.excepcion.motivo)}</div>`)
    if (d.feriado) l.push(`<div class="linea ambar">Feriado: ${esc(d.feriado.nombre)} · límite de juego de finde</div>`)
    for (const fc of d.fechasClave) l.push(`<a class="linea acento" href="/calendario"><span class="kanji">印</span> ${esc(fc.titulo)}${fc.hora ? ` · ${esc(fc.hora)}` : ''}</a>`)
    if (d.horario && d.horario.texto) l.push(`<a class="linea${d.horario.enObligatorio ? ' acento' : ''}" href="/horario">${esc(d.horario.texto)} ›</a>`)
    if (d.avisoResta) l.push(`<div class="linea ambar">${esc(d.avisoResta.texto)}</div>`)
    const des = d.tarjetas.desafios
    for (const p of (des && des.pendientes) || []) l.push(p.ruta ? `<a class="linea acento" href="${esc(p.ruta)}">${esc(p.texto)} ›</a>` : `<div class="linea acento">${esc(p.texto)}</div>`)
    $('#lineas').innerHTML = l.join('')
  }

  /** Qué hace tocar un pilar según su tipo. */
  function detallePilar(p) {
    const t = p.accion.tipo
    const hora = p.horaLimite ? ` · hasta ${p.horaLimite}` : ''
    if (p.estado === 'descanso') return 'Descanso'
    if (p.estado === 'cumplido') return `Hecho${p.compromiso && p.compromiso.minutos ? ` · ${minutos(p.compromiso.minutos)}` : ''}`
    if (p.estado === 'tarde') return 'Tarde, sin XP'
    if (p.estado === 'omitido') return 'No cumplido'
    if (p.compromiso && p.compromiso.estado === 'iniciado') return 'En curso'
    if (t === 'entrenamiento') return `Tocá para entrenar${hora}`
    if (t === 'acostarse') return `Con «Dejo celu» hasta ${d.horas.dejarCelu}`
    if (t === 'limite_juego') { const j = d.tarjetas.juego; return j ? `${minutos(j.minutosHoy)} de ${minutos(j.limiteHoy)} · se decide al cerrar el día` : 'Se decide al cerrar el día' }
    if (t === 'comida_plan') return 'Se decide al cerrar el día con lo que cargaste'
    if (t === 'revision_diaria' || t === 'revision_semanal') return `Tocá para hacerla${hora}`
    return p.vencido ? `Se pasó la hora${hora}` : `Tocá para marcar${hora}`
  }

  function pilares() {
    $('#cuenta-pilares').innerHTML = `<span class="${d.cumplidos === d.aplican && d.aplican ? 'ok' : ''}">${d.cumplidos}</span><span class="apagado">/${d.aplican}</span>${d.racha ? ` <span class="chico">· racha ${d.racha}</span>` : ''}`
    const iniciado = (p) => p.compromiso && p.compromiso.estado === 'iniciado'
    $('#pilares').innerHTML = d.pilares.map((p, i) => `
      <button class="pilar ${p.estado}${iniciado(p) ? ' iniciado' : ''}${p.vencido ? ' vencido' : ''}" data-i="${i}">
        <span class="marca" aria-hidden="true">${ICONO_ESTADO[iniciado(p) ? 'iniciado' : p.estado] || ''}</span>
        <span class="crece"><span class="nombre">${esc(p.accion.nombre)}</span><br><span class="detalle">${esc(detallePilar(p))}</span></span>
        ${p.xpPrevisto && p.estado !== 'descanso' ? `<span class="xp">${p.estado === 'cumplido' ? '+' : ''}${p.xpPrevisto} XP</span>` : ''}
      </button>`).join('')
    for (const b of $('#pilares').querySelectorAll('.pilar')) b.onclick = () => tocarPilar(d.pilares[Number(b.dataset.i)], b)
    $('#horas-noche').textContent = `Alistarse ${d.horas.alistarse} · dejo celu hasta ${d.horas.dejarCelu} · dormido ${d.horas.dormido}`
    const s = d.tarjetas.sueno
    const yaDejo = s && s.estaNoche
    $('#dejo-celu').hidden = !(d.deAlistarse && !yaDejo && d.ciclo && !d.ciclo.noEmpezado)
  }

  const idUrl = (id) => encodeURIComponent(id)
  async function recargar() { d = await api('/api/dia/hoy'); if (d.modoSueno) { location.href = '/sueno/modo'; return } pintar() }

  /** Tocar un pilar: según su tipo, lleva a su pantalla o lo marca acá. Los ya resueltos abren el menú (deshacer, extra). */
  const tocarPilar = seguro(async (p, el) => {
    const t = p.accion.tipo
    const c = p.compromiso
    if (p.estado === 'descanso') return mensaje('Hoy es de descanso para este pilar.')
    if (c && p.estado !== 'pendiente') return menuPilar(p)
    if (t === 'entrenamiento') { location.href = '/entreno'; return }
    if (t === 'revision_diaria') { location.href = '/ciclo/revision'; return }
    if (t === 'revision_semanal') { location.href = '/ciclo/revision?tipo=semanal'; return }
    if (t === 'acostarse') return dejoCelu()
    if (t === 'limite_juego') { location.href = '/juego'; return }
    if (t === 'comida_plan') { location.href = '/comida'; return }
    if (!c) return mensaje('Este pilar todavía no está programado hoy.')
    if (p.accion.minutosMinimos || p.accion.pregunta) return menuPilar(p)
    const r = await api(`/api/dia/compromisos/${idUrl(c.id)}/completar`, {})
    evento('completar', el)
    mensaje(r.xp ? `+${r.xp} XP` : r.motivoSinXp || 'Hecho')
    await recargar()
  })

  /** Menú de un pilar o compromiso: marcar con minutos/respuesta, empezar, omitir, deshacer, extra. */
  function menuPilar(p) {
    const c = p.compromiso
    const a = p.accion
    if (!c) return
    const pendiente = c.estado === 'pendiente' || c.estado === 'iniciado'
    const campos = pendiente ? `
      ${a.condicion ? `<p class="chico">${esc(a.condicion)}</p>` : ''}
      ${a.minutosMinimos ? `<label>Minutos (mínimo ${a.minutosMinimos})<input type="number" name="minutos" min="0" max="600" inputmode="numeric" value="${a.minutosMinimos}"></label>` : ''}
      ${a.pregunta ? `<label>${esc(a.pregunta)}<textarea name="respuesta" rows="2" maxlength="1000"></textarea></label>` : ''}` : `<p class="chico">Estado: ${esc(detallePilar(p))}</p>`
    const extra = [
      pendiente && c.estado === 'pendiente' ? '<button class="mini" data-accion="iniciar">Empezar ahora</button>' : '',
      pendiente ? '<button class="mini" data-accion="omitir">No lo hago hoy</button>' : '',
      !pendiente && a.minutosExtra && !c.extra ? `<button class="mini" data-accion="extra">Extra (${a.minutosExtra} min)</button>` : '',
      !pendiente && c.extra ? '<button class="mini" data-accion="deshacer-extra">Deshacer extra</button>' : '',
      !pendiente ? '<button class="mini peligro" data-accion="deshacer">Deshacer</button>' : '',
    ].join('')
    hoja(a.nombre, campos, pendiente ? async (v) => {
      const cuerpo = {}
      if (v.minutos) cuerpo.minutos = Number(v.minutos)
      if (v.respuesta) cuerpo.respuesta = v.respuesta
      const r = await api(`/api/dia/compromisos/${idUrl(c.id)}/completar`, cuerpo)
      SEK.evento('completar')
      mensaje(r.xp ? `+${r.xp} XP` : r.motivoSinXp || 'Hecho')
      await recargar()
    } : null, { boton: 'Marcar hecho', extra: `<div class="fila">${extra}</div>`, alAccion: async (accion) => {
      const r = await api(`/api/dia/compromisos/${idUrl(c.id)}/${accion}`, {})
      if (accion === 'extra' && r.xp) mensaje(`Extra +${r.xp} XP`)
      await recargar()
    } })
  }

  const dejoCelu = seguro(async () => {
    const r = await api('/api/dia/dejo-celu', {})
    SEK.evento('dormir')
    mensaje(r.cumplido ? `A tiempo${r.xp ? ` · +${r.xp} XP` : ''}` : 'Registrado, tarde')
    location.href = '/sueno/modo'
  })

  function tira() {
    const o = d.tarjetas.organizacion
    $('#tira-tareas').hidden = !o || !o.tareas.length
    if (!o) return
    $('#tareas').innerHTML = o.tareas.map((x, i) => `
      <div class="tarea${x.tarea.estado === 'hecho' ? ' hecha' : ''}">
        <span class="punto" style="background:${esc(x.frente.color || 'var(--texto-3)')}"></span>
        <span class="crece"><span class="texto">${esc(x.tarea.texto)}</span><br><span class="chico apagado">${esc(x.frente.nombre)}</span></span>
        <button class="mini" data-i="${i}" aria-label="Hecha: ${esc(x.tarea.texto)}">✓</button>
      </div>`).join('')
    for (const b of $('#tareas').querySelectorAll('button')) {
      b.onclick = seguro(async () => {
        const x = o.tareas[Number(b.dataset.i)]
        await api(`/api/dia/organizacion/${idUrl(x.frente.id)}/${idUrl(x.tarea.id)}/hecha`, {})
        evento('completar', b.closest('.tarea'))
        await recargar()
      })
    }
  }

  const tarjetaHtml = ({ ruta, kanji, titulo, valor, detalle, progreso, alerta }) => `
    <a class="mini-tarjeta${alerta ? ' alerta' : ''}" href="${ruta}">
      <span class="titulo"><span class="kanji" aria-hidden="true">${kanji}</span>${esc(titulo)}</span>
      <span class="valor">${esc(valor)}</span>
      ${detalle ? `<span class="detalle">${esc(detalle)}</span>` : ''}
      ${progreso !== undefined ? `<span class="barra-progreso"><span style="width:${Math.max(0, Math.min(100, Math.round(progreso * 100)))}%"></span></span>` : ''}
    </a>`

  function tarjetas() {
    const t = d.tarjetas
    const l = []
    if (t.entreno) {
      const e = t.entreno
      const series = e.series.map((s) => `${s.nombre} ${s.hoy}/${s.cuota}`).join(' · ')
      l.push(tarjetaHtml({ ruta: e.enCurso ? `/entreno/sesion?id=${encodeURIComponent(e.enCurso.id)}` : '/entreno', kanji: '鍛', titulo: 'Entreno',
        valor: e.enCurso ? 'En curso' : e.hecho ? 'Hecho' : e.rutina ? e.rutina.nombre : 'Sin rutina hoy', detalle: series }))
    }
    if (t.comida) {
      const c = t.comida
      const agua = c.agua && c.agua.objetivo ? `Agua ${(c.agua.ml / 1000).toFixed(1)}/${(c.agua.objetivo / 1000).toFixed(1)} L` : ''
      const fruta = c.fruta && c.fruta.usar !== false && c.fruta.objetivo1 ? `${c.fruta.nombre || 'Fruta'} ${c.fruta.n}/${c.fruta.objetivo1}` : ''
      l.push(tarjetaHtml({ ruta: '/comida', kanji: '食', titulo: 'Comida',
        valor: c.objetivo ? `${Math.round(c.totales.kcal)} / ${c.objetivo.kcal} kcal` : `${c.cargados} cargadas`,
        detalle: [agua, fruta].filter(Boolean).join(' · '), progreso: c.objetivo && c.objetivo.kcal ? c.totales.kcal / c.objetivo.kcal : undefined }))
    }
    if (t.juego) {
      const j = t.juego
      l.push(tarjetaHtml({ ruta: '/juego', kanji: '遊', titulo: 'Juego', valor: `${minutos(j.minutosHoy)} de ${minutos(j.limiteHoy)}`,
        detalle: j.activa ? (j.pausada ? 'En pausa' : 'Jugando ahora') : j.estado === 'superado' ? 'Te pasaste del límite' : '', progreso: j.limiteHoy ? j.minutosHoy / j.limiteHoy : undefined, alerta: j.estado === 'superado' }))
    }
    if (t.sueno) {
      const s = t.sueno
      l.push(tarjetaHtml({ ruta: '/sueno', kanji: '眠', titulo: 'Sueño',
        valor: s.anoche && s.anoche.minutos ? `Anoche ${minutos(s.anoche.minutos)}` : 'Anoche sin registro',
        detalle: s.estaNoche ? `Celu dejado ${s.estaNoche.cumplido ? 'a tiempo' : `${s.estaNoche.retrasoMinutos} min tarde`}` : (s.anoche && s.anoche.veredicto ? s.anoche.veredicto.texto : `Dejo celu ${s.horaDejarCelu}`) }))
    }
    if (t.habitos && t.habitos.enForja.length) {
      const h = t.habitos
      l.push(tarjetaHtml({ ruta: '/habitos', kanji: '鍛', titulo: 'Forja',
        valor: h.enForja.map((x) => `${x.kanji || ''} ${x.validos}/${x.necesarios}`).join(' · '),
        detalle: h.enForja.filter((x) => !x.hechoHoy).length ? `Faltan hoy: ${h.enForja.filter((x) => !x.hechoHoy).map((x) => x.nombre).join(', ')}` : 'Todo hecho hoy' }))
    }
    if (d.nivel) l.push(tarjetaHtml({ ruta: '/xp', kanji: '段', titulo: 'Nivel', valor: `Nivel ${d.nivel.nivel}`, detalle: `${d.nivel.xpEnNivel} / ${d.nivel.xpParaSiguiente} XP`, progreso: d.nivel.progreso }))
    $('#tarjetas').innerHTML = l.join('')
  }

  function otros() {
    $('#seccion-otros').hidden = !d.compromisos.length
    const pend = d.compromisos.filter((c) => c.estado === 'pendiente' || c.estado === 'iniciado')
    $('#cuenta-otros').textContent = `${pend.length} pendiente${pend.length === 1 ? '' : 's'}`
    $('#otros').innerHTML = d.compromisos.map((c, i) => {
      const estado = c.estado === 'completado' ? 'cumplido' : c.estado === 'no_registrado' ? 'omitido' : c.estado
      return `<button class="pilar ${estado}" data-i="${i}"><span class="marca" aria-hidden="true">${ICONO_ESTADO[estado] || ''}</span>
        <span class="crece"><span class="nombre">${esc(c.accion.nombre)}</span><br><span class="detalle">${c.horaPrevista ? esc(c.horaPrevista) : 'Sin hora'}</span></span>
        ${c.xpPrevisto ? `<span class="xp">${c.xpPrevisto} XP</span>` : ''}</button>`
    }).join('')
    for (const b of $('#otros').querySelectorAll('.pilar')) {
      b.onclick = () => { const c = d.compromisos[Number(b.dataset.i)]; menuPilar({ accion: c.accion, compromiso: c, estado: c.estado === 'completado' ? 'cumplido' : c.estado }) }
    }
  }

  function pintar() {
    cabeza()
    $('#empezar').hidden = !d.sinCiclo
    if (d.sinCiclo && !$('#form-empezar').inicio.value) $('#form-empezar').inicio.value = d.hoy
    $('#seccion-pilares').hidden = d.sinCiclo
    lineas()
    pilares()
    tira()
    tarjetas()
    otros()
  }

  $('#form-empezar').onsubmit = seguro(async (e) => {
    e.preventDefault()
    const f = e.target
    await api('/api/dia/empezar-ciclo', { inicio: f.inicio.value, duracionDias: Number(f.duracionDias.value), diaCero: f.diaCero.checked })
    SEK.evento('logro')
    mensaje('¡Arrancó tu ciclo!')
    await recargar()
  })
  $('#dejo-celu').onclick = dejoCelu

  // El Tajo y la frase del día (desafios): la app avisa cuando se oculta; al volver, dia decide si toca.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { try { navigator.sendBeacon('/api/dia/vista') } catch (e) { /* nada */ } }
    else recargar().then(llegada).catch(() => {})
  })
  async function llegada() {
    if (!d || !window.SEK.desafios || typeof SEK.desafios.llegada !== 'function') return
    const tajo = await api('/api/dia/tajo', {}).catch(() => ({ mostrar: false, pendientes: [] }))
    const pilarPendiente = d.pilares.some((p) => p.estado === 'pendiente' && p.accion.tipo !== 'acostarse')
    SEK.desafios.llegada({ pilarPendiente, pasoDejoCelu: d.pasoDejoCelu, modoSueno: d.modoSueno, tajo: tajo.mostrar, pendientes: tajo.pendientes })
  }

  barra('hoy')
  seguro(async () => { await recargar(); await llegada() })()
})()
