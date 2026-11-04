import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { ENVASES_DEFECTO, configAgua, deshacerToma, guardarConfigAgua, litros, nuevoEnvase, objetivoAgua, resumenAgua, tomarAgua } from './agua'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { guardarObjetivo } from './comidas'
import { exportarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-04'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`agua-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(HOY, '13:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

describe('objetivo', () => {
  it('sale del peso de Comida: 35 ml por kilo redondeado a 250', () => {
    expect(objetivoAgua(70)).toBe(2500)
    expect(objetivoAgua(82)).toBe(2750)
    expect(objetivoAgua(undefined)).toBe(2500)
    expect(objetivoAgua(70, 3000)).toBe(3000)
  })
  it('toma el peso del objetivo de comida y se puede corregir a mano', async () => {
    await guardarObjetivo({ peso: 90, altura: 180, edad: 25, sexo: 'hombre', actividad: 'moderado', meta: 'mantener', kcal: 2500, proteina: 130 }, HOY)
    expect((await configAgua()).objetivo).toBe(3250)
    await guardarConfigAgua({ objetivoMl: 2000 })
    expect((await configAgua()).objetivo).toBe(2000)
    await guardarConfigAgua({ objetivoMl: undefined })
    expect((await configAgua()).objetivo).toBe(3250)
  })
})

describe('toques', () => {
  it('un toque suma el envase principal (750) y se llena hasta el objetivo y más', async () => {
    const r1 = await tomarAgua(HOY)
    expect(r1.toma.ml).toBe(750)
    expect(r1.dia.ml).toBe(750)
    expect(r1.dia.nivel).toBeCloseTo(0.3)
    expect(r1.recienLlego).toBe(false)
    await tomarAgua(HOY); await tomarAgua(HOY)
    const r4 = await tomarAgua(HOY)
    expect(r4.dia.ml).toBe(3000)
    expect(r4.dia.llego).toBe(true)
    expect(r4.recienLlego).toBe(true)
    expect(r4.dia.nivel).toBeGreaterThan(1)
    const r5 = await tomarAgua(HOY, 'vaso-250')
    expect(r5.toma.ml).toBe(250)
    expect(r5.recienLlego).toBe(false)
    expect(r5.dia.tomas).toHaveLength(5)
  })
  it('restar el último toque', async () => {
    await tomarAgua(HOY)
    await tomarAgua(HOY, 'vaso-250')
    const d = await deshacerToma(HOY)
    expect(d.ml).toBe(750)
    expect(d.tomas).toHaveLength(1)
    expect((await deshacerToma(HOY)).ml).toBe(0)
    expect((await deshacerToma(HOY)).ml).toBe(0)
  })
  it('los envases se editan: nuevo principal, agregar, borrar; no queda sin envases', async () => {
    expect((await configAgua()).config.envases).toEqual(ENVASES_DEFECTO)
    const grande = nuevoEnvase('Botellón', 1500)
    await guardarConfigAgua({ envases: [...ENVASES_DEFECTO, grande], principal: grande.id })
    expect((await tomarAgua(HOY)).toma.ml).toBe(1500)
    await guardarConfigAgua({ envases: [grande] })
    expect((await configAgua()).principal.id).toBe(grande.id)
    await expect(guardarConfigAgua({ envases: [] })).rejects.toThrow('al menos un envase')
    await expect(guardarConfigAgua({ envases: [{ id: 'x', nombre: 'Vaso', ml: 0 }] })).rejects.toThrow('más que 0')
    // Si borran el principal, pasa al primero.
    await guardarConfigAgua({ envases: [ENVASES_DEFECTO[1]] })
    expect((await configAgua()).principal.ml).toBe(250)
  })
  it('no da XP ni toca pilares', async () => {
    const { xpTotal } = await import('./xp')
    const antes = await xpTotal()
    for (let i = 0; i < 5; i++) await tomarAgua(HOY)
    expect(await xpTotal()).toBe(antes)
  })
})

describe('progreso y copia', () => {
  it('resumen: tira de 14 días, litros por semana y racha', async () => {
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    for (let i = 0; i < 4; i++) await tomarAgua('2026-11-02')
    fijarAhora(instanteDe('2026-11-03', '10:00', Z))
    await tomarAgua('2026-11-03')
    fijarAhora(instanteDe(HOY, '13:00', Z))
    for (let i = 0; i < 4; i++) await tomarAgua(HOY)
    const r = await resumenAgua(HOY)
    expect(r.dias).toHaveLength(14)
    expect(r.dias[13]).toEqual({ fecha: HOY, ml: 3000, llego: true })
    expect(r.dias[12].llego).toBe(false)
    expect(r.dias[12].ml).toBe(750)
    const s = r.semanas[r.semanas.length - 1]
    expect(s.desde).toBe('2026-11-02')
    expect(s.dias).toBe(3)
    expect(s.llego).toBe(2)
    expect(s.litrosPorDia).toBeCloseTo(2.3, 1)
    expect(r.rachaDias).toBe(1)
  })
  it('la copia de seguridad incluye el agua y la configuración', async () => {
    await tomarAgua(HOY)
    await guardarConfigAgua({ objetivoMl: 2000 })
    const x = await exportarTodo()
    expect(x.tablas.agua).toHaveLength(1)
    expect((x.tablas.ajustes as { agua?: { objetivoMl?: number } }[])[0].agua?.objetivoMl).toBe(2000)
    await guardarAjustes({ agua: undefined })
    expect((await configAgua()).objetivo).toBe(2500)
  })
  it('litros legibles', () => {
    expect(litros(1500)).toBe('1,5 L')
    expect(litros(2750)).toBe('2,75 L')
    expect(litros(0)).toBe('0 L')
  })
})
