'use strict'
/**
 * XP · la única puerta del módulo.
 * Sumar y restar puntos con clave única (nunca dos veces), anular con motivo, niveles (base × n),
 * «lo no cumplido resta» y el historial de XP. Las cuentas están en calculo.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 *
 * Qué faltó un día lo sabe el módulo que tiene los pilares y las series (dia): se lo pasa a
 * `aplicarRestas` / `avisoResta` como lista de faltantes [{ id, nombre, xp, tipo }].
 */
const datos = require('./datos')
const calculo = require('./calculo')
const { transaccion } = require('../../comun/base')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { esFechaValida, fechaDe, sumarDias } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const QUE_RESTAN = [...calculo.ORIGENES_QUE_RESTAN]
const limpio = (r) => r && {
  id: r.id, clave: r.clave, cantidad: r.cantidad, origen: r.origen, fecha: r.fecha, creado: r.creado,
  descripcion: r.descripcion, anulado: r.anulado, anuladoEn: r.anuladoEn ?? undefined, motivoAnulacion: r.motivoAnulacion ?? undefined,
}
const claveResta = (id, fecha) => calculo.claveXp('resta', [id, fecha])

function revisar({ clave, cantidad, origen, fecha }) {
  if (typeof clave !== 'string' || !clave.trim()) throw datoInvalido('Falta la clave del XP.')
  if (!calculo.origenValido(origen)) throw datoInvalido('El origen del XP no es válido.')
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha del XP no es válida.')
  if (!Number.isFinite(cantidad)) throw datoInvalido('La cantidad de XP no es un número.')
}

/** Si el total pasó de nivel, lo anota y avisa 'xp.nivel' (uno por cada nivel subido). */
async function siSubio(usuarioId, antes, despues, base, tx) {
  const nivelAntes = calculo.nivelDesdeXp(antes, base)
  const nivelDespues = calculo.nivelDesdeXp(despues, base)
  if (nivelDespues <= nivelAntes) return null
  for (let n = nivelAntes + 1; n <= nivelDespues; n++) {
    await anotar(usuarioId, 'xp', 'subir_nivel', { nivel: n, xpTotal: despues }, tx)
    await avisar('xp.nivel', { usuarioId, nivel: n, xpTotal: despues }, tx)
  }
  return nivelDespues
}

/**
 * Suma XP con una clave única. Si la clave ya está (y no anulada), no suma nada.
 * Si estaba anulada, la reactiva (la corrección de una corrección).
 * Devuelve { concedido, cantidad, nuevoNivel, motivo? }.
 */
async function sumar(usuarioId, { clave, cantidad, origen, fecha, descripcion = '' }, tx = null) {
  revisar({ clave, cantidad, origen, fecha })
  cantidad = Math.floor(cantidad)
  if (cantidad <= 0) return { concedido: false, cantidad: 0, nuevoNivel: null, motivo: 'La regla da 0 XP' }
  return transaccion(async (t) => {
    await datos.bloquear(usuarioId, t)
    const ya = await datos.porClave(usuarioId, clave, t)
    if (ya && !ya.anulado) return { concedido: false, cantidad: 0, nuevoNivel: null, motivo: 'Ya se había concedido' }
    const { baseNivel } = await obtenerAjustes(usuarioId, t)
    const antes = await datos.total(usuarioId, QUE_RESTAN, t)
    if (ya) {
      await datos.reactivar(usuarioId, ya.id, { cantidad, creado: ahora(), descripcion: descripcion || ya.descripcion }, t)
      await anotar(usuarioId, 'xp', 'reactivar', { clave, antes: limpio(ya) }, t)
    } else {
      await datos.crear(usuarioId, { clave, cantidad, origen, fecha, creado: ahora(), descripcion }, t)
    }
    const nuevoNivel = await siSubio(usuarioId, antes, antes + cantidad, baseNivel, t)
    return { concedido: true, cantidad, nuevoNivel }
  }, tx)
}

/**
 * Resta XP (solo orígenes que restan: resta, caida, rival). `cantidad` va en positivo.
 * Nunca saca más de lo que hay: el total no baja de 0. Nunca baja de nivel por debajo de 0 XP.
 * Devuelve { restado, cantidad, motivo? }.
 */
