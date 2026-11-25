'use strict'
/**
 * Juego · la única puerta del módulo.
 * Temporizador de juego: empezar, pausar, seguir, terminar; límites de semana y finde; resumen de hoy y de la semana.
 * La sesión activa vive en la base: cerrar la app no la pierde. Las cuentas están en calculo.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const calculo = require('./calculo')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { fechaDe, inicioDelDia, sumarDias, lunesDe, diaSemanaDe } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const sinId = (s) => s && { id: s.id, inicio: s.inicio, fin: s.fin ?? undefined, pausas: s.pausas || [], nota: s.nota ?? undefined }

async function sesionActiva(usuarioId, tx = null) {
  return sinId(await datos.activa(usuarioId, tx))
}

async function empezar(usuarioId, tx = null) {
  const ya = await sesionActiva(usuarioId, tx)
  if (ya) return ya
  const s = sinId(await datos.crear(usuarioId, { inicio: ahora() }, tx))
  await anotar(usuarioId, 'juego', 'empezar', { id: s.id }, tx)
  return s
}

async function pausar(usuarioId, tx = null) {
  const s = await sesionActiva(usuarioId, tx)
  if (!s || calculo.estaPausada(s)) return s
  return sinId(await datos.actualizar(usuarioId, s.id, { pausas: [...s.pausas, { desde: ahora() }] }, tx))
}

async function seguir(usuarioId, tx = null) {
  const s = await sesionActiva(usuarioId, tx)
  if (!s || !calculo.estaPausada(s)) return s
  const t = ahora()
  const pausas = s.pausas.map((p, i) => (i === s.pausas.length - 1 ? { ...p, hasta: t } : p))
  return sinId(await datos.actualizar(usuarioId, s.id, { pausas }, tx))
}

/** Termina la sesión activa. Avisa 'juego.terminado' con los minutos jugados. */
async function terminar(usuarioId, nota = null, tx = null) {
  const s = await sesionActiva(usuarioId, tx)
  if (!s) return null
  const t = ahora()
  const pausas = s.pausas.map((p) => (p.hasta === undefined ? { ...p, hasta: t } : p))
  const final = sinId(await datos.actualizar(usuarioId, s.id, { pausas, fin: t, nota }, tx))
  const minutos = calculo.duracionMs(final, t) / 60000
  await anotar(usuarioId, 'juego', 'terminar', { id: s.id, minutos: Math.round(minutos) }, tx)
  await avisar('juego.terminado', { usuarioId, sesion: final, minutos }, tx)
  return final
}

/** Suma una sesión pasada a mano («me olvidé de anotar»). */
async function agregarManual(usuarioId, { inicio, fin, nota }, tx = null) {
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) throw datoInvalido('El fin tiene que ser después del inicio.')
  if (fin > ahora()) throw datoInvalido('No se puede anotar juego en el futuro.')
  const s = sinId(await datos.crear(usuarioId, { inicio, fin, nota: nota || 'Agregada a mano' }, tx))
  await anotar(usuarioId, 'juego', 'agregar', { id: s.id, inicio, fin }, tx)
  return s
}

/** Corrige el inicio y el fin de una sesión terminada. El motivo queda en la nota y en el historial. */
async function corregir(usuarioId, id, { inicio, fin, motivo }, tx = null) {
  const antes = await datos.porId(usuarioId, id, tx)
  if (!antes) throw noEncontrado('Esa sesión')
  if (antes.fin == null) throw datoInvalido('La sesión todavía está corriendo: terminala antes de corregirla.')
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) throw datoInvalido('El fin tiene que ser después del inicio.')
  if (fin - inicio > 16 * 3600000) throw datoInvalido('Una sesión no puede durar más de 16 horas.')
  if (fin > ahora()) throw datoInvalido('No se puede anotar juego en el futuro.')
  if (!String(motivo || '').trim()) throw datoInvalido('Escribí el motivo: queda en el historial.')
  const s = sinId(await datos.actualizar(usuarioId, id, { inicio, fin, pausas: [], nota: `corregida · ${String(motivo).trim()}` }, tx))
  await anotar(usuarioId, 'juego', 'corregir', { antes: sinId(antes), inicio, fin, motivo }, tx)
  return s
}

async function borrar(usuarioId, id, motivo = '', tx = null) {
  const antes = await datos.porId(usuarioId, id, tx)
  if (!antes) throw noEncontrado('Esa sesión')
  await datos.borrar(usuarioId, id, tx)
  await anotar(usuarioId, 'juego', 'borrar', { antes: sinId(antes), motivo }, tx)
}

/**
 * Feriados: los tiene el módulo dia, que ya usa juego (no se puede requerir al revés). app.js le conecta
 * `esFeriado(usuarioId, fecha, tx)` con `conectar`; sin eso, solo sábado y domingo son finde.
 */
let esFeriado = null
function conectar({ esFeriado: fn } = {}) { if (fn === null || typeof fn === 'function') esFeriado = fn }

/** Límite de un día: finde (sábado, domingo y feriado) o semana. */
function limiteDelDia(ajustes, fecha, feriado = false) {
  const ds = diaSemanaDe(fecha)
  return ds === 0 || ds === 6 || feriado ? ajustes.limiteJuegoFinde : ajustes.limiteJuegoSemana
}
const feriadoDe = async (usuarioId, fecha, tx) => (esFeriado ? !!(await esFeriado(usuarioId, fecha, tx)) : false)

