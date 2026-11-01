import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from '../services/base'
import { iniciarCiclo } from '../services/ciclo'
import { cerrarDiasPendientes, completarCompromiso } from '../services/dia'
import { fijarAhora, reiniciarReloj } from '../services/reloj'
import { Hoy } from './paginas/Hoy'

const Z = 'America/Argentina/Cordoba'

/** Pantalla Hoy: lo que tiene que estar siempre a la vista. */
describe('pantalla Hoy', () => {
  beforeEach(async () => {
    await usarBaseDePruebas('prueba-ui-hoy')
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-02')
    await cerrarDiasPendientes()
  })

  it('muestra los 4 pilares y, debajo, los accesos a 3-2-1 y Siguiente acción', async () => {
    render(<MemoryRouter><Hoy hoy="2026-11-02" /></MemoryRouter>)
    const tres = await screen.findByRole('link', { name: /3 · 2 · 1/ })
    const siguiente = screen.getByRole('link', { name: /Siguiente acción/ })
    expect(tres).toHaveAttribute('href', '/321')
    expect(siguiente).toHaveAttribute('href', '/siguiente')
    const pilares = document.querySelectorAll('.pilar-tarjeta')
    expect(pilares.length).toBe(4)
    expect(pilares[0].textContent).toContain('Entrenamiento')
    expect(pilares[1].textContent).toContain('Avanzar en la empresa')
    expect(pilares[2].textContent).toContain('Dibujar manga')
    expect(pilares[3].textContent).toContain('Dormir a horario')
    // Los accesos van después de los pilares en el orden de la pantalla.
    expect(pilares[3].compareDocumentPosition(tres) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('un pilar cumplido se ve en verde (clase cumplido) con su check', async () => {
    await completarCompromiso('manga:2026-11-02', { minutos: 20 })
    render(<MemoryRouter><Hoy hoy="2026-11-02" /></MemoryRouter>)
    await screen.findByRole('link', { name: /3 · 2 · 1/ })
    const manga = [...document.querySelectorAll('.pilar-tarjeta')].find((e) => e.textContent?.includes('Dibujar manga'))!
    expect(manga.className).toContain('cumplido')
    expect(manga.querySelector('.estado-ic')?.textContent).toBe('✓')
    const empresa = [...document.querySelectorAll('.pilar-tarjeta')].find((e) => e.textContent?.includes('empresa'))!
    expect(empresa.className).toContain('pendiente')
  })
})

describe('pantalla Hoy · cambios 05', () => {
  beforeEach(async () => {
    await usarBaseDePruebas('prueba-ui-hoy-05')
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-02', '10:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-02')
    await cerrarDiasPendientes()
  })

  it('muestra Revisión diaria resaltada y los contadores debajo de los pilares', async () => {
    render(<MemoryRouter><Hoy hoy="2026-11-02" /></MemoryRouter>)
    const rev = await screen.findByRole('link', { name: /Revisión diaria/ })
    expect(rev.className).toContain('primario')
    const pilares = document.querySelectorAll('.pilar-tarjeta')
    expect(pilares[3].compareDocumentPosition(rev) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const flex = screen.getByRole('button', { name: /Sumar 14 flexiones/ })
    expect(flex.textContent).toContain('0 / 70')
  })
})

describe('pantalla Hoy · cambios 06', () => {
  beforeEach(async () => {
    await usarBaseDePruebas('prueba-ui-hoy-06')
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-02', '20:52', Z))
    // La pantalla compara con el reloj real (Date.now): se fija al mismo instante.
    vi.setSystemTime(instanteDe('2026-11-02', '20:52', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-02')
    await cerrarDiasPendientes()
  })
  afterEach(() => vi.useRealTimers())

  it('a las 20:52 muestra un solo mensaje: marcar lo que falta y empezar la revisión', async () => {
    render(<MemoryRouter><Hoy hoy="2026-11-02" /></MemoryRouter>)
    const aviso = await screen.findByRole('region', { name: /Completá tu revisión ahora/ })
    expect(document.querySelectorAll('.aviso-2050').length).toBe(1)
    expect(aviso.textContent).toContain('Dibujar manga')
    expect(aviso.textContent).toContain('Avanzar en la empresa')
    expect(aviso.textContent).toContain('21:00')
    const empezar = screen.getByRole('link', { name: /Empezar la revisión/ })
    expect(empezar).toHaveAttribute('href', '/revision')
  })
})
