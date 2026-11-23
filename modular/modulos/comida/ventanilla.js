'use strict'
/**
 * Comida · la única puerta del módulo.
 * Comidas con alimentos (tabla común + propios + código de barras), comidas guardadas, objetivo de calorías
 * y proteína, peso, agua con envases y fruta del día. Las cuentas puras están en calculo.js.
 * Todas las funciones aceptan `tx` opcional al final (transacción compartida).
 */
const datos = require('./datos')
const calculo = require('./calculo')
const { obtenerAjustes } = require('../../comun/ajustes')
const { anotar } = require('../../comun/historial')
const { avisar } = require('../../comun/eventos')
const { transaccion } = require('../../comun/base')
const { ahora } = require('../../comun/reloj')
const { fechaDe, formatoHora, sumarDias, lunesDe, esFechaValida } = require('../../comun/fechas')
const { datoInvalido, noEncontrado } = require('../../comun/errores')

// ---------- Ayudas ----------

async function zonaDe(usuarioId, tx) {
  return (await obtenerAjustes(usuarioId, tx)).zonaHoraria
}

/** Fecha de hoy (AAAA-MM-DD) en la zona de la persona. */
async function hoy(usuarioId, tx = null) {
  return fechaDe(ahora(), await zonaDe(usuarioId, tx))
}

function fechaValida(fecha) {
  if (!esFechaValida(fecha)) throw datoInvalido('La fecha no es válida.')
  return fecha
}

async function fechaO(usuarioId, fecha, tx) {
  return fecha ? fechaValida(fecha) : hoy(usuarioId, tx)
}

const num = (x) => Number(x)

/** Alimento propio de la base → misma forma que los de la tabla: { id: 'p12', n, kcal, p, c, g, por, gr, fuente, codigo?, up? }. */
function comoAlimento(f) {
  return {
    id: `p${f.id}`, n: f.nombre, kcal: num(f.kcal), p: num(f.p), c: num(f.c), g: num(f.g), por: f.porcion, gr: f.gramos,
    fuente: f.fuente, ...(f.codigo ? { codigo: f.codigo } : {}), ...(f.up ? { up: 1 } : {}),
  }
}

function comoRegistro(f) {
  return { id: f.id, fecha: f.fecha, franja: f.franja, alimento: f.alimento, nombre: f.nombre, gramos: f.gramos, kcal: num(f.kcal), p: num(f.p), c: num(f.c), g: num(f.g), ...(f.up ? { up: 1 } : {}), instante: f.instante }
}

// ---------- Alimentos ----------

async function todosLosAlimentos(usuarioId, tx = null) {
  const propios = (await datos.propios(usuarioId, tx)).map(comoAlimento)
  return [...propios, ...calculo.TABLA_ALIMENTOS]
}

/** 't001' (tabla) o 'p12' (propio de esta persona). null si no existe. */
async function alimento(usuarioId, id, tx = null) {
  const s = String(id || '')
  if (s.startsWith('t')) return calculo.deTabla(s)
  if (/^p\d+$/.test(s)) {
    const f = await datos.propio(usuarioId, Number(s.slice(1)), tx)
    return f ? comoAlimento(f) : null
  }
  return null
}

/** Buscador: sin tildes, todas las palabras; los propios primero en el empate. */
async function buscar(usuarioId, texto, max = 30, tx = null) {
  return calculo.buscarEn(await todosLosAlimentos(usuarioId, tx), texto, max)
}

/**
 * Alimento propio a partir de una porción (calorías y proteína de la porción; carbos y grasas opcionales).
 * Se guarda por 100 g.
 */
async function crearPropio(usuarioId, d, tx = null) {
  const nombre = String(d.nombre || '').trim()
  if (nombre.length < 2) throw datoInvalido('Poné un nombre.')
  const gramos = Math.round(Number(d.gramos) || 100)
  if (!(gramos > 0)) throw datoInvalido('La porción tiene que tener gramos.')
  if (!(Number(d.kcal) >= 0)) throw datoInvalido('Poné las calorías.')
  const f = 100 / gramos
  const r = (x) => Math.round((Number(x) || 0) * f * 10) / 10
  const fila = await datos.crearPropio(usuarioId, {
    nombre, porcion: String(d.porcion || '').trim() || '1 porción', gramos,
    kcal: Math.round(Number(d.kcal) * f), p: r(d.proteina), c: r(d.carbos), g: r(d.grasas),
    fuente: d.fuente === 'off' ? 'off' : 'propio', codigo: d.codigo ? String(d.codigo).replace(/\D/g, '') || null : null,
    up: !!d.up, creado: ahora(),
  }, tx)
  await anotar(usuarioId, 'comida', 'alimento_propio', { id: fila.id, nombre }, tx)
  return comoAlimento(fila)
}

