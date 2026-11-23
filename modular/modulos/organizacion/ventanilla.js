'use strict'
/**
 * Organización · la única puerta del módulo.
 * Frentes y tareas (Anotar, Clasificar, Hoy me toca a mí, Sueltas). Todo lo de una persona es un solo JSON
 * (formato 1, ver LEEME.md). Las reglas están en modelo.js, el mismo archivo que usa la pantalla.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const M = require('./modelo')
const { obtenerAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { ahora } = require('../../comun/reloj')
const { fechaDe } = require('../../comun/fechas')
const { transaccion } = require('../../comun/base')
const { ErrorSek, datoInvalido, noEncontrado } = require('../../comun/errores')

/** Hoy (AAAA-MM-DD) en la zona de la persona. */
async function hoyDe(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  return fechaDe(ahora(), a.zonaHoraria)
}

/**
 * Lo de la persona, ya validado: { datos, actualizado, hoy }.
 * Si todavía no guardó nada, arranca con Sueltas y Personal (no se guarda hasta el primer cambio).
 */
async function leer(usuarioId, tx = null) {
  const hoy = await hoyDe(usuarioId, tx)
  const fila = await datos.leer(usuarioId, tx)
  return { datos: M.normalizar(fila ? fila.datos : null, hoy, ahora()), actualizado: fila ? fila.actualizado : 0, hoy }
}

/** Avisa 'organizacion.tarea.hecha' por cada tarea que pasó a hecha entre `antes` y `despues`. */
async function avisarHechas(usuarioId, antes, despues, tx) {
  for (const { f, t } of M.recienHechas(antes, despues)) {
    await avisar('organizacion.tarea.hecha', { usuarioId, frente: { id: f.id, nombre: f.nombre }, tarea: { ...t } }, tx)
  }
}

/**
 * Guarda todo el JSON (lo que manda la pantalla después de cada cambio).
 * `antes` (opcional) es el `actualizado` que la pantalla tenía: si en el medio se guardó otra cosa
 * (otro teléfono u otra pestaña), no pisa y responde 409 para que la pantalla vuelva a leer.
 */
async function guardar(usuarioId, nuevos, antes = null, tx = null) {
  if (!nuevos || typeof nuevos !== 'object' || !Array.isArray(nuevos.frentes)) throw datoInvalido('Los datos de Organización vinieron mal.')
  return transaccion(async (t) => {
    const hoy = await hoyDe(usuarioId, t)
    const fila = await datos.leer(usuarioId, t, true)
    if (antes !== null && antes !== undefined && fila && Number(antes) !== fila.actualizado) {
      throw new ErrorSek('Organización cambió en otro lado. Volví a cargar lo último.', 409)
    }
    const viejos = M.normalizar(fila ? fila.datos : null, hoy, ahora())
    const limpios = M.normalizar(JSON.parse(JSON.stringify(nuevos)), hoy, ahora())
    const momento = Math.max(ahora(), fila ? fila.actualizado + 1 : 0)
    const g = await datos.guardar(usuarioId, limpios, momento, t)
    await avisarHechas(usuarioId, viejos, limpios, t)
    return { datos: g.datos, actualizado: g.actualizado, hoy }
  }, tx)
}

/**
 * Para la tira «Hoy me toca a mí» de la pantalla Hoy (módulo dia).
 * { hoy, limite, tareas: [{ frente: { id, nombre, color, icono, tipo }, tarea }], meToca, bandeja, hechas, total, porcentaje }
 */
async function resumenHoy(usuarioId, tx = null) {
  const { datos: d, hoy } = await leer(usuarioId, tx)
  const r = M.resumen(d, hoy)
  const tareas = M.meToca(d, hoy).map(({ f, t }) => ({ frente: { id: f.id, nombre: f.nombre, color: f.color, icono: f.icono, tipo: f.tipo }, tarea: t }))
  return { hoy, limite: d.ajustes.limiteHoy || 3, tareas, ...r }
}

/** Marca hecha una tarea (el botón ✓ de la tira de Hoy). Avisa 'organizacion.tarea.hecha'. Devuelve resumenHoy. */
async function marcarHecha(usuarioId, frenteId, tareaId, tx = null) {
  return transaccion(async (t) => {
    const { datos: d, actualizado } = await leer(usuarioId, t)
    const x = M.buscarTarea(d, frenteId, tareaId)
    if (!x) throw noEncontrado('Esa tarea')
    if (x.t.estado !== 'hecho') {
      M.marcar(d, frenteId, tareaId, 'hecho', await hoyDe(usuarioId, t), ahora())
      await guardar(usuarioId, d, actualizado || null, t)
    }
    return resumenHoy(usuarioId, t)
  }, tx)
}

/**
 * Trae Organización de una copia de la app vieja («Copiar todo como texto»): la tabla `organizacion`
 * (filas `{ id: 'datos', datos }`) o directamente el objeto de datos. Reemplaza lo que haya.
 * Lo llama el módulo copia. Devuelve 1 si entró algo, 0 si no había nada.
 */
async function importar(usuarioId, viejo, tx = null) {
  let d = viejo
  if (Array.isArray(viejo)) d = (viejo.find((f) => f && f.id === 'datos') || viejo[0] || {}).datos
  else if (viejo && viejo.datos && !viejo.frentes) d = viejo.datos
  if (!d || typeof d !== 'object' || !Array.isArray(d.frentes)) return 0
  return transaccion(async (t) => {
    const hoy = await hoyDe(usuarioId, t)
    const limpios = M.normalizar(JSON.parse(JSON.stringify(d)), hoy, ahora())
    const fila = await datos.leer(usuarioId, t, true)
    await datos.guardar(usuarioId, limpios, Math.max(ahora(), fila ? fila.actualizado + 1 : 0), t)
    const tareas = [...limpios.frentes, ...limpios.archivados].reduce((n, f) => n + f.tareas.length, 0)
    await anotar(usuarioId, 'organizacion', 'importar', { frentes: limpios.frentes.length, tareas, bandeja: limpios.bandeja.length }, t)
    return 1
  }, tx)
}

/** Los datos de Organización, con la forma que recibe `importar` (lo usa el módulo copia). */
async function exportar(usuarioId, tx = null) {
  return (await leer(usuarioId, tx)).datos
}

module.exports = { leer, guardar, resumenHoy, marcarHecha, importar, exportar }
