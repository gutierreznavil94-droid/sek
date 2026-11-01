import { describe, expect, it } from 'vitest'
import { instanteDe } from './fechas'
import { duracionMs, estadoLimite, minutosPorDia, type SesionJuego } from './juego'

const Z = 'America/Argentina/Cordoba'
const min = 60_000

describe('temporizador de juego', () => {
  it('calcula la duración a partir de marcas, descontando pausas', () => {
    const inicio = instanteDe('2026-11-03', '20:00', Z)
    const s: SesionJuego = {
      inicio,
      pausas: [{ desde: inicio + 10 * min, hasta: inicio + 15 * min }],
      fin: inicio + 60 * min,
    }
    expect(duracionMs(s, inicio + 999 * min) / min).toBe(55)
  })

  it('una sesión activa sigue contando con "ahora", aunque la app se haya cerrado', () => {
    const inicio = instanteDe('2026-11-03', '20:00', Z)
    const s: SesionJuego = { inicio, pausas: [] }
    expect(duracionMs(s, inicio + 42 * min) / min).toBe(42)
  })

  it('una pausa abierta congela el tiempo', () => {
    const inicio = instanteDe('2026-11-03', '20:00', Z)
    const s: SesionJuego = { inicio, pausas: [{ desde: inicio + 30 * min }] }
    expect(duracionMs(s, inicio + 90 * min) / min).toBe(30)
  })

  it('una sesión de 23:30 a 00:30 suma 30 minutos a cada día', () => {
    const inicio = instanteDe('2026-11-03', '23:30', Z)
    const s: SesionJuego = { inicio, pausas: [], fin: inicio + 60 * min }
    const m = minutosPorDia([s], inicio + 999 * min, Z)
    expect(m.get('2026-11-03')).toBe(30)
    expect(m.get('2026-11-04')).toBe(30)
  })

  it('estado del límite', () => {
    expect(estadoLimite(10, 90)).toBe('ok')
    expect(estadoLimite(72, 90)).toBe('cerca')
    expect(estadoLimite(90, 90)).toBe('superado')
    expect(estadoLimite(500, 0)).toBe('ok')
  })
})
