import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { fechaDe, instanteDe } from '../domain/fechas'
import { aguaDelDia } from './agua'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'
import { aplicarAccionesWidget, datosWidget } from './widgets'

const Z = 'America/Argentina/Cordoba'
const LUNES = '2026-11-02'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`prueba-widgets-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(LUNES, '08:00', Z))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-01')
  await cerrarDiasPendientes()
})

describe('widgets de Android', () => {
  it('pasan el día, los pilares (Dormir a horario no se marca desde el widget), el agua y los colores del tema', async () => {
    const d = await datosWidget(LUNES)
    expect(d.inicio).toBe('2026-11-01')
    expect(d.dias).toBe(90)
    expect(d.pilares.length).toBeGreaterThan(0)
    expect(d.pilares.find((p) => p.id === 'acostarse')?.marcable).toBe(false)
    expect(d.pilares.find((p) => p.id === 'entrenamiento')).toMatchObject({ estado: 'pendiente', marcable: true })
    expect(d.agua.ml).toBe(0)
    expect(d.fruta).toEqual({ n: 0, objetivo: 2 })
    expect(d.colores['color-principal']).toMatch(/^#/)
  })

  it('lo marcado en el widget se anota al abrir; lo de otro día se descarta', async () => {
    const t = instanteDe(LUNES, '07:30', Z)
    const n = await aplicarAccionesWidget([
      { tipo: 'pilar', id: 'entrenamiento', instante: t },
      { tipo: 'vaso', instante: t },
      { tipo: 'fruta', instante: t },
      { tipo: 'vaso', instante: instanteDe('2026-11-01', '22:00', Z) },
    ], LUNES, (x) => fechaDe(x, Z))
    expect(n).toBe(3)
    expect((await datosWidget(LUNES)).fruta).toEqual({ n: 1, objetivo: 2 })
    expect((await datosWidget(LUNES)).pilares.find((p) => p.id === 'entrenamiento')?.estado).toBe('hecho')
    expect((await aguaDelDia(LUNES)).tomas).toHaveLength(1)
  })
})
