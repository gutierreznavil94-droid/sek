import { describe, expect, it } from 'vitest'
import { alDisparar, alEvento, disparar, emitirEvento, EVENTOS, fijarTemaEfectos, type EventoTema } from './eventos'
import { iconoSvg } from './iconos'
import { efectosComun } from './comun/efectos'
import { efectosShinobi } from './shinobi/efectos'
import './registro'

describe('Temas · eventos e íconos', () => {
  it('cada tema tiene su versión de cada evento', () => {
    for (const e of EVENTOS) {
      expect(typeof efectosComun[e]).toBe('function')
      expect(typeof efectosShinobi[e]).toBe('function')
    }
  })

  it('disparar avisa a quien escucha y no rompe sin animaciones (jsdom)', () => {
    const vistos: string[] = []
    const quitar = alDisparar((e) => vistos.push(e))
    const el = document.createElement('div')
    document.body.appendChild(el)
    for (const t of ['shinobi', 'comun', 'no-existe']) {
      fijarTemaEfectos(t)
      for (const e of EVENTOS) disparar(e, { elemento: el })
    }
    quitar()
    expect(vistos).toHaveLength(EVENTOS.length * 3)
    fijarTemaEfectos('shinobi')
  })

  it('los íconos se piden por nombre y caen en Shinobi', () => {
    expect(iconoSvg('icono-celu')).toContain('<svg')
    expect(iconoSvg('icono-celu', 'otro')).toContain('<svg')
    expect(iconoSvg('no-existe')).toBe('')
  })

  it('emitirEvento y alEvento: llegan a quien escucha y se puede dejar de escuchar', () => {
    const vistos: EventoTema[] = []
    const dejar = alEvento((e) => vistos.push(e))
    emitirEvento('duda')
    emitirEvento('completar')
    dejar()
    emitirEvento('logro')
    expect(vistos).toEqual(['duda', 'completar'])
  })
})
