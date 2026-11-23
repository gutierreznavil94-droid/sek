'use strict'
/**
 * Comida · las cuentas puras (sin base). Traído de src/services/comidas.ts, agua.ts y fruta.ts.
 * Alimentos por 100 g, objetivo de calorías y proteína, franjas, agua y fruta.
 */
const tabla = require('./alimentos.json')

// ---------- Alimentos ----------

/** Tabla común de alimentos (unos 400, por 100 g). id 't001'… */
const TABLA_ALIMENTOS = tabla.alimentos.map((a) => ({ ...a, fuente: 'tabla' }))
const FUENTES_TABLA = tabla.fuentes
const POR_ID = new Map(TABLA_ALIMENTOS.map((a) => [a.id, a]))

const deTabla = (id) => POR_ID.get(id) || null

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Buscador: todas las palabras tienen que aparecer; primero los que empiezan con lo escrito y los propios. */
function buscarEn(lista, texto, max = 30) {
  const q = normalizar(texto)
  if (!q) return []
  const palabras = q.split(/\s+/)
  const puntos = (a) => {
    const n = normalizar(a.n)
    if (!palabras.every((p) => n.includes(p))) return -1
    return (n.startsWith(q) ? 100 : 0) + (n.split(/\s+/).some((w) => w.startsWith(palabras[0])) ? 20 : 0) + (a.fuente !== 'tabla' ? 10 : 0) - n.length / 100
  }
  return lista.map((a) => ({ a, s: puntos(a) })).filter((x) => x.s >= 0).sort((x, y) => y.s - x.s).slice(0, max).map((x) => x.a)
}

const r1 = (x) => Math.round(x * 10) / 10

/** Totales de una cantidad (gramos) de un alimento por 100 g. */
function macrosDe(a, gramos) {
  const f = gramos / 100
  return { kcal: Math.round(a.kcal * f), p: r1(a.p * f), c: r1(a.c * f), g: r1(a.g * f) }
}

/** Suma de una lista de registros, redondeada. */
function sumar(lista) {
  const t = lista.reduce((s, r) => ({ kcal: s.kcal + r.kcal, p: s.p + r.p, c: s.c + r.c, g: s.g + r.g }), { kcal: 0, p: 0, c: 0, g: 0 })
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) }
}

/** Respuesta de Open Food Facts → alimento por 100 g (null si no sirve). */
function alimentoDeOff(codigo, r) {
  const p = r && r.product
  if (!r || r.status !== 1 || !p) return null
  const nu = p.nutriments || {}
  const num = (k) => { const v = Number(nu[k]); return Number.isFinite(v) ? v : 0 }
  let kcal = num('energy-kcal_100g')
  if (!kcal && num('energy_100g')) kcal = num('energy_100g') / 4.184
  const nombre = (p.product_name_es || p.product_name || '').trim()
  if (!nombre && !kcal) return null
  const gr = Number(p.serving_quantity) > 0 ? Math.round(Number(p.serving_quantity)) : 100
  const marca = p.brands ? p.brands.split(',')[0].trim() : ''
  return {
    n: [nombre || `Producto ${codigo}`, marca].filter(Boolean).join(' · '),
    kcal: Math.round(kcal),
    p: r1(num('proteins_100g')),
    c: r1(num('carbohydrates_100g')),
    g: r1(num('fat_100g')),
    por: p.serving_size ? `1 porción (${p.serving_size})` : '100 g',
    gr,
    fuente: 'off',
    codigo,
    up: p.nova_group === 4,
  }
}

// ---------- Franjas ----------

const FRANJAS = [
  { id: 'desayuno', nombre: 'Desayuno' },
  { id: 'almuerzo', nombre: 'Almuerzo' },
  { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' },
  { id: 'otro', nombre: 'Otro' },
]
const ES_FRANJA = new Set(FRANJAS.map((f) => f.id))

/** Franja según la hora 'HH:MM': hasta 11 desayuno, hasta 15:30 almuerzo, hasta 19 merienda, después cena. */
function franjaPorHora(hora) {
  if (hora < '11:00') return 'desayuno'
  if (hora < '15:30') return 'almuerzo'
  if (hora < '19:00') return 'merienda'
  return 'cena'
}

// ---------- Objetivo ----------

const FACTOR_ACTIVIDAD = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 }
const METAS = ['bajar', 'mantener', 'ganar']

