import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cuotaDelDia, deshacerUltimoToque, guardarContador, propuestaDeSubida, responderPropuesta, resumenContadores, sumarToque } from './contadores'
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
  it('la cuota da +10 y el extra (1,5 × cuota) da +10 más, cada uno una sola vez por día', async () => {
    const antes = await xpTotal()
    let r = await tocar(5) // 70
    expect(r.metaLograda).toBe(true)
    expect(r.extraLogrado).toBe(false)
    expect(await xpTotal()).toBe(antes + 10)
    r = await tocar(2) // 98
    expect(r.xp).toBe(0)
    r = await tocar(1) // 112 ≥ 105
    expect(r.extraLogrado).toBe(true)
    expect(r.xpExtra).toBe(10)
    expect(await xpTotal()).toBe(antes + 20)
    r = await tocar(2) // 140: sigue sumando para el récord, sin más XP
    expect(r.xp).toBe(0)
    expect(await xpTotal()).toBe(antes + 20)
  })

  it('deshacer por debajo del extra quita ese XP y volver a llegar no lo duplica', async () => {
    const antes = await xpTotal()
    await tocar(8) // 112
    expect(await xpTotal()).toBe(antes + 20)
    await deshacerUltimoToque('flexiones') // 98
    expect(await xpTotal()).toBe(antes + 10)
    await tocar(1) // 112 otra vez
    expect(await xpTotal()).toBe(antes + 20)
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

  it('propone subir la cuota tras 3 días cumplidos; «todavía no» espera 3 días; «sí» sube y recalcula el extra', async () => {
    for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) { dia(f); await tocar(5) }
    dia('2026-11-04')
    expect(await propuestaDeSubida(await flex(), '2026-11-04')).toBeNull() // hoy todavía no terminó
    dia('2026-11-05')
    const p = await propuestaDeSubida(await flex(), '2026-11-05')
    expect(p).toMatchObject({ de: 70, a: 75, extra: 113 })
    await responderPropuesta('flexiones', false)
    expect((await flex()).metaDiaria).toBe(70) // nunca sube sola
    for (const f of ['2026-11-05', '2026-11-06', '2026-11-07']) { dia(f); await tocar(5) }
    dia('2026-11-07')
    expect(await propuestaDeSubida(await flex(), '2026-11-07')).toBeNull()
    dia('2026-11-08')
    expect(await propuestaDeSubida(await flex(), '2026-11-08')).not.toBeNull()
    await responderPropuesta('flexiones', true)
    const c = await flex()
    expect(c.metaDiaria).toBe(75)
    expect(c.metaExtra).toBe(113)
    expect(cuotaDelDia(c, '2026-11-07').cuota).toBe(70)
    expect(await propuestaDeSubida(c, '2026-11-08')).toBeNull()
  })

  it('no propone si algún día de los últimos 3 no llegó a la cuota', async () => {
    dia('2026-11-02'); await tocar(5)
    dia('2026-11-03'); await tocar(4)
    dia('2026-11-04'); await tocar(5)
    dia('2026-11-05')
    expect(await propuestaDeSubida(await flex(), '2026-11-05')).toBeNull()
  })
})
