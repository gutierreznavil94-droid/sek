'use strict'
/** Consultas SQL del módulo desafios. Solo las usa ventanilla.js. Tablas: config_desafios, inicios, ninjas. */
const { una, todas, consulta } = require('../../comun/base')

// ---------- config_desafios ----------

const config = (usuarioId, tx) =>
  una('SELECT datos, ultima_vista, tajo_dia, frase_dia FROM config_desafios WHERE usuario_id = $1', [usuarioId], tx)

/** Mezcla `datos` con lo guardado (nunca borra un grupo entero). */
const guardarConfig = (usuarioId, datos, cuando, tx) =>
  consulta(`INSERT INTO config_desafios (usuario_id, datos, actualizado) VALUES ($1, $2, $3)
    ON CONFLICT (usuario_id) DO UPDATE SET datos = config_desafios.datos || EXCLUDED.datos, actualizado = EXCLUDED.actualizado`,
  [usuarioId, JSON.stringify(datos), cuando], tx)

/** Marcas del día: solo cambia las que vienen (undefined = no tocar). */
const guardarMarcas = (usuarioId, { ultimaVista, tajoDia, fraseDia }, tx) =>
  consulta(`INSERT INTO config_desafios (usuario_id, ultima_vista, tajo_dia, frase_dia) VALUES ($1, $2, $3, $4)
    ON CONFLICT (usuario_id) DO UPDATE SET
      ultima_vista = CASE WHEN $5 THEN EXCLUDED.ultima_vista ELSE config_desafios.ultima_vista END,
      tajo_dia = CASE WHEN $6 THEN EXCLUDED.tajo_dia ELSE config_desafios.tajo_dia END,
      frase_dia = CASE WHEN $7 THEN EXCLUDED.frase_dia ELSE config_desafios.frase_dia END`,
  [usuarioId, ultimaVista ?? null, tajoDia ?? null, fraseDia ?? null, ultimaVista !== undefined, tajoDia !== undefined, fraseDia !== undefined], tx)

// ---------- inicios (3·2·1) ----------

const COL_INICIO = 'id, fecha, creado, iniciado, terminado, resultado, accion, tarea_ambigua, compromiso_id, segundos_hasta_empezar, id_viejo'

const crearInicio = (usuarioId, i, tx) =>
  una(`INSERT INTO inicios (usuario_id, fecha, creado, iniciado, terminado, resultado, accion, tarea_ambigua, compromiso_id, segundos_hasta_empezar, id_viejo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${COL_INICIO}`,
  [usuarioId, i.fecha, i.creado, i.iniciado ?? null, i.terminado ?? null, i.resultado ?? null, i.accion, i.tareaAmbigua || '', i.compromisoId ?? null, i.segundosHastaEmpezar ?? null, i.idViejo ?? null], tx)

const inicioPorId = (usuarioId, id, tx) =>
  una(`SELECT ${COL_INICIO} FROM inicios WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const marcarIniciado = (usuarioId, id, iniciado, segundos, tx) =>
  una(`UPDATE inicios SET iniciado = COALESCE(iniciado, $3), segundos_hasta_empezar = COALESCE(segundos_hasta_empezar, $4)
    WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_INICIO}`, [usuarioId, id, iniciado, segundos], tx)

const cerrarInicio = (usuarioId, id, resultado, terminado, tx) =>
  una(`UPDATE inicios SET resultado = $3, terminado = $4 WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_INICIO}`,
    [usuarioId, id, resultado, terminado], tx)

const iniciosEntre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COL_INICIO} FROM inicios WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY creado`, [usuarioId, desde, hasta], tx)

const iniciosRecientes = (usuarioId, cantidad, tx) =>
  todas(`SELECT ${COL_INICIO} FROM inicios WHERE usuario_id = $1 ORDER BY creado DESC, id DESC LIMIT $2`, [usuarioId, cantidad], tx)

const inicioViejo = (usuarioId, idViejo, tx) =>
  una('SELECT id FROM inicios WHERE usuario_id = $1 AND id_viejo = $2', [usuarioId, idViejo], tx)

// ---------- ninjas (archivado) ----------

const COL_NINJA = 'id, fecha, instante, distraccion, momento, resultado, pilar, reps, robo'

const crearPelea = (usuarioId, p, tx) =>
  una(`INSERT INTO ninjas (usuario_id, fecha, instante, distraccion, momento, resultado, pilar, reps, robo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${COL_NINJA}`,
  [usuarioId, p.fecha, p.instante, p.distraccion, p.momento, p.resultado, p.pilar ?? null, p.reps ?? null, p.robo ?? null], tx)

const peleasEntre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COL_NINJA} FROM ninjas WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY instante`, [usuarioId, desde, hasta], tx)

const peleaIgual = (usuarioId, p, tx) =>
  una('SELECT id FROM ninjas WHERE usuario_id = $1 AND instante = $2 AND distraccion = $3', [usuarioId, p.instante, p.distraccion], tx)

const todasLasPeleas = (usuarioId, tx) =>
  todas(`SELECT ${COL_NINJA} FROM ninjas WHERE usuario_id = $1 ORDER BY instante`, [usuarioId], tx)

const todosLosInicios = (usuarioId, tx) =>
  todas(`SELECT ${COL_INICIO} FROM inicios WHERE usuario_id = $1 ORDER BY creado`, [usuarioId], tx)

module.exports = {
  config, guardarConfig, guardarMarcas,
  crearInicio, inicioPorId, marcarIniciado, cerrarInicio, iniciosEntre, iniciosRecientes, inicioViejo, todosLosInicios,
  crearPelea, peleasEntre, peleaIgual, todasLasPeleas,
}
