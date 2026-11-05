import { describe, expect, it } from 'vitest'
import { TOPE_CONSEJOS_DIA, consejosPosibles, elegirConsejo, fraseSuelta, frasesCompanero, type DatosConsejo } from './companero'

const base: DatosConsejo = {
  minutoActual: 10 * 60,
  pilaresPendientes: [],
  agua: { ml: 2000, objetivo: 2500 },
  comida: { activa: false, cargadas: 0 },
  racha: 0,
  minutosHastaDejoCelu: 600,
  diaCompleto: false,
  diasSinAbrir: 0,
}

describe('compañero: consejos según datos', () => {
  it('el pilar por vencer va primero; después agua, comida, racha, dormir, día completo y volver', () => {
    const d: DatosConsejo = {
      minutoActual: 19 * 60 + 10,
      pilaresPendientes: [{ id: 'entrenamiento', nombre: 'Entrenar', horaLimite: '19:35', entreno: true }],
      agua: { ml: 500, objetivo: 2500 },
      comida: { activa: true, cargadas: 0 },
      racha: 5,
      minutosHastaDejoCelu: 20,
      diaCompleto: false,
      diasSinAbrir: 3,
    }
    const claves = consejosPosibles(d).map((c) => c.clave)
    expect(claves).toEqual(['pilar:entrenamiento', 'agua', 'comida', 'racha', 'dormir', 'volviste'])
    expect(consejosPosibles(d)[0]).toMatchObject({ texto: 'Entrenar empieza hasta las 19:35. Arranquemos.', accion: { etiqueta: 'Empezar', ruta: '/entreno' } })
    expect(consejosPosibles(d)[1].texto).toBe('Falta agua: 2000 ml.')
  })

  it('cada consejo tiene su condición', () => {
    expect(consejosPosibles({ ...base, pilaresPendientes: [{ id: 'manga', nombre: 'Dibujar', horaLimite: '20:50' }], minutoActual: 20 * 60 })).toEqual([]) // faltan 50 min
    expect(consejosPosibles({ ...base, pilaresPendientes: [{ id: 'manga', nombre: 'Dibujar', horaLimite: '20:50' }], minutoActual: 20 * 60 + 55 })).toEqual([]) // ya venció
    expect(consejosPosibles({ ...base, agua: { ml: 500, objetivo: 2500 }, minutoActual: 14 * 60 })).toEqual([]) // antes de las 15
    expect(consejosPosibles({ ...base, agua: { ml: 500, objetivo: 2500 }, minutoActual: 15 * 60 }).map((c) => c.clave)).toEqual(['agua'])
    expect(consejosPosibles({ ...base, comida: { activa: true, cargadas: 1 }, minutoActual: 15 * 60 })).toEqual([])
    expect(consejosPosibles({ ...base, racha: 2 })).toEqual([])
    expect(consejosPosibles({ ...base, racha: 3 })[0].texto).toBe('3 días seguidos. No lo cortes hoy.')
    expect(consejosPosibles({ ...base, minutosHastaDejoCelu: null })).toEqual([]) // ya marcó dormir
    expect(consejosPosibles({ ...base, minutosHastaDejoCelu: 12 })[0].texto).toBe('Se apaga la lámpara en 12 min.')
    expect(consejosPosibles({ ...base, diaCompleto: true })[0].clave).toBe('completo')
    expect(consejosPosibles({ ...base, diasSinAbrir: 1 })).toEqual([])
  })

  it('solo: no repite un consejo en el día y respeta el tope de 3; al tocarlo siempre dice el más útil', () => {
    const d: DatosConsejo = { ...base, racha: 4, diaCompleto: true, diasSinAbrir: 2, agua: { ml: 0, objetivo: 2500 }, minutoActual: 16 * 60 }
    expect(elegirConsejo(d, [])?.clave).toBe('agua')
    expect(elegirConsejo(d, ['agua'])?.clave).toBe('racha')
    expect(elegirConsejo(d, ['agua', 'racha'])?.clave).toBe('completo')
    expect(elegirConsejo(d, ['agua', 'racha', 'completo'])).toBeNull() // tope
    expect(TOPE_CONSEJOS_DIA).toBe(3)
    expect(elegirConsejo(d, ['agua', 'racha', 'completo'], true)?.clave).toBe('agua')
    expect(elegirConsejo(base, [], true)).toBeNull() // nada que aconsejar: frase suelta
  })

  it('frases: las de Ajustes mandan, si no las del tema; no se repiten en el día', () => {
    expect(frasesCompanero({ frasesCompanero: [' Propia ', ''] }, { frases: ['Del tema'] })).toEqual(['Propia'])
    expect(frasesCompanero({}, { frases: ['Del tema'] })).toEqual(['Del tema'])
    expect(frasesCompanero({}, {}).length).toBeGreaterThan(0)
    const f = ['a', 'b', 'c']
    expect(fraseSuelta(f, [0, 1], () => 0.99)).toEqual({ indice: 2, texto: 'c' })
    expect(fraseSuelta(f, [0, 1, 2], () => 0)).toEqual({ indice: 0, texto: 'a' })
  })
})
