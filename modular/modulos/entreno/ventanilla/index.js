'use strict'
/**
 * Entreno · la única puerta del módulo (los demás hacen `require('../entreno/ventanilla')`).
 * Creció mucho, así que es una carpeta (REGLAS §8.1): rutinas.js, entrenos.js y series.js son partes internas.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('../datos')
const rutinas = require('./rutinas')
const entrenos = require('./entrenos')
const series = require('./series')
const { transaccion } = require('../../../comun/base')
const { esFechaValida, fechaDe } = require('../../../comun/fechas')
const { obtenerAjustes } = require('../../../comun/ajustes')
const { ahora } = require('../../../comun/reloj')
const { fechaHoy, aContador, aSesion } = require('./ayuda')

/** La tarjeta de Hoy: qué rutina toca, si hay un entreno en curso o ya hecho, y cómo van las series rápidas. */
async function resumenHoy(usuarioId, fecha = null, tx = null) {
  const f = fecha || (await fechaHoy(usuarioId, tx))
  const toca = await rutinas.rutinaDelDia(usuarioId, f, tx)
  const enCurso = await entrenos.sesionEnCurso(usuarioId, tx)
  const delDia = await entrenos.entrenosDelDia(usuarioId, f, tx)
  const rs = await series.resumenSeries(usuarioId, f, f, tx)
  return {
    fecha: f,
    rutina: toca ? { id: toca.id, nombre: toca.nombre, minutos: toca.minutos } : null,
    enCurso: enCurso ? { id: enCurso.id, rutinaId: enCurso.rutinaId, fecha: enCurso.fecha } : null,
    hecho: delDia.some((s) => s.estado === 'terminada'),
    series: rs.series.map((x) => ({ id: x.contador.id, nombre: x.contador.nombre, hoy: x.hoy, cuota: x.cuotaHoy, extra: x.extraHoy, porToque: x.contador.cantidadPorToque, metaLograda: x.metaLogradaHoy, extraLogrado: x.extraLogradoHoy })),
  }
}

/** Al crear una cuenta: las series rápidas iniciales. Las rutinas se eligen en la pantalla («Elegí cómo empezar»). */
async function sembrar(usuarioId, tx = null) {
  return series.sembrarSeries(usuarioId, tx)
}

/**
 * Trae lo de entreno de «Copiar todo como texto» de la app vieja: { rutinas, sesionesEntreno, contadores, registrosContador }.
 * Lo usa el módulo copia, dentro de su transacción. Lo que ya está (mismo id de rutina o serie rápida) se reemplaza;
 * los entrenos y toques se suman. Devuelve cuántos de cada uno entraron.
 */
async function importar(usuarioId, viejo = {}, tx = null) {
  return transaccion(async (t) => {
    const n = { rutinas: 0, sesionesEntreno: 0, contadores: 0, registrosContador: 0 }
    const { zonaHoraria } = await obtenerAjustes(usuarioId, t)
    for (const r of viejo.rutinas || []) {
      if (!r || typeof r.id !== 'string' || !Array.isArray(r.bloques)) continue
      await datos.ponerRutina(usuarioId, {
        id: r.id, nombre: String(r.nombre || 'Rutina'), dias: Array.isArray(r.dias) ? r.dias : [], bloques: r.bloques, minutos: Number(r.minutos) || 30,
        orden: Number(r.orden) || 0, activa: r.activa !== false, borrada: !!r.borrada, creado: Number(r.creado) || ahora(),
      }, t)
      n.rutinas++
    }
    for (const s of viejo.sesionesEntreno || []) {
      if (!s || typeof s.rutinaId !== 'string' || !Number.isFinite(s.inicio)) continue
      const { id, rutinaId, fecha, estado, inicio, fin, ...resto } = s
      await datos.crearSesion(usuarioId, {
        rutinaId, fecha: esFechaValida(fecha) ? fecha : fechaDe(inicio, zonaHoraria), estado: estado === 'en_curso' ? 'en_curso' : 'terminada', inicio, fin: Number.isFinite(fin) ? fin : null,
        datos: { series: [], hechos: [], saltados: [], orden: [], paso: 0, ...resto, idViejo: id },
      }, t)
      n.sesionesEntreno++
    }
    for (const c of viejo.contadores || []) {
      if (!c || typeof c.id !== 'string' || !c.nombre) continue
      await datos.ponerContador(usuarioId, series.aFila({ ...c, creado: Number(c.creado) || ahora(), orden: Number(c.orden) || 0 }), t)
      n.contadores++
    }
    for (const x of viejo.registrosContador || []) {
      if (!x || typeof x.contadorId !== 'string' || !esFechaValida(x.fecha) || !(x.cantidad > 0)) continue
      await datos.crearRegistro(usuarioId, { contadorId: x.contadorId, fecha: x.fecha, instante: Number(x.instante) || ahora(), cantidad: Math.round(x.cantidad), nota: x.nota || null }, t)
      n.registrosContador++
    }
    return n
  }, tx)
}