const URL_OFF = 'https://world.openfoodfacts.org/api/v2/product/'
const CAMPOS_OFF = 'product_name,product_name_es,brands,serving_size,serving_quantity,nova_group,nutriments'

/**
 * Código de barras: primero lo ya guardado por esta persona, después Open Food Facts (lo consulta el servidor).
 * `pedir` se puede cambiar en las pruebas. Devuelve { alimento } o { alimento: null, motivo: 'sin_internet' | 'no_esta' }.
 */
async function buscarCodigo(usuarioId, codigo, pedir = fetch, tx = null) {
  const limpio = String(codigo || '').replace(/\D/g, '')
  if (limpio.length < 8) throw datoInvalido('El código tiene que tener al menos 8 números.')
  const guardado = await datos.propioPorCodigo(usuarioId, limpio, tx)
  if (guardado) return { alimento: comoAlimento(guardado) }
  let r
  try {
    const res = await pedir(`${URL_OFF}${limpio}.json?fields=${CAMPOS_OFF}`, { signal: AbortSignal.timeout(8000) })
    r = await res.json()
  } catch {
    return { alimento: null, motivo: 'sin_internet' }
  }
  const off = calculo.alimentoDeOff(limpio, r)
  if (!off) return { alimento: null, motivo: 'no_esta' }
  const fila = await datos.crearPropio(usuarioId, {
    nombre: off.n, porcion: off.por, gramos: off.gr, kcal: off.kcal, p: off.p, c: off.c, g: off.g, fuente: 'off', codigo: limpio, up: off.up, creado: ahora(),
  }, tx)
  return { alimento: comoAlimento(fila) }
}

// ---------- Registro del día ----------

async function franjaAhora(usuarioId, tx = null) {
  return calculo.franjaPorHora(formatoHora(ahora(), await zonaDe(usuarioId, tx)))
}

/**
 * «Comí»: registra una cantidad (gramos) de un alimento. Sin fecha = hoy; sin franja = según la hora.
 * Avisa 'comida.registrada'.
 */
async function registrar(usuarioId, { fecha, franja, alimento: alimentoId, gramos }, tx = null) {
  return transaccion(async (t) => {
    const g = Math.round(Number(gramos))
    if (!(g > 0)) throw datoInvalido('La cantidad tiene que ser mayor que cero.')
    if (franja && !calculo.ES_FRANJA.has(franja)) throw datoInvalido('Esa franja no existe.')
    const a = await alimento(usuarioId, alimentoId, t)
    if (!a) throw noEncontrado('Ese alimento')
    const f = await fechaO(usuarioId, fecha, t)
    const fila = await datos.crearComida(usuarioId, {
      fecha: f, franja: franja || (await franjaAhora(usuarioId, t)), alimento: a.id, nombre: a.n, gramos: g, ...calculo.macrosDe(a, g), up: !!a.up, instante: ahora(),
    }, t)
    const registro = comoRegistro(fila)
    await avisar('comida.registrada', { usuarioId, fecha: f, registro }, t)
    return registro
  }, tx)
}

/** Cambia los gramos de algo ya cargado: recalcula con el alimento (o, si ya no está, con lo guardado). */
async function cambiarCantidad(usuarioId, id, gramos, tx = null) {
  const r = await datos.comida(usuarioId, id, tx)
  if (!r) throw noEncontrado('Eso')
  const g = Math.round(Number(gramos))
  if (!(g > 0)) throw datoInvalido('La cantidad tiene que ser mayor que cero.')
  const a = await alimento(usuarioId, r.alimento, tx)
  const base = a || { kcal: (r.kcal * 100) / r.gramos, p: (r.p * 100) / r.gramos, c: (r.c * 100) / r.gramos, g: (r.g * 100) / r.gramos }
  return comoRegistro(await datos.cambiarComida(usuarioId, id, { gramos: g, ...calculo.macrosDe(base, g) }, tx))
}

async function borrar(usuarioId, id, tx = null) {
  const r = await datos.comida(usuarioId, id, tx)
  if (!r) throw noEncontrado('Eso')
  await datos.borrarComida(usuarioId, id, tx)
  await anotar(usuarioId, 'comida', 'borrar', { antes: comoRegistro(r) }, tx)
}

/** Lo comido en una fecha: { lista, totales, porFranja: { desayuno: [...], ... } }. */
async function delDia(usuarioId, fecha, tx = null) {
  const lista = (await datos.comidasEntre(usuarioId, fechaValida(fecha), fecha, tx)).map(comoRegistro)
  const porFranja = {}
  for (const f of calculo.FRANJAS) porFranja[f.id] = []
  for (const r of lista) porFranja[r.franja].push(r)
  return { lista, totales: calculo.sumar(lista), porFranja }
}

