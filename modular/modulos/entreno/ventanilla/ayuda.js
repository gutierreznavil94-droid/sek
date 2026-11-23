'use strict'
/** Entreno · ayudas internas de la ventanilla (no es puerta: solo la usan los archivos de ventanilla/). */
const { obtenerAjustes } = require('../../../comun/ajustes')
const { fechaDe } = require('../../../comun/fechas')
const { ahora } = require('../../../comun/reloj')

/** Fecha de hoy (AAAA-MM-DD) en la zona de la persona. */
async function fechaHoy(usuarioId, tx = null) {
  const a = await obtenerAjustes(usuarioId, tx)
  return fechaDe(ahora(), a.zonaHoraria)
}

/** Fila de la base → rutina. */
const aRutina = (f) => f && {
  id: f.id, nombre: f.nombre, dias: f.dias || [], bloques: f.bloques || [], minutos: f.minutos, orden: f.orden,
  activa: f.activa, borrada: f.borrada || undefined, creado: f.creado,
}

/** Fila de la base → entreno (lo de `datos` queda al mismo nivel). */
const aSesion = (f) => f && {
  series: [], hechos: [], saltados: [], orden: [], paso: 0,
  ...f.datos,
  id: f.id, rutinaId: f.rutina_id, fecha: f.fecha, estado: f.estado, inicio: f.inicio, fin: f.fin ?? undefined,
}

/** Entreno → columnas + `datos`. */
function deSesion(s) {
  const { id, rutinaId, fecha, estado, inicio, fin, ...datos } = s
  void id
  for (const k of Object.keys(datos)) if (datos[k] === undefined) delete datos[k]
  return { rutinaId, fecha, estado, inicio, fin: fin ?? null, datos }
}

/** Fila → contador. */
const aContador = (f) => f && { ...f.datos, id: f.id, orden: f.orden, activo: f.activo, creado: f.creado }

/** Id nuevo legible: 'rutina-k3j9x2'. */
const nuevoId = (prefijo) => `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

module.exports = { fechaHoy, aRutina, aSesion, deSesion, aContador, nuevoId }
