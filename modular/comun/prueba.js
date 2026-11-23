'use strict'
/**
 * Ayuda para las pruebas (node:test). Usa una base APARTE, nunca la real:
 * SEK_BASE_PRUEBA (por defecto postgres://postgres@localhost:5432/sek_prueba).
 * `prepararBase()` borra todo, aplica las migraciones y deja la hora fija.
 */
const base = require('./base')
const reloj = require('./reloj')
const eventos = require('./eventos')

const URL_PRUEBA = process.env.SEK_BASE_PRUEBA || 'postgres://postgres@localhost:5432/sek_prueba'

async function prepararBase() {
  base.usarBase(URL_PRUEBA)
  await base.consulta('DROP SCHEMA public CASCADE')
  await base.consulta('CREATE SCHEMA public')
  const { migrar } = require('./migrar')
  await migrar({ silencio: true })
  // Lunes 23 nov 2026, 10:00 en Córdoba (13:00 UTC).
  reloj.fijar(Date.UTC(2026, 10, 23, 13, 0, 0))
}

/** Crea una persona de prueba y devuelve su id. */
async function personaDePrueba(nombre = 'Prueba') {
  const { crearUsuario } = require('./sesion')
  const u = await crearUsuario({ nombre, email: `${nombre.toLowerCase()}${Math.random().toString(36).slice(2, 8)}@prueba.com`, clave: 'clave-de-prueba' })
  return u.id
}

async function terminar() {
  reloj.soltar()
  eventos.limpiar()
  await base.cerrar()
}

module.exports = { prepararBase, personaDePrueba, terminar, URL_PRUEBA }
