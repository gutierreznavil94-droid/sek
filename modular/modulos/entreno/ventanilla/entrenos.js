'use strict'
/**
 * Entreno · la sesión en curso: series, descansos con sombra, temporizadores, cronómetro (colgarse),
 * terminar con XP extra por mejorar, reabrir, reiniciar y descartar. Más el historial de cada ejercicio.
 *
 * El entreno vive en la base: cerrar la app no lo pierde. El pilar «Entrenamiento» lo marca el módulo
 * dia escuchando los avisos `entreno.empezado`, `entreno.terminado` y `entreno.deshecho`.
 */
const datos = require('../datos')
const calculo = require('../calculo')
const xp = require('../../xp/ventanilla')
const { transaccion } = require('../../../comun/base')
const { anotar } = require('../../../comun/historial')
const { avisar } = require('../../../comun/eventos')
const { ahora } = require('../../../comun/reloj')
const { esFechaValida, diaSemanaDe, lunesDe, sumarDias } = require('../../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../../comun/errores')
const { fechaHoy, aSesion, deSesion, aRutina } = require('./ayuda')
const rutinas = require('./rutinas')

const { seriesDe, bloqueDe } = calculo

const claveXpExtra = (sesionId) => xp.claveXp('entrenamiento', ['extra', sesionId])

async function sesion(usuarioId, id, tx) {
  const s = aSesion(await datos.sesion(usuarioId, id, tx))
  if (!s) throw noEncontrado('Ese entreno')
  return s
}

/** Guarda el entreno. El primer movimiento real (serie, reloj, bloque) fija desde cuándo cuenta la duración. */
async function guardar(usuarioId, s, tx) {
  if (!s.primerMovimiento && s.estado === 'en_curso' && (s.series.length || s.hechos.length || s.saltados.length || s.reloj || (s.tiempos && s.tiempos.length))) {
    s = { ...s, primerMovimiento: Math.min((s.reloj && s.reloj.inicio) || ahora(), ahora()) }
  }
  return aSesion(await datos.guardarSesion(usuarioId, s.id, deSesion(s), tx))
}

/** Lee entreno y rutina, aplica `cambio(s, r)` y guarda. Si la sesión no cambia, la devuelve igual. */
async function cambiar(usuarioId, id, cambio, tx) {
  return transaccion(async (t) => {
    const s = await sesion(usuarioId, id, t)
    const r = await rutinas.obtenerRutina(usuarioId, s.rutinaId, t)
    if (!r) throw noEncontrado('La rutina de este entreno')
    const nueva = cambio(s, r)
    return nueva === s ? s : guardar(usuarioId, nueva, t)
  }, tx)
}

/** El entreno empezado y sin terminar (para volver donde estaba). */
async function sesionEnCurso(usuarioId, tx = null) {
  return aSesion(await datos.enCurso(usuarioId, tx)) || null
}

async function obtenerSesion(usuarioId, id, tx = null) {
  return aSesion(await datos.sesion(usuarioId, id, tx)) || null
}

/** Empieza un entreno (si ya hay uno en curso, devuelve ese). Avisa `entreno.empezado`. */
async function iniciarEntreno(usuarioId, rutinaId, fecha = null, tx = null) {
  return transaccion(async (t) => {
    const enCurso = await sesionEnCurso(usuarioId, t)
    if (enCurso) return enCurso
    const r = await rutinas.obtenerRutina(usuarioId, rutinaId, t)
    if (!r || r.borrada) throw noEncontrado('Esa rutina')
    const f = fecha || (await fechaHoy(usuarioId, t))
    if (!esFechaValida(f)) throw datoInvalido('La fecha no es válida.')
    const t0 = ahora()
    const s = aSesion(await datos.crearSesion(usuarioId, {
      rutinaId, fecha: f, estado: 'en_curso', inicio: t0,
      datos: { inicioQueCuenta: t0, paso: 0, orden: r.bloques.map((b) => b.id), series: [], hechos: [], saltados: [] },
    }, t))
    await anotar(usuarioId, 'entreno', 'empezar', { id: s.id, rutina: rutinaId, fecha: f }, t)
    await avisar('entreno.empezado', { usuarioId, sesionId: s.id, fecha: f, inicio: t0 }, t)
    return s
  }, tx)
}

