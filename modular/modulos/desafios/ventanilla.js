'use strict'
/**
 * Desafíos · la única puerta del módulo.
 * Tensión (la mano), «No cumplí» (caída y nuevo round), el duelo de flexiones, el Tajo al volver después de horas,
 * la frase «Dudar es fracasar» una vez por día y el 3·2·1. Guardados y apagados: ninjas, rival y batalla.
 * Lo que se ve lo dibuja la pantalla (pantallas/capa.js) con el tema elegido; acá van las reglas y los datos.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const entreno = require('../entreno/ventanilla')
const habitos = require('../habitos/ventanilla')
const { transaccion } = require('../../comun/base')
const { obtenerAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { fechaDe, esFechaValida, lunesDe } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

async function fechaHoy(usuarioId, tx) {
  return fechaDe(ahora(), (await obtenerAjustes(usuarioId, tx)).zonaHoraria)
}

// ---------- Configuración ----------

async function config(usuarioId, tx = null) {
  const f = await datos.config(usuarioId, tx)
  return calculo.completarConfig(f ? f.datos : {})
}

/** Guarda solo lo que viene, revisado. Si un dato está mal no guarda nada. Anota antes → después. */
async function cambiarConfig(usuarioId, cambios, tx = null) {
  const { limpio, error } = calculo.revisarConfig(cambios)
  if (error) throw datoInvalido(error)
  return transaccion(async (t) => {
    const antes = await config(usuarioId, t)
    const mezcla = {}
    for (const [k, v] of Object.entries(limpio)) {
      mezcla[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...antes[k], ...v } : v
    }
    await datos.guardarConfig(usuarioId, mezcla, ahora(), t)
    const despues = await config(usuarioId, t)
    const cambio = {}
    for (const k of Object.keys(mezcla)) cambio[k] = { antes: antes[k], despues: despues[k] }
    await anotar(usuarioId, 'desafios', 'config', cambio, t)
    return despues
  }, tx)
}

// ---------- Al abrir una pantalla: la frase del día y el Tajo ----------

/** Anota que la app estuvo a la vista ahora (al ocultarse o cerrarse la pantalla). */
async function vista(usuarioId, tx = null) {
  await datos.guardarMarcas(usuarioId, { ultimaVista: ahora() }, tx)
}

/**
 * Lo que toca mostrar al llegar a una pantalla (lo pide Hoy). Lo que devuelve en `true` queda marcado como mostrado hoy
 * (una vez por día). Lo que no sabe desafios lo cuenta quien pregunta (lo sabe **dia** / **sueno**):
 * `pilarPendiente` (hay un pilar sin hacer), `pasoDejoCelu` (ya pasó la hora de dejar el celu), `modoSueno`.
 * Devuelve { frase, tajo, tension: { activa, kanji, frase } } y deja la última vista en «ahora».
 */
async function llegada(usuarioId, { pilarPendiente = false, pasoDejoCelu = false, modoSueno = false } = {}, tx = null) {
  return transaccion(async (t) => {
    const c = await config(usuarioId, t)
    const f = await datos.config(usuarioId, t)
    const hoy = await fechaHoy(usuarioId, t)
    const tiempo = ahora()
    const frase = c.fraseDelDia && !modoSueno && (!f || f.frase_dia !== hoy)
    const tajo = !!c.tajo.activo && !modoSueno && calculo.debeMostrarTajo({
      ultimaVista: f ? f.ultima_vista : null, ahora: tiempo, pilarPendiente: !!pilarPendiente, pasoDejoCelu: !!pasoDejoCelu,
      mostradoHoy: !!f && f.tajo_dia === hoy, horas: c.tajo.horas,
    })
    await datos.guardarMarcas(usuarioId, { ultimaVista: tiempo, ...(frase ? { fraseDia: hoy } : {}), ...(tajo ? { tajoDia: hoy } : {}) }, t)
    return { frase, tajo, tension: c.tension }
  }, tx)
}

/**
 * Para la pantalla Hoy (módulo **dia**, conectado en app.js sin requerir esta ventanilla):
 * { tension: { ruta, activa, kanji }, noCumpli: { ruta }, tresDosUno: { ruta }, pendientes: [] }.
 * Las rutas abren una pantalla de desafios que hace todo y vuelve a Hoy. `pendientes` queda vacío por ahora.
 */
