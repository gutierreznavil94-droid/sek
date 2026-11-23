'use strict'
/**
 * Copia · la única puerta del módulo.
 * Importar: lee la copia (de la app vieja o de esta), y le da a cada módulo su parte por su ventanilla (`importar`),
 * todo en una sola transacción (si algo falla, no entra nada). Exportar: le pide a cada módulo su parte (`exportar`).
 * Todas aceptan `tx` opcional al final.
 */
const datos = require('./datos')
const formato = require('./formato')
const { transaccion } = require('../../comun/base')
const { obtenerAjustes, guardarAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { ahora } = require('../../comun/reloj')
const { ErrorSek, datoInvalido } = require('../../comun/errores')

// Las ventanillas de los módulos que reciben y dan su parte. Copia usa a todos; ninguno usa a copia.
const VENTANILLAS = {
  ciclo: require('../ciclo/ventanilla'),
  dia: require('../dia/ventanilla'),
  xp: require('../xp/ventanilla'),
  juego: require('../juego/ventanilla'),
  organizacion: require('../organizacion/ventanilla'),
  sueno: require('../sueno/ventanilla'),
  habitos: require('../habitos/ventanilla'),
  comida: require('../comida/ventanilla'),
  entreno: require('../entreno/ventanilla'),
  temas: require('../temas/ventanilla'),
}

function leer(texto) {
  try { return formato.leerTexto(texto) } catch (e) {
    if (e instanceof formato.CopiaInvalida) throw datoInvalido(e.message)
    throw e
  }
}

/**
 * Mira la copia sin guardar nada: de qué app es, de cuándo, cuántas filas trae cada parte, qué no se trae
 * y si ya se importó. Es lo que se muestra antes de confirmar.
 */
async function revisar(usuarioId, texto, tx = null) {
  const c = leer(texto)
  const partes = formato.MODULOS.map((m) => ({ clave: m.clave, nombre: m.nombre, filas: formato.cuantas(c.partes[m.clave]) }))
  const ya = c.exportado ? await datos.importacion(usuarioId, c.origen, c.exportado, tx) : null
  return {
    origen: c.origen,
    exportado: c.exportado || null,
    partes,
    total: partes.reduce((s, p) => s + p.filas, 0),
    ajustes: Object.keys(c.ajustes).length,
    sinUsar: c.sinUsar,
    yaImportada: ya ? ya.creado : null,
  }
}

/**
 * Importa la copia: suma lo que trae a lo que ya hay (lo repetido no entra; ver el LEEME de cada módulo).
 * La misma copia no se puede importar dos veces. Todo o nada.
 * Devuelve { origen, exportado, resultado: { <modulo>: cuántos entraron }, total, sinUsar }.
 */
async function importar(usuarioId, texto, tx = null) {
  const c = leer(texto)
  return transaccion(async (t) => {
    const reg = await datos.anotarImportacion(usuarioId, { origen: c.origen, exportado: c.exportado || ahora(), creado: ahora() }, t)
    if (!reg) throw new ErrorSek('Esta copia ya se importó. Lo que trae ya está en la app.', 409)
    if (Object.keys(c.ajustes).length) await guardarAjustes(usuarioId, c.ajustes, t)
    const resultado = {}
    for (const { clave } of formato.MODULOS) {
      if (c.partes[clave] === undefined) continue
      resultado[clave] = formato.total(await VENTANILLAS[clave].importar(usuarioId, c.partes[clave], t))
    }
    const total = formato.total(resultado)
    await datos.ponerResultado(usuarioId, reg.id, resultado, t)
    await anotar(usuarioId, 'copia', 'importar', { origen: c.origen, exportado: c.exportado, total, resultado, sinUsar: c.sinUsar.map((x) => x.tabla) }, t)
    return { origen: c.origen, exportado: c.exportado || null, resultado, total, sinUsar: c.sinUsar }
  }, tx)
}

/** Toda la app de la persona en un objeto (formato «nueva»). Se puede volver a importar acá. */
async function exportar(usuarioId, tx = null) {
  return transaccion(async (t) => {
    const exportado = ahora()
    const modulos = {}
    for (const { clave } of formato.MODULOS) modulos[clave] = await VENTANILLAS[clave].exportar(usuarioId, t)
    const ajustes = await obtenerAjustes(usuarioId, t)
    const resultado = Object.fromEntries(formato.MODULOS.map((m) => [m.clave, formato.cuantas(modulos[m.clave])]))
    await datos.anotarExportacion(usuarioId, { exportado, resultado, creado: ahora() }, t)
    return { app: formato.APP_NUEVA, formato: 'modular', version: formato.VERSION_NUEVA, exportado, ajustes, modulos }
  }, tx)
}

/** Para la pantalla: última copia exportada e importaciones hechas. */
async function estado(usuarioId, tx = null) {
  const [ultimaExportacion] = await datos.ultimos(usuarioId, 'exportar', 1, tx)
  const importaciones = await datos.ultimos(usuarioId, 'importar', 5, tx)
  return {
    ultimaExportacion: ultimaExportacion ? ultimaExportacion.creado : null,
    importaciones: importaciones.map((r) => ({ origen: r.origen, exportado: r.exportado, creado: r.creado, total: formato.total(r.resultado) })),
    modulos: formato.MODULOS,
  }
}

module.exports = { revisar, importar, exportar, estado }
