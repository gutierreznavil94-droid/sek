/**
 * Comidas: objetivo (calorías y proteína), registro rápido, tabla local de
 * alimentos, código de barras (Open Food Facts) y el pilar opcional
 * «Comer según el plan». Visual, simple y práctico: dos números mandan.
 */

import tabla from '../comidas/alimentos.json'
import { db } from '../data/db'
import type { AlimentoPropio, ComidaGuardada, FranjaComida, ObjetivoComida, RegistroComida, RegistroPeso } from '../data/tipos'
import { fechaDe, formatoHora, lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { cambiarXpDeAccion } from './acciones'
import { guardarAjustes, obtenerAjustes, registrarEvento } from './base'
import { ahora, nuevoId } from './reloj'

// ---------- Alimentos ----------

/** Alimento por 100 g (de la tabla o propio). */
export type Alimento = { id: string; n: string; cat?: string; kcal: number; p: number; c: number; g: number; por: string; gr: number; f?: string; up?: 1; fuente?: 'tabla' | 'propio' | 'off' }

export const TABLA_ALIMENTOS: Alimento[] = (tabla.alimentos as Alimento[]).map((a) => ({ ...a, fuente: 'tabla' as const }))
export const FUENTES_TABLA: Record<string, string> = tabla.fuentes

export async function todosLosAlimentos(): Promise<Alimento[]> {
  const propios = await db().alimentosPropios.toArray()
  return [...propios.map((a) => ({ ...a, fuente: a.fuente })), ...TABLA_ALIMENTOS]
}

export async function alimentoPorId(id: string): Promise<Alimento | undefined> {
  return TABLA_ALIMENTOS.find((a) => a.id === id) ?? (await db().alimentosPropios.get(id))
}

export function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Buscador local: todas las palabras tienen que aparecer; primero los que empiezan con lo escrito. */
export function buscarEn(lista: Alimento[], texto: string, max = 30): Alimento[] {
  const q = normalizar(texto)
  if (!q) return []
  const palabras = q.split(/\s+/)
  const puntos = (a: Alimento) => {
    const n = normalizar(a.n)
    if (!palabras.every((p) => n.includes(p))) return -1
    return (n.startsWith(q) ? 100 : 0) + (n.split(/\s+/).some((w) => w.startsWith(palabras[0])) ? 20 : 0) + (a.fuente !== 'tabla' ? 10 : 0) - n.length / 100
  }
  return lista.map((a) => ({ a, s: puntos(a) })).filter((x) => x.s >= 0).sort((x, y) => y.s - x.s).slice(0, max).map((x) => x.a)
}

/** Totales de una cantidad (gramos) de un alimento por 100 g. */
export function macrosDe(a: Pick<Alimento, 'kcal' | 'p' | 'c' | 'g'>, gramos: number): { kcal: number; p: number; c: number; g: number } {
  const f = gramos / 100
  return { kcal: Math.round(a.kcal * f), p: Math.round(a.p * f * 10) / 10, c: Math.round(a.c * f * 10) / 10, g: Math.round(a.g * f * 10) / 10 }
}

export async function agregarAlimentoPropio(a: Omit<AlimentoPropio, 'id' | 'creado' | 'fuente'> & { fuente?: AlimentoPropio['fuente'] }): Promise<AlimentoPropio> {
  if (a.n.trim().length < 2) throw new Error('Poné un nombre.')
  if (!(a.gr > 0)) throw new Error('La porción tiene que tener gramos.')
  const nuevo: AlimentoPropio = { ...a, n: a.n.trim(), fuente: a.fuente ?? 'propio', id: nuevoId('al'), creado: ahora() }
  await db().alimentosPropios.put(nuevo)
  return nuevo
}

/**
 * Alimento propio a partir de lo que se sabe de una porción (calorías y proteína
 * de la porción; carbos y grasas opcionales). Se guarda por 100 g.
 */
export async function crearPropioDesdePorcion(d: { nombre: string; porcion: string; gramos: number; kcal: number; proteina: number; carbos?: number; grasas?: number; up?: boolean }): Promise<AlimentoPropio> {
  const f = 100 / (d.gramos || 100)
  const r = (x: number) => Math.round(x * f * 10) / 10
  return agregarAlimentoPropio({ n: d.nombre, por: d.porcion || '1 porción', gr: d.gramos || 100, kcal: Math.round(d.kcal * f), p: r(d.proteina), c: r(d.carbos ?? 0), g: r(d.grasas ?? 0), ...(d.up ? { up: 1 as const } : {}) })
}

// ---------- Código de barras (Open Food Facts) ----------

type RespuestaOff = { status?: number; product?: { product_name?: string; product_name_es?: string; brands?: string; serving_size?: string; serving_quantity?: number | string; nova_group?: number; nutriments?: Record<string, number | string | undefined> } }

/** Convierte la respuesta de Open Food Facts en un alimento por 100 g (null si no sirve). */
export function alimentoDeOff(codigo: string, r: RespuestaOff): Omit<AlimentoPropio, 'id' | 'creado'> | null {
  const p = r.product
  if (!r || r.status !== 1 || !p) return null
  const nu = p.nutriments ?? {}
  const num = (k: string) => { const v = Number(nu[k]); return Number.isFinite(v) ? v : 0 }
  let kcal = num('energy-kcal_100g')
  if (!kcal && num('energy_100g')) kcal = num('energy_100g') / 4.184
  const nombre = (p.product_name_es || p.product_name || '').trim()
  if (!nombre && !kcal) return null
  const gr = Number(p.serving_quantity) > 0 ? Math.round(Number(p.serving_quantity)) : 100
  return {
    n: [nombre || `Producto ${codigo}`, p.brands?.split(',')[0]?.trim()].filter(Boolean).join(' · '),
    kcal: Math.round(kcal),
    p: Math.round(num('proteins_100g') * 10) / 10,
    c: Math.round(num('carbohydrates_100g') * 10) / 10,
    g: Math.round(num('fat_100g') * 10) / 10,
    por: p.serving_size ? `1 porción (${p.serving_size})` : '100 g',
    gr,
    fuente: 'off',
    codigo,
    ...(p.nova_group === 4 ? { up: 1 as const } : {}),
  }
}

/** Busca un código: primero lo ya guardado en el teléfono, después Open Food Facts (con internet). */
export async function buscarCodigo(codigo: string, buscar: typeof fetch = fetch): Promise<{ alimento: AlimentoPropio | null; motivo?: 'sin_internet' | 'no_esta' }> {
  const limpio = codigo.replace(/\D/g, '')
  const guardado = await db().alimentosPropios.where('codigo').equals(limpio).first()
  if (guardado) return { alimento: guardado }
  let r: RespuestaOff
  try {
    const res = await buscar(`https://world.openfoodfacts.org/api/v2/product/${limpio}.json?fields=product_name,product_name_es,brands,serving_size,serving_quantity,nova_group,nutriments`)
    r = await res.json()
  } catch {
    return { alimento: null, motivo: 'sin_internet' }
  }
  const datos = alimentoDeOff(limpio, r)
  if (!datos) return { alimento: null, motivo: 'no_esta' }
  return { alimento: await agregarAlimentoPropio(datos) }
}

// ---------- Registro del día ----------

export const FRANJAS: { id: FranjaComida; nombre: string }[] = [
  { id: 'desayuno', nombre: 'Desayuno' },
  { id: 'almuerzo', nombre: 'Almuerzo' },
  { id: 'merienda', nombre: 'Merienda' },
  { id: 'cena', nombre: 'Cena' },
  { id: 'otro', nombre: 'Otro' },
]

/** Franja según la hora: hasta 11 desayuno, hasta 15:30 almuerzo, hasta 19 merienda, después cena. */
export function franjaPorHora(hora: string): FranjaComida {
  if (hora < '11:00') return 'desayuno'
  if (hora < '15:30') return 'almuerzo'
  if (hora < '19:00') return 'merienda'
  return 'cena'
}

export async function franjaAhora(): Promise<FranjaComida> {
  const a = await obtenerAjustes()
  return franjaPorHora(formatoHora(ahora(), a.zonaHoraria))
}

export async function registrarComida(fecha: FechaDia, franja: FranjaComida, alimento: Alimento, gramos: number): Promise<RegistroComida> {
  if (!(gramos > 0)) throw new Error('La cantidad tiene que ser mayor que cero.')
  const r: RegistroComida = { id: nuevoId('com'), fecha, franja, alimentoId: alimento.id, nombre: alimento.n, gramos: Math.round(gramos), ...macrosDe(alimento, gramos), ...(alimento.up ? { up: 1 as const } : {}), instante: ahora() }
  await db().comidas.put(r)
  return r
}

export async function cambiarCantidad(id: string, gramos: number): Promise<void> {
  const r = await db().comidas.get(id)
  if (!r || !(gramos > 0)) return
  const a = await alimentoPorId(r.alimentoId)
  const base = a ?? { kcal: (r.kcal * 100) / r.gramos, p: (r.p * 100) / r.gramos, c: (r.c * 100) / r.gramos, g: (r.g * 100) / r.gramos }
  await db().comidas.put({ ...r, gramos: Math.round(gramos), ...macrosDe(base, gramos) })
}

export async function borrarComida(id: string): Promise<void> {
  await db().comidas.delete(id)
}

export type Totales = { kcal: number; p: number; c: number; g: number }
export function sumar(lista: Pick<RegistroComida, 'kcal' | 'p' | 'c' | 'g'>[]): Totales {
  const t = lista.reduce((s, r) => ({ kcal: s.kcal + r.kcal, p: s.p + r.p, c: s.c + r.c, g: s.g + r.g }), { kcal: 0, p: 0, c: 0, g: 0 })
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) }
}

