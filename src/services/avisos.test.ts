import { describe, expect, it } from 'vitest'
import { AVISOS, configAviso, conAviso } from './avisos'

describe('avisos: Notificación, Alarma o Nada', () => {
  it('valores de entrada: Juego 50 % notificación, Juego 100 % alarma, alistarse alarma, Dejo celu nada, entreno notificación', () => {
    const a = {}
    expect(configAviso(a, 'juego-mitad')).toMatchObject({ modo: 'notificacion', porcentaje: 50, vibrar: true })
    expect(configAviso(a, 'juego-limite').modo).toBe('alarma')
    expect(configAviso(a, 'alistarse').modo).toBe('alarma')
    expect(configAviso(a, 'celu').modo).toBe('nada')
    expect(configAviso(a, 'entrenamiento').modo).toBe('notificacion')
    expect(AVISOS.map((x) => x.tipo)).toContain('juego-limite')
  })

  it('lo editado manda; quitar la hora vuelve a la de la app; lo apagado antes queda en Nada', () => {
    let avisos = conAviso({}, 'celu', { modo: 'alarma', hora: '21:30' })
    expect(configAviso({ avisos }, 'celu')).toMatchObject({ modo: 'alarma', hora: '21:30' })
    avisos = conAviso({ avisos }, 'celu', { hora: undefined })
    expect(configAviso({ avisos }, 'celu').hora).toBeUndefined()
    expect(configAviso({ avisos }, 'celu').modo).toBe('alarma')
    expect(configAviso({ alarmasApagadas: ['dormido'] }, 'dormido').modo).toBe('nada')
    expect(configAviso({ avisos: { 'juego-mitad': { porcentaje: 300 } } }, 'juego-mitad').porcentaje).toBe(99)
  })
})
