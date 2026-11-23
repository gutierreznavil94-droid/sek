'use strict'
/**
 * Progreso · la única puerta del módulo. SOLO LEE (REGLAS §8.4): nunca escribe en ninguna tabla.
 * - Lo que está guardado día por día lo lee de las vistas de la base (datos.js → 015-progreso.sql).
 * - Lo que hay que calcular con las reglas de otro módulo (nivel, racha, día del ciclo, pilares, atributos,
 *   récords de entreno, resumen de noches) se lo pide a la ventanilla de ese módulo.
 * Todas las funciones aceptan `tx` opcional al final.
 */
const datos = require('./datos')
const calculo = require('./calculo')
const xp = require('../xp/ventanilla')
const ciclo = require('../ciclo/ventanilla')
const dia = require('../dia/ventanilla')
const sueno = require('../sueno/ventanilla')
const entreno = require('../entreno/ventanilla')
const desafios = require('../desafios/ventanilla')
const { obtenerAjustes } = require('../../comun/ajustes')
const { ahora } = require('../../comun/reloj')
const { fechaDe, sumarDias, lunesDe, fechaDelDiaDelCiclo } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

const RANGOS = ['semana', 'mes', 'ciclo']

async function hoyYAjustes(usuarioId, tx) {
  const a = await obtenerAjustes(usuarioId, tx)
  return { a, hoy: fechaDe(ahora(), a.zonaHoraria) }
}

/** Dónde está hoy en el ciclo, en corto (o null si no hay ciclo). */
function cicloCorto(d) {
  if (!d) return null
  return {
    numero: d.ciclo.numero, inicio: d.ciclo.inicio, duracionDias: d.ciclo.duracionDias, diasPorFase: d.ciclo.diasPorFase,
    dia: d.dia, faseNumero: d.faseNumero, fechaFin: d.fechaFin, terminado: d.terminado, noEmpezado: d.noEmpezado, diaCero: d.diaCero,
  }
}

/** Hasta qué fecha mirar el ciclo: hoy, o el último día si ya terminó. */
const hastaDelCiclo = (d, hoy) => (hoy < d.fechaFin ? hoy : d.fechaFin)

/**
 * La montaña «道 El camino» del ciclo activo: un punto por día con la XP neta, lo ganado, lo perdido,
 * el acumulado, los pilares hechos y las marcas (caída, forja, día marcado). [] si el ciclo no empezó.
 */
async function camino(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  if (!d || d.noEmpezado) return []
  const desde = d.ciclo.inicio
  const hasta = hastaDelCiclo(d, hoy)
  const xpDias = new Map((await datos.xpPorDia(usuarioId, desde, hasta, tx)).map((x) => [x.fecha, x]))
  const pilares = new Map((await dia.pilaresPorDia(usuarioId, desde, hasta, tx)).map((x) => [x.fecha, x.pilares]))
  const fechasCaida = new Set((await datos.caidas(usuarioId, tx)).map((c) => c.fecha))
  const fechasForja = new Set((await datos.forja(usuarioId, tx)).flatMap((h) => h.cumplidos || []))
  const marcas = new Map((await datos.marcas(usuarioId, tx)).map((m) => [m.fecha, m.texto]))
  return calculo.armarCamino({ desde, hasta, xpAntes: await datos.xpAntesDe(usuarioId, desde, tx), xpDias, pilares, fechasCaida, fechasForja, marcas })
}