async function restar(usuarioId, { clave, cantidad, origen, fecha, descripcion = '' }, tx = null) {
  revisar({ clave, cantidad, origen, fecha })
  if (!calculo.ORIGENES_QUE_RESTAN.has(origen)) throw datoInvalido(`El origen «${origen}» no puede restar XP.`)
  cantidad = Math.floor(cantidad)
  return transaccion(async (t) => {
    await datos.bloquear(usuarioId, t)
    const ya = await datos.porClave(usuarioId, clave, t)
    if (ya && !ya.anulado) return { restado: false, cantidad: 0, motivo: 'Ya se había restado' }
    const quita = Math.min(cantidad, await datos.total(usuarioId, QUE_RESTAN, t))
    if (quita <= 0) return { restado: false, cantidad: 0, motivo: 'No hay XP para restar' }
    if (ya) await datos.reactivar(usuarioId, ya.id, { cantidad: -quita, creado: ahora(), descripcion: descripcion || ya.descripcion }, t)
    else await datos.crear(usuarioId, { clave, cantidad: -quita, origen, fecha, creado: ahora(), descripcion }, t)
    await anotar(usuarioId, 'xp', 'restar', { clave, cantidad: quita, motivo: descripcion }, t)
    return { restado: true, cantidad: quita }
  }, tx)
}

/** Anula un movimiento (por error o porque se corrigió). Queda en el historial. Devuelve true si anuló. */
async function anular(usuarioId, clave, motivo = '', tx = null) {
  return transaccion(async (t) => {
    await datos.bloquear(usuarioId, t)
    const r = await datos.porClave(usuarioId, clave, t)
    if (!r || r.anulado) return false
    await datos.anular(usuarioId, r.id, ahora(), motivo || 'Anulado', t)
    await anotar(usuarioId, 'xp', 'anular', { clave, antes: limpio(r), motivo }, t)
    // Anular una resta devuelve XP: puede volver a subir de nivel.
    if (r.cantidad < 0) {
      const { baseNivel } = await obtenerAjustes(usuarioId, t)
      const despues = await datos.total(usuarioId, QUE_RESTAN, t)
      await siSubio(usuarioId, Math.max(0, despues + r.cantidad), despues, baseNivel, t)
    }
    return true
  }, tx)
}

/** Anular desde la pantalla, por id. */
async function anularPorId(usuarioId, id, motivo = '', tx = null) {
  const r = await datos.porId(usuarioId, id, tx)
  if (!r) throw noEncontrado('Ese movimiento de XP')
  if (r.anulado) throw datoInvalido('Ese movimiento ya estaba anulado.')
  return anular(usuarioId, r.clave, motivo, tx)
}

async function total(usuarioId, tx = null) {
  return datos.total(usuarioId, QUE_RESTAN, tx)
}

/** Nivel y progreso: { nivel, etapa, xpTotal, xpEnNivel, xpParaSiguiente, progreso, ... }. */
async function estado(usuarioId, tx = null) {
  const { baseNivel } = await obtenerAjustes(usuarioId, tx)
  return calculo.estadoNivel(await total(usuarioId, tx), baseNivel)
}

/** Movimientos de un día (anulados también). */
async function delDia(usuarioId, fecha, tx = null) {
  return (await datos.delDia(usuarioId, fecha, tx)).map(limpio)
}

/** «+35 / −8» de un día. */
async function balanceDelDia(usuarioId, fecha, tx = null) {
  return calculo.balanceDe(await datos.delDia(usuarioId, fecha, tx))
}

/** XP neta por día entre dos fechas (incluidas): [{ fecha, xp }]. Para la montaña de Progreso. */
async function xpPorDia(usuarioId, desde, hasta, tx = null) {
  return datos.porDia(usuarioId, desde, hasta, tx)
}

/**
 * La tabla de niveles (Progreso → tocar Nivel): hasta `hasta` (al menos 5 más que el actual), con el día en que se
 * alcanzó cada nivel (el primer día en que la XP acumulada llegó a su piso). Como en la app vieja.
 */
