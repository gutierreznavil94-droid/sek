'use strict'
/**
 * Sueño · la única puerta del módulo.
 * «Dejo celu» (dormir a horario, da XP una sola vez), la noche que se registra sola (estimada) y se corrige a mano,
 * el modo sueño (pantalla casi negra hasta la hora de fin), la adaptación por etapas y el resumen de las noches.
 * Las cuentas puras están en calculo.js. Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { transaccion } = require('../../comun/base')
const { fechaDe, instanteDe, sumarDias, nocheDeSuenio, retrasoAcostarse, esHoraValida, esFechaValida, formatoHora } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const HORAS = 60 * calculo.MINUTO
const claveDejoCelu = (noche) => xp.claveXp('suenio', ['acostarse', noche])

/** La noche a la que pertenece un instante (entre las 00:00 y la hora de corte es la noche anterior). */
async function nocheDe(usuarioId, instante = ahora(), tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  return nocheDeSuenio(instante, a.zonaHoraria, a.horaCorteNoche)
}

// ---------- Dejo celu ----------

/**
 * «Dejo celu»: registra la hora real de dejar el celular. Pertenece a la noche planificada aunque sea después de las 00:00.
 * Hasta la hora prevista: cumplido y da su XP (una sola vez). Después: tarde, sin XP. Después de la hora límite (22:15)
 * ya no se registra. Prende el modo sueño (salvo `modo: false`). Avisa `sueno.dejo_celu`.
 * `resumen`: la línea de «Buenas noches» (la arma el módulo dia con los pilares; si no viene, una con la racha).
 */
async function dejoCelu(usuarioId, { instante = ahora(), nota = null, resumen = null, modo = true } = {}, tx = null) {
  return transaccion(async (t) => {
    const a = await obtenerAjustes(usuarioId, t)
    const z = a.zonaHoraria
    const noche = nocheDeSuenio(instante, z, a.horaCorteNoche)
    if (instante > instanteDe(noche, a.horaLimiteCelu, z)) throw datoInvalido(`Pasaron las ${a.horaLimiteCelu}: «Dejo celu» ya no se registra. La noche queda sin cumplir.`)
    const horaPrevista = a.horaDejarCelu
    const retraso = retrasoAcostarse(noche, horaPrevista, instante, z)
    const cumplido = retraso <= 0
    const previo = await datos.deNoche(usuarioId, noche, t)
    const registro = await datos.guardar(usuarioId, { noche, horaPrevista, horaReal: instante, retrasoMinutos: Math.max(0, retraso), cumplido, nota: nota || undefined, creado: ahora() }, t)
    await anotar(usuarioId, 'sueno', previo ? 'corregir' : 'dejo_celu', { noche, antes: previo || undefined, cumplido, retrasoMinutos: Math.max(0, retraso) }, t)
    let ganado = { concedido: false, cantidad: 0, nuevoNivel: null }
    if (cumplido) ganado = await xp.sumar(usuarioId, { clave: claveDejoCelu(noche), cantidad: a.xpDejoCelu, origen: 'suenio', fecha: noche, descripcion: 'Dejo celu a horario' }, t)
    else await xp.anular(usuarioId, claveDejoCelu(noche), 'Dejó el celu después de la hora límite', t)
    await avisar('sueno.dejo_celu', { usuarioId, noche, cumplido, retrasoMinutos: Math.max(0, retraso), instante }, t)
    let estadoModo = null
    if (modo) estadoModo = await entrarModo(usuarioId, { noche, tarde: !cumplido, instante, resumen }, t)
    return { registro, noche, cumplido, retrasoMinutos: Math.max(0, retraso), xp: ganado.cantidad, nuevoNivel: ganado.nuevoNivel, modo: estadoModo }
  }, tx)
}

