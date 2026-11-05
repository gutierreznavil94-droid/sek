import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { exportarTodo } from './exportar'
import { comerFruta, configFruta, deshacerFruta, frutaDelDia, guardarConfigFruta, historialFruta, mordidoDe } from './fruta'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-05'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`fruta-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(HOY, '13:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

describe('fruta del día', () => {
  it('arranca con 1 y 2 frutas de objetivo', async () => {
    expect(await configFruta()).toEqual({ nombre: 'Fruta', objetivo1: 1, objetivo2: 2 })
    const d = await frutaDelDia(HOY)
    expect(d.n).toBe(0)
    expect(d.estado).toBe('pendiente')
  })

  it('cada toque suma: con 1 queda bastante mordida, con 2 solo el centro; deshacer resta', async () => {
    const a = await comerFruta(HOY)
    expect(a.dia.estado).toBe('cumplido')
    expect(a.recienCumplido).toBe(true)
    expect(a.dia.mordido).toBeCloseTo(0.6)
    const b = await comerFruta(HOY)
    expect(b.dia.estado).toBe('superado')
    expect(b.recienSuperado).toBe(true)
    expect(b.dia.mordido).toBe(1)
    const c = await deshacerFruta(HOY)
    expect(c.n).toBe(1)
    expect(c.estado).toBe('cumplido')
  })

  it('objetivos editables y mordiscos en proporción', async () => {
    await guardarConfigFruta({ nombre: 'Manzana', objetivo1: 2, objetivo2: 4 })
    expect(mordidoDe(1, 2, 4)).toBeCloseTo(0.3)
    expect(mordidoDe(3, 2, 4)).toBeCloseTo(0.8)
    await comerFruta(HOY)
    expect((await frutaDelDia(HOY)).estado).toBe('pendiente')
    // El 2.º objetivo nunca queda por debajo del 1.º
    expect((await guardarConfigFruta({ objetivo1: 3, objetivo2: 1 })).objetivo2).toBe(3)
  })

  it('se guarda por día, sale en el historial y en la copia', async () => {
    await comerFruta(HOY)
    await comerFruta('2026-11-04')
    await comerFruta('2026-11-04')
    const h = await historialFruta(HOY, 3)
    expect(h.map((x) => x.n)).toEqual([0, 2, 1])
    expect(h[1].estado).toBe('superado')
    const x = await exportarTodo()
    expect(x.tablas.frutas).toHaveLength(3)
  })
})
