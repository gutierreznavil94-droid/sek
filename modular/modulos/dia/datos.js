'use strict'
/**
 * Consultas SQL del módulo dia. Solo las usa ventanilla.js.
 * Tablas: acciones, reglas_xp, compromisos, dias_cerrados, atributos_diarios, excepciones, dia_vistas.
 */
const { una, todas, consulta } = require('../../comun/base')

// ---------- acciones ----------
const C_ACCION = `id, nombre, tipo, dias, hora, hora_limite AS "horaLimite", pilar, atributo_ids AS "atributoIds", peso, activa, orden, opciones, creado`
/** Las opciones (JSON) se aplanan: la acción queda como en la app vieja. */
const aplanar = (f) => f && { ...f.opciones, id: f.id, nombre: f.nombre, tipo: f.tipo, dias: f.dias, hora: f.hora ?? undefined, horaLimite: f.horaLimite ?? undefined,
  pilar: f.pilar, atributoIds: f.atributoIds, peso: f.peso, activa: f.activa, orden: f.orden, creado: f.creado }

const acciones = async (u, tx) => (await todas(`SELECT ${C_ACCION} FROM acciones WHERE usuario_id = $1 ORDER BY orden, id`, [u], tx)).map(aplanar)
const accion = async (u, id, tx) => aplanar(await una(`SELECT ${C_ACCION} FROM acciones WHERE usuario_id = $1 AND id = $2`, [u, id], tx))
const cuantasAcciones = async (u, tx) => (await una('SELECT count(*)::int AS n FROM acciones WHERE usuario_id = $1', [u], tx)).n

const guardarAccion = (u, a, opciones, tx) =>
  consulta(`INSERT INTO acciones (usuario_id, id, nombre, tipo, dias, hora, hora_limite, pilar, atributo_ids, peso, activa, orden, opciones, creado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (usuario_id, id) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, dias = EXCLUDED.dias, hora = EXCLUDED.hora,
              hora_limite = EXCLUDED.hora_limite, pilar = EXCLUDED.pilar, atributo_ids = EXCLUDED.atributo_ids, peso = EXCLUDED.peso,
              activa = EXCLUDED.activa, orden = EXCLUDED.orden, opciones = EXCLUDED.opciones`,
  [u, a.id, a.nombre, a.tipo, JSON.stringify(a.dias), a.hora ?? null, a.horaLimite ?? null, !!a.pilar, JSON.stringify(a.atributoIds || []),
    a.peso ?? 1, a.activa !== false, a.orden ?? 0, JSON.stringify(opciones || {}), a.creado], tx)

const activarAccion = (u, id, activa, tx) => consulta('UPDATE acciones SET activa = $3 WHERE usuario_id = $1 AND id = $2', [u, id, activa], tx)

// ---------- reglas de XP ----------
const C_REGLA = 'id, accion_id AS "accionId", xp, maximo, periodo, valida_desde AS "validaDesde", creado'
const reglas = (u, tx) => todas(`SELECT ${C_REGLA} FROM reglas_xp WHERE usuario_id = $1 ORDER BY valida_desde`, [u], tx)
const reglasDe = (u, accionId, tx) => todas(`SELECT ${C_REGLA} FROM reglas_xp WHERE usuario_id = $1 AND accion_id = $2 ORDER BY valida_desde`, [u, accionId], tx)
const guardarRegla = (u, r, tx) =>
  una(`INSERT INTO reglas_xp (usuario_id, id, accion_id, xp, maximo, periodo, valida_desde, creado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (usuario_id, accion_id, valida_desde) DO UPDATE SET xp = EXCLUDED.xp, maximo = EXCLUDED.maximo, periodo = EXCLUDED.periodo
       RETURNING ${C_REGLA}`, [u, r.id, r.accionId, r.xp, r.maximo ?? 1, r.periodo || 'dia', r.validaDesde, r.creado], tx)

// ---------- compromisos ----------
const C_COMP = `id, accion_id AS "accionId", fecha, hora_prevista AS "horaPrevista", estado, inicio_real AS "inicioReal", fin_real AS "finReal",
  reprogramado_a AS "reprogramadoA", reprogramado_desde AS "reprogramadoDesde", minutos, nota, respuesta, retraso_minutos AS "retrasoMinutos", extra, actualizado`
