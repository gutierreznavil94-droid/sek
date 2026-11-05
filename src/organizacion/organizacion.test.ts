import { describe, expect, it } from 'vitest'
import * as M from './modelo'
import { sugerir } from './sugerir'
import { almacenEnMemoria } from './almacen'
import { montarOrganizacion, montarTiraHoy } from './vista'

const HOY = '2026-11-05'
const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('Organización · modelo', () => {
  it('arranca con Sueltas y Personal, y normalizar agrega Sueltas si falta', () => {
    const d = M.datosIniciales(HOY)
    expect(d.frentes.map((f) => f.id)).toEqual(['sueltas', 'personal'])
    const viejo = M.normalizar({ frentes: [{ id: 'x', nombre: 'X', icono: '', color: '#fff', tareas: [{ id: 'a', texto: 'algo', estado: 'esperando' }] }] }, HOY)
    expect(viejo.frentes[0].tipo).toBe('sueltas')
    expect(viejo.frentes[1].tareas[0]).toMatchObject({ estado: 'por_hacer', quien: 'yo' })
    expect(viejo.ajustes.limiteHoy).toBe(3)
  })

  it('Clasificar exige todo y deja la tarea en el frente', () => {
    const d = M.datosIniciales(HOY)
    const it = M.anotar(d, 'Llamar a Facu', 'personal')
    expect(M.faltan({ quien: 'yo' })).toEqual(['imp', 'rapidez', 'donde', 'fecha'])
    expect(M.faltan({ quien: 'delegar', imp: 'alta', rapidez: 'rapida', donde: 'nada', fecha: 'libre' })).toEqual(['quien'])
    expect(M.clasificar(d, it.id, 'personal', { quien: 'yo' }, HOY)).toBeNull()
    const t = M.clasificar(d, it.id, 'personal', { quien: 'yo', imp: 'alta', rapidez: 'rapida', donde: 'nada', fecha: HOY }, HOY)!
    expect(t).toMatchObject({ texto: 'Llamar a Facu', imp: 'alta', fecha: HOY, quien: 'yo' })
    expect(t.donde).toBeUndefined()
    expect(d.bandeja).toHaveLength(0)
    expect(M.meToca(d, HOY)).toHaveLength(1)
  })

  it('«Hoy me toca a mí» es solo lo mío con fecha de hoy o vencida', () => {
    const d = M.datosIniciales(HOY)
    const p = d.frentes[1]
    p.tareas.push(
      { id: '1', texto: 'mía hoy', estado: 'por_hacer', quien: 'yo', fecha: HOY, creada: 1 },
      { id: '2', texto: 'mía vencida', estado: 'por_hacer', quien: 'yo', fecha: '2026-11-01', creada: 1 },
      { id: '3', texto: 'mía mañana', estado: 'por_hacer', quien: 'yo', fecha: '2026-11-06', creada: 1 },
      { id: '4', texto: 'delegada', estado: 'por_hacer', quien: 'delegar', quienNombre: 'Facu', fecha: HOY, creada: 1 },
      { id: '5', texto: 'hecha', estado: 'hecho', quien: 'yo', fecha: HOY, creada: 1 },
      { id: '6', texto: 'libre', estado: 'por_hacer', quien: 'yo', creada: 1 },
    )
    expect(M.meToca(d, HOY).map((x) => x.t.id)).toEqual(['2', '1'])
  })

  it('eliminar borra el frente con sus tareas; Sueltas no se elimina ni se finaliza', () => {
    const d = M.datosIniciales(HOY)
    const f = M.nuevoFrente(d, HOY, 'Tumi')
    f.tareas.push({ id: 'a', texto: 'x', estado: 'por_hacer', quien: 'yo', creada: 1 })
    expect(M.eliminarFrente(d, 'sueltas')).toBeNull()
    expect(M.finalizarFrente(d, 'sueltas', HOY)).toBeNull()
    expect(M.eliminarFrente(d, f.id)?.nombre).toBe('Tumi')
    expect(d.frentes.some((x) => x.id === f.id)).toBe(false)
  })

  it('sugerir solo resalta y aprende cuando se elige otro', () => {
    const d = M.datosIniciales(HOY)
    const obras = M.nuevoFrente(d, HOY, 'Obras')
    obras.palabras = ['fibra', 'postes']
    expect(sugerir(d, 'Revisar postes de la fibra')?.f).toBe(obras)
    d.ajustes.sugerir = false
    expect(sugerir(d, 'Revisar postes de la fibra')).toBeNull()
  })

  it('el límite va de 1 a 9', () => {
    const d = M.datosIniciales(HOY)
    for (let i = 0; i < 20; i++) M.cambiarLimite(d, 1)
    expect(d.ajustes.limiteHoy).toBe(9)
    for (let i = 0; i < 20; i++) M.cambiarLimite(d, -1)
    expect(d.ajustes.limiteHoy).toBe(1)
  })
})

describe('Organización · pantalla', () => {
  it('se monta sin React, anota, clasifica, marca hecha y avisa', async () => {
    const almacen = almacenEnMemoria()
    const avisos: string[] = []
    const eventos: string[] = []
    const lugar = document.createElement('div')
    document.body.appendChild(lugar)
    const o = montarOrganizacion(lugar, { almacen, hoy: () => HOY, nombre: 'Navil', alAvisar: (a) => avisos.push(a), tema: { color: () => '', icono: () => '', evento: (n) => eventos.push(n) } })
    await espera()
    expect(lugar.textContent).toContain('Organización')
    expect(lugar.textContent).toContain('Sueltas')

    // Anotar
    ;(document.querySelector('.fr-fab') as HTMLElement).click()
    const form = document.querySelector('[data-anotar-form]') as HTMLFormElement
    ;(form.querySelector('input') as HTMLInputElement).value = 'Pagar la luz'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(lugar.textContent).toContain('1 sin clasificar')

    // Clasificar
    ;(lugar.querySelector('[data-clasificar]') as HTMLElement).click()
    const tocar = (s: string) => (document.querySelector(s) as HTMLElement).click()
    tocar('[data-clas="imp|alta"]')
    tocar('[data-clas="rapidez|rapida"]')
    tocar('[data-clas="donde|celu"]')
    tocar(`[data-clas="fecha|${HOY}"]`)
    tocar('[data-a="sueltas"]')
    expect(avisos).toContain('tarea.creada')
    await espera(250)
    expect(lugar.textContent).toContain('Pagar la luz')

    // Marcar hecha desde la tira
    tocar('.fr-btn-ok')
    expect(avisos).toContain('tarea.hecha')
    expect(eventos).toContain('completar')
    expect(eventos).toContain('logro')
    await espera()
    const guardado = almacen.actual() as { frentes: { tareas: { estado: string }[] }[] }
    expect(guardado.frentes[0].tareas[0].estado).toBe('hecho')

    o.desmontar()
    expect(document.querySelector('.fr-capas')).toBeNull()
  })

  it('la tira de Hoy muestra lo que me toca', async () => {
    const d = M.datosIniciales(HOY)
    d.frentes[1].tareas.push({ id: '1', texto: 'Turno médico', estado: 'por_hacer', quien: 'yo', fecha: HOY, creada: 1 })
    const lugar = document.createElement('div')
    const t = montarTiraHoy(lugar, { almacen: almacenEnMemoria(d), hoy: () => HOY })
    await espera()
    expect(lugar.textContent).toContain('Hoy me toca a mí')
    expect(lugar.textContent).toContain('Turno médico')
    t.desmontar()
  })
})
