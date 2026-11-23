'use strict'
/**
 * Ciclo · cuentas puras (sin base). Traído de src/services/ciclo.ts, metas.ts y src/domain/fechas.ts.
 * Día del ciclo, fase de un día, fases y metas automáticas de un ciclo nuevo, estado de las metas.
 */
const { diaDelCiclo, fechaDelDiaDelCiclo, faseDelDia, domingoDe, sumarDias, diferenciaDias } = require('../../comun/fechas')

/** Foco y qué se mide de las fases iniciales (después se editan). */
const FASES_INICIALES = [
  { foco: 'Disciplina y ejecución', queSeMide: 'Línea de base (primeros 7 días) y % de compromisos cumplidos.' },
  { foco: 'Constancia y autocontrol', queSeMide: 'Menos incumplimientos repetidos, respetar límites, volver a la rutina tras un mal día. Comparación con la fase 1.' },
  { foco: 'Consolidar la identidad con resultados', queSeMide: 'Cumplimiento, regularidad de entrenamiento y descanso, control del juego, capacidad de empezar tareas, coherencia objetivos-acciones.' },
]

const IDENTIDAD_INICIAL = {
  vision: 'Persona disciplinada que cumple sus compromisos; físico estético, buena postura y fuerza; confianza y respeto propio y hacia los demás; autocontrol físico, mental y emocional; claridad mental y foco; que actúa sin depender de las ganas.',
  obstaculos: 'Postergación, exceso de tiempo de juego, falta de constancia, distracción, sensación de estancamiento, comparación excesiva con otros.',
}

const ATRIBUTOS_INICIALES = [
  { id: 'disciplina', nombre: 'Disciplina y ejecución', descripcion: 'Cumplir lo planificado y empezar sin postergar.', orden: 1, ventanaDias: 14 },
  { id: 'fisico', nombre: 'Físico y presencia', descripcion: 'Entrenamiento, postura, fuerza y descanso.', orden: 2, ventanaDias: 14 },
  { id: 'autocontrol', nombre: 'Autocontrol', descripcion: 'Respetar límites: juego, hora de acostarse, impulsos.', orden: 3, ventanaDias: 14 },
  { id: 'claridad', nombre: 'Claridad mental y foco', descripcion: 'Saber cuál es la siguiente acción y sostener la atención.', orden: 4, ventanaDias: 14 },
  { id: 'confianza', nombre: 'Confianza, respeto y estabilidad emocional', descripcion: 'Coherencia entre lo que digo y lo que hago; revisar sin castigarme.', orden: 5, ventanaDias: 14 },
]

/** XP de una meta propia cumplida y cuántas metas por día dan XP. */
const XP_META = 15
const TOPE_METAS_CON_XP = 2

/** Obstáculos de un toque en la revisión diaria. «Ninguno» también vale. */
const OBSTACULOS = ['Postergué', 'Jugué de más', 'Me distraje', 'Cansancio', 'Imprevisto', 'Ninguno']

/** Fases de un ciclo: [{ numero, diaInicio, diaFin, foco, queSeMide }]. La última puede ser más corta. */
function planDeFases(duracionDias, diasPorFase) {
  const n = Math.ceil(duracionDias / diasPorFase)
  const fases = []
  for (let i = 1; i <= n; i++) {
    const base = FASES_INICIALES[i - 1] || { foco: `Fase ${i}`, queSeMide: '' }
    fases.push({ numero: i, diaInicio: (i - 1) * diasPorFase + 1, diaFin: Math.min(i * diasPorFase, duracionDias), foco: base.foco, queSeMide: base.queSeMide })
  }
  return fases
}

/** Metas automáticas de un ciclo: Día 1, fin de cada fase (la última = fin del ciclo) y revisión semanal cada domingo. */
function metasAutomaticas({ numero, inicio, duracionDias }, fases) {
  const metas = []
  fases.forEach((f, i) => {
    const ultima = i === fases.length - 1
    metas.push({ fecha: fechaDelDiaDelCiclo(inicio, f.diaFin), titulo: ultima ? `Fin del ciclo ${numero}` : `Fin de la fase ${f.numero}`, tipo: ultima ? 'fin_ciclo' : 'fin_fase' })
  })
  metas.push({ fecha: inicio, titulo: `Día 1 del ciclo ${numero}`, tipo: 'inicio_ciclo' })
  const fin = fechaDelDiaDelCiclo(inicio, duracionDias)
  for (let dom = domingoDe(inicio); dom <= fin; dom = sumarDias(dom, 7)) {
    if (dom >= inicio) metas.push({ fecha: dom, titulo: 'Revisión semanal', tipo: 'revision_semanal' })
  }
  return metas
}

/**
 * Dónde está una fecha dentro del ciclo: { dia, faseNumero, terminado, noEmpezado, diaCero, fechaFin }.
 * El Día 0 (calentamiento) es el día anterior al Día 1, si el ciclo lo tiene.
 */
function ubicar(ciclo, fecha) {
  const dia = diaDelCiclo(ciclo.inicio, fecha)
  const esCero = dia === 0 && ciclo.diaCero === fecha
  return {
    dia,
    faseNumero: faseDelDia(Math.min(Math.max(dia, 1), ciclo.duracionDias), ciclo.diasPorFase),
    terminado: dia > ciclo.duracionDias,
    noEmpezado: dia < 1 && !esCero,
    diaCero: esCero,
    fechaFin: fechaDelDiaDelCiclo(ciclo.inicio, ciclo.duracionDias),
    progreso: Math.max(0, Math.min(1, dia / ciclo.duracionDias)),
  }
}

/** Una meta propia de un día que ya pasó sin marcarse se ve como no cumplida. */
function estadoVisible(meta, hoy) {
  if (meta.estado === 'pendiente' && meta.fecha < hoy) return 'no_cumplida'
  return meta.estado
}

/** Pendientes (futuras), vencidas (esperan respuesta), cumplidas y no cumplidas. */
function agruparMetas(metas, hoy) {
  const r = { pendientes: [], vencidas: [], cumplidas: [], noCumplidas: [] }
  for (const m of metas) {
    if (m.estado === 'pendiente') (m.fecha > hoy ? r.pendientes : r.vencidas).push({ ...m, dias: diferenciaDias(hoy, m.fecha) })
    else if (m.estado === 'cumplida') r.cumplidas.push(m)
    else r.noCumplidas.push(m)
  }
  r.cumplidas.sort((a, b) => b.fecha.localeCompare(a.fecha))
  r.noCumplidas.sort((a, b) => b.fecha.localeCompare(a.fecha))
  return r
}

/**
 * Una fase se puede cerrar desde el día siguiente a su último día.
 * La última (que cierra el ciclo) se puede cerrar antes de terminar, como en la app vieja, pero solo estando en ella.
 */
function sePuedeCerrar(fase, dia, esUltima) {
  return esUltima ? dia >= fase.diaInicio : dia > fase.diaFin
}

module.exports = {
  FASES_INICIALES, IDENTIDAD_INICIAL, ATRIBUTOS_INICIALES, XP_META, TOPE_METAS_CON_XP, OBSTACULOS,
  planDeFases, metasAutomaticas, ubicar, estadoVisible, agruparMetas, sePuedeCerrar,
}
