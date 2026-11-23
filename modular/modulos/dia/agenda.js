'use strict'
/**
 * Cuentas puras de la agenda (parte 2): fechas clave, feriados de fábrica y Mi horario (bloques del día,
 * dónde estás ahora, huecos libres). Sin base: todo entra por parámetro.
 * Traído de la app vieja: src/services/horario.ts, fechasClave.ts, feriados.ts y FERIADOS_INICIALES de src/data/semilla.ts.
 */
const { diaSemanaDe, esHoraValida, minutosDe } = require('../../comun/fechas')

/** Feriados que vienen cargados (Argentina; solo los de fecha fija). Se pueden marcar o quitar desde el Calendario. */
const FERIADOS_INICIALES = [
  { fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional (trasladado del 20)' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción de María' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-03-24', nombre: 'Día de la Memoria' },
  { fecha: '2027-04-02', nombre: 'Malvinas' },
  { fecha: '2027-05-01', nombre: 'Día del Trabajador' },
  { fecha: '2027-05-25', nombre: 'Revolución de Mayo' },
  { fecha: '2027-06-20', nombre: 'Día de la Bandera' },
  { fecha: '2027-07-09', nombre: 'Día de la Independencia' },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción de María' },
  { fecha: '2027-12-25', nombre: 'Navidad' },
]

const TIPOS_BLOQUE = ['obligatorio', 'entreno', 'otro']
const ID_HORARIO_INICIAL = 'horario-1'
const ID_BLOQUE_ENTRENO = 'entreno'
const ENTRENO_MINUTOS = 42

/** Plantillas para sumar un bloque de un toque. */
const PLANTILLAS = [
  { id: 'cursada', nombre: 'Cursada', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '13:00' },
  { id: 'trabajo', nombre: 'Trabajo', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '09:00', hasta: '18:00' },
]

const configVacia = () => ({ activo: ID_HORARIO_INICIAL, horarios: [{ id: ID_HORARIO_INICIAL, nombre: 'Mi horario', bloques: [] }], excepciones: {} })

/** Arregla una config guardada (o null): siempre hay al menos un horario y el activo existe. */
function normalizarConfig(c) {
  const x = c && typeof c === 'object' ? { activo: c.activo, horarios: Array.isArray(c.horarios) ? c.horarios : [], excepciones: c.excepciones && typeof c.excepciones === 'object' ? c.excepciones : {} } : configVacia()
  if (!x.horarios.length) x.horarios = configVacia().horarios
  if (!x.horarios.some((h) => h.id === x.activo)) x.activo = x.horarios[0].id
  return x
}

const horarioActivoDe = (c) => c.horarios.find((h) => h.id === c.activo) || c.horarios[0]

/** Errores de un bloque (lista vacía = bien). */
function validarBloque(b) {
  const e = []
  if (!b || !String(b.nombre || '').trim()) e.push('El bloque necesita un nombre.')
  if (!b || !esHoraValida(b.desde) || !esHoraValida(b.hasta)) e.push('Hora inválida.')
  else if (minutosDe(b.hasta) <= minutosDe(b.desde)) e.push('«Hasta» tiene que ser después de «desde».')
  if (!b || !Array.isArray(b.dias) || !b.dias.length || b.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) e.push('Elegí al menos un día.')
  if (b && b.tipo && !TIPOS_BLOQUE.includes(b.tipo)) e.push('Tipo de bloque inválido.')
  return e
}

function minutoAHora(m) {
  const x = Math.max(0, Math.min(24 * 60, Math.round(m)))
  return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
}

// ---------- Fechas clave ----------

const md = (f) => f.slice(5)

/** ¿La fecha clave cae en este día? (las anuales, cualquier año desde el suyo). */
function caeEn(fc, fecha) {
  if (!fc.anual) return fc.fecha === fecha
  return md(fc.fecha) === md(fecha) && fecha >= fc.fecha
}

/** Fechas clave por día entre dos fechas: { 'AAAA-MM-DD': [fc] }. */
function fechasClavePorDia(todas, desde, hasta) {
  const mapa = {}
  const poner = (f, fc) => { (mapa[f] = mapa[f] || []).push(fc) }
  for (const fc of todas) {
    if (!fc.anual) { if (fc.fecha >= desde && fc.fecha <= hasta) poner(fc.fecha, fc); continue }
    for (let a = Number(desde.slice(0, 4)); a <= Number(hasta.slice(0, 4)); a++) {
      const f = `${a}-${md(fc.fecha)}`
      if (f >= desde && f <= hasta && caeEn(fc, f)) poner(f, fc)
    }
  }
  for (const l of Object.values(mapa)) l.sort((x, y) => x.creada - y.creada)
  return mapa
}

function bloqueDeFechaClave(fc) {
  if (!fc.hora || !esHoraValida(fc.hora)) return null
  const desde = fc.hora
  const hasta = fc.horaFin && esHoraValida(fc.horaFin) && minutosDe(fc.horaFin) > minutosDe(desde) ? fc.horaFin : minutoAHora(Math.min(24 * 60 - 1, minutosDe(desde) + 120))
  return { id: `fc:${fc.id}`, nombre: fc.titulo, tipo: 'obligatorio', origen: 'fechaClave', desde, hasta, min: minutosDe(desde), max: minutosDe(hasta) }
}

// ---------- Mi horario ----------

/**
 * Todos los bloques de una fecha, ordenados por hora. Cada uno: { id, nombre, tipo, origen, desde, hasta, min, max, variable?, apagado?, motivoApagado? }.
 * Entra: config (normalizada), fecha, feriado (bool), entreno ({ accion, compromiso } o null), fechasClave (las que caen ese día),
 * ajustes ({ horaDormido, horaFinSuenio }). `conApagados` devuelve también los apagados (para volver a encenderlos).
 */
function bloquesDelDia({ config, fecha, feriado = false, entreno = null, fechasClave = [], ajustes = {} }, { conApagados = false } = {}) {
  const h = horarioActivoDe(config)
  const ds = diaSemanaDe(fecha)
  const apagados = new Set(config.excepciones[fecha] || [])
  const lista = []
  for (const b of (h && h.bloques) || []) {
    if (!b.dias.includes(ds)) continue
    const x = { id: b.id, nombre: b.nombre, tipo: b.tipo, origen: 'bloque', desde: b.desde, hasta: b.hasta, min: minutosDe(b.desde), max: minutosDe(b.hasta) }
    if (apagados.has(b.id)) { x.apagado = true; x.motivoApagado = 'excepcion' } else if (feriado && b.tipo === 'obligatorio') { x.apagado = true; x.motivoApagado = 'feriado' }
    lista.push(x)
  }
  // Entreno: los días de la acción; la hora de ese día si se corrió.
  if (entreno && entreno.accion && entreno.accion.activa) {
    const a = entreno.accion
    const comp = entreno.compromiso
    const programado = comp ? comp.estado !== 'reprogramado' : a.dias.includes(ds)
    if (programado) {
      const desde = (comp && comp.horaPrevista) || (a.horasPorDia && a.horasPorDia[ds]) || a.hora || '19:00'
      const limite = a.horaLimiteInicio && esHoraValida(a.horaLimiteInicio) && minutosDe(a.horaLimiteInicio) > minutosDe(desde) ? a.horaLimiteInicio : null
      const dur = a.duracionMinutos || a.minutosMinimos || ENTRENO_MINUTOS
      const hasta = minutoAHora(minutosDe(limite || desde) + dur)
      const x = { id: ID_BLOQUE_ENTRENO, nombre: a.nombre, tipo: 'entreno', origen: 'entreno', desde, hasta, min: minutosDe(desde), max: minutosDe(hasta), variable: true, limite }
      if (apagados.has(ID_BLOQUE_ENTRENO)) { x.apagado = true; x.motivoApagado = 'excepcion' }
      lista.push(x)
    }
  }
  for (const fc of fechasClave) { const x = bloqueDeFechaClave(fc); if (x) lista.push(x) }
  // Dormir: de los ajustes de sueño (no se edita acá).
  const dormido = ajustes.horaDormido || '21:20'
  const fin = ajustes.horaFinSuenio || '06:00'
  lista.push({ id: 'dormir-noche', nombre: 'Dormir', tipo: 'dormir', origen: 'suenio', desde: dormido, hasta: '24:00', min: minutosDe(dormido), max: 24 * 60 })
  if (minutosDe(fin) > 0) lista.push({ id: 'dormir-madrugada', nombre: 'Dormir', tipo: 'dormir', origen: 'suenio', desde: '00:00', hasta: fin, min: 0, max: minutosDe(fin) })
  const salida = conApagados ? lista : lista.filter((x) => !x.apagado)
  return salida.sort((p, q) => p.min - q.min || p.max - q.max)
}

/** Dónde está la persona en el minuto `m` del día: { ahora, siguiente, libres, libreHasta, enObligatorio }. */
function momento(bloques, m, horaAlistarse = '20:50') {
  const b = bloques.filter((x) => x.tipo !== 'dormir' && !x.apagado)
  const enCurso = b.find((x) => m >= x.min && m < x.max) || null
  const siguiente = b.find((x) => x.min > m) || null
  const fin = siguiente ? siguiente.min : minutosDe(horaAlistarse)
  const libres = enCurso ? Math.max(0, fin - enCurso.max) : Math.max(0, fin - m)
  return { ahora: enCurso, siguiente, libres, libreHasta: minutoAHora(fin), enObligatorio: !!enCurso && enCurso.tipo === 'obligatorio' }
}

/** Huecos libres (≥ 10 min) entre despertar y alistarse, descontando los bloques. */
function huecos(bloques, horaFinSuenio = '06:00', horaAlistarse = '20:50') {
  const b = bloques.filter((x) => x.tipo !== 'dormir' && !x.apagado)
  const inicio = minutosDe(horaFinSuenio)
  const fin = minutosDe(horaAlistarse)
  const r = []
  let cursor = inicio
  for (const x of b) {
    if (x.min > cursor && x.min <= fin) r.push({ desde: minutoAHora(cursor), hasta: minutoAHora(Math.min(x.min, fin)), minutos: Math.min(x.min, fin) - cursor })
    cursor = Math.max(cursor, x.max)
  }
  if (cursor < fin) r.push({ desde: minutoAHora(cursor), hasta: minutoAHora(fin), minutos: fin - cursor })
  return r.filter((x) => x.minutos >= 10)
}

/** «Ahora: Facultad hasta 18:00 · después: Entreno 19:00». */
function textoMomento(m) {
  const partes = []
  const dur = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60}` : ''}` : `${n} min`)
  if (m.ahora) partes.push(`Ahora: ${m.ahora.nombre} hasta ${m.ahora.hasta}`)
  else if (m.siguiente) partes.push(`Libre ${dur(m.libres)}`)
  else partes.push('Sin bloques por hoy')
  if (m.siguiente) partes.push(`después: ${m.siguiente.nombre} ${m.siguiente.desde}`)
  return partes.join(' · ')
}

/** Sábado, domingo o feriado: el día usa el límite de juego de finde. */
const esDeFinde = (fecha, feriado) => { const ds = diaSemanaDe(fecha); return ds === 0 || ds === 6 || !!feriado }

module.exports = {
  FERIADOS_INICIALES, TIPOS_BLOQUE, ID_HORARIO_INICIAL, ID_BLOQUE_ENTRENO, PLANTILLAS,
  configVacia, normalizarConfig, horarioActivoDe, validarBloque, minutoAHora,
  caeEn, fechasClavePorDia, bloquesDelDia, momento, huecos, textoMomento, esDeFinde,
}