/** Deshace «Dejo celu» de una noche: borra el registro, anula el XP y apaga el modo sueño de esa noche. Queda en el historial. */
async function deshacerDejoCelu(usuarioId, noche, motivo = 'Deshacer «Dejo celu»', tx = null) {
  return transaccion(async (t) => {
    const previo = await datos.deNoche(usuarioId, noche, t)
    await xp.anular(usuarioId, claveDejoCelu(noche), motivo, t)
    if (previo) {
      await datos.borrar(usuarioId, noche, t)
      await anotar(usuarioId, 'sueno', 'deshacer', { noche, antes: previo, motivo }, t)
    }
    const m = await datos.modo(usuarioId, t)
    if (m && m.noche === noche) await datos.quitarModo(usuarioId, t)
    await avisar('sueno.dejo_celu.deshecho', { usuarioId, noche }, t)
    return !!previo
  }, tx)
}

/** Para el pilar «Dormir a horario» del módulo dia: { registrado, cumplido, retrasoMinutos }. */
async function dormirAHorario(usuarioId, noche, tx = null) {
  const r = await datos.deNoche(usuarioId, noche, tx)
  if (!r || r.sinDejoCelu) return { registrado: false, cumplido: false, retrasoMinutos: null }
  return { registrado: true, cumplido: !!r.cumplido, retrasoMinutos: r.retrasoMinutos ?? 0 }
}

// ---------- Modo sueño ----------

async function modoActivo(usuarioId, tx = null) {
  return datos.modo(usuarioId, tx)
}

async function rachaDe(usuarioId, hoy, tx) {
  return calculo.rachaNoches(await datos.cumplidasHasta(usuarioId, hoy, tx), hoy)
}

/** Prende el modo sueño. Idempotente para la misma noche. Abre la estimación de la noche (dormido = acostado + latencia). */
async function entrarModo(usuarioId, { noche, tarde = false, instante = ahora(), resumen = null }, tx = null) {
  return transaccion(async (t) => {
    const existente = await datos.modo(usuarioId, t)
    if (existente && existente.noche === noche) return existente
    const a = await obtenerAjustes(usuarioId, t)
    const hasta = calculo.finDelModo(instante, a.horaFinSuenio, a.zonaHoraria, fechaDe(instante, a.zonaHoraria))
    if (!resumen) {
      const r = await rachaDe(usuarioId, noche, t)
      resumen = `${tarde ? 'Celu dejado tarde' : 'Celu dejado a tiempo'} · Racha: ${r} ${r === 1 ? 'noche' : 'noches'}`
    }
    const estado = await datos.ponerModo(usuarioId, { noche, inicio: instante, hasta, tarde, resumen, aperturas: [] }, t)
    await anotar(usuarioId, 'sueno', 'modo_entrar', { noche, inicio: instante, hasta, tarde }, t)
    await abrirRegistro(usuarioId, noche, instante, hasta, t)
    return estado
  }, tx)
}

/** Al entrar en modo sueño: dormido = acostado + latencia y la mañana prevista (salvo que esté corregido o venga del reloj). */
async function abrirRegistro(usuarioId, noche, inicio, hasta, tx) {
  const reg = await datos.deNoche(usuarioId, noche, tx)
  if (!reg || reg.levantado) return
  const a = await obtenerAjustes(usuarioId, tx)
  const latencia = calculo.latenciaValida(a.latenciaDormirseMinutos)
  const cambios = { despertarPrevisto: hasta, aperturas: reg.aperturas || 0 }
  if (reg.fuenteDormido !== 'corregido' && reg.fuenteDormido !== 'reloj') Object.assign(cambios, { dormido: calculo.dormidoEstimado(reg.acostadoManual ?? inicio, latencia), latenciaMinutos: latencia, fuenteDormido: 'estimado' })
  if (!reg.fuenteAcostado) cambios.fuenteAcostado = 'estimado'
  await datos.cambiar(usuarioId, noche, cambios, tx)
}

/** Sale del modo sueño antes de hora (queda en el historial). Si ya pasaron 3 horas, salir es levantarse: cierra la noche. */
async function salirModo(usuarioId, motivo = 'Salida antes de hora', instante = ahora(), tx = null) {
  return transaccion(async (t) => {
    const m = await datos.modo(usuarioId, t)
    if (!m) return false
    await datos.quitarModo(usuarioId, t)
    await anotar(usuarioId, 'sueno', 'modo_salir', { noche: m.noche, motivo }, t)
    if (instante - m.inicio >= 3 * HORAS) await registrarDespertar(usuarioId, m.noche, instante, t)
    return true
  }, tx)
}