async function pendientes(usuarioId, tx = null) {
  const c = await config(usuarioId, tx)
  return {
    tension: { ruta: '/desafios/tension?volver=/hoy', activa: c.tension.activa, kanji: c.tension.kanji },
    noCumpli: { ruta: '/desafios/no-cumpli?volver=/hoy' },
    tresDosUno: { ruta: '/desafios/321?volver=/hoy' },
    pendientes: [],
  }
}

// ---------- Duelo de flexiones ----------

function revisarMotivo(motivo) {
  if (!calculo.MOTIVOS_DUELO.includes(motivo)) throw datoInvalido('El motivo del duelo es «tension», «caida» o «rival».')
}

/** Cuántas flexiones pide y de qué serie: { motivo, reps, contadorId, nombre }. «No cumplí» pide la serie más la mitad. */
async function configDuelo(usuarioId, motivo, tx = null) {
  revisarMotivo(motivo)
  const c = await config(usuarioId, tx)
  const contador = calculo.elegirContador(await entreno.listarContadores(usuarioId, {}, tx), c.duelo.contadorId)
  const reps = calculo.repsDuelo(contador && contador.cantidadPorToque, motivo, c.duelo.repsSinSerie)
  return { motivo, reps, contadorId: contador ? contador.id : null, nombre: contador ? contador.nombre : 'Flexiones' }
}

/** Hechas: una serie en la serie rápida con esas reps (su XP y sus topes, igual que cargarla a mano). Sin serie no anota nada. */
async function anotarDuelo(usuarioId, motivo, reps = null, tx = null) {
  return transaccion(async (t) => {
    const d = await configDuelo(usuarioId, motivo, t)
    const n = reps === null || reps === undefined ? d.reps : Math.round(Number(reps))
    if (!(n > 0 && n <= 500)) throw datoInvalido('Las flexiones van de 1 a 500.')
    if (!d.contadorId) return { reps: n, xp: 0, nuevoNivel: null, nombre: d.nombre, anotado: false }
    const r = await entreno.sumarToque(usuarioId, d.contadorId, n, calculo.NOTA_DUELO[motivo], t)
    await anotar(usuarioId, 'desafios', 'duelo', { motivo, reps: n }, t)
    return { reps: n, xp: r.xp || 0, nuevoNivel: r.nuevoNivel || null, nombre: d.nombre, anotado: true }
  }, tx)
}

// ---------- Tensión y «No cumplí» (la caída la guarda habitos) ----------

/** XP que saca una caída (para el «¿Seguro? Perdés N XP»). Es el ajuste `caida` de habitos. */
async function xpDeCaida(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const v = a.caida && Number(a.caida.xp)
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 20
}

