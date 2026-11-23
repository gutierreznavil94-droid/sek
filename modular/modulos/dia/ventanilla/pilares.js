'use strict'
/**
 * Dia · pilares y cierre del día (parte 1). La puerta del módulo es ventanilla/index.js.
 * Los pilares y compromisos de cada día (cumplir, tarde, omitir, extra, deshacer, corregir), el cierre de los días
 * pendientes (lo sin marcar queda omitido, límite de juego, comida, lo no cumplido resta, racha de 7), cumplimiento,
 * racha, atributos, excepciones y el Tajo. Las cuentas están en calculo.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 *
 * Usa por su ventanilla: xp, ciclo y juego. Lo de sueno, comida y entreno le llega por avisos
 * (`escucharAvisos`) y por `conectar` (funciones que app.js le pasa), así dia no depende de módulos que
 * se suman después.
 */
const crypto = require('node:crypto')
const datos = require('../datos')
const calculo = require('../calculo')
const xp = require('../../xp/ventanilla')
const ciclo = require('../../ciclo/ventanilla')
const juego = require('../../juego/ventanilla')
const { transaccion } = require('../../../comun/base')
const { obtenerAjustes } = require('../../../comun/ajustes')
const { anotar } = require('../../../comun/historial')
const { escuchar } = require('../../../comun/eventos')
const { ahora } = require('../../../comun/reloj')
const { fechaDe, instanteDe, sumarDias, diaSemanaDe, esFechaValida } = require('../../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../../comun/errores')

