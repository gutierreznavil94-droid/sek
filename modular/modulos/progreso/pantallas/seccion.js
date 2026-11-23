// Una sección de Progreso a pantalla completa (/progreso/seccion?cual=xp|pilares|sueno|fuerza|comida|series).
// Pide a las rutas /api/progreso/... de su módulo. Solo muestra: no cambia nada.
(function () {
  'use strict'
  const { api, $, seguro, barra, minutos } = SEK
  const { barras, linea, anillo, esc, diaMes } = SEK.grafico

  const tarjeta = (titulo, cuerpo, nota) => `<section class="tarjeta"><div class="fila entre"><h3>${esc(titulo)}</h3>${nota ? `<span class="chico">${nota}</span>` : ''}</div>${cuerpo}</section>`
  const vacio = (t) => `<p class="chico apagado">${esc(t)}</p>`
  const signo = (n) => (n > 0 ? `+${n}` : String(n))
  const poner = (html) => { $('#cargando').hidden = true; $('#contenido').innerHTML = html }

  const SECCIONES = {
    xp: { titulo: '段 XP', pintar: pintarXp },
    pilares: { titulo: '柱 Pilares y atributos', pintar: pintarPilares },
    sueno: { titulo: '眠 Sueño', pintar: pintarSueno },
    fuerza: { titulo: '鍛 Fuerza', pintar: pintarFuerza },
    comida: { titulo: '食 Comida y agua', pintar: pintarComida },
    series: { titulo: '連 Series rápidas', pintar: pintarSeries },
  }

  async function pintarXp(rango = 'semana') {
    const r = await api(`/api/progreso/xp?rango=${rango}`)
    const seg = ['semana', 'mes', 'ciclo'].map((x) => `<button data-rango="${x}" class="${x === rango ? 'activo' : ''}">${x === 'semana' ? 'Semana' : x === 'mes' ? 'Mes' : 'Ciclo'}</button>`).join('')
    const pts = r.dias.map((d) => ({ valor: d.neto, etiqueta: diaMes(d.fecha), titulo: `${diaMes(d.fecha)} · +${d.ganado} / −${d.perdido} · neto ` }))
    poner(
      `<div class="segmentos" role="tablist" aria-label="Rango">${seg}</div>` +
      tarjeta('XP neta por día', barras(pts, { unidad: ' XP' }), `<span class="ok">+${r.ganado}</span> · <span class="mal">−${r.perdido}</span> · <b>${signo(r.neto)}</b>`) +
      tarjeta('XP acumulada', linea(r.dias.map((d) => ({ valor: d.acumulado, etiqueta: diaMes(d.fecha), titulo: `${diaMes(d.fecha)} · ` })), { unidad: ' XP' })) +
      `<a class="boton" href="/xp">Ver cada movimiento de XP</a>`,
    )
    document.querySelectorAll('[data-rango]').forEach((b) => b.addEventListener('click', seguro(() => pintarXp(b.dataset.rango))))
  }

  async function pintarPilares() {
    const r = await api('/api/progreso/pilares')
    const anillos = r.lista.length ? `<div class="anillos">${r.lista.map((p) => anillo(p.nombre, p.hechos, p.programados)).join('')}</div>` : vacio('El ciclo todavía no empezó.')
    const atributos = r.atributos.length ? r.atributos.map((a) => `
      <div class="atributo">
        <div class="fila entre"><span>${esc(a.nombre)}</span><span>${a.valor ?? '—'}${a.tendencia ? ` <span class="${a.tendencia > 0 ? 'sube' : 'baja'}">${a.tendencia > 0 ? '▲' : '▼'}${Math.abs(a.tendencia)}</span>` : ''}</span></div>
        <div class="barra-progreso"><span style="width:${a.valor ?? 0}%"></span></div>
        <span class="chico apagado">${a.cumplidos ?? 0} de ${a.programados ?? 0} cumplidos en ${a.ventanaDias ?? ''} días</span>
      </div>`).join('') : vacio('Sin atributos.')
    poner(tarjeta('Pilares en el ciclo', anillos, `${r.diasCumplidos} de ${r.diasContados} días cumplidos`) + tarjeta('Atributos', atributos, 'salen de cómo cumplís'))
  }

  async function pintarSueno() {
    const r = await api('/api/progreso/sueno')
    const s = r.resumen
    const pts = r.noches.map((n) => ({ valor: n.minutos === null ? null : Math.round(n.minutos / 6) / 10, etiqueta: diaMes(n.noche), clase: n.cumplido ? 'g-mas' : 'g-vacio', titulo: `${diaMes(n.noche)}${n.cumplido ? ' · a hora' : ''}${n.estimado ? ' · estimado' : ''} · ` }))
    const datos = s.promedio
      ? `<div class="datos-3"><div><b>${minutos(s.promedio.minutos)}</b><span class="chico">promedio</span></div><div><b>${s.diferenciaObjetivo >= 0 ? '+' : '−'}${minutos(Math.abs(s.diferenciaObjetivo))}</b><span class="chico">vs objetivo</span></div><div><b class="rojo">${s.mejora.racha ?? 0}</b><span class="chico">racha</span></div></div>`
      : vacio('Todavía no hay noches completas.')
    const mejora = s.mejora.semana !== null && s.mejora.semanaAnterior !== null
      ? `<p class="chico">Esta semana ${minutos(s.mejora.semana)} por noche · la anterior ${minutos(s.mejora.semanaAnterior)}.</p>` : ''
    poner(tarjeta('Últimos 30 días', datos + mejora) + tarjeta('Horas dormidas por noche', barras(pts, { unidad: ' h' }) + '<div class="leyenda"><span><i style="background:var(--verde)"></i>Dejo celu a hora</span></div>') + `<a class="boton" href="/sueno">Ir a Sueño</a>`)
  }

  async function pintarFuerza() {
    const r = await api('/api/progreso/fuerza')
    const datos = `<div class="datos-3"><div><b>${r.entrenos}</b><span class="chico">entrenos</span></div><div><b>${r.records.length}</b><span class="chico">récords</span></div><div><b>${r.mejoraronEsteMes.length}</b><span class="chico">mejoraron este mes</span></div></div>`
    const subida = r.ultimaSubida ? `<p class="chico">Última subida de peso: <b>${esc(r.ultimaSubida.nombre)}</b> de ${r.ultimaSubida.de} a ${r.ultimaSubida.a} kg (${diaMes(r.ultimaSubida.fecha)}).</p>` : ''
    const volumen = barras(r.volumenPorSemana.map((v) => ({ valor: v.volumen, etiqueta: diaMes(v.semana), titulo: `Semana del ${diaMes(v.semana)} · ` })), { unidad: ' kg·rep' })
    const records = r.records.length ? r.records.slice(0, 8).map((x) => `<div class="chico">🏆 <b>${esc(x.nombre)}</b> · ${diaMes(x.fecha)}</div>`).join('') : vacio('Sin récords todavía en este ciclo.')
    const ejercicios = r.ejercicios.length
      ? `<label>Ejercicio<select id="ejercicio"><option value="">Elegí uno…</option>${r.ejercicios.map((e) => `<option value="${esc(e.id)}">${esc(e.nombre)} · ${esc(e.rutina)}</option>`).join('')}</select></label><div id="progresion"></div>`
      : vacio('Sin ejercicios en las rutinas activas.')
    poner(tarjeta('Desde el Día 1', datos + subida) + tarjeta('Volumen por semana', volumen) + tarjeta('Récords', records) + tarjeta('Progresión de un ejercicio', ejercicios))
    const sel = $('#ejercicio')
    if (sel) sel.addEventListener('change', seguro(async () => {
      if (!sel.value) { $('#progresion').innerHTML = ''; return }
      const p = await api(`/api/progreso/fuerza/${encodeURIComponent(sel.value)}`)
      if (!p.puntos.length) { $('#progresion').innerHTML = vacio('Todavía no lo entrenaste.'); return }
      const reps = linea(p.puntos.map((x) => ({ valor: x.reps, etiqueta: diaMes(x.fecha), titulo: `${diaMes(x.fecha)} · ${x.peso} kg · ` })), { unidad: ' reps' })
      const peso = linea(p.puntos.map((x) => ({ valor: x.peso, etiqueta: diaMes(x.fecha), titulo: `${diaMes(x.fecha)} · ` })), { unidad: ' kg' })
      $('#progresion').innerHTML = `<p class="chico">Reps de la 1.ª serie</p>${reps}<p class="chico">Peso</p>${peso}`
    }))
  }

  async function pintarComida() {
    const r = await api('/api/progreso/comida')
    const kcal = r.kcal.some((x) => x.valor !== null) ? barras(r.kcal.map((x) => ({ valor: x.valor, etiqueta: diaMes(x.fecha), clase: 'g-mas', titulo: `${diaMes(x.fecha)} · ` })), { unidad: ' kcal' }) : vacio('Sin comidas anotadas en 30 días.')
    const agua = r.agua.some((x) => x.valor) ? barras(r.agua.map((x) => ({ valor: x.valor, etiqueta: diaMes(x.fecha), clase: 'g-mas', titulo: `${diaMes(x.fecha)} · ` })), { unidad: ' ml' }) : vacio('Sin agua anotada en 30 días.')
    const frutas = r.fruta.reduce((s, x) => s + x.valor, 0)
    const peso = r.pesos.length > 1 ? linea(r.pesos.map((p) => ({ valor: p.kg, etiqueta: diaMes(p.fecha), titulo: `${diaMes(p.fecha)} · ` })), { unidad: ' kg' }) : r.pesos.length ? `<p>${r.pesos[0].kg} kg (${diaMes(r.pesos[0].fecha)})</p>` : vacio('Sin pesos en 90 días.')
    poner(tarjeta('Calorías por día', kcal) + tarjeta('Agua por día', agua) + tarjeta('Fruta', `<p><b>${frutas}</b> en 30 días</p>`) + tarjeta('Peso', peso, 'últimos 90 días') + `<a class="boton" href="/comida">Ir a Comida</a>`)
  }

  async function pintarSeries() {
    const r = await api('/api/progreso/series')
    if (!r.contadores.length) { poner(vacio('Sin series rápidas en los últimos 30 días.')); return }
    poner(r.contadores.map((c) => tarjeta(c.nombre,
      barras(c.dias.map((d) => ({ valor: d.valor, etiqueta: diaMes(d.fecha), clase: 'g-mas', titulo: `${diaMes(d.fecha)} · ` })), { unidad: ' reps' }),
      `hoy ${c.hoy} · semana ${c.semana} · récord ${c.record}`)).join(''))
  }

  const cual = new URLSearchParams(location.search).get('cual')
  const s = SECCIONES[cual] || SECCIONES.xp
  $('#titulo').textContent = s.titulo
  document.title = `SEK · ${s.titulo.slice(2)}`
  barra('mas')
  seguro(() => s.pintar())()
})()
