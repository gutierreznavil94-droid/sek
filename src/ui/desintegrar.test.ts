import { describe, expect, it } from 'vitest'
import { siguienteEstado } from './Desintegrar'

describe('cabecera que se desintegra: una animación a la vez', () => {
  it('se dispara al pasar el 30 % de la cabecera, no antes', () => {
    expect(siguienteEstado('armada', 0.2, false, false)).toBe('armada')
    expect(siguienteEstado('armada', 0.31, false, false)).toBe('animando')
    expect(siguienteEstado('armada', 5, false, false)).toBe('animando') // bajar de golpe: igual arranca desde el principio
  })
  it('mientras anima, ni subir ni bajar la corta: termina a su ritmo', () => {
    expect(siguienteEstado('animando', 0, false, false)).toBe('animando')
    expect(siguienteEstado('animando', 9, false, false)).toBe('animando')
  })
  it('al terminar: si ya se subió, se rearma; si no, queda oculta', () => {
    expect(siguienteEstado('animando', 0.05, true, false)).toBe('rearmando')
    expect(siguienteEstado('animando', 2, true, false)).toBe('ausente')
  })
  it('subir rearma con fundido; bajar otra vez recién después de rearmarse', () => {
    expect(siguienteEstado('ausente', 0.5, false, false)).toBe('ausente')
    expect(siguienteEstado('ausente', 0.1, false, false)).toBe('rearmando')
    expect(siguienteEstado('rearmando', 3, false, false)).toBe('rearmando')
    expect(siguienteEstado('rearmando', 3, false, true)).toBe('armada')
  })
})
