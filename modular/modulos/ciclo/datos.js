'use strict'
/**
 * Consultas SQL del módulo ciclo. Solo las usa ventanilla.js.
 * Tablas: ciclos, fases, objetivos, atributos, identidad, metas, revisiones.
 */
const { una, todas, consulta } = require('../../comun/base')

// ---------- ciclos ----------
const C_CICLO = 'id, numero, inicio, dia_cero AS "diaCero", duracion_dias AS "duracionDias", dias_por_fase AS "diasPorFase", estado, creado, cerrado'

const cicloActivo = (u, tx) => una(`SELECT ${C_CICLO} FROM ciclos WHERE usuario_id = $1 AND estado = 'activo'`, [u], tx)
const cicloPorId = (u, id, tx) => una(`SELECT ${C_CICLO} FROM ciclos WHERE usuario_id = $1 AND id = $2`, [u, id], tx)
const ciclos = (u, tx) => todas(`SELECT ${C_CICLO} FROM ciclos WHERE usuario_id = $1 ORDER BY numero`, [u], tx)
const cuantosCiclos = async (u, tx) => (await una('SELECT count(*)::int AS n FROM ciclos WHERE usuario_id = $1', [u], tx)).n

const crearCiclo = (u, c, tx) =>
  una(`INSERT INTO ciclos (usuario_id, id, numero, inicio, dia_cero, duracion_dias, dias_por_fase, estado, creado, cerrado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${C_CICLO}`,
  [u, c.id, c.numero, c.inicio, c.diaCero ?? null, c.duracionDias, c.diasPorFase, c.estado, c.creado, c.cerrado ?? null], tx)

const cerrarCiclo = (u, id, instante, tx) =>
  consulta("UPDATE ciclos SET estado = 'cerrado', cerrado = $3 WHERE usuario_id = $1 AND id = $2", [u, id, instante], tx)

const cambiarInicio = (u, id, inicio, tx) =>
  una(`UPDATE ciclos SET inicio = $3, dia_cero = NULL WHERE usuario_id = $1 AND id = $2 RETURNING ${C_CICLO}`, [u, id, inicio], tx)

// ---------- fases ----------
const C_FASE = 'id, ciclo_id AS "cicloId", numero, dia_inicio AS "diaInicio", dia_fin AS "diaFin", foco, que_se_mide AS "queSeMide", notas_cierre AS "notasCierre", cerrada_en AS "cerradaEn"'

const fases = (u, cicloId, tx) => todas(`SELECT ${C_FASE} FROM fases WHERE usuario_id = $1 AND ciclo_id = $2 ORDER BY numero`, [u, cicloId], tx)
const fasePorId = (u, id, tx) => una(`SELECT ${C_FASE} FROM fases WHERE usuario_id = $1 AND id = $2`, [u, id], tx)

