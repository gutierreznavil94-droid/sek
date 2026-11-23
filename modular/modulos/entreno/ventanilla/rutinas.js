'use strict'
/**
 * Entreno · rutinas: listar, crear, guardar (con guardado automático desde la pantalla), borrar,
 * planes para empezar y ejercicios enlazados entre rutinas.
 *
 * Un ejercicio enlazado es el MISMO bloque (mismo id) en varias rutinas: el historial, los récords y la
 * progresión se buscan por id, así que salen juntos solos. Lo que cambia en una (peso, reps, descanso…)
 * se copia a las otras; solo el lugar en el orden es de cada rutina.
 */
const datos = require('../datos')
const calculo = require('../calculo')
const planes = require('../planes')
const { transaccion } = require('../../../comun/base')
const { anotar } = require('../../../comun/historial')
const { ahora } = require('../../../comun/reloj')
const { diaSemanaDe, esFechaValida } = require('../../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../../comun/errores')
const { fechaHoy, aRutina, nuevoId } = require('./ayuda')

/** Rutinas en orden. Las pausadas solo con `inactivas`; las borradas solo con `borradas` (para el historial). */
async function listarRutinas(usuarioId, { inactivas = false, borradas = false } = {}, tx = null) {
  const todas = (await datos.rutinas(usuarioId, tx)).map(aRutina).filter((r) => borradas || !r.borrada)
  return inactivas ? todas : todas.filter((r) => r.activa && !r.borrada)
}

async function obtenerRutina(usuarioId, id, tx = null) {
  return aRutina(await datos.rutina(usuarioId, id, tx))
}

/** Guarda una rutina y copia sus bloques enlazados (ejercicios y temporizadores) a las otras rutinas que los tienen. */
async function ponerRutina(usuarioId, r, tx) {
  const guardada = aRutina(await datos.ponerRutina(usuarioId, r, tx))
  const mios = new Map(r.bloques.filter((b) => b.tipo === 'ejercicio' || b.tipo === 'temporizador').map((b) => [b.id, b]))
  if (!mios.size) return guardada
  for (const otra of (await datos.rutinas(usuarioId, tx)).map(aRutina)) {
    if (otra.id === r.id || otra.borrada) continue
    let cambio = false
    const bloques = otra.bloques.map((b) => {
      const m = mios.get(b.id)
      if (!m || m.tipo !== b.tipo || JSON.stringify(m) === JSON.stringify(b)) return b
      cambio = true
      return m
    })
    if (cambio) await datos.ponerRutina(usuarioId, { ...otra, bloques }, tx)
  }
  return guardada
}

/** Limpia lo que llega de la pantalla: solo los campos conocidos y números donde van números. */
function limpiarRutina(r, antes) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
  return {
    id: antes ? antes.id : r.id,
    nombre: String(r.nombre || '').trim(),
    dias: Array.isArray(r.dias) ? [...new Set(r.dias.map(Number))].filter((d) => Number.isInteger(d)) : antes ? antes.dias : [],
    bloques: Array.isArray(r.bloques) ? r.bloques.map((b) => {
      const x = { ...b }
      for (const k of ['series', 'reps', 'repsExtra', 'repsTope', 'peso', 'descanso', 'sombra', 'segundos', 'veces', 'descansoEntre', 'descansoDespues']) if (x[k] !== undefined && x[k] !== null && x[k] !== '') x[k] = num(x[k])
      return x
    }) : antes ? antes.bloques : [],
    minutos: r.minutos !== undefined ? num(r.minutos, 30) : antes ? antes.minutos : 30,
    orden: antes ? antes.orden : num(r.orden, 0),
    activa: r.activa !== undefined ? !!r.activa : antes ? antes.activa : true,
    borrada: antes ? antes.borrada : false,
    creado: antes ? antes.creado : ahora(),
  }
}

/**
 * Guarda una rutina (crear o editar). Cambiar el peso de un ejercicio a mano empieza un tramo nuevo
 * (se guarda desde cuándo). Los bloques enlazados se copian a las otras rutinas.
 */
async function guardarRutina(usuarioId, r, tx = null) {
  return transaccion(async (t) => {
    const antes = r && r.id ? await obtenerRutina(usuarioId, r.id, t) : null
    if (r && !r.id) r = { ...r, id: nuevoId('rutina') }
    const limpia = limpiarRutina(r || {}, antes)
    const errores = calculo.erroresRutina(limpia)
    if (errores.length) throw datoInvalido(errores.join('. '))
    if (!antes) limpia.orden = Math.max(0, ...(await datos.rutinas(usuarioId, t)).map((x) => x.orden)) + 1
    const hoy = await fechaHoy(usuarioId, t)
    limpia.bloques = limpia.bloques.map((b) => {
      if (b.tipo !== 'ejercicio') return b
      const a = antes && antes.bloques.find((x) => x.id === b.id)
      return !a || a.tipo !== 'ejercicio' || a.peso === b.peso ? b : { ...b, tramoDesde: hoy }
    })
    const guardada = await ponerRutina(usuarioId, limpia, t)
    await anotar(usuarioId, 'entreno', antes ? 'editar_rutina' : 'crear_rutina', { id: limpia.id, nombre: limpia.nombre }, t)
    return guardada
  }, tx)
}