async function tablaNiveles(usuarioId, tx = null) {
  const { baseNivel } = await obtenerAjustes(usuarioId, tx)
  const actual = calculo.estadoNivel(await total(usuarioId, tx), baseNivel).nivel
  const hasta = Math.max(15, actual + 5)
  const dias = await datos.porDia(usuarioId, '1900-01-01', '2999-12-31', tx)
  const alcanzado = new Map()
  let acumulado = 0
  for (const d of dias) {
    acumulado += Number(d.xp || 0)
    for (let n = 2; n <= hasta && calculo.xpParaNivel(n, baseNivel) <= acumulado; n++) if (!alcanzado.has(n)) alcanzado.set(n, d.fecha)
  }
  const filas = []
  for (let n = 1; n <= hasta; n++) filas.push({ nivel: n, xpTotal: calculo.xpParaNivel(n, baseNivel), etapa: calculo.etapaDeNivel(n), alcanzado: n <= actual ? alcanzado.get(n) || null : null })
  return { base: baseNivel, actual, filas }
}

/** XP neta antes de una fecha (para arrancar la montaña). */
async function xpAntesDe(usuarioId, fecha, tx = null) {
  return datos.antesDe(usuarioId, fecha, tx)
}

/** Historial de XP, del más nuevo al más viejo. `antesDe` (id) para pedir la página siguiente. */
async function historialXp(usuarioId, { cantidad = 50, antesDe = null } = {}, tx = null) {
  const n = Math.max(1, Math.min(200, Math.floor(cantidad) || 50))
  return (await datos.ultimos(usuarioId, n, antesDe, tx)).map(limpio)
}

// ── Lo no cumplido resta ─────────────────────────────────────────────

async function configResta(usuarioId, tx = null) {
  return calculo.configResta(await obtenerAjustes(usuarioId, tx))
}

/** Si está prendida y todavía no tiene día de inicio, lo fija hoy (nunca hacia atrás). */
async function asegurarInicioResta(usuarioId, hoy, tx = null) {
  const cfg = await configResta(usuarioId, tx)
  if (cfg.activa && !cfg.desde) {
    await guardarAjustes(usuarioId, { xpResta: { activa: true, porcentaje: cfg.porcentaje, desde: hoy } }, tx)
    return { ...cfg, desde: hoy }
  }
  return cfg
}

/** Prender, apagar o cambiar el %. Al prender, vale desde hoy (lo de antes no se toca). */
async function cambiarResta(usuarioId, { activa, porcentaje } = {}, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const cfg = calculo.configResta(a)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const nueva = activa ?? cfg.activa
  const prende = nueva && !cfg.activa
  const p = porcentaje !== undefined ? Math.max(10, Math.min(100, Math.round(Number(porcentaje) || 0))) : cfg.porcentaje
  const xpResta = { activa: nueva, porcentaje: p, desde: prende || !cfg.desde ? hoy : cfg.desde }
  await guardarAjustes(usuarioId, { xpResta }, tx)
  await anotar(usuarioId, 'xp', 'ajustar_resta', xpResta, tx)
  return xpResta
}

function revisarFaltantes(faltantes) {
  if (!Array.isArray(faltantes)) throw datoInvalido('Los faltantes tienen que ser una lista.')
  return faltantes.filter((f) => f && typeof f.id === 'string' && Number.isFinite(f.xp))
    .map((f) => ({ id: f.id, nombre: String(f.nombre || f.id), xp: f.xp, tipo: f.tipo || 'pilar' }))
}

/**
 * Al cerrar un día: una resta por cada cosa que faltó. Idempotente (el mismo día nunca resta dos veces).
 * Devuelve cuánto restó en total.
 */
