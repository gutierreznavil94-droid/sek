'use strict'
/**
 * La hora de la app. Todo pide `ahora()` acá, nunca Date.now() directo,
 * para que las pruebas puedan fijar la hora con `fijar(ms)`.
 */
let fijo = null
const ahora = () => (fijo === null ? Date.now() : fijo)
const fijar = (ms) => { fijo = ms }
const avanzar = (ms) => { fijo = ahora() + ms }
const soltar = () => { fijo = null }

module.exports = { ahora, fijar, avanzar, soltar }
