import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { agregarRegla, borrarRegla, listarCodigo, momentoDe, moverRegla, reglasDelGrupo, sembrarCodigo } from './codigo'
import { completarCompromiso, deshacerCompromiso, deshacerExtra, generarCompromisosDelDia, marcarExtra } from './dia'
import { exportarTodo, importarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0
const hora = (f: string, h: string) => fijarAhora(instanteDe(f, h, Z))

beforeEach(async () => {
  await usarBaseDePruebas(`manga-${++n}`)
  reiniciarReloj()
  hora('2026-11-02', '10:00')
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
  await generarCompromisosDelDia('2026-11-02')
})

describe('manga con segundo tope', () => {
  it('15 min cumple; 30 min da +10 extra una sola vez; deshacer quita sin duplicar', async () => {
    const manga = (await db().acciones.get('manga'))!
    expect(manga.minutosExtra).toBe(30)
    const id = 'manga:2026-11-02'
    const antes = await xpTotal()
    const r1 = await completarCompromiso(id, { minutos: 15 })
    expect(r1.xp).toBeGreaterThan(0)
    const tras15 = await xpTotal()
    const r2 = await marcarExtra(id)
    expect(r2.xp).toBe(10)
    expect(r2.compromiso.extra).toBe(true)
    expect(r2.compromiso.minutos).toBe(30)
    expect((await db().compromisos.get(id))!.estado).toBe('completado')
    expect(await xpTotal()).toBe(tras15 + 10)
    const r3 = await marcarExtra(id)
    expect(r3.xp).toBe(0)
    expect(await xpTotal()).toBe(tras15 + 10)
    await deshacerExtra(id)
    expect(await xpTotal()).toBe(tras15)
    expect((await db().compromisos.get(id))!.estado).toBe('completado')
    await marcarExtra(id)
    expect(await xpTotal()).toBe(tras15 + 10)
    await deshacerCompromiso(id)
    expect(await xpTotal()).toBe(antes)
    expect((await db().compromisos.get(id))!.extra).toBeUndefined()
  })

  it('no se puede marcar el extra antes del pilar', async () => {
    await expect(marcarExtra('manga:2026-11-02')).rejects.toThrow()
  })
})

describe('Mi código', () => {
  it('arranca con los ejemplos una sola vez; agregar, mover y borrar', async () => {
    const r = await listarCodigo()
    expect(r.map((x) => x.grupo)).toEqual(['cuerpo', 'cuerpo', 'cuerpo', 'mente', 'comida', 'cuidado'])
    for (const x of r) await borrarRegla(x.id)
    await sembrarCodigo()
    expect(await listarCodigo()).toHaveLength(0)
    const a = await agregarRegla('Leer 10 páginas', 'mente')
    const b = await agregarRegla('Meditar al despertar', 'mente')
    await moverRegla(b.id, -1)
    expect((await listarCodigo()).map((x) => x.id)).toEqual([b.id, a.id])
    await expect(agregarRegla('  ', 'mente')).rejects.toThrow()
  })

  it('dos vistas: los ejemplos tienen su momento y el orden se guarda por vista', async () => {
    const r = await listarCodigo()
    expect(r.map((x) => momentoDe(x))).toEqual(['manana', 'siempre', 'siempre', 'siempre', 'siempre', 'noche'])
    const siempre = reglasDelGrupo(r, 'momento', 'siempre').map((x) => x.id)
    expect(siempre).toHaveLength(4)
    // Mover en «por momento» no cambia el orden «por área»
    await moverRegla(siempre[1], -1, 'momento')
    const r2 = await listarCodigo()
    expect(reglasDelGrupo(r2, 'momento', 'siempre').map((x) => x.id)).toEqual([siempre[1], siempre[0], ...siempre.slice(2)])
    expect(reglasDelGrupo(r2, 'area', 'cuerpo').map((x) => x.id)).toEqual(reglasDelGrupo(r, 'area', 'cuerpo').map((x) => x.id))
  })

  it('reglas viejas sin momento pasan a «siempre» (los ejemplos toman el suyo)', async () => {
    for (const x of await listarCodigo()) await db().codigo.put({ ...x, momento: undefined, ordenMomento: undefined })
    await sembrarCodigo()
    const r = await listarCodigo()
    expect(r.find((x) => x.texto === 'Rutina de skincare')!.momento).toBe('noche')
    expect(r.every((x) => x.momento && x.ordenMomento)).toBe(true)
  })

  it('exportar e importar incluye el código', async () => {
    await agregarRegla('Agua antes del café', 'cuidado', 'manana')
    const copia = await exportarTodo()
    await usarBaseDePruebas(`manga-imp-${n}`)
    await importarTodo(JSON.parse(JSON.stringify(copia)))
    expect((await listarCodigo()).find((x) => x.texto === 'Agua antes del café')).toMatchObject({ grupo: 'cuidado', momento: 'manana' })
  })
})