export async function comidasDelDia(fecha: FechaDia): Promise<{ lista: RegistroComida[]; totales: Totales; porFranja: Map<FranjaComida, RegistroComida[]> }> {
  const lista = (await db().comidas.where('fecha').equals(fecha).toArray()).sort((a, b) => a.instante - b.instante)
  const porFranja = new Map<FranjaComida, RegistroComida[]>()
  for (const r of lista) porFranja.set(r.franja, [...(porFranja.get(r.franja) ?? []), r])
  return { lista, totales: sumar(lista), porFranja }
}

/** Frecuentes y recientes de los últimos 30 días: un toque y se carga con la cantidad de la última vez. */
export async function frecuentes(hoy: FechaDia, max = 8): Promise<{ alimentoId: string; nombre: string; gramos: number; veces: number; kcal: number }[]> {
  const lista = await db().comidas.where('fecha').between(sumarDias(hoy, -30), hoy, true, true).toArray()
  const m = new Map<string, { alimentoId: string; nombre: string; gramos: number; veces: number; ultimo: number; kcal: number }>()
  for (const r of lista) {
    const x = m.get(r.alimentoId)
    if (!x) m.set(r.alimentoId, { alimentoId: r.alimentoId, nombre: r.nombre, gramos: r.gramos, veces: 1, ultimo: r.instante, kcal: r.kcal })
    else {
      x.veces++
      if (r.instante > x.ultimo) Object.assign(x, { gramos: r.gramos, ultimo: r.instante, kcal: r.kcal })
    }
  }
  return [...m.values()].sort((a, b) => b.veces - a.veces || b.ultimo - a.ultimo).slice(0, max).map(({ ultimo, ...r }) => { void ultimo; return r })
}

