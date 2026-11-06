import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { configResta, cuantoResta, restasDelDia, textoAvisoResta } from '../domain/resta'
import { totalXp } from '../domain/xp'
import { guardarAjustes, inicializarSiHaceFalta, obtenerAjustes } from './base'
import { iniciarCiclo } from './ciclo'
import { guardarContador, listarContadores, sumarToque } from './contadores'
import { cerrarDiasPendientes, completarCompromiso, corregirCompromiso, marcarExcepcion } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'
import { aplicarRestas, avisoRestaHoy, balanceDelDia, cambiarResta } from './restas'
import { concederXp, xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0

async function preparar(inicio: string, xpInicial = 100) {
  await usarBaseDePruebas(`restas-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(inicio, '08:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo(inicio)
  await cerrarDiasPendientes()
  if (xpInicial > 0) await concederXp({ clave: `manual:${inicio}`, cantidad: xpInicial, origen: 'manual', fecha: inicio, descripcion: 'XP de antes' })
}

const restasDe = async (fecha: string) => (await db().xp.where('fecha').equals(fecha).toArray()).filter((r) => r.origen === 'resta' && !r.anulado)
const cerrarAl = async (fecha: string) => { fijarAhora(instanteDe(fecha, '07:00', Z)); return cerrarDiasPendientes() }

describe('lo no cumplido resta (cuentas)', () => {
  it('la mitad, redondeada para arriba; el % se edita', () => {
    expect(cuantoResta(15, 50)).toBe(8)
    expect(cuantoResta(30, 50)).toBe(15)
    expect(cuantoResta(10, 25)).toBe(3)
    expect(cuantoResta(0, 50)).toBe(0)
  })
  it('nunca saca más de lo que hay (la XP no baja de 0)', () => {
    const cfg = { activa: true, porcentaje: 50, desde: '2026-11-01' }
    const f = [{ id: 'a', nombre: 'A', xp: 30, tipo: 'pilar' as const }, { id: 'b', nombre: 'B', xp: 20, tipo: 'pilar' as const }]
    expect(restasDelDia(f, cfg, '2026-11-02', 18).map((r) => r.cantidad)).toEqual([15, 3])
    expect(restasDelDia(f, cfg, '2026-11-02', 0)).toEqual([])
  })
  it('nunca hacia atrás: antes del día de inicio, o apagada, no resta', () => {
    const f = [{ id: 'a', nombre: 'A', xp: 30, tipo: 'pilar' as const }]
    expect(restasDelDia(f, { activa: true, porcentaje: 50, desde: '2026-11-05' }, '2026-11-04', 100)).toEqual([])
    expect(restasDelDia(f, { activa: false, porcentaje: 50, desde: '2026-11-01' }, '2026-11-04', 100)).toEqual([])
    expect(restasDelDia(f, { activa: true, porcentaje: 50, desde: null }, '2026-11-04', 100)).toEqual([])
  })
  it('viene prendida al 50 % y el aviso dice cuánto restaría', () => {
    expect(configResta({})).toEqual({ activa: true, porcentaje: 50, desde: null })
    expect(textoAvisoResta([{ id: 'a', nombre: 'A', xp: 15, tipo: 'pilar' }, { id: 'b', nombre: 'B', xp: 10, tipo: 'serie' }], 50)).toBe('Te quedan 2 sin hacer: −13 XP si no los hacés hoy')
    expect(textoAvisoResta([{ id: 'a', nombre: 'A', xp: 30, tipo: 'pilar' }], 50)).toBe('Te queda 1 sin hacer: −15 XP si no lo hacés hoy')
    expect(textoAvisoResta([], 50)).toBeNull()
  })
})

describe('lo no cumplido resta (al cerrar el día)', () => {
  beforeEach(async () => { await preparar('2026-11-02') })

  it('resta la mitad de cada pilar y serie sin hacer; la primera meta ya cubre', async () => {
    expect((await obtenerAjustes()).xpResta?.desde).toBe('2026-11-02')
    await completarCompromiso('empresa:2026-11-02')
    // Dibujar 15 min (primera meta, sin el extra de 30): cubierto.
    await completarCompromiso('manga:2026-11-02', { minutos: 15 })
    // Flexiones: la cuota (70) sin el extra (105): cubierto. Dominadas: nada.
    for (let i = 0; i < 5; i++) await sumarToque('flexiones')
    const antes = await xpTotal()
    expect(await cerrarAl('2026-11-03')).toEqual(['2026-11-02'])
    const r = await restasDe('2026-11-02')
    expect(r.map((x) => [x.descripcion, x.cantidad]).sort()).toEqual([
      ['Dominadas sin hacer', -5],
      ['Dormir a horario sin hacer', -10],
      ['Entrenamiento sin hacer', -15],
    ])
    // Al cerrar también entra «Respetar el límite de juego» (+15).
    expect(await xpTotal()).toBe(antes + 15 - 30)
    expect(await balanceDelDia('2026-11-02')).toEqual({ mas: 100 + 15 + 15 + 10 + 15, menos: 30 })
    // Cerrar otra vez no resta de nuevo.
    expect(await aplicarRestas('2026-11-02')).toBe(0)
    expect(await xpTotal()).toBe(antes + 15 - 30)
  })

  it('una corrección (lo hice) devuelve la resta', async () => {
    await cerrarAl('2026-11-03')
    const conResta = await xpTotal()
    await corregirCompromiso('entrenamiento:2026-11-02', 'completado', 'Me olvidé de marcarlo', 42)
    expect((await restasDe('2026-11-02')).some((x) => x.clave.includes('entrenamiento'))).toBe(false)
    expect(await xpTotal()).toBe(conResta + 15 + 30)
  })

  it('un día con excepción no resta', async () => {
    await marcarExcepcion('2026-11-02', 'Enfermo')
    await cerrarAl('2026-11-03')
    expect(await restasDe('2026-11-02')).toEqual([])
  })

  it('lo pausado (serie apagada) no resta', async () => {
    const dom = (await listarContadores()).find((c) => c.id === 'dominadas')!
    const { creado: _c, ...resto } = dom
    void _c
    await guardarContador({ ...resto, activo: false })
    await cerrarAl('2026-11-03')
    expect((await restasDe('2026-11-02')).some((x) => x.descripcion.startsWith('Dominadas'))).toBe(false)
  })

  it('el aviso de hoy cuenta lo pendiente', async () => {
    const a = await avisoRestaHoy('2026-11-02')
    expect(a?.faltantes.map((f) => f.nombre)).toEqual(expect.arrayContaining(['Entrenamiento', 'Dibujar manga', 'Avanzar en la empresa', 'Dormir a horario', 'Flexiones', 'Dominadas']))
    await completarCompromiso('empresa:2026-11-02')
    expect((await avisoRestaHoy('2026-11-02'))?.faltantes.some((f) => f.nombre === 'Avanzar en la empresa')).toBe(false)
  })
})

describe('lo no cumplido resta (casos de borde)', () => {
  it('descanso: el entrenamiento no resta el día que no toca', async () => {
    // 2026-11-08 es domingo: el entrenamiento descansa.
    await preparar('2026-11-08')
    await cerrarAl('2026-11-09')
    const r = await restasDe('2026-11-08')
    expect(r.some((x) => x.descripcion.startsWith('Entrenamiento'))).toBe(false)
    expect(r.length).toBeGreaterThan(0)
  })

  it('nunca baja de 0', async () => {
    await preparar('2026-11-02', 12)
    await cerrarAl('2026-11-03')
    expect(await xpTotal()).toBe(0)
    expect(totalXp(await db().xp.toArray())).toBe(0)
    // Se resta solo lo que había (12 + los 15 del límite de juego), no los 53 que tocaban.
    expect(await balanceDelDia('2026-11-02')).toEqual({ mas: 27, menos: 27 })
  })

  it('sin efecto hacia atrás: al prenderla, vale desde ese día', async () => {
    await preparar('2026-11-02')
    await cambiarResta({ activa: false }, '2026-11-02')
    await cerrarAl('2026-11-03')
    expect(await restasDe('2026-11-02')).toEqual([])
    // Se prende el 3: el día 2 (ya cerrado) no se toca; el 3 sí cuenta.
    await cambiarResta({ activa: true }, '2026-11-03')
    expect((await obtenerAjustes()).xpResta).toMatchObject({ activa: true, porcentaje: 50, desde: '2026-11-03' })
    await cerrarAl('2026-11-04')
    expect(await restasDe('2026-11-02')).toEqual([])
    expect((await restasDe('2026-11-03')).length).toBeGreaterThan(0)
  })

  it('el porcentaje se edita', async () => {
    await preparar('2026-11-02')
    await cambiarResta({ porcentaje: 100 }, '2026-11-02')
    await guardarAjustes({ xpResta: { ...(await obtenerAjustes()).xpResta, desde: '2026-11-02' } })
    await cerrarAl('2026-11-03')
    const ent = (await restasDe('2026-11-02')).find((x) => x.descripcion.startsWith('Entrenamiento'))
    expect(ent?.cantidad).toBe(-30)
  })
})
