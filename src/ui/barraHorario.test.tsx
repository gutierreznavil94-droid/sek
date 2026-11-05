import { render } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Desintegracion, PROB_PAJARO_TORPE, decidirPajaroTorpe } from './Desintegrar'

describe('pájaro torpe', () => {
  it('sale el 10 % de las veces', () => {
    expect(PROB_PAJARO_TORPE).toBe(0.1)
    expect(decidirPajaroTorpe({ activo: true, ultimoFueTorpe: false, azar: () => 0.05 })).toBe(true)
    expect(decidirPajaroTorpe({ activo: true, ultimoFueTorpe: false, azar: () => 0.0999 })).toBe(true)
    expect(decidirPajaroTorpe({ activo: true, ultimoFueTorpe: false, azar: () => 0.1 })).toBe(false)
    let si = 0
    for (let i = 0; i < 1000; i++) if (decidirPajaroTorpe({ activo: true, ultimoFueTorpe: false, azar: () => (i + 0.5) / 1000 })) si++
    expect(si).toBe(100)
  })

  it('nunca dos veces seguidas, y apagado no sale; «Probar» lo fuerza', () => {
    expect(decidirPajaroTorpe({ activo: true, ultimoFueTorpe: true, azar: () => 0 })).toBe(false)
    expect(decidirPajaroTorpe({ activo: false, ultimoFueTorpe: false, azar: () => 0 })).toBe(false)
    expect(decidirPajaroTorpe({ activo: true, ultimoFueTorpe: true, forzar: true })).toBe(true)
    expect(decidirPajaroTorpe({ activo: false, ultimoFueTorpe: false, forzar: true })).toBe(false)
  })
})

describe('barra del horario fija', () => {
  it('en Hoy, la cabecera trae el lugar de la barra (que no se va con el polvo); en otras pantallas no', () => {
    const cab = createRef<HTMLElement>()
    const { rerender } = render(<><header ref={cab}><div id="hueco-horario" className="hueco-horario con" /></header><Desintegracion cabecera={cab} texto="Día 3" conHorario /></>)
    const slot = document.getElementById('barra-horario-slot')
    expect(slot).toBeTruthy()
    expect(slot!.closest('header')).toBeNull()
    expect(document.querySelector('.barra-horario-fija .barra-dia')?.textContent).toBe('Día 3')
    rerender(<><header ref={cab} /><Desintegracion cabecera={cab} texto="Día 3" /></>)
    expect(document.getElementById('barra-horario-slot')).toBeNull()
  })
})