/** Frecuentes de los últimos 30 días: un toque y se carga con la cantidad de la última vez. */
async function frecuentes(usuarioId, fecha, max = 8, tx = null) {
  const lista = (await datos.comidasEntre(usuarioId, sumarDias(fecha, -30), fecha, tx)).map(comoRegistro)
  const m = new Map()
  for (const r of lista) {
    const x = m.get(r.alimento)
    if (!x) m.set(r.alimento, { alimento: r.alimento, nombre: r.nombre, gramos: r.gramos, veces: 1, ultimo: r.instante, kcal: r.kcal })
    else {
      x.veces++
      if (r.instante >= x.ultimo) Object.assign(x, { gramos: r.gramos, ultimo: r.instante, kcal: r.kcal, nombre: r.nombre })
    }
  }
  return [...m.values()].sort((a, b) => b.veces - a.veces || b.ultimo - a.ultimo).slice(0, max).map(({ ultimo, ...r }) => r)
}

/** Copia una franja entera de ayer a `fecha`. Devuelve cuántas cosas copió. */
async function repetirAyer(usuarioId, fecha, franja, tx = null) {
  if (!calculo.ES_FRANJA.has(franja)) throw datoInvalido('Esa franja no existe.')
  return transaccion(async (t) => {
    const ayer = (await datos.comidasEntre(usuarioId, sumarDias(fecha, -1), sumarDias(fecha, -1), t)).filter((r) => r.franja === franja)
    const inst = ahora()
    for (const [i, r] of ayer.entries()) {
      await datos.crearComida(usuarioId, { ...comoRegistro(r), fecha, instante: inst + i }, t)
    }
    if (ayer.length) await avisar('comida.registrada', { usuarioId, fecha, registro: null }, t)
    return ayer.length
  }, tx)
}

// ---------- Comidas guardadas ----------

/** Guarda lo cargado en una franja de un día como «comida guardada» (ej.: «Desayuno de siempre»). */
async function guardarFranja(usuarioId, { nombre, fecha, franja }, tx = null) {
  const n = String(nombre || '').trim()
  if (!n) throw datoInvalido('Poné un nombre.')
  const items = (await delDia(usuarioId, fecha, tx)).porFranja[franja] || []
  if (!items.length) throw datoInvalido('No hay nada para guardar.')
  const g = await datos.crearGuardada(usuarioId, { nombre: n, items: items.map((i) => ({ alimento: i.alimento, nombre: i.nombre, gramos: i.gramos })), creado: ahora() }, tx)
  return g
}

async function guardadas(usuarioId, tx = null) {
  return datos.guardadas(usuarioId, tx)
}

/** Carga una comida guardada en una fecha y franja. Devuelve cuántas cosas cargó (salta alimentos que ya no existen). */
async function cargarGuardada(usuarioId, id, { fecha, franja }, tx = null) {
  return transaccion(async (t) => {
    const g = await datos.guardada(usuarioId, id, t)
    if (!g) throw noEncontrado('Esa comida guardada')
    let n = 0
    for (const i of g.items) {
      if (await alimento(usuarioId, i.alimento, t)) { await registrar(usuarioId, { fecha, franja, alimento: i.alimento, gramos: i.gramos }, t); n++ }
    }
    return n
  }, tx)
}

async function borrarGuardada(usuarioId, id, tx = null) {
  const g = await datos.guardada(usuarioId, id, tx)
  if (!g) throw noEncontrado('Esa comida guardada')
  await datos.borrarGuardada(usuarioId, id, tx)
  await anotar(usuarioId, 'comida', 'borrar_guardada', { antes: g }, tx)
}

// ---------- Objetivo y peso ----------

async function configCruda(usuarioId, tx) {
  return (await datos.config(usuarioId, tx)) || { objetivo: null, agua: null, fruta: null }
}

/** El objetivo de calorías y proteína, o null si todavía no se cargó. */
async function objetivo(usuarioId, tx = null) {
  return (await configCruda(usuarioId, tx)).objetivo || null
}

function validarDatosObjetivo(o) {
  if (!(o.peso > 25 && o.peso < 350) || !(o.altura > 100 && o.altura < 250) || !(o.edad > 10 && o.edad < 110)) throw datoInvalido('Revisá peso, altura y edad.')
  if (!['hombre', 'mujer'].includes(o.sexo)) throw datoInvalido('Elegí hombre o mujer (cambia la cuenta de calorías).')
  if (!(o.actividad in calculo.FACTOR_ACTIVIDAD)) throw datoInvalido('Elegí la actividad.')
  if (!calculo.METAS.includes(o.meta)) throw datoInvalido('Elegí la meta.')
}

