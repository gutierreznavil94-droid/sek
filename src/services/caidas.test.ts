import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta, obtenerAjustes } from './base'
import { caidasDelDia, caidasPorDia, deshacerCaida, registrarCaida, todasLasCaidas, xpCaidaDe, xpQueSaca, XP_CAIDA_POR_DEFECTO } from './caidas'
import { iniciarCiclo } from './ciclo'
import { exportarTodo } from './exportar'
import { fijarAhora, reiniciarReloj } from './reloj'
import { concederXp, xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-05'
let n = 0
beforeEach(async () => {
  await usarBaseDePruebas(`caidas-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(HOY, '21:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

describe('caída y nuevo round', () => {
  it('saca 20 XP por defecto, editable, y nunca deja el total por debajo de 0', async () => {
    expect(xpCaidaDe(await obtenerAjustes())).toBe(XP_CAIDA_POR_DEFECTO)
    expect(xpCaidaDe({ caida: { xp: 35 } })).toBe(35)
    expect(xpCaidaDe({ caida: { xp: -3 } })).toBe(0)
    expect(xpQueSaca(12, 20)).toBe(12)
    expect(xpQueSaca(0, 20)).toBe(0)
  })

  it('guarda la marca del día y resta la XP; deshacer devuelve todo', async () => {
    await concederXp({ clave: 'manual:x', cantidad: 50, origen: 'manual', fecha: HOY, descripcion: 'prueba' })
    const antes = await xpTotal()
    const c = await registrarCaida(HOY, 'boton')
    expect(c.xp).toBe(20)
    expect(await xpTotal()).toBe(antes - 20)
    expect((await caidasDelDia(HOY)).map((x) => x.id)).toEqual([c.id])
    expect((await caidasPorDia('2026-11-01', HOY)).get(HOY)).toBe(1)
    expect((await exportarTodo()).tablas.caidas).toHaveLength(1)
    expect(await deshacerCaida(c.id)).toBe(true)
    expect(await xpTotal()).toBe(antes)
    expect(await todasLasCaidas()).toHaveLength(0)
  })

  it('con poca XP saca solo lo que hay y la marca igual queda', async () => {
    await guardarAjustes({ caida: { xp: 40 } })
    const total = await xpTotal()
    const c = await registrarCaida(HOY, 'tension')
    expect(c.xp).toBe(Math.min(40, total))
    expect(await xpTotal()).toBe(total - c.xp)
    expect(await todasLasCaidas()).toHaveLength(1)
  })
})
