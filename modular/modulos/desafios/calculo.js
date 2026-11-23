'use strict'
/**
 * Cuentas puras del módulo desafios (sin base). Traído de la app vieja: src/services/duelo.ts, ninjas.ts,
 * batalla.ts, rival.ts e inicios.ts (la parte que no toca datos).
 */
const { minutosDe } = require('../../comun/fechas')

/** Lo que tiene cada persona si no cambió nada. Lo archivado (ninjas, rival, batalla) arranca apagado. */
const CONFIG_INICIAL = Object.freeze({
  // Tensión: la escena de la mano. Kanji y frase del final (進 «Avanzá igual.»).
  tension: { activa: true, kanji: '進', frase: 'Avanzá igual.' },
  // «Dudar es fracasar» una vez por día al abrir la app.
  fraseDelDia: true,
  // El Tajo: volver después de N horas con un pilar pendiente corta la pantalla.
  tajo: { activo: true, horas: 3 },
  // Duelo de flexiones: qué serie rápida se usa (null = la que se llame «flexiones», o la primera) y cuántas si no hay ninguna.
  duelo: { contadorId: null, repsSinSerie: 10 },
  // 3·2·1: XP por empezar y tope de inicios con XP por día.
  inicio: { xp: 5, maxPorDia: 3 },
  // Archivado (v0.86): ninjas de la distracción, rival escurridizo y batalla. Apagado hasta pulirlos.
  ninjas: false,
  distracciones: [{ id: 'celu', nombre: 'Celu' }, { id: 'juego', nombre: 'Juego' }, { id: 'pereza', nombre: 'Pereza' }],
  batalla: { activa: true, repsPorToque: 5 },
  rival: { modo: 'escurridizo', xpRobo: 10 },
})

const copia = (x) => JSON.parse(JSON.stringify(x))

/** Mezcla lo guardado con lo inicial (cada grupo por separado, así un campo nuevo nunca falta). */
function completarConfig(guardado = {}) {
  const c = copia(CONFIG_INICIAL)
  for (const [k, v] of Object.entries(guardado || {})) {
    if (!(k in c)) continue
    c[k] = c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) && v && typeof v === 'object' && !Array.isArray(v) ? { ...c[k], ...v } : v
  }
  return c
}

const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const texto = (v, max) => typeof v === 'string' && v.trim().length <= max

/**
 * Revisa los cambios de configuración. Devuelve { limpio } con solo lo válido de cada grupo, o { error } con el primer problema.
 * Si un dato está mal no se guarda nada (lo decide la ventanilla).
 */
function revisarConfig(cambios = {}) {
  const limpio = {}
  const mal = (m) => ({ error: m })
  for (const [k, v] of Object.entries(cambios || {})) {
    if (v === undefined) continue
    if (k === 'tension') {
      if (!v || typeof v !== 'object') return mal('Tensión: datos no válidos.')
      const t = {}
      if ('activa' in v) { if (typeof v.activa !== 'boolean') return mal('Tensión: «activa» es sí o no.'); t.activa = v.activa }
      if ('kanji' in v) { if (!texto(v.kanji, 4) || !v.kanji.trim()) return mal('El kanji de Tensión: entre 1 y 4 letras.'); t.kanji = v.kanji.trim() }
      if ('frase' in v) { if (!texto(v.frase, 60)) return mal('La frase de Tensión: hasta 60 letras.'); t.frase = v.frase.trim() }
      limpio.tension = t
    } else if (k === 'fraseDelDia' || k === 'ninjas') {
      if (typeof v !== 'boolean') return mal(`«${k}» es sí o no.`)
      limpio[k] = v
    } else if (k === 'tajo') {
      const t = {}
      if ('activo' in v) { if (typeof v.activo !== 'boolean') return mal('Tajo: «activo» es sí o no.'); t.activo = v.activo }
      if ('horas' in v) { if (!entero(v.horas, 1, 24)) return mal('Tajo: entre 1 y 24 horas.'); t.horas = v.horas }
      limpio.tajo = t
    } else if (k === 'duelo') {
      const t = {}
      if ('contadorId' in v) { if (v.contadorId !== null && !texto(v.contadorId, 80)) return mal('Duelo: serie no válida.'); t.contadorId = v.contadorId || null }
      if ('repsSinSerie' in v) { if (!entero(v.repsSinSerie, 1, 200)) return mal('Duelo: entre 1 y 200 flexiones.'); t.repsSinSerie = v.repsSinSerie }
      limpio.duelo = t
    } else if (k === 'inicio') {
      const t = {}
      if ('xp' in v) { if (!entero(v.xp, 0, 50)) return mal('3·2·1: XP entre 0 y 50.'); t.xp = v.xp }
      if ('maxPorDia' in v) { if (!entero(v.maxPorDia, 0, 20)) return mal('3·2·1: tope entre 0 y 20 por día.'); t.maxPorDia = v.maxPorDia }
      limpio.inicio = t
    } else if (k === 'distracciones') {
      if (!Array.isArray(v) || v.length > 30) return mal('Distracciones: hasta 30.')
      const lista = []
      for (const d of v) {
        if (!d || !texto(d.nombre, 30) || !d.nombre.trim() || !texto(d.id, 40) || !d.id) return mal('Cada distracción lleva id y nombre (hasta 30 letras).')
        const x = { id: d.id, nombre: d.nombre.trim() }
        if (d.momento) { if (!MOMENTOS.includes(d.momento) && d.momento !== 'cualquiera') return mal('Momento de la distracción no válido.'); x.momento = d.momento }
        lista.push(x)
      }
      limpio.distracciones = lista
    } else if (k === 'batalla') {
      const t = {}
      if ('activa' in v) { if (typeof v.activa !== 'boolean') return mal('Batalla: «activa» es sí o no.'); t.activa = v.activa }
      if ('repsPorToque' in v) { if (!entero(v.repsPorToque, 1, 50)) return mal('Batalla: reps por toque entre 1 y 50.'); t.repsPorToque = v.repsPorToque }
      limpio.batalla = t
    } else if (k === 'rival') {
      const t = {}
      if ('modo' in v) { if (v.modo !== 'escurridizo' && v.modo !== 'carta') return mal('Rival: «escurridizo» o «carta».'); t.modo = v.modo }
      if ('xpRobo' in v) { if (!entero(v.xpRobo, 0, XP_ROBO_MAX)) return mal(`Rival: entre 0 y ${XP_ROBO_MAX} XP.`); t.xpRobo = v.xpRobo }
      limpio.rival = t
    } else {
      return mal(`No conozco el ajuste «${k}».`)
    }
  }
  return { limpio }
}