/** «Serie hecha»: anota la serie y arranca el descanso al instante (las reps reales se corrigen en el descanso). */
async function registrarSerie(usuarioId, id, bloqueId, hecho = {}, tx = null) {
  return cambiar(usuarioId, id, (s, r) => {
    const b = bloqueDe(r, bloqueId)
    if (!b || b.tipo !== 'ejercicio') throw datoInvalido('Ese ejercicio no está en la rutina')
    if (!Number.isFinite(Number(hecho.reps))) throw datoInvalido('Faltan las repeticiones')
    const n = seriesDe(s, bloqueId).length + 1
    const t = ahora()
    const peso = Number.isFinite(hecho.peso) ? hecho.peso : (s.pesos && s.pesos[bloqueId]) ?? b.peso
    const segundos = calculo.duracionSerie(s, t)
    const reps = Math.max(0, Math.round(hecho.reps))
    const extra = hecho.ayuda ?? hecho.repsExtra
    // En los ejercicios con ayuda, el «+N» es ayuda: se guarda aparte (no cuenta para récord).
    const serie = b.admiteAyuda
      ? { bloqueId, n, reps, ayuda: extra || undefined, peso: Math.max(0, peso), instante: t, segundos }
      : { bloqueId, n, reps, repsExtra: hecho.repsExtra || undefined, peso: Math.max(0, peso), instante: t, segundos }
    const nueva = { ...s, pesos: { ...s.pesos, [bloqueId]: peso }, series: [...s.series, serie], reloj: undefined, serieDesde: undefined }
    if (n >= b.series) nueva.paso = calculo.siguientePaso(nueva, r, s.paso)
    const fases = calculo.fasesDescanso(b, n, n >= b.series ? calculo.nombreSiguiente(nueva, r) : undefined)
    nueva.descanso = fases.length ? { inicio: t, fases } : undefined
    return nueva
  }, tx)
}

/** «Peso de hoy» de un ejercicio. */
async function fijarPeso(usuarioId, id, bloqueId, peso, tx = null) {
  if (!Number.isFinite(peso)) throw datoInvalido('El peso tiene que ser un número')
  return cambiar(usuarioId, id, (s) => ({ ...s, pesos: { ...s.pesos, [bloqueId]: Math.max(0, Math.round(peso * 100) / 100) } }), tx)
}

/** Corrige una serie ya anotada. */
async function corregirSerie(usuarioId, id, bloqueId, n, cambios = {}, tx = null) {
  const ent = (v) => Math.max(0, Math.round(v))
  return cambiar(usuarioId, id, (s) => ({
    ...s,
    series: s.series.map((x) => (x.bloqueId === bloqueId && x.n === n
      ? {
        ...x,
        ...(Number.isFinite(cambios.reps) ? { reps: ent(cambios.reps) } : {}),
        ...(Number.isFinite(cambios.repsExtra) ? { repsExtra: ent(cambios.repsExtra) } : {}),
        ...(Number.isFinite(cambios.ayuda) ? { ayuda: ent(cambios.ayuda) || undefined } : {}),
        ...(Number.isFinite(cambios.peso) ? { peso: Math.max(0, cambios.peso) } : {}),
      }
      : x)),
  }), tx)
}

/** Deshace la última serie anotada (y su descanso). */
async function deshacerSerie(usuarioId, id, tx = null) {
  return cambiar(usuarioId, id, (s) => {
    const ultima = s.series[s.series.length - 1]
    if (!ultima) return s
    const i = s.orden.indexOf(ultima.bloqueId)
    return { ...s, series: s.series.slice(0, -1), descanso: undefined, paso: i >= 0 ? i : s.paso }
  }, tx)
}

/** Marca hecho un bloque que no es ejercicio (calentamiento, kick boxing, estirar). */
async function marcarBloque(usuarioId, id, bloqueId, tx = null) {
  return cambiar(usuarioId, id, (s, r) => {
    const nueva = { ...s, hechos: s.hechos.includes(bloqueId) ? s.hechos : [...s.hechos, bloqueId], reloj: undefined, descanso: undefined, serieDesde: ahora() }
    nueva.paso = calculo.siguientePaso(nueva, r, s.paso)
    return nueva
  }, tx)
}

async function saltarBloque(usuarioId, id, bloqueId, tx = null) {
  return cambiar(usuarioId, id, (s, r) => {
    const nueva = { ...s, saltados: s.saltados.includes(bloqueId) ? s.saltados : [...s.saltados, bloqueId], reloj: undefined, descanso: undefined, serieDesde: ahora() }
    nueva.paso = calculo.siguientePaso(nueva, r, s.paso)
    return nueva
  }, tx)
}

/** Ir a un bloque (cambiar el orden sobre la marcha o volver a uno saltado). */
async function irABloque(usuarioId, id, bloqueId, tx = null) {
  return cambiar(usuarioId, id, (s) => {
    const i = s.orden.indexOf(bloqueId)
    if (i < 0) return s
    return { ...s, paso: i, saltados: s.saltados.filter((x) => x !== bloqueId), reloj: undefined, descanso: undefined, serieDesde: ahora() }
  }, tx)
}