const sinNulos = (c) => { if (!c) return c; const r = {}; for (const [k, v] of Object.entries(c)) if (v !== null) r[k] = v; return r }

const compromiso = async (u, id, tx) => sinNulos(await una(`SELECT ${C_COMP} FROM compromisos WHERE usuario_id = $1 AND id = $2`, [u, id], tx))
const compromisosEntre = async (u, desde, hasta, tx) =>
  (await todas(`SELECT ${C_COMP} FROM compromisos WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha, id`, [u, desde, hasta], tx)).map(sinNulos)
const compromisosDeAccionDesde = async (u, accionId, desde, tx) =>
  (await todas(`SELECT ${C_COMP} FROM compromisos WHERE usuario_id = $1 AND accion_id = $2 AND fecha >= $3`, [u, accionId, desde], tx)).map(sinNulos)

/** Crea el compromiso si no está. Devuelve true si lo creó. */
const crearCompromiso = async (u, c, tx) => (await consulta(
  `INSERT INTO compromisos (usuario_id, id, accion_id, fecha, hora_prevista, estado, reprogramado_desde, actualizado)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (usuario_id, id) DO NOTHING`,
  [u, c.id, c.accionId, c.fecha, c.horaPrevista ?? null, c.estado || 'pendiente', c.reprogramadoDesde ?? null, c.actualizado], tx)).rowCount > 0

const CAMPOS = { horaPrevista: 'hora_prevista', estado: 'estado', inicioReal: 'inicio_real', finReal: 'fin_real', reprogramadoA: 'reprogramado_a',
  reprogramadoDesde: 'reprogramado_desde', minutos: 'minutos', nota: 'nota', respuesta: 'respuesta', retrasoMinutos: 'retraso_minutos', extra: 'extra', actualizado: 'actualizado' }

/** Guarda el compromiso completo (todas las columnas; lo que falta queda vacío). */
async function ponerCompromiso(u, c, tx) {
  const cols = Object.keys(CAMPOS)
  const sets = cols.map((k, i) => `${CAMPOS[k]} = $${i + 3}`).join(', ')
  const vals = cols.map((k) => (k === 'extra' ? !!c.extra : c[k] ?? null))
  return sinNulos(await una(`UPDATE compromisos SET ${sets} WHERE usuario_id = $1 AND id = $2 RETURNING ${C_COMP}`, [u, c.id, ...vals], tx))
}

const borrarCompromiso = (u, id, tx) => consulta('DELETE FROM compromisos WHERE usuario_id = $1 AND id = $2', [u, id], tx)
/** Al mover el Día 1: lo sin resolver de antes del nuevo inicio se va. */
const borrarSinResolverAntesDe = (u, fecha, tx) =>
  consulta("DELETE FROM compromisos WHERE usuario_id = $1 AND fecha < $2 AND estado IN ('pendiente', 'iniciado')", [u, fecha], tx)
const borrarSinResolverDe = (u, fecha, tx) =>
  consulta("DELETE FROM compromisos WHERE usuario_id = $1 AND fecha = $2 AND estado IN ('pendiente', 'iniciado')", [u, fecha], tx)

// ---------- días cerrados y atributos ----------
const C_CERRADO = 'fecha, cumplidos, programados, porcentaje, minutos_juego AS "minutosJuego", excepcion, cerrado_en AS "cerradoEn"'
const diaCerrado = (u, fecha, tx) => una(`SELECT ${C_CERRADO} FROM dias_cerrados WHERE usuario_id = $1 AND fecha = $2`, [u, fecha], tx)
const ultimoCerrado = async (u, tx) => (await una('SELECT max(fecha) AS f FROM dias_cerrados WHERE usuario_id = $1', [u], tx)).f
const cerradosEntre = (u, desde, hasta, tx) => todas(`SELECT ${C_CERRADO} FROM dias_cerrados WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha`, [u, desde, hasta], tx)
const guardarCerrado = (u, d, tx) =>
  consulta(`INSERT INTO dias_cerrados (usuario_id, fecha, cumplidos, programados, porcentaje, minutos_juego, excepcion, cerrado_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (usuario_id, fecha) DO UPDATE SET cumplidos = EXCLUDED.cumplidos, programados = EXCLUDED.programados,
              porcentaje = EXCLUDED.porcentaje, minutos_juego = EXCLUDED.minutos_juego, excepcion = EXCLUDED.excepcion`,
  [u, d.fecha, d.cumplidos, d.programados, d.porcentaje, Math.round(d.minutosJuego || 0), !!d.excepcion, d.cerradoEn], tx)
