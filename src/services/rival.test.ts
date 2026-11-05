import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { nivelDesdeXp, xpParaNivel } from '../domain/niveles'
import { guardarAjustes, inicializarSiHaceFalta, obtenerAjustes } from './base'
import { iniciarCiclo } from './ciclo'
import { DISTRACCIONES_MUESTRA, peleasDelDia, type Pelea } from './ninjas'
import { fijarAhora, reiniciarReloj } from './reloj'
import { ESCAPES_MAX, XP_ROBO_POR_DEFECTO, guardarRivalPendiente, limpiarRivalPendiente, modoRival, peleaPendiente, rivalPendiente, roboPosible, robarXp, selloRobo, sortearEscapes, xpRoboDe } from './rival'
import { concederXp, xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-02'
const PELEA: Pelea = { fecha: HOY, distraccion: DISTRACCIONES_MUESTRA[2], momento: { momento: 'pilar', pilar: { id: 'manga', nombre: 'Dibujar manga' } } }
let n = 0
beforeEach(async () => {
  await usarBaseDePruebas(`rival-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(HOY, '19:25', Z))
  localStorage.clear()
  await inicializarSiHaceFalta()
  await iniciarCiclo(HOY)
})

describe('rival escurridizo', () => {
  it('sorteo: 50 % lo atrapan al primer toque, 35 % se escabulle una vez, 15 % dos; nunca más de 2', () => {
    expect(sortearEscapes(() => 0)).toBe(0)
    expect(sortearEscapes(() => 0.49)).toBe(0)
    expect(sortearEscapes(() => 0.5)).toBe(1)
    expect(sortearEscapes(() => 0.84)).toBe(1)
    expect(sortearEscapes(() => 0.85)).toBe(2)
    expect(sortearEscapes(() => 0.999)).toBe(2)
    const cuentas = [0, 0, 0]
    let i = 0
    for (; i < 10000; i++) cuentas[sortearEscapes(() => (i + 0.5) / 10000)]++
    expect(cuentas[0]).toBe(5000)
    expect(cuentas[1]).toBe(3500)
    expect(cuentas[2]).toBe(1500)
    expect(Math.max(...[0, 0.3, 0.6, 0.9, 1].map((r) => sortearEscapes(() => r)))).toBeLessThanOrEqual(ESCAPES_MAX)
  })

  it('ajustes: escurridizo por defecto, XP del robo 10 y acotado a 0..30', async () => {
    const a = await obtenerAjustes()
    expect(modoRival(a)).toBe('escurridizo')
    expect(xpRoboDe(a)).toBe(XP_ROBO_POR_DEFECTO)
    expect(xpRoboDe({ rival: { xpRobo: 55 } })).toBe(30)
    expect(xpRoboDe({ rival: { xpRobo: -4 } })).toBe(0)
    expect(modoRival({ rival: { modo: 'carta' } })).toBe('carta')
  })

  it('el robo descuenta 10 XP del total y queda el sello del día', async () => {
    await concederXp({ clave: 'prueba:1', cantidad: 40, origen: 'manual', fecha: HOY, descripcion: 'de prueba' })
    const antes = await xpTotal()
    const r = await robarXp(PELEA)
    expect(r.robado).toBe(10)
    expect(await xpTotal()).toBe(antes - 10)
    const peleas = await peleasDelDia(HOY)
    expect(peleas).toHaveLength(1)
    expect(peleas[0]).toMatchObject({ momento: 'pilar', resultado: 'escapo', robo: 10, pilar: 'manga' })
    expect(selloRobo('Pereza', peleas[0])).toBe('Pereza se llevó 10 XP')
  })

  it('nunca baja de nivel: solo se lleva lo que sobra desde el inicio del nivel', async () => {
    const a = await obtenerAjustes()
    const base = a.baseNivel
    const inicioNivel2 = xpParaNivel(2, base)
    expect(roboPosible(inicioNivel2 + 3, 10, base)).toBe(3)
    expect(roboPosible(inicioNivel2, 10, base)).toBe(0)
    expect(roboPosible(inicioNivel2 + 25, 10, base)).toBe(10)
    // Con 3 XP por encima del inicio del nivel 2, roba 3 y el nivel sigue siendo 2.
    await concederXp({ clave: 'prueba:2', cantidad: inicioNivel2 + 3 - (await xpTotal()), origen: 'manual', fecha: HOY, descripcion: 'de prueba' })
    const r = await robarXp(PELEA)
    expect(r.robado).toBe(3)
    expect(nivelDesdeXp(await xpTotal(), base)).toBe(2)
    expect(await xpTotal()).toBe(inicioNivel2)
    // Sin sobrante: no roba nada, pero el sello del escape queda igual.
    const r2 = await robarXp(PELEA)
    expect(r2.robado).toBe(0)
    expect((await peleasDelDia(HOY))[1].robo).toBeUndefined()
    expect(await xpTotal()).toBe(inicioNivel2)
  })

  it('XP del robo editable', async () => {
    await concederXp({ clave: 'prueba:3', cantidad: 60, origen: 'manual', fecha: HOY, descripcion: 'de prueba' })
    await guardarAjustes({ rival: { xpRobo: 25 } })
    const antes = await xpTotal()
    const r = await robarXp(PELEA)
    expect(r.pedido).toBe(25)
    expect(await xpTotal()).toBe(antes - r.robado)
  })

  it('rival pendiente: queda guardado al cerrar la app y se reconstruye con su distracción', async () => {
    expect(rivalPendiente()).toBeNull()
    guardarRivalPendiente(PELEA)
    const x = rivalPendiente()
    expect(x).toMatchObject({ fecha: HOY, distraccionId: 'pereza', momento: 'pilar', pilar: { id: 'manga' } })
    const p = await peleaPendiente()
    expect(p?.distraccion.nombre).toBe('Pereza')
    expect(p?.momento.pilar?.nombre).toBe('Dibujar manga')
    limpiarRivalPendiente()
    expect(rivalPendiente()).toBeNull()
    expect(await peleaPendiente()).toBeNull()
  })
})
