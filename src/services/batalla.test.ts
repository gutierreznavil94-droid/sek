import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { TOPE_BATALLAS_DIA, configBatalla, objetivoBatalla, prepararBatalla, puedeBatallar, rendirse, selloBatalla, terminarBatalla } from './batalla'
import { resumenContadores } from './contadores'
import { ninjasVencidosSemana, peleasDelDia } from './ninjas'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-02'
let n = 0
beforeEach(async () => {
  await usarBaseDePruebas(`batalla-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(HOY, '19:25', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo(HOY)
})

describe('batalla contra la distracción', () => {
  it('objetivo según el contador: reps por serie redondeadas a múltiplo de 5; sin contador, 15', () => {
    expect(objetivoBatalla(14)).toBe(15)
    expect(objetivoBatalla(15)).toBe(15)
    expect(objetivoBatalla(16)).toBe(20)
    expect(objetivoBatalla(null)).toBe(15)
    expect(objetivoBatalla(0)).toBe(15)
    expect(objetivoBatalla(14, 10)).toBe(20)
    expect(objetivoBatalla(3, 5)).toBe(5)
  })

  it('usa el contador de flexiones salvo que se elija otro; reps por toque editables', async () => {
    const c = await configBatalla()
    expect(c.activa).toBe(true)
    expect(c.contador?.id).toBe('flexiones')
    expect(c.objetivo).toBe(objetivoBatalla((await db().contadores.get('flexiones'))!.cantidadPorToque))
    expect(c.rondas).toBe(c.objetivo / 5)
    await guardarAjustes({ batalla: { contadorId: 'dominadas', repsPorToque: 2 } })
    const d = await configBatalla()
    expect(d.contador?.id).toBe('dominadas')
    expect(d.repsPorToque).toBe(2)
    expect(d.objetivo % 2).toBe(0)
  })

  it('la victoria anota una sola serie en el contador con las reps del objetivo y el sello del día', async () => {
    const r = await prepararBatalla(HOY, undefined, () => 0)
    expect(r.batalla).toBeTruthy()
    const flex = async () => (await resumenContadores(HOY)).find((x) => x.contador.id === 'flexiones')!
    const antes = await flex()
    const res = await terminarBatalla(r.batalla!)
    expect(res.reps).toBe(r.batalla!.config.objetivo)
    const despues = await flex()
    expect(despues.hoy).toBe(antes.hoy + res.reps)
    expect(despues.toquesHoy).toBe(antes.toquesHoy + 1)
    const peleas = await peleasDelDia(HOY)
    expect(peleas).toHaveLength(1)
    expect(peleas[0]).toMatchObject({ momento: 'batalla', resultado: 'vencido', reps: res.reps })
    expect(selloBatalla('Celu', peleas[0])).toBe(`Venciste a Celu con ${res.reps} flexiones`)
    expect((await ninjasVencidosSemana(HOY)).vencidos).toBe(1)
  })

  it('rendirse no anota nada: el ninja se escapó, sin XP negativo', async () => {
    const r = await prepararBatalla(HOY)
    const antes = (await resumenContadores(HOY)).find((x) => x.contador.id === 'flexiones')!.hoy
    const p = await rendirse(r.batalla!)
    expect(p).toMatchObject({ momento: 'batalla', resultado: 'escapo' })
    expect(p.reps).toBeUndefined()
    expect((await resumenContadores(HOY)).find((x) => x.contador.id === 'flexiones')!.hoy).toBe(antes)
    expect(selloBatalla('Celu', p)).toBe('Celu se escapó')
  })

  it('tope de 3 batallas por día (vencidas o rendidas); no cuentan para el tope de los ninjas automáticos', async () => {
    for (let i = 0; i < TOPE_BATALLAS_DIA; i++) {
      const r = await prepararBatalla(HOY)
      expect(r.batalla).toBeTruthy()
      await (i % 2 ? rendirse(r.batalla!) : terminarBatalla(r.batalla!))
    }
    expect(await puedeBatallar(HOY)).toEqual({ puede: false, hechas: 3, tope: 3 })
    const r = await prepararBatalla(HOY)
    expect(r.batalla).toBeUndefined()
    expect(r.motivo).toContain('Batallas hoy: 3 de 3')
    // Mañana vuelve a poder
    expect((await puedeBatallar('2026-11-03')).puede).toBe(true)
  })

  it('apagada en ajustes o sin ninjas: no arranca y dice por qué', async () => {
    await guardarAjustes({ batalla: { activa: false } })
    expect((await prepararBatalla(HOY)).motivo).toContain('apagada')
    await guardarAjustes({ batalla: { activa: true }, ninjas: false })
    expect((await prepararBatalla(HOY)).motivo).toContain('apagados')
  })
})
