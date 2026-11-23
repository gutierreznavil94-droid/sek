'use strict'
/**
 * Cuentas · la única puerta del módulo.
 * La pantalla Más: ajustes de la persona (zona horaria, semana, límites de juego), nombres (app, persona, fases),
 * cambiar contraseña y salir. No ofrece nada a otros módulos: cada uno lee sus ajustes con comun/ajustes.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const { anotar } = require('../../comun/historial')
const { datoInvalido } = require('../../comun/errores')

/** Zonas que se ofrecen en la lista (se acepta cualquier zona válida). */
const ZONAS = ['America/Argentina/Cordoba', 'America/Argentina/Buenos_Aires', 'America/Montevideo', 'America/Santiago',
  'America/Sao_Paulo', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid', 'UTC']

function zonaValida(z) {
  try { new Intl.DateTimeFormat('es', { timeZone: z }); return true } catch { return false }
}

function entero(nombre, min, max) {
  return (v) => {
    const n = Number(v)
    if (v === '' || v === null || !Number.isInteger(n) || n < min || n > max) throw datoInvalido(`${nombre}: tiene que ser un número entero entre ${min} y ${max}.`)
    return n
  }
}

function texto(nombre, max, { vacio = false } = {}) {
  return (v) => {
    const t = String(v ?? '').trim()
    if (!vacio && !t) throw datoInvalido(`${nombre}: no puede quedar vacío.`)
    if (t.length > max) throw datoInvalido(`${nombre}: hasta ${max} letras.`)
    return t
  }
}

/** Lo que este módulo deja cambiar, con su control. Lo que no está acá se ignora (lo cambia su propio módulo). */
const CAMPOS = {
  zonaHoraria: (v) => { if (!zonaValida(v)) throw datoInvalido('Esa zona horaria no existe.'); return String(v) },
  diaInicioSemana: (v) => { const n = Number(v); if (n !== 0 && n !== 1) throw datoInvalido('La semana empieza el lunes (1) o el domingo (0).'); return n },
  limiteJuegoSemana: entero('Límite de lunes a viernes', 0, 1440),
  limiteJuegoFinde: entero('Límite de sábado y domingo', 0, 1440),
  avisoJuegoPorcentaje: entero('Aviso de juego', 10, 100),
  nombreApp: texto('Nombre de la app', 20),
  nombrePersona: texto('Tu nombre', 40, { vacio: true }),
  nombresFases: (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 6) throw datoInvalido('Las fases son entre 1 y 6.')
    const base = datos.INICIALES.nombresFases
    return v.map((f, i) => {
      const t = String(f ?? '').trim()
      if (t.length > 30) throw datoInvalido(`Fase ${i + 1}: hasta 30 letras.`)
      return t || base[i] || `Fase ${i + 1}`
    })
  },
}

/** Los ajustes de la persona (todos, con los valores iniciales donde no cambió nada). */
async function ajustes(usuarioId, tx = null) {
  return datos.leerAjustes(usuarioId, tx)
}

/**
 * Guarda los cambios que vienen (solo los campos de CAMPOS). Revisa todo antes de guardar: si uno está mal, no guarda nada.
 * Anota en el historial qué cambió (antes → después). Devuelve los ajustes completos.
 */
async function guardar(usuarioId, cambios, tx = null) {
  const limpio = {}
  for (const [k, v] of Object.entries(cambios || {})) if (k in CAMPOS && v !== undefined) limpio[k] = CAMPOS[k](v)
  if (!Object.keys(limpio).length) throw datoInvalido('No hay nada para guardar.')
  const antes = await datos.leerAjustes(usuarioId, tx)
  const cambio = {}
  for (const [k, v] of Object.entries(limpio)) if (JSON.stringify(antes[k]) !== JSON.stringify(v)) cambio[k] = { antes: antes[k], despues: v }
  if (!Object.keys(cambio).length) return antes
  const despues = await datos.escribirAjustes(usuarioId, limpio, tx)
  await anotar(usuarioId, 'cuentas', 'ajustes', cambio, tx)
  return despues
}

/** Cambia la contraseña (pide la actual) y cierra las demás sesiones; la de `tokenQueQueda` sigue abierta. */
async function cambiarClave(usuarioId, { actual, nueva, repetir }, tokenQueQueda = null, tx = null) {
  if (repetir !== undefined && nueva !== repetir) throw datoInvalido('Las dos contraseñas nuevas no son iguales.')
  if (actual === nueva) throw datoInvalido('La contraseña nueva es igual a la actual.')
  await datos.cambiarClave(usuarioId, actual, nueva, tokenQueQueda, tx)
  await anotar(usuarioId, 'cuentas', 'clave', {}, tx)
}

module.exports = { ZONAS, ajustes, guardar, cambiarClave }