/** Mueve un bloque una posición antes (-1) o después (+1) en este entreno. */
async function moverBloque(usuarioId, id, bloqueId, delta, tx = null) {
  return cambiar(usuarioId, id, (s) => {
    const i = s.orden.indexOf(bloqueId)
    const j = i + (delta < 0 ? -1 : 1)
    if (i < 0 || j < 0 || j >= s.orden.length) return s
    const orden = [...s.orden]
    ;[orden[i], orden[j]] = [orden[j], orden[i]]
    const actual = s.orden[s.paso]
    return { ...s, orden, paso: actual ? orden.indexOf(actual) : s.paso }
  }, tx)
}

async function terminarDescanso(usuarioId, id, tx = null) {
  return cambiar(usuarioId, id, (s) => ({ ...s, descanso: undefined, serieDesde: ahora() }), tx)
}

/** Alarga la fase actual del descanso. */
async function alargarDescanso(usuarioId, id, segundos = 30, tx = null) {
  return cambiar(usuarioId, id, (s) => {
    if (!s.descanso) return s
    const f = calculo.faseActual(s.descanso, ahora())
    const ultima = s.descanso.fases.length - 1
    const fases = s.descanso.fases.map((x, i) => ((f && i === f.indice) || (!f && i === ultima) ? { ...x, segundos: x.segundos + segundos } : x))
    return { ...s, descanso: { ...s.descanso, fases } }
  }, tx)
}

/** Arranca el reloj de un bloque (calentamiento, colgarse o rondas). Los que cuentan para abajo traen 5 s de preparación. */
async function iniciarReloj(usuarioId, id, bloqueId, tx = null) {
  return cambiar(usuarioId, id, (s, r) => {
    const b = bloqueDe(r, bloqueId)
    if (!b) throw noEncontrado('Ese bloque')
    const prep = calculo.llevaPreparacion(b) ? calculo.PREPARACION_S * 1000 : 0
    return { ...s, reloj: { bloqueId, ronda: 0, inicio: ahora() + prep, segundos: calculo.segundosReloj(b) }, descanso: undefined }
  }, tx)
}

/** Saltea la preparación de 5 s: el reloj arranca ya. */
async function saltarPreparacion(usuarioId, id, tx = null) {
  return cambiar(usuarioId, id, (s) => {
    if (!s.reloj) return s
    const t = ahora()
    if (s.reloj.inicio > t) return { ...s, reloj: { ...s.reloj, inicio: t } }
    if (t - s.reloj.inicio < calculo.PREPARACION_S * 1000) return { ...s, reloj: { ...s.reloj, inicio: t - calculo.PREPARACION_S * 1000 } }
    return s
  }, tx)
}

async function pararReloj(usuarioId, id, tx = null) {
  return cambiar(usuarioId, id, (s) => ({ ...s, reloj: undefined }), tx)
}

/** Cambia el objetivo de un cronómetro en todas las rutinas que lo tienen (el enlazado y los que se llaman igual, salvo «es otro»). */
async function fijarObjetivoCronometro(usuarioId, nombre, segundos, bloqueId = null, tx = null) {
  const v = Math.max(1, Math.round(segundos))
  const n = calculo.nombreComparable(nombre)
  const es = (b) => b.tipo === 'temporizador' && b.modo === 'cronometro' && (b.id === bloqueId || (!b.separado && calculo.nombreComparable(b.nombre) === n))
  return transaccion(async (t) => {
    for (const r of (await datos.rutinas(usuarioId, t)).map(aRutina)) {
      if (!r.bloques.some(es)) continue
      await datos.ponerRutina(usuarioId, { ...r, bloques: r.bloques.map((b) => (es(b) ? { ...b, segundos: v } : b)) }, t)
    }
    return v
  }, tx)
}

