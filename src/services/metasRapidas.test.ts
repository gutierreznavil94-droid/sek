import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes } from './dia'
import { exportarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'
import { crearMeta, crearMetaRapida, cumplirMeta, resolverMeta, desmarcarMeta, estadoEnDia, estadoVisible, graficoMetas, lineaDeMetas, metasPorDia, XP_META_RAPIDA } from './metas'

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

  it('cumplida antes de tiempo: queda el día que se marcó, con el XP y el sello ese día; en su fecha dice cumplida el…', async () => {
    const m = await crearMetaRapida('2026-11-05', 'Entregar el dibujo', '2026-11-02')
    const antes = await xpTotal()
    const r = await cumplirMeta(m.id) // hoy es el 2
    expect(r.xp).toBe(XP_META_RAPIDA)
    expect(await xpTotal()).toBe(antes + XP_META_RAPIDA)
    const g = (await db().metas.get(m.id))!
    expect(g.cumplidaEl).toBe('2026-11-02')
    expect(g.fecha).toBe('2026-11-05') // la fecha original no se mueve
    expect((await db().xp.where('fecha').equals('2026-11-02').toArray()).some((x) => x.origen === 'meta' && !x.anulado)).toBe(true)
    expect((await db().xp.where('fecha').equals('2026-11-05').toArray()).some((x) => x.origen === 'meta' && !x.anulado)).toBe(false)
    // Aparece los dos días: sello el 2, «adelantada» el 5
    const porDia = await metasPorDia('2026-11-01', '2026-11-08')
    expect(porDia.get('2026-11-02')?.map((x) => x.id)).toEqual([m.id])
    expect(porDia.get('2026-11-05')?.map((x) => x.id)).toEqual([m.id])
    expect(estadoEnDia(g, '2026-11-02', '2026-11-02')).toBe('cumplida')
    expect(estadoEnDia(g, '2026-11-05', '2026-11-02')).toBe('adelantada')
    expect(lineaDeMetas([g], '2026-11-02', '2026-11-02')).toBe('verde')
    expect(lineaDeMetas([g], '2026-11-02', '2026-11-05')).toBeNull()
    // El gráfico la cuenta una sola vez, el día real
    const graf = await graficoMetas('2026-11-01', '2026-11-08', '2026-11-06')
    expect(graf.cumplidas).toBe(1)
    expect(graf.puestas).toBe(1)
    expect(graf.porDia.get('2026-11-02')).toMatchObject({ cumplidas: 1 })
    expect(graf.porDia.get('2026-11-05')).toMatchObject({ cumplidas: 0, noCumplidas: 0, pendientes: 0 })
    // El tope de 2 por día cuenta en el día que se marcó
    await cumplirMeta((await crearMetaRapida('2026-11-06', 'Otra', '2026-11-02')).id)
    const tercera = await cumplirMeta((await crearMetaRapida('2026-11-07', 'Tercera', '2026-11-02')).id)
    expect(tercera.conTope).toBe(true)
    // Desmarcar la devuelve a su día
    await desmarcarMeta(m.id)
    expect((await db().metas.get(m.id))!.cumplidaEl).toBeUndefined()
    expect(((await metasPorDia('2026-11-02', '2026-11-02')).get('2026-11-02') ?? []).map((x) => x.id)).not.toContain(m.id)
  })

  it('cumplida en su fecha: cumplidaEl es la misma fecha y no se duplica', async () => {
    const m = await crearMetaRapida('2026-11-02', 'Hoy mismo', '2026-11-02')
    await cumplirMeta(m.id)
    const g = (await db().metas.get(m.id))!
    expect(g.cumplidaEl).toBe('2026-11-02')
    expect((await metasPorDia('2026-11-01', '2026-11-08')).get('2026-11-02')).toHaveLength(1)
  })

  it('exportar incluye las metas', async () => {
    await crearMetaRapida('2026-11-03', 'Exportada', '2026-11-02')
    const json = JSON.stringify(await exportarTodo())
    expect(json).toContain('Exportada')
  })
})