/**
 * Guarda el objetivo. Sin `manual`, calorías y proteína salen de la cuenta (Mifflin-St Jeor).
 * Si el peso cambió, queda como peso de `fecha` (para la curva).
 */
async function guardarObjetivo(usuarioId, o, fecha = null, tx = null) {
  return transaccion(async (t) => {
    const d = { peso: Number(o.peso), altura: Number(o.altura), edad: Number(o.edad), sexo: o.sexo, actividad: o.actividad, meta: o.meta }
    validarDatosObjetivo(d)
    const calc = calculo.calcularObjetivo(d)
    const manual = !!o.manual
    const nuevo = { ...d, kcal: manual ? Math.round(Number(o.kcal)) : calc.kcal, proteina: manual ? Math.round(Number(o.proteina)) : calc.proteina, ...(manual ? { manual: true } : {}) }
    if (!(nuevo.kcal > 500 && nuevo.kcal < 10000) || !(nuevo.proteina > 0 && nuevo.proteina < 500)) throw datoInvalido('Revisá calorías y proteína.')
    const antes = await objetivo(usuarioId, t)
    await datos.guardarConfig(usuarioId, 'objetivo', nuevo, t)
    await anotar(usuarioId, 'comida', 'objetivo', { antes, despues: nuevo }, t)
    if (!antes || antes.peso !== nuevo.peso) await datos.guardarPeso(usuarioId, { fecha: await fechaO(usuarioId, fecha, t), kg: Math.round(nuevo.peso * 10) / 10, instante: ahora() }, t)
    return nuevo
  }, tx)
}

/** Peso del día (uno por día: el último manda). Si hay objetivo, lo actualiza (y recalcula si no es manual). */
async function registrarPeso(usuarioId, fecha, kg, tx = null) {
  return transaccion(async (t) => {
    const k = Math.round(Number(kg) * 10) / 10
    if (!(k > 25 && k < 350)) throw datoInvalido('Peso fuera de rango.')
    const r = await datos.guardarPeso(usuarioId, { fecha: await fechaO(usuarioId, fecha, t), kg: k, instante: ahora() }, t)
    const o = await objetivo(usuarioId, t)
    if (o && o.peso !== k) {
      const nuevo = { ...o, peso: k }
      const calc = calculo.calcularObjetivo(nuevo)
      await datos.guardarConfig(usuarioId, 'objetivo', o.manual ? nuevo : { ...nuevo, kcal: calc.kcal, proteina: calc.proteina }, t)
    }
    return { fecha: r.fecha, kg: num(r.kg) }
  }, tx)
}

async function pesos(usuarioId, tx = null) {
  return (await datos.pesos(usuarioId, tx)).map((p) => ({ fecha: p.fecha, kg: num(p.kg) }))
}

/**
 * Pilar «Comer según el plan»: ¿se cumplió ese día? (entre −10 % y +10 % de las calorías y llegar a la proteína).
 * null si no hay objetivo o no se cargó nada (un día sin cargar no cuenta). Lo usa **dia**.
 */
async function planDelDia(usuarioId, fecha, tx = null) {
  const o = await objetivo(usuarioId, tx)
  if (!o) return null
  const { lista, totales } = await delDia(usuarioId, fecha, tx)
  if (!lista.length) return null
  return { cumplido: calculo.planCumplido(totales, o), kcal: totales.kcal, proteina: totales.p }
}

// ---------- Agua ----------

/** { config: { envases, principal, objetivoMl?, enHoy }, principal, objetivo, calculado, pesoUsado } */
async function configAgua(usuarioId, tx = null) {
  const c = await configCruda(usuarioId, tx)
  const guardada = c.agua || {}
  const envases = Array.isArray(guardada.envases) && guardada.envases.length ? guardada.envases : calculo.ENVASES_DEFECTO
  const config = { enHoy: 'chica', ...guardada, envases, principal: guardada.principal || envases[0].id }
  const principal = envases.find((e) => e.id === config.principal) || envases[0]
  const peso = c.objetivo ? c.objetivo.peso : undefined
  return { config, principal, objetivo: calculo.objetivoAgua(peso, config.objetivoMl), calculado: calculo.objetivoAgua(peso), pesoUsado: peso ?? null }
}

