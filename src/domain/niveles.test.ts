import { describe, expect, it } from 'vitest'
import { estadoNivel, nivelDesdeXp, xpParaNivel } from './niveles'

describe('niveles', () => {
  it('XP necesario por nivel con base 100', () => {
    expect(xpParaNivel(1)).toBe(0)
    expect(xpParaNivel(2)).toBe(100)
    expect(xpParaNivel(3)).toBe(300)
    expect(xpParaNivel(5)).toBe(1000)
    expect(xpParaNivel(10)).toBe(4500)
    expect(xpParaNivel(12)).toBe(6600)
  })

  it('nivel desde XP, incluidos los bordes exactos', () => {
    expect(nivelDesdeXp(0)).toBe(1)
    expect(nivelDesdeXp(99)).toBe(1)
    expect(nivelDesdeXp(100)).toBe(2)
    expect(nivelDesdeXp(299)).toBe(2)
    expect(nivelDesdeXp(300)).toBe(3)
    expect(nivelDesdeXp(1640)).toBe(6)
    expect(nivelDesdeXp(4499)).toBe(9)
    expect(nivelDesdeXp(4500)).toBe(10)
  })

  it('es coherente para muchos valores', () => {
    for (let xp = 0; xp < 30000; xp += 7) {
      const n = nivelDesdeXp(xp)
      expect(xpParaNivel(n)).toBeLessThanOrEqual(xp)
      expect(xpParaNivel(n + 1)).toBeGreaterThan(xp)
    }
  })

  it('la base es configurable y no tiene tope', () => {
    expect(xpParaNivel(2, 50)).toBe(50)
    expect(nivelDesdeXp(1000, 50)).toBe(6)
    expect(nivelDesdeXp(1_000_000)).toBeGreaterThan(100)
  })

  it('estado del nivel con ejemplo del diseño', () => {
    const e = estadoNivel(1640)
    expect(e.nivel).toBe(6)
    expect(e.xpEnNivel).toBe(140)
    expect(e.xpParaSiguiente).toBe(600)
    expect(e.xpInicioSiguiente).toBe(2100)
  })
})