const nuevoId = (prefijo) => `${prefijo}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
const { idCompromiso, ID_PILAR_COMIDA } = calculo

// ---------- Lo que app.js le conecta (módulos que dia no requiere directo) ----------

/**
 * Funciones de otros módulos que dia usa si están conectadas (las pone app.js):
 * - `planComida(u, fecha, tx)` → `{ cumplido, kcal, proteina }` o null (comida.planDelDia).
 * - `faltantesSeries(u, fecha, tx)` → `[{ id, nombre, xp, tipo: 'serie' }]` (entreno.faltantesDelDia).
 * - `seriesParaAtributos(u, desde, hasta, tx)` → `[{ accionId, fecha, estado, peso, atributoIds }]` (cuando entreno lo ofrezca).
 */
const fuentes = { planComida: null, faltantesSeries: null, seriesParaAtributos: null }
function conectar(cambios = {}) {
  for (const [k, fn] of Object.entries(cambios)) if (k in fuentes && (fn === null || typeof fn === 'function')) fuentes[k] = fn
}

// ---------- Ayudas ----------

async function aj(usuarioId, tx) {
  const a = await obtenerAjustes(usuarioId, tx)
  // Horas de la noche: las guarda sueno en los ajustes; si todavía no están, las de la app vieja.
  return { horaCorteNoche: '06:00', horaDejarCelu: '21:15', horaLimiteCelu: '22:15', horaAlistarse: '20:50', ...a }
}
const hoyDe = async (usuarioId, tx) => fechaDe(ahora(), (await obtenerAjustes(usuarioId, tx)).zonaHoraria)
const primerDia = (c) => c.diaCero || c.inicio
function revisarFecha(f, que = 'La fecha') { if (!esFechaValida(f)) throw datoInvalido(`${que} no es válida.`) }

async function xpDeAccion(usuarioId, accion, fecha, a, tx) {
  const regla = calculo.reglaVigente(await datos.reglasDe(usuarioId, accion.id, tx), fecha)
  return { regla, cantidad: regla ? regla.xp : accion.tipo === 'compromiso' ? a.xpCompromisoPorDefecto : 0 }
}
const claveDeCompromiso = (accion, fecha) => xp.claveXp(calculo.origenDe(accion.tipo), [accion.id, fecha])
const claveDeExtra = (accion, fecha) => xp.claveXp('extra', [accion.id, fecha])

async function compromisoYAccion(usuarioId, id, tx) {
  const c = await datos.compromiso(usuarioId, id, tx)
  if (!c) throw noEncontrado('Ese compromiso')
  const accion = await datos.accion(usuarioId, c.accionId, tx)
  if (!accion) throw noEncontrado('Esa acción')
  return { c, accion }
}

async function cambiarEstado(usuarioId, id, cambios, tipo = 'editar', motivo, tx) {
  const antes = await datos.compromiso(usuarioId, id, tx)
  if (!antes) throw noEncontrado('Ese compromiso')
  const despues = await datos.ponerCompromiso(usuarioId, { ...antes, ...cambios, id, actualizado: ahora() }, tx)
  await anotar(usuarioId, 'dia', tipo, { id, antes: antes.estado, despues: despues.estado, motivo }, tx)
  return despues
}

// ---------- Acciones (pilares y compromisos configurables) ----------

const OPCIONES = ['condicion', 'pregunta', 'horasPorDia', 'minutosMinimos', 'minutosExtra', 'xpExtra', 'duracionMinutos', 'horaLimiteInicio', 'avisoInicio', 'objetivoIds']

async function acciones(usuarioId, tx = null) { return datos.acciones(usuarioId, tx) }

/** Las acciones con su XP vigente hoy (para la pantalla de configuración). */
async function accionesConXp(usuarioId, tx = null) {
  const a = await aj(usuarioId, tx)
  const hoy = await hoyDe(usuarioId, tx)
  const r = []
  for (const x of await datos.acciones(usuarioId, tx)) r.push({ ...x, xp: (await xpDeAccion(usuarioId, x, hoy, a, tx)).cantidad })
  return r
}

/**
 * Crea o edita una acción. Si viene `xp`, la XP cambia desde hoy (lo ganado no cambia).
 * Los compromisos pendientes desde hoy se acomodan a los días y horas nuevos; lo pasado no se toca.
 */
async function guardarAccion(usuarioId, a, { xp: cantidad } = {}, tx = null) {
  const errores = calculo.validarAccion(a || {})
  if (errores.length) throw datoInvalido(errores.join(' '))
  return transaccion(async (t) => {
    const antes = await datos.accion(usuarioId, a.id, t)
    const opciones = {}
    for (const k of OPCIONES) if (a[k] !== undefined && a[k] !== null && a[k] !== '') opciones[k] = a[k]
    const fila = { ...a, nombre: String(a.nombre).trim(), orden: a.orden ?? antes?.orden ?? (await datos.cuantasAcciones(usuarioId, t)) + 1, creado: antes?.creado ?? ahora() }
    await datos.guardarAccion(usuarioId, fila, opciones, t)
    await anotar(usuarioId, 'dia', antes ? 'editar_accion' : 'crear_accion', { id: a.id }, t)
    const hoy = await hoyDe(usuarioId, t)
    if (cantidad !== undefined) await cambiarXp(usuarioId, a.id, cantidad, hoy, t)
    const despues = await datos.accion(usuarioId, a.id, t)
    await sincronizarFuturos(usuarioId, despues, hoy, t)
    return despues
  }, tx)
}

async function sincronizarFuturos(usuarioId, a, hoy, tx) {
  for (const c of await datos.compromisosDeAccionDesde(usuarioId, a.id, hoy, tx)) {
    if (c.estado !== 'pendiente') continue
    const ds = diaSemanaDe(c.fecha)
    if (!a.activa || !a.dias.includes(ds)) await datos.borrarCompromiso(usuarioId, c.id, tx)
    else await datos.ponerCompromiso(usuarioId, { ...c, horaPrevista: a.horasPorDia?.[ds] ?? a.hora, actualizado: ahora() }, tx)
  }
  if (a.activa) await generarCompromisos(usuarioId, hoy, tx)
}

/** Prende o apaga una acción (no se borra: su historia queda). */
async function activarAccion(usuarioId, id, activa, tx = null) {
  return transaccion(async (t) => {
    const a = await datos.accion(usuarioId, id, t)
    if (!a) throw noEncontrado('Esa acción')
    await datos.activarAccion(usuarioId, id, !!activa, t)
    await anotar(usuarioId, 'dia', activa ? 'activar_accion' : 'desactivar_accion', { id }, t)
    await sincronizarFuturos(usuarioId, { ...a, activa: !!activa }, await hoyDe(usuarioId, t), t)
    return datos.accion(usuarioId, id, t)
  }, tx)
}

/** Nueva regla de XP desde `desde`. Si ya hay una que empieza ese día, la cambia. */
async function cambiarXp(usuarioId, accionId, cantidad, desde = null, tx = null) {
  if (!Number.isFinite(cantidad) || cantidad < 0) throw datoInvalido('La XP tiene que ser 0 o más.')
  const f = desde || await hoyDe(usuarioId, tx)
  revisarFecha(f)
  const r = await datos.guardarRegla(usuarioId, { id: nuevoId('regla'), accionId, xp: Math.floor(cantidad), validaDesde: f, creado: ahora() }, tx)
  await anotar(usuarioId, 'dia', 'regla_xp', { accionId, xp: r.xp, desde: f }, tx)
  return r
}

async function reglasDe(usuarioId, accionId, tx = null) { return datos.reglasDe(usuarioId, accionId, tx) }

/** Prende o apaga el pilar «Comer según el plan» (15 XP). Arranca apagado. */
async function activarPilarComida(usuarioId, activo, tx = null) {
  return transaccion(async (t) => {
    const existe = await datos.accion(usuarioId, ID_PILAR_COMIDA, t)
    const hoy = await hoyDe(usuarioId, t)
    if (!existe) {
      if (!activo) return null
      await datos.guardarAccion(usuarioId, { ...calculo.ACCION_COMIDA, creado: ahora() }, { condicion: calculo.ACCION_COMIDA.condicion }, t)
      await cambiarXp(usuarioId, ID_PILAR_COMIDA, calculo.XP_INICIAL[ID_PILAR_COMIDA], hoy, t)
      await anotar(usuarioId, 'dia', 'crear_accion', { id: ID_PILAR_COMIDA }, t)
      await generarCompromisos(usuarioId, hoy, t)
      return datos.accion(usuarioId, ID_PILAR_COMIDA, t)
    }
    return activarAccion(usuarioId, ID_PILAR_COMIDA, activo, t)
  }, tx)
}

// ---------- Compromisos del día ----------

/** Crea los compromisos de una fecha según las acciones activas. Idempotente. Antes del Día 1 (o Día 0) no crea nada. */
async function generarCompromisos(usuarioId, fecha, tx = null) {
  revisarFecha(fecha)
  const c = await ciclo.cicloActivo(usuarioId, tx)
  if (!c || fecha < primerDia(c)) return []
  const ds = diaSemanaDe(fecha)
  const { zonaHoraria } = await obtenerAjustes(usuarioId, tx)
  const nuevos = []
  for (const a of await datos.acciones(usuarioId, tx)) {
    if (!a.activa || !calculo.TIPOS.includes(a.tipo) || !a.dias.includes(ds)) continue
    if (fechaDe(a.creado, zonaHoraria) > fecha) continue // una acción nueva no se programa hacia atrás
    const comp = { id: idCompromiso(a.id, fecha), accionId: a.id, fecha, horaPrevista: a.horasPorDia?.[ds] ?? a.hora, estado: 'pendiente', actualizado: ahora() }
    if (await datos.crearCompromiso(usuarioId, comp, tx)) nuevos.push(comp)
  }
  return nuevos
}

/** Los compromisos de una fecha con su acción y la XP que darían, ordenados por hora. */
async function compromisosDelDia(usuarioId, fecha, tx = null) {
  revisarFecha(fecha)
  const a = await aj(usuarioId, tx)
  const porId = new Map((await datos.acciones(usuarioId, tx)).map((x) => [x.id, x]))
  const r = []
  for (const c of await datos.compromisosEntre(usuarioId, fecha, fecha, tx)) {
    const accion = porId.get(c.accionId)
    if (!accion) continue
    r.push({ ...c, accion, xpPrevisto: (await xpDeAccion(usuarioId, accion, fecha, a, tx)).cantidad })
  }
  return r.sort((x, y) => (x.horaPrevista ?? '99').localeCompare(y.horaPrevista ?? '99') || x.accion.orden - y.accion.orden)
}

async function iniciar(usuarioId, id, tx = null) {
  return transaccion((t) => cambiarEstado(usuarioId, id, { estado: 'iniciado', inicioReal: ahora() }, 'editar', null, t), tx)
}

/**
 * Cumple un compromiso y da su XP (una sola vez). Después de la hora límite (+ margen) queda «tarde», sin XP.
 * Con menos minutos que el mínimo cuenta como hecho pero sin XP. Los compromisos sueltos tienen tope de XP por día.
 * «Dormir a horario» no se marca acá: lo marca «Dejo celu» (módulo sueno, que da su XP).
 * opciones: { minutos, nota, respuesta, instante, tarde: { minutos, motivo }, esCorreccion, motivo }.
 * Devuelve { compromiso, xp, nuevoNivel, motivoSinXp? }.
 */
async function completar(usuarioId, id, opciones = {}, tx = null) {
  return transaccion(async (t) => {
    const { c: antes, accion } = await compromisoYAccion(usuarioId, id, t)
    if (accion.tipo === 'acostarse' && !opciones.desdeSueno) throw datoInvalido('«Dormir a horario» se marca con «Dejo celu».')
    const a = await aj(usuarioId, t)
    const instante = opciones.instante ?? ahora()
    const limite = accion.horaLimite && accion.tipo !== 'acostarse' ? instanteDe(antes.fecha, accion.horaLimite, a.zonaHoraria) + a.margenNocheMinutos * 60000 : null
    const retraso = opciones.tarde ? Math.max(1, Math.round(opciones.tarde.minutos) || 1) : limite !== null && instante > limite ? Math.round((instante - limite) / 60000) : null
    const compromiso = await cambiarEstado(usuarioId, id, {
      estado: retraso ? 'tarde' : 'completado', finReal: instante, inicioReal: antes.inicioReal ?? instante,
      minutos: opciones.minutos, nota: opciones.nota, respuesta: opciones.respuesta, retrasoMinutos: retraso ?? undefined,
    }, opciones.esCorreccion ? 'corregir' : 'editar', opciones.motivo, t)
    const sin = (motivoSinXp) => ({ compromiso, xp: 0, nuevoNivel: null, motivoSinXp })
    if (accion.tipo === 'acostarse') return sin('La XP de «Dejo celu» la da sueño')
    if (retraso) {
      await xp.anular(usuarioId, claveDeCompromiso(accion, antes.fecha), `Marcado ${retraso} min después de la hora límite`, t)
      return sin(opciones.tarde ? opciones.tarde.motivo : `Marcado ${retraso} min después de las ${calculo.horaFinMargen(accion.horaLimite, a.margenNocheMinutos)}: cuenta como tarde, sin XP`)
    }
    if (accion.minutosMinimos && opciones.minutos !== undefined && opciones.minutos < accion.minutosMinimos) {
      return sin(`Menos de ${accion.minutosMinimos} minutos: cuenta como hecho pero sin XP`)
    }
    const { cantidad } = await xpDeAccion(usuarioId, accion, antes.fecha, a, t)
    if (accion.tipo === 'compromiso') {
      const conXp = (await xp.delDia(usuarioId, antes.fecha, t)).filter((r) => r.origen === 'compromiso' && !r.anulado && r.clave !== claveDeCompromiso(accion, antes.fecha)).length
      if (conXp >= a.maxCompromisosXpPorDia) return sin(`Tope de ${a.maxCompromisosXpPorDia} compromisos con XP por día alcanzado`)
    }
    if (cantidad <= 0) return sin('Esta acción no da XP')
    const r = await xp.sumar(usuarioId, { clave: claveDeCompromiso(accion, antes.fecha), cantidad, origen: calculo.origenDe(accion.tipo), fecha: antes.fecha, descripcion: accion.nombre }, t)
    return { compromiso, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, motivoSinXp: r.concedido ? undefined : r.motivo }
  }, tx)
}

async function omitir(usuarioId, id, nota = null, tx = null) {
  return transaccion((t) => cambiarEstado(usuarioId, id, { estado: 'omitido', nota: nota || undefined }, 'editar', null, t), tx)
}

/** Lo pasa a otra fecha: el original no cuenta ni da XP; se crea uno en la fecha nueva. */
async function reprogramar(usuarioId, id, nuevaFecha, tx = null) {
  revisarFecha(nuevaFecha, 'La nueva fecha')
  return transaccion(async (t) => {
    const { c } = await compromisoYAccion(usuarioId, id, t)
    if (nuevaFecha <= c.fecha) throw datoInvalido('La nueva fecha tiene que ser después.')
    await cambiarEstado(usuarioId, id, { estado: 'reprogramado', reprogramadoA: nuevaFecha }, 'editar', null, t)
    const nuevo = { id: idCompromiso(c.accionId, nuevaFecha), accionId: c.accionId, fecha: nuevaFecha, horaPrevista: c.horaPrevista, estado: 'pendiente', reprogramadoDesde: c.fecha, actualizado: ahora() }
    await datos.crearCompromiso(usuarioId, nuevo, t)
    return datos.compromiso(usuarioId, nuevo.id, t)
  }, tx)
}

/** Vuelve a pendiente y anula la XP que hubiera dado (también el extra). Queda en el historial. */
async function deshacer(usuarioId, id, motivo = 'Deshacer', tx = null) {
  return transaccion(async (t) => {
    const { c, accion } = await compromisoYAccion(usuarioId, id, t)
    if (accion.tipo !== 'acostarse') {
      await xp.anular(usuarioId, claveDeCompromiso(accion, c.fecha), motivo, t)
      await xp.anular(usuarioId, claveDeExtra(accion, c.fecha), motivo, t)
    }
    return cambiarEstado(usuarioId, id, { estado: 'pendiente', finReal: undefined, minutos: undefined, retrasoMinutos: undefined, respuesta: undefined, extra: false }, 'corregir', motivo, t)
  }, tx)
}

/** Segunda marca (manga a los 30 min): da el extra una vez por día. No cambia cumplimiento ni racha. */
async function marcarExtra(usuarioId, id, { minutos, instante } = {}, tx = null) {
  return transaccion(async (t) => {
    const { c: antes, accion } = await compromisoYAccion(usuarioId, id, t)
    if (!calculo.tieneExtra(accion)) throw datoInvalido('Este pilar no tiene extra.')
    if (antes.estado !== 'completado' && antes.estado !== 'tarde') throw datoInvalido('Primero marcá el pilar.')
    const total = Math.max(minutos ?? accion.minutosExtra, antes.minutos ?? 0)
    const compromiso = await cambiarEstado(usuarioId, id, { extra: true, minutos: total }, 'editar', `Extra: ${accion.minutosExtra} min`, t)
    const sin = (motivoSinXp, c = compromiso) => ({ compromiso: c, xp: 0, nuevoNivel: null, motivoSinXp })
    if (antes.estado === 'tarde') return sin('El pilar quedó tarde: el extra no da XP')
    if (minutos !== undefined && minutos < accion.minutosExtra) {
      await xp.anular(usuarioId, claveDeExtra(accion, antes.fecha), 'Menos minutos que el extra', t)
      return sin(`Menos de ${accion.minutosExtra} min`, await cambiarEstado(usuarioId, id, { extra: false }, 'corregir', 'Menos minutos que el extra', t))
    }
    const a = await aj(usuarioId, t)
    const t0 = instante ?? ahora()
    if (accion.horaLimite && t0 > instanteDe(antes.fecha, accion.horaLimite, a.zonaHoraria) + a.margenNocheMinutos * 60000) return sin('Marcado después de la hora límite: el extra no da XP')
    const r = await xp.sumar(usuarioId, { clave: claveDeExtra(accion, antes.fecha), cantidad: accion.xpExtra ?? 10, origen: 'extra', fecha: antes.fecha, descripcion: `${accion.nombre}: extra (${accion.minutosExtra} min)` }, t)
    return { compromiso, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, motivoSinXp: r.concedido ? undefined : r.motivo }
  }, tx)
}

async function deshacerExtra(usuarioId, id, motivo = 'Deshacer extra', tx = null) {
  return transaccion(async (t) => {
    const { c, accion } = await compromisoYAccion(usuarioId, id, t)
    await xp.anular(usuarioId, claveDeExtra(accion, c.fecha), motivo, t)
    const minutos = accion.minutosMinimos && c.minutos && accion.minutosExtra && c.minutos >= accion.minutosExtra ? accion.minutosMinimos : c.minutos
    return cambiarEstado(usuarioId, id, { extra: false, minutos }, 'corregir', motivo, t)
  }, tx)
}

/**
 * Corrección explícita de un día pasado (la pantalla la ofrece 48 h). Marcarlo cumplido se evalúa a las 12:00
 * de ese día y devuelve la resta; marcarlo omitido anula su XP. Recalcula el día cerrado.
 */
async function corregir(usuarioId, id, nuevoEstado, motivo, minutos, tx = null) {
  if (!['completado', 'omitido', 'tarde'].includes(nuevoEstado)) throw datoInvalido('Solo se corrige a cumplido, tarde u omitido.')
  if (!String(motivo || '').trim()) throw datoInvalido('Contá por qué lo corregís.')
  return transaccion(async (t) => {
    const { c, accion } = await compromisoYAccion(usuarioId, id, t)
    if (accion.tipo === 'acostarse') throw datoInvalido('«Dormir a horario» se corrige desde Sueño.')
    if (nuevoEstado === 'completado') {
      const a = await obtenerAjustes(usuarioId, t)
      await completar(usuarioId, id, { minutos, esCorreccion: true, motivo, instante: instanteDe(c.fecha, '12:00', a.zonaHoraria) }, t)
      await xp.devolverResta(usuarioId, c.accionId, c.fecha, motivo, t)
    } else {
      await xp.anular(usuarioId, claveDeCompromiso(accion, c.fecha), motivo, t)
      await xp.anular(usuarioId, claveDeExtra(accion, c.fecha), motivo, t)
      await cambiarEstado(usuarioId, id, { estado: nuevoEstado, finReal: undefined, extra: false }, 'corregir', motivo, t)
    }
    if (await datos.diaCerrado(usuarioId, c.fecha, t)) await recalcularDiaCerrado(usuarioId, c.fecha, {}, t)
    return datos.compromiso(usuarioId, id, t)
  }, tx)
}

// ---------- La noche (hora límite + margen) ----------

/** Horas de la noche: aviso (20:50), cierre (21:00) y fin de la ventana de «Dejo celu» (22:15). */
async function ventanaNoche(usuarioId, fecha, tx = null) {
  const a = await aj(usuarioId, tx)
  const revision = await datos.accion(usuarioId, 'revision_diaria', tx)
  const horaAviso = revision?.horaLimite ?? a.horaAlistarse
  const instanteAviso = instanteDe(fecha, horaAviso, a.zonaHoraria)
  return {
    horaAviso, horaCierre: calculo.horaFinMargen(horaAviso, a.margenNocheMinutos),
    instanteAviso, instanteCierre: instanteAviso + a.margenNocheMinutos * 60000,
    instanteFinCelu: instanteDe(fecha, a.horaLimiteCelu, a.zonaHoraria),
  }
}

/** Pasada la hora límite + margen, lo que sigue sin marcar (manga, empresa, revisión) queda omitido. Devuelve los ids. */
async function cerrarVentanaNoche(usuarioId, fecha, tx = null) {
  return transaccion(async (t) => {
    const a = await aj(usuarioId, t)
    const porId = new Map((await datos.acciones(usuarioId, t)).map((x) => [x.id, x]))
    const omitidos = []
    for (const c of await datos.compromisosEntre(usuarioId, fecha, fecha, t)) {
      if (c.estado !== 'pendiente' && c.estado !== 'iniciado') continue
      const accion = porId.get(c.accionId)
      if (!accion?.horaLimite || accion.tipo === 'acostarse') continue
      if (ahora() <= instanteDe(fecha, accion.horaLimite, a.zonaHoraria) + a.margenNocheMinutos * 60000) continue
      await cambiarEstado(usuarioId, c.id, { estado: 'omitido', nota: `Sin marcar a las ${calculo.horaFinMargen(accion.horaLimite, a.margenNocheMinutos)}` }, 'editar', null, t)
      omitidos.push(c.id)
    }
    return omitidos
  }, tx)
}

// ---------- Cierre del día ----------

/**
 * Cierra todos los días anteriores que sigan abiertos (cada uno se cierra cuando pasa la hora de corte de
 * la noche siguiente, 06:00). Se llama al abrir Hoy. Después asegura los compromisos de hoy y el cierre de las 21:00.
 * Devuelve las fechas cerradas.
 */
async function cerrarDiasPendientes(usuarioId, tx = null) {
  const c = await ciclo.cicloActivo(usuarioId, tx)
  if (!c) return []
  const a = await aj(usuarioId, tx)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  await xp.asegurarInicioResta(usuarioId, hoy, tx)
  const cerradas = []
  const ultimo = await datos.ultimoCerrado(usuarioId, tx)
  let f = ultimo && sumarDias(ultimo, 1) > primerDia(c) ? sumarDias(ultimo, 1) : primerDia(c)
  let guardia = 0
  while (f < hoy && guardia++ < 1000) {
    if (ahora() < instanteDe(sumarDias(f, 1), a.horaCorteNoche, a.zonaHoraria)) break
    await transaccion((t) => cerrarDia(usuarioId, f, c, t), tx)
    cerradas.push(f)
    f = sumarDias(f, 1)
  }
  if (hoy >= primerDia(c)) await generarCompromisos(usuarioId, hoy, tx)
  if (hoy >= c.inicio) await cerrarVentanaNoche(usuarioId, hoy, tx)
  return cerradas
}

async function cerrarDia(usuarioId, fecha, c, t) {
  const a = await aj(usuarioId, t)
  await generarCompromisos(usuarioId, fecha, t)
  const fin = instanteDe(fecha, '23:59', a.zonaHoraria)
  // Día 0 (calentamiento): lo hecho queda, lo que no se hizo no contaba. Nada resta.
  if (fecha < c.inicio) {
    await datos.borrarSinResolverDe(usuarioId, fecha, t)
    const r = await recalcularDiaCerrado(usuarioId, fecha, { excepcion: false }, t)
    await anotar(usuarioId, 'dia', 'cerrar_dia', { fecha, diaCero: true }, t)
    return r
  }
  const excepcion = !!(await datos.excepcion(usuarioId, fecha, t))
  // 1. Lo que quedó sin marcar pasa a omitido (límite de juego y comida se deciden abajo).
  for (const x of await datos.compromisosEntre(usuarioId, fecha, fecha, t)) {
    if (x.estado !== 'pendiente' && x.estado !== 'iniciado') continue
    if (x.accionId === 'limite_juego' || x.accionId === ID_PILAR_COMIDA) continue
    await cambiarEstado(usuarioId, x.id, { estado: 'omitido', nota: 'Sin marcar al cerrar el día' }, 'editar', null, t)
  }
  // 2. Límite de juego: se decide una sola vez, al cerrar.
  const juegoDia = await juego.limiteRespetado(usuarioId, fecha, t)
  const lim = await datos.compromiso(usuarioId, idCompromiso('limite_juego', fecha), t)
  if (lim && (lim.estado === 'pendiente' || lim.estado === 'iniciado')) {
    if (juegoDia.respetado) await completar(usuarioId, lim.id, { instante: fin }, t)
    else await cambiarEstado(usuarioId, lim.id, { estado: 'omitido', nota: `${juegoDia.minutos} min de juego, límite ${juegoDia.limite}` }, 'editar', null, t)
  }
  // 2b. Comer según el plan: sin comidas cargadas no cuenta (se quita); si hay, se evalúa.
  const plan = await datos.compromiso(usuarioId, idCompromiso(ID_PILAR_COMIDA, fecha), t)
  if (plan && (plan.estado === 'pendiente' || plan.estado === 'iniciado')) {
    const r = fuentes.planComida ? await fuentes.planComida(usuarioId, fecha, t) : null
    if (!r) await datos.borrarCompromiso(usuarioId, plan.id, t)
    else if (r.cumplido) await completar(usuarioId, plan.id, { instante: fin }, t)
    else await cambiarEstado(usuarioId, plan.id, { estado: 'omitido', nota: `${r.kcal} kcal · ${r.proteina} g de proteína` }, 'editar', null, t)
  }
  // 2c. Lo no cumplido resta: dia arma la lista, xp aplica (la mitad, nunca bajo 0, una sola vez).
  await xp.aplicarRestas(usuarioId, fecha, await faltantesDelDia(usuarioId, fecha, false, t), t)
  // 3. Cumplimiento del día y foto de atributos.
  const cerrado = await recalcularDiaCerrado(usuarioId, fecha, { minutosJuego: juegoDia.minutos, excepcion }, t)
  // 4. Racha: cada 7 días seguidos, su bonus.
  const r = await rachaHasta(usuarioId, fecha, t)
  if (r > 0 && r % 7 === 0) {
    await xp.sumar(usuarioId, { clave: xp.claveXp('racha7', [fecha]), cantidad: a.xpRacha7, origen: 'racha7', fecha, descripcion: `Racha de ${r} días` }, t)
  }
  await anotar(usuarioId, 'dia', 'cerrar_dia', { fecha, ...cerrado }, t)
  return cerrado
}

/** Recalcula y guarda el resumen de un día (al cerrar o tras una corrección). */
async function recalcularDiaCerrado(usuarioId, fecha, { minutosJuego, excepcion } = {}, tx = null) {
  const a = await aj(usuarioId, tx)
  const previo = await datos.diaCerrado(usuarioId, fecha, tx)
  if (minutosJuego === undefined) minutosJuego = await juego.minutosDelDia(usuarioId, fecha, tx)
  if (excepcion === undefined) excepcion = !!(await datos.excepcion(usuarioId, fecha, tx))
  const c = calculo.cumplimiento(await resumenDeCompromisos(usuarioId, fecha, fecha, tx), null)
  const cerrado = { fecha, cumplidos: c.cumplidos, programados: c.programados, porcentaje: excepcion ? null : c.porcentaje, minutosJuego, excepcion, cerradoEn: previo?.cerradoEn ?? ahora() }
  await datos.guardarCerrado(usuarioId, cerrado, tx)
  const ventana = await resumenDeCompromisos(usuarioId, sumarDias(fecha, -60), fecha, tx)
  for (const at of await ciclo.atributos(usuarioId, {}, tx)) {
    const d = calculo.calcularAtributo(at.id, ventana, fecha, at.ventanaDias, a.minimoProgramadosAtributo)
    await datos.guardarAtributoDiario(usuarioId, { fecha, atributoId: at.id, valor: d.valor, cumplidos: d.cumplidos, programados: d.programados }, tx)
  }
  return cerrado
}

/**
 * Lo que tocaba ese día y no se cumplió, en el formato de xp.aplicarRestas: [{ id, nombre, xp, tipo }].
 * `abierto` (hoy): cuenta también lo pendiente, para el aviso. Pilares con compromiso ese día y las series de entreno.
 * Antes del Día 1 y en días de excepción, nada.
 */
async function faltantesDelDia(usuarioId, fecha, abierto = false, tx = null) {
  const c = await ciclo.cicloActivo(usuarioId, tx)
  if (!c || fecha < c.inicio) return []
  if (await datos.excepcion(usuarioId, fecha, tx)) return []
  const a = await aj(usuarioId, tx)
  const r = []
  for (const accion of (await datos.acciones(usuarioId, tx)).filter((x) => x.activa && x.pilar)) {
    const comp = await datos.compromiso(usuarioId, idCompromiso(accion.id, fecha), tx)
    if (!comp) continue
    const falta = comp.estado === 'omitido' || comp.estado === 'no_registrado' || (abierto && (comp.estado === 'pendiente' || comp.estado === 'iniciado'))
    if (!falta) continue
    if (abierto && accion.tipo === 'comida_plan') continue
    if (!accion.dias.includes(diaSemanaDe(fecha)) && accion.tipo !== 'entrenamiento') continue
    const { cantidad } = await xpDeAccion(usuarioId, accion, fecha, a, tx)
    if (cantidad > 0) r.push({ id: accion.id, nombre: accion.nombre, xp: cantidad, tipo: 'pilar' })
  }
  if (fuentes.faltantesSeries) r.push(...((await fuentes.faltantesSeries(usuarioId, fecha, tx)) || []))
  return r
}

/** «Te quedan 2 sin hacer: −15 XP…» para hoy (Revisión diaria y aviso de la noche), o null. */
async function avisoResta(usuarioId, hoy = null, tx = null) {
  const f = hoy || await hoyDe(usuarioId, tx)
  return xp.avisoResta(usuarioId, f, await faltantesDelDia(usuarioId, f, true, tx), tx)
}

// ---------- Cumplimiento, racha y atributos ----------

/** Compromisos de un rango en el formato de las cuentas (más las series que entreno preste para atributos). */
async function resumenDeCompromisos(usuarioId, desde, hasta, tx = null) {
  const porId = new Map((await datos.acciones(usuarioId, tx)).map((x) => [x.id, x]))
  const exc = new Set((await datos.excepcionesEntre(usuarioId, desde, hasta, tx)).map((e) => e.fecha))
  const r = []
  for (const c of await datos.compromisosEntre(usuarioId, desde, hasta, tx)) {
    const a = porId.get(c.accionId)
    if (!a) continue
    r.push({ accionId: c.accionId, fecha: c.fecha, estado: c.estado, peso: a.peso, atributoIds: a.atributoIds, excepcion: exc.has(c.fecha), pilar: !!a.pilar })
  }
  if (fuentes.seriesParaAtributos) {
    for (const s of (await fuentes.seriesParaAtributos(usuarioId, desde, hasta, tx)) || []) r.push({ peso: 1, ...s, pilar: false, excepcion: exc.has(s.fecha) })
  }
  return r
}

/** Mapa fecha → { porcentaje, excepcion, cumplidos, programados }: días cerrados y, para los abiertos, el cálculo en vivo. */
async function mapaCumplimiento(usuarioId, desde, hasta, hoy, tx) {
  const mapa = new Map()
  for (const c of await datos.cerradosEntre(usuarioId, desde, hasta, tx)) mapa.set(c.fecha, { porcentaje: c.porcentaje, excepcion: c.excepcion, cumplidos: c.cumplidos, programados: c.programados })
  const porFecha = new Map()
  for (const r of await resumenDeCompromisos(usuarioId, desde, hasta, tx)) {
    if (mapa.has(r.fecha)) continue
    porFecha.set(r.fecha, [...(porFecha.get(r.fecha) ?? []), r])
  }
  for (const [fecha, lista] of porFecha) {
    const c = calculo.cumplimiento(lista, hoy)
    mapa.set(fecha, { porcentaje: lista[0]?.excepcion ? null : c.porcentaje, excepcion: !!lista[0]?.excepcion, cumplidos: c.cumplidos, programados: c.programados })
  }
  return mapa
}

/** Cumplimiento por día (calendario, gráfico): [{ fecha, porcentaje, nivel, excepcion, cumplidos, programados }]. */
async function cumplimientoPorDia(usuarioId, desde, hasta, tx = null) {
  revisarFecha(desde); revisarFecha(hasta)
  const hoy = await hoyDe(usuarioId, tx)
  const mapa = await mapaCumplimiento(usuarioId, desde, hasta, hoy, tx)
  return [...mapa.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([fecha, v]) => ({ fecha, ...v, nivel: calculo.nivelCumplimiento(v.porcentaje) }))
}

/** Cumplimiento de un rango junto (semana, fase): { cumplidos, programados, porcentaje }. */
async function cumplimientoEntre(usuarioId, desde, hasta, tx = null) {
  return calculo.cumplimiento(await resumenDeCompromisos(usuarioId, desde, hasta, tx), await hoyDe(usuarioId, tx))
}

async function rachaHasta(usuarioId, fecha, tx = null) {
  const a = await aj(usuarioId, tx)
  return calculo.racha(await mapaCumplimiento(usuarioId, sumarDias(fecha, -400), fecha, fecha, tx), fecha, a.umbralRacha)
}

/** Racha del panel: hasta ayer, y suma hoy solo si los pilares cumplidos ya llegan al umbral sobre el total del día. */
async function racha(usuarioId, hoy = null, tx = null) {
  const a = await aj(usuarioId, tx)
  const f = hoy || await hoyDe(usuarioId, tx)
  const mapa = await mapaCumplimiento(usuarioId, sumarDias(f, -400), f, f, tx)
  const p = await pilaresDelDia(usuarioId, f, tx)
  const deHoy = p.aplican > 0 ? (100 * p.cumplidos) / p.aplican : null
  if (deHoy !== null && deHoy >= a.umbralRacha) return calculo.racha(new Map([...mapa, [f, { porcentaje: deHoy }]]), f, a.umbralRacha)
  return calculo.racha(mapa, sumarDias(f, -1), a.umbralRacha)
}

/** Valor de cada atributo hoy (ventana móvil) con su tendencia contra hace 7 días. */
async function atributosHoy(usuarioId, hoy = null, tx = null) {
  const a = await aj(usuarioId, tx)
  const f = hoy || await hoyDe(usuarioId, tx)
  const ventana = await resumenDeCompromisos(usuarioId, sumarDias(f, -60), f, tx)
  const r = []
  for (const at of await ciclo.atributos(usuarioId, {}, tx)) {
    const d = calculo.calcularAtributo(at.id, ventana, f, at.ventanaDias, a.minimoProgramadosAtributo)
    const hace7 = await datos.atributoDiario(usuarioId, at.id, sumarDias(f, -7), tx)
    r.push({ ...d, nombre: at.nombre, descripcion: at.descripcion, tendencia: d.valor !== null && hace7 && hace7.valor !== null ? d.valor - hace7.valor : null })
  }
  return r
}

// ---------- Excepciones ----------

async function marcarExcepcion(usuarioId, fecha, motivo, tx = null) {
  revisarFecha(fecha)
  if (!String(motivo || '').trim()) throw datoInvalido('Contá el motivo (enfermedad, viaje…).')
  return transaccion(async (t) => {
    await datos.ponerExcepcion(usuarioId, { fecha, motivo: String(motivo).trim().slice(0, 200), creado: ahora() }, t)
    await anotar(usuarioId, 'dia', 'excepcion', { fecha, motivo }, t)
    if (await datos.diaCerrado(usuarioId, fecha, t)) await recalcularDiaCerrado(usuarioId, fecha, {}, t)
  }, tx)
}

async function quitarExcepcion(usuarioId, fecha, tx = null) {
  revisarFecha(fecha)
  return transaccion(async (t) => {
    await datos.quitarExcepcion(usuarioId, fecha, t)
    await anotar(usuarioId, 'dia', 'quitar_excepcion', { fecha }, t)
    if (await datos.diaCerrado(usuarioId, fecha, t)) await recalcularDiaCerrado(usuarioId, fecha, {}, t)
  }, tx)
}

async function excepciones(usuarioId, desde, hasta, tx = null) { return datos.excepcionesEntre(usuarioId, desde, hasta, tx) }

// ---------- Pilares ----------

/**
 * Los pilares de una fecha con su estado: { pilares: [{ accion, compromiso, estado, horaLimite, vencido, ventanaCerrada, xpPrevisto }], cumplidos, aplican }.
 * El entrenamiento solo cuenta en sus días; los demás aparece como «descanso».
 */
async function pilaresDelDia(usuarioId, fecha = null, tx = null) {
  const f = fecha || await hoyDe(usuarioId, tx)
  revisarFecha(f)
  const a = await aj(usuarioId, tx)
  const t = ahora()
  const ds = diaSemanaDe(f)
  const pilares = []
  for (const accion of calculo.ordenarPilares((await datos.acciones(usuarioId, tx)).filter((x) => x.activa && x.pilar))) {
    const c = (await datos.compromiso(usuarioId, idCompromiso(accion.id, f), tx)) || null
    const estado = calculo.estadoPilar(accion, c, ds)
    const horaLimite = accion.tipo === 'acostarse' ? a.horaDejarCelu : accion.horaLimite
    const margen = accion.tipo === 'acostarse' ? 0 : a.margenNocheMinutos * 60000
    const vencido = estado === 'pendiente' && !!horaLimite && t > instanteDe(f, horaLimite, a.zonaHoraria) + margen
    const ventanaCerrada = accion.tipo === 'acostarse' && estado === 'pendiente' ? t > instanteDe(f, a.horaLimiteCelu, a.zonaHoraria) : undefined
    pilares.push({ accion, compromiso: c, estado, horaLimite, vencido, ventanaCerrada, xpPrevisto: (await xpDeAccion(usuarioId, accion, f, a, tx)).cantidad })
  }
  return { fecha: f, pilares, cumplidos: pilares.filter((p) => p.estado === 'cumplido').length, aplican: pilares.filter((p) => p.estado !== 'descanso').length }
}

/** Estado de cada pilar por fecha (calendario y gráfico): [{ fecha, pilares: [{ accionId, nombre, estado }] }]. Lo futuro, «pendiente». */
async function pilaresPorDia(usuarioId, desde, hasta, tx = null) {
  revisarFecha(desde); revisarFecha(hasta)
  const hoy = await hoyDe(usuarioId, tx)
  const c = await ciclo.cicloActivo(usuarioId, tx)
  const lista = calculo.ordenarPilares((await datos.acciones(usuarioId, tx)).filter((x) => x.activa && x.pilar))
  const porId = new Map((await datos.compromisosEntre(usuarioId, desde, hasta, tx)).map((x) => [x.id, x]))
  const r = []
  let guardia = 0
  for (let f = desde; f <= hasta && guardia++ < 400; f = sumarDias(f, 1)) {
    const ds = diaSemanaDe(f)
    const fila = lista.map((accion) => {
      const comp = porId.get(idCompromiso(accion.id, f))
      let estado
      if (f > hoy || !c || f < primerDia(c)) estado = accion.dias.includes(ds) ? 'pendiente' : 'descanso'
      else if (!comp || comp.estado === 'reprogramado') estado = f === hoy && accion.tipo !== 'entrenamiento' && accion.dias.includes(ds) ? 'pendiente' : 'descanso'
      else estado = calculo.estadoPilar(accion, comp, ds)
      return { accionId: accion.id, nombre: accion.nombre, estado }
    })
    r.push({ fecha: f, pilares: fila })
  }
  return r
}

// ---------- El Tajo ----------

/** La app dejó de estar a la vista (o se cerró): se anota la hora. */
async function anotarVista(usuarioId, tx = null) {
  await datos.anotarVista(usuarioId, ahora(), tx)
}

/**
 * Al volver a la app: ¿toca el Tajo? Volvió después de ≥ 3 h, hay un pilar pendiente, no pasó la hora de
 * «Dejo celu» y hoy todavía no salió. Devuelve { mostrar, pendientes: [nombres] }. Si toca, queda marcado para hoy.
 */
async function tajo(usuarioId, tx = null) {
  return transaccion(async (t) => {
    const a = await aj(usuarioId, t)
    const hoy = await hoyDe(usuarioId, t)
    const v = (await datos.vistas(usuarioId, t)) || {}
    const p = await pilaresDelDia(usuarioId, hoy, t)
    const pendientes = p.pilares.filter((x) => x.estado === 'pendiente' && x.accion.tipo !== 'acostarse').map((x) => x.accion.nombre)
    const mostrar = calculo.debeMostrarTajo({
      ultimaVista: v.ultimaVista ?? null, ahora: ahora(), pilarPendiente: pendientes.length > 0,
      pasoDejoCelu: ahora() > instanteDe(hoy, a.horaDejarCelu, a.zonaHoraria), mostradoHoy: v.tajoFecha === hoy,
    })
    if (mostrar) { await datos.marcarTajo(usuarioId, hoy, t); await anotar(usuarioId, 'dia', 'tajo', { pendientes }, t) }
    await datos.anotarVista(usuarioId, ahora(), t)
    return { mostrar, pendientes }
  }, tx)
}

// ---------- Avisos de otros módulos ----------

/** Marca un pilar según un aviso (sin XP propia: la da quien avisa, o completar). Si no hay acción o ciclo, no hace nada. */
async function compromisoPara(usuarioId, accionId, fecha, tx) {
  const accion = await datos.accion(usuarioId, accionId, tx)
  if (!accion || !accion.activa) return null
  const c = await ciclo.cicloActivo(usuarioId, tx)
  if (!c || fecha < primerDia(c)) return null
  await generarCompromisos(usuarioId, fecha, tx)
  const id = idCompromiso(accionId, fecha)
  let comp = await datos.compromiso(usuarioId, id, tx)
  if (!comp) { // fuera de sus días (entrenar un domingo): igual se anota
    await datos.crearCompromiso(usuarioId, { id, accionId, fecha, horaPrevista: accion.hora, estado: 'pendiente', actualizado: ahora() }, tx)
    comp = await datos.compromiso(usuarioId, id, tx)
  }
  return { accion, comp }
}

const AVISOS = {
  // «Empecé» en el 3·2·1 (desafios): el compromiso pasa a «iniciado».
  'desafios.inicio': async ({ usuarioId, compromisoId }, tx) => {
    if (!compromisoId) return
    const c = await datos.compromiso(usuarioId, compromisoId, tx)
    if (c && c.estado === 'pendiente') await cambiarEstado(usuarioId, c.id, { estado: 'iniciado', inicioReal: ahora() }, 'editar', 'Empezó con el 3·2·1', tx)
  },
  // Revisión diaria o semanal guardada (ciclo): completa su pilar y da su XP.
  'ciclo.revision': async ({ usuarioId, tipo, fecha }, tx) => {
    const accionId = tipo === 'diaria' ? 'revision_diaria' : tipo === 'semanal' ? 'revision_semanal' : null
    if (!accionId || !fecha) return
    const x = await compromisoPara(usuarioId, accionId, fecha, tx)
    if (x && (x.comp.estado === 'pendiente' || x.comp.estado === 'iniciado')) await completar(usuarioId, x.comp.id, {}, tx)
  },
  // El Día 1 se movió: los días cerrados y lo sin resolver de antes del nuevo inicio se van.
  'ciclo.inicio_cambiado': async ({ usuarioId, ciclo: c }, tx) => {
    await datos.borrarCerradosAntesDe(usuarioId, primerDia(c), tx)
    await datos.borrarSinResolverAntesDe(usuarioId, primerDia(c), tx)
  },
  'ciclo.nuevo': async ({ usuarioId }, tx) => { await generarCompromisos(usuarioId, await hoyDe(usuarioId, tx), tx) },
  // «Dejo celu» (sueno): «Dormir a horario» queda cumplido o tarde. La XP ya la dio sueno.
  'sueno.dejo_celu': async ({ usuarioId, noche, cumplido, retrasoMinutos, instante }, tx) => {
    const x = await compromisoPara(usuarioId, 'acostarse', noche, tx)
    if (!x) return
    if (cumplido) await completar(usuarioId, x.comp.id, { instante, desdeSueno: true }, tx)
    else await cambiarEstado(usuarioId, x.comp.id, { estado: 'tarde', finReal: instante, retrasoMinutos, nota: `Dejó el celu ${retrasoMinutos} min tarde` }, 'editar', null, tx)
  },
  'sueno.dejo_celu.deshecho': async ({ usuarioId, noche }, tx) => {
    const c = await datos.compromiso(usuarioId, idCompromiso('acostarse', noche), tx)
    if (c) await cambiarEstado(usuarioId, c.id, { estado: 'pendiente', finReal: undefined, retrasoMinutos: undefined, nota: undefined }, 'corregir', 'Deshacer «Dejo celu»', tx)
  },
  // Entreno (entreno): empezado → iniciado; terminado → cumplido (o tarde si empezó después de la hora límite); deshecho → vuelve.
  'entreno.empezado': async ({ usuarioId, fecha, inicio }, tx) => {
    const x = await compromisoPara(usuarioId, 'entrenamiento', fecha, tx)
    if (x && x.comp.estado === 'pendiente') await cambiarEstado(usuarioId, x.comp.id, { estado: 'iniciado', inicioReal: inicio }, 'editar', null, tx)
  },
  'entreno.terminado': async ({ usuarioId, fecha, inicio, inicioQueCuenta, fin, minutos }, tx) => {
    const x = await compromisoPara(usuarioId, 'entrenamiento', fecha, tx)
    if (!x) return
    const a = await obtenerAjustes(usuarioId, tx)
    const empezo = inicioQueCuenta ?? inicio
    let tarde
    if (x.accion.horaLimiteInicio && empezo) {
      const limite = instanteDe(fecha, x.accion.horaLimiteInicio, a.zonaHoraria)
      if (empezo > limite) tarde = { minutos: Math.round((empezo - limite) / 60000), motivo: `Empezó después de las ${x.accion.horaLimiteInicio}: cuenta como tarde, sin XP` }
    }
    await completar(usuarioId, x.comp.id, { minutos: Math.round(minutos), instante: fin, tarde }, tx)
  },
  'entreno.deshecho': async ({ usuarioId, fecha, quedaIniciado, motivo }, tx) => {
    const c = await datos.compromiso(usuarioId, idCompromiso('entrenamiento', fecha), tx)
    if (!c) return
    await deshacer(usuarioId, c.id, motivo || 'Entreno deshecho', tx)
    if (quedaIniciado) await cambiarEstado(usuarioId, c.id, { estado: 'iniciado', inicioReal: c.inicioReal }, 'editar', null, tx)
  },
}

let escuchando = false
/** Se anota a los avisos de ciclo, sueno y entreno (una sola vez; lo llama app.js). */
function escucharAvisos() {
  if (escuchando) return
  escuchando = true
  for (const [nombre, fn] of Object.entries(AVISOS)) escuchar(nombre, fn)
}
/** Pruebas: después de `eventos.limpiar()`. */
function dejarDeEscuchar() { escuchando = false }

// ---------- Para Hoy (parte 2) y para crear cuentas ----------

/**
 * Todo lo que la pantalla Hoy necesita de dia. Primero cierra lo pendiente.
 * { hoy, ciclo (dia del ciclo o null), pilares, cumplidos, aplican, racha, avisoResta, compromisos (no pilares), excepcion }.
 */
async function resumenHoy(usuarioId, tx = null) {
  await cerrarDiasPendientes(usuarioId, tx)
  const hoy = await hoyDe(usuarioId, tx)
  const p = await pilaresDelDia(usuarioId, hoy, tx)
  return {
    hoy,
    ciclo: await ciclo.diaDelCiclo(usuarioId, hoy, tx),
    pilares: p.pilares, cumplidos: p.cumplidos, aplican: p.aplican,
    racha: await racha(usuarioId, hoy, tx),
    avisoResta: await avisoResta(usuarioId, hoy, tx),
    compromisos: (await compromisosDelDia(usuarioId, hoy, tx)).filter((c) => !c.accion.pilar),
    excepcion: await datos.excepcion(usuarioId, hoy, tx),
    noche: await ventanaNoche(usuarioId, hoy, tx),
  }
}

/** Al crear una cuenta: los pilares y acciones de fábrica con su XP. Si ya tiene acciones, no hace nada. */
async function sembrar(usuarioId, tx = null) {
  return transaccion(async (t) => {
    if (await datos.cuantasAcciones(usuarioId, t)) return false
    const hoy = await hoyDe(usuarioId, t)
    const creado = ahora()
    for (const a of calculo.ACCIONES_INICIALES) {
      const opciones = {}
      for (const k of OPCIONES) if (a[k] !== undefined) opciones[k] = a[k]
      await datos.guardarAccion(usuarioId, { ...a, creado }, opciones, t)
      await datos.guardarRegla(usuarioId, { id: `r_${a.id}`, accionId: a.id, xp: calculo.XP_INICIAL[a.id], periodo: a.tipo === 'revision_semanal' ? 'semana' : 'dia', validaDesde: hoy, creado }, t)
    }
    return true
  }, tx)
}

/**
 * Trae de una copia de la app vieja: { acciones, reglasXp, compromisos, diasCerrados, excepciones, atributosDiarios }.
 * Lo repetido no entra (las acciones y reglas con el mismo id se reemplazan). Devuelve cuántos entraron de cada uno.
 */
async function importar(usuarioId, vieja = {}, tx = null) {
  return transaccion(async (t) => {
    const n = { acciones: 0, reglasXp: 0, compromisos: 0, diasCerrados: 0, excepciones: 0, atributosDiarios: 0 }
    for (const a of vieja.acciones || []) {
      if (!a || calculo.validarAccion({ ...a, atributoIds: a.atributoIds?.length ? a.atributoIds : ['disciplina'] }).length) continue
      const opciones = {}
      for (const k of OPCIONES) if (a[k] !== undefined && a[k] !== null) opciones[k] = a[k]
      await datos.guardarAccion(usuarioId, { ...a, creado: Number.isFinite(a.creado) ? a.creado : ahora() }, opciones, t)
      n.acciones++
    }
    for (const r of vieja.reglasXp || []) {
      if (!r || !r.accionId || !Number.isFinite(r.xp) || !esFechaValida(r.validaDesde)) continue
      const id = r.id || nuevoId('regla')
      // Una cuenta nueva ya tiene sembrada `r_<acción>` desde hoy: la de la copia (otra fecha) la reemplaza, si no chocan los id.
      await datos.quitarRegla(usuarioId, id, t)
      await datos.guardarRegla(usuarioId, { ...r, id, creado: r.creado ?? ahora() }, t)
      n.reglasXp++
    }
    for (const c of vieja.compromisos || []) {
      if (!c || !c.accionId || !esFechaValida(c.fecha) || !calculo.ESTADOS.includes(c.estado)) continue
      const id = c.id || idCompromiso(c.accionId, c.fecha)
      if (!(await datos.crearCompromiso(usuarioId, { ...c, id, actualizado: c.actualizado ?? ahora() }, t))) continue
      await datos.ponerCompromiso(usuarioId, { ...c, id, extra: !!c.extra, actualizado: c.actualizado ?? ahora() }, t)
      n.compromisos++
    }
    for (const d of vieja.diasCerrados || []) {
      if (!d || !esFechaValida(d.fecha) || await datos.diaCerrado(usuarioId, d.fecha, t)) continue
      await datos.guardarCerrado(usuarioId, { ...d, cerradoEn: d.cerradoEn ?? ahora() }, t)
      n.diasCerrados++
    }
    for (const e of vieja.excepciones || []) {
      if (!e || !esFechaValida(e.fecha) || await datos.excepcion(usuarioId, e.fecha, t)) continue
      await datos.ponerExcepcion(usuarioId, { fecha: e.fecha, motivo: String(e.motivo || 'Excepción'), creado: e.creado ?? ahora() }, t)
      n.excepciones++
    }
    for (const f of vieja.atributosDiarios || []) {
      if (!f || !f.atributoId || !esFechaValida(f.fecha)) continue
      await datos.guardarAtributoDiario(usuarioId, { fecha: f.fecha, atributoId: f.atributoId, valor: f.valor ?? null, cumplidos: f.cumplidos ?? 0, programados: f.programados ?? 0 }, t)
      n.atributosDiarios++
    }
    await anotar(usuarioId, 'dia', 'importar', n, t)
    return n
  }, tx)
}

/** Todo lo del módulo, con la forma que recibe `importar` (lo usa el módulo copia). */
async function exportar(usuarioId, tx = null) {
  const T0 = '0001-01-01'
  const T1 = '9999-12-31'
  const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))
  return {
    acciones: (await datos.acciones(usuarioId, tx)).map(sinVacios),
    reglasXp: await datos.reglas(usuarioId, tx),
    compromisos: await datos.compromisosEntre(usuarioId, T0, T1, tx),
    diasCerrados: await datos.cerradosEntre(usuarioId, T0, T1, tx),
    excepciones: await datos.excepcionesEntre(usuarioId, T0, T1, tx),
    atributosDiarios: await datos.atributosDiariosTodos(usuarioId, tx),
  }
}

module.exports = {
  conectar, escucharAvisos, dejarDeEscuchar,
  acciones, accionesConXp, guardarAccion, activarAccion, cambiarXp, reglasDe, activarPilarComida,
  generarCompromisos, compromisosDelDia, iniciar, completar, omitir, reprogramar, deshacer, marcarExtra, deshacerExtra, corregir,
  ventanaNoche, cerrarVentanaNoche, cerrarDiasPendientes, recalcularDiaCerrado, faltantesDelDia, avisoResta,
  cumplimientoPorDia, cumplimientoEntre, racha, rachaHasta, atributosHoy,
  marcarExcepcion, quitarExcepcion, excepciones,
  pilaresDelDia, pilaresPorDia, anotarVista, tajo,
  resumenHoy, sembrar, importar, exportar,
}