/** Copia una franja entera de ayer a hoy. Devuelve cuántas cosas copió. */
export async function repetirAyer(hoy: FechaDia, franja: FranjaComida): Promise<number> {
  const ayer = (await db().comidas.where('fecha').equals(sumarDias(hoy, -1)).toArray()).filter((r) => r.franja === franja)
  const t = ahora()
  await db().comidas.bulkPut(ayer.map((r, i) => ({ ...r, id: nuevoId('com'), fecha: hoy, instante: t + i })))
  return ayer.length
}

export async function guardarComida(nombre: string, items: Pick<RegistroComida, 'alimentoId' | 'nombre' | 'gramos'>[]): Promise<ComidaGuardada> {
  if (!nombre.trim()) throw new Error('Poné un nombre.')
  if (!items.length) throw new Error('No hay nada para guardar.')
  const g: ComidaGuardada = { id: nuevoId('cg'), nombre: nombre.trim(), items: items.map((i) => ({ alimentoId: i.alimentoId, nombre: i.nombre, gramos: i.gramos })), creado: ahora() }
  await db().comidasGuardadas.put(g)
  return g
}

export async function cargarGuardada(id: string, fecha: FechaDia, franja: FranjaComida): Promise<number> {
  const g = await db().comidasGuardadas.get(id)
  if (!g) return 0
  let n = 0
  for (const i of g.items) {
    const a = await alimentoPorId(i.alimentoId)
    if (a) { await registrarComida(fecha, franja, a, i.gramos); n++ }
  }
  return n
}