/** «Listo» del cronómetro: guarda el tiempo (con el descuento) y el peso, y pasa al siguiente bloque. Si superó el objetivo, sube 1 s. */
async function terminarCronometro(usuarioId, id, bloqueId, peso = 0, tx = null) {
  return transaccion(async (t) => {
    const s = await sesion(usuarioId, id, t)
    const r = await rutinas.obtenerRutina(usuarioId, s.rutinaId, t)
    const b = r && bloqueDe(r, bloqueId)
    if (!b) throw noEncontrado('Ese bloque')
    const ya = ahora()
    const segundos = s.reloj && s.reloj.bloqueId === bloqueId ? calculo.tiempoFinal(s.reloj.inicio, ya) : 0
    const p = Math.max(0, Number(peso) || 0)
    const tiempo = { bloqueId, nombre: b.nombre, segundos, peso: p, instante: ya }
    const nueva = {
      ...s, tiempos: [...(s.tiempos || []).filter((x) => x.bloqueId !== bloqueId), tiempo], pesos: { ...s.pesos, [bloqueId]: p },
      hechos: s.hechos.includes(bloqueId) ? s.hechos : [...s.hechos, bloqueId], reloj: undefined, descanso: undefined,
    }
    nueva.paso = calculo.siguientePaso(nueva, r, s.paso)
    const pausa = b.tipo === 'temporizador' ? b.descansoDespues ?? 60 : 0
    if (pausa > 0 && nueva.paso < nueva.orden.length) nueva.descanso = { inicio: ya, fases: [{ tipo: 'descanso', segundos: pausa, texto: 'Descanso' }], origen: bloqueId }
    const esCrono = b.tipo === 'temporizador' && b.modo === 'cronometro'
    const antes = esCrono ? b.segundos : 0
    const objetivo = esCrono ? calculo.siguienteObjetivo(antes, segundos) : antes
    if (objetivo !== antes) await fijarObjetivoCronometro(usuarioId, b.nombre, objetivo, b.id, t)
    return { sesion: await guardar(usuarioId, nueva, t), tiempo, objetivo, subio: objetivo > antes }
  }, tx)
}

/** Corrige el tiempo registrado (por si tocó tarde). */
async function corregirTiempo(usuarioId, id, bloqueId, segundos, tx = null) {
  return cambiar(usuarioId, id, (s) => ({ ...s, tiempos: (s.tiempos || []).map((x) => (x.bloqueId === bloqueId ? { ...x, segundos: Math.max(0, Math.round(segundos)) } : x)) }), tx)
}

/** Borra un entreno sin terminar. Avisa `entreno.deshecho`. */
async function descartarEntreno(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const s = await sesion(usuarioId, id, t)
    await xp.anular(usuarioId, claveXpExtra(id), 'Entreno descartado', t)
    await datos.borrarSesion(usuarioId, id, t)
    await anotar(usuarioId, 'entreno', 'descartar', { antes: s }, t)
    await avisar('entreno.deshecho', { usuarioId, sesionId: id, fecha: s.fecha, quedaIniciado: false, motivo: 'Entreno descartado' }, t)
  }, tx)
}

// ---------- Terminar y reabrir ----------

/** Sesiones terminadas de una rutina, más nuevas primero. */
async function terminadasDe(usuarioId, rutinaId, tx) {
  return (await datos.terminadas(usuarioId, rutinaId, tx)).map(aSesion).reverse()
}

/** Lo que hiciste la última vez en ese ejercicio (sin contar la sesión `excepto`). */
async function ultimaVez(usuarioId, rutinaId, bloqueId, excepto = null, tx = null) {
  for (const s of await terminadasDe(usuarioId, rutinaId, tx)) {
    if (s.id === excepto) continue
    const series = seriesDe(s, bloqueId)
    if (series.length) return series
  }
  return []
}

/** Resumen y XP extra de un entreno (sin guardar nada). Compara la serie 1 con las reps actuales y el peso (la base de la sesión o la rutina). */
async function calcularResumen(usuarioId, s, tx = null) {
  const r = await rutinas.obtenerRutina(usuarioId, s.rutinaId, tx)
  const fin = s.fin ?? ahora()
  const previa = (await terminadasDe(usuarioId, s.rutinaId, tx)).find((x) => x.id !== s.id && (x.fin ?? x.inicio) < fin)
  const ejercicios = []
  for (const id of s.orden) {
    const b = r && bloqueDe(r, id)
    const hoy = seriesDe(s, id)
    if (!b || b.tipo !== 'ejercicio' || !hoy.length) continue
    const base = (s.base && s.base[id]) || { reps: b.reps, peso: b.peso }
    ejercicios.push(calculo.resultadoEjercicio(b, hoy, previa ? seriesDe(previa, id) : [], base))
  }
  const xpSinTope = ejercicios.reduce((t, e) => t + e.xp, 0)
  return {
    minutos: Math.max(1, Math.round(calculo.duracionEntreno(s, fin) / 60)),
    series: s.series.length,
    volumen: Math.round(s.series.reduce((t, x) => t + (calculo.totalReps(x) + (x.ayuda ?? 0)) * x.peso, 0)),
    ejercicios,
    xpExtra: Math.min(calculo.TOPE_XP_EXTRA, xpSinTope),
    xpSinTope,
  }
}

/** Hay otro entreno terminado de la misma rutina con fecha posterior. */
async function hayMasNuevo(usuarioId, s, tx) {
  return (await terminadasDe(usuarioId, s.rutinaId, tx)).some((x) => x.id !== s.id && x.fecha > s.fecha)
}

