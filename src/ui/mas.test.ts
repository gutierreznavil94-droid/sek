import { describe, expect, it } from 'vitest'
import { coincide, normalizar } from './paginas/Mas'
import { discursoDeSemana, ultimaSemanaConInfo, ETAPAS_SUGERIDAS } from '../services/adaptacion'

describe('Más: búsqueda', () => {
  const comida = { t: 'Comida', d: 'Calorías, proteína y agua', claves: 'comida calorias proteina agua botella' }
  it('ignora tildes y mayúsculas, y busca en palabras clave', () => {
    expect(normalizar('  ProteÍNA ')).toBe('proteina')
    expect(coincide(comida, 'AGUA')).toBe(true)
    expect(coincide(comida, 'calorías')).toBe(true)
    expect(coincide(comida, 'flexiones')).toBe(false)
    expect(coincide(comida, '')).toBe(true)
  })
})

describe('Sueño: lo que cuenta el shinobi', () => {
  it('sale de las etapas (si se editan, cambia) y llega hasta Estable', () => {
    expect(discursoDeSemana(1).titulo).toBe('Semana 1 · Acostumbrando')
    expect(discursoDeSemana(1).texto).toContain('acostarte a horario')
    expect(discursoDeSemana(3).titulo).toBe('Semana 3 · Asentando')
    expect(discursoDeSemana(5).titulo).toBe('Semana 5 · Estable')
    expect(ultimaSemanaConInfo(ETAPAS_SUGERIDAS)).toBe(5)
    const mias = [{ ...ETAPAS_SUGERIDAS[0], semanas: 3, horasMin: 5.5 }, ETAPAS_SUGERIDAS[1], ETAPAS_SUGERIDAS[2]]
    expect(discursoDeSemana(3, mias).titulo).toBe('Semana 3 · Acostumbrando')
    expect(discursoDeSemana(3, mias).texto).toContain('5,5 a 9 h')
    expect(ultimaSemanaConInfo(mias)).toBe(6)
  })
})