/**
 * Si el modo sueño ya terminó (o falta menos de media hora para la hora de levantarse), lo apaga, cierra la noche
 * y devuelve el estado (para «Buenos días»). Si sigue activo, o no había, devuelve null.
 */
async function terminarModoSiCorresponde(usuarioId, instante = ahora(), tx = null) {
  return transaccion(async (t) => {
    const m = await datos.modo(usuarioId, t)
    if (!m || instante < m.hasta - calculo.MARGEN_MANIANA_MS) return null
    await datos.quitarModo(usuarioId, t)
    await anotar(usuarioId, 'sueno', 'modo_terminar', { noche: m.noche, motivo: instante < m.hasta ? 'Abrió la app poco antes de la hora de levantarse' : 'Terminó solo a la hora de fin' }, t)
    await registrarDespertar(usuarioId, m.noche, instante, t)
    return m
  }, tx)
}

/** Abrir la app durante el modo sueño: se anota la hora (no da ni quita XP). Dos en menos de un minuto cuentan como una. */
async function registrarApertura(usuarioId, instante = ahora(), tx = null) {
  return transaccion(async (t) => {
    const m = await datos.modo(usuarioId, t)
    if (!m || instante >= m.hasta) return 0
    const ultima = m.aperturas[m.aperturas.length - 1]
    if (ultima && instante - ultima < 60000) return m.aperturas.length
    const aperturas = [...m.aperturas, instante]
    await datos.aperturasModo(usuarioId, aperturas, t)
    await anotar(usuarioId, 'sueno', 'apertura', { noche: m.noche, instante }, t)
    const reg = await datos.deNoche(usuarioId, m.noche, t)
    // En la última media hora antes de levantarse no es una apertura de la noche.
    if (reg && !reg.levantado && !(reg.despertarPrevisto && instante >= reg.despertarPrevisto - calculo.MARGEN_MANIANA_MS)) {
      await datos.cambiar(usuarioId, m.noche, { aperturas: (reg.aperturas || 0) + 1 }, t)
    }
    return aperturas.length
  }, tx)
}

/** Cierra la noche: levantado = centro de la ventana habitual (la apertura del celu no se usa: se agarra unos minutos después). */
async function registrarDespertar(usuarioId, noche, instante = ahora(), tx = null) {
  const reg = await datos.deNoche(usuarioId, noche, tx)
  if (!reg || reg.levantado) return reg
  const a = await obtenerAjustes(usuarioId, tx)
  const n = calculo.nocheDesdeRegistro(reg, a)
  const levantado = calculo.levantadoEstimado(noche, a.horaFinSuenio, a.zonaHoraria)
  const r = await datos.cambiar(usuarioId, noche, { levantado, fuenteLevantado: 'estimado', minutosDormido: calculo.minutosDormidos(n.dormido.valor, levantado) }, tx)
  await anotar(usuarioId, 'sueno', 'despertar', { noche, instante }, tx)
  return r
}

// ---------- Correcciones ----------

/**
 * Corrige a mano una noche: { acostado, dormido, levantado } en «HH:MM» y `despertares` (0–3; null lo borra).
 * Lo corregido gana sobre lo estimado. Si la noche no tiene registro, se crea a mano: no da XP ni cuenta para «Dormir a horario».
 */
