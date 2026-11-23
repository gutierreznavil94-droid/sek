'use strict'
/**
 * Ajustes de cada persona: un objeto JSON por persona. Lo que no está guardado sale de AJUSTES_INICIALES.
 * Solo se suman campos nuevos; nunca se borra lo cargado.
 * Cada módulo que necesite un ajuste propio lo agrega acá con su valor inicial y lo anota en su LEEME.
 */
const { una, consulta, generacionBase } = require('./base')
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
  // sueno
  horaAlistarse: '20:50',
  horaDejarCelu: '21:15',
  horaDormido: '21:20',
  horaCorteNoche: '06:00',
  horaLimiteCelu: '22:15',
  horaFinSuenio: '05:00',
  latenciaDormirseMinutos: 15,
  objetivoSuenioHoras: 7.5,
  relojInteligente: false,
  xpDejoCelu: 20,
  adaptacion: null,
  minutosAvisoDormir: 30,
  frasesDormir: [],
  // habitos: la forja (30 días / 28 válidos), la XP de una caída y si ya se cargaron los ejemplos de Mi código
  forja: { dias: 30, validos: 28, xpDia: 5, xpForjado: 50, maximo: 3 },
  caida: { xp: 20 },
  codigoSembrado: false,
  // dia: margen después de la hora límite (20:50 → 21:00), racha (umbral % y XP cada 7 días), atributos y compromisos sueltos
  margenNocheMinutos: 10,
  umbralRacha: 75,
  xpRacha7: 20,
  minimoProgramadosAtributo: 5,
  maxCompromisosXpPorDia: 5,
  xpCompromisoPorDefecto: 10,
}

// Recuerdo en memoria de los ajustes: la pantalla Hoy los pedía 26 veces por carga (cada consulta cuesta en el celu).
// Solo se recuerda lo leído fuera de una transacción; guardar lo borra. Se tira si cambia la base.
const recuerdo = new Map()
let generacion = -1

async function obtenerAjustes(usuarioId, tx = null) {
  if (generacion !== generacionBase()) { recuerdo.clear(); generacion = generacionBase() }
  if (!tx && recuerdo.has(usuarioId)) return structuredClone(recuerdo.get(usuarioId))
  const f = await una('SELECT datos FROM ajustes WHERE usuario_id = $1', [usuarioId], tx)
  const a = { ...AJUSTES_INICIALES, ...(f ? f.datos : {}) }
  if (!tx) recuerdo.set(usuarioId, structuredClone(a))
  return a
}

/** Guarda solo los campos que vienen. Devuelve los ajustes completos. */
async function guardarAjustes(usuarioId, cambios, tx = null) {
  recuerdo.delete(usuarioId)
  const limpio = {}
  for (const [k, v] of Object.entries(cambios || {})) if (k in AJUSTES_INICIALES && v !== undefined) limpio[k] = v
  await consulta(
    `INSERT INTO ajustes (usuario_id, datos, actualizado) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id) DO UPDATE SET datos = ajustes.datos || EXCLUDED.datos, actualizado = EXCLUDED.actualizado`,
    [usuarioId, limpio, ahora()], tx)
  recuerdo.delete(usuarioId)
  return obtenerAjustes(usuarioId, tx)
}

module.exports = { AJUSTES_INICIALES, obtenerAjustes, guardarAjustes }