/** Cambia envases, el principal, el objetivo a mano (null = calcularlo del peso) o cómo se ve en Hoy. */
async function guardarConfigAgua(usuarioId, cambios, tx = null) {
  const { config } = await configAgua(usuarioId, tx)
  const nueva = { ...config, ...cambios }
  if (!Array.isArray(nueva.envases) || !nueva.envases.length) throw datoInvalido('Dejá al menos un envase.')
  nueva.envases = nueva.envases.map((e, i) => {
    const nombre = String(e.nombre || '').trim()
    if (!nombre) throw datoInvalido('Cada envase necesita un nombre.')
    if (!(Number(e.ml) > 0)) throw datoInvalido(`${nombre}: los ml tienen que ser más que 0.`)
    return { id: String(e.id || `env-${ahora()}-${i}`), nombre, ml: Math.round(Number(e.ml)) }
  })
  if (!nueva.envases.some((e) => e.id === nueva.principal)) nueva.principal = nueva.envases[0].id
  if (!(Number(nueva.objetivoMl) > 0)) delete nueva.objetivoMl
  else nueva.objetivoMl = Math.round(Number(nueva.objetivoMl))
  if (!['chica', 'tarjeta', 'no'].includes(nueva.enHoy)) nueva.enHoy = 'chica'
  await datos.guardarConfig(usuarioId, 'agua', nueva, tx)
  return (await configAgua(usuarioId, tx)).config
}

/** { ml, objetivo, tomas, nivel (0..1, puede pasar de 1), llego } */
async function aguaDelDia(usuarioId, fecha, tx = null) {
  const { objetivo: obj } = await configAgua(usuarioId, tx)
  const tomas = await datos.tomasEntre(usuarioId, fechaValida(fecha), fecha, tx)
  const ml = tomas.reduce((s, t) => s + t.ml, 0)
  return { ml, objetivo: obj, tomas, nivel: obj ? ml / obj : 0, llego: ml >= obj }
}

/** Un toque: suma el envase (el principal si no se dice otro). Sin XP: no toca ningún pilar. */
async function tomarAgua(usuarioId, fecha, envaseId = null, tx = null) {
  return transaccion(async (t) => {
    const f = await fechaO(usuarioId, fecha, t)
    const antes = await aguaDelDia(usuarioId, f, t)
    const { config, principal } = await configAgua(usuarioId, t)
    const e = (envaseId && config.envases.find((x) => x.id === envaseId)) || principal
    const ultimo = antes.tomas.length ? antes.tomas[antes.tomas.length - 1].instante : 0
    const toma = await datos.crearToma(usuarioId, { fecha: f, ml: e.ml, envase: e.id, instante: Math.max(ahora(), ultimo + 1) }, t)
    const dia = await aguaDelDia(usuarioId, f, t)
    return { toma, dia, recienLlego: !antes.llego && dia.llego }
  }, tx)
}

/** Resta el último toque del día. Devuelve cómo quedó. */
async function deshacerAgua(usuarioId, fecha, tx = null) {
  const f = await fechaO(usuarioId, fecha, tx)
  await datos.borrarUltimaToma(usuarioId, f, tx)
  return aguaDelDia(usuarioId, f, tx)
}

async function borrarToma(usuarioId, id, tx = null) {
  await datos.borrarToma(usuarioId, id, tx)
}

/** Para progreso: últimos 14 días, litros por día de cada semana y racha de días llegando al objetivo. */
async function resumenAgua(usuarioId, fecha, semanas = 6, tx = null) {
  const { objetivo: obj } = await configAgua(usuarioId, tx)
  const lunes = lunesDe(fecha)
  const desde = sumarDias(lunes, -7 * (semanas - 1))
  const desdeDias = sumarDias(fecha, -13)
  const tomas = await datos.tomasEntre(usuarioId, desdeDias < desde ? desdeDias : desde, fecha, tx)
  const porDia = new Map()
  for (const t of tomas) porDia.set(t.fecha, (porDia.get(t.fecha) || 0) + t.ml)
  const dias = []
  for (let f = desdeDias; f <= fecha; f = sumarDias(f, 1)) dias.push({ fecha: f, ml: porDia.get(f) || 0, llego: (porDia.get(f) || 0) >= obj })
  const res = []
  for (let i = 0; i < semanas; i++) {
    const ini = sumarDias(desde, 7 * i)
    const fin = sumarDias(ini, 6)
    const d = [...porDia.entries()].filter(([f]) => f >= ini && f <= fin)
    res.push({ desde: ini, dias: d.length, llego: d.filter(([, ml]) => ml >= obj).length, litrosPorDia: d.length ? Math.round(d.reduce((s, [, ml]) => s + ml, 0) / d.length / 100) / 10 : null })
  }
  while (res.length > 2 && res[0].dias === 0) res.shift()
  let racha = 0
  for (let i = dias.length - 1; i >= 0 && dias[i].llego; i--) racha++
  return { objetivo: obj, dias, semanas: res, rachaDias: racha }
}

// ---------- Fruta ----------

async function configFruta(usuarioId, tx = null) {
  return { ...calculo.FRUTA_DEFECTO, ...((await configCruda(usuarioId, tx)).fruta || {}) }
}

