'use strict'
/**
 * Datos del módulo cuentas. Solo lo usa ventanilla.js.
 * No tiene tablas propias: los ajustes viven en la tabla común `ajustes` y la contraseña en `usuarios`,
 * así que acá solo se pasa por las funciones de comun/ (nunca SQL directo sobre tablas de comun).
 */
const ajustes = require('../../comun/ajustes')
const sesion = require('../../comun/sesion')

const leerAjustes = (usuarioId, tx) => ajustes.obtenerAjustes(usuarioId, tx)
const escribirAjustes = (usuarioId, cambios, tx) => ajustes.guardarAjustes(usuarioId, cambios, tx)
const cambiarClave = (usuarioId, actual, nueva, tokenQueQueda, tx) => sesion.cambiarClave(usuarioId, actual, nueva, tokenQueQueda, tx)

module.exports = { leerAjustes, escribirAjustes, cambiarClave, INICIALES: ajustes.AJUSTES_INICIALES }
