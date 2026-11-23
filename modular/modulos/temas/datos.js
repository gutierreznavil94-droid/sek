'use strict'
/** Consultas SQL del módulo temas. Solo las usa ventanilla.js. Tablas: temas_propios, temas_avisos. */
const { una, todas, consulta } = require('../../comun/base')

// ---------- Temas subidos ----------

/** Lista sin las imágenes (solo nombre y lo liviano). */
const propios = (usuarioId, tx) =>
  todas(`SELECT clave, archivo - 'imagenes' AS archivo, subido,
                (archivo #>> '{imagenes,vistaPrevia}') IS NOT NULL AS tiene_vista,
                (archivo #>> '{imagenes,fondo}') IS NOT NULL AS tiene_fondo,
                (archivo #>> '{imagenes,cuadros,lluvia}') IS NOT NULL AS tiene_cuadro
         FROM temas_propios WHERE usuario_id = $1 ORDER BY archivo->>'nombre'`, [usuarioId], tx)

/** El archivo completo (con imágenes). */
const propio = (usuarioId, clave, tx) =>
  una('SELECT clave, archivo, subido FROM temas_propios WHERE usuario_id = $1 AND clave = $2', [usuarioId, clave], tx)

/** Un solo valor de adentro del archivo (una imagen), por camino: ['imagenes', 'fondo']. */
const parte = (usuarioId, clave, camino, tx) =>
  una('SELECT archivo #>> $3 AS valor FROM temas_propios WHERE usuario_id = $1 AND clave = $2', [usuarioId, clave, camino], tx)

const guardar = (usuarioId, clave, archivo, subido, tx) =>
  una(`INSERT INTO temas_propios (usuario_id, clave, archivo, subido) VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, clave) DO UPDATE SET archivo = EXCLUDED.archivo, subido = EXCLUDED.subido
       RETURNING clave`, [usuarioId, clave, archivo, subido], tx)

const borrar = (usuarioId, clave, tx) =>
  consulta('DELETE FROM temas_propios WHERE usuario_id = $1 AND clave = $2', [usuarioId, clave], tx)

// ---------- Avisos visuales pendientes ----------

const crearAviso = (usuarioId, nombre, datos, creado, tx) =>
  consulta('INSERT INTO temas_avisos (usuario_id, nombre, datos, creado) VALUES ($1, $2, $3, $4)', [usuarioId, nombre, datos, creado], tx)

/** Devuelve los pendientes y los marca vistos (se muestran una sola vez). */
const tomarAvisos = (usuarioId, tx) =>
  todas(`UPDATE temas_avisos SET visto = true WHERE usuario_id = $1 AND NOT visto
         RETURNING id, nombre, datos, creado`, [usuarioId], tx)

module.exports = { propios, propio, parte, guardar, borrar, crearAviso, tomarAvisos }
