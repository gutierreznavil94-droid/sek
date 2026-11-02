import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { exportarTodo, importarTodo } from './exportar'
import { agregarFechaClave, borrarFechaClave, editarFechaClave, fechasClavePorDia } from './fechasClave'
import { metasPorDia } from './metas'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`fechas-clave-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-02', '10:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

describe('fechas clave del calendario', () => {
  it('se guardan fuera de los 90 días, no dan XP ni son metas', async () => {
    const xp = await xpTotal()
    await agregarFechaClave('2027-03-10', 'Ingreso a la facultad', 'llevar DNI')
    const m = await fechasClavePorDia('2027-03-01', '2027-03-31')
    expect(m.get('2027-03-10')?.map((f) => f.titulo)).toEqual(['Ingreso a la facultad'])
    expect(await xpTotal()).toBe(xp)
    expect((await metasPorDia('2027-03-01', '2027-03-31')).size).toBe(0)
  })

  it('las anuales se repiten desde su año, no antes', async () => {
    await agregarFechaClave('2026-11-20', 'Cumple de mamá', undefined, true)
    expect((await fechasClavePorDia('2027-11-01', '2027-11-30')).has('2027-11-20')).toBe(true)
    expect((await fechasClavePorDia('2025-11-01', '2025-11-30')).has('2025-11-20')).toBe(false)
    expect((await fechasClavePorDia('2026-12-25', '2028-01-05')).size).toBe(1)
  })

  it('se editan, se borran y viajan en la copia de seguridad', async () => {
    const fc = await agregarFechaClave('2026-12-01', 'Turno')
    await editarFechaClave(fc.id, { titulo: 'Turno médico', nota: '  ' })
    expect((await db().fechasClave.get(fc.id))).toMatchObject({ titulo: 'Turno médico', nota: undefined })
    const copia = await exportarTodo()
    await borrarFechaClave(fc.id)
    expect(await db().fechasClave.count()).toBe(0)
    await importarTodo(copia)
    expect((await db().fechasClave.get(fc.id))?.titulo).toBe('Turno médico')
  })
})