/**
 * Guarda en la rutina lo que dejó el entreno: mismo peso y superó las reps actuales → quedan las nuevas;
 * otro peso → tramo nuevo (peso y reps de la serie 1, desde esa fecha). Solo si es el entreno más reciente.
 */
async function actualizarActuales(usuarioId, s, rutina, tx) {
  if (!rutina || (await hayMasNuevo(usuarioId, s, tx))) return
  let cambio = false
  const bloques = rutina.bloques.map((b) => {
    if (b.tipo !== 'ejercicio') return b
    const s1 = seriesDe(s, b.id).find((x) => x.n === 1)
    if (!s1) return b
    if (s1.peso !== b.peso) { cambio = true; return { ...b, peso: s1.peso, reps: Math.max(1, s1.reps), tramoDesde: s.fecha } }
    if (s1.reps > b.reps) { cambio = true; return { ...b, reps: s1.reps } }
    return b
  })
  if (cambio) await rutinas.ponerRutina(usuarioId, { ...rutina, bloques }, tx)
}

/** Al reabrir o reiniciar, la rutina vuelve a las reps y el peso que tenía antes de ese entreno (si es el más reciente). */
async function restaurarActuales(usuarioId, s, tx) {
  const rutina = await rutinas.obtenerRutina(usuarioId, s.rutinaId, tx)
  if (!rutina || !s.base || (await hayMasNuevo(usuarioId, s, tx))) return
  const bloques = rutina.bloques.map((b) => (b.tipo === 'ejercicio' && s.base[b.id] ? { ...b, reps: s.base[b.id].reps, peso: s.base[b.id].peso, tramoDesde: s.base[b.id].tramoDesde } : b))
  await rutinas.ponerRutina(usuarioId, { ...rutina, bloques }, tx)
}

/** ¿Ese día toca entrenar? (alguna rutina activa lo incluye). Sin rutinas para ese día, el entreno queda sin XP extra. */
async function esDiaDeEntreno(usuarioId, fecha, tx) {
  return (await rutinas.diasDeRutinas(usuarioId, tx)).includes(diaSemanaDe(fecha))
}

/**
 * Termina el entreno: guarda el resumen, actualiza las reps actuales y da el XP extra por mejorar (tope 20,
 * una sola clave por entreno: volver a terminar lo recalcula, no lo suma de nuevo). Avisa `entreno.terminado`
 * (el módulo dia marca el pilar, con la hora de inicio que cuenta para «tarde»).
 * Devuelve { sesion, resumen, xpExtra, motivoSinXp?, nuevoNivel }.
 */
async function terminarEntreno(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await sesion(usuarioId, id, t)
    const rutina = await rutinas.obtenerRutina(usuarioId, antes.rutinaId, t)
    const base = { ...antes.base }
    for (const b of rutina ? rutina.bloques.filter((x) => x.tipo === 'ejercicio') : []) {
      if (!base[b.id] && seriesDe(antes, b.id).length) base[b.id] = { reps: b.reps, peso: b.peso, tramoDesde: b.tramoDesde }
    }
    let s = { ...antes, base, estado: 'terminada', fin: antes.fin ?? ahora(), descanso: undefined, reloj: undefined }
    const resumen = await calcularResumen(usuarioId, s, t)
    const diaDeEntreno = await esDiaDeEntreno(usuarioId, s.fecha, t)
    let motivoSinXp
    let nuevoNivel = null
    await xp.anular(usuarioId, claveXpExtra(id), 'Se recalcula', t)
    if (resumen.xpExtra > 0 && diaDeEntreno) {
      const mejorados = resumen.ejercicios.filter((e) => e.xp > 0).length
      const rx = await xp.sumar(usuarioId, { clave: claveXpExtra(id), cantidad: resumen.xpExtra, origen: 'entrenamiento', fecha: s.fecha, descripcion: `Entreno: ${mejorados} ejercicio${mejorados === 1 ? '' : 's'} mejorado${mejorados === 1 ? '' : 's'}` }, t)
      nuevoNivel = rx.nuevoNivel
      s.xpExtra = resumen.xpExtra
    } else {
      s.xpExtra = 0
      if (!diaDeEntreno) motivoSinXp = 'Hoy no es día de entreno: queda en el historial, sin XP extra'
    }
    s = await guardar(usuarioId, s, t)
    await actualizarActuales(usuarioId, s, rutina, t)
    await anotar(usuarioId, 'entreno', 'terminar', { id, series: s.series.length, xpExtra: s.xpExtra }, t)
    await avisar('entreno.terminado', {
      usuarioId, sesionId: id, rutinaId: s.rutinaId, fecha: s.fecha, inicio: s.inicio, inicioQueCuenta: s.inicioQueCuenta ?? s.inicio, fin: s.fin, minutos: resumen.minutos,
    }, t)
    return { sesion: s, resumen, xpExtra: s.xpExtra, motivoSinXp, nuevoNivel }
  }, tx)
}

