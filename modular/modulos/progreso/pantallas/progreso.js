// Pantalla Progreso: nivel, racha, la montaña del ciclo, pilares y los botones de cada sección.
// Pide a /api/progreso (las rutas de su módulo). Solo muestra: no cambia nada.
(function () {
  'use strict'
  const { api, $, seguro, barra, minutos } = SEK
  const { montana, mini, esc, diaMes, anillo } = SEK.grafico

  function pintar(r) {
    $('#cargando').hidden = true
    const n = r.nivel
    $('#nivel').hidden = false
    $('#n-nivel').textContent = n.nivel
    $('#n-etapa').textContent = n.etapa || ''
    $('#n-xp').textContent = n.xpTotal
    $('#n-falta').textContent = `${n.xpEnNivel} / ${n.xpParaSiguiente} al ${n.nivel + 1}`
    $('#n-racha').textContent = r.racha
    $('#n-racha-txt').textContent = r.racha === 1 ? 'día seguido' : 'días seguidos'
    $('#n-barra').style.width = `${Math.round(100 * (n.progreso || 0))}%`

    if (r.ciclo && r.camino.length) {
      $('#camino').hidden = false
      $('#c-dia').textContent = r.ciclo.terminado ? `Ciclo ${r.ciclo.numero} terminado` : `Día ${r.ciclo.dia} de ${r.ciclo.duracionDias} · fase ${r.ciclo.faseNumero}`
      $('#c-montana').innerHTML = montana(r.camino, r.ciclo.duracionDias)
    } else $('#sin-ciclo').hidden = false

    if (r.caidasSuperadas > 0) {
      $('#caidas').hidden = false
      $('#caidas').innerHTML = `<b>${r.caidasSuperadas}</b> · Caídas superadas <span class="apagado">· nuevo round cada vez</span>`
    }

    if (r.pilares.lista.length) {
      $('#pilares').hidden = false
      $('#p-dias').textContent = `${r.pilares.diasCumplidos} de ${r.pilares.diasContados} días ›`
      $('#p-anillos').innerHTML = r.pilares.lista.map((p) => anillo(p.nombre, p.hechos, p.programados)).join('')
    }

    const s = r.secciones
    const botones = [
      { cual: 'xp', kanji: '段', t: 'XP', d: `${s.xp.semana >= 0 ? '+' : ''}${s.xp.semana} esta semana`, m: mini(s.xp.mini) },
      { cual: 'sueno', kanji: '眠', t: 'Sueño', d: s.sueno.noches ? `${s.sueno.promedio !== null ? minutos(s.sueno.promedio) + ' · ' : ''}${s.sueno.aHora}/${s.sueno.noches} a hora` : 'Sin noches esta semana', m: mini(s.sueno.mini) },
      { cual: 'fuerza', kanji: '鍛', t: 'Fuerza', d: `${s.fuerza.semana} entreno${s.fuerza.semana === 1 ? '' : 's'} esta semana`, m: '' },
      { cual: 'comida', kanji: '食', t: 'Comida y agua', d: `${s.comida.aguaHoy} ml hoy${s.comida.peso !== null ? ` · ${s.comida.peso} kg` : ''}`, m: mini(s.comida.mini) },
      { cual: 'series', kanji: '連', t: 'Series rápidas', d: `${s.series.hoy} hoy · ${s.series.semana} en 7 días`, m: '' },
      { cual: 'pilares', kanji: '柱', t: 'Pilares y atributos', d: `${r.pilares.diasCumplidos} de ${r.pilares.diasContados} días`, m: '' },
    ]
    $('#secciones').hidden = false
    $('#secciones').innerHTML = botones.map((b) => `<a href="/progreso/seccion?cual=${b.cual}"><span class="kanji" aria-hidden="true">${b.kanji}</span><b>${esc(b.t)}</b>${b.m}<span class="chico">${esc(b.d)}</span></a>`).join('')

    if (r.fases.length) {
      $('#fases').hidden = false
      $('#f-botones').innerHTML = r.fases.map((f) => `<a class="boton" href="/progreso/fase?numero=${f.numero}">Fase ${f.numero}${f.cerrada ? ' ✓' : ''}</a>`).join('')
    }

    if (r.marcas.length) {
      $('#marcas').hidden = false
      $('#m-lista').innerHTML = r.marcas.slice(-10).reverse().map((m) => `<div><b>${diaMes(m.fecha)}</b> · ${esc(m.texto)}</div>`).join('')
    }
  }

  barra('mas')
  seguro(async () => pintar(await api('/api/progreso')))()
})()
