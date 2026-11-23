'use strict'
/**
 * Sueño · las cuentas puras (sin base). Traído de src/sueno/estimar.ts, src/sueno/fuentes/, src/services/adaptacion.ts
 * y la parte de cuentas de src/services/suenio.ts.
 *
 * Estimación de cada noche, sin reloj:
 *   acostado  = «Dejo celu» (o la hora puesta a mano)
 *   dormido   = acostado + latencia (15 min por defecto; rango ±5)
 *   levantado = centro de la ventana habitual de 15 min (05:00–05:15 → 05:07:30)
 * Cada dato tiene su fuente y gana el de más prioridad: reloj > corregido > estimado.
 */
const { instanteDe, sumarDias, diferenciaDias, minutosDe } = require('../../comun/fechas')

const MINUTO = 60000
const VENTANA_LEVANTARSE_MIN = 15
const MARGEN_DORMIDO_MIN = 5
const LATENCIA_MIN = 10
const LATENCIA_MAX = 30
/** Media hora antes de la hora de levantarse ya es «mañana»: abrir la app cierra la noche y no cuenta como apertura. */
const MARGEN_MANIANA_MS = 30 * MINUTO
const PRIORIDAD = { estimado: 0, corregido: 1, reloj: 2 }

const latenciaValida = (min) => Math.max(LATENCIA_MIN, Math.min(LATENCIA_MAX, Math.round(Number(min) || 15)))
const dormidoEstimado = (acostado, latencia) => acostado + latencia * MINUTO

/** «Dormido entre … y …»: latencia − 5 a latencia + 5 (nunca antes de acostarse). */
function rangoDormido(acostado, latencia) {
  return [acostado + Math.max(0, latencia - MARGEN_DORMIDO_MIN) * MINUTO, acostado + (latencia + MARGEN_DORMIDO_MIN) * MINUTO]
}

/** Centro de la ventana de levantarse de la mañana siguiente a `noche`. */
function levantadoEstimado(noche, inicioVentana, zona) {
  return instanteDe(sumarDias(noche, 1), inicioVentana, zona) + (VENTANA_LEVANTARSE_MIN / 2) * MINUTO
}

/** «05:00» → «05:15». */
function finVentana(inicio) {
  const t = (minutosDe(inicio) + VENTANA_LEVANTARSE_MIN) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const minutosDormidos = (dormido, levantado) => Math.max(0, Math.round((levantado - dormido) / MINUTO))

/** El dato de más prioridad entre varios (reloj > corregido > estimado). */
function mejorDato(datos) {
  let mejor
  for (const d of datos) if (d && (!mejor || PRIORIDAD[d.fuente] > PRIORIDAD[mejor.fuente])) mejor = d
  return mejor
}

/** «HH:MM» de una noche a instante: de 12:00 a 23:59 es el día de la noche; de 00:00 a 11:59, la mañana siguiente. */
function instanteDeNoche(noche, hm, zona) {
  const h = Number(hm.split(':')[0])
  return instanteDe(h >= 12 ? noche : sumarDias(noche, 1), hm, zona)
}

/** Fin del modo sueño que empieza en `inicio`: la próxima hora de fin (5:00) después de ese instante. */
function finDelModo(inicio, horaFin, zona, fechaDeInicio) {
  const deHoy = instanteDe(fechaDeInicio, horaFin, zona)
  return deHoy > inicio ? deHoy : instanteDe(sumarDias(fechaDeInicio, 1), horaFin, zona)
}

// ---------- Fuentes ----------

/**
 * Fuente «estimada»: un registro guardado → noche con la fuente de cada dato.
 * Las noches viejas (sin fuente) quedan como «estimado».
 * Un reloj inteligente sería otra fuente que devuelve el mismo formato; `combinarNoches` elige el mejor dato.
 */
function nocheDesdeRegistro(r, a) {
  const acostado = r.acostadoManual ?? r.horaReal
  const fAcostado = r.fuenteAcostado ?? (r.acostadoManual != null ? 'corregido' : 'estimado')
  const dormido = r.dormido ?? dormidoEstimado(acostado, r.latenciaMinutos ?? latenciaValida(a.latenciaDormirseMinutos))
  const levantado = r.levantado ?? levantadoEstimado(r.noche, a.horaFinSuenio, a.zonaHoraria)
  return {
    noche: r.noche,
    acostado: { valor: acostado, fuente: fAcostado },
    dormido: { valor: dormido, fuente: r.fuenteDormido ?? 'estimado' },
    levantado: { valor: levantado, fuente: r.fuenteLevantado ?? 'estimado' },
    etapas: r.etapas ?? undefined,
    despertares: r.despertares ?? undefined,
  }
}

function combinarNoches(listas) {
  const porNoche = new Map()
  for (const l of listas) for (const n of l) porNoche.set(n.noche, [...(porNoche.get(n.noche) || []), n])
  const r = []
  for (const [noche, ns] of porNoche) {
    r.push({
      noche,
      acostado: mejorDato(ns.map((n) => n.acostado)),
      dormido: mejorDato(ns.map((n) => n.dormido)),
      levantado: mejorDato(ns.map((n) => n.levantado)),
      etapas: (ns.find((n) => n.etapas && n.etapas.length) || {}).etapas,
      despertares: (ns.find((n) => n.despertares !== undefined) || {}).despertares,
    })
  }
  return r.sort((a, b) => a.noche.localeCompare(b.noche))
}

// ---------- Resumen de noches ----------

const minutosDesdeNoche = (instante, noche, zona) => Math.round((instante - instanteDe(noche, '00:00', zona)) / MINUTO)
const promedioDe = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null)
function desvio(xs) {
  if (xs.length < 2) return null
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.round(Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length))
}

