import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Escena } from './animaciones/Escena'
import { duracionDe } from './animaciones/motor'
import { NOMBRES_POSE, guardarPosePropia, mezclar, origenDePose, pose, poseBase, poseEn, restaurarPose } from './animaciones/munieco'

describe('shinobi articulado', () => {
  afterEach(() => { for (const n of NOMBRES_POSE) restaurarPose(n) })

  it('las 7 poses base tienen todas las articulaciones', () => {
    for (const n of NOMBRES_POSE) {
      const p = poseBase(n)
      expect(p.cadera).toHaveLength(2)
      for (const k of ['torso', 'cabeza', 'sombrero', 'bufanda', 'brazoDer', 'antebrazoDer', 'brazoIzq', 'antebrazoIzq', 'musloDer', 'piernaDer', 'musloIzq', 'piernaIzq'] as const) expect(typeof p[k]).toBe('number')
    }
  })

  it('interpola los ángulos entre dos poses clave', () => {
    const a = { ...poseBase('guardia'), torso: 0, brazoDer: 0, cadera: [0, 0] as [number, number] }
    const b = { ...a, torso: 40, brazoDer: 100, cadera: [10, -20] as [number, number] }
    const m = mezclar(a, b, 0.5)
    expect(m.torso).toBe(20)
    expect(m.brazoDer).toBe(50)
    expect(m.cadera).toEqual([5, -10])
    const claves = [{ t: 0.2, pose: a }, { t: 0.6, pose: b }]
    expect(poseEn(claves, 0).torso).toBe(0)
    expect(poseEn(claves, 0.4).torso).toBeCloseTo(20)
    expect(poseEn(claves, 1).torso).toBe(40)
  })

  it('cambiar un número en la pose cambia lo que se dibuja, sin tocar el código', () => {
    expect(origenDePose('corte')).toBe('base')
    guardarPosePropia('corte', { ...poseBase('corte'), brazoDer: 12 })
    expect(origenDePose('corte')).toBe('propia')
    expect(pose('corte').brazoDer).toBe(12)
    restaurarPose('corte')
    expect(pose('corte').brazoDer).toBe(poseBase('corte').brazoDer)
  })

  it('el sombrero vuela solo en los logros grandes', () => {
    const nada = () => {}
    const { container: ej } = render(<Escena a={{ id: 1, inicio: 0, tipo: 'ejecucion', pilar: 'manga', vieja: true }} nombre="Shinobi" onSaltar={nada} />)
    expect(ej.querySelector('.sh-kasa')).not.toBeNull()
    expect(ej.querySelector('.sh-kasa-vuela')).toBeNull()
    const { container: lo } = render(<Escena a={{ id: 2, inicio: 0, tipo: 'logro', clase: 'nivel', texto: 'Nivel 3', vieja: true }} nombre="Shinobi" onSaltar={nada} />)
    expect(lo.querySelector('.sh-kasa-vuela')).not.toBeNull()
    expect(lo.querySelector('.sh-actor-logro')).not.toBeNull()
  })

  it('la ejecución usa los videos de Luma (2 s) con el kanji del pilar; la del muñeco queda guardada', () => {
    const nada = () => {}
    const { container } = render(<Escena a={{ id: 3, inicio: 0, tipo: 'ejecucion', pilar: 'entrenamiento' }} nombre="Shinobi" onSaltar={nada} />)
    expect(container.querySelector('.sh-ej-video image')?.getAttribute('href')).toMatch(/animaciones\/ejecucion\/ejecucion-claro\.webp$/)
    expect(container.querySelector('.sh-ej-video .sh-kanji')?.textContent).toBe('鍛')
    expect(container.querySelector('.sh-mancha')).toBeNull()
    expect(duracionDe({ tipo: 'ejecucion', pilar: 'manga' })).toBe(2100)
    expect(duracionDe({ tipo: 'ejecucion', pilar: 'manga', vieja: true })).toBe(1500)
  })

  it('caramelo y logro usan los videos de Luma; los del muñeco quedan guardados', () => {
    const nada = () => {}
    const { container: ca } = render(<Escena a={{ id: 4, inicio: 0, tipo: 'postura', modo: 'siguiente' }} nombre="Shinobi" tema="oscuro" onSaltar={nada} />)
    expect(ca.querySelector('.sh-postura-video image')?.getAttribute('href')).toMatch(/animaciones\/caramelo\/caramelo-oscuro\.webp$/)
    expect(ca.querySelector('.sh-caramelo-v')).not.toBeNull()
    expect(ca.querySelector('.sh-kanji-aura')?.textContent).toBe('次')
    const { container: lo } = render(<Escena a={{ id: 5, inicio: 0, tipo: 'logro', clase: 'racha', texto: '7 días' }} nombre="Shinobi" onSaltar={nada} />)
    expect(lo.querySelector('.sh-logro-video image')?.getAttribute('href')).toMatch(/animaciones\/logro\/logro-claro\.webp$/)
    expect(lo.querySelector('.sh-sello')?.textContent).toBe('連')
    expect(lo.querySelector('.sh-kasa-vuela')).toBeNull()
    expect(duracionDe({ tipo: 'postura', modo: '321' })).toBe(1400)
    expect(duracionDe({ tipo: 'postura', modo: '321', vieja: true })).toBe(1200)
    expect(duracionDe({ tipo: 'logro', clase: 'nivel', texto: 'x' })).toBe(2600)
    expect(duracionDe({ tipo: 'logro', clase: 'nivel', texto: 'x', vieja: true })).toBe(2000)
  })
})
