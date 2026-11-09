import { describe, expect, it } from 'vitest'
import { configAviso } from './avisos'
import { FUNCIONES, funcionesElegidas, usa } from './funciones'

describe('¿Qué querés usar?', () => {
  it('sin elegir nada: lo de SEK prendido y lo de App Nay apagado', () => {
    for (const f of FUNCIONES) expect(usa({}, f.id)).toBe(f.de === 'sek')
    expect(usa(null, 'juego')).toBe(true)
    expect(usa(undefined, 'planes')).toBe(false)
  })

  it('lo elegido gana sobre lo de entrada', () => {
    const a = { funciones: { juego: false, planes: true } }
    expect(usa(a, 'juego')).toBe(false)
    expect(usa(a, 'planes')).toBe(true)
    expect(funcionesElegidas(a)).toMatchObject({ juego: false, planes: true, series: true, ideasRutina: false })
  })

  it('con su parte apagada, el aviso queda en Nada aunque estuviera como alarma', () => {
    const avisos = { 'juego-limite': { modo: 'alarma' as const }, revision: { modo: 'notificacion' as const } }
    expect(configAviso({ avisos }, 'juego-limite').modo).toBe('alarma')
    expect(configAviso({ avisos, funciones: { juego: false } }, 'juego-limite').modo).toBe('nada')
    expect(configAviso({ avisos, funciones: { revision: false } }, 'revision').modo).toBe('nada')
    // «Dejo celu» es del pilar Dormir: no depende de ninguna parte.
    expect(configAviso({ funciones: { sueno: false } }, 'celu').modo).toBe('nada')
    expect(configAviso({ funciones: { sueno: false } }, 'entrenamiento').modo).toBe('notificacion')
  })
})