async function guardarConfigFruta(usuarioId, cambios, tx = null) {
  const n = { ...(await configFruta(usuarioId, tx)), ...cambios }
  n.nombre = String(n.nombre || '').trim() || calculo.FRUTA_DEFECTO.nombre
  n.objetivo1 = Math.max(1, Math.round(Number(n.objetivo1)) || 1)
  n.objetivo2 = Math.max(n.objetivo1, Math.round(Number(n.objetivo2)) || n.objetivo1)
  n.usar = n.usar !== false
  await datos.guardarConfig(usuarioId, 'fruta', n, tx)
  return n
}

/** { n, objetivo1, objetivo2, nombre, usar, estado, mordido } */
async function frutaDelDia(usuarioId, fecha, tx = null) {
  const c = await configFruta(usuarioId, tx)
  const filas = await datos.frutasPorDia(usuarioId, fechaValida(fecha), fecha, tx)
  const n = filas.length ? filas[0].n : 0
  return { n, objetivo1: c.objetivo1, objetivo2: c.objetivo2, nombre: c.nombre, usar: c.usar, estado: calculo.estadoFruta(n, c.objetivo1, c.objetivo2), mordido: calculo.mordidoDe(n, c.objetivo1, c.objetivo2) }
}

/** Un toque en la manzana: suma una fruta. Sin XP. */
async function comerFruta(usuarioId, fecha, tx = null) {
  return transaccion(async (t) => {
    const f = await fechaO(usuarioId, fecha, t)
    const antes = await frutaDelDia(usuarioId, f, t)
    const ultimo = await datos.ultimoInstanteFruta(usuarioId, f, t)
    await datos.crearFruta(usuarioId, { fecha: f, instante: Math.max(ahora(), ultimo + 1) }, t)
    const dia = await frutaDelDia(usuarioId, f, t)
    return { dia, recienCumplido: antes.estado === 'pendiente' && dia.estado !== 'pendiente', recienSuperado: antes.estado !== 'superado' && dia.estado === 'superado' }
  }, tx)
}

async function deshacerFruta(usuarioId, fecha, tx = null) {
  const f = await fechaO(usuarioId, fecha, tx)
  await datos.borrarUltimaFruta(usuarioId, f, tx)
  return frutaDelDia(usuarioId, f, tx)
}

/** Últimos días (del más viejo a `fecha`) con cuántas frutas. */
async function historialFruta(usuarioId, fecha, dias = 14, tx = null) {
  const c = await configFruta(usuarioId, tx)
  const desde = sumarDias(fecha, -(dias - 1))
  const porDia = new Map((await datos.frutasPorDia(usuarioId, desde, fecha, tx)).map((x) => [x.fecha, x.n]))
  const res = []
  for (let f = desde; f <= fecha; f = sumarDias(f, 1)) { const n = porDia.get(f) || 0; res.push({ fecha: f, n, estado: calculo.estadoFruta(n, c.objetivo1, c.objetivo2) }) }
  return res
}

// ---------- Resúmenes ----------

/** Para progreso: promedios por semana (solo días cargados), pesos, ultraprocesados y días cargados de esta semana. */
async function resumenSemanas(usuarioId, fecha, semanas = 8, tx = null) {
  const lunes = lunesDe(fecha)
  const desde = sumarDias(lunes, -7 * (semanas - 1))
  const comidas = (await datos.comidasEntre(usuarioId, desde, fecha, tx)).map(comoRegistro)
  const porDia = new Map()
  for (const r of comidas) porDia.set(r.fecha, [...(porDia.get(r.fecha) || []), r])
  const res = []
  for (let i = 0; i < semanas; i++) {
    const ini = sumarDias(desde, 7 * i)
    const dias = [...porDia.entries()].filter(([f]) => f >= ini && f <= sumarDias(ini, 6)).map(([, l]) => calculo.sumar(l))
    res.push({ desde: ini, dias: dias.length, kcal: dias.length ? Math.round(dias.reduce((s, x) => s + x.kcal, 0) / dias.length) : null, proteina: dias.length ? Math.round(dias.reduce((s, x) => s + x.p, 0) / dias.length) : null })
  }
  while (res.length > 4 && res[0].dias === 0) res.shift()
  const estaSemana = comidas.filter((r) => r.fecha >= lunes)
  return {
    objetivo: await objetivo(usuarioId, tx),
    pesos: await pesos(usuarioId, tx),
    semanas: res,
    ultraprocesadosSemana: estaSemana.filter((r) => r.up).length,
    diasCargadosSemana: new Set(estaSemana.map((r) => r.fecha)).size,
  }
}

