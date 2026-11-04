import { describe, expect, it } from 'vitest'
import { fraseDormir, frasesDormir, minutosAvisoDormir, mostrarAvisoDormir, FRASES_DORMIR_DEFECTO } from './dormir'

describe('recordatorio para dormir (4 nov)', () => {
  it('aparece 30 min antes de «Dejo celu», no si ya se marcó, y se apaga al cerrar la ventana', () => {
    const dejar = Date.parse('2026-11-02T21:15:00-03:00')
    const fin = Date.parse('2026-11-02T22:15:00-03:00')
    const base = { instDejarCelu: dejar, instFinCelu: fin, minutos: 30, dormirMarcado: false, noche: '2026-11-02' }
    expect(mostrarAvisoDormir({ ...base, ahora: dejar - 31 * 60_000 })).toBe(false)
    expect(mostrarAvisoDormir({ ...base, ahora: dejar - 30 * 60_000 })).toBe(true)
    expect(mostrarAvisoDormir({ ...base, ahora: dejar + 10 * 60_000 })).toBe(true)
    expect(mostrarAvisoDormir({ ...base, ahora: fin })).toBe(false)
    expect(mostrarAvisoDormir({ ...base, ahora: dejar, dormirMarcado: true })).toBe(false)
  })
  it('las frases rotan por noche y se pueden editar', () => {
    expect(frasesDormir({})).toEqual(FRASES_DORMIR_DEFECTO)
    expect(frasesDormir({ frasesDormir: ['  ', 'Propia'] })).toEqual(['Propia'])
    const a = fraseDormir({}, '2026-11-02')
    const b = fraseDormir({}, '2026-11-03')
    expect(FRASES_DORMIR_DEFECTO).toContain(a)
    expect(a).not.toBe(b)
    expect(minutosAvisoDormir({})).toBe(30)
    expect(minutosAvisoDormir({ minutosAvisoDormir: 45 })).toBe(45)
  })
})
