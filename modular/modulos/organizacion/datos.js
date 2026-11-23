'use strict'
/** Consultas SQL del módulo organizacion. Solo las usa ventanilla.js. Tabla: organizacion_datos (una fila por persona). */
const { una, consulta } = require('../../comun/base')

/** Lo guardado de la persona ({ datos, actualizado }) o null si todavía no guardó nada. */
const leer = (usuarioId, tx, bloquear = false) =>
  una(`SELECT datos, actualizado FROM organizacion_datos WHERE usuario_id = $1${bloquear ? ' FOR UPDATE' : ''}`, [usuarioId], tx)

/** Guarda todo el JSON de la persona (crea la fila la primera vez). */
async function guardar(usuarioId, datos, actualizado, tx) {
  const texto = JSON.stringify(datos)
  await consulta('INSERT INTO organizacion_datos (usuario_id, datos, actualizado) VALUES ($1, $2, $3) ON CONFLICT (usuario_id) DO NOTHING',
    [usuarioId, texto, actualizado], tx)
  return una('UPDATE organizacion_datos SET datos = $2, actualizado = $3 WHERE usuario_id = $1 RETURNING datos, actualizado',
    [usuarioId, texto, actualizado], tx)
}

module.exports = { leer, guardar }
