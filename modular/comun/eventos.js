'use strict'
/**
 * Avisos entre módulos, para avisar «al revés» sin crear dependencias en círculo.
 * Ej.: un módulo avisa 'organizacion.tarea.hecha' y otro lo escucha, sin requerirse.
 *
 * Los que escuchan se esperan en orden. Si uno falla, el error sube a quien avisó
 * (así, dentro de una transacción, todo vuelve atrás).
 * Cada aviso registrado se anota en el LEEME del módulo que lo emite.
 */
const oyentes = new Map()

function escuchar(nombre, fn) {
  if (!oyentes.has(nombre)) oyentes.set(nombre, [])
  oyentes.get(nombre).push(fn)
  return () => { const l = oyentes.get(nombre) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1) }
}

async function avisar(nombre, datos, tx = null) {
  for (const fn of oyentes.get(nombre) || []) await fn(datos, tx)
}

/** Pruebas: borra todos los oyentes. */
function limpiar() { oyentes.clear() }

module.exports = { escuchar, avisar, limpiar }