/** Suma una rutina vacía al final de la lista (se arma en el editor). */
async function crearRutina(usuarioId, { nombre = 'Nueva rutina', dias = [] } = {}, tx = null) {
  return transaccion(async (t) => {
    const orden = Math.max(0, ...(await datos.rutinas(usuarioId, t)).map((x) => x.orden)) + 1
    const r = { id: nuevoId('rutina'), nombre: String(nombre).trim() || 'Nueva rutina', dias: [...dias], bloques: [], minutos: 30, orden, activa: true, creado: ahora() }
    const hecha = aRutina(await datos.ponerRutina(usuarioId, r, t))
    await anotar(usuarioId, 'entreno', 'crear_rutina', { id: r.id, nombre: r.nombre }, t)
    return hecha
  }, tx)
}

/** Borra una rutina. Si tiene entrenos guardados queda marcada como borrada (el historial la sigue mostrando). */
async function borrarRutina(usuarioId, id, motivo = 'Mis rutinas: borrar', tx = null) {
  return transaccion(async (t) => {
    const r = await obtenerRutina(usuarioId, id, t)
    if (!r) throw noEncontrado('Esa rutina')
    const conEntrenos = (await datos.cuantasDeRutina(usuarioId, id, t)) > 0
    if (conEntrenos) await datos.ponerRutina(usuarioId, { ...r, borrada: true, activa: false }, t)
    else await datos.borrarRutina(usuarioId, id, t)
    await anotar(usuarioId, 'entreno', 'borrar_rutina', { antes: r, motivo }, t)
    return conEntrenos ? 'guardada para el historial' : 'eliminada'
  }, tx)
}

/** Cambia el orden de las rutinas (lista de ids en el orden nuevo). */
async function ordenarRutinas(usuarioId, ids, tx = null) {
  return transaccion(async (t) => {
    const todas = (await datos.rutinas(usuarioId, t)).map(aRutina)
    let n = 0
    for (const id of ids || []) {
      const r = todas.find((x) => x.id === id)
      if (r) await datos.ponerRutina(usuarioId, { ...r, orden: ++n }, t)
    }
    return listarRutinas(usuarioId, { inactivas: true }, t)
  }, tx)
}

// ---------- Enlazados ----------

/** En qué rutinas (activas o pausadas, no borradas) está un bloque. */
async function rutinasConBloque(usuarioId, bloqueId, tx = null) {
  return (await listarRutinas(usuarioId, { inactivas: true }, tx)).filter((r) => r.bloques.some((b) => b.id === bloqueId))
}

/** Un ejercicio de OTRA rutina con el mismo nombre y tipo, todavía sin enlazar (para preguntar «¿Es el mismo?»). */
async function mismoNombreEnOtraRutina(usuarioId, rutinaId, b, tx = null) {
  if (!b || (b.tipo !== 'ejercicio' && b.tipo !== 'temporizador') || b.separado) return null
  const n = calculo.nombreComparable(b.nombre)
  if (!n) return null
  for (const r of await listarRutinas(usuarioId, { inactivas: true }, tx)) {
    if (r.id === rutinaId) continue
    const otro = r.bloques.find((x) => x.tipo === b.tipo && x.id !== b.id && !x.separado && calculo.nombreComparable(x.nombre) === n)
    if (otro) return { rutina: { id: r.id, nombre: r.nombre }, bloque: otro }
  }
  return null
}

/** «Sumar a otra rutina»: copia el bloque (mismo id, queda enlazado) a las rutinas elegidas. Devuelve a cuántas. */
async function sumarBloqueARutinas(usuarioId, origenId, bloqueId, destinos, tx = null) {
  return transaccion(async (t) => {
    const origen = await obtenerRutina(usuarioId, origenId, t)
    const b = origen && origen.bloques.find((x) => x.id === bloqueId)
    if (!b) throw datoInvalido('Guardá la rutina antes de sumar el ejercicio')
    let n = 0
    for (const id of destinos || []) {
      const r = await obtenerRutina(usuarioId, id, t)
      if (!r || r.borrada || r.bloques.some((x) => x.id === bloqueId)) continue
      const bloques = [...r.bloques]
      bloques.splice(calculo.lugarEnRutina(origen, bloqueId, r), 0, b)
      await datos.ponerRutina(usuarioId, { ...r, bloques }, t)
      await anotar(usuarioId, 'entreno', 'enlazar', { rutina: r.id, bloque: bloqueId, con: origen.id }, t)
      n++
    }
    return n
  }, tx)
}