async function corregirNoche(usuarioId, noche, c = {}, tx = null) {
  if (!esFechaValida(noche)) throw datoInvalido('La noche no es una fecha válida.')
  for (const k of ['acostado', 'dormido', 'levantado']) if (c[k] && !esHoraValida(c[k])) throw datoInvalido('Revisá las horas (HH:MM).')
  return transaccion(async (t) => {
    const a = await obtenerAjustes(usuarioId, t)
    const z = a.zonaHoraria
    let reg = await datos.deNoche(usuarioId, noche, t)
    const antes = reg ? { ...reg } : null
    if (!reg) {
      if (!c.acostado) throw datoInvalido('Para cargar una noche a mano, poné a qué hora te acostaste.')
      const ti = calculo.instanteDeNoche(noche, c.acostado, z)
      reg = await datos.guardar(usuarioId, { noche, horaPrevista: a.horaDejarCelu, horaReal: ti, retrasoMinutos: 0, cumplido: false, creado: ahora(), sinDejoCelu: true, fuenteAcostado: 'corregido', acostadoManual: ti }, t)
    }
    const cambios = {}
    if (c.acostado) { cambios.acostadoManual = calculo.instanteDeNoche(noche, c.acostado, z); cambios.fuenteAcostado = 'corregido' }
    if (c.dormido) {
      cambios.dormido = calculo.instanteDeNoche(noche, c.dormido, z)
      cambios.fuenteDormido = 'corregido'
    } else if (c.acostado && reg.fuenteDormido !== 'corregido' && reg.fuenteDormido !== 'reloj') {
      cambios.dormido = calculo.dormidoEstimado(cambios.acostadoManual, calculo.latenciaValida(a.latenciaDormirseMinutos))
      cambios.fuenteDormido = 'estimado'
    }
    if (c.levantado) { cambios.levantado = calculo.instanteDeNoche(noche, c.levantado, z); cambios.fuenteLevantado = 'corregido' }
    if (c.despertares !== undefined) cambios.despertares = c.despertares === null || c.despertares === '' ? null : Math.max(0, Math.min(3, Math.round(Number(c.despertares))))
    const despues = { ...reg, ...cambios }
    const n = calculo.nocheDesdeRegistro(despues, a)
    if (n.dormido.valor < n.acostado.valor) throw datoInvalido('Te dormiste antes de acostarte: revisá las horas.')
    if (n.levantado.valor <= n.dormido.valor) throw datoInvalido('La hora de levantarte tiene que ser después de la de dormirte.')
    if (despues.levantado != null) cambios.minutosDormido = calculo.minutosDormidos(n.dormido.valor, n.levantado.valor)
    const r = await datos.cambiar(usuarioId, noche, cambios, t)
    await anotar(usuarioId, 'sueno', antes ? 'corregir' : 'crear', { noche, antes: antes || undefined, cambios }, t)
    return r
  }, tx)
}

/** Vuelve un dato corregido ('acostado' | 'dormido' | 'levantado') a lo estimado. */
async function volverAEstimado(usuarioId, noche, campo, tx = null) {
  if (!['acostado', 'dormido', 'levantado'].includes(campo)) throw datoInvalido('Ese dato no existe.')
  return transaccion(async (t) => {
    const a = await obtenerAjustes(usuarioId, t)
    const reg = await datos.deNoche(usuarioId, noche, t)
    if (!reg) throw noEncontrado('Esa noche')
    const cambios = {}
    const acostado = campo === 'acostado' ? reg.horaReal : (reg.acostadoManual ?? reg.horaReal)
    if (campo === 'acostado') { cambios.acostadoManual = null; cambios.fuenteAcostado = 'estimado' }
    if (campo === 'dormido' || (campo === 'acostado' && reg.fuenteDormido !== 'corregido')) {
      cambios.dormido = calculo.dormidoEstimado(acostado, calculo.latenciaValida(a.latenciaDormirseMinutos))
      cambios.fuenteDormido = 'estimado'
    }
    if (campo === 'levantado') {
      cambios.levantado = reg.levantado != null ? calculo.levantadoEstimado(noche, a.horaFinSuenio, a.zonaHoraria) : null
      cambios.fuenteLevantado = 'estimado'
    }
    const juntos = { ...reg, ...cambios }
    for (const k of Object.keys(juntos)) if (juntos[k] === null) delete juntos[k]
    const n = calculo.nocheDesdeRegistro(juntos, a)
    if (reg.levantado != null || cambios.levantado != null) cambios.minutosDormido = calculo.minutosDormidos(n.dormido.valor, n.levantado.valor)
    const r = await datos.cambiar(usuarioId, noche, cambios, t)
    await anotar(usuarioId, 'sueno', 'corregir', { noche, motivo: `Volver a lo estimado: ${campo}` }, t)
    return r
  }, tx)
}