async function aplicarRestas(usuarioId, fecha, faltantes, tx = null) {
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  const lista = revisarFaltantes(faltantes)
  return transaccion(async (t) => {
    const cfg = await configResta(usuarioId, t)
    if (!calculo.aplicaEnFecha(cfg, fecha) || !lista.length) return 0
    await datos.bloquear(usuarioId, t)
    const ya = new Set((await datos.delDia(usuarioId, fecha, t)).filter((x) => x.origen === 'resta').map((x) => x.clave))
    const nuevas = lista.filter((f) => !ya.has(claveResta(f.id, fecha)))
    const restas = calculo.restasDelDia(nuevas, cfg, fecha, await datos.total(usuarioId, QUE_RESTAN, t))
    let suma = 0
    for (const x of restas) {
      const r = await restar(usuarioId, { clave: claveResta(x.id, fecha), cantidad: x.cantidad, origen: 'resta', fecha, descripcion: `${x.nombre} sin hacer` }, t)
      suma += r.cantidad
    }
    return suma
  }, tx)
}

/** Si se corrige (el pilar se marca después, la serie llega a la cuota), la resta de ese día se devuelve. */
async function devolverResta(usuarioId, id, fecha, motivo = 'Corregido: ya está hecho', tx = null) {
  return anular(usuarioId, claveResta(id, fecha), motivo, tx)
}

/** Aviso de hoy: lo que falta y cuánto restaría. null si no resta o no falta nada. */
async function avisoResta(usuarioId, hoy, faltantes, tx = null) {
  const cfg = await configResta(usuarioId, tx)
  if (!calculo.aplicaEnFecha(cfg, hoy)) return null
  const lista = revisarFaltantes(faltantes)
  if (!lista.length) return null
  const total = lista.reduce((s, f) => s + calculo.cuantoResta(f.xp, cfg.porcentaje), 0)
  return { faltantes: lista, porcentaje: cfg.porcentaje, total, texto: calculo.textoAvisoResta(lista, cfg.porcentaje) }
}

/** Todo lo de la pantalla de XP. */
async function resumen(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const ayer = sumarDias(hoy, -1)
  return {
    hoy,
    estado: calculo.estadoNivel(await total(usuarioId, tx), a.baseNivel),
    balanceHoy: await balanceDelDia(usuarioId, hoy, tx),
    balanceAyer: await balanceDelDia(usuarioId, ayer, tx),
    resta: calculo.configResta(a),
    movimientos: await historialXp(usuarioId, { cantidad: 50 }, tx),
  }
}

/**
 * Trae el XP de una copia de la app vieja (tabla `xp` de «Copiar todo como texto»).
 * Respeta claves, cantidades, fechas y anulaciones. Lo repetido no entra. Devuelve cuántos entraron.
 */
async function importar(usuarioId, registrosViejos, tx = null) {
  let n = 0
  for (const r of registrosViejos || []) {
    if (!r || typeof r.clave !== 'string' || !Number.isFinite(r.cantidad) || !esFechaValida(r.fecha)) continue
    const origen = calculo.origenValido(r.origen) ? r.origen : 'manual'
    const cantidad = calculo.ORIGENES_QUE_RESTAN.has(origen) ? Math.floor(r.cantidad) : Math.max(0, Math.floor(r.cantidad))
    const hecho = await datos.crear(usuarioId, {
      clave: r.clave, cantidad, origen, fecha: r.fecha,
      creado: Number.isFinite(r.creado) ? r.creado : ahora(),
      descripcion: r.descripcion || '', anulado: !!r.anulado,
      anuladoEn: Number.isFinite(r.anuladoEn) ? r.anuladoEn : null, motivoAnulacion: r.motivoAnulacion || null,
    }, tx)
    if (hecho) n++
  }
  if (n) await anotar(usuarioId, 'xp', 'importar', { registros: n }, tx)
  return n
}

/** Todo el XP de la persona, con la misma forma que recibe `importar` (lo usa el módulo copia). */
async function exportar(usuarioId, tx = null) {
  return (await datos.todos(usuarioId, tx)).map(({ id, ...r }) => r)
}

module.exports = {
  exportar,
  sumar, restar, anular, anularPorId, total, estado, tablaNiveles, delDia, balanceDelDia, xpPorDia, xpAntesDe, historialXp,
  configResta, asegurarInicioResta, cambiarResta, aplicarRestas, devolverResta, avisoResta, resumen, importar,
  claveXp: calculo.claveXp,
}