/** Vuelve a abrir un entreno terminado (para corregir): quita el XP extra y la rutina vuelve a como estaba. Avisa `entreno.deshecho`. */
async function reabrirEntreno(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const s = await sesion(usuarioId, id, t)
    if (s.estado !== 'terminada') return s
    await xp.anular(usuarioId, claveXpExtra(id), 'Entreno reabierto', t)
    await restaurarActuales(usuarioId, s, t)
    const r = await rutinas.obtenerRutina(usuarioId, s.rutinaId, t)
    const abierta = { ...s, estado: 'en_curso', fin: undefined, xpExtra: undefined }
    if (r) abierta.paso = calculo.siguientePaso(abierta, r, 0)
    const guardada = await guardar(usuarioId, abierta, t)
    await anotar(usuarioId, 'entreno', 'reabrir', { id }, t)
    await avisar('entreno.deshecho', { usuarioId, sesionId: id, fecha: s.fecha, quedaIniciado: true, motivo: 'Entreno reabierto' }, t)
    return guardada
  }, tx)
}

/**
 * Reinicia el entreno desde cero: mismo registro (el XP extra usa la misma clave y no se duplica), sin series,
 * pesos, tiempos ni XP, en el bloque 1. La hora de inicio que cuenta no cambia. Avisa `entreno.deshecho`.
 */
async function reiniciarEntreno(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await sesion(usuarioId, id, t)
    await xp.anular(usuarioId, claveXpExtra(id), 'Entreno reiniciado', t)
    if (antes.estado === 'terminada') await restaurarActuales(usuarioId, antes, t)
    const r = await rutinas.obtenerRutina(usuarioId, antes.rutinaId, t)
    const ya = ahora()
    const nueva = {
      id, rutinaId: antes.rutinaId, fecha: antes.fecha, inicio: ya, inicioQueCuenta: antes.inicioQueCuenta ?? antes.inicio, estado: 'en_curso', paso: 0,
      orden: r ? r.bloques.map((b) => b.id) : antes.orden, series: [], hechos: [], saltados: [],
    }
    const guardada = aSesion(await datos.guardarSesion(usuarioId, id, deSesion(nueva), t))
    await anotar(usuarioId, 'entreno', 'reiniciar', { antes }, t)
    await avisar('entreno.deshecho', { usuarioId, sesionId: id, fecha: antes.fecha, quedaIniciado: true, motivo: 'Entreno reiniciado' }, t)
    return guardada
  }, tx)
}

// ---------- Lo que muestra la pantalla del entreno ----------

/**
 * El entreno con todo lo que la pantalla necesita para cada bloque: la última vez, el peso de hoy,
 * el objetivo de la próxima serie y la sugerencia. Más el descanso y el reloj en marcha.
 */
async function vistaEntreno(usuarioId, id, tx = null) {
  const s = await sesion(usuarioId, id, tx)
  const r = await rutinas.obtenerRutina(usuarioId, s.rutinaId, tx)
  if (!r) throw noEncontrado('La rutina de este entreno')
  const t = ahora()
  const bloques = []
  for (const bid of s.orden) {
    const b = bloqueDe(r, bid)
    if (!b) continue
    const x = { ...b, terminado: calculo.bloqueTerminado(s, b), saltado: s.saltados.includes(b.id), hecho: s.hechos.includes(b.id) }
    if (b.tipo === 'ejercicio') {
      const ultima = await ultimaVez(usuarioId, r.id, b.id, s.id, tx)
      const pesoHoy = (s.pesos && s.pesos[b.id]) ?? calculo.pesoInicial(b, ultima)
      const hechas = seriesDe(s, b.id)
      x.ultimaVez = ultima
      x.pesoHoy = pesoHoy
      x.hechas = hechas
      x.objetivo = hechas.length < b.series ? calculo.objetivoSerie(b, ultima, hechas.length + 1, pesoHoy) : null
      x.sugerencia = calculo.sugerencia(b, ultima)
    }
    if (b.tipo === 'rondas') x.tramos = calculo.tramosRondas(b)
    if (b.tipo === 'temporizador' && b.modo === 'cronometro') x.tiempo = (s.tiempos || []).find((y) => y.bloqueId === b.id) || null
    // Solo del bloque actual (la pantalla lo muestra): récord del ejercicio o la vez pasada del cronómetro.
    if (bid === s.orden[s.paso] && s.estado !== 'terminada') {
      if (b.tipo === 'ejercicio') x.record = (await progresionEjercicio(usuarioId, b.id, tx)).record || null
      if (b.tipo === 'temporizador' && b.modo === 'cronometro') x.historial = await historialTiempo(usuarioId, b.nombre, s.id, tx)
    }
    bloques.push(x)
  }
  return {
    sesion: s,
    rutina: { id: r.id, nombre: r.nombre },
    ahora: t,
    bloques,
    actual: s.paso < s.orden.length ? s.orden[s.paso] : null,
    descanso: s.descanso ? { ...s.descanso, fase: calculo.faseActual(s.descanso, t) } : null,
    minutos: Math.round(calculo.duracionEntreno(s, s.fin ?? t) / 60),
    constantes: { PREPARACION_S: calculo.PREPARACION_S, DESCUENTO_S: calculo.DESCUENTO_S, AVISO_FIN_DESCANSO_S: calculo.AVISO_FIN_DESCANSO_S, PAUSA_MAXIMA_S: calculo.PAUSA_MAXIMA_S, TOPE_XP_EXTRA: calculo.TOPE_XP_EXTRA },
  }
}