/** Todo lo del módulo, para exportar (módulo copia). */
async function exportar(usuarioId, tx = null) {
  return {
    rutinas: await rutinas.listarRutinas(usuarioId, { inactivas: true, borradas: true }, tx),
    sesionesEntreno: (await datos.terminadas(usuarioId, null, tx)).map(aSesion),
    contadores: (await datos.contadores(usuarioId, tx)).map(aContador),
    registrosContador: await datos.todosLosRegistros(usuarioId, tx),
  }
}

module.exports = {
  // Rutinas
  listarRutinas: rutinas.listarRutinas,
  obtenerRutina: rutinas.obtenerRutina,
  guardarRutina: rutinas.guardarRutina,
  crearRutina: rutinas.crearRutina,
  borrarRutina: rutinas.borrarRutina,
  ordenarRutinas: rutinas.ordenarRutinas,
  rutinasConBloque: rutinas.rutinasConBloque,
  mismoNombreEnOtraRutina: rutinas.mismoNombreEnOtraRutina,
  sumarBloqueARutinas: rutinas.sumarBloqueARutinas,
  responderEsElMismo: rutinas.responderEsElMismo,
  diasDeRutinas: rutinas.diasDeRutinas,
  rutinaDelDia: rutinas.rutinaDelDia,
  aplicarEleccion: rutinas.aplicarEleccion,
  planes: rutinas.planes,
  ideasDeAPoco: rutinas.ideasDeAPoco,
  // Entreno en curso
  sesionEnCurso: entrenos.sesionEnCurso,
  obtenerSesion: entrenos.obtenerSesion,
  vistaEntreno: entrenos.vistaEntreno,
  iniciarEntreno: entrenos.iniciarEntreno,
  registrarSerie: entrenos.registrarSerie,
  fijarPeso: entrenos.fijarPeso,
  corregirSerie: entrenos.corregirSerie,
  deshacerSerie: entrenos.deshacerSerie,
  marcarBloque: entrenos.marcarBloque,
  saltarBloque: entrenos.saltarBloque,
  irABloque: entrenos.irABloque,
  moverBloque: entrenos.moverBloque,
  terminarDescanso: entrenos.terminarDescanso,
  alargarDescanso: entrenos.alargarDescanso,
  iniciarReloj: entrenos.iniciarReloj,
  saltarPreparacion: entrenos.saltarPreparacion,
  pararReloj: entrenos.pararReloj,
  terminarCronometro: entrenos.terminarCronometro,
  corregirTiempo: entrenos.corregirTiempo,
  fijarObjetivoCronometro: entrenos.fijarObjetivoCronometro,
  descartarEntreno: entrenos.descartarEntreno,
  calcularResumen: entrenos.calcularResumen,
  terminarEntreno: entrenos.terminarEntreno,
  reabrirEntreno: entrenos.reabrirEntreno,
  reiniciarEntreno: entrenos.reiniciarEntreno,
  ultimaVez: entrenos.ultimaVez,
  claveXpExtra: entrenos.claveXpExtra,
  // Historial
  progresionEjercicio: entrenos.progresionEjercicio,
  historialTiempo: entrenos.historialTiempo,
  historialEntrenos: entrenos.historialEntrenos,
  resumenFuerza: entrenos.resumenFuerza,
  entrenosDelDia: entrenos.entrenosDelDia,
  // Series rápidas
  listarContadores: series.listarContadores,
  guardarContador: series.guardarContador,
  sumarToque: series.sumarToque,
  deshacerUltimoToque: series.deshacerUltimoToque,
  borrarRegistro: series.borrarRegistro,
  totalDelDia: series.totalDelDia,
  propuestasDeSubida: series.propuestasDeSubida,
  responderPropuesta: series.responderPropuesta,
  resumenSeries: series.resumenSeries,
  repsDe: series.repsDe,
  faltantesDelDia: series.faltantesDelDia,
  // Para otros módulos
  resumenHoy, sembrar, importar, exportar,
}
