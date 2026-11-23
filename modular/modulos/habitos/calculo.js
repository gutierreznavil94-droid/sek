'use strict'
/**
 * Hábitos · las cuentas puras (sin base ni pantalla). Traído de src/domain/forja.ts, src/services/codigo.ts y caidas.ts.
 *
 * Forja: un hábito nuevo dura `dias` (30) desde que se crea y se forja al juntar `validos` (28) días válidos.
 * - Día válido: un día cumplido, o la 1.ª falla de cada semana de la forja (falla perdonada).
 * - Margen: `dias - validos` fallas no perdonadas no cuestan nada.
 * - Cada falla de más «cierra un poco» la piedra: se pierde la última grieta (−1 válido) y la forja dura 1 día más.
 *   Nunca se reinicia: la forja sigue hasta juntar los días válidos.
 * - Hoy no cuenta como falla mientras no termine.
 */
const { diferenciaDias, sumarDias } = require('../../comun/fechas')

const FORJA_DEFECTO = { dias: 30, validos: 28, xpDia: 5, xpForjado: 50, maximo: 3 }

/** Días válidos en que cae cada uno de los 6 pedazos (con 28). Con otro número, proporcional. */
const PEDAZOS_BASE = [7, 12, 17, 21, 25, 28]

function configForja(guardada) {
  const c = { ...FORJA_DEFECTO, ...(guardada || {}) }
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d)
  const dias = Math.max(1, Math.round(num(c.dias, FORJA_DEFECTO.dias)))
  return {
    dias,
    validos: Math.max(1, Math.min(dias, Math.round(num(c.validos, FORJA_DEFECTO.validos)))),
    xpDia: Math.max(0, num(c.xpDia, FORJA_DEFECTO.xpDia)),
    xpForjado: Math.max(0, num(c.xpForjado, FORJA_DEFECTO.xpForjado)),
    maximo: Math.max(1, Math.round(num(c.maximo, FORJA_DEFECTO.maximo))),
  }
}

function pedazosPara(validos) {
  const v = Math.max(1, Math.round(validos))
  const r = PEDAZOS_BASE.map((p) => Math.max(1, Math.round((p * v) / 28)))
  for (let i = 1; i < r.length; i++) if (r[i] <= r[i - 1]) r[i] = r[i - 1] + 1
  r[r.length - 1] = Math.max(r[r.length - 1], v)
  return r
}

/** Cuántos pedazos cayeron con estos días válidos. */
function pedazosCaidos(validos, necesarios) {
  return pedazosPara(necesarios).filter((p) => validos >= p).length
}

/**
 * Estado de un hábito en forja a una fecha.
 * h = { inicio: 'AAAA-MM-DD', cumplidos: ['AAAA-MM-DD', ...] }.
 * camino: un día por casilla con estado cumplido | perdonado | falla | hoy | pendiente | futuro.
 */
function estadoForja(h, hoy, cfg = FORJA_DEFECTO) {
  const necesarios = Math.max(1, Math.min(cfg.validos, cfg.dias))
  const margen = Math.max(0, cfg.dias - necesarios)
  const hechos = new Set((h.cumplidos || []).filter((f) => f >= h.inicio && f <= hoy))
  const diaActual = Math.max(1, diferenciaDias(h.inicio, hoy) + 1)
  const semanas = new Set()
  let perdonadas = 0
  let fallas = 0
  const estados = new Map()
  for (let i = 0; i < diaActual - 1; i++) {
    const f = sumarDias(h.inicio, i)
    if (hechos.has(f)) { estados.set(f, 'cumplido'); continue }
    const semana = Math.floor(i / 7)
    if (!semanas.has(semana)) { semanas.add(semana); perdonadas++; estados.set(f, 'perdonado') } else { fallas++; estados.set(f, 'falla') }
  }
  const hechoHoy = hechos.has(hoy)
  estados.set(hoy, hechoHoy ? 'cumplido' : 'hoy')
  const cerradas = Math.max(0, fallas - margen)
  const validos = Math.max(0, Math.min(necesarios, hechos.size + perdonadas - cerradas))
  const duracion = cfg.dias + cerradas
  const largo = Math.max(duracion, diaActual)
  const camino = []
  for (let i = 0; i < largo; i++) {
    const f = sumarDias(h.inicio, i)
    camino.push({ fecha: f, estado: estados.get(f) || (f > hoy ? 'futuro' : 'pendiente') })
  }
  return {
    validos,
    necesarios,
    duracion,
    diaActual,
    cumplidos: hechos.size,
    perdonadas,
    fallas,
    margenRestante: Math.max(0, margen - fallas),
    cerradas,
    hechoHoy,
    perdonUsadoSemana: semanas.has(Math.floor((diaActual - 1) / 7)),
    pedazos: pedazosCaidos(validos, necesarios),
    pedazosEn: pedazosPara(necesarios),
    faltan: Math.max(0, necesarios - validos),
    completo: validos >= necesarios,
    camino,
  }
}