/** Mifflin-St Jeor × actividad; −20 % para bajar, +10 % para ganar. Proteína 1,8 g/kg (1,4 si mantiene). */
function calcularObjetivo(d) {
  const basal = 10 * d.peso + 6.25 * d.altura - 5 * d.edad + (d.sexo === 'hombre' ? 5 : -161)
  const mantenimiento = basal * (FACTOR_ACTIVIDAD[d.actividad] || 1.2)
  const kcal = mantenimiento * (d.meta === 'bajar' ? 0.8 : d.meta === 'ganar' ? 1.1 : 1)
  const proteina = d.peso * (d.meta === 'mantener' ? 1.4 : 1.8)
  return { kcal: Math.round(kcal / 50) * 50, proteina: Math.round(proteina / 5) * 5, mantenimiento: Math.round(mantenimiento / 50) * 50 }
}

/** «bien» hasta +10 % del objetivo, «pasado» más allá (ámbar, nunca rojo). */
function estadoKcal(consumidas, objetivo) {
  if (consumidas <= 0) return 'vacio'
  return consumidas > objetivo * 1.1 ? 'pasado' : 'bien'
}

/** «Comer según el plan»: entre −10 % y +10 % de las calorías y llegar a la proteína. */
function planCumplido(totales, objetivo) {
  return totales.kcal >= objetivo.kcal * 0.9 && totales.kcal <= objetivo.kcal * 1.1 && totales.p >= objetivo.proteina
}

// ---------- Agua ----------

const ENVASES_DEFECTO = [
  { id: 'botella-750', nombre: 'Botella', ml: 750 },
  { id: 'vaso-250', nombre: 'Vaso', ml: 250 },
  { id: 'botella-500', nombre: 'Botella chica', ml: 500 },
]
const ML_POR_KILO = 35
const OBJETIVO_SIN_PESO = 2500

/** Objetivo del día en ml: a mano si lo cargó; si no, 35 ml por kilo redondeado a 250 (mínimo 1 L). */
function objetivoAgua(peso, aMano) {
  if (aMano && aMano > 0) return aMano
  if (!peso || peso <= 0) return OBJETIVO_SIN_PESO
  return Math.max(1000, Math.round((peso * ML_POR_KILO) / 250) * 250)
}

/** «1,5 L» */
function litros(ml) {
  const l = ml / 1000
  return `${(Math.round(l * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: l >= 10 ? 1 : 2 })} L`
}

// ---------- Fruta ----------

const FRUTA_DEFECTO = { nombre: 'Fruta', objetivo1: 1, objetivo2: 2, usar: true }

/** Cuánto se ve mordida la manzana (0..1): el 1.º objetivo muerde el 60 %, el 2.º deja solo el centro. */
function mordidoDe(n, objetivo1, objetivo2) {
  if (n <= 0) return 0
  if (n >= objetivo2) return 1
  if (n < objetivo1) return (n / objetivo1) * 0.6
  if (objetivo2 === objetivo1) return 1
  return 0.6 + ((n - objetivo1) / (objetivo2 - objetivo1)) * 0.4
}

/** pendiente: no llegó al 1.º · cumplido: pasó el 1.º · superado: llegó al 2.º. */
function estadoFruta(n, objetivo1, objetivo2) {
  if (n >= objetivo2) return 'superado'
  if (n >= objetivo1) return 'cumplido'
  return 'pendiente'
}

module.exports = {
  TABLA_ALIMENTOS, FUENTES_TABLA, deTabla, normalizar, buscarEn, macrosDe, sumar, alimentoDeOff,
  FRANJAS, ES_FRANJA, franjaPorHora,
  FACTOR_ACTIVIDAD, METAS, calcularObjetivo, estadoKcal, planCumplido,
  ENVASES_DEFECTO, ML_POR_KILO, OBJETIVO_SIN_PESO, objetivoAgua, litros,
  FRUTA_DEFECTO, mordidoDe, estadoFruta,
}