/**
 * «¿Es el mismo?» → Sí: el bloque de esta rutina pasa a usar el id del de la otra (quedan enlazados; los
 * valores de la otra mandan). No: queda marcado «separado» y no se vuelve a preguntar.
 */
async function responderEsElMismo(usuarioId, rutinaId, bloqueId, otroBloqueId, esElMismo, tx = null) {
  return transaccion(async (t) => {
    const r = await obtenerRutina(usuarioId, rutinaId, t)
    const b = r && r.bloques.find((x) => x.id === bloqueId)
    if (!b) throw noEncontrado('Ese ejercicio')
    let bloques
    if (esElMismo) {
      const otra = (await rutinasConBloque(usuarioId, otroBloqueId, t))[0]
      const otro = otra && otra.bloques.find((x) => x.id === otroBloqueId)
      if (!otro) throw noEncontrado('El otro ejercicio')
      bloques = r.bloques.map((x) => (x.id === bloqueId ? otro : x))
    } else {
      bloques = r.bloques.map((x) => (x.id === bloqueId ? { ...x, separado: true } : x))
    }
    await datos.ponerRutina(usuarioId, { ...r, bloques }, t)
    await anotar(usuarioId, 'entreno', esElMismo ? 'enlazar' : 'separar', { rutina: rutinaId, bloque: bloqueId, otro: otroBloqueId }, t)
    return obtenerRutina(usuarioId, rutinaId, t)
  }, tx)
}

// ---------- Días y planes ----------

/** Días de todas las rutinas activas, de lunes a domingo. Para el pilar Entrenar (módulo dia). */
async function diasDeRutinas(usuarioId, tx = null) {
  return calculo.ordenLunes((await listarRutinas(usuarioId, {}, tx)).flatMap((r) => r.dias))
}

/** La rutina que toca ese día (la primera activa que incluye el día de la semana). */
async function rutinaDelDia(usuarioId, fecha, tx = null) {
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  const ds = diaSemanaDe(fecha)
  return (await listarRutinas(usuarioId, {}, tx)).find((r) => r.dias.includes(ds)) || null
}

/**
 * Carga las rutinas de una elección (plan completo, de a poco o desde cero).
 * - `reemplazar`: las actuales se borran (las que tienen entrenos quedan para el historial).
 * - si no: se agregan al final; las que ya estaban no se repiten. Una del plan que estaba borrada vuelve.
 * `diasPilar`: los días para «de a poco» (si no vienen, lunes, miércoles y viernes).
 */
async function aplicarEleccion(usuarioId, eleccion, { reemplazar = false, diasPilar } = {}, tx = null) {
  const nuevas = planes.rutinasDeEleccion(eleccion, diasPilar && diasPilar.length ? diasPilar : [1, 3, 5])
  if (!nuevas) throw noEncontrado('Ese plan')
  return transaccion(async (t) => {
    const ids = new Set(nuevas.map((r) => r.id))
    let borradas = 0
    if (reemplazar) {
      for (const r of await listarRutinas(usuarioId, { inactivas: true }, t)) {
        if (ids.has(r.id)) continue
        await borrarRutina(usuarioId, r.id, 'Mis rutinas: elegir cómo empezar', t)
        borradas++
      }
    }
    const actuales = new Map((await datos.rutinas(usuarioId, t)).map((f) => [f.id, aRutina(f)]))
    let orden = reemplazar ? 0 : Math.max(0, ...[...actuales.values()].filter((r) => !r.borrada).map((r) => r.orden))
    let cargadas = 0
    for (const r of nuevas) {
      const antes = actuales.get(r.id)
      if (!reemplazar && antes && !antes.borrada) continue
      await datos.ponerRutina(usuarioId, { ...r, orden: ++orden, activa: true, borrada: false, creado: antes ? antes.creado : ahora() }, t)
      cargadas++
    }
    await anotar(usuarioId, 'entreno', 'elegir_plan', { eleccion, reemplazar, cargadas, borradas }, t)
    return { cargadas, borradas }
  }, tx)
}

module.exports = {
  listarRutinas, obtenerRutina, guardarRutina, crearRutina, borrarRutina, ordenarRutinas, ponerRutina,
  rutinasConBloque, mismoNombreEnOtraRutina, sumarBloqueARutinas, responderEsElMismo,
  diasDeRutinas, rutinaDelDia, aplicarEleccion,
  planes: planes.listaPlanes, ideasDeAPoco: () => [...planes.IDEAS_DE_A_POCO],
}
