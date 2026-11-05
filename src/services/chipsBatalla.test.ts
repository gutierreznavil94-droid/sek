import { describe, expect, it } from 'vitest'
import type { PeleaNinja } from '../data/tipos'
import { estadoChip } from './ninjas'

const base: PeleaNinja = { fecha: '2026-11-05', distraccion: 'instagram', momento: 'batalla', resultado: 'vencido', instante: 1000, reps: 15 }

describe('chips de batalla', () => {
  it('vencido solo con las reps y además un 3·2·1 o Siguiente acción después', () => {
    expect(estadoChip(base, { repsDespues: 0, ultimaAccion: 2000, diaTerminado: false })).toBe('vencido')
    expect(estadoChip(base, { repsDespues: 0, ultimaAccion: 500, diaTerminado: false })).toBe('duda')
    expect(estadoChip({ ...base, reps: undefined }, { repsDespues: 0, ultimaAccion: 2000, diaTerminado: false })).toBe('duda')
    expect(estadoChip({ ...base, reps: undefined }, { repsDespues: 10, ultimaAccion: 2000, diaTerminado: false })).toBe('vencido')
  })
  it('si el día terminó sin completar, escapó; robo y escapado quedan como están', () => {
    expect(estadoChip(base, { repsDespues: 0, ultimaAccion: 0, diaTerminado: true })).toBe('escapado')
    expect(estadoChip({ ...base, resultado: 'escapo' }, { repsDespues: 0, ultimaAccion: 0, diaTerminado: false })).toBe('escapado')
    expect(estadoChip({ ...base, resultado: 'escapo', robo: 10 }, { repsDespues: 0, ultimaAccion: 0, diaTerminado: false })).toBe('robo')
  })
})
