import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { diaDelCiclo, fechaDelDiaDelCiclo, fechaLegible, instanteDe } from '../domain/fechas'
import { alarmasDelDia, alarmasProximas, programarAlarmas } from './alarmas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { estadoDelCiclo, iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes, completarCompromiso } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`prueba-alarmas-${++n}`)
  reiniciarReloj()
})

describe('Día 1 = domingo 1 de noviembre de 2026', () => {
  it('con inicio 2026-11-01: Día 1 es dom 1 nov y Día 90 es vie 29 ene 2027; antes, «Empieza en X días»', async () => {
    fijarAhora(instanteDe('2026-10-27', '21:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-01')
    await cerrarDiasPendientes()
    const antes = await estadoDelCiclo('2026-10-31')
    expect(antes?.noEmpezado).toBe(true)
    expect(antes?.dia).toBe(0)
    expect(fechaLegible('2026-11-01')).toBe('dom 1 nov')
    expect(diaDelCiclo('2026-11-01', '2026-11-01')).toBe(1)
    expect(fechaDelDiaDelCiclo('2026-11-01', 90)).toBe('2027-01-29')
    expect(fechaLegible('2027-01-29')).toBe('vie 29 ene')
    const d1 = await estadoDelCiclo('2026-11-01')
    expect(d1?.dia).toBe(1)
    expect(d1?.faseNumero).toBe(1)
    expect((await estadoDelCiclo('2026-11-30'))?.faseNumero).toBe(1)
    expect((await estadoDelCiclo('2026-12-01'))?.faseNumero).toBe(2)
    const d90 = await estadoDelCiclo('2027-01-29')
    expect(d90?.dia).toBe(90)
    expect(d90?.faseNumero).toBe(3)
    expect(d90?.terminado).toBe(false)
    expect((await estadoDelCiclo('2027-01-30'))?.terminado).toBe(true)
    // Nada se programa antes del Día 1, ni siquiera a última hora del 31.
    fijarAhora(instanteDe('2026-10-31', '23:59', Z))
    expect(await alarmasDelDia('2026-10-31')).toEqual([])
  })
})

describe('alarmas directas (etapa 1)', () => {
  beforeEach(async () => {
    fijarAhora(instanteDe('2026-11-02', '08:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-01')
    await cerrarDiasPendientes()
  })

  it('un día de entrenamiento tiene 4 alarmas en orden; un día de descanso, 3', async () => {
    const lunes = await alarmasDelDia('2026-11-02')
    expect(lunes.map((a) => `${a.hora} ${a.tipo}`)).toEqual(['07:00 entrenamiento', '20:50 revision', '21:15 celu', '21:20 dormido'])
    expect(lunes[0].instante).toBe(instanteDe('2026-11-02', '07:00', Z))
    const martes = await alarmasDelDia('2026-11-03')
    expect(martes.map((a) => a.tipo)).toEqual(['revision', 'celu', 'dormido'])
  })

  it('si el entrenamiento ya se hizo, su alarma no suena; y las horas siguen a los ajustes', async () => {
    await completarCompromiso('entrenamiento:2026-11-02', { minutos: 42 })
    expect((await alarmasDelDia('2026-11-02')).map((a) => a.tipo)).toEqual(['revision', 'celu', 'dormido'])
    await guardarAjustes({ horaDejarCelu: '22:00', horaDormido: '22:10' })
    const hoy = await alarmasDelDia('2026-11-03')
    expect(hoy.find((a) => a.tipo === 'celu')?.hora).toBe('22:00')
    expect(hoy.find((a) => a.tipo === 'dormido')?.hora).toBe('22:10')
  })

  it('las próximas solo incluyen las que todavía no sonaron, y en la web no se programa nada', async () => {
    fijarAhora(instanteDe('2026-11-02', '21:00', Z))
    const prox = await alarmasProximas(2)
    expect(prox.map((a) => `${a.fecha} ${a.tipo}`)).toEqual(['2026-11-02 celu', '2026-11-02 dormido', '2026-11-03 revision', '2026-11-03 celu', '2026-11-03 dormido'])
    expect(await programarAlarmas()).toBe(0)
  })
})

describe('orden fijo de los 4 pilares', () => {
  it('nuevo y migrado: 1 Entrenamiento · 2 Avanzar en la empresa · 3 Dibujar manga · 4 Dormir a horario', async () => {
    const { db } = await import('../data/db')
    const { pilaresDelDia, pilaresPorDia } = await import('./dia')
    fijarAhora(instanteDe('2026-11-02', '08:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-01')
    await cerrarDiasPendientes()
    const esperado = ['Entrenamiento', 'Avanzar en la empresa', 'Dibujar manga', 'Dormir a horario']
    expect((await pilaresDelDia('2026-11-02')).pilares.map((p) => p.accion.nombre)).toEqual(esperado)
    expect((await pilaresPorDia('2026-11-01', '2026-11-02', '2026-11-02')).get('2026-11-01')!.map((p) => p.nombre)).toEqual(esperado)
    // Datos viejos (manga 2, empresa 3): la migración los reordena sin tocar lo registrado.
    await db().acciones.update('manga', { orden: 2 })
    await db().acciones.update('empresa', { orden: 3 })
    await inicializarSiHaceFalta()
    expect((await pilaresDelDia('2026-11-02')).pilares.map((p) => p.accion.nombre)).toEqual(esperado)
    // Teléfono con un dato viejo: «Dormir a horario» guardado en el 2 y manga en el 4. Igual sale en orden, aun sin migrar.
    await db().acciones.update('acostarse', { orden: 2 })
    await db().acciones.update('empresa', { orden: 3 })
    await db().acciones.update('manga', { orden: 4 })
    expect((await pilaresDelDia('2026-11-02')).pilares.map((p) => p.accion.nombre)).toEqual(esperado)
    expect((await pilaresPorDia('2026-11-02', '2026-11-02', '2026-11-02')).get('2026-11-02')!.map((p) => p.nombre)).toEqual(esperado)
    await inicializarSiHaceFalta()
    expect((await db().acciones.get('acostarse'))?.orden).toBe(4)
    expect((await pilaresDelDia('2026-11-02')).pilares.map((p) => p.accion.nombre)).toEqual(esperado)
    expect((await db().compromisos.where('fecha').equals('2026-11-02').count())).toBeGreaterThan(0)
  })
})