/**
 * Noches listas para mostrar (minutos desde las 00:00 de la noche; pueden pasar de 1440).
 * `registros`: filas de la base (ya en camelCase). La noche de hoy, si no terminó, no entra.
 */
function nochesParaMostrar(registros, a, hoy, fuentesExtra = []) {
  const regs = new Map(registros.map((r) => [r.noche, r]))
  const latencia = latenciaValida(a.latenciaDormirseMinutos)
  const z = a.zonaHoraria
  const r = []
  for (const n of combinarNoches([registros.map((x) => nocheDesdeRegistro(x, a)), ...fuentesExtra])) {
    const reg = regs.get(n.noche)
    if (n.noche >= hoy && !(reg && reg.levantado) && (!n.levantado || n.levantado.fuente !== 'reloj')) continue
    if (!n.acostado || !n.dormido || !n.levantado) continue
    const fuentes = { acostado: n.acostado.fuente, dormido: n.dormido.fuente, levantado: n.levantado.fuente }
    const lista = Object.values(fuentes)
    r.push({
      noche: n.noche,
      acostado: minutosDesdeNoche(n.acostado.valor, n.noche, z),
      dormido: minutosDesdeNoche(n.dormido.valor, n.noche, z),
      dormidoRango: fuentes.dormido === 'estimado' ? rangoDormido(n.acostado.valor, (reg && reg.latenciaMinutos) || latencia).map((x) => minutosDesdeNoche(x, n.noche, z)) : null,
      levantado: minutosDesdeNoche(n.levantado.valor, n.noche, z),
      minutos: minutosDormidos(n.dormido.valor, n.levantado.valor),
      fuentes,
      estimado: lista.includes('estimado'),
      corregido: lista.includes('corregido'),
      reloj: lista.includes('reloj'),
      cumplido: !!(reg && reg.cumplido),
      sinDejoCelu: !!(reg && reg.sinDejoCelu),
      aperturas: (reg && reg.aperturas) || 0,
      despertares: n.despertares,
      etapas: n.etapas,
    })
  }
  return r
}

/** Noches seguidas con «Dejo celu» a tiempo, hacia atrás desde anoche (o esta noche, si ya se tocó a tiempo). */
function rachaNoches(registros, hoy) {
  const ok = new Set(registros.filter((r) => r.cumplido).map((r) => r.noche))
  let racha = 0
  let f = ok.has(hoy) ? hoy : sumarDias(hoy, -1)
  while (ok.has(f)) { racha++; f = sumarDias(f, -1) }
  return racha
}

