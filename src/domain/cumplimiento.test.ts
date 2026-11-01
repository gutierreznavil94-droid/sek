import { describe, expect, it } from 'vitest'
import { calcularAtributo, cumplimiento, nivelCumplimiento, racha, type CompromisoResumen } from './cumplimiento'

const c = (p: Partial<CompromisoResumen> & { fecha: string; estado: CompromisoResumen['estado'] }): CompromisoResumen => ({
  accionId: 'a',
  atributoIds: ['disciplina'],
  ...p,
})

describe('cumplimiento diario', () => {
  it('cuenta completados sobre programados', () => {
    const r = cumplimiento([
      c({ fecha: '2026-11-03', estado: 'completado' }),
      c({ fecha: '2026-11-03', estado: 'omitido' }),
      c({ fecha: '2026-11-03', estado: 'completado' }),
      c({ fecha: '2026-11-03', estado: 'no_registrado' }),
    ])
    expect(r).toEqual({ cumplidos: 2, programados: 4, porcentaje: 50 })
  })

  it('los reprogramados y las excepciones no cuentan', () => {
    const r = cumplimiento([
      c({ fecha: '2026-11-03', estado: 'reprogramado' }),
      c({ fecha: '2026-11-03', estado: 'completado', excepcion: true }),
    ])
    expect(r.porcentaje).toBeNull()
  })

  it('lo pendiente de hoy no baja el porcentaje, lo pendiente de ayer sí', () => {
    const hoy = '2026-11-03'
    const r = cumplimiento([c({ fecha: hoy, estado: 'completado' }), c({ fecha: hoy, estado: 'pendiente' })], hoy)
    expect(r.porcentaje).toBe(100)
    const ayer = cumplimiento([c({ fecha: '2026-11-02', estado: 'completado' }), c({ fecha: '2026-11-02', estado: 'pendiente' })], hoy)
    expect(ayer.porcentaje).toBe(50)
  })

  it('clasifica para el calendario', () => {
    expect(nivelCumplimiento(null)).toBe('sin_datos')
    expect(nivelCumplimiento(20)).toBe('bajo')
    expect(nivelCumplimiento(50)).toBe('medio')
    expect(nivelCumplimiento(80)).toBe('alto')
  })
})

describe('racha', () => {
  it('cuenta días seguidos ≥ umbral y se corta en el primero que falla', () => {
    const m = new Map([
      ['2026-11-01', { porcentaje: 100 }],
      ['2026-11-02', { porcentaje: 40 }],
      ['2026-11-03', { porcentaje: 80 }],
      ['2026-11-04', { porcentaje: 90 }],
    ])
    expect(racha(m, '2026-11-04')).toBe(2)
    expect(racha(m, '2026-11-01')).toBe(1)
    expect(racha(m, '2026-11-02')).toBe(0)
  })

  it('los días de excepción se saltan sin cortar ni sumar', () => {
    const m = new Map([
      ['2026-11-01', { porcentaje: 100 }],
      ['2026-11-02', { porcentaje: null, excepcion: true }],
      ['2026-11-03', { porcentaje: 85 }],
    ])
    expect(racha(m, '2026-11-03')).toBe(2)
  })
})

describe('atributos', () => {
  const hoy = '2026-11-14'
  const lista: CompromisoResumen[] = []
  // 14 noches de acostarse (10 cumplidas) y 8 entrenamientos (6 cumplidos)
  for (let i = 0; i < 14; i++) {
    const fecha = `2026-11-${String(i + 1).padStart(2, '0')}`
    lista.push(c({ accionId: 'dormir', fecha, estado: i < 10 ? 'completado' : 'omitido', atributoIds: ['fisico', 'autocontrol'] }))
  }
  for (let i = 0; i < 8; i++) {
    const fecha = `2026-11-${String(i + 1).padStart(2, '0')}`
    lista.push(c({ accionId: 'entrenar', fecha, estado: i < 6 ? 'completado' : 'omitido', atributoIds: ['fisico'] }))
  }

  it('reproduce el ejemplo del diseño: 16 / 22 = 73', () => {
    const r = calcularAtributo('fisico', lista, hoy)
    expect(r.cumplidos).toBe(16)
    expect(r.programados).toBe(22)
    expect(r.valor).toBe(73)
    expect(r.porAccion).toContainEqual({ accionId: 'entrenar', cumplidos: 6, programados: 8 })
  })

  it('solo mira la ventana de 14 días', () => {
    const r = calcularAtributo('fisico', lista, '2026-11-20')
    // ventana 7..20 de nov: noches 7..14 (8 noches, cumplidas 7,8,9,10 = 4) y entrenos 7,8 (ambos omitidos)
    expect(r.programados).toBe(10)
    expect(r.cumplidos).toBe(4)
    expect(r.valor).toBe(40)
  })

  it('con pocos datos devuelve null', () => {
    const r = calcularAtributo('fisico', lista.slice(0, 3), hoy)
    expect(r.valor).toBeNull()
    expect(r.programados).toBe(3)
  })

  it('un atributo sin acciones vinculadas devuelve null', () => {
    expect(calcularAtributo('claridad', lista, hoy).valor).toBeNull()
  })
})