/** Minutos jugados en una fecha (AAAA-MM-DD). Lo usa el módulo que evalúe el pilar «límite de juego». */
async function minutosDelDia(usuarioId, fecha, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const desde = inicioDelDia(fecha, a.zonaHoraria)
  const hasta = inicioDelDia(sumarDias(fecha, 1), a.zonaHoraria)
  const sesiones = (await datos.entre(usuarioId, desde, hasta, tx)).map(sinId)
  return Math.round(calculo.minutosDelDia(sesiones, fecha, ahora(), a.zonaHoraria))
}

/** ¿Respetó el límite ese día? { minutos, limite, respetado }. */
async function limiteRespetado(usuarioId, fecha, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const minutos = await minutosDelDia(usuarioId, fecha, tx)
  const limite = limiteDelDia(a, fecha, await feriadoDe(usuarioId, fecha, tx))
  return { minutos, limite, respetado: minutos <= limite }
}

/** Todo lo que muestra la pantalla de Juego (y la tarjeta de Hoy). */
async function resumen(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const t = ahora()
  const hoy = fechaDe(t, a.zonaHoraria)
  const lunes = lunesDe(hoy)
  const hace6 = sumarDias(hoy, -6)
  const desde = inicioDelDia(hace6 < lunes ? hace6 : lunes, a.zonaHoraria)
  const sesiones = (await datos.entre(usuarioId, desde, t + 1, tx)).map(sinId)
  const porDia = calculo.minutosPorDia(sesiones, t, a.zonaHoraria)
  const semana = []
  let minutosSemana = 0
  let limiteSemana = 0
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i)
    const minutos = Math.round(porDia.get(f) || 0)
    const limite = limiteDelDia(a, f, await feriadoDe(usuarioId, f, tx))
    semana.push({ fecha: f, minutos, limite })
    minutosSemana += minutos
    limiteSemana += limite
  }
  // Los últimos 7 días (hoy incluido), para las barritas de la pantalla.
  const ultimos7 = []
  for (let i = 6; i >= 0; i--) {
    const f = sumarDias(hoy, -i)
    ultimos7.push({ fecha: f, minutos: Math.round(porDia.get(f) || 0), limite: limiteDelDia(a, f, await feriadoDe(usuarioId, f, tx)) })
  }
  const activa = await sesionActiva(usuarioId, tx)
  const minutosHoy = Math.round(porDia.get(hoy) || 0)
  const limiteHoy = limiteDelDia(a, hoy, await feriadoDe(usuarioId, hoy, tx))
  return {
    hoy,
    activa: activa || null,
    pausada: activa ? calculo.estaPausada(activa) : false,
    minutosSesion: activa ? calculo.duracionMs(activa, t) / 60000 : 0,
    minutosHoy,
    limiteHoy,
    estado: calculo.estadoLimite(minutosHoy, limiteHoy, a.avisoJuegoPorcentaje),
    minutosSemana,
    limiteSemana,
    semana,
    ultimos7,
    limiteSemanaDia: a.limiteJuegoSemana,
    limiteFinde: a.limiteJuegoFinde,
    avisoPorcentaje: a.avisoJuegoPorcentaje,
    zonaHoraria: a.zonaHoraria,
  }
}

async function historial(usuarioId, cantidad = 30, tx = null) {
  return (await datos.ultimas(usuarioId, cantidad, tx)).map(sinId)
}

/**
 * Trae las sesiones de una copia de la app vieja (tabla `sesionesJuego` de «Copiar todo como texto»).
 * Lo llama el módulo de copia. Una sesión con el mismo inicio que otra ya cargada no entra. Devuelve cuántas entraron.
 */
async function importar(usuarioId, sesionesViejas, tx = null) {
  let n = 0
  for (const s of sesionesViejas || []) {
    if (!s || !Number.isFinite(s.inicio)) continue
    if (await datos.porInicio(usuarioId, s.inicio, tx)) continue
    await datos.crear(usuarioId, { inicio: s.inicio, fin: s.fin ?? null, pausas: Array.isArray(s.pausas) ? s.pausas : [], nota: s.nota ?? null }, tx)
    n++
  }
  return n
}

/** Todas las sesiones, con la misma forma que recibe `importar` (lo usa el módulo copia). */
async function exportar(usuarioId, tx = null) {
  return (await datos.todasLasSesiones(usuarioId, tx)).map(({ id, ...s }) => s)
}

/** «Apps que te atrapan»: lo guardado (Android lo vigila; acá solo se guarda). */
async function vigia(usuarioId, tx = null) {
  return (await obtenerAjustes(usuarioId, tx)).vigia
}

async function guardarVigia(usuarioId, { activo, repetir, apps }, tx = null) {
  const limpio = {
    activo: !!activo,
    repetir: [5, 10, 15, 30].includes(repetir) ? repetir : 15,
    apps: (apps || []).slice(0, 60).map((a) => ({
      paquete: String(a.paquete).slice(0, 200),
      nombre: String(a.nombre || a.paquete).slice(0, 80),
      minutos: Math.min(600, Math.max(1, Math.round(Number(a.minutos) || 30))),
    })),
  }
  return (await guardarAjustes(usuarioId, { vigia: limpio }, tx)).vigia
}

module.exports = { vigia, guardarVigia, conectar, exportar, sesionActiva, empezar, pausar, seguir, terminar, agregarManual, corregir, borrar, minutosDelDia, limiteRespetado, resumen, historial, importar }
