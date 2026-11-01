import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from '../services/base'
import { iniciarCiclo } from '../services/ciclo'
import { cerrarDiasPendientes } from '../services/dia'
import { fijarAhora, reiniciarReloj } from '../services/reloj'
import { xpTotal } from '../services/xp'
import { CapaAnimacion } from './animaciones/CapaAnimacion'
import { actual, animar, configurarAnimaciones, permitida, saltar, vaciar } from './animaciones/motor'
import { Hoy } from './paginas/Hoy'

const Z = 'America/Argentina/Cordoba'

describe('motor de animaciones', () => {
  afterEach(() => { vaciar(); configurarAnimaciones({ modo: 'todas' }) })

  it('«ninguna» no muestra nada; «solo logros grandes» solo muestra logros', () => {
    configurarAnimaciones({ modo: 'ninguna' })
    expect(animar({ tipo: 'ejecucion', pilar: 'manga' })).toBe(false)
    expect(animar({ tipo: 'logro', clase: 'nivel', texto: 'Nivel 2' })).toBe(false)
    expect(actual()).toBeNull()
    configurarAnimaciones({ modo: 'logros' })
    expect(permitida({ tipo: 'parry' })).toBe(false)
    expect(animar({ tipo: 'postura', modo: '321' })).toBe(false)
    expect(animar({ tipo: 'logro', clase: 'racha', texto: '7 días' })).toBe(true)
    expect(actual()?.tipo).toBe('logro')
  })

  it('un toque salta la animación actual y pasa a la siguiente', () => {
    animar({ tipo: 'ejecucion', pilar: 'empresa' })
    animar({ tipo: 'logro', clase: 'nivel', texto: 'Nivel 3' })
    expect(actual()?.tipo).toBe('ejecucion')
    saltar()
    expect(actual()?.tipo).toBe('logro')
    saltar()
    expect(actual()).toBeNull()
  })

  it('la vista previa (forzar) se ve aunque estén desactivadas', () => {
    configurarAnimaciones({ modo: 'ninguna' })
    expect(animar({ tipo: 'parry' }, { forzar: true })).toBe(true)
  })
})

/** Marca «Dibujar manga» desde Hoy y devuelve el XP total y el estado guardado. */
async function marcarManga(base: string, modo: 'todas' | 'ninguna') {
  await usarBaseDePruebas(base)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-02', '10:00', Z))
  await inicializarSiHaceFalta()
  await guardarAjustes({ animaciones: modo })
  await iniciarCiclo('2026-11-02')
  await cerrarDiasPendientes()
  configurarAnimaciones({ modo })
  const vista = render(<MemoryRouter><Hoy hoy="2026-11-02" /><CapaAnimacion /></MemoryRouter>)
  await screen.findByRole('link', { name: /3 · 2 · 1/ })
  const manga = [...document.querySelectorAll('.pilar-tarjeta')].find((e) => e.textContent?.includes('Dibujar manga'))!
  fireEvent.click(manga)
  await waitFor(async () => expect((await db().compromisos.get('manga:2026-11-02'))?.estado).toBe('completado'))
  const capa = document.querySelector('.sh-capa')
  const guardado = await db().compromisos.get('manga:2026-11-02')
  return { vista, capa, xp: await xpTotal(), estado: guardado?.estado, eventos: await db().eventos.count() }
}

describe('animaciones en Hoy', () => {
  beforeEach(() => vaciar())
  afterEach(() => { vaciar(); configurarAnimaciones({ modo: 'todas' }) })

  it('cumplir un pilar muestra la ejecución, un toque la salta, y el XP y el registro son los mismos que sin animación', async () => {
    const con = await marcarManga('prueba-anim-con', 'todas')
    await waitFor(() => expect(document.querySelector('.sh-capa')).not.toBeNull(), { timeout: 4000 })
    expect(document.querySelector('.sh-capa')?.getAttribute('aria-label')).toBe('Dibujar manga')
    fireEvent.pointerDown(document.querySelector('.sh-capa')!)
    await waitFor(() => expect(document.querySelector('.sh-capa')).toBeNull())
    // El aviso con el XP sigue igual que antes.
    con.vista.unmount()

    const sin = await marcarManga('prueba-anim-sin', 'ninguna')
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.querySelector('.sh-capa')).toBeNull()
    sin.vista.unmount()

    expect(con.estado).toBe('completado')
    expect(sin.estado).toBe('completado')
    expect(con.xp).toBe(sin.xp)
    expect(con.eventos).toBe(sin.eventos)
    expect(con.xp).toBeGreaterThan(0)
  })
})