// ---------- Historial y estadísticas ----------

/** Progresión de un ejercicio (más viejo primero): cada entreno con su tramo de peso y récords dentro del tramo. */
async function progresionEjercicio(usuarioId, bloqueId, tx = null) {
  const lista = (await datos.terminadas(usuarioId, null, tx)).map(aSesion).filter((s) => s.series.some((x) => x.bloqueId === bloqueId))
  const puntos = []
  const tramos = []
  for (const s of lista) {
    const series = seriesDe(s, bloqueId)
    const s1 = series.find((x) => x.n === 1) || series[0]
    let tr = tramos[tramos.length - 1]
    if (!tr || tr.peso !== s1.peso) {
      tr = { indice: tramos.length, peso: s1.peso, desde: s.fecha, hasta: s.fecha, entrenos: 0, mejorReps: 0 }
      tramos.push(tr)
    }
    const record = tr.entrenos > 0 && s1.reps > tr.mejorReps
    tr.entrenos++
    tr.hasta = s.fecha
    tr.mejorReps = Math.max(tr.mejorReps, s1.reps)
    const conTiempo = series.filter((x) => x.segundos !== undefined && x.segundos !== null)
    const segundos = conTiempo.length ? Math.round(conTiempo.reduce((a, x) => a + x.segundos, 0) / conTiempo.length) : undefined
    puntos.push({ fecha: s.fecha, peso: s1.peso, reps: s1.reps, series, record, tramo: tr.indice, segundos })
  }
  let mejor = null
  for (const p of puntos) { const m = calculo.marcaDe(p.series); if (!mejor || calculo.compararMarcas(m, mejor) > 0) mejor = m }
  return { puntos, tramos, record: mejor }
}

/** Último tiempo y récord de un cronómetro (por nombre: el mismo en todas las rutinas). */
async function historialTiempo(usuarioId, nombre, excepto = null, tx = null) {
  const lista = (await datos.terminadas(usuarioId, null, tx)).map(aSesion)
    .filter((s) => s.id !== excepto)
    .flatMap((s) => (s.tiempos || []).filter((x) => x.nombre === nombre))
    .sort((a, b) => a.instante - b.instante)
  let record = null
  for (const x of lista) if (!record || x.peso > record.peso || (x.peso === record.peso && x.segundos > record.segundos)) record = x
  return { ultimo: lista[lista.length - 1] || null, record }
}

/** Últimos entrenos terminados, con el nombre de la rutina. */
async function historialEntrenos(usuarioId, cantidad = 30, tx = null) {
  const todas = new Map((await rutinas.listarRutinas(usuarioId, { inactivas: true, borradas: true }, tx)).map((r) => [r.id, r]))
  return (await datos.ultimas(usuarioId, cantidad, tx)).map(aSesion).map((s) => {
    const r = todas.get(s.rutinaId)
    const ids = [...new Set(s.series.map((x) => x.bloqueId))]
    return {
      id: s.id, fecha: s.fecha, rutina: (r || {}).nombre || s.rutinaId, series: s.series.length, xpExtra: s.xpExtra || 0,
      minutos: Math.max(1, Math.round(calculo.duracionEntreno(s, s.fin ?? s.inicio) / 60)),
      // Lo hecho, ejercicio por ejercicio (para el historial de entrenos).
      ejercicios: ids.map((id) => ({ bloqueId: id, nombre: ((r && bloqueDe(r, id)) || {}).nombre || id, series: seriesDe(s, id) })),
      tiempos: s.tiempos || [],
    }
  })
}

