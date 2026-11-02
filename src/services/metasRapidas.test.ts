import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes } from './dia'
import { exportarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'
import { crearMeta, crearMetaRapida, cumplirMeta, resolverMeta, desmarcarMeta, estadoVisible, graficoMetas, lineaDeMetas, metasPorDia, XP_META_RAPIDA } from './metas'

const Z = 'America/Argentina/Cordoba'
let n = 0
beforeEach(async () => {
  await usarBaseDePruebas(`metas-rapidas-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-02', '08:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
  await cerrarDiasPendientes()
})

describe('metas rápidas por día', () => {
  it('crear: hoy y días futuros sí, días pasados no', async () => {
    await crearMetaRapida('2026-11-02', 'Terminar la página 3', '2026-11-02')
    await crearMetaRapida('2026-11-05', 'Correr 5 km', '2026-11-02')
    await expect(crearMetaRapida('2026-11-01', 'Tarde', '2026-11-02')).rejects.toThrow()
    const m = await metasPorDia('2026-11-01', '2026-11-08')
    expect(m.get('2026-11-02')?.[0].titulo).toBe('Terminar la página 3')
    expect(m.get('2026-11-05')?.[0].xp).toBe(XP_META_RAPIDA)
  })

  it('cumplir da +15 XP una sola vez; desmarcar lo quita sin duplicar', async () => {
    const meta = await crearMetaRapida('2026-11-02', 'Página 3', '2026-11-02')
    const base = await xpTotal()
    expect((await cumplirMeta(meta.id)).xp).toBe(15)
    expect(await xpTotal()).toBe(base + 15)
    await cumplirMeta(meta.id) // otra vez: no duplica
    expect(await xpTotal()).toBe(base + 15)
    await desmarcarMeta(meta.id)
    expect(await xpTotal()).toBe(base)
    await cumplirMeta(meta.id) // volver a marcar: otra vez +15, no +30
    expect(await xpTotal()).toBe(base + 15)
    expect(estadoVisible((await db().metas.get(meta.id))!, '2026-11-02')).toBe('cumplida')
  })

  it('tope: solo 2 metas por día dan XP', async () => {
    const base = await xpTotal()
    const ids = []
    for (let i = 0; i < 3; i++) ids.push((await crearMetaRapida('2026-11-02', `Meta ${i}`, '2026-11-02')).id)
    for (const id of ids.slice(0, 2)) expect((await cumplirMeta(id)).xp).toBe(15)
    const tercera = await cumplirMeta(ids[2])
    expect(tercera.xp).toBe(0)
    expect(tercera.conTope).toBe(true)
    expect((await db().metas.get(ids[2]))!.estado).toBe('cumplida')
    expect(await xpTotal()).toBe(base + 30)
    // Si se desmarca una con XP, la tercera puede dar XP al volver a marcarla
    await desmarcarMeta(ids[0])
    await desmarcarMeta(ids[2])
    expect((await cumplirMeta(ids[2])).xp).toBe(15)
    expect(await xpTotal()).toBe(base + 30)
  })

  it('el tope vale también para las metas del calendario (15 XP por defecto)', async () => {
    const base = await xpTotal()
    const a = await crearMetaRapida('2026-11-02', 'Rápida', '2026-11-02')
    const b = await crearMeta({ titulo: 'Del calendario 1', fecha: '2026-11-02' })
    const c = await crearMeta({ titulo: 'Del calendario 2', fecha: '2026-11-02' })
    expect(b.xp).toBe(15)
    expect((await cumplirMeta(a.id)).xp).toBe(15)
    expect((await resolverMeta(b.id, true)).xp).toBe(15)
    const r = await resolverMeta(c.id, true)
    expect(r.xp).toBe(0)
    expect(r.conTope).toBe(true)
    expect(r.meta.estado).toBe('cumplida')
    expect(await xpTotal()).toBe(base + 30)
  })

  it('un día que pasa sin marcar queda no cumplida, y se puede marcar después', async () => {
    const meta = await crearMetaRapida('2026-11-02', 'Página 3', '2026-11-02')
    expect(estadoVisible(meta, '2026-11-02')).toBe('pendiente')
    expect(estadoVisible(meta, '2026-11-03')).toBe('no_cumplida')
    expect(lineaDeMetas([meta], '2026-11-02')).toBe('gris')
    expect(lineaDeMetas([meta], '2026-11-03')).toBe('roja')
    await cumplirMeta(meta.id)
    expect(lineaDeMetas([(await db().metas.get(meta.id))!], '2026-11-03')).toBe('verde')
  })

  it('línea verde con al menos una cumplida aunque otra no', async () => {
    const a = await crearMetaRapida('2026-11-02', 'A', '2026-11-02')
    const b = await crearMetaRapida('2026-11-02', 'B', '2026-11-02')
    await cumplirMeta(a.id)
    const metas = (await metasPorDia('2026-11-02', '2026-11-02')).get('2026-11-02')!
    expect(metas.map((m) => m.id).sort()).toEqual([a.id, b.id].sort())
    expect(lineaDeMetas(metas, '2026-11-03')).toBe('verde')
  })

  it('gráfico: cumplidas, no cumplidas y pendientes por día', async () => {
    const a = await crearMetaRapida('2026-11-02', 'A', '2026-11-02')
    await crearMetaRapida('2026-11-02', 'B', '2026-11-02')
    await crearMetaRapida('2026-11-04', 'C', '2026-11-02')
    await cumplirMeta(a.id)
    const g = await graficoMetas('2026-11-02', '2026-11-08', '2026-11-03')
    expect(g.cumplidas).toBe(1)
    expect(g.puestas).toBe(3)
    expect(g.porDia.get('2026-11-02')).toMatchObject({ cumplidas: 1, noCumplidas: 1, pendientes: 0 })
    expect(g.porDia.get('2026-11-04')).toMatchObject({ pendientes: 1 })
  })

  it('exportar incluye las metas', async () => {
    await crearMetaRapida('2026-11-03', 'Exportada', '2026-11-02')
    const json = JSON.stringify(await exportarTodo())
    expect(json).toContain('Exportada')
  })
})