/** Promedios, regularidad y mejora semana contra semana. `todas`: noches de al menos 14 días para atrás. */
function resumenNoches(todas, hoy, dias, a, racha) {
  const noches = todas.filter((n) => n.noche >= sumarDias(hoy, -dias))
  const promedio = noches.length
    ? { acostado: promedioDe(noches.map((n) => n.acostado)), dormido: promedioDe(noches.map((n) => n.dormido)), levantado: promedioDe(noches.map((n) => n.levantado)), minutos: promedioDe(noches.map((n) => n.minutos)) }
    : null
  const objetivoMinutos = Math.round(a.objetivoSuenioHoras * 60)
  const ultima = noches[noches.length - 1] || null
  const semana = todas.filter((n) => n.noche >= sumarDias(hoy, -7))
  const anterior = todas.filter((n) => n.noche >= sumarDias(hoy, -14) && n.noche < sumarDias(hoy, -7))
  return {
    noches,
    anoche: ultima && (ultima.noche === sumarDias(hoy, -1) || ultima.noche === hoy) ? ultima : null,
    promedio,
    regularidadMinutos: desvio(noches.map((n) => n.dormido)),
    diferenciaObjetivo: promedio ? promedio.minutos - objetivoMinutos : null,
    latencia: latenciaValida(a.latenciaDormirseMinutos),
    objetivoMinutos,
    mejora: {
      semana: promedioDe(semana.map((n) => n.minutos)),
      semanaAnterior: promedioDe(anterior.map((n) => n.minutos)),
      regularidad: desvio(semana.map((n) => n.dormido)),
      regularidadAnterior: desvio(anterior.map((n) => n.dormido)),
      racha,
    },
  }
}