/** Lo chico para la tarjeta de Hoy (módulo **dia**): calorías y proteína frente al objetivo, agua y fruta. */
async function resumenHoy(usuarioId, tx = null) {
  const f = await hoy(usuarioId, tx)
  const o = await objetivo(usuarioId, tx)
  const { totales, lista } = await delDia(usuarioId, f, tx)
  return {
    fecha: f,
    objetivo: o,
    totales,
    cargados: lista.length,
    estado: o ? calculo.estadoKcal(totales.kcal, o.kcal) : null,
    // enHoy: 'chica' (dentro de Comida), 'tarjeta' (aparte) o 'no'. Envases para «mantené apretado».
    agua: await (async () => { const c = await configAgua(usuarioId, tx); return { ...(await aguaDelDia(usuarioId, f, tx)), enHoy: c.config.enHoy || 'chica', envases: c.config.envases, principal: c.principal } })(),
    fruta: await frutaDelDia(usuarioId, f, tx),
  }
}

/** Todo lo de la pantalla de Comida para una fecha (por defecto hoy). */
async function resumen(usuarioId, fecha = null, tx = null) {
  const f = await fechaO(usuarioId, fecha, tx)
  const hoyF = await hoy(usuarioId, tx)
  const o = await objetivo(usuarioId, tx)
  const dia = await delDia(usuarioId, f, tx)
  const agua = await configAgua(usuarioId, tx)
  const ayer = await delDia(usuarioId, sumarDias(f, -1), tx)
  return {
    fecha: f,
    hoy: hoyF,
    objetivo: o,
    totales: dia.totales,
    estado: o ? calculo.estadoKcal(dia.totales.kcal, o.kcal) : null,
    franjas: calculo.FRANJAS.map((x) => ({ ...x, lista: dia.porFranja[x.id], totales: calculo.sumar(dia.porFranja[x.id]), hayAyer: ayer.porFranja[x.id].length > 0 })),
    franjaAhora: await franjaAhora(usuarioId, tx),
    frecuentes: await frecuentes(usuarioId, f, 8, tx),
    guardadas: await guardadas(usuarioId, tx),
    agua: { ...(await aguaDelDia(usuarioId, f, tx)), envases: agua.config.envases, principal: agua.principal },
    fruta: await frutaDelDia(usuarioId, f, tx),
  }
}

/** Lo de la pantalla de ajustes de comida. */
async function ajustes(usuarioId, tx = null) {
  const o = await objetivo(usuarioId, tx)
  return {
    hoy: await hoy(usuarioId, tx),
    objetivo: o,
    calculado: o ? calculo.calcularObjetivo(o) : null,
    pesos: (await pesos(usuarioId, tx)).slice(-30),
    agua: await configAgua(usuarioId, tx),
    fruta: await configFruta(usuarioId, tx),
    fuentes: calculo.FUENTES_TABLA,
    alimentosEnTabla: calculo.TABLA_ALIMENTOS.length,
  }
}

// ---------- Copia de la app vieja ----------

/**
 * Trae lo de comida de «Copiar todo como texto» de la app vieja. Recibe `tablas` de la copia:
 * alimentosPropios, comidas, pesos, comidasGuardadas, agua, frutas y ajustes (comida, agua, fruta).
 * Los ids viejos de alimentos propios se pasan a los nuevos. Todo o nada. Devuelve cuántas filas entraron.
 */
