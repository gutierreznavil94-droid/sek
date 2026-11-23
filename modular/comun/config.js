'use strict'
/**
 * Configuración. SEK corre en el celu, sin servidor: casi no hay nada que configurar.
 * En la compu se puede cambiar con variables de entorno (pruebas).
 */
const env = (typeof process !== 'undefined' && process.env) || {}

module.exports = {
  /** Cuánto dura una sesión (días). En el celu la sesión es de la única persona y casi no vence. */
  diasSesion: Number(env.SEK_DIAS_SESION || 3650),
  /** true solo si algún día hay un servidor con https: la cookie va con Secure. */
  produccion: env.NODE_ENV === 'production',
}