/** «6 h 40 min». */
function duracionSuenio(minutos) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/** Minutos desde las 00:00 (pueden pasar de 1440) como «HH:MM». */
function horaDeMinutos(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// ---------- Adaptación por etapas ----------

/** Lo sugerido: 1–2 semanas acostumbrando, 3–4 asentando, después estable. La última no termina (semanas 0). */
const ETAPAS_SUGERIDAS = [
  { nombre: 'Acostumbrando', semanas: 2, horasMin: 6, horasMax: 9, despertaresNormales: 2 },
  { nombre: 'Asentando', semanas: 2, horasMin: 6.5, horasMax: 9, despertaresNormales: 1 },
  { nombre: 'Estable', semanas: 0, horasMin: 7, horasMax: 9, despertaresNormales: 0 },
]
const TOLERANCIA_SUGERIDA = 20
const NOCHES_SEGUIDAS_AVISO = 3

function etapasDe(a) {
  const e = a.adaptacion && a.adaptacion.etapas
  return e && e.length >= 1 ? e.map((x) => ({ ...x })) : ETAPAS_SUGERIDAS.map((x) => ({ ...x }))
}

function toleranciaDe(a) {
  const t = a.adaptacion && a.adaptacion.toleranciaMinutos
  return t !== undefined && t !== null && t >= 0 ? Math.round(t) : TOLERANCIA_SUGERIDA
}

/** En qué etapa está una fecha, contando desde `inicio`. Las etapas se suman; la última no termina. */
function etapaDe(fecha, inicio, etapas = ETAPAS_SUGERIDAS) {
  const dia = Math.max(0, diferenciaDias(inicio, fecha)) + 1
  const semana = Math.floor((dia - 1) / 7) + 1
  let acumuladas = 0
  for (let i = 0; i < etapas.length; i++) {
    const e = etapas[i]
    const ultima = i === etapas.length - 1
    if (ultima || e.semanas <= 0 || semana <= acumuladas + e.semanas) return { indice: i, etapa: e, semana, dia, semanaEnEtapa: semana - acumuladas, esUltima: ultima }
    acumuladas += e.semanas
  }
  const i = etapas.length - 1
  return { indice: i, etapa: etapas[i], semana, dia, semanaEnEtapa: semana - acumuladas, esUltima: true }
}

/** Primer día de cada etapa (para la tira). La última no tiene fin. */
function tramosDeEtapas(inicio, etapas) {
  const r = []
  let d = inicio
  etapas.forEach((e, i) => {
    const ultima = i === etapas.length - 1 || e.semanas <= 0
    const hasta = ultima ? null : sumarDias(d, e.semanas * 7 - 1)
    r.push({ etapa: e, desde: d, hasta })
    if (hasta) d = sumarDias(hasta, 1)
  })
  return r
}

function horas(min) { const h = Math.floor(min / 60); const m = min % 60; return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h` }

/**
 * Veredicto de una noche. `acostado` en minutos desde las 00:00 de la noche (puede pasar de 1440).
 * Prioridad: acostarse a horario. Si se acostó a horario pero durmió poco (o se despertó), depende de la etapa.
 */
function veredictoNoche(x) {
  const limite = minutosDe(x.horaDejarCelu)
  const limiteNoche = limite < 12 * 60 ? limite + 1440 : limite
  const aHorario = x.acostado <= limiteNoche + x.tolerancia
  const e = x.etapa.etapa
  const pocas = x.minutos < e.horasMin * 60
  const muchas = x.minutos > e.horasMax * 60
  const despertares = x.despertares ?? 0
  const seDesperto = x.despertares !== undefined && x.despertares !== null && x.despertares > e.despertaresNormales
  const enRango = !pocas && !seDesperto
  const dur = horas(x.minutos)
  if (!aHorario) return { aHorario, enRango, tono: 'tarde', texto: `Te acostaste tarde (${horaDeMinutos(x.acostado)}). Mañana, a horario.` }
  if (enRango) {
    const extra = muchas ? ' (más de lo esperado: está bien si lo necesitabas)' : ''
    return { aHorario, enRango, tono: 'bien', texto: `Dormiste bien: a horario y ${dur}${extra}.` }
  }
  const veces = `${despertares} ${despertares === 1 ? 'vez' : 'veces'}`
  const que = pocas && seDesperto ? `dormiste menos y te despertaste ${veces}` : pocas ? 'dormiste menos' : `te despertaste ${veces}`
  const Que = que.charAt(0).toUpperCase() + que.slice(1)
  if (x.etapa.indice === 0) return { aHorario, enRango, tono: 'normal', texto: `${Que}, pero te acostaste a horario. Semana ${x.etapa.semana}: es normal, tu cuerpo se está acostumbrando.` }
  if (!x.etapa.esUltima) {
    const seguidas = x.nochesCortasSeguidas || 0
    const aviso = seguidas >= NOCHES_SEGUIDAS_AVISO ? ` Van ${seguidas} noches seguidas: revisá pantalla, café o entreno tarde.` : ''
    return { aHorario, enRango, tono: aviso ? 'aviso' : 'normal', texto: `Te acostaste a horario; todavía se está asentando (${que}).${aviso}` }
  }
  return { aHorario, enRango, tono: 'aviso', texto: `A horario, pero ${que}: revisá pantalla, café o entreno tarde.` }
}

/** Veredicto de una noche ya resumida. `anteriores`: noches previas, para contar las cortas seguidas. */
function veredictoDe(n, ad, anteriores = []) {
  const etapa = etapaDe(n.noche, ad.inicio, ad.etapas)
  let seguidas = n.minutos < etapa.etapa.horasMin * 60 ? 1 : 0
  if (seguidas) {
    for (const x of anteriores.filter((y) => y.noche < n.noche).sort((p, q) => (p.noche < q.noche ? 1 : -1))) {
      if (x.minutos < etapa.etapa.horasMin * 60) seguidas++
      else break
    }
  }
  return veredictoNoche({ acostado: n.acostado, horaDejarCelu: ad.horaDejarCelu, tolerancia: ad.tolerancia, minutos: n.minutos, despertares: n.despertares, etapa, nochesCortasSeguidas: seguidas })
}

/** Hasta qué semana se puede leer con «más adelante»: la primera de la última etapa. */
function ultimaSemanaConInfo(etapas) {
  return etapas.slice(0, -1).reduce((s, e) => s + Math.max(0, e.semanas), 0) + 1
}

const enHoras = (h) => String(h).replace('.', ',')

/** Lo que te cuenta el shinobi en Sueño sobre una semana (sale de las etapas editables). */
function discursoDeSemana(semana, etapas = ETAPAS_SUGERIDAS) {
  const s = Math.max(1, Math.round(semana))
  const e = etapaDe(sumarDias('2026-01-05', (s - 1) * 7), '2026-01-05', etapas)
  const { nombre, horasMin, horasMax, despertaresNormales: d } = e.etapa
  const esperado = `Esperá ${enHoras(horasMin)} a ${enHoras(horasMax)} h`
  const desp = d === 0 ? 'ya casi no deberías despertarte' : d === 1 ? 'despertarte una vez es normal' : `despertarte hasta ${d} veces es normal`
  const titulo = `Semana ${s} · ${nombre}`
  if (e.indice === 0) return { etapa: 0, titulo, texto: `Lo importante es acostarte a horario. ${esperado}; ${desp}. Si dormís menos, no pasa nada: el cuerpo se está acostumbrando.` }
  if (!e.esUltima) return { etapa: e.indice, titulo, texto: `El cuerpo se asienta. ${esperado}; ${desp}. Si hay varias noches cortas seguidas, fijate qué las cambia.` }
  return { etapa: e.indice, titulo, texto: `Ya es tu ritmo. ${esperado}; ${desp}. Una noche mala suelta ya no es adaptación: buscá la causa.` }
}

/** Valida y acota lo editado: semanas 0–12, horas 3–14 (mín ≤ máx), despertares 0–5. */
function normalizarEtapas(etapas) {
  return (etapas || []).map((e) => {
    const min = Math.max(3, Math.min(14, Number(e.horasMin) || ETAPAS_SUGERIDAS[0].horasMin))
    const max = Math.max(min, Math.min(14, Number(e.horasMax) || min))
    return { nombre: String(e.nombre || '').trim() || 'Etapa', semanas: Math.max(0, Math.min(12, Math.round(Number(e.semanas) || 0))), horasMin: min, horasMax: max, despertaresNormales: Math.max(0, Math.min(5, Math.round(Number(e.despertaresNormales) || 0))) }
  })
}

// ---------- Aviso para alistarse ----------

const FRASES_DORMIR_DEFECTO = [
  'El shinobi apaga la lámpara. Alistate para dormir.',
  'La noche también entrena. Dejá el celu y descansá.',
  'Mañana se gana esta noche. Alistate para dormir.',
]

function frasesDormir(a) {
  const f = (a.frasesDormir || []).map((x) => String(x).trim()).filter(Boolean)
  return f.length ? f : FRASES_DORMIR_DEFECTO
}

/** La frase de una noche: rota por día (misma frase toda la noche). */
function fraseDormir(a, noche) {
  const f = frasesDormir(a)
  const n = Math.round(Date.parse(noche) / 86400000)
  return f[((n % f.length) + f.length) % f.length]
}

module.exports = {
  MINUTO, LATENCIA_MIN, LATENCIA_MAX, MARGEN_MANIANA_MS, ETAPAS_SUGERIDAS, TOLERANCIA_SUGERIDA, FRASES_DORMIR_DEFECTO,
  latenciaValida, dormidoEstimado, rangoDormido, levantadoEstimado, finVentana, minutosDormidos, mejorDato, instanteDeNoche, finDelModo,
  nocheDesdeRegistro, combinarNoches, nochesParaMostrar, rachaNoches, resumenNoches, duracionSuenio, horaDeMinutos,
  etapasDe, toleranciaDe, etapaDe, tramosDeEtapas, veredictoNoche, veredictoDe, ultimaSemanaConInfo, discursoDeSemana, normalizarEtapas,
  frasesDormir, fraseDormir,
}