async function importar(usuarioId, tablas, tx = null) {
  const T = tablas || {}
  const lista = (k) => (Array.isArray(T[k]) ? T[k] : [])
  return transaccion(async (t) => {
    let n = 0
    const ids = new Map()
    for (const a of lista('alimentosPropios')) {
      if (!a || !a.n || !(Number(a.kcal) >= 0)) continue
      const codigo = a.codigo ? String(a.codigo).replace(/\D/g, '') : null
      const ya = codigo ? await datos.propioPorCodigo(usuarioId, codigo, t) : null
      const fila = ya || await datos.crearPropio(usuarioId, {
        nombre: String(a.n), kcal: Number(a.kcal) || 0, p: Number(a.p) || 0, c: Number(a.c) || 0, g: Number(a.g) || 0,
        porcion: a.por || '100 g', gramos: Math.round(Number(a.gr)) || 100, fuente: a.fuente === 'off' ? 'off' : 'propio', codigo, up: !!a.up, creado: Number(a.creado) || ahora(),
      }, t)
      ids.set(a.id, `p${fila.id}`)
      if (!ya) n++
    }
    const nuevoId = (id) => ids.get(id) || id
    for (const r of lista('comidas')) {
      if (!r || !esFechaValida(r.fecha) || !(Number(r.gramos) > 0) || !calculo.ES_FRANJA.has(r.franja)) continue
      await datos.crearComida(usuarioId, {
        fecha: r.fecha, franja: r.franja, alimento: nuevoId(r.alimentoId), nombre: String(r.nombre || ''), gramos: Math.round(Number(r.gramos)),
        kcal: Number(r.kcal) || 0, p: Number(r.p) || 0, c: Number(r.c) || 0, g: Number(r.g) || 0, up: !!r.up, instante: Number(r.instante) || 0,
      }, t)
      n++
    }
    for (const g of lista('comidasGuardadas')) {
      if (!g || !g.nombre || !Array.isArray(g.items)) continue
      await datos.crearGuardada(usuarioId, { nombre: String(g.nombre), items: g.items.map((i) => ({ alimento: nuevoId(i.alimentoId), nombre: i.nombre, gramos: i.gramos })), creado: Number(g.creado) || ahora() }, t)
      n++
    }
    for (const p of lista('pesos')) {
      if (!p || !esFechaValida(p.fecha) || !(Number(p.kg) > 0)) continue
      await datos.guardarPeso(usuarioId, { fecha: p.fecha, kg: Number(p.kg), instante: Number(p.instante) || 0 }, t)
      n++
    }
    for (const a of lista('agua')) {
      if (!a || !esFechaValida(a.fecha) || !(Number(a.ml) > 0)) continue
      await datos.crearToma(usuarioId, { fecha: a.fecha, ml: Math.round(Number(a.ml)), envase: a.envase || null, instante: Number(a.instante) || 0 }, t)
      n++
    }
    for (const f of lista('frutas')) {
      if (!f || !esFechaValida(f.fecha)) continue
      await datos.crearFruta(usuarioId, { fecha: f.fecha, instante: Number(f.instante) || 0 }, t)
      n++
    }
    const aj = lista('ajustes').find((x) => x && x.id === 'unicos') || lista('ajustes')[0] || T.ajustesViejos || null
    if (aj) {
      if (aj.comida) await datos.guardarConfig(usuarioId, 'objetivo', aj.comida, t)
      if (aj.agua) await datos.guardarConfig(usuarioId, 'agua', aj.agua, t)
      if (aj.fruta) await datos.guardarConfig(usuarioId, 'fruta', aj.fruta, t)
    }
    await anotar(usuarioId, 'comida', 'importar', { filas: n }, t)
    return n
  }, tx)
}

/**
 * Todo lo de comida con la forma de la app vieja, que es la que recibe `importar` (lo usa el módulo copia).
 * Los alimentos propios salen con id `p<n>` y las comidas los nombran igual (`alimentoId`).
 */
async function exportar(usuarioId, tx = null) {
  const T0 = '0001-01-01'
  const T1 = '9999-12-31'
  const cfg = (await datos.config(usuarioId, tx)) || {}
  return {
    alimentosPropios: (await datos.propios(usuarioId, tx)).reverse().map((a) => ({
      id: `p${a.id}`, n: a.nombre, kcal: a.kcal, p: a.p, c: a.c, g: a.g, por: a.porcion, gr: a.gramos, fuente: a.fuente, codigo: a.codigo || undefined, up: a.up, creado: a.creado,
    })),
    comidas: (await datos.comidasEntre(usuarioId, T0, T1, tx)).map((r) => ({
      fecha: r.fecha, franja: r.franja, alimentoId: r.alimento, nombre: r.nombre, gramos: r.gramos, kcal: r.kcal, p: r.p, c: r.c, g: r.g, up: r.up, instante: r.instante,
    })),
    comidasGuardadas: (await datos.guardadas(usuarioId, tx)).map((g) => ({
      nombre: g.nombre, items: (g.items || []).map((i) => ({ alimentoId: i.alimento, nombre: i.nombre, gramos: i.gramos })), creado: g.creado,
    })),
    pesos: await datos.pesos(usuarioId, tx),
    agua: (await datos.tomasEntre(usuarioId, T0, T1, tx)).map(({ id, ...a }) => a),
    frutas: (await datos.frutasTodas(usuarioId, tx)).map(({ id, ...f }) => f),
    ajustes: [{ id: 'unicos', comida: cfg.objetivo || undefined, agua: cfg.agua || undefined, fruta: cfg.fruta || undefined }],
  }
}

module.exports = {
  hoy,
  alimento, buscar, crearPropio, buscarCodigo,
  registrar, cambiarCantidad, borrar, delDia, frecuentes, repetirAyer,
  guardarFranja, guardadas, cargarGuardada, borrarGuardada,
  objetivo, guardarObjetivo, registrarPeso, pesos, planDelDia,
  configAgua, guardarConfigAgua, aguaDelDia, tomarAgua, deshacerAgua, borrarToma, resumenAgua,
  configFruta, guardarConfigFruta, frutaDelDia, comerFruta, deshacerFruta, historialFruta,
  resumenSemanas, resumenHoy, resumen, ajustes, importar, exportar,
}
