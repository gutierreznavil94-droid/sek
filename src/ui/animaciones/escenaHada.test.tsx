import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { adorno, temaPorId } from '../../temas/temas'
import { EscenaHada } from './EscenaHada'
import type { Animacion, EnCurso } from './motor'

const en = (a: Animacion) => ({ ...a, id: 1, inicio: 0 }) as EnCurso

describe('animaciones del hada', () => {
  it('Shinobi sigue con sus animaciones', () => {
    expect(adorno('animaciones', temaPorId('shinobi'))).toBe('shinobi')
  })

  it('las 7 escenas se arman, sin kanji en los textos', () => {
    const casos: [EnCurso, string][] = [
      [en({ tipo: 'ejecucion', pilar: 'manga' }), '¡Cumplido!'],
      [en({ tipo: 'logro', clase: 'nivel', texto: 'Nivel 4', sub: '昇 · ascender' }), '¡Nivel 4!'],
      [en({ tipo: 'logro', clase: 'racha', texto: '7 días seguidos', sub: '連 · racha' }), '7 días seguidos'],
      [en({ tipo: 'logro', clase: 'fase', texto: 'Fase 2', sub: '段 · Constancia' }), 'Constancia'],
      [en({ tipo: 'logro', clase: 'record', texto: 'Récord · Sentadillas', sub: '力 · fuerza' }), 'Récord · Sentadillas'],
      [en({ tipo: 'postura', modo: '321' }), '3 · 2 · 1'],
      [en({ tipo: 'parry' }), '+1'],
    ]
    for (const [a, texto] of casos) {
      const { container, unmount } = render(<EscenaHada a={a} onSaltar={() => {}} />)
      expect(container.querySelector('.hd-capa')).not.toBeNull()
      expect(container.textContent).toContain(texto)
      expect(container.textContent ?? '').not.toMatch(/[㐀-鿿]/)
      unmount()
    }
  })
})
