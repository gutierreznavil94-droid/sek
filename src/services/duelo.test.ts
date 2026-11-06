import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { guardarContador, listarContadores, totalDelDia } from './contadores'
import { anotarDuelo, configDuelo, repsDuelo } from './duelo'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0

describe('duelo: cuántas flexiones pide', () => {
  it('la serie tal cual; la caída pide la serie más la mitad', () => {
    expect(repsDuelo(10, 'rival')).toBe(10)
    expect(repsDuelo(14, 'tension')).toBe(14)
    expect(repsDuelo(10, 'caida')).toBe(15)
    expect(repsDuelo(15, 'caida')).toBe(23)
  })
  it('sin serie rápida de flexiones: 10, o lo que se edite', () => {
    expect(repsDuelo(null, 'rival')).toBe(10)
    expect(repsDuelo(0, 'caida')).toBe(15)
    expect(repsDuelo(undefined, 'tension', 8)).toBe(8)
  })
})

describe('duelo: cuenta como una serie hecha', () => {
  beforeEach(async () => {
    await usarBaseDePruebas(`duelo-${++n}`)
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-02')
  })

  it('pide la serie de flexiones (14) y la anota en el contador', async () => {
    const c = await configDuelo('rival')
    expect(c.contador?.id).toBe('flexiones')
    expect(c.reps).toBe(14)
    await anotarDuelo(c)
    expect(await totalDelDia('flexiones', '2026-11-02')).toBe(14)
  })

  it('después de «No cumplí» pide 14 + 7 = 21', async () => {
    expect((await configDuelo('caida')).reps).toBe(21)
  })

  it('cinco duelos llegan a la cuota y dan su XP, como cargarlas a mano', async () => {
    const antes = await xpTotal()
    const c = await configDuelo('tension')
    for (let i = 0; i < 5; i++) await anotarDuelo(c)
    expect(await totalDelDia('flexiones', '2026-11-02')).toBe(70)
    expect(await xpTotal()).toBe(antes + 10)
  })

  it('sin contador de flexiones usa las reps editables y no anota nada', async () => {
    for (const x of await listarContadores()) { const { creado: _c, ...r } = x; void _c; await guardarContador({ ...r, activo: false }) }
    await guardarAjustes({ batalla: { repsSinSerie: 12 } })
    const c = await configDuelo('rival')
    expect(c.contador).toBeNull()
    expect(c.reps).toBe(12)
    expect(await anotarDuelo(c)).toEqual({ xp: 0, nuevoNivel: null })
  })
})