/** «No cumplí mi palabra»: la caída de hoy (marca + −XP) y el duelo que sigue (la serie más la mitad). */
async function noCumpli(usuarioId, fecha = null, tx = null) {
  if (fecha !== null && !esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  return transaccion(async (t) => {
    const caida = await habitos.registrarCaida(usuarioId, { origen: 'boton', fecha }, t)
    return { caida, duelo: await configDuelo(usuarioId, 'caida', t) }
  }, tx)
}

/** Tensión, «No le doy la mano»: la caída (origen tension) y el duelo con la serie. */
async function tensionSoltar(usuarioId, tx = null) {
  return transaccion(async (t) => {
    const caida = await habitos.registrarCaida(usuarioId, { origen: 'tension' }, t)
    return { caida, duelo: await configDuelo(usuarioId, 'tension', t) }
  }, tx)
}

/** «Deshacer» (los 10 s después de la caída): quita la marca y devuelve la XP. */
async function deshacerCaida(usuarioId, id, tx = null) {
  const ok = await habitos.deshacerCaida(usuarioId, id, tx)
  if (!ok) throw noEncontrado('Esa caída')
  return true
}

// ---------- 3·2·1 ----------

const aInicio = (f) => f && {
  id: f.id, fecha: f.fecha, creado: f.creado, iniciado: f.iniciado ?? undefined, terminado: f.terminado ?? undefined,
  resultado: f.resultado ?? undefined, accion: f.accion, tareaAmbigua: f.tarea_ambigua || '', compromisoId: f.compromiso_id ?? undefined,
  segundosHastaEmpezar: f.segundos_hasta_empezar ?? undefined,
}

/**
 * «Empecé» al terminar la cuenta 3·2·1. Si viene `id` (una acción guardada antes), la marca iniciada; si no, crea el registro.
 * Da XP (5) con tope por día (3); la misma acción no cobra dos veces el mismo día.
 * Avisa `desafios.inicio` (dia pasa el compromiso a «iniciado»). Devuelve { inicio, xp, nuevoNivel, motivoSinXp? }.
 */
async function registrarInicio(usuarioId, { id = null, accion, tareaAmbigua = '', compromisoId = null } = {}, tx = null) {
  const texto = String(accion || '').trim()
  if (!texto) throw datoInvalido('Escribí qué vas a empezar.')
  if (texto.length > 120) throw datoInvalido('La acción: hasta 120 letras.')
  return transaccion(async (t) => {
    const tiempo = ahora()
    const hoy = await fechaHoy(usuarioId, t)
    let fila
    if (id) {
      const previo = await datos.inicioPorId(usuarioId, id, t)
      if (!previo) throw noEncontrado('Esa acción')
      fila = await datos.marcarIniciado(usuarioId, id, tiempo, Math.round((tiempo - previo.creado) / 1000), t)
    } else {
      fila = await datos.crearInicio(usuarioId, { fecha: hoy, creado: tiempo, iniciado: tiempo, segundosHastaEmpezar: 0, accion: texto, tareaAmbigua, compromisoId }, t)
    }
    const inicio = aInicio(fila)
    await anotar(usuarioId, 'desafios', 'inicio', { despues: inicio }, t)
    await avisar('desafios.inicio', { usuarioId, inicioId: inicio.id, fecha: hoy, accion: inicio.accion, compromisoId: inicio.compromisoId || null }, t)

    const c = await config(usuarioId, t)
    const ya = (await xp.delDia(usuarioId, hoy, t)).filter((r) => r.origen === 'inicio' && !r.anulado).length
    if (ya >= c.inicio.maxPorDia) return { inicio, xp: 0, nuevoNivel: null, motivoSinXp: `Tope de ${c.inicio.maxPorDia} inicios con XP por día` }
    if (!(c.inicio.xp > 0)) return { inicio, xp: 0, nuevoNivel: null }
    const r = await xp.sumar(usuarioId, {
      clave: xp.claveXp('inicio', [calculo.normalizar(inicio.accion), hoy]), cantidad: c.inicio.xp, origen: 'inicio', fecha: hoy,
      descripcion: `Inicio: ${inicio.accion}`,
    }, t)
    return { inicio, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel || null, motivoSinXp: r.concedido ? undefined : 'Esa acción ya sumó XP hoy' }
  }, tx)
}

/** Guarda una acción concreta para empezar después (la usa «Siguiente acción»). */
async function guardarAccion(usuarioId, { accion, tareaAmbigua = '', compromisoId = null }, tx = null) {
  const texto = String(accion || '').trim()
  if (!texto || texto.length > 120) throw datoInvalido('La acción: entre 1 y 120 letras.')
  const fila = await datos.crearInicio(usuarioId, { fecha: await fechaHoy(usuarioId, tx), creado: ahora(), accion: texto, tareaAmbigua, compromisoId }, tx)
  return aInicio(fila)
}

/** Cómo terminó: 'hecha' | 'parcial' | 'no_hecha'. */
async function cerrarInicio(usuarioId, id, resultado, tx = null) {
  if (!['hecha', 'parcial', 'no_hecha'].includes(resultado)) throw datoInvalido('El resultado es «hecha», «parcial» o «no_hecha».')
  const f = await datos.cerrarInicio(usuarioId, id, resultado, ahora(), tx)
  if (!f) throw noEncontrado('Esa acción')
  return aInicio(f)
}

async function iniciosRecientes(usuarioId, cantidad = 30, tx = null) {
  return (await datos.iniciosRecientes(usuarioId, cantidad, tx)).map(aInicio)
}

/** Inicios entre dos fechas (para **progreso** y el cierre de fase: «3-2-1 usados»). */
async function iniciosEntre(usuarioId, desde, hasta, tx = null) {
  return (await datos.iniciosEntre(usuarioId, desde, hasta, tx)).map(aInicio)
}

// ---------- Ninjas, batalla y rival (archivado: apagado si `ninjas` es false) ----------

const aPelea = (f) => f && {
  id: f.id, fecha: f.fecha, instante: f.instante, distraccion: f.distraccion, momento: f.momento, resultado: f.resultado,
  pilar: f.pilar ?? undefined, reps: f.reps ?? undefined, robo: f.robo ?? undefined,
}

async function peleasDelDia(usuarioId, fecha, tx = null) {
  return (await datos.peleasEntre(usuarioId, fecha, fecha, tx)).map(aPelea)
}

/** Arma una pelea si corresponde: ninjas prendidos, lista no vacía, tope del día. `momento` = { momento, pilar? }. */
async function prepararPelea(usuarioId, fecha, momento, azar = Math.random, tx = null) {
  const c = await config(usuarioId, tx)
  if (!c.ninjas || !c.distracciones.length || !momento) return null
  const hoy = await peleasDelDia(usuarioId, fecha, tx)
  if (!calculo.puedeAparecer(hoy, momento.momento)) return null
  const ninja = calculo.elegirNinja(c.distracciones, momento.momento, hoy.map((p) => p.distraccion), azar)
  return ninja ? { fecha, distraccion: ninja, momento } : null
}

/** Sello del día: vencido o se escapó. */
async function registrarPelea(usuarioId, pelea, resultado, extra = {}, tx = null) {
  if (resultado !== 'vencido' && resultado !== 'escapo') throw datoInvalido('El resultado es «vencido» o «escapo».')
  const f = await datos.crearPelea(usuarioId, {
    fecha: pelea.fecha, instante: ahora(), distraccion: pelea.distraccion.id, momento: pelea.momento.momento, resultado,
    pilar: pelea.momento.pilar ? pelea.momento.pilar.id : null, reps: extra.reps || null, robo: extra.robo || null,
  }, tx)
  return aPelea(f)
}

/** Batalla (botón «Dudo»): objetivo con la serie de flexiones; tope de 3 por día salvo que venga de atrapar al rival. */
async function prepararBatalla(usuarioId, fecha, { distraccionId = null, desdeRival = false, azar = Math.random } = {}, tx = null) {
  const c = await config(usuarioId, tx)
  if (!c.ninjas) return { motivo: 'Los ninjas están guardados (apagados).' }
  if (!c.batalla.activa && !desdeRival) return { motivo: 'La batalla está apagada.' }
  if (!c.distracciones.length) return { motivo: 'Sin distracciones en la lista.' }
  const hoy = await peleasDelDia(usuarioId, fecha, tx)
  const hechas = hoy.filter((p) => p.momento === 'batalla').length
  if (hechas >= calculo.TOPE_BATALLAS_DIA && !desdeRival) return { motivo: `Batallas hoy: ${hechas} de ${calculo.TOPE_BATALLAS_DIA}. Mañana hay más.` }
  const duelo = await configDuelo(usuarioId, 'rival', tx)
  const rival = (distraccionId && c.distracciones.find((d) => d.id === distraccionId)) ||
    calculo.elegirNinja(c.distracciones, 'batalla', hoy.map((p) => p.distraccion), azar) || c.distracciones[0]
  const objetivo = calculo.objetivoBatalla(duelo.contadorId ? duelo.reps : null, c.batalla.repsPorToque)
  return { batalla: { pelea: { fecha, distraccion: rival, momento: { momento: 'batalla' } }, objetivo, duelo } }
}

/** Victoria: sello del día + una serie con las reps (la batalla no da XP extra: es la XP de la serie). */
async function terminarBatalla(usuarioId, batalla, repsHechas = null, tx = null) {
  return transaccion(async (t) => {
    const reps = repsHechas > 0 ? Math.round(repsHechas) : batalla.objetivo
    const pelea = await registrarPelea(usuarioId, batalla.pelea, 'vencido', { reps }, t)
    const r = await anotarDuelo(usuarioId, 'rival', reps, t)
    return { pelea, reps, xp: r.xp, nuevoNivel: r.nuevoNivel }
  }, tx)
}

/** «Me rindo»: se escapó; no se anota nada y no resta. */
async function rendirse(usuarioId, batalla, tx = null) {
  return registrarPelea(usuarioId, batalla.pelea, 'escapo', {}, tx)
}

/** El rival ignorado se lleva XP (10 por defecto, 0 a 30). Nunca baja de nivel. */
async function robarXp(usuarioId, pelea, cantidad = null, tx = null) {
  return transaccion(async (t) => {
    const c = await config(usuarioId, t)
    const pedido = cantidad ?? calculo.xpRoboDe(c.rival)
    const robado = calculo.roboPosible((await xp.estado(usuarioId, t)).xpEnNivel, pedido)
    const p = await registrarPelea(usuarioId, pelea, 'escapo', robado > 0 ? { robo: robado } : {}, t)
    if (robado > 0) {
      await xp.restar(usuarioId, { clave: xp.claveXp('rival', [pelea.fecha, p.id]), cantidad: robado, origen: 'rival', fecha: pelea.fecha, descripcion: `${pelea.distraccion.nombre} se llevó ${robado} XP` }, t)
    }
    return { pelea: p, robado, pedido }
  }, tx)
}

/** Para progreso: ninjas vencidos esta semana (lunes a hoy). */
async function ninjasVencidosSemana(usuarioId, hoy, tx = null) {
  const lista = await datos.peleasEntre(usuarioId, lunesDe(hoy), hoy, tx)
  return { vencidos: lista.filter((p) => p.resultado === 'vencido').length, peleas: lista.length }
}

/** Chips del día (vencido / duda / escapado / robo). Vencido = reps y además un 3·2·1 después de la pelea. */
async function chipsDelDia(usuarioId, fecha, diaTerminado = false, tx = null) {
  const peleas = await peleasDelDia(usuarioId, fecha, tx)
  const inicios = await datos.iniciosEntre(usuarioId, fecha, fecha, tx)
  const ultimaAccion = Math.max(0, ...inicios.map((i) => i.iniciado || 0))
  return peleas.map((p) => ({ pelea: p, estado: calculo.estadoChip(p, { ultimaAccion, diaTerminado }) }))
}

// ---------- Resumen, copia ----------

/** Todo lo de la pantalla Desafíos. */
async function resumen(usuarioId, tx = null) {
  const hoy = await fechaHoy(usuarioId, tx)
  const [c, inicios, xpCaida, contadores, caidas] = await Promise.all([
    config(usuarioId, tx),
    iniciosRecientes(usuarioId, 10, tx),
    xpDeCaida(usuarioId, tx),
    entreno.listarContadores(usuarioId, {}, tx),
    habitos.caidasDelDia(usuarioId, hoy, tx),
  ])
  const iniciosHoy = inicios.filter((i) => i.fecha === hoy && i.iniciado).length
  return {
    hoy, config: c, xpCaida, iniciosHoy, inicios, caidasHoy: caidas.length,
    series: contadores.map((x) => ({ id: x.id, nombre: x.nombre, reps: x.cantidadPorToque })),
    duelo: { tension: await configDuelo(usuarioId, 'tension', tx), caida: await configDuelo(usuarioId, 'caida', tx) },
  }
}

/**
 * Trae lo de una copia de la app vieja («Copiar todo como texto»): `ninjas` (peleas), `siguienteAccion` (3·2·1) y los
 * ajustes viejos `tension`, `batalla`, `rival`, `distracciones`, `ninjas`. Lo repetido no entra. Lo usa **copia**.
 * Devuelve { peleas, inicios }.
 */
async function importar(usuarioId, viejo = {}, tx = null) {
  return transaccion(async (t) => {
    const zona = (await obtenerAjustes(usuarioId, t)).zonaHoraria
    let peleas = 0
    for (const p of viejo.ninjas || []) {
      if (!p || !Number.isFinite(p.instante) || !p.distraccion || !esFechaValida(p.fecha)) continue
      if (!['vencido', 'escapo'].includes(p.resultado)) continue
      if (await datos.peleaIgual(usuarioId, p, t)) continue
      await datos.crearPelea(usuarioId, { ...p, momento: calculo.MOMENTOS.includes(p.momento) ? p.momento : 'duda' }, t)
      peleas++
    }
    let inicios = 0
    for (const s of viejo.siguienteAccion || []) {
      if (!s || !Number.isFinite(s.creado) || !String(s.accionConcreta || '').trim()) continue
      if (Number.isInteger(s.id) && (await datos.inicioViejo(usuarioId, s.id, t))) continue
      await datos.crearInicio(usuarioId, {
        fecha: fechaDe(s.iniciado || s.creado, zona), creado: s.creado, iniciado: s.iniciado, terminado: s.terminado,
        resultado: ['hecha', 'parcial', 'no_hecha'].includes(s.resultado) ? s.resultado : null,
        accion: String(s.accionConcreta).trim().slice(0, 120), tareaAmbigua: String(s.tareaAmbigua || '').slice(0, 200),
        compromisoId: s.compromisoId, segundosHastaEmpezar: Number.isFinite(s.segundosHastaEmpezar) ? Math.round(s.segundosHastaEmpezar) : null,
        idViejo: Number.isInteger(s.id) ? s.id : null,
      }, t)
      inicios++
    }
    const a = viejo.ajustes || {}
    const cambios = {}
    if (a.tension) cambios.tension = { ...(a.tension.kanji ? { kanji: a.tension.kanji } : {}), ...(typeof a.tension.frase === 'string' ? { frase: a.tension.frase } : {}) }
    if (typeof a.ninjas === 'boolean') cambios.ninjas = a.ninjas
    if (Array.isArray(a.distracciones)) cambios.distracciones = a.distracciones
    if (a.batalla) cambios.batalla = { ...(typeof a.batalla.activa === 'boolean' ? { activa: a.batalla.activa } : {}), ...(a.batalla.repsPorToque ? { repsPorToque: a.batalla.repsPorToque } : {}) }
    if (a.batalla && a.batalla.repsSinSerie) cambios.duelo = { repsSinSerie: a.batalla.repsSinSerie }
    if (a.rival) cambios.rival = { ...(a.rival.modo ? { modo: a.rival.modo } : {}), ...(Number.isInteger(a.rival.xpRobo) ? { xpRobo: a.rival.xpRobo } : {}) }
    if (Number.isInteger(a.xpInicio) || Number.isInteger(a.maxIniciosXpPorDia)) {
      cambios.inicio = { ...(Number.isInteger(a.xpInicio) ? { xp: a.xpInicio } : {}), ...(Number.isInteger(a.maxIniciosXpPorDia) ? { maxPorDia: a.maxIniciosXpPorDia } : {}) }
    }
    // Lo que no pasa la revisión se saltea de a un grupo, sin frenar lo demás.
    for (const [k, v] of Object.entries(cambios)) {
      if (!calculo.revisarConfig({ [k]: v }).error) await cambiarConfig(usuarioId, { [k]: v }, t)
    }
    return { peleas, inicios }
  }, tx)
}

/** Todo lo del módulo, para **copia**. */
async function exportar(usuarioId, tx = null) {
  return {
    config: await config(usuarioId, tx),
    inicios: (await datos.todosLosInicios(usuarioId, tx)).map(aInicio),
    ninjas: (await datos.todasLasPeleas(usuarioId, tx)).map(aPelea),
  }
}

module.exports = {
  config, cambiarConfig,
  vista, llegada, pendientes,
  configDuelo, anotarDuelo,
  xpDeCaida, noCumpli, tensionSoltar, deshacerCaida,
  registrarInicio, guardarAccion, cerrarInicio, iniciosRecientes, iniciosEntre,
  peleasDelDia, prepararPelea, registrarPelea, prepararBatalla, terminarBatalla, rendirse, robarXp, ninjasVencidosSemana, chipsDelDia,
  momentoActivo: calculo.momentoActivo, accionDePelea: calculo.accionDePelea, fraseDePelea: calculo.fraseDePelea,
  resumen, importar, exportar,
}