// ---------- Lectura ----------

/** Noches entre dos fechas, listas para mostrar (reloj > corregido > estimado). La de hoy, si no terminó, no entra. */
async function noches(usuarioId, desde, hasta, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = nocheDeSuenio(ahora(), a.zonaHoraria, a.horaCorteNoche)
  return calculo.nochesParaMostrar(await datos.entre(usuarioId, desde, hasta, tx), a, hoy)
}

/** Las últimas `dias` noches: promedios, regularidad, mejora y racha. */
async function resumenNoches(usuarioId, dias = 14, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = nocheDeSuenio(ahora(), a.zonaHoraria, a.horaCorteNoche)
  const todas = calculo.nochesParaMostrar(await datos.entre(usuarioId, sumarDias(hoy, -Math.max(dias, 14)), hoy, tx), a, hoy)
  return calculo.resumenNoches(todas, hoy, dias, a, await rachaDe(usuarioId, hoy, tx))
}

/** Desde cuándo se cuenta la adaptación: la fecha elegida, si no la primera noche registrada, si no hoy. */
async function estadoAdaptacion(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  let inicio = a.adaptacion && a.adaptacion.desde
  if (!inicio) { const p = await datos.primeraNoche(usuarioId, tx); inicio = p && p <= hoy ? p : hoy }
  const etapas = calculo.etapasDe(a)
  return { inicio, etapas, tolerancia: calculo.toleranciaDe(a), actual: calculo.etapaDe(hoy, inicio, etapas), tramos: calculo.tramosDeEtapas(inicio, etapas), horaDejarCelu: a.horaDejarCelu, discurso: calculo.discursoDeSemana(calculo.etapaDe(hoy, inicio, etapas).semana, etapas), ultimaSemana: calculo.ultimaSemanaConInfo(etapas) }
}

/** Guarda la adaptación editada. `null` vuelve a lo sugerido. */
async function guardarAdaptacion(usuarioId, cambios, tx = null) {
  if (!cambios) { await guardarAjustes(usuarioId, { adaptacion: null }, tx); return estadoAdaptacion(usuarioId, tx) }
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const { desde, etapas, toleranciaMinutos } = cambios
  if (desde && (!esFechaValida(desde) || desde > hoy)) throw datoInvalido('La fecha de inicio tiene que ser de hoy para atrás.')
  const lista = calculo.normalizarEtapas(etapas)
  if (!lista.length) throw datoInvalido('Tiene que haber al menos una etapa.')
  const tol = Math.max(0, Math.min(120, Math.round(Number(toleranciaMinutos ?? calculo.TOLERANCIA_SUGERIDA))))
  await guardarAjustes(usuarioId, { adaptacion: { desde: desde || null, etapas: lista, toleranciaMinutos: tol } }, tx)
  await anotar(usuarioId, 'sueno', 'adaptacion', { desde, etapas: lista, toleranciaMinutos: tol }, tx)
  return estadoAdaptacion(usuarioId, tx)
}

/** Ajustes del sueño: hora de «Dejo celu», minutos hasta dormirse, inicio de la ventana de levantarse y objetivo en horas. */
async function guardarAjustesSueno(usuarioId, { horaDejarCelu, latenciaDormirseMinutos, horaFinSuenio, objetivoSuenioHoras }, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  if (!esHoraValida(horaDejarCelu) || !esHoraValida(horaFinSuenio)) throw datoInvalido('Revisá las horas (HH:MM).')
  const m = (hm) => { const [h, mi] = hm.split(':').map(Number); return h * 60 + mi }
  if (!(m(a.horaAlistarse) < m(horaDejarCelu) && m(horaDejarCelu) < m(a.horaDormido))) throw datoInvalido(`«Dejo celu» tiene que quedar entre ${a.horaAlistarse} (alistarse) y ${a.horaDormido} (dormido).`)
  const objetivo = Number(objetivoSuenioHoras)
  if (!(objetivo >= 4 && objetivo <= 12)) throw datoInvalido('El objetivo va de 4 a 12 horas.')
  const cambios = { horaDejarCelu, latenciaDormirseMinutos: calculo.latenciaValida(latenciaDormirseMinutos), horaFinSuenio, objetivoSuenioHoras: objetivo }
  await guardarAjustes(usuarioId, cambios, tx)
  await anotar(usuarioId, 'sueno', 'ajustes', cambios, tx)
  return ajustesSueno(usuarioId, tx)
}

