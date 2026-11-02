import { useLayoutEffect, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const MARGEN = 8

/** Dónde abrir un menú junto a su botón: abajo si entra, si no hacia arriba; alineado a la derecha del botón y dentro de la pantalla. */
export function posicionMenu(boton: { top: number; bottom: number; right: number }, menu: { width: number; height: number }, pantalla: { width: number; height: number }, abajoReservado = 0): { top: number; left: number; haciaArriba: boolean } {
  const limiteAbajo = pantalla.height - abajoReservado - MARGEN
  const haciaArriba = boton.bottom + 4 + menu.height > limiteAbajo && boton.top - 4 - menu.height >= MARGEN
  const top = haciaArriba ? boton.top - 4 - menu.height : boton.bottom + 4
  const left = Math.max(MARGEN, Math.min(pantalla.width - menu.width - MARGEN, boton.right - menu.width))
  return { top, left, haciaArriba }
}

/**
 * Menú desplegable que se dibuja en una capa propia sobre toda la app (portal en <body>),
 * así ninguna tarjeta con brillo, botón de vidrio ni la barra de abajo lo tapa.
 * Se abre hacia arriba si no entra abajo; tocar fuera, desplazar o Escape lo cierra.
 */
export function MenuFlotante({ ancla, onCerrar, children, etiqueta }: { ancla: RefObject<HTMLElement | null>; onCerrar: () => void; children: ReactNode; etiqueta?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; haciaArriba: boolean } | null>(null)
  useLayoutEffect(() => {
    const b = ancla.current?.getBoundingClientRect()
    const m = ref.current?.getBoundingClientRect()
    if (!b || !m) return
    const nav = document.querySelector('.nav')?.getBoundingClientRect()
    setPos(posicionMenu(b, { width: m.width || 140, height: m.height || 130 }, { width: window.innerWidth, height: window.innerHeight }, nav ? Math.max(0, window.innerHeight - nav.top) : 0))
  }, [ancla])
  useEffect(() => {
    const fuera = (e: Event) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || ancla.current?.contains(t)) return
      onCerrar()
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('pointerdown', fuera, true)
    window.addEventListener('scroll', onCerrar, { passive: true })
    window.addEventListener('resize', onCerrar)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera, true)
      window.removeEventListener('scroll', onCerrar)
      window.removeEventListener('resize', onCerrar)
      document.removeEventListener('keydown', tecla)
    }
  }, [ancla, onCerrar])
  return createPortal(
    <div ref={ref} className={`menu-flotante ${pos?.haciaArriba ? 'arriba' : ''}`} role="menu" aria-label={etiqueta} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  )
}