const crearFase = (u, f, tx) =>
  consulta(`INSERT INTO fases (usuario_id, id, ciclo_id, numero, dia_inicio, dia_fin, foco, que_se_mide, notas_cierre, cerrada_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
  [u, f.id, f.cicloId, f.numero, f.diaInicio, f.diaFin, f.foco || '', f.queSeMide || '', f.notasCierre ?? null, f.cerradaEn ?? null], tx)

const editarFase = (u, id, { foco, queSeMide }, tx) =>
  una(`UPDATE fases SET foco = $3, que_se_mide = $4 WHERE usuario_id = $1 AND id = $2 RETURNING ${C_FASE}`, [u, id, foco, queSeMide], tx)

const cerrarFase = (u, id, notas, instante, tx) =>
  una(`UPDATE fases SET notas_cierre = $3, cerrada_en = $4 WHERE usuario_id = $1 AND id = $2 RETURNING ${C_FASE}`, [u, id, notas, instante], tx)

// ---------- objetivos ----------
const C_OBJ = 'id, ciclo_id AS "cicloId", fase_numero AS "faseNumero", atributo_id AS "atributoId", titulo, indicador, linea_base AS "lineaBase", meta, resultado, creado, archivado'

const objetivos = (u, cicloId, tx) =>
  todas(`SELECT ${C_OBJ} FROM objetivos WHERE usuario_id = $1 AND ciclo_id = $2 AND NOT archivado ORDER BY fase_numero, creado`, [u, cicloId], tx)
const objetivoPorId = (u, id, tx) => una(`SELECT ${C_OBJ} FROM objetivos WHERE usuario_id = $1 AND id = $2`, [u, id], tx)

const guardarObjetivo = (u, o, tx) =>
  una(`INSERT INTO objetivos (usuario_id, id, ciclo_id, fase_numero, atributo_id, titulo, indicador, linea_base, meta, resultado, creado, archivado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (usuario_id, id) DO UPDATE SET fase_numero = EXCLUDED.fase_numero, atributo_id = EXCLUDED.atributo_id, titulo = EXCLUDED.titulo,
         indicador = EXCLUDED.indicador, linea_base = EXCLUDED.linea_base, meta = EXCLUDED.meta, resultado = EXCLUDED.resultado
       RETURNING ${C_OBJ}`,
  [u, o.id, o.cicloId, o.faseNumero, o.atributoId, o.titulo, o.indicador || '', o.lineaBase ?? null, o.meta ?? null, o.resultado ?? null, o.creado, !!o.archivado], tx)

const ponerResultado = (u, id, resultado, tx) =>
  consulta('UPDATE objetivos SET resultado = $3 WHERE usuario_id = $1 AND id = $2', [u, id, resultado], tx)

const archivarObjetivo = (u, id, tx) => consulta('UPDATE objetivos SET archivado = true WHERE usuario_id = $1 AND id = $2', [u, id], tx)

// ---------- atributos ----------
const C_ATR = 'id, nombre, descripcion, orden, ventana_dias AS "ventanaDias", creado, archivado'

const atributos = (u, conArchivados, tx) =>
  todas(`SELECT ${C_ATR} FROM atributos WHERE usuario_id = $1 ${conArchivados ? '' : 'AND NOT archivado'} ORDER BY orden, creado`, [u], tx)
const atributoPorId = (u, id, tx) => una(`SELECT ${C_ATR} FROM atributos WHERE usuario_id = $1 AND id = $2`, [u, id], tx)

const guardarAtributo = (u, a, tx) =>
  una(`INSERT INTO atributos (usuario_id, id, nombre, descripcion, orden, ventana_dias, creado, archivado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (usuario_id, id) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, orden = EXCLUDED.orden, ventana_dias = EXCLUDED.ventana_dias
       RETURNING ${C_ATR}`,
  [u, a.id, a.nombre, a.descripcion || '', a.orden, a.ventanaDias, a.creado, !!a.archivado], tx)

const archivarAtributo = (u, id, tx) => consulta('UPDATE atributos SET archivado = true WHERE usuario_id = $1 AND id = $2', [u, id], tx)

// ---------- identidad ----------
const identidad = (u, tx) => una('SELECT vision, obstaculos, actualizado FROM identidad WHERE usuario_id = $1', [u], tx)

const guardarIdentidad = (u, { vision, obstaculos }, instante, tx) =>
  una(`INSERT INTO identidad (usuario_id, vision, obstaculos, actualizado) VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE SET vision = EXCLUDED.vision, obstaculos = EXCLUDED.obstaculos, actualizado = EXCLUDED.actualizado
       RETURNING vision, obstaculos, actualizado`, [u, vision, obstaculos, instante], tx)

// ---------- metas ----------
const C_META = 'id, fecha, titulo, tipo, estado, xp, resuelta_en AS "resueltaEn", cumplida_el AS "cumplidaEl", nota, creado'

const metaPorId = (u, id, tx) => una(`SELECT ${C_META} FROM metas WHERE usuario_id = $1 AND id = $2`, [u, id], tx)
const metasPropias = (u, tx) => todas(`SELECT ${C_META} FROM metas WHERE usuario_id = $1 AND tipo = 'propia' ORDER BY fecha, creado`, [u], tx)

/** Metas (todas) con fecha, o cumplidas, entre dos días incluidos. */
const metasEntre = (u, desde, hasta, tx) =>
  todas(`SELECT ${C_META} FROM metas WHERE usuario_id = $1 AND ((fecha BETWEEN $2 AND $3) OR (cumplida_el BETWEEN $2 AND $3)) ORDER BY fecha, creado`, [u, desde, hasta], tx)

const crearMeta = (u, m, tx) =>
  una(`INSERT INTO metas (usuario_id, id, fecha, titulo, tipo, estado, xp, resuelta_en, cumplida_el, nota, creado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${C_META}`,
  [u, m.id, m.fecha, m.titulo, m.tipo, m.estado || 'pendiente', m.xp ?? null, m.resueltaEn ?? null, m.cumplidaEl ?? null, m.nota ?? null, m.creado], tx)

const editarMeta = (u, id, { titulo, fecha, xp, nota }, tx) =>
  una(`UPDATE metas SET titulo = $3, fecha = $4, xp = $5, nota = $6 WHERE usuario_id = $1 AND id = $2 RETURNING ${C_META}`, [u, id, titulo, fecha, xp, nota], tx)

const resolverMeta = (u, id, { estado, resueltaEn, cumplidaEl }, tx) =>
  una(`UPDATE metas SET estado = $3, resuelta_en = $4, cumplida_el = $5 WHERE usuario_id = $1 AND id = $2 RETURNING ${C_META}`, [u, id, estado, resueltaEn, cumplidaEl], tx)

const borrarMeta = (u, id, tx) => consulta('DELETE FROM metas WHERE usuario_id = $1 AND id = $2', [u, id], tx)
const borrarAutomaticas = (u, tx) => consulta("DELETE FROM metas WHERE usuario_id = $1 AND tipo <> 'propia'", [u], tx)

// ---------- revisiones ----------
const C_REV = 'id, tipo, periodo, respuestas, foto, creado, actualizado'

const revision = (u, tipo, periodo, tx) => una(`SELECT ${C_REV} FROM revisiones WHERE usuario_id = $1 AND tipo = $2 AND periodo = $3`, [u, tipo, periodo], tx)

/** Crea la revisión; si ya estaba, cambia solo las respuestas (la foto del momento queda la primera). */
const guardarRevision = (u, r, tx) =>
  una(`INSERT INTO revisiones (usuario_id, id, tipo, periodo, respuestas, foto, creado, actualizado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (usuario_id, tipo, periodo) DO UPDATE SET respuestas = EXCLUDED.respuestas, actualizado = EXCLUDED.actualizado
       RETURNING ${C_REV}, (xmax = 0) AS nueva`,
  [u, r.id, r.tipo, r.periodo, JSON.stringify(r.respuestas || {}), JSON.stringify(r.foto || {}), r.creado, r.actualizado], tx)

const revisiones = (u, tipo, cantidad, tx) =>
  todas(`SELECT ${C_REV} FROM revisiones WHERE usuario_id = $1 AND tipo = $2 ORDER BY periodo DESC LIMIT $3`, [u, tipo, cantidad], tx)

// ---------- copia ----------
/** Todo lo del módulo, también lo archivado (para el módulo copia). */
async function todoParaCopia(u, tx) {
  return {
    ciclos: await ciclos(u, tx),
    fases: await todas(`SELECT ${C_FASE} FROM fases WHERE usuario_id = $1 ORDER BY ciclo_id, numero`, [u], tx),
    objetivos: await todas(`SELECT ${C_OBJ} FROM objetivos WHERE usuario_id = $1 ORDER BY ciclo_id, fase_numero, creado`, [u], tx),
    atributos: await atributos(u, true, tx),
    identidad: await identidad(u, tx),
    metas: await todas(`SELECT ${C_META} FROM metas WHERE usuario_id = $1 ORDER BY fecha, creado`, [u], tx),
    revisiones: await todas(`SELECT ${C_REV} FROM revisiones WHERE usuario_id = $1 ORDER BY tipo, periodo`, [u], tx),
  }
}

module.exports = {
  todoParaCopia,
  cicloActivo, cicloPorId, ciclos, cuantosCiclos, crearCiclo, cerrarCiclo, cambiarInicio,
  fases, fasePorId, crearFase, editarFase, cerrarFase,
  objetivos, objetivoPorId, guardarObjetivo, ponerResultado, archivarObjetivo,
  atributos, atributoPorId, guardarAtributo, archivarAtributo,
  identidad, guardarIdentidad,
  metaPorId, metasPropias, metasEntre, crearMeta, editarMeta, resolverMeta, borrarMeta, borrarAutomaticas,
  revision, guardarRevision, revisiones,
}