// ---------- Duelo de flexiones ----------

const REPS_SIN_SERIE = 10
const MOTIVOS_DUELO = ['tension', 'caida', 'rival']

/** Cuántas flexiones pide: la serie (reps por toque del contador), o la serie más la mitad después de «No cumplí». */
function repsDuelo(repsSerie, motivo, sinSerie = REPS_SIN_SERIE) {
  const base = repsSerie && repsSerie > 0 ? Math.round(repsSerie) : Math.max(1, Math.round(sinSerie) || REPS_SIN_SERIE)
  return motivo === 'caida' ? base + Math.ceil(base / 2) : base
}

/** El contador de flexiones: el elegido, si no el que se llame «flexi…», si no el primero. */
function elegirContador(lista, contadorId) {
  return (contadorId ? lista.find((c) => c.id === contadorId) : undefined) || lista.find((c) => /flexi/i.test(c.nombre)) || lista[0] || null
}

const NOTA_DUELO = { rival: 'Duelo con el rival', tension: 'Tensión: avancé igual', caida: 'Caída: nuevo round' }

// ---------- El Tajo ----------

/** ¿Toca el Tajo? Volvió después de ≥ N horas, hay un pilar pendiente, no pasó la hora de dejar el celu y hoy todavía no salió. */
function debeMostrarTajo({ ultimaVista, ahora, pilarPendiente, pasoDejoCelu, mostradoHoy, horas = 3 }) {
  if (mostradoHoy || !pilarPendiente || pasoDejoCelu) return false
  if (ultimaVista === null || ultimaVista === undefined) return false
  return ahora - ultimaVista >= horas * 3600000
}

// ---------- 3·2·1 ----------

/** Para que «Leer», «leer » y «Léer» cuenten como la misma acción (una sola XP por día). */
function normalizar(t) {
  return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').slice(0, 60)
}

// ---------- Ninjas, batalla y rival (archivado) ----------

const MOMENTOS = ['pilar', 'noche', 'duda', 'juego', 'batalla']
const TOPE_NINJAS_DIA = 2
const MINUTOS_PILAR = 15
const TOPE_BATALLAS_DIA = 3
const REPS_POR_TOQUE = 5
const OBJETIVO_SIN_CONTADOR = 15
const XP_ROBO_MAX = 30
const ESCAPES_MAX = 2

/** Qué momento de duda está activo ahora (el primero que aplica). */
function momentoActivo({ minutoActual, pilaresPendientes = [], pasoDejoCelu, juegoPasado }) {
  for (const p of pilaresPendientes) {
    if (!p.horaLimite) continue
    const faltan = minutosDe(p.horaLimite) - minutoActual
    if (faltan >= 0 && faltan <= MINUTOS_PILAR) return { momento: 'pilar', pilar: { id: p.id, nombre: p.nombre, entreno: !!p.entreno } }
  }
  if (pasoDejoCelu) return { momento: 'noche' }
  if (juegoPasado) return { momento: 'juego' }
  return null
}

