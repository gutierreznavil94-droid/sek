import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cuotaDelDia, extraPorDefecto, repsDelDia, seriesDe, deshacerUltimoToque, guardarContador, propuestaDeSubida, responderPropuesta, resumenContadores, sumarToque } from './contadores'
import { exportarTodo, importarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0
const dia = (f: string) => fijarAhora(instanteDe(f, '10:00', Z))
const flex = async () => (await db().contadores.get('flexiones'))!

async function tocar(veces: number) {
  let r
  for (let i = 0; i < veces; i++) r = await sumarToque('flexiones')
  return r!
}

beforeEach(async () => {
  await usarBaseDePruebas(`cuotas-${++n}`)
  reiniciarReloj()
  dia('2026-11-02')
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

describe('series con cuota y extra', () => {
  it('la cuota da +10 y el extra (1,5 × cuota) da +5 más, cada uno una sola vez por día', async () => {
    const antes = await xpTotal()
    let r = await tocar(5) // 70
    expect(r.metaLograda).toBe(true)
    expect(r.extraLogrado).toBe(false)
    expect(await xpTotal()).toBe(antes + 10)
    r = await tocar(2) // 98
    expect(r.xp).toBe(0)
    r = await tocar(1) // 112 ≥ 105
    expect(r.extraLogrado).toBe(true)
    expect(r.xpExtra).toBe(5)
    expect(await xpTotal()).toBe(antes + 15)
    r = await tocar(2) // 140: sigue sumando para el récord, sin más XP
    expect(r.xp).toBe(0)
    expect(await xpTotal()).toBe(antes + 15)
  })

  it('deshacer por debajo del extra quita ese XP y volver a llegar no lo duplica', async () => {
    const antes = await xpTotal()
    await tocar(8) // 112
    expect(await xpTotal()).toBe(antes + 15)
    await deshacerUltimoToque('flexiones') // 98
    expect(await xpTotal()).toBe(antes + 10)
    await tocar(1) // 112 otra vez
    expect(await xpTotal()).toBe(antes + 15)
    for (let i = 0; i < 3; i++) await deshacerUltimoToque('flexiones') // 70
    expect(await xpTotal()).toBe(antes + 10)
    await deshacerUltimoToque('flexiones') // 56
    expect(await xpTotal()).toBe(antes)
  })

  it('cambiar la cuota vale desde hoy: los días pasados conservan la suya', async () => {
    await tocar(5) // 70 el día 1
    dia('2026-11-03')
    const c = await flex()
    const { creado: _c, ...resto } = c
    void _c
    await guardarContador({ ...resto, metaDiaria: 80, metaExtra: 120 })
    const nuevo = await flex()
    expect(cuotaDelDia(nuevo, '2026-11-02')).toEqual({ cuota: 70, extra: 105 })
    expect(cuotaDelDia(nuevo, '2026-11-03')).toEqual({ cuota: 80, extra: 120 })
    const res = (await resumenContadores('2026-11-03')).find((x) => x.contador.id === 'flexiones')!
    expect(res.diasConMeta).toBe(1)
    expect(res.cuotaHoy).toBe(80)
    expect(res.subidas.map((x) => x.cuota)).toEqual([70, 80])
    const r = await tocar(5) // 70 hoy ya no alcanza
    expect(r.metaLograda).toBe(false)
  })

  it('propone subir las reps por serie tras 3 días cumplidos; «todavía no» espera 3 días; «sí» sube reps, cuota y extra', async () => {
    for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) { dia(f); await tocar(5) }
    dia('2026-11-04')
    expect(await propuestaDeSubida(await flex(), '2026-11-04')).toBeNull() // hoy todavía no terminó
    dia('2026-11-05')
    const p = await propuestaDeSubida(await flex(), '2026-11-05')
    expect(p).toMatchObject({ de: 14, a: 15, series: 5, cuota: 75, extra: 113 })
    await responderPropuesta('flexiones', false)
    expect((await flex()).metaDiaria).toBe(70) // nunca sube sola
    for (const f of ['2026-11-05', '2026-11-06', '2026-11-07']) { dia(f); await tocar(5) }
    dia('2026-11-07')
    expect(await propuestaDeSubida(await flex(), '2026-11-07')).toBeNull()
    dia('2026-11-08')
    expect(await propuestaDeSubida(await flex(), '2026-11-08')).not.toBeNull()
    await responderPropuesta('flexiones', true)
    const c = await flex()
    expect(c.cantidadPorToque).toBe(15)
    expect(c.seriesPorDia).toBe(5)
    expect(c.metaDiaria).toBe(75)
    expect(c.metaExtra).toBe(113)
    expect(cuotaDelDia(c, '2026-11-07').cuota).toBe(70)
    expect(repsDelDia(c, '2026-11-07')).toBe(14)
    expect(repsDelDia(c, '2026-11-08')).toBe(15)
    expect(await propuestaDeSubida(c, '2026-11-08')).toBeNull()
    // Cada toque suma la serie nueva: 5 toques = 75 = cuota
    const r = await tocar(5)
    expect(r.registro.cantidad).toBe(15)
    expect(r.total).toBe(75)
    expect(r.metaLograda).toBe(true)
    const res = (await resumenContadores('2026-11-08')).find((x) => x.contador.id === 'flexiones')!
    expect(res.escalonesReps.map((x) => x.reps)).toEqual([14, 15])
    expect(res.escalonesReps[1].desde).toBe('2026-11-08')
    expect(res.diasCiclo).toHaveLength(7)
    expect(res.diasCiclo[0]).toMatchObject({ fecha: '2026-11-02', total: 70, cuota: 70, extra: 105, reps: 14 })
    expect(res.diasCiclo[6]).toMatchObject({ fecha: '2026-11-08', total: 75, cuota: 75, reps: 15 })
  })

  it('con «cuota a mano» la propuesta sube solo las reps: la cuota y el extra quedan fijos', async () => {
    const c0 = await flex()
    const { creado: _c, ...resto } = c0
    void _c
    await guardarContador({ ...resto, cuotaAMano: true, metaDiaria: 60, metaExtra: 90 })
    expect((await flex()).metaDiaria).toBe(60)
    for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) { dia(f); await tocar(5) }
    dia('2026-11-05')
    expect(await propuestaDeSubida(await flex(), '2026-11-05')).toMatchObject({ de: 14, a: 15, cuota: 60, extra: 90 })
    await responderPropuesta('flexiones', true)
    const c = await flex()
    expect(c.cantidadPorToque).toBe(15)
    expect(c.metaDiaria).toBe(60)
    expect(c.metaExtra).toBe(90)
    expect(c.cuotaAMano).toBe(true)
    const res = (await resumenContadores('2026-11-05')).find((x) => x.contador.id === 'flexiones')!
    expect(res.escalonesReps.map((x) => [x.reps, x.cuota]).slice(-2)).toEqual([[14, 60], [15, 60]])
  })

  it('dominadas también suben de a 1 rep por serie', async () => {
    for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) { dia(f); for (let i = 0; i < 5; i++) await sumarToque('dominadas') }
    dia('2026-11-05')
    const dom = (await db().contadores.get('dominadas'))!
    expect(await propuestaDeSubida(dom, '2026-11-05')).toMatchObject({ de: 7, a: 8, cuota: 40, extra: 60 })
  })

  it('editar a mano reps y series recalcula la cuota y el extra; datos viejos sin series migran a 5', async () => {
    const viejo = await flex()
    const { creado: _c, seriesPorDia: _s, ...resto } = viejo
    void _c; void _s
    await db().contadores.put({ ...viejo, seriesPorDia: undefined })
    expect(seriesDe(await flex())).toBe(5)
    dia('2026-11-03')
    await guardarContador({ ...resto, cantidadPorToque: 16, seriesPorDia: 6, metaDiaria: 96, metaExtra: extraPorDefecto(96) })
    const c = await flex()
    expect(c.metaDiaria).toBe(96)
    expect(c.metaExtra).toBe(144)
    expect(cuotaDelDia(c, '2026-11-02')).toEqual({ cuota: 70, extra: 105 })
    expect(c.proximaPropuesta).toBe('2026-11-06')
  })

  it('exportar e importar conserva reps por serie, series y su historial', async () => {
    await responderPropuesta('flexiones', true)
    const copia = await exportarTodo()
    await usarBaseDePruebas(`cuotas-imp-${n}`)
    await importarTodo(JSON.parse(JSON.stringify(copia)))
    const c = await flex()
    expect(c.cantidadPorToque).toBe(15)
    expect(c.seriesPorDia).toBe(5)
    expect(c.historialCuota?.map((x) => x.porToque)).toEqual([14, 15])
  })

  it('no propone si algún día de los últimos 3 no llegó a la cuota', async () => {
    dia('2026-11-02'); await tocar(5)
    dia('2026-11-03'); await tocar(4)
    dia('2026-11-04'); await tocar(5)
    dia('2026-11-05')
    expect(await propuestaDeSubida(await flex(), '2026-11-05')).toBeNull()
  })
})
