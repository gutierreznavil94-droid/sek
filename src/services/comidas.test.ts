import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta, obtenerAjustes } from './base'
import { iniciarCiclo } from './ciclo'
import {
  TABLA_ALIMENTOS, activarPilarComida, alimentoDeOff, buscarCodigo, buscarEn, calcularObjetivo, cargarGuardada, comidasDelDia,
  crearPropioDesdePorcion, estadoKcal, franjaPorHora, frecuentes, guardarComida, guardarObjetivo, registrarComida, registrarPeso, repetirAyer, resumenComida, ID_PILAR_COMIDA,
} from './comidas'
import { cerrarDiasPendientes, idCompromiso, pilaresDelDia } from './dia'
import { exportarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'
import type { ObjetivoComida } from '../data/tipos'

const Z = 'America/Argentina/Cordoba'
let n = 0
const obj: ObjetivoComida = { peso: 70, altura: 175, edad: 20, sexo: 'hombre', actividad: 'moderado', meta: 'ganar', kcal: 0, proteina: 0 }

beforeEach(async () => {
  await usarBaseDePruebas(`comidas-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-04', '13:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

const al = (nombre: string) => TABLA_ALIMENTOS.find((a) => a.n === nombre)!

describe('tabla y buscador', () => {
  it('tiene unos 400 alimentos con fuente y sin repetidos', () => {
    expect(TABLA_ALIMENTOS.length).toBeGreaterThanOrEqual(400)
    expect(new Set(TABLA_ALIMENTOS.map((a) => a.n)).size).toBe(TABLA_ALIMENTOS.length)
    let raros = 0
    for (const a of TABLA_ALIMENTOS) {
      expect(['U', 'A']).toContain(a.f)
      expect(a.gr).toBeGreaterThan(0)
      // Las calorías cierran con los macros (±20 %). Solo se escapan el alcohol y lo muy fibroso (salvado, cacao).
      const calc = a.p * 4 + a.c * 4 + a.g * 9
      if (a.kcal > 30 && Math.abs(calc - a.kcal) / a.kcal > 0.2) raros++
    }
    expect(raros).toBeLessThanOrEqual(5)
  })

  it('busca sin tildes y con varias palabras', () => {
    expect(buscarEn(TABLA_ALIMENTOS, 'milanesa pollo')[0].n).toMatch(/Milanesa de pollo/)
    expect(buscarEn(TABLA_ALIMENTOS, 'platano').length).toBe(0)
    expect(buscarEn(TABLA_ALIMENTOS, 'pure').some((a) => a.n === 'Puré de papas')).toBe(true)
    expect(buscarEn(TABLA_ALIMENTOS, 'mate')[0].n).toMatch(/^Mate/)
  })
})

describe('objetivo', () => {
  it('Mifflin-St Jeor × actividad, +10 % para ganar y 1,8 g/kg', () => {
    // 10·70 + 6,25·175 − 5·20 + 5 = 1698,75 × 1,55 = 2633 → +10 % = 2896 → 2900
    expect(calcularObjetivo(obj)).toEqual({ kcal: 2900, proteina: 125, mantenimiento: 2650 })
    expect(calcularObjetivo({ ...obj, meta: 'bajar' }).kcal).toBe(2100)
    expect(calcularObjetivo({ ...obj, meta: 'mantener' }).proteina).toBe(100)
    expect(calcularObjetivo({ ...obj, sexo: 'mujer', meta: 'mantener' }).kcal).toBe(2400)
  })

  it('guardar el objetivo deja el peso para la curva, y un peso nuevo recalcula', async () => {
    const c = calcularObjetivo(obj)
    await guardarObjetivo({ ...obj, ...c }, '2026-11-04')
    expect((await db().pesos.toArray()).map((p) => p.kg)).toEqual([70])
    fijarAhora(instanteDe('2026-11-11', '08:00', Z))
    await registrarPeso('2026-11-11', 71.4)
    const a = await obtenerAjustes()
    expect(a.comida?.peso).toBe(71.4)
    expect(a.comida?.proteina).toBe(130)
  })

  it('verde hasta +10 %, ámbar después, nunca rojo', () => {
    expect(estadoKcal(0, 2000)).toBe('vacio')
    expect(estadoKcal(2200, 2000)).toBe('bien')
    expect(estadoKcal(2250, 2000)).toBe('pasado')
  })
})

describe('carga rápida', () => {
  it('registra por gramos, suma el día y separa por franja', async () => {
    await registrarComida('2026-11-04', 'almuerzo', al('Milanesa de carne al horno'), 150)
    await registrarComida('2026-11-04', 'almuerzo', al('Puré de papas'), 200)
    const d = await comidasDelDia('2026-11-04')
    expect(d.totales.kcal).toBe(330 + 210)
    expect(d.porFranja.get('almuerzo')).toHaveLength(2)
  })

  it('frecuentes con la cantidad de la última vez, repetir ayer y comidas guardadas', async () => {
    const huevo = al('Huevo duro')
    await registrarComida('2026-11-03', 'desayuno', huevo, 50)
    await registrarComida('2026-11-03', 'desayuno', al('Café con leche'), 250)
    fijarAhora(instanteDe('2026-11-04', '13:30', Z))
    await registrarComida('2026-11-04', 'almuerzo', huevo, 100)
    const f = await frecuentes('2026-11-04')
    expect(f[0]).toMatchObject({ alimentoId: huevo.id, veces: 2, gramos: 100 })
    expect(await repetirAyer('2026-11-04', 'desayuno')).toBe(2)
    expect((await comidasDelDia('2026-11-04')).porFranja.get('desayuno')).toHaveLength(2)
    const g = await guardarComida('Desayuno de siempre', (await comidasDelDia('2026-11-03')).lista)
    expect(await cargarGuardada(g.id, '2026-11-05', 'desayuno')).toBe(2)
  })

  it('franja según la hora', () => {
    expect(franjaPorHora('08:30')).toBe('desayuno')
    expect(franjaPorHora('13:00')).toBe('almuerzo')
    expect(franjaPorHora('17:30')).toBe('merienda')
    expect(franjaPorHora('21:00')).toBe('cena')
  })

  it('alimento propio por porción queda por 100 g y aparece en el buscador', async () => {
    const p = await crearPropioDesdePorcion({ nombre: 'Tarta de mamá', porcion: '1 porción', gramos: 200, kcal: 400, proteina: 20 })
    expect(p).toMatchObject({ kcal: 200, p: 10, gr: 200, fuente: 'propio' })
  })
})

describe('código de barras', () => {
  const respuesta = { status: 1, product: { product_name: 'Yogur bebible', brands: 'Marca X', serving_quantity: 200, serving_size: '200 ml', nova_group: 4, nutriments: { 'energy-kcal_100g': 52, proteins_100g: 3.1, carbohydrates_100g: 8, fat_100g: 0.9 } } }

  it('convierte la respuesta de Open Food Facts', () => {
    expect(alimentoDeOff('779', respuesta)).toMatchObject({ n: 'Yogur bebible · Marca X', kcal: 52, p: 3.1, gr: 200, fuente: 'off', up: 1 })
    expect(alimentoDeOff('1', { status: 0 })).toBeNull()
  })

  it('consulta una vez y después lo encuentra en el teléfono; sin internet avisa', async () => {
    let llamadas = 0
    const falso = (async () => { llamadas++; return { json: async () => respuesta } }) as unknown as typeof fetch
    expect((await buscarCodigo('7790001', falso)).alimento?.n).toBe('Yogur bebible · Marca X')
    expect((await buscarCodigo('7790001', falso)).alimento?.codigo).toBe('7790001')
    expect(llamadas).toBe(1)
    const roto = (async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect(await buscarCodigo('123', roto)).toEqual({ alimento: null, motivo: 'sin_internet' })
  })
})

describe('pilar «Comer según el plan»', () => {
  beforeEach(async () => {
    await guardarObjetivo({ ...obj, kcal: 2000, proteina: 120 }, '2026-11-04')
  })

  it('arranca apagado y al activarlo suma un pilar de 15 XP', async () => {
    expect((await pilaresDelDia('2026-11-04')).pilares.some((p) => p.accion.id === ID_PILAR_COMIDA)).toBe(false)
    await activarPilarComida(true, '2026-11-04')
    const p = (await pilaresDelDia('2026-11-04')).pilares.find((x) => x.accion.id === ID_PILAR_COMIDA)
    expect(p?.xpPrevisto).toBe(15)
  })

  it('un día sin cargar no cuenta; un día en el plan da XP; pasarse no castiga con XP negativo', async () => {
    await activarPilarComida(true, '2026-11-04')
    // 4 nov: sin comidas. 5 nov: en el plan. 6 nov: pasado.
    fijarAhora(instanteDe('2026-11-05', '12:00', Z))
    await cerrarDiasPendientes()
    expect(await db().compromisos.get(idCompromiso(ID_PILAR_COMIDA, '2026-11-04'))).toBeUndefined()
    const pollo = al('Pechuga de pollo cocida')
    const arroz = al('Arroz blanco cocido')
    await registrarComida('2026-11-05', 'almuerzo', pollo, 390) // 643 kcal, 121 g
    await registrarComida('2026-11-05', 'cena', arroz, 1000) // 1300 kcal
    await registrarComida('2026-11-06', 'cena', arroz, 2500)
    const xp = await xpTotal()
    fijarAhora(instanteDe('2026-11-07', '12:00', Z))
    await cerrarDiasPendientes()
    expect((await db().compromisos.get(idCompromiso(ID_PILAR_COMIDA, '2026-11-05')))?.estado).toBe('completado')
    expect((await db().compromisos.get(idCompromiso(ID_PILAR_COMIDA, '2026-11-06')))?.estado).toBe('omitido')
    expect(await xpTotal()).toBeGreaterThanOrEqual(xp + 15)
  })
})

describe('progreso y copia', () => {
  it('promedios semanales solo con días cargados y ultraprocesados de la semana', async () => {
    await registrarComida('2026-11-02', 'almuerzo', al('Pechuga de pollo cocida'), 200)
    await registrarComida('2026-11-04', 'merienda', al('Alfajor de chocolate'), 50)
    const r = await resumenComida('2026-11-04', 2)
    expect(r.semanas[1]).toMatchObject({ dias: 2, kcal: Math.round((330 + 210) / 2) })
    expect(r.semanas[0].kcal).toBeNull()
    expect(r.ultraprocesadosSemana).toBe(1)
  })

  it('la copia de seguridad lleva comidas, pesos, propios, guardadas y objetivo', async () => {
    await guardarObjetivo({ ...obj, kcal: 2000, proteina: 120 }, '2026-11-04')
    await registrarComida('2026-11-04', 'almuerzo', al('Huevo duro'), 50)
    await crearPropioDesdePorcion({ nombre: 'Algo', porcion: '1', gramos: 100, kcal: 100, proteina: 5 })
    const x = await exportarTodo()
    for (const t of ['comidas', 'pesos', 'alimentosPropios', 'comidasGuardadas']) expect(x.tablas).toHaveProperty(t)
    expect((x.tablas.comidas as unknown[]).length).toBe(1)
    expect((x.tablas.ajustes as { comida?: unknown }[])[0].comida).toBeTruthy()
  })
})