/** Qué ninja sale: el asignado a ese momento; si ninguno, uno al azar sin repetir en el día. */
function elegirNinja(lista, momento, usadosHoy = [], azar = Math.random) {
  if (!lista.length) return null
  const asignados = lista.filter((d) => d.momento === momento)
  if (asignados.length) return asignados[Math.floor(azar() * asignados.length) % asignados.length]
  const libres = lista.filter((d) => !d.momento || d.momento === 'cualquiera')
  const base = libres.length ? libres : lista
  const sinRepetir = base.filter((d) => !usadosHoy.includes(d.id))
  const de = sinRepetir.length ? sinRepetir : base
  return de[Math.floor(azar() * de.length) % de.length]
}

/** ¿Puede aparecer solo? Tope de 2 automáticos por día y una vez por momento. «duda» y «batalla» sin tope. */
function puedeAparecer(peleasHoy, momento) {
  if (momento === 'duda' || momento === 'batalla') return true
  const automaticas = peleasHoy.filter((p) => p.momento !== 'duda' && p.momento !== 'batalla')
  if (automaticas.length >= TOPE_NINJAS_DIA) return false
  return !automaticas.some((p) => p.momento === momento)
}

/** Qué hace el botón de la pelea según el momento. */
function accionDePelea(x) {
  if (x.pilar) return { etiqueta: `Empezar ${x.pilar.nombre}`, ruta: x.pilar.entreno ? '/entreno' : '/hoy' }
  if (x.momento === 'noche') return { etiqueta: 'Dejo celu', ruta: '/sueno' }
  if (x.momento === 'juego') return { etiqueta: 'Cerrar el juego', ruta: '/juego' }
  return { etiqueta: 'Seguir con lo mío', ruta: '/hoy' }
}

function fraseDePelea(x, distraccion) {
  if (x.pilar) return `${distraccion} quiere que lo dejes para mañana. ${x.pilar.nombre} se hace hoy.`
  if (x.momento === 'noche') return `${distraccion} no te deja dormir. La lámpara se apaga ahora.`
  if (x.momento === 'juego') return `${distraccion} ya se llevó su parte. Hasta acá.`
  return `${distraccion} apareció. Vos decidís quién sigue.`
}

/** Objetivo de la batalla: reps por serie redondeadas hacia arriba a un múltiplo de las reps por toque (14 → 15). */
function objetivoBatalla(repsPorSerie, porToque = REPS_POR_TOQUE) {
  const paso = Math.max(1, Math.round(porToque) || REPS_POR_TOQUE)
  const base = repsPorSerie && repsPorSerie > 0 ? repsPorSerie : OBJETIVO_SIN_CONTADOR
  return Math.max(paso, Math.ceil(base / paso) * paso)
}

/** Cuántas veces se escabulle el rival antes de que lo atrapen: 0 (50 %), 1 (35 %) o 2 (15 %). */
function sortearEscapes(azar = Math.random) {
  const r = azar()
  if (r < 0.5) return 0
  if (r < 0.85) return 1
  return ESCAPES_MAX
}

/** XP que roba el rival: 10 si falta, siempre entre 0 y 30. */
function xpRoboDe(rival = {}) {
  const v = rival.xpRobo
  if (v === undefined || v === null || Number.isNaN(v)) return 10
  return Math.max(0, Math.min(XP_ROBO_MAX, Math.round(v)))
}

/** Cuánto se puede robar sin bajar de nivel: lo que hay desde el inicio del nivel actual. */
function roboPosible(xpEnNivel, cantidad) {
  return Math.max(0, Math.min(cantidad, Math.floor(xpEnNivel || 0)))
}

/** Estado de un chip del día: vencido (reps y además un 3·2·1 después), duda, escapado o robo. */
function estadoChip(p, { repsDespues = 0, ultimaAccion = 0, diaTerminado = false }) {
  if (p.robo) return 'robo'
  if (p.resultado === 'escapo') return 'escapado'
  const hizoReps = (p.reps || 0) > 0 || repsDespues > 0
  if (hizoReps && ultimaAccion >= p.instante) return 'vencido'
  return diaTerminado ? 'escapado' : 'duda'
}

module.exports = {
  CONFIG_INICIAL, completarConfig, revisarConfig,
  REPS_SIN_SERIE, MOTIVOS_DUELO, NOTA_DUELO, repsDuelo, elegirContador,
  debeMostrarTajo, normalizar,
  MOMENTOS, TOPE_NINJAS_DIA, MINUTOS_PILAR, TOPE_BATALLAS_DIA, REPS_POR_TOQUE, OBJETIVO_SIN_CONTADOR, XP_ROBO_MAX, ESCAPES_MAX,
  momentoActivo, elegirNinja, puedeAparecer, accionDePelea, fraseDePelea, objetivoBatalla, sortearEscapes, xpRoboDe, roboPosible, estadoChip,
}
