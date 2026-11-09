import { describe, expect, it } from 'vitest'
import { aDefinicion, borrarTemaPropio, cargarTemasPropios, idDeTema, importarTema, revisarTema, TemaInvalido } from './propios'
import { aplicarTema, rutaTema, temaPorId, temasPropios, urlTema } from './temas'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const tema = (extra: Record<string, unknown> = {}) => JSON.stringify({ formato: 'sek-tema', version: 1, nombre: 'Mi Tema', ...extra })

describe('temas subidos', () => {
  it('rechaza lo que no es un tema', () => {
    expect(() => revisarTema('hola')).toThrow(TemaInvalido)
    expect(() => revisarTema(JSON.stringify({ nombre: 'x' }))).toThrow('no es un tema')
    expect(() => revisarTema(tema({ nombre: '' }))).toThrow('nombre')
    expect(() => revisarTema(tema({ version: 2 }))).toThrow('más nueva')
    expect(() => revisarTema(tema({ imagenes: { fondo: 'data:image/svg+xml;base64,PHN2Zz4=' } }))).toThrow('fondo')
    expect(() => revisarTema(tema({ imagenes: { fondo: 'javascript:alert(1)' } }))).toThrow()
  })

  it('se queda solo con lo que sirve', () => {
    const a = revisarTema(tema({
      nombre: '<b>Mi Tema</b>',
      colores: { 'color-fondo': '#fcf7d9', 'color-texto': 'red', 'color-raro': '#000000' },
      adornos: { aves: 'estrellas', cumplir: 'explotar' },
      simbolos: { 水: '💧', 'demasiado largo': 'x' },
      imagenes: { widget: [PNG, PNG, PNG, PNG, PNG] },
      css: 'body{display:none}',
    }))
    expect(a.nombre).toBe('bMi Tema/b')
    expect(a.colores).toEqual({ 'color-fondo': '#FCF7D9' })
    expect(a.claro).toBe(true)
    expect(a.adornos).toEqual({ aves: 'estrellas', cumplir: undefined, animaciones: undefined, numerosComunes: undefined })
    expect(a.simbolos).toEqual({ 水: '💧' })
    expect(a.imagenes?.widget).toHaveLength(4)
    expect(a).not.toHaveProperty('css')
  })

  it('completa con Shinobi lo que falta y no trae escenas ni sprite', () => {
    const t = aDefinicion(revisarTema(tema({ colores: { 'color-principal': '#F4A6C8' }, imagenes: { fondo: PNG } })))
    expect(t.id).toBe('propio-mi-tema')
    expect(t.propio).toBe(true)
    expect(t.acento).toBe('#F4A6C8')
    expect(t.sprite).toBe('')
    expect(t.escenas).toBeUndefined()
    expect(t.frases?.length).toBeGreaterThan(0)
    expect(rutaTema('fondos/lluvia.mp4', t)).toBe(PNG)
    expect(t.vistaPrevia).toEqual({ imagen: PNG, video: undefined })
  })

  it('id por nombre, sin tildes', () => {
    expect(idDeTema('Árbol Rosa!')).toBe('propio-arbol-rosa')
  })

  it('importar, elegir, aplicar colores y borrar', async () => {
    const id = await importarTema(tema({ claro: true, colores: { 'color-fondo': '#FCF7D9', 'color-texto': '#604734', 'color-hecho': '#4F8F6F' } }))
    expect(temasPropios().map((t) => t.id)).toEqual([id])
    expect(temaPorId(id).nombre).toBe('Mi Tema')
    aplicarTema(id)
    const raiz = document.documentElement
    expect(raiz.dataset.temaPropio).toBe('claro')
    expect(raiz.style.getPropertyValue('--fondo')).toBe('#FCF7D9')
    expect(raiz.style.getPropertyValue('--texto')).toBe('#604734')
    // Volver a Shinobi deja todo como estaba.
    aplicarTema('shinobi')
    expect(raiz.dataset.temaPropio).toBeUndefined()
    expect(raiz.style.getPropertyValue('--fondo')).toBe('')
    // Al abrir de nuevo la app, sigue ahí.
    expect((await cargarTemasPropios()).map((t) => t.id)).toEqual([id])
    await borrarTemaPropio(id)
    expect(temasPropios()).toEqual([])
    expect(temaPorId(id).id).toBe('shinobi')
  })

  it('urlTema: las imágenes del archivo van tal cual, las de la app con la base', () => {
    expect(urlTema(PNG)).toBe(PNG)
    expect(urlTema('fondos/lluvia.jpg')).toMatch(/fondos\/lluvia\.jpg$/)
  })
})

