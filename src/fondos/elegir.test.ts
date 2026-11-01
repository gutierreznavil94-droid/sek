import { describe, expect, it } from 'vitest'
import { intensidadDestello, elegirVideo, videoDelDia, videoSegunClima, VIDEOS, CLIMA_ACTIVO } from './elegir'

describe('video de fondo por día', () => {
  it('Día 1 lluvia, Día 2 rayos y vuelve a empezar', () => {
    const uno = '2026-11-01'
    expect(videoDelDia('2026-11-01', uno)).toBe('lluvia')
    expect(videoDelDia('2026-11-02', uno)).toBe('rayos')
    expect(videoDelDia('2026-11-03', uno)).toBe('lluvia')
    expect(videoDelDia('2026-11-04', uno)).toBe('rayos')
    expect(videoDelDia('2027-01-29', uno)).toBe('rayos') // día 90
  })
  it('antes del Día 1 sigue el mismo ciclo hacia atrás', () => {
    expect(videoDelDia('2026-10-31', '2026-11-01')).toBe('rayos')
    expect(videoDelDia('2026-10-30', '2026-11-01')).toBe('lluvia')
  })
  it('usa el Día 1 del ciclo que se le pase', () => {
    expect(videoDelDia('2026-12-10', '2026-12-10')).toBe('lluvia')
    expect(videoDelDia('2026-12-11', '2026-12-10')).toBe('rayos')
  })
  it('modos fijos', () => {
    expect(elegirVideo('rayos', '2026-11-01')).toBe('rayos')
    expect(elegirVideo('lluvia', '2026-11-02')).toBe('lluvia')
  })
  it('el modo clima está apagado: se comporta como intercalado', () => {
    expect(CLIMA_ACTIVO).toBe(false)
    expect(elegirVideo('clima', '2026-11-01', '2026-11-01', 95)).toBe('lluvia')
  })
  it('clima → video (preparado para más adelante)', () => {
    expect(videoSegunClima(95)).toBe('rayos')
    expect(videoSegunClima(63)).toBe('lluvia')
    expect(videoSegunClima(3)).toBe('lluvia')
    expect(videoSegunClima(null)).toBe('lluvia')
  })
  it('quedan solo lluvia y rayos', () => {
    expect(VIDEOS.map((v) => v.id)).toEqual(['lluvia', 'rayos'])
  })
  it('el vidrio se oscurece en los relámpagos', () => {
    const d = [[2, 3]]
    expect(intensidadDestello(1, d)).toBe(0)
    expect(intensidadDestello(2.5, d)).toBe(1)
    expect(intensidadDestello(1.925, d)).toBeCloseTo(0.5)
    expect(intensidadDestello(3.5, d)).toBe(0)
    expect(intensidadDestello(2.5, undefined)).toBe(0)
  })
})