async function ajustesSueno(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  return {
    horaAlistarse: a.horaAlistarse, horaDejarCelu: a.horaDejarCelu, horaDormido: a.horaDormido, horaLimiteCelu: a.horaLimiteCelu,
    horaFinSuenio: a.horaFinSuenio, finVentana: calculo.finVentana(a.horaFinSuenio), latenciaDormirseMinutos: a.latenciaDormirseMinutos,
    objetivoSuenioHoras: a.objetivoSuenioHoras, relojInteligente: !!a.relojInteligente, xpDejoCelu: a.xpDejoCelu,
    latenciaMin: calculo.LATENCIA_MIN, latenciaMax: calculo.LATENCIA_MAX, zonaHoraria: a.zonaHoraria,
  }
}

/** Aviso para alistarse: desde `minutosAvisoDormir` antes de «Dejo celu» hasta la hora límite, si no se marcó. */
async function avisoDormir(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const t = ahora()
  const noche = nocheDeSuenio(t, a.zonaHoraria, a.horaCorteNoche)
  const reg = await datos.deNoche(usuarioId, noche, tx)
  const minutos = a.minutosAvisoDormir > 0 ? a.minutosAvisoDormir : 30
  const desde = instanteDe(noche, a.horaDejarCelu, a.zonaHoraria) - minutos * calculo.MINUTO
  const hasta = instanteDe(noche, a.horaLimiteCelu, a.zonaHoraria)
  const mostrar = !(reg && !reg.sinDejoCelu) && t >= desde && t < hasta
  return { noche, mostrar, frase: calculo.fraseDormir(a, noche) }
}

/** Todo lo que muestra la pantalla de Sueño. `rango`: 'semana' | 'mes' | 'todo'. */
async function resumen(usuarioId, { rango = 'semana' } = {}, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const t = ahora()
  const noche = nocheDeSuenio(t, a.zonaHoraria, a.horaCorteNoche)
  const r = await resumenNoches(usuarioId, 14, tx)
  const ad = await estadoAdaptacion(usuarioId, tx)
  const desde = rango === 'mes' ? sumarDias(noche, -30) : rango === 'todo' ? (await datos.primeraNoche(usuarioId, tx)) || sumarDias(noche, -14) : sumarDias(noche, -7)
  const lista = await noches(usuarioId, desde, noche, tx)
  const conEtapa = lista.map((n) => ({ ...n, etapa: calculo.etapaDe(n.noche, ad.inicio, ad.etapas).indice, veredicto: calculo.veredictoDe(n, ad, lista) }))
  const esta = await datos.deNoche(usuarioId, noche, tx)
  return {
    noche,
    hora: formatoHora(t, a.zonaHoraria),
    estaNoche: esta && !esta.sinDejoCelu ? { cumplido: !!esta.cumplido, retrasoMinutos: esta.retrasoMinutos || 0, hora: formatoHora(esta.horaReal, a.zonaHoraria) } : null,
    modo: await datos.modo(usuarioId, tx),
    anoche: r.anoche ? { ...r.anoche, veredicto: calculo.veredictoDe(r.anoche, ad, r.noches) } : null,
    anocheFecha: sumarDias(noche, -1),
    mejora: r.mejora,
    promedio: r.promedio,
    objetivoMinutos: r.objetivoMinutos,
    noches: conEtapa,
    rango,
    adaptacion: ad,
    ajustes: await ajustesSueno(usuarioId, tx),
    aviso: await avisoDormir(usuarioId, tx),
  }
}

