import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from '../services/base'
import { iniciarCiclo } from '../services/ciclo'
import { DISTRACCIONES_MUESTRA, peleasDelDia, type Pelea } from '../services/ninjas'
import { ahora, fijarAhora, reiniciarReloj } from '../services/reloj'
import { guardarRivalPendiente, rivalPendiente } from '../services/rival'
import { concederXp, xpTotal } from '../services/xp'
import { descartarBatalla } from './Batalla'
import { descartarDuelo, dueloEnCurso, hayDuelo } from './Duelo'
import { RivalCapa, TIEMPOS, descartarRival, hayRival, pedirRival } from './Rival'

const Z = 'America/Argentina/Cordoba'
const HOY = '2026-11-02'
const PELEA: Pelea = { fecha: HOY, distraccion: DISTRACCIONES_MUESTRA[2], momento: { momento: 'duda' } }
const ORIGINAL = { ...TIEMPOS }
let n = 0

/** Vacía las capas (rival y batalla) entre pruebas: son módulos con estado. */
function vaciar() { descartarRival(); descartarBatalla(); descartarDuelo() }

describe('el rival escurridizo en Hoy', () => {
  beforeEach(async () => {
    await usarBaseDePruebas(`rival-ui-${++n}`)
    reiniciarReloj()
    fijarAhora(instanteDe(HOY, '19:25', Z))
    localStorage.clear()
    await inicializarSiHaceFalta()
    await iniciarCiclo(HOY)
    Object.assign(TIEMPOS, { carreraPxPorSeg: 100000, salto: 5, esquiva: 5, destello: 5, robo: 20, pausaPaseo: [100000, 100000], ignorado: 100000, advertencia: 100000 })
  })
  afterEach(() => { Object.assign(TIEMPOS, ORIGINAL); vaciar() })

  it('al dispararse, el rival aparece en Hoy con su nombre, y se guarda como pendiente', async () => {
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    expect(pedirRival(PELEA, () => 0)).toBe(true)
    const rival = await screen.findByRole('button', { name: 'Atrapar a Pereza' })
    expect(rival.textContent).toContain('Pereza')
    expect(hayRival()).toBe(true)
    expect(rivalPendiente()?.distraccionId).toBe('pereza')
    expect(document.querySelector('.rv-shinobi')).toBeTruthy()
  })

  it('tocarlo: el shinobi corre y salta, y con el sorteo en 0 lo atrapa al primer toque → batalla contra ese rival', async () => {
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    pedirRival(PELEA, () => 0)
    const rival = await screen.findByRole('button', { name: 'Atrapar a Pereza' })
    fireEvent.click(rival)
    expect(document.querySelector('.rv-shinobi.corre')).toBeTruthy()
    await waitFor(() => expect(hayDuelo()).toBe(true), { timeout: 3000 })
    expect(dueloEnCurso()?.batalla?.pelea.distraccion.id).toBe('pereza')
    expect(hayRival()).toBe(false)
    expect(rivalPendiente()).toBeNull()
  })

  it('con el sorteo en 0,6 se escabulle una vez: el primer toque no lo atrapa, el segundo sí', async () => {
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    pedirRival(PELEA, () => 0.6)
    const rival = await screen.findByRole('button', { name: 'Atrapar a Pereza' })
    expect(rival.getAttribute('data-escapes')).toBe('1')
    fireEvent.click(rival)
    await waitFor(() => expect(document.querySelector('.rv-rival.esquiva')).toBeTruthy(), { timeout: 3000 })
    await waitFor(() => expect(document.querySelector('.rv-rival.paseo')).toBeTruthy(), { timeout: 3000 })
    expect(hayDuelo()).toBe(false)
    expect(rival.getAttribute('data-escapes')).toBe('0')
    fireEvent.click(rival)
    await waitFor(() => expect(hayDuelo()).toBe(true), { timeout: 3000 })
  })

  it('ignorado: advertencia que rompe la pantalla y, pasado el tiempo, el robo de 10 XP con su sello', async () => {
    await concederXp({ clave: 'prueba:xp', cantidad: 40, origen: 'manual', fecha: HOY, descripcion: 'de prueba' })
    const antes = await xpTotal()
    Object.assign(TIEMPOS, { ignorado: 30, advertencia: 40 })
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    pedirRival(PELEA, () => 0)
    await screen.findByRole('button', { name: 'Atrapar a Pereza' })
    const adv = await screen.findByRole('dialog', { name: 'Pereza está por robarte progreso' })
    expect(adv.textContent).toContain('¡Atraparlo!')
    await waitFor(() => expect(hayRival()).toBe(false), { timeout: 3000 })
    expect(await xpTotal()).toBe(antes - 10)
    const peleas = await peleasDelDia(HOY)
    expect(peleas).toHaveLength(1)
    expect(peleas[0]).toMatchObject({ resultado: 'escapo', robo: 10, distraccion: 'pereza' })
    expect(rivalPendiente()).toBeNull()
  })

  it('en la advertencia, «¡Atraparlo!» va a la batalla sin robo', async () => {
    Object.assign(TIEMPOS, { ignorado: 30 })
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    pedirRival(PELEA, () => 0)
    const boton = await screen.findByRole('button', { name: '¡Atraparlo!' })
    fireEvent.click(boton)
    await waitFor(() => expect(hayDuelo()).toBe(true), { timeout: 3000 })
    expect(await peleasDelDia(HOY)).toHaveLength(0)
  })

  it('cerrar la app con el rival en pantalla: al volver, la advertencia', async () => {
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    pedirRival(PELEA, () => 0)
    await screen.findByRole('button', { name: 'Atrapar a Pereza' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await screen.findByRole('dialog', { name: 'Pereza está por robarte progreso' })
  })

  it('si quedó un rival de otra sesión, un rival nuevo espera: primero la advertencia del viejo', async () => {
    guardarRivalPendiente(PELEA, ahora() - 60_000)
    render(<MemoryRouter initialEntries={['/']}><RivalCapa /></MemoryRouter>)
    expect(pedirRival({ ...PELEA, distraccion: DISTRACCIONES_MUESTRA[0] }, () => 0)).toBe(false)
    await screen.findByRole('dialog', { name: 'Pereza está por robarte progreso' })
  })

  it('al abrir la app con un rival pendiente guardado, arranca en la advertencia', async () => {
    guardarRivalPendiente(PELEA)
    render(<MemoryRouter initialEntries={['/mas']}><RivalCapa /></MemoryRouter>)
    await screen.findByRole('dialog', { name: 'Pereza está por robarte progreso' })
    expect(hayRival()).toBe(true)
  })
})