/** Kanji sugeridos según el nombre del hábito (los que coinciden primero, completando hasta 6). */
const PISTAS = [
  [/le(e|er|o)|libro|lectura/i, '読'],
  [/agua|tomar|hidrat/i, '水'],
  [/dorm|sueñ|cama|acost/i, '眠'],
  [/flexi|ejerc|entren|correr|cuerpo|gym|camin|estir/i, '体'],
  [/medit|mente|respir|pensar|diario/i, '心'],
  [/celu|pantalla|calma|silencio|redes/i, '静'],
  [/estud|aprend|curso|idioma/i, '学'],
  [/dibuj|pint|manga|arte/i, '描'],
  [/com(er|ida)|fruta|verdura|azúcar|azucar/i, '食'],
  [/temprano|mañana|madrug|levant/i, '朝'],
  [/escrib/i, '書'],
]
const RELLENO = ['志', '力', '心', '静', '体', '忍', '鍛', '進']

function kanjiSugeridos(nombre) {
  const r = []
  for (const [re, k] of PISTAS) if (re.test(nombre || '') && !r.includes(k)) r.push(k)
  for (const k of RELLENO) { if (r.length >= 6) break; if (!r.includes(k)) r.push(k) }
  return r.slice(0, 6)
}

/** Un kanji (o un carácter) por hábito. */
function limpiarKanji(texto) {
  return [...String(texto || '').trim()][0] || ''
}

// ---------- Mi código ----------

const GRUPOS_CODIGO = [
  { id: 'cuerpo', nombre: 'Cuerpo', kanji: '体' },
  { id: 'mente', nombre: 'Mente', kanji: '心' },
  { id: 'comida', nombre: 'Comida', kanji: '食' },
  { id: 'cuidado', nombre: 'Cuidado', kanji: '整' },
]
const MOMENTOS_CODIGO = [
  { id: 'manana', nombre: 'Mañana', kanji: '朝' },
  { id: 'tarde', nombre: 'Tarde', kanji: '昼' },
  { id: 'noche', nombre: 'Noche', kanji: '夜' },
  { id: 'siempre', nombre: 'Siempre', kanji: '常' },
]
const esGrupo = (g) => GRUPOS_CODIGO.some((x) => x.id === g)
const esMomento = (m) => MOMENTOS_CODIGO.some((x) => x.id === m)

/** Los ejemplos con que arranca una cuenta nueva (una sola vez). */
const CODIGO_INICIAL = [
  { grupo: 'cuerpo', momento: 'manana', texto: 'Flexiones al despertar' },
  { grupo: 'cuerpo', momento: 'siempre', texto: 'Dominadas al subir y bajar la escalera' },
  { grupo: 'cuerpo', momento: 'siempre', texto: 'Ejercicios de postura' },
  { grupo: 'mente', momento: 'siempre', texto: 'Flexiones cada vez que pierdo el foco o me despisto' },
  { grupo: 'comida', momento: 'siempre', texto: 'No acepto ultraprocesados de otros; solo en casa, con mi familia o en eventos' },
  { grupo: 'cuidado', momento: 'noche', texto: 'Rutina de skincare' },
]

/** Orden de una regla en una vista ('area' u 'momento'). */
const ordenEn = (r, vista) => (vista === 'area' ? r.orden : r.ordenMomento ?? r.orden)

/** Reglas de un grupo (área o momento), en el orden de esa vista. */
function reglasDelGrupo(reglas, vista, grupo) {
  return reglas.filter((r) => (vista === 'area' ? r.grupo : r.momento || 'siempre') === grupo).sort((a, b) => ordenEn(a, vista) - ordenEn(b, vista))
}

// ---------- Caídas ----------

const XP_CAIDA_POR_DEFECTO = 20
const XP_CAIDA_MAX = 200
/** Cuánto dura «Deshacer» después de la caída. */
const DESHACER_CAIDA_MS = 10_000

function xpCaidaDe(configCaida) {
  const v = configCaida && configCaida.xp
  if (v === undefined || v === null || !Number.isFinite(Number(v))) return XP_CAIDA_POR_DEFECTO
  return Math.max(0, Math.min(XP_CAIDA_MAX, Math.round(Number(v))))
}

module.exports = {
  FORJA_DEFECTO, PEDAZOS_BASE, configForja, pedazosPara, pedazosCaidos, estadoForja, kanjiSugeridos, limpiarKanji,
  GRUPOS_CODIGO, MOMENTOS_CODIGO, esGrupo, esMomento, CODIGO_INICIAL, ordenEn, reglasDelGrupo,
  XP_CAIDA_POR_DEFECTO, XP_CAIDA_MAX, DESHACER_CAIDA_MS, xpCaidaDe,
}