const borrarCerradosAntesDe = (u, fecha, tx) => consulta('DELETE FROM dias_cerrados WHERE usuario_id = $1 AND fecha < $2', [u, fecha], tx)

const guardarAtributoDiario = (u, f, tx) =>
  consulta(`INSERT INTO atributos_diarios (usuario_id, fecha, atributo_id, valor, cumplidos, programados) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (usuario_id, atributo_id, fecha) DO UPDATE SET valor = EXCLUDED.valor, cumplidos = EXCLUDED.cumplidos, programados = EXCLUDED.programados`,
  [u, f.fecha, f.atributoId, f.valor, f.cumplidos, f.programados], tx)
const atributoDiario = (u, atributoId, fecha, tx) =>
  una('SELECT fecha, atributo_id AS "atributoId", valor, cumplidos, programados FROM atributos_diarios WHERE usuario_id = $1 AND atributo_id = $2 AND fecha = $3', [u, atributoId, fecha], tx)

// ---------- excepciones ----------
const excepcion = (u, fecha, tx) => una('SELECT fecha, motivo, creado FROM excepciones WHERE usuario_id = $1 AND fecha = $2', [u, fecha], tx)
const excepcionesEntre = (u, desde, hasta, tx) => todas('SELECT fecha, motivo, creado FROM excepciones WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha', [u, desde, hasta], tx)
const ponerExcepcion = (u, e, tx) =>
  consulta(`INSERT INTO excepciones (usuario_id, fecha, motivo, creado) VALUES ($1, $2, $3, $4)
            ON CONFLICT (usuario_id, fecha) DO UPDATE SET motivo = EXCLUDED.motivo`, [u, e.fecha, e.motivo, e.creado], tx)
const quitarExcepcion = (u, fecha, tx) => consulta('DELETE FROM excepciones WHERE usuario_id = $1 AND fecha = $2', [u, fecha], tx)

// ---------- el Tajo ----------
const vistas = (u, tx) => una('SELECT ultima_vista AS "ultimaVista", tajo_fecha AS "tajoFecha" FROM dia_vistas WHERE usuario_id = $1', [u], tx)
const anotarVista = (u, instante, tx) =>
  consulta(`INSERT INTO dia_vistas (usuario_id, ultima_vista) VALUES ($1, $2)
            ON CONFLICT (usuario_id) DO UPDATE SET ultima_vista = EXCLUDED.ultima_vista`, [u, instante], tx)
const marcarTajo = (u, fecha, tx) =>
  consulta(`INSERT INTO dia_vistas (usuario_id, tajo_fecha) VALUES ($1, $2)
            ON CONFLICT (usuario_id) DO UPDATE SET tajo_fecha = EXCLUDED.tajo_fecha`, [u, fecha], tx)

module.exports = {
  acciones, accion, cuantasAcciones, guardarAccion, activarAccion,
  reglas, reglasDe, guardarRegla,
  compromiso, compromisosEntre, compromisosDeAccionDesde, crearCompromiso, ponerCompromiso, borrarCompromiso, borrarSinResolverAntesDe, borrarSinResolverDe,
  diaCerrado, ultimoCerrado, cerradosEntre, guardarCerrado, borrarCerradosAntesDe, guardarAtributoDiario, atributoDiario,
  excepcion, excepcionesEntre, ponerExcepcion, quitarExcepcion,
  vistas, anotarVista, marcarTajo,
}
