'use strict'
/**
 * Juego · la única puerta del módulo.
 * Temporizador de juego: empezar, pausar, seguir, terminar; límites de semana y finde; resumen de hoy y de la semana.
 * La sesión activa vive en la base: cerrar la app no la pierde. Las cuentas están en calculo.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const calculo = require('./calculo')
const { obtenerAjustes } = require('../../comun/ajustes')
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

async function borrar(usuarioId, id, motivo = '', tx = null) {
  const antes = await datos.porId(usuarioId, id, tx)
  if (!antes) throw noEncontrado('Esa sesión')
  await datos.borrar(usuarioId, id, tx)
  await anotar(usuarioId, 'juego', 'borrar', { antes: sinId(antes), motivo }, tx)
}

/** Límite de un día: finde (sábado y domingo) o semana. Los feriados se sumarán cuando exista el módulo que los tenga. */
function limiteDelDia(ajustes, fecha) {
  const ds = diaSemanaDe(fecha)
  return ds === 0 || ds === 6 ? ajustes.limiteJuegoFinde : ajustes.limiteJuegoSemana
}

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
  const limite = limiteDelDia(a, fecha)
  return { minutos, limite, respetado: minutos <= limite }
}

/** Todo lo que muestra la pantalla de Juego (y la tarjeta de Hoy). */
async function resumen(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const t = ahora()
  const hoy = fechaDe(t, a.zonaHoraria)
  const lunes = lunesDe(hoy)
  const desde = inicioDelDia(lunes, a.zonaHoraria)
  const sesiones = (await datos.entre(usuarioId, desde, t + 1, tx)).map(sinId)
  const porDia = calculo.minutosPorDia(sesiones, t, a.zonaHoraria)
  const semana = []
  let minutosSemana = 0
  let limiteSemana = 0
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i)
    const minutos = Math.round(porDia.get(f) || 0)
    const limite = limiteDelDia(a, f)
    semana.push({ fecha: f, minutos, limite })
    minutosSemana += minutos
    limiteSemana += limite
  }
  const activa = await sesionActiva(usuarioId, tx)
  const minutosHoy = Math.round(porDia.get(hoy) || 0)
  const limiteHoy = limiteDelDia(a, hoy)
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
  }
}

async function historial(usuarioId, cantidad = 30, tx = null) {
  return (await datos.ultimas(usuarioId, cantidad, tx)).map(sinId)
}

/**
 * Trae las sesiones de una copia de la app vieja (tabla `sesionesJuego` de «Copiar todo como texto»).
 * Lo llama el módulo de copia. Devuelve cuántas entraron.
 */
async function importar(usuarioId, sesionesViejas, tx = null) {
  let n = 0
  for (const s of sesionesViejas || []) {
    if (!Number.isFinite(s.inicio)) continue
    await datos.crear(usuarioId, { inicio: s.inicio, fin: s.fin ?? null, pausas: Array.isArray(s.pausas) ? s.pausas : [], nota: s.nota ?? null }, tx)
    n++
  }
  return n
}

module.exports = { sesionActiva, empezar, pausar, seguir, terminar, agregarManual, borrar, minutosDelDia, limiteRespetado, resumen, historial, importar }
