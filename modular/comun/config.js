'use strict'
/**
 * Configuración. Sale de variables de entorno o de un archivo JSON FUERA del repo
 * (ruta en SEK_CONFIG). Las claves nunca van al repo.
 */
const fs = require('node:fs')

function leerArchivo() {
  const ruta = process.env.SEK_CONFIG
  if (!ruta) return {}
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8')) } catch (e) { throw new Error(`No pude leer SEK_CONFIG (${ruta}): ${e.message}`) }
}

const archivo = leerArchivo()

module.exports = {
  puerto: Number(process.env.PUERTO || archivo.puerto || 3000),
  host: process.env.HOST || archivo.host || '0.0.0.0',
  baseUrl: process.env.DATABASE_URL || archivo.baseUrl || 'postgres://postgres@localhost:5432/sek',
  /** Duración de la sesión (días). */
  diasSesion: Number(process.env.SEK_DIAS_SESION || archivo.diasSesion || 60),
  /** true en producción: la cookie va solo por https. */
  produccion: (process.env.NODE_ENV || archivo.entorno) === 'production',
}
