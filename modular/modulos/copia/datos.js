'use strict'
/** Consultas SQL del módulo copia. Solo las usa ventanilla.js. Tabla: copia_registros. */
const { una, todas } = require('../../comun/base')

const COLUMNAS = 'id, tipo, origen, exportado, resultado, creado'

/** Anota que se importó una copia. Si esa copia ya se había importado, no hace nada y devuelve null. */
const anotarImportacion = (u, { origen, exportado, creado }, tx) =>
  una(`INSERT INTO copia_registros (usuario_id, tipo, origen, exportado, creado) VALUES ($1, 'importar', $2, $3, $4)
       ON CONFLICT (usuario_id, origen, exportado) WHERE tipo = 'importar' DO NOTHING RETURNING ${COLUMNAS}`,
  [u, origen, exportado, creado], tx)

const ponerResultado = (u, id, resultado, tx) =>
  una(`UPDATE copia_registros SET resultado = $3 WHERE usuario_id = $1 AND id = $2 RETURNING ${COLUMNAS}`, [u, id, JSON.stringify(resultado)], tx)

const anotarExportacion = (u, { exportado, resultado, creado }, tx) =>
  una(`INSERT INTO copia_registros (usuario_id, tipo, origen, exportado, resultado, creado) VALUES ($1, 'exportar', 'nueva', $2, $3, $4) RETURNING ${COLUMNAS}`,
    [u, exportado, JSON.stringify(resultado), creado], tx)

const importacion = (u, origen, exportado, tx) =>
  una(`SELECT ${COLUMNAS} FROM copia_registros WHERE usuario_id = $1 AND tipo = 'importar' AND origen = $2 AND exportado = $3`, [u, origen, exportado], tx)

/** Las últimas, nuevas primero. */
const ultimos = (u, tipo, cantidad, tx) =>
  todas(`SELECT ${COLUMNAS} FROM copia_registros WHERE usuario_id = $1 AND tipo = $2 ORDER BY creado DESC, id DESC LIMIT $3`, [u, tipo, cantidad], tx)

module.exports = { anotarImportacion, ponerResultado, anotarExportacion, importacion, ultimos }
