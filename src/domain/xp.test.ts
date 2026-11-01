import { describe, expect, it } from 'vitest'
import { claveXp, contarEnPeriodo, reglaVigente, totalXp, type RegistroXp } from './xp'

describe('xp', () => {
  it('arma claves únicas por acción y día', () => {
    expect(claveXp('compromiso', ['entrenar', '2026-11-03'])).toBe('compromiso:entrenar:2026-11-03')
  })

  it('la regla vigente es la última cuya fecha ya pasó; cambiar reglas no toca el pasado', () => {
    const reglas = [
      { id: 'r1', validaDesde: '2026-11-01', xp: 30 },
      { id: 'r2', validaDesde: '2026-11-10', xp: 40 },
    ]
    expect(reglaVigente(reglas, '2026-11-05')?.xp).toBe(30)
    expect(reglaVigente(reglas, '2026-11-10')?.xp).toBe(40)
    expect(reglaVigente(reglas, '2026-10-31')).toBeNull()
  })

  it('el total ignora anulados y nunca resta', () => {
    const regs: RegistroXp[] = [
      { clave: 'a', cantidad: 30, origen: 'compromiso', fecha: '2026-11-03', creado: 1, descripcion: '' },
      { clave: 'b', cantidad: 20, origen: 'suenio', fecha: '2026-11-03', creado: 1, descripcion: '', anulado: true },
      { clave: 'c', cantidad: -5, origen: 'manual', fecha: '2026-11-03', creado: 1, descripcion: '' },
    ]
    expect(totalXp(regs)).toBe(30)
    expect(contarEnPeriodo(regs, 'compromiso', ['2026-11-03'])).toBe(1)
  })
})