/** Tarjeta chica para Hoy (módulo dia): esta noche, anoche con su veredicto, el aviso y si el modo está prendido. */
async function resumenHoy(usuarioId, tx = null) {
  const r = await resumen(usuarioId, { rango: 'semana' }, tx)
  return { noche: r.noche, estaNoche: r.estaNoche, horaDejarCelu: r.ajustes.horaDejarCelu, anoche: r.anoche && { minutos: r.anoche.minutos, cumplido: r.anoche.cumplido, veredicto: r.anoche.veredicto }, aviso: r.aviso, modoActivo: !!r.modo }
}

/** Cuántas veces se abrió la app de noche entre dos noches (para la revisión semanal del módulo ciclo). */
async function aperturasEntre(usuarioId, desde, hasta, tx = null) {
  return (await datos.entre(usuarioId, desde, hasta, tx)).reduce((s, r) => s + (r.aperturas || 0), 0)
}

/**
 * Trae el sueño de una copia de la app vieja (tablas `suenio` y `modoSuenio` de «Copiar todo como texto»).
 * Lo usa el módulo copia. Una noche que ya existe no se pisa. Devuelve cuántas noches entraron.
 */
async function importar(usuarioId, { suenio = [], modoSuenio = [] } = {}, tx = null) {
  return transaccion(async (t) => {
    let n = 0
    for (const r of suenio || []) {
      if (!r || !esFechaValida(r.noche) || !Number.isFinite(r.horaReal)) continue
      if (await datos.deNoche(usuarioId, r.noche, t)) continue
      const fuente = (f) => (['estimado', 'corregido', 'reloj'].includes(f) ? f : undefined)
      await datos.guardar(usuarioId, {
        noche: r.noche, horaPrevista: esHoraValida(r.horaPrevista) ? r.horaPrevista : '21:15', horaReal: r.horaReal,
        retrasoMinutos: Math.max(0, Math.round(r.retrasoMinutos || 0)), cumplido: !!r.cumplido, sinDejoCelu: !!r.sinDejoCelu,
        nota: r.nota || undefined, creado: Number.isFinite(r.creado) ? r.creado : r.horaReal,
        acostadoManual: r.acostadoManual, dormido: r.dormido, latenciaMinutos: r.latenciaMinutos, despertarPrevisto: r.despertarPrevisto,
        levantado: r.levantado, despertares: r.despertares, minutosDormido: r.minutosDormido,
        fuenteAcostado: fuente(r.fuenteAcostado), fuenteDormido: fuente(r.fuenteDormido),
        fuenteLevantado: fuente(r.fuenteLevantado) || (r.levantadoCorregido ? 'corregido' : undefined),
        etapas: Array.isArray(r.etapas) ? r.etapas : undefined, aperturas: Math.max(0, Math.round(r.aperturas || 0)),
      }, t)
      n++
    }
    const m = (modoSuenio || []).find((x) => x && x.id === 'activo')
    if (m && esFechaValida(m.noche) && Number.isFinite(m.inicio) && Number.isFinite(m.hasta) && m.hasta > ahora() && !(await datos.modo(usuarioId, t))) {
      await datos.ponerModo(usuarioId, { noche: m.noche, inicio: m.inicio, hasta: m.hasta, tarde: !!m.tarde, resumen: m.resumen || '', aperturas: Array.isArray(m.aperturas) ? m.aperturas : [] }, t)
    }
    if (n) await anotar(usuarioId, 'sueno', 'importar', { noches: n }, t)
    return n
  }, tx)
}

module.exports = {
  nocheDe, dejoCelu, deshacerDejoCelu, dormirAHorario,
  modoActivo, entrarModo, salirModo, terminarModoSiCorresponde, registrarApertura, registrarDespertar,
  corregirNoche, volverAEstimado, noches, resumenNoches, estadoAdaptacion, guardarAdaptacion, guardarAjustesSueno, ajustesSueno,
  avisoDormir, resumen, resumenHoy, aperturasEntre, importar,
}