/**
 * «Fuerza»: entrenos desde `desde`, días programados y hechos, récords (superar las reps del tramo),
 * ejercicios que mejoraron este mes, volumen por semana y la última subida de peso. Para progreso.
 */
async function resumenFuerza(usuarioId, hoy, desde, semanas = 6, tx = null) {
  if (!esFechaValida(hoy) || !esFechaValida(desde)) throw datoInvalido('Las fechas no son válidas.')
  const todas = (await datos.terminadas(usuarioId, null, tx)).map(aSesion)
  const lista = await rutinas.listarRutinas(usuarioId, { inactivas: true, borradas: true }, tx)
  const porId = new Map(lista.map((r) => [r.id, r]))
  const nombre = (s, id) => { const b = porId.get(s.rutinaId) && porId.get(s.rutinaId).bloques.find((x) => x.id === id); return b ? b.nombre : id }
  const records = new Map()
  const mejoraron = new Set()
  const ultimaPorEj = new Map()
  const tramoPorEj = new Map()
  let ultimaSubida = null
  const mes = hoy.slice(0, 7)
  for (const s of todas) {
    for (const id of new Set(s.series.map((x) => x.bloqueId))) {
      const series = seriesDe(s, id)
      const m = calculo.marcaDe(series)
      const s1 = series.find((x) => x.n === 1) || series[0]
      const tr = tramoPorEj.get(id)
      if (tr && tr.peso !== s1.peso) {
        if (s1.peso > tr.peso) ultimaSubida = { nombre: nombre(s, id), de: tr.peso, a: s1.peso, fecha: s.fecha }
        tramoPorEj.set(id, { peso: s1.peso, mejor: s1.reps })
      } else if (tr) {
        if (s1.reps > tr.mejor && s.fecha >= desde) records.set(id, { nombre: nombre(s, id), marca: m, fecha: s.fecha })
        tr.mejor = Math.max(tr.mejor, s1.reps)
      } else tramoPorEj.set(id, { peso: s1.peso, mejor: s1.reps })
      const ultima = ultimaPorEj.get(id)
      if (ultima && calculo.mejoraDe(series, ultima).mejora && s.fecha.slice(0, 7) === mes) mejoraron.add(nombre(s, id))
      ultimaPorEj.set(id, series)
    }
  }
  const diasProgramados = new Set(lista.filter((r) => r.activa && !r.borrada).flatMap((r) => r.dias))
  const hechos = new Set(todas.map((s) => s.fecha))
  const dias = []
  for (let f = desde; f <= hoy && dias.length < 400; f = sumarDias(f, 1)) dias.push({ fecha: f, programado: diasProgramados.has(diaSemanaDe(f)), hecho: hechos.has(f) })
  const lunes = lunesDe(hoy)
  const volumenPorSemana = []
  for (let i = semanas - 1; i >= 0; i--) {
    const d = sumarDias(lunes, -7 * i)
    const h = sumarDias(d, 6)
    const volumen = todas.filter((s) => s.fecha >= d && s.fecha <= h).reduce((t, s) => t + s.series.reduce((u, x) => u + (calculo.totalReps(x) + (x.ayuda ?? 0)) * x.peso, 0), 0)
    volumenPorSemana.push({ semana: d, volumen: Math.round(volumen) })
  }
  return {
    entrenos: todas.filter((s) => s.fecha >= desde).length,
    programados: dias.filter((d) => d.programado).length,
    dias,
    records: [...records.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    mejoraronEsteMes: [...mejoraron],
    volumenPorSemana,
    ultimaSubida,
    ejercicios: lista.filter((r) => r.activa && !r.borrada).flatMap((r) => r.bloques.filter((b) => b.tipo === 'ejercicio').map((b) => ({ id: b.id, nombre: b.nombre, rutina: r.nombre }))),
  }
}

/** Entrenos de un día (para la tarjeta de Hoy y el pilar). */
async function entrenosDelDia(usuarioId, fecha, tx = null) {
  return (await datos.delDia(usuarioId, fecha, tx)).map(aSesion)
}

module.exports = {
  claveXpExtra, sesionEnCurso, obtenerSesion, iniciarEntreno, registrarSerie, fijarPeso, corregirSerie, deshacerSerie,
  marcarBloque, saltarBloque, irABloque, moverBloque, terminarDescanso, alargarDescanso, iniciarReloj, saltarPreparacion, pararReloj,
  fijarObjetivoCronometro, terminarCronometro, corregirTiempo, descartarEntreno,
  ultimaVez, calcularResumen, terminarEntreno, reabrirEntreno, reiniciarEntreno, vistaEntreno,
  progresionEjercicio, historialTiempo, historialEntrenos, resumenFuerza, entrenosDelDia,
}