/** Pilares del ciclo activo: cada pilar con hechos/programados y cuántos días llegaron al umbral de la racha. */
async function pilaresDelCiclo(usuarioId, tx = null) {
  const { a, hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  if (!d || d.noEmpezado) return { lista: [], diasCumplidos: 0, diasContados: 0 }
  const desde = d.ciclo.inicio
  const hasta = hastaDelCiclo(d, hoy)
  const lista = calculo.pilaresEnRango(await dia.pilaresPorDia(usuarioId, desde, hasta, tx))
  const dc = calculo.diasCumplidos(await datos.dias(usuarioId, desde, hasta, tx), a.umbralRacha)
  return { lista, diasCumplidos: dc.cumplidos, diasContados: dc.contados }
}

/** Todo lo de la pantalla principal de Progreso. */
async function resumen(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  const lunes = lunesDe(hoy)
  const hace6 = sumarDias(hoy, -6)
  const xp7 = await datos.xpPorDia(usuarioId, hace6, hoy, tx)
  const xpSemana = (await datos.xpPorDia(usuarioId, lunes, hoy, tx)).reduce((s, x) => s + x.neto, 0)
  const noches7 = (await sueno.resumenNoches(usuarioId, 7, tx)).noches.filter((n) => n.noche >= hace6)
  const agua7 = await datos.aguaPorDia(usuarioId, hace6, hoy, tx)
  const pesos = await datos.pesos(usuarioId, sumarDias(hoy, -90), hoy, tx)
  const entrenosSemana = await datos.entrenos(usuarioId, lunes, hoy, tx)
  const series7 = await datos.seriesPorDia(usuarioId, hace6, hoy, tx)
  const caidas = await datos.caidas(usuarioId, tx)
  const forja = await datos.forja(usuarioId, tx)
  return {
    hoy,
    nivel: await xp.estado(usuarioId, tx),
    racha: await dia.racha(usuarioId, hoy, tx),
    ciclo: cicloCorto(d),
    camino: await camino(usuarioId, tx),
    pilares: await pilaresDelCiclo(usuarioId, tx),
    caidasSuperadas: caidas.length,
    forjados: forja.filter((h) => h.estado === 'forjado').map((h) => h.kanji),
    marcas: await datos.marcas(usuarioId, tx),
    // Fases que ya empezaron (para «Cierre de fase con números»).
    fases: d && !d.noEmpezado
      ? (await ciclo.fases(usuarioId, d.ciclo.id, tx)).filter((f) => f.diaInicio <= d.dia).map((f) => ({ numero: f.numero, foco: f.foco, cerrada: !!f.cerradaEn }))
      : [],
    // Dato clave y miniatura de cada sección (solo para mirar).
    secciones: {
      xp: { semana: xpSemana, hoy: (xp7.find((x) => x.fecha === hoy) || {}).neto || 0, mini: calculo.serieDiaria(hace6, hoy, xp7, 'neto').map((x) => x.valor) },
      sueno: { promedio: calculo.promedio(noches7.map((n) => n.minutos)), aHora: noches7.filter((n) => n.cumplido).length, noches: noches7.length, mini: calculo.serieDiaria(hace6, hoy, noches7, 'minutos', null).map((x) => x.valor) },
      fuerza: { semana: entrenosSemana.length, minutos: entrenosSemana.reduce((s, e) => s + e.minutos, 0) },
      comida: { aguaHoy: (agua7.find((x) => x.fecha === hoy) || {}).ml || 0, peso: pesos.length ? pesos[pesos.length - 1].kg : null, mini: pesos.slice(-8).map((p) => p.kg) },
      series: { hoy: series7.filter((x) => x.fecha === hoy).reduce((s, x) => s + x.reps, 0), semana: series7.reduce((s, x) => s + x.reps, 0) },
    },
  }
}

/** Gráfico de XP: semana, mes o ciclo. Un punto por día con neto, ganado, perdido y acumulado. */
async function xpEnRango(usuarioId, rango = 'semana', tx = null) {
  if (!RANGOS.includes(rango)) throw datoInvalido('El rango tiene que ser semana, mes o ciclo.')
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  const desde = calculo.desdeDelRango(rango, hoy, d && !d.noEmpezado ? d.ciclo.inicio : null)
  const hasta = rango === 'ciclo' && d && !d.noEmpezado ? hastaDelCiclo(d, hoy) : hoy
  const filas = await datos.xpPorDia(usuarioId, desde, hasta, tx)
  const m = new Map(filas.map((x) => [x.fecha, x]))
  let acumulado = await datos.xpAntesDe(usuarioId, desde, tx)
  const dias = calculo.fechasEntre(desde, hasta).map((fecha) => {
    const x = m.get(fecha) || { ganado: 0, perdido: 0, neto: 0 }
    acumulado += x.neto
    return { fecha, neto: x.neto, ganado: x.ganado, perdido: x.perdido, acumulado: Math.max(0, acumulado) }
  })
  return { rango, desde, hasta, dias, ganado: dias.reduce((s, x) => s + x.ganado, 0), perdido: dias.reduce((s, x) => s + x.perdido, 0), neto: dias.reduce((s, x) => s + x.neto, 0) }
}

/** Pilares del ciclo y atributos de hoy (con tendencia contra hace 7 días). */
async function pilares(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  return { ...await pilaresDelCiclo(usuarioId, tx), atributos: await dia.atributosHoy(usuarioId, hoy, tx) }
}

/**
 * Sueño: las últimas 30 noches (con lo estimado por sueno, no solo lo guardado) y su resumen
 * (promedios, regularidad, diferencia con el objetivo, semana contra semana, racha).
 */
async function suenoProgreso(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const desde = sumarDias(hoy, -29)
  const r = await sueno.resumenNoches(usuarioId, 30, tx)
  const porNoche = new Map(r.noches.map((n) => [n.noche, n]))
  return {
    desde, hasta: hoy, resumen: r,
    noches: calculo.fechasEntre(desde, hoy).map((noche) => {
      const n = porNoche.get(noche)
      return { noche, minutos: n ? n.minutos : null, cumplido: n ? n.cumplido : null, estimado: n ? n.estimado : null }
    }),
  }
}

/** Fuerza: récords, volumen por semana y ejercicios (de entreno) y los entrenos de los últimos 30 días (de la vista). */
async function fuerza(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  const desde = d && !d.noEmpezado ? d.ciclo.inicio : sumarDias(hoy, -29)
  return {
    ...await entreno.resumenFuerza(usuarioId, hoy, desde < hoy ? desde : hoy, 6, tx),
    ultimos: await datos.entrenos(usuarioId, sumarDias(hoy, -29), hoy, tx),
  }
}

/** Progresión de un ejercicio (reps y peso de cada entreno). */
async function ejercicio(usuarioId, bloqueId, tx = null) {
  if (!bloqueId) throw datoInvalido('Falta el ejercicio.')
  return entreno.progresionEjercicio(usuarioId, String(bloqueId), tx)
}

/** Comida: calorías, proteína, agua y fruta de los últimos 30 días; peso de los últimos 90. */
async function comida(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const desde = sumarDias(hoy, -29)
  const kcal = await datos.comidaPorDia(usuarioId, desde, hoy, tx)
  return {
    desde, hasta: hoy,
    kcal: calculo.serieDiaria(desde, hoy, kcal, 'kcal', null),
    proteina: calculo.serieDiaria(desde, hoy, kcal, 'proteina', null),
    agua: calculo.serieDiaria(desde, hoy, await datos.aguaPorDia(usuarioId, desde, hoy, tx), 'ml'),
    fruta: calculo.serieDiaria(desde, hoy, await datos.frutaPorDia(usuarioId, desde, hoy, tx), 'frutas'),
    pesos: await datos.pesos(usuarioId, sumarDias(hoy, -89), hoy, tx),
  }
}

/** Series rápidas: repeticiones por día de cada contador en los últimos 30 días, con su récord. */
async function series(usuarioId, tx = null) {
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const desde = sumarDias(hoy, -29)
  const filas = await datos.seriesPorDia(usuarioId, desde, hoy, tx)
  const porContador = new Map()
  for (const f of filas) {
    const c = porContador.get(f.contadorId) || { id: f.contadorId, nombre: f.nombre, filas: [] }
    c.filas.push(f)
    porContador.set(f.contadorId, c)
  }
  return {
    desde, hasta: hoy,
    contadores: [...porContador.values()].map((c) => ({
      id: c.id, nombre: c.nombre,
      dias: calculo.serieDiaria(desde, hoy, c.filas, 'reps'),
      hoy: (c.filas.find((x) => x.fecha === hoy) || {}).reps || 0,
      semana: c.filas.filter((x) => x.fecha >= lunesDe(hoy)).reduce((s, x) => s + x.reps, 0),
      record: Math.max(0, ...c.filas.map((x) => x.reps)),
    })),
  }
}

/** Los números de un período (para el cierre de fase). */
async function numeros(usuarioId, desde, hasta, tx) {
  return calculo.numerosDelPeriodo({
    diasCerrados: await datos.dias(usuarioId, desde, hasta, tx),
    entrenos: await datos.entrenosPrevistos(usuarioId, desde, hasta, tx),
    noches: await datos.noches(usuarioId, desde, hasta, tx),
    xpGanado: await datos.xpGanado(usuarioId, desde, hasta, tx),
    // «Inicios con 3-2-1»: los que se empezaron de verdad (desafios).
    inicios: (await desafios.iniciosEntre(usuarioId, desde, hasta, tx)).filter((i) => i.iniciado).length,
  })
}

/**
 * Cierre de una fase con números: «Base (primeros 7 días) / fase anterior / esta fase» (o el ciclo entero si es la última),
 * los atributos al inicio y al final de la fase y sus objetivos. Solo muestra: cerrar la fase lo hace el módulo ciclo.
 */
async function cierreFase(usuarioId, numero, tx = null) {
  const n = Number(numero)
  if (!Number.isInteger(n) || n < 1) throw datoInvalido('La fase no es válida.')
  const { hoy } = await hoyYAjustes(usuarioId, tx)
  const d = await ciclo.diaDelCiclo(usuarioId, hoy, tx)
  if (!d) throw noEncontrado('Un ciclo activo')
  const fases = await ciclo.fases(usuarioId, d.ciclo.id, tx)
  const fase = fases.find((f) => f.numero === n)
  if (!fase) throw noEncontrado('Esa fase')
  const ini = d.ciclo.inicio
  const desde = fechaDelDiaDelCiclo(ini, fase.diaInicio)
  const fin = fechaDelDiaDelCiclo(ini, fase.diaFin)
  const empezo = !d.noEmpezado && d.dia >= fase.diaInicio
  const hasta = fin < hoy ? fin : hoy
  const esUltima = n === fases.length
  const vacio = calculo.numerosDelPeriodo({ diasCerrados: [], entrenos: { hechos: 0, previstos: 0 }, noches: [], xpGanado: 0 })
  const finBase = sumarDias(ini, 6) < hoy ? sumarDias(ini, 6) : hoy
  const base = empezo ? await numeros(usuarioId, ini, finBase, tx) : vacio
  const anterior = n > 1 ? await numeros(usuarioId, fechaDelDiaDelCiclo(ini, fases[n - 2].diaInicio), fechaDelDiaDelCiclo(ini, fases[n - 2].diaFin), tx) : null
  const esta = empezo ? await numeros(usuarioId, esUltima ? ini : desde, hasta, tx) : vacio
  const atrInicio = empezo ? await datos.atributosDelDia(usuarioId, sumarDias(desde, 6) < hasta ? sumarDias(desde, 6) : hasta, tx) : []
  const atrFin = empezo ? await datos.atributosDelDia(usuarioId, hasta, tx) : []
  const nombres = new Map()
  for (const x of [...atrInicio, ...atrFin]) nombres.set(x.atributoId, x.nombre)
  return {
    ciclo: cicloCorto(d),
    fase: { ...fase, desde, hasta: fin },
    empezo,
    enCurso: empezo && d.dia <= fase.diaFin,
    esUltima,
    numeros: { base, anterior, esta },
    atributos: [...nombres.entries()].map(([id, nombre]) => ({
      id, nombre,
      inicio: (atrInicio.find((x) => x.atributoId === id) || {}).valor ?? null,
      fin: (atrFin.find((x) => x.atributoId === id) || {}).valor ?? null,
    })),
    objetivos: (await ciclo.objetivos(usuarioId, d.ciclo.id, tx)).filter((o) => o.faseNumero === n && !o.archivado),
    fases: fases.map((f) => ({ numero: f.numero, foco: f.foco, cerrada: !!f.cerradaEn })),
  }
}

module.exports = { resumen, camino, xpEnRango, pilares, suenoProgreso, fuerza, ejercicio, comida, series, cierreFase, RANGOS }
