import { describe, expect, it } from 'vitest'
import { alEvento, emitirEvento, type EventoTema } from './eventos'

describe('eventos genéricos del tema', () => {
  it('llegan a quien escucha y se puede dejar de escuchar', () => {
    const vistos: EventoTema[] = []
    const dejar = alEvento((e) => vistos.push(e))
    emitirEvento('duda')
    emitirEvento('completar')
    dejar()
    emitirEvento('logro')
    expect(vistos).toEqual(['duda', 'completar'])
  })
})
