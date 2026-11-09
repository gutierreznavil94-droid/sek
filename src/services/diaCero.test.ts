import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { estadoDelCiclo, iniciarCiclo, primerDia } from './ciclo'
import { cerrarDiasPendientes, completarCompromiso, compromisosDelDia } from './dia'
import { avanzar, fijarAhora, reiniciarReloj } from './reloj'
import { xpDelDia, xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0

// Día 0 = lun 2 nov a las 15:00; Día 1 = mar 3 nov.
beforeEach(async () => {
  await usarBaseDePruebas(`dia-cero-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-02', '15:00', Z))
  await inicializarSiHaceFalta()
  await guardarAjustes({ xpResta: { activa: true } })
  await iniciarCiclo('2026-11-03', { diaCero: true })
  await cerrarDiasPendientes()
})

describe('Día 0: calentamiento', () => {
  it('hoy es el Día 0 y mañana el Día 1', async () => {
    const c = (await db().ciclos.toArray())[0]
    expect(c.diaCero).toBe('2026-11-02')
    expect(primerDia(c)).toBe('2026-11-02')
    const e = await estadoDelCiclo('2026-11-02')
    expect(e?.dia).toBe(0)
    expect(e?.diaCero).toBe(true)
    expect(e?.noEmpezado).toBe(false)
    expect((await estadoDelCiclo('2026-11-03'))?.dia).toBe(1)
  })

  it('se registra y suma XP', async () => {
    const hoy = await compromisosDelDia('2026-11-02')
    expect(hoy.length).toBeGreaterThan(0)
    await completarCompromiso('acostarse:2026-11-02')
    expect((await xpDelDia('2026-11-02')).reduce((s, r) => s + r.cantidad, 0)).toBeGreaterThan(0)
  })

  it('al cerrarse no resta nada y lo no hecho desaparece', async () => {
    await completarCompromiso('acostarse:2026-11-02')
    const antes = await xpTotal()
    avanzar(24 * 60 * 60_000)
    await cerrarDiasPendientes()
    expect(await xpTotal()).toBe(antes)
    const quedan = await db().compromisos.where('fecha').equals('2026-11-02').toArray()
    expect(quedan.every((c) => c.estado !== 'omitido' && c.estado !== 'pendiente')).toBe(true)
    expect(quedan.some((c) => c.id === 'acostarse:2026-11-02')).toBe(true)
  })
})
