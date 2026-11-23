'use strict'
/**
 * Consultas SQL del módulo habitos. Solo las usa ventanilla.js.
 * Tablas: forja_habitos, codigo_reglas, caidas, fotos_progreso, marcas_dia.
 */
const { una, todas, consulta } = require('../../comun/base')

// ---------- Forja ----------

const COL_FORJA = `id, nombre, kanji, inicio::text AS inicio, cumplidos, fallas, estado,
  forjado_en::text AS "forjadoEn", abandonado_en::text AS "abandonadoEn", creado`

const forjaTodos = (usuarioId, tx) =>
  todas(`SELECT ${COL_FORJA} FROM forja_habitos WHERE usuario_id = $1 ORDER BY creado, id`, [usuarioId], tx)

const forjaPorId = (usuarioId, id, tx) =>
  una(`SELECT ${COL_FORJA} FROM forja_habitos WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

/** Para que dos toques a la vez sobre el mismo hábito se pongan en fila. */
const forjaBloquear = (usuarioId, id, tx) =>
  una('SELECT id FROM forja_habitos WHERE usuario_id = $1 AND id = $2 FOR UPDATE', [usuarioId, id], tx)

const forjaContarEnForja = async (usuarioId, tx) =>
  (await una("SELECT count(*)::int AS n FROM forja_habitos WHERE usuario_id = $1 AND estado = 'forja'", [usuarioId], tx)).n

/** Crea un hábito. Si el id ya existe (importar dos veces), no hace nada y devuelve null. */
const forjaCrear = (usuarioId, h, tx) =>
  una(`INSERT INTO forja_habitos (usuario_id, id, nombre, kanji, inicio, cumplidos, fallas, estado, forjado_en, abandonado_en, creado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${COL_FORJA}`,
  [usuarioId, h.id, h.nombre, h.kanji, h.inicio, JSON.stringify(h.cumplidos || []), h.fallas || 0, h.estado || 'forja',
    h.forjadoEn || null, h.abandonadoEn || null, h.creado], tx)

const forjaGuardar = (usuarioId, h, tx) =>
  una(`UPDATE forja_habitos SET nombre = $3, kanji = $4, cumplidos = $5, fallas = $6, estado = $7, forjado_en = $8, abandonado_en = $9
       WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_FORJA}`,
  [usuarioId, h.id, h.nombre, h.kanji, JSON.stringify(h.cumplidos || []), h.fallas || 0, h.estado, h.forjadoEn || null, h.abandonadoEn || null], tx)

// ---------- Mi código ----------

const COL_CODIGO = 'id, texto, grupo, momento, orden, orden_momento AS "ordenMomento", creado'

const codigoTodas = (usuarioId, tx) =>
  todas(`SELECT ${COL_CODIGO} FROM codigo_reglas WHERE usuario_id = $1 ORDER BY orden, id`, [usuarioId], tx)

const codigoPorId = (usuarioId, id, tx) =>
  una(`SELECT ${COL_CODIGO} FROM codigo_reglas WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const codigoContar = async (usuarioId, tx) =>
  (await una('SELECT count(*)::int AS n FROM codigo_reglas WHERE usuario_id = $1', [usuarioId], tx)).n

const codigoMaximos = (usuarioId, tx) =>
  una('SELECT COALESCE(max(orden), 0)::int AS orden, COALESCE(max(orden_momento), 0)::int AS "ordenMomento" FROM codigo_reglas WHERE usuario_id = $1', [usuarioId], tx)

const codigoCrear = (usuarioId, r, tx) =>
  una(`INSERT INTO codigo_reglas (usuario_id, id, texto, grupo, momento, orden, orden_momento, creado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${COL_CODIGO}`,
  [usuarioId, r.id, r.texto, r.grupo, r.momento, r.orden, r.ordenMomento, r.creado], tx)

const codigoGuardar = (usuarioId, r, tx) =>
  una(`UPDATE codigo_reglas SET texto = $3, grupo = $4, momento = $5, orden = $6, orden_momento = $7
       WHERE usuario_id = $1 AND id = $2 RETURNING ${COL_CODIGO}`,
  [usuarioId, r.id, r.texto, r.grupo, r.momento, r.orden, r.ordenMomento], tx)

const codigoBorrar = (usuarioId, id, tx) =>
  consulta('DELETE FROM codigo_reglas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

// ---------- Caídas ----------

const COL_CAIDA = 'id, fecha::text AS fecha, instante, origen, xp'

const caidaCrear = (usuarioId, c, tx) =>
  una(`INSERT INTO caidas (usuario_id, id, fecha, instante, origen, xp) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${COL_CAIDA}`,
  [usuarioId, c.id, c.fecha, c.instante, c.origen, c.xp], tx)

const caidaPorId = (usuarioId, id, tx) =>
  una(`SELECT ${COL_CAIDA} FROM caidas WHERE usuario_id = $1 AND id = $2`, [usuarioId, id], tx)

const caidaBorrar = (usuarioId, id, tx) =>
  consulta('DELETE FROM caidas WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

const caidasEntre = (usuarioId, desde, hasta, tx) =>
  todas(`SELECT ${COL_CAIDA} FROM caidas WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3 ORDER BY instante`, [usuarioId, desde, hasta], tx)

const caidasTodas = (usuarioId, tx) =>
  todas(`SELECT ${COL_CAIDA} FROM caidas WHERE usuario_id = $1 ORDER BY instante`, [usuarioId], tx)

// ---------- Fotos ----------

const COL_FOTO_CHICA = 'id, fecha::text AS fecha, dia, creada'

/** Sin la imagen (la lista solo pide los datos; cada imagen se pide aparte). */
const fotosLista = (usuarioId, tx) =>
  todas(`SELECT ${COL_FOTO_CHICA} FROM fotos_progreso WHERE usuario_id = $1 ORDER BY creada, id`, [usuarioId], tx)

const fotoImagen = (usuarioId, id, tx) =>
  una('SELECT imagen FROM fotos_progreso WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)

const fotoCrear = (usuarioId, f, tx) =>
  una(`INSERT INTO fotos_progreso (usuario_id, id, fecha, dia, imagen, creada) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id, id) DO NOTHING RETURNING ${COL_FOTO_CHICA}`,
  [usuarioId, f.id, f.fecha, f.dia ?? null, f.imagen, f.creada], tx)

const fotoBorrar = async (usuarioId, id, tx) =>
  (await consulta('DELETE FROM fotos_progreso WHERE usuario_id = $1 AND id = $2', [usuarioId, id], tx)).rowCount

// ---------- Días marcados ----------

const COL_MARCA = 'fecha::text AS fecha, texto, creada, editada'

const marcasTodas = (usuarioId, tx) =>
  todas(`SELECT ${COL_MARCA} FROM marcas_dia WHERE usuario_id = $1 ORDER BY fecha`, [usuarioId], tx)

const marcaDe = (usuarioId, fecha, tx) =>
  una(`SELECT ${COL_MARCA} FROM marcas_dia WHERE usuario_id = $1 AND fecha = $2`, [usuarioId, fecha], tx)

const marcaActualizar = (usuarioId, fecha, texto, editada, tx) =>
  una(`UPDATE marcas_dia SET texto = $3, editada = $4 WHERE usuario_id = $1 AND fecha = $2 RETURNING ${COL_MARCA}`,
  [usuarioId, fecha, texto, editada], tx)

/** Solo si no hay (importar no pisa lo que ya está). */
const marcaCrearSiFalta = (usuarioId, m, tx) =>
  una(`INSERT INTO marcas_dia (usuario_id, fecha, texto, creada, editada) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id, fecha) DO NOTHING RETURNING ${COL_MARCA}`,
  [usuarioId, m.fecha, m.texto, m.creada, m.editada ?? null], tx)

const marcaBorrar = (usuarioId, fecha, tx) =>
  consulta('DELETE FROM marcas_dia WHERE usuario_id = $1 AND fecha = $2', [usuarioId, fecha], tx)

module.exports = {
  forjaTodos, forjaPorId, forjaBloquear, forjaContarEnForja, forjaCrear, forjaGuardar,
  codigoTodas, codigoPorId, codigoContar, codigoMaximos, codigoCrear, codigoGuardar, codigoBorrar,
  caidaCrear, caidaPorId, caidaBorrar, caidasEntre, caidasTodas,
  fotosLista, fotoImagen, fotoCrear, fotoBorrar,
  marcasTodas, marcaDe, marcaActualizar, marcaCrearSiFalta, marcaBorrar,
}
