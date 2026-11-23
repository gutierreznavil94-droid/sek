'use strict'
/**
 * Ciclo · la única puerta del módulo.
 * Ciclos de 90 días (o más), fases, objetivos, atributos, identidad, metas con fecha y revisiones.
 * Las cuentas puras están en calculo.js. Todas las funciones aceptan `tx` opcional al final.
 *
 * Usa xp (por su ventanilla) para la XP de las metas cumplidas.
 * Lo que necesita datos de otros módulos (pilares cumplidos, sueño, juego) no lo calcula acá:
 * la revisión recibe la «foto» de quien la llama y los avisos `ciclo.*` le cuentan a dia lo que pasó.
 */
const crypto = require('node:crypto')
const datos = require('./datos')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const { transaccion } = require('../../comun/base')
const { obtenerAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { fechaDe, esFechaValida, sumarDias, lunesDe, fechaDelDiaDelCiclo } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const nuevoId = (prefijo) => `${prefijo}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
const texto = (x, max = 2000) => String(x ?? '').trim().slice(0, max)

async function hoyDe(usuarioId, tx) {
  const { zonaHoraria } = await obtenerAjustes(usuarioId, tx)
  return fechaDe(ahora(), zonaHoraria)
}

function revisarFecha(f, que = 'La fecha') {
  if (!esFechaValida(f)) throw datoInvalido(`${que} no es válida.`)
}

// ====================== Ciclos y fases ======================

async function cicloActivo(usuarioId, tx = null) {
  return datos.cicloActivo(usuarioId, tx)
}

async function ciclos(usuarioId, tx = null) {
  return datos.ciclos(usuarioId, tx)
}

async function fases(usuarioId, cicloId, tx = null) {
  return datos.fases(usuarioId, cicloId, tx)
}

/**
 * Dónde está una fecha en el ciclo activo (por defecto hoy):
 * { ciclo, dia, fase, faseNumero, terminado, noEmpezado, diaCero, fechaFin, progreso }, o null si no hay ciclo.
 * Lo usa dia (Día X de 90, Día 0 que no resta) y progreso.
 */
async function diaDelCiclo(usuarioId, fecha = null, tx = null) {
  const ciclo = await datos.cicloActivo(usuarioId, tx)
  if (!ciclo) return null
  const f = fecha || await hoyDe(usuarioId, tx)
  revisarFecha(f)
  const u = calculo.ubicar(ciclo, f)
  const fase = (await datos.fases(usuarioId, ciclo.id, tx)).find((x) => x.numero === u.faseNumero) || null
  return { ciclo, fecha: f, ...u, fase }
}

/** Crea las fases y las metas automáticas de un ciclo. */
async function armarFasesYMetas(usuarioId, ciclo, tx) {
  for (const f of calculo.planDeFases(ciclo.duracionDias, ciclo.diasPorFase)) {
    await datos.crearFase(usuarioId, { ...f, id: nuevoId('fase'), cicloId: ciclo.id }, tx)
  }
  await crearMetasAutomaticas(usuarioId, ciclo, tx)
}

async function crearMetasAutomaticas(usuarioId, ciclo, tx) {
  const fs = await datos.fases(usuarioId, ciclo.id, tx)
  for (const m of calculo.metasAutomaticas(ciclo, fs)) {
    await datos.crearMeta(usuarioId, { ...m, id: nuevoId('meta'), estado: 'pendiente', creado: ahora() }, tx)
  }
}

/**
 * Empieza un ciclo nuevo. Si había uno activo, lo cierra (su historial queda; nivel y XP no se tocan).
 * opciones: { inicio, duracionDias = 90, diasPorFase = 30, diaCero = false }.
 */
async function iniciarCiclo(usuarioId, { inicio, duracionDias = 90, diasPorFase = 30, diaCero = false } = {}, tx = null) {
  revisarFecha(inicio, 'La fecha de inicio')
  duracionDias = Math.floor(Number(duracionDias))
  diasPorFase = Math.floor(Number(diasPorFase))
  if (!(duracionDias >= 7 && duracionDias <= 3650)) throw datoInvalido('La duración va de 7 a 3650 días.')
  if (!(diasPorFase >= 1 && diasPorFase <= duracionDias)) throw datoInvalido('Los días por fase van de 1 a la duración del ciclo.')
  return transaccion(async (t) => {
    const activo = await datos.cicloActivo(usuarioId, t)
    if (activo) {
      await datos.cerrarCiclo(usuarioId, activo.id, ahora(), t)
      await anotar(usuarioId, 'ciclo', 'cerrar_ciclo', { id: activo.id, numero: activo.numero, motivo: 'Nuevo ciclo' }, t)
    }
    const ciclo = await datos.crearCiclo(usuarioId, {
      id: nuevoId('ciclo'), numero: (await datos.cuantosCiclos(usuarioId, t)) + 1, inicio,
      diaCero: diaCero ? sumarDias(inicio, -1) : null, duracionDias, diasPorFase, estado: 'activo', creado: ahora(),
    }, t)
    await armarFasesYMetas(usuarioId, ciclo, t)
    await anotar(usuarioId, 'ciclo', 'nuevo_ciclo', ciclo, t)
    await avisar('ciclo.nuevo', { usuarioId, ciclo, anterior: activo || null }, t)
    return ciclo
  }, tx)
}

/**
 * Cambia la fecha de inicio del ciclo activo sin perder nada: regenera las metas automáticas
 * (las propias quedan) y saca el Día 0. Avisa `ciclo.inicio_cambiado` para que dia limpie
 * los días cerrados anteriores al nuevo inicio. El XP no se toca.
 */
async function cambiarInicio(usuarioId, nuevoInicio, tx = null) {
  revisarFecha(nuevoInicio, 'La fecha de inicio')
  return transaccion(async (t) => {
    const ciclo = await datos.cicloActivo(usuarioId, t)
    if (!ciclo) throw noEncontrado('El ciclo activo')
    if (ciclo.inicio === nuevoInicio) return ciclo
    const despues = await datos.cambiarInicio(usuarioId, ciclo.id, nuevoInicio, t)
    await datos.borrarAutomaticas(usuarioId, t)
    await crearMetasAutomaticas(usuarioId, despues, t)
    await anotar(usuarioId, 'ciclo', 'cambiar_inicio', { id: ciclo.id, antes: ciclo.inicio, despues: nuevoInicio }, t)
    await avisar('ciclo.inicio_cambiado', { usuarioId, ciclo: despues, inicioAnterior: ciclo.inicio }, t)
    return despues
  }, tx)
}

async function editarFase(usuarioId, faseId, { foco, queSeMide }, tx = null) {
  const f = texto(foco, 200)
  if (f.length < 2) throw datoInvalido('El foco necesita al menos 2 letras.')
  return transaccion(async (t) => {
    const antes = await datos.fasePorId(usuarioId, faseId, t)
    if (!antes) throw noEncontrado('Esa fase')
    const despues = await datos.editarFase(usuarioId, faseId, { foco: f, queSeMide: texto(queSeMide) }, t)
    await anotar(usuarioId, 'ciclo', 'editar_fase', { antes, despues }, t)
    return despues
  }, tx)
}

/**
 * Cierra una fase: anota qué aprendí y el resultado real de cada objetivo ({ idObjetivo: 'texto' }).
 * Se puede desde el día siguiente a su último día (la última, que cierra el ciclo, desde que empieza esa fase).
 * Avisa `ciclo.fase_cerrada`. Si era la última, la pantalla ofrece empezar un ciclo nuevo.
 */
async function cerrarFase(usuarioId, faseId, { notas = '', resultados = {} } = {}, tx = null) {
  return transaccion(async (t) => {
    const fase = await datos.fasePorId(usuarioId, faseId, t)
    if (!fase) throw noEncontrado('Esa fase')
    if (fase.cerradaEn) throw datoInvalido('Esa fase ya estaba cerrada.')
    const ciclo = await datos.cicloPorId(usuarioId, fase.cicloId, t)
    const todas = await datos.fases(usuarioId, ciclo.id, t)
    const esUltima = fase.numero === todas.length
    const { dia } = calculo.ubicar(ciclo, await hoyDe(usuarioId, t))
    if (!calculo.sePuedeCerrar(fase, dia, esUltima)) throw datoInvalido(`La fase ${fase.numero} se puede cerrar desde el día ${fase.diaFin + 1}.`)
    for (const [id, r] of Object.entries(resultados || {})) {
      const o = await datos.objetivoPorId(usuarioId, id, t)
      if (o && o.cicloId === ciclo.id) await datos.ponerResultado(usuarioId, id, texto(r, 500) || null, t)
    }
    const despues = await datos.cerrarFase(usuarioId, faseId, texto(notas, 4000), ahora(), t)
    await anotar(usuarioId, 'ciclo', 'cerrar_fase', { id: faseId, numero: fase.numero, cicloId: ciclo.id }, t)
    await avisar('ciclo.fase_cerrada', { usuarioId, fase: despues, ciclo, esUltima }, t)
    return { fase: despues, esUltima }
  }, tx)
}

// ====================== Objetivos ======================

async function objetivos(usuarioId, cicloId, tx = null) {
  return datos.objetivos(usuarioId, cicloId, tx)
}

/** Crea o edita un objetivo de una fase: título, atributo, indicador medible, línea de base, meta, resultado. */
async function guardarObjetivo(usuarioId, o, tx = null) {
  const titulo = texto(o.titulo, 200)
  const indicador = texto(o.indicador, 300)
  if (titulo.length < 3) throw datoInvalido('El objetivo necesita al menos 3 letras.')
  if (indicador.length < 3) throw datoInvalido('El indicador necesita al menos 3 letras.')
  return transaccion(async (t) => {
    const antes = o.id ? await datos.objetivoPorId(usuarioId, o.id, t) : null
    if (o.id && !antes) throw noEncontrado('Ese objetivo')
    const cicloId = antes ? antes.cicloId : o.cicloId || (await datos.cicloActivo(usuarioId, t) || {}).id
    if (!cicloId || !await datos.cicloPorId(usuarioId, cicloId, t)) throw noEncontrado('El ciclo')
    const nFases = (await datos.fases(usuarioId, cicloId, t)).length
    const faseNumero = Math.floor(Number(o.faseNumero ?? antes?.faseNumero))
    if (!(faseNumero >= 1 && faseNumero <= nFases)) throw datoInvalido('Esa fase no existe en el ciclo.')
    if (!await datos.atributoPorId(usuarioId, o.atributoId, t)) throw datoInvalido('Elegí un atributo.')
    const despues = await datos.guardarObjetivo(usuarioId, {
      id: antes ? antes.id : nuevoId('obj'), cicloId, faseNumero, atributoId: o.atributoId, titulo, indicador,
      lineaBase: texto(o.lineaBase, 100) || null, meta: texto(o.meta, 100) || null,
      resultado: o.resultado !== undefined ? texto(o.resultado, 500) || null : antes?.resultado ?? null,
      creado: antes ? antes.creado : ahora(), archivado: false,
    }, t)
    await anotar(usuarioId, 'ciclo', antes ? 'editar_objetivo' : 'crear_objetivo', { antes, despues }, t)
    return despues
  }, tx)
}

async function archivarObjetivo(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.objetivoPorId(usuarioId, id, t)
    if (!antes) throw noEncontrado('Ese objetivo')
    await datos.archivarObjetivo(usuarioId, id, t)
    await anotar(usuarioId, 'ciclo', 'archivar_objetivo', { antes }, t)
  }, tx)
}

// ====================== Atributos ======================

/** Atributos (sin los archivados). Su VALOR (% de las acciones vinculadas) lo calcula dia, que tiene las acciones. */
async function atributos(usuarioId, { conArchivados = false } = {}, tx = null) {
  return datos.atributos(usuarioId, conArchivados, tx)
}

async function guardarAtributo(usuarioId, a, tx = null) {
  const nombre = texto(a.nombre, 100)
  if (nombre.length < 2) throw datoInvalido('El nombre necesita al menos 2 letras.')
  const ventanaDias = Math.floor(Number(a.ventanaDias ?? 14))
  if (!(ventanaDias >= 3 && ventanaDias <= 60)) throw datoInvalido('La ventana va de 3 a 60 días.')
  return transaccion(async (t) => {
    const antes = a.id ? await datos.atributoPorId(usuarioId, a.id, t) : null
    if (a.id && !antes) throw noEncontrado('Ese atributo')
    const lista = await datos.atributos(usuarioId, true, t)
    const despues = await datos.guardarAtributo(usuarioId, {
      id: antes ? antes.id : nuevoId('atr'), nombre, descripcion: texto(a.descripcion, 300), ventanaDias,
      orden: Number.isFinite(a.orden) ? a.orden : antes ? antes.orden : lista.length + 1,
      creado: antes ? antes.creado : ahora(),
    }, t)
    await anotar(usuarioId, 'ciclo', antes ? 'editar_atributo' : 'crear_atributo', { antes, despues }, t)
    return despues
  }, tx)
}

/** Archivar: deja de mostrarse; su historial y los objetivos y acciones vinculadas quedan. */
async function archivarAtributo(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await datos.atributoPorId(usuarioId, id, t)
    if (!antes) throw noEncontrado('Ese atributo')
    await datos.archivarAtributo(usuarioId, id, t)
    await anotar(usuarioId, 'ciclo', 'archivar_atributo', { antes }, t)
  }, tx)
}

// ====================== Identidad ======================

/** Yo ideal y obstáculos actuales. Si nunca se guardó, la de fábrica. */
async function identidad(usuarioId, tx = null) {
  return (await datos.identidad(usuarioId, tx)) || { ...calculo.IDENTIDAD_INICIAL, actualizado: 0 }
}

async function guardarIdentidad(usuarioId, { vision, obstaculos }, tx = null) {
  const v = texto(vision, 4000)
  if (v.length < 10) throw datoInvalido('El yo ideal necesita al menos 10 letras.')
  return transaccion(async (t) => {
    const antes = await identidad(usuarioId, t)
    const despues = await datos.guardarIdentidad(usuarioId, { vision: v, obstaculos: texto(obstaculos, 4000) }, ahora(), t)
    await anotar(usuarioId, 'ciclo', 'editar_identidad', { antes, despues }, t)
    return despues
  }, tx)
}

// ====================== Metas con fecha ======================

async function metaPropia(usuarioId, id, tx) {
  const m = await datos.metaPorId(usuarioId, id, tx)
  if (!m || m.tipo !== 'propia') throw noEncontrado('Esa meta')
  return m
}

/** Meta propia: qué querés lograr y para cuándo. En días pasados no se crean (solo se marcan). */
async function crearMeta(usuarioId, { titulo, fecha, xp: cantidad, nota }, tx = null) {
  const t1 = texto(titulo, 200)
  if (!t1) throw datoInvalido('La meta necesita un título.')
  revisarFecha(fecha)
  return transaccion(async (t) => {
    if (fecha < await hoyDe(usuarioId, t)) throw datoInvalido('En días pasados no se crean metas, solo se marcan.')
    const m = await datos.crearMeta(usuarioId, {
      id: nuevoId('meta'), fecha, titulo: t1, tipo: 'propia', estado: 'pendiente',
      xp: Number.isFinite(cantidad) ? Math.max(0, Math.floor(cantidad)) : calculo.XP_META, nota: texto(nota, 500) || null, creado: ahora(),
    }, t)
    await anotar(usuarioId, 'ciclo', 'crear_meta', m, t)
    return m
  }, tx)
}

async function editarMeta(usuarioId, id, cambios, tx = null) {
  return transaccion(async (t) => {
    const antes = await metaPropia(usuarioId, id, t)
    const titulo = cambios.titulo !== undefined ? texto(cambios.titulo, 200) : antes.titulo
    if (!titulo) throw datoInvalido('La meta necesita un título.')
    const fecha = cambios.fecha !== undefined ? cambios.fecha : antes.fecha
    revisarFecha(fecha)
    const despues = await datos.editarMeta(usuarioId, id, {
      titulo, fecha,
      xp: cambios.xp !== undefined && Number.isFinite(cambios.xp) ? Math.max(0, Math.floor(cambios.xp)) : antes.xp,
      nota: cambios.nota !== undefined ? texto(cambios.nota, 500) || null : antes.nota,
    }, t)
    await anotar(usuarioId, 'ciclo', 'editar_meta', { antes, despues }, t)
    return despues
  }, tx)
}

/**
 * «Lo logré» (cumplida: da su XP una sola vez) o «No llegué». Se puede corregir después: la XP se anula
 * o se reactiva con historial, nunca se duplica. Cumplida antes de tiempo: cuenta el día que se marcó.
 * Tope: solo 2 metas por día dan XP; las demás quedan cumplidas sin XP (`conTope`).
 * Devuelve { meta, xp, nuevoNivel, conTope }.
 */
async function resolverMeta(usuarioId, id, lograda, motivo = '', tx = null) {
  return transaccion(async (t) => {
    const antes = await metaPropia(usuarioId, id, t)
    const hoy = await hoyDe(usuarioId, t)
    const cumplidaEl = lograda ? (hoy < antes.fecha ? hoy : antes.fecha) : null
    const meta = await datos.resolverMeta(usuarioId, id, { estado: lograda ? 'cumplida' : 'no_cumplida', resueltaEn: ahora(), cumplidaEl }, t)
    await anotar(usuarioId, 'ciclo', antes.estado !== 'pendiente' ? 'corregir_meta' : 'resolver_meta', { antes, despues: meta, motivo }, t)
    const clave = xp.claveXp('meta', [id])
    if (!lograda) {
      await xp.anular(usuarioId, clave, motivo || 'Meta marcada como no cumplida', t)
      return { meta, xp: 0, nuevoNivel: null, conTope: false }
    }
    const cantidad = antes.xp ?? calculo.XP_META
    if (cantidad <= 0) return { meta, xp: 0, nuevoNivel: null, conTope: false }
    const otras = (await xp.delDia(usuarioId, cumplidaEl, t)).filter((r) => r.origen === 'meta' && !r.anulado && r.clave !== clave).length
    if (otras >= calculo.TOPE_METAS_CON_XP) return { meta, xp: 0, nuevoNivel: null, conTope: true }
    const r = await xp.sumar(usuarioId, { clave, cantidad, origen: 'meta', fecha: cumplidaEl, descripcion: `Meta: ${antes.titulo}` }, t)
    return { meta, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, conTope: false }
  }, tx)
}

/** Vuelve una meta a pendiente (se marcó por error) y quita su XP. */
async function reabrirMeta(usuarioId, id, motivo = 'Vuelta a pendiente', tx = null) {
  return transaccion(async (t) => {
    const antes = await metaPropia(usuarioId, id, t)
    await xp.anular(usuarioId, xp.claveXp('meta', [id]), motivo, t)
    const despues = await datos.resolverMeta(usuarioId, id, { estado: 'pendiente', resueltaEn: null, cumplidaEl: null }, t)
    await anotar(usuarioId, 'ciclo', 'corregir_meta', { antes, despues, motivo }, t)
    return despues
  }, tx)
}

async function borrarMeta(usuarioId, id, tx = null) {
  return transaccion(async (t) => {
    const antes = await metaPropia(usuarioId, id, t)
    await xp.anular(usuarioId, xp.claveXp('meta', [id]), 'Meta borrada', t)
    await datos.borrarMeta(usuarioId, id, t)
    await anotar(usuarioId, 'ciclo', 'borrar_meta', { antes }, t)
  }, tx)
}

/** Metas propias agrupadas: { pendientes, vencidas (Hoy pregunta), cumplidas, noCumplidas }. */
async function resumenMetas(usuarioId, hoy = null, tx = null) {
  const h = hoy || await hoyDe(usuarioId, tx)
  return calculo.agruparMetas(await datos.metasPropias(usuarioId, tx), h)
}

/** Metas propias cuya fecha llegó y siguen sin respuesta. Para la tarjeta de Hoy (dia). */
async function metasQueVencen(usuarioId, hoy = null, tx = null) {
  return (await resumenMetas(usuarioId, hoy, tx)).vencidas
}

/** Todas las metas (automáticas y propias) entre dos fechas, con su estado visible. Para el calendario y progreso. */
async function metasEntre(usuarioId, desde, hasta, tx = null) {
  revisarFecha(desde); revisarFecha(hasta)
  const hoy = await hoyDe(usuarioId, tx)
  return (await datos.metasEntre(usuarioId, desde, hasta, tx)).map((m) => ({ ...m, visible: m.tipo === 'propia' ? calculo.estadoVisible(m, hoy) : null }))
}

// ====================== Revisiones ======================

/** Una revisión guardada, o null. Para la semanal sirve cualquier día de esa semana. */
async function revision(usuarioId, tipo, periodo, tx = null) {
  return datos.revision(usuarioId, tipo, tipo === 'semanal' && esFechaValida(periodo) ? lunesDe(periodo) : periodo, tx)
}

/**
 * Guarda (o actualiza) una revisión. `foto` son los números del momento que arma quien llama
 * (pilares cumplidos, minutos de juego…); al actualizar, la foto queda la de la primera vez.
 * La primera vez avisa `ciclo.revision` ({ usuarioId, tipo, periodo, fecha }) para que dia complete
 * el pilar «Revisión diaria/semanal» y dé su XP. Para la semanal, `periodo` es el lunes y `fecha` el domingo.
 * Devuelve { revision, nueva }.
 */
async function guardarRevision(usuarioId, tipo, periodo, respuestas = {}, foto = {}, tx = null) {
  if (!['diaria', 'semanal', 'fase', 'ciclo'].includes(tipo)) throw datoInvalido('Ese tipo de revisión no existe.')
  if (tipo === 'diaria' || tipo === 'semanal') revisarFecha(periodo, 'El día de la revisión')
  if (tipo === 'semanal') periodo = lunesDe(periodo)
  const limpias = {}
  for (const [k, v] of Object.entries(respuestas || {})) if (/^[a-zA-Z]{1,30}$/.test(k)) limpias[k] = texto(v, 1000)
  return transaccion(async (t) => {
    if ((tipo === 'diaria' || tipo === 'semanal') && periodo > await hoyDe(usuarioId, t)) throw datoInvalido('No se revisa un día que no llegó.')
    const r = await datos.guardarRevision(usuarioId, { id: nuevoId('rev'), tipo, periodo, respuestas: limpias, foto: foto || {}, creado: ahora(), actualizado: ahora() }, t)
    const { nueva, ...revisionGuardada } = r
    await anotar(usuarioId, 'ciclo', nueva ? 'crear_revision' : 'editar_revision', { tipo, periodo }, t)
    if (nueva) {
      const fecha = tipo === 'semanal' ? sumarDias(periodo, 6) : tipo === 'diaria' ? periodo : null
      await avisar('ciclo.revision', { usuarioId, tipo, periodo, fecha }, t)
    }
    return { revision: revisionGuardada, nueva }
  }, tx)
}

/**
 * Lo que muestra la pantalla de revisión. Diaria: qué sumó XP ese día (lo cumplido) y qué restó.
 * Semanal (lunes a domingo): XP por día y total. Los pilares del día los suma dia cuando exista
 * (por ahora la pantalla usa lo que dejó rastro en xp, que ciclo sí puede leer).
 * Devuelve { tipo, periodo, desde, hasta, hoy, revision, obstaculos, hechos, restas, balance, porDia, xpTotal }.
 */
async function datosRevision(usuarioId, tipo, fecha = null, tx = null) {
  if (!['diaria', 'semanal'].includes(tipo)) throw datoInvalido('Ese tipo de revisión no existe.')
  const hoy = await hoyDe(usuarioId, tx)
  const f = fecha || hoy
  revisarFecha(f)
  if (tipo === 'diaria') {
    const movs = (await xp.delDia(usuarioId, f, tx)).filter((m) => !m.anulado)
    return {
      tipo, periodo: f, desde: f, hasta: f, hoy, revision: await datos.revision(usuarioId, 'diaria', f, tx), obstaculos: calculo.OBSTACULOS,
      hechos: movs.filter((m) => m.cantidad > 0).map((m) => ({ que: m.descripcion || m.origen, xp: m.cantidad })),
      restas: movs.filter((m) => m.cantidad < 0).map((m) => ({ que: m.descripcion || m.origen, xp: m.cantidad })),
      balance: await xp.balanceDelDia(usuarioId, f, tx),
    }
  }
  const lunes = lunesDe(f)
  const domingo = sumarDias(lunes, 6)
  const xpDias = new Map((await xp.xpPorDia(usuarioId, lunes, domingo, tx)).map((d) => [d.fecha, d.xp]))
  const porDia = []
  for (let i = 0; i < 7; i++) { const d = sumarDias(lunes, i); porDia.push({ fecha: d, xp: d > hoy ? null : xpDias.get(d) || 0 }) }
  return {
    tipo, periodo: lunes, desde: lunes, hasta: domingo, hoy, revision: await datos.revision(usuarioId, 'semanal', lunes, tx),
    porDia, xpTotal: porDia.reduce((s, d) => s + (d.xp || 0), 0),
  }
}

/** La foto que se guarda con la revisión cuando quien llama no trae una (los números de xp del momento). */
async function fotoRevision(usuarioId, tipo, fecha, tx = null) {
  const d = await datosRevision(usuarioId, tipo, fecha, tx)
  return tipo === 'diaria' ? { balance: d.balance, hechos: d.hechos.map((h) => h.que) } : { xp: d.xpTotal, porDia: d.porDia }
}

/** El «ajuste para mañana» que dejaste en la revisión de ayer: aparece arriba de Hoy. */
async function ajusteParaHoy(usuarioId, hoy = null, tx = null) {
  const h = hoy || await hoyDe(usuarioId, tx)
  const r = await datos.revision(usuarioId, 'diaria', sumarDias(h, -1), tx)
  return (r && r.respuestas && r.respuestas.ajuste) || null
}

async function ultimasRevisiones(usuarioId, tipo, cantidad = 10, tx = null) {
  return datos.revisiones(usuarioId, tipo, Math.min(100, Math.max(1, cantidad)), tx)
}

// ====================== Pantallas, siembra, importar y exportar ======================

/** Todo lo del ciclo (también lo cerrado y archivado), con la forma que recibe `importar`. Lo usa el módulo copia. */
async function exportar(usuarioId, tx = null) {
  const t = await datos.todoParaCopia(usuarioId, tx)
  // Los null pasan a «no está», como en la app vieja.
  const sinNulos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null))
  return { ...t, ciclos: t.ciclos.map(sinNulos), fases: t.fases.map(sinNulos), objetivos: t.objetivos.map(sinNulos), metas: t.metas.map(sinNulos), identidad: t.identidad || null }
}

/** Todo lo de la pantalla Ciclo: dónde estoy, fases con sus objetivos, atributos e identidad. */
async function resumen(usuarioId, tx = null) {
  const hoy = await hoyDe(usuarioId, tx)
  const donde = await diaDelCiclo(usuarioId, hoy, tx)
  const base = { hoy, atributos: await datos.atributos(usuarioId, false, tx), identidad: await identidad(usuarioId, tx), ciclosAnteriores: (await datos.ciclos(usuarioId, tx)).filter((c) => c.estado === 'cerrado') }
  if (!donde) return { ...base, ciclo: null }
  const fs = await datos.fases(usuarioId, donde.ciclo.id, tx)
  const objs = await datos.objetivos(usuarioId, donde.ciclo.id, tx)
  const fasesConTodo = fs.map((f, i) => ({
    ...f,
    desde: fechaDelDiaDelCiclo(donde.ciclo.inicio, f.diaInicio),
    hasta: fechaDelDiaDelCiclo(donde.ciclo.inicio, f.diaFin),
    actual: f.numero === donde.faseNumero && !donde.terminado && !donde.noEmpezado,
    sePuedeCerrar: !f.cerradaEn && calculo.sePuedeCerrar(f, donde.dia, i === fs.length - 1),
    objetivos: objs.filter((o) => o.faseNumero === f.numero),
  }))
  return { ...base, ...donde, fases: fasesConTodo, ajuste: await ajusteParaHoy(usuarioId, hoy, tx), metasVencidas: (await metasQueVencen(usuarioId, hoy, tx)).length }
}

/** Al crear una cuenta: identidad y los cinco atributos de fábrica. El ciclo lo empieza la persona eligiendo el Día 1. */
async function sembrar(usuarioId, tx = null) {
  return transaccion(async (t) => {
    if (!await datos.identidad(usuarioId, t)) await datos.guardarIdentidad(usuarioId, calculo.IDENTIDAD_INICIAL, ahora(), t)
    if (!(await datos.atributos(usuarioId, true, t)).length) {
      for (const a of calculo.ATRIBUTOS_INICIALES) await datos.guardarAtributo(usuarioId, { ...a, creado: ahora() }, t)
    }
  }, tx)
}

const fechaOk = (f) => typeof f === 'string' && esFechaValida(f)
const idOk = (x) => typeof x === 'string' && x.length > 0 && x.length <= 100

/**
 * Trae de «Copiar todo como texto» de la app vieja: { ciclos, fases, objetivos, atributos, identidad, metas, revisiones }.
 * Respeta los id viejos (las acciones de dia nombran los atributos por id). Lo repetido no entra.
 * Si viene más de un ciclo activo, queda activo el de número más alto. Lo usa **copia**.
 * Devuelve cuántos entraron de cada uno.
 */
async function importar(usuarioId, vieja = {}, tx = null) {
  const n = { ciclos: 0, fases: 0, objetivos: 0, atributos: 0, identidad: 0, metas: 0, revisiones: 0 }
  return transaccion(async (t) => {
    for (const a of vieja.atributos || []) {
      if (!idOk(a.id) || typeof a.nombre !== 'string' || await datos.atributoPorId(usuarioId, a.id, t)) continue
      const ventana = Number.isFinite(a.ventanaDias) ? Math.min(60, Math.max(3, a.ventanaDias)) : 14
      await datos.guardarAtributo(usuarioId, { id: a.id, nombre: a.nombre, descripcion: a.descripcion || '', orden: Number.isFinite(a.orden) ? a.orden : 0, ventanaDias: ventana, creado: Number.isFinite(a.creado) ? a.creado : ahora(), archivado: !!a.archivado }, t)
      n.atributos++
    }
    const iden = Array.isArray(vieja.identidad) ? vieja.identidad[0] : vieja.identidad
    if (iden && typeof iden.vision === 'string') {
      await datos.guardarIdentidad(usuarioId, { vision: iden.vision, obstaculos: iden.obstaculos || '' }, Number.isFinite(iden.actualizado) ? iden.actualizado : ahora(), t)
      n.identidad = 1
    }
    const lista = (vieja.ciclos || []).filter((c) => idOk(c.id) && fechaOk(c.inicio)).sort((a, b) => (a.numero || 0) - (b.numero || 0))
    const activos = lista.filter((c) => c.estado === 'activo')
    const elActivo = activos.length ? activos[activos.length - 1].id : null
    const yaActivo = await datos.cicloActivo(usuarioId, t)
    for (const c of lista) {
      const activo = c.id === elActivo && !yaActivo
      const hecho = await datos.crearCiclo(usuarioId, {
        id: c.id, numero: Number.isFinite(c.numero) ? c.numero : n.ciclos + 1, inicio: c.inicio, diaCero: fechaOk(c.diaCero) ? c.diaCero : null,
        duracionDias: Number.isFinite(c.duracionDias) ? c.duracionDias : 90, diasPorFase: Number.isFinite(c.diasPorFase) ? c.diasPorFase : 30,
        estado: activo ? 'activo' : 'cerrado', creado: Number.isFinite(c.creado) ? c.creado : ahora(), cerrado: activo ? null : (Number.isFinite(c.cerrado) ? c.cerrado : ahora()),
      }, t)
      if (hecho) n.ciclos++
    }
    for (const f of vieja.fases || []) {
      if (!idOk(f.id) || !idOk(f.cicloId) || !await datos.cicloPorId(usuarioId, f.cicloId, t) || await datos.fasePorId(usuarioId, f.id, t)) continue
      if (!Number.isFinite(f.numero) || !Number.isFinite(f.diaInicio) || !Number.isFinite(f.diaFin)) continue
      await datos.crearFase(usuarioId, f, t)
      n.fases++
    }
    for (const o of vieja.objetivos || []) {
      if (!idOk(o.id) || !idOk(o.cicloId) || !await datos.cicloPorId(usuarioId, o.cicloId, t) || await datos.objetivoPorId(usuarioId, o.id, t)) continue
      if (typeof o.titulo !== 'string' || !Number.isFinite(o.faseNumero)) continue
      await datos.guardarObjetivo(usuarioId, { ...o, atributoId: o.atributoId || '', creado: Number.isFinite(o.creado) ? o.creado : ahora() }, t)
      n.objetivos++
    }
    const TIPOS_META = ['propia', 'inicio_ciclo', 'fin_fase', 'fin_ciclo', 'revision_semanal']
    for (const m of vieja.metas || []) {
      if (!idOk(m.id) || !fechaOk(m.fecha) || typeof m.titulo !== 'string' || !TIPOS_META.includes(m.tipo)) continue
      const estado = ['pendiente', 'cumplida', 'no_cumplida'].includes(m.estado) ? m.estado : m.cumplida ? 'cumplida' : 'pendiente'
      const hecho = await datos.crearMeta(usuarioId, {
        id: m.id, fecha: m.fecha, titulo: m.titulo, tipo: m.tipo, estado, xp: Number.isFinite(m.xp) ? m.xp : null,
        resueltaEn: Number.isFinite(m.resueltaEn) ? m.resueltaEn : null, cumplidaEl: fechaOk(m.cumplidaEl) ? m.cumplidaEl : null,
        nota: m.nota || null, creado: Number.isFinite(m.creado) ? m.creado : ahora(),
      }, t)
      if (hecho) n.metas++
    }
    for (const r of vieja.revisiones || []) {
      if (!idOk(r.id) || !['diaria', 'semanal', 'fase', 'ciclo'].includes(r.tipo) || typeof r.periodo !== 'string') continue
      if (await datos.revision(usuarioId, r.tipo, r.periodo, t)) continue
      await datos.guardarRevision(usuarioId, { id: r.id, tipo: r.tipo, periodo: r.periodo, respuestas: r.respuestas || {}, foto: r.foto || {}, creado: Number.isFinite(r.creado) ? r.creado : ahora(), actualizado: Number.isFinite(r.actualizado) ? r.actualizado : ahora() }, t)
      n.revisiones++
    }
    await anotar(usuarioId, 'ciclo', 'importar', n, t)
    return n
  }, tx)
}

module.exports = {
  // ciclos y fases
  cicloActivo, ciclos, fases, diaDelCiclo, iniciarCiclo, cambiarInicio, editarFase, cerrarFase,
  // objetivos, atributos, identidad
  objetivos, guardarObjetivo, archivarObjetivo, atributos, guardarAtributo, archivarAtributo, identidad, guardarIdentidad,
  // metas
  crearMeta, editarMeta, resolverMeta, reabrirMeta, borrarMeta, resumenMetas, metasQueVencen, metasEntre,
  // revisiones
  revision, guardarRevision, datosRevision, fotoRevision, ajusteParaHoy, ultimasRevisiones, OBSTACULOS: calculo.OBSTACULOS,
  // pantalla, siembra, copia
  resumen, sembrar, importar, exportar,
}