export async function listarGuardadas(): Promise<ComidaGuardada[]> {
  return (await db().comidasGuardadas.toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function borrarGuardada(id: string): Promise<void> {
  await db().comidasGuardadas.delete(id)
}

// ---------- Objetivo y peso ----------

export const FACTOR_ACTIVIDAD = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 } as const

/** Mifflin-St Jeor × actividad; −20 % para bajar, +10 % para ganar. Proteína 1,8 g/kg (1,4 si mantiene). */
export function calcularObjetivo(d: Pick<ObjetivoComida, 'peso' | 'altura' | 'edad' | 'sexo' | 'actividad' | 'meta'>): { kcal: number; proteina: number; mantenimiento: number } {
  const basal = 10 * d.peso + 6.25 * d.altura - 5 * d.edad + (d.sexo === 'hombre' ? 5 : -161)
  const mantenimiento = basal * FACTOR_ACTIVIDAD[d.actividad]
  const kcal = mantenimiento * (d.meta === 'bajar' ? 0.8 : d.meta === 'ganar' ? 1.1 : 1)
  const proteina = d.peso * (d.meta === 'mantener' ? 1.4 : 1.8)
  return { kcal: Math.round(kcal / 50) * 50, proteina: Math.round(proteina / 5) * 5, mantenimiento: Math.round(mantenimiento / 50) * 50 }
}

export async function guardarObjetivo(o: ObjetivoComida, fecha: FechaDia): Promise<void> {
  if (!(o.peso > 25 && o.peso < 350) || !(o.altura > 100 && o.altura < 250) || !(o.edad > 10 && o.edad < 110)) throw new Error('Revisá peso, altura y edad.')
  const antes = (await obtenerAjustes()).comida
  await guardarAjustes({ comida: o }, 'Objetivo de comida')
  if (!antes || antes.peso !== o.peso) await registrarPeso(fecha, o.peso)
}

/** Guarda el peso del día (uno por día: el último manda). */
export async function registrarPeso(fecha: FechaDia, kg: number): Promise<RegistroPeso> {
  if (!(kg > 25 && kg < 350)) throw new Error('Peso fuera de rango.')
  const r: RegistroPeso = { id: `peso-${fecha}`, fecha, kg: Math.round(kg * 10) / 10, instante: ahora() }
  await db().pesos.put(r)
  const a = await obtenerAjustes()
  if (a.comida && a.comida.peso !== r.kg) {
    const nuevo = { ...a.comida, peso: r.kg }
    const calc = calcularObjetivo(nuevo)
    await guardarAjustes({ comida: a.comida.manual ? nuevo : { ...nuevo, kcal: calc.kcal, proteina: calc.proteina } }, 'Peso actualizado')
  }
  return r
}

/** Estado del día frente al objetivo: «bien» hasta +10 %, «pasado» más allá (ámbar, nunca rojo). */
export function estadoKcal(consumidas: number, objetivo: number): 'vacio' | 'bien' | 'pasado' {
  if (consumidas <= 0) return 'vacio'
  return consumidas > objetivo * 1.1 ? 'pasado' : 'bien'
}

// ---------- Pilar «Comer según el plan» ----------

export const ID_PILAR_COMIDA = 'comer-plan'

/** Prende o apaga el pilar opcional (15 XP). Arranca apagado. */
export async function activarPilarComida(activo: boolean, hoy: FechaDia): Promise<void> {
  const d = db()
  const existe = await d.acciones.get(ID_PILAR_COMIDA)
  if (!existe) {
    if (!activo) return
    await d.transaction('rw', [d.acciones, d.eventos], async () => {
      await d.acciones.put({ id: ID_PILAR_COMIDA, nombre: 'Comer según el plan', tipo: 'comida_plan', condicion: 'Cerrar el día entre −10 % y +10 % de tus calorías y llegar a tu proteína. Un día sin cargar comidas no cuenta.', dias: [0, 1, 2, 3, 4, 5, 6], pilar: true, atributoIds: ['fisico'], objetivoIds: [], peso: 1, activa: true, orden: 9, creado: ahora() })
      await registrarEvento({ tipo: 'crear', entidad: 'accion', entidadId: ID_PILAR_COMIDA, motivo: 'Pilar de comida activado' })
    })
    await cambiarXpDeAccion(ID_PILAR_COMIDA, 15, hoy)
  } else {
    await d.acciones.put({ ...existe, activa: activo })
  }
  // Compromiso de hoy: se crea al activarlo y se quita (si sigue pendiente) al apagarlo.
  const { generarCompromisosDelDia, idCompromiso } = await import('./dia')
  const id = idCompromiso(ID_PILAR_COMIDA, hoy)
  const c = await d.compromisos.get(id)
  if (!activo && c && c.estado === 'pendiente') await d.compromisos.delete(id)
  if (activo) await generarCompromisosDelDia(hoy)
}

/** ¿Se cumplió el plan ese día? null si no se cargó nada (no cuenta). */
export async function evaluarPlanComida(fecha: FechaDia): Promise<{ cumplido: boolean; kcal: number; proteina: number } | null> {
  const a = await obtenerAjustes()
  const o = a.comida
  const lista = await db().comidas.where('fecha').equals(fecha).toArray()
  if (!o || lista.length === 0) return null
  const t = sumar(lista)
  const cumplido = t.kcal >= o.kcal * 0.9 && t.kcal <= o.kcal * 1.1 && t.p >= o.proteina
  return { cumplido, kcal: t.kcal, proteina: t.p }
}

// ---------- Progreso ----------

export type ResumenComida = {
  objetivo: ObjetivoComida | undefined
  pesos: RegistroPeso[]
  /** Promedios por semana (solo días con algo cargado), de la más vieja a la actual. */
  semanas: { desde: FechaDia; kcal: number | null; proteina: number | null; dias: number }[]
  ultraprocesadosSemana: number
  diasCargadosSemana: number
}

export async function resumenComida(hoy: FechaDia, semanas = 8): Promise<ResumenComida> {
  const a = await obtenerAjustes()
  const lunes = lunesDe(hoy)
  const desde = sumarDias(lunes, -7 * (semanas - 1))
  const comidas = await db().comidas.where('fecha').between(desde, hoy, true, true).toArray()
  const porDia = new Map<FechaDia, RegistroComida[]>()
  for (const r of comidas) porDia.set(r.fecha, [...(porDia.get(r.fecha) ?? []), r])
  const res: ResumenComida['semanas'] = []
  for (let i = 0; i < semanas; i++) {
    const ini = sumarDias(desde, 7 * i)
    const dias = [...porDia.entries()].filter(([f]) => f >= ini && f <= sumarDias(ini, 6)).map(([, l]) => sumar(l))
    res.push({ desde: ini, dias: dias.length, kcal: dias.length ? Math.round(dias.reduce((s, x) => s + x.kcal, 0) / dias.length) : null, proteina: dias.length ? Math.round(dias.reduce((s, x) => s + x.p, 0) / dias.length) : null })
  }
  // Sin semanas vacías al principio (quedan al menos 4).
  while (res.length > 4 && res[0].dias === 0) res.shift()
  const estaSemana = comidas.filter((r) => r.fecha >= lunes)
  const pesos = (await db().pesos.toArray()).sort((x, y) => x.fecha.localeCompare(y.fecha))
  return { objetivo: a.comida, pesos, semanas: res, ultraprocesadosSemana: estaSemana.filter((r) => r.up).length, diasCargadosSemana: new Set(estaSemana.map((r) => r.fecha)).size }
}

/** Fecha de hoy según la zona de los ajustes (atajo para la UI). */
export async function hoyComida(): Promise<FechaDia> {
  return fechaDe(ahora(), (await obtenerAjustes()).zonaHoraria)
}
