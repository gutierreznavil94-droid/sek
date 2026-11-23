// Lo que comparten 3·2·1 y Siguiente acción: el hueco libre de ahora (de Mi horario) y los pendientes de hoy.
(function () {
  'use strict'
  const { api } = SEK
  const { esc } = SEK.v88
  const duracion = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 || ''}`.trim() : `${m} min`)
  /** { momento, pendientes, hoy }: momento de /api/dia/horario/dia; pendientes = compromisos de hoy sin hacer. */
  async function cargar() {
    const nada = () => null
    const [h, d] = await Promise.all([api('/api/dia/horario/dia').catch(nada), api('/api/dia').catch(nada)])
    const pendientes = d ? (d.compromisos || []).filter((c) => c.accion && (c.estado === 'pendiente' || c.estado === 'iniciado')) : []
    return { momento: h && h.momento, pendientes, hoy: d ? d.hoy : new Date().toLocaleDateString('en-CA') }
  }
  /** «Estás en … hasta …» o «Tenés 1 h 20 libres hasta …». `hasta` cambia el final cuando no hay bloque siguiente. */
  function texto(m, { libres = ' libres', hastaAlistarte = false } = {}) {
    if (!m || !(m.siguiente || m.ahora)) return ''
    if (m.ahora) return `Estás en <b>${esc(m.ahora.nombre)}</b> hasta ${esc(m.ahora.hasta)}.`
    return `Tenés <b>${duracion(m.libres)}</b>${libres} hasta ${m.siguiente ? `${esc(m.siguiente.nombre)} ${esc(m.siguiente.desde)}` : `${hastaAlistarte ? 'alistarte ' : ''}${esc(m.libreHasta)}`}.`
  }
  const marcarUsado = (que, hoy) => { try { localStorage.setItem(`usado-${que}:${hoy}`, String(Date.now())) } catch (e) { /* sin almacenamiento */ } }
  SEK.hueco = { cargar, texto, marcarUsado }
})()
