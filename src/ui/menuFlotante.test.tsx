import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MenuFlotante, posicionMenu } from './MenuFlotante'

function Prueba() {
  const ref = useRef<HTMLButtonElement>(null)
  const [abierto, setAbierto] = useState(true)
  return (
    <div className="tarjeta-con-brillo" style={{ position: 'relative', zIndex: 2, overflow: 'hidden' }} data-testid="tarjeta">
      <button ref={ref}>…</button>
      {abierto && <MenuFlotante ancla={ref} onCerrar={() => setAbierto(false)}><button role="menuitem">Editar</button></MenuFlotante>}
      <span>fuera</span>
    </div>
  )
}

describe('menús «…» sobre todo lo demás', () => {
  it('el menú se dibuja en <body>, fuera de la tarjeta, así nada lo tapa', () => {
    render(<Prueba />)
    const menu = screen.getByRole('menu')
    expect(menu.parentElement).toBe(document.body)
    expect(screen.getByTestId('tarjeta').contains(menu)).toBe(false)
    expect(menu.className).toContain('menu-flotante')
  })

  it('tocar fuera lo cierra; tocar dentro no', () => {
    render(<Prueba />)
    act(() => { fireEvent.pointerDown(screen.getByRole('menuitem')) })
    expect(screen.queryByRole('menu')).not.toBeNull()
    act(() => { fireEvent.pointerDown(screen.getByText('fuera')) })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('se abre hacia arriba si no entra abajo (cerca de la barra de navegación)', () => {
    const pantalla = { width: 390, height: 844 }
    const menu = { width: 140, height: 140 }
    const abajo = posicionMenu({ top: 300, bottom: 332, right: 370 }, menu, pantalla, 64)
    expect(abajo.haciaArriba).toBe(false)
    expect(abajo.top).toBe(336)
    const cerca = posicionMenu({ top: 700, bottom: 732, right: 370 }, menu, pantalla, 64)
    expect(cerca.haciaArriba).toBe(true)
    expect(cerca.top).toBe(700 - 4 - 140)
    expect(cerca.left).toBe(370 - 140)
    // Nunca se sale por los costados
    expect(posicionMenu({ top: 300, bottom: 332, right: 60 }, menu, pantalla).left).toBe(8)
  })
})
