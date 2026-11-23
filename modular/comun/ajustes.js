'use strict'
/**
 * Ajustes de cada persona: un objeto JSON por persona. Lo que no está guardado sale de AJUSTES_INICIALES.
 * Solo se suman campos nuevos; nunca se borra lo cargado.
 * Cada módulo que necesite un ajuste propio lo agrega acá con su valor inicial y lo anota en su LEEME.
 */
const { una, consulta } = require('./base')
const { ahora } = require('./reloj')
const { ZONA_POR_DEFECTO } = require('./fechas')

const AJUSTES_INICIALES = {
  zonaHoraria: ZONA_POR_DEFECTO,
  nombreApp: 'SEK',
  nombrePersona: '',
  tema: 'shinobi',
  // temas: lluvia de fondo de las pantallas ('apagada' | 'llovizna' | 'lluvia' | 'tormenta')
  lluvia: 'lluvia',
  diaInicioSemana: 1,
  // cuentas (pantalla Más → Nombres): los nombres de las fases del ciclo
  nombresFases: ['Disciplina', 'Constancia', 'Mi yo ideal'],
  // juego
  limiteJuegoSemana: 60,
  limiteJuegoFinde: 120,
  avisoJuegoPorcentaje: 80,
  // xp
  baseNivel: 100,
  xpResta: { activa: true, porcentaje: 50, desde: null },
}

async function obtenerAjustes(usuarioId, tx = null) {
  const f = await una('SELECT datos FROM ajustes WHERE usuario_id = $1', [usuarioId], tx)
  return { ...AJUSTES_INICIALES, ...(f ? f.datos : {}) }
}

/** Guarda solo los campos que vienen. Devuelve los ajustes completos. */
async function guardarAjustes(usuarioId, cambios, tx = null) {
  const limpio = {}
  for (const [k, v] of Object.entries(cambios || {})) if (k in AJUSTES_INICIALES && v !== undefined) limpio[k] = v
  await consulta(
    `INSERT INTO ajustes (usuario_id, datos, actualizado) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id) DO UPDATE SET datos = ajustes.datos || EXCLUDED.datos, actualizado = EXCLUDED.actualizado`,
    [usuarioId, limpio, ahora()], tx)
  return obtenerAjustes(usuarioId, tx)
}

module.exports = { AJUSTES_INICIALES, obtenerAjustes, guardarAjustes }
