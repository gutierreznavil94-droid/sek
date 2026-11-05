import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { DISTRACCIONES_MUESTRA, TOPE_NINJAS_DIA, accionDePelea, debeMostrarTajo, distraccionesDe, elegirNinja, guardarDistracciones, momentoActivo, ninjasVencidosSemana, nuevaDistraccion, peleasDelDia, prepararPelea, puedeAparecer, registrarPelea } from './ninjas'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
let n = 0
beforeEach(async () => {
  await usarBaseDePruebas(`ninjas-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-02', '19:25', Z))
  await inicializarSiHaceFalta()
})

describe('ninjas de la distracción', () => {
  it('momentos: pilar a 15 min, noche después de «Dejo celu», límite de juego; el primero que aplica', () => {
    const pil = [{ id: 'entrenamiento', nombre: 'Entrenar', horaLimite: '19:35', entreno: true }]
    expect(momentoActivo({ minutoActual: 19 * 60 + 19, pilaresPendientes: pil, pasoDejoCelu: false, juegoPasado: false })).toBeNull()
    expect(momentoActivo({ minutoActual: 19 * 60 + 20, pilaresPendientes: pil, pasoDejoCelu: false, juegoPasado: false })).toMatchObject({ momento: 'pilar', pilar: { id: 'entrenamiento' } })
    expect(momentoActivo({ minutoActual: 19 * 60 + 36, pilaresPendientes: pil, pasoDejoCelu: false, juegoPasado: false })).toBeNull()
    expect(momentoActivo({ minutoActual: 22 * 60, pilaresPendientes: [], pasoDejoCelu: true, juegoPasado: true })?.momento).toBe('noche')
    expect(momentoActivo({ minutoActual: 22 * 60, pilaresPendientes: [], pasoDejoCelu: false, juegoPasado: true })?.momento).toBe('juego')
    expect(accionDePelea({ momento: 'pilar', pilar: { id: 'entrenamiento', nombre: 'Entrenar', entreno: true } })).toEqual({ etiqueta: 'Empezar Entrenar', ruta: '/entreno' })
    expect(accionDePelea({ momento: 'noche' }).etiqueta).toBe('Dejo celu')
  })

  it('la lista la edita la persona: arranca con 3 de muestra, se agregan, renombran y borran; vacía = sin ninjas', async () => {
    expect(distraccionesDe({})).toEqual(DISTRACCIONES_MUESTRA)
    const lista = [...DISTRACCIONES_MUESTRA, nuevaDistraccion('Series', 'noche')]
    await guardarDistracciones(lista.filter((d) => d.id !== 'juego').map((d) => (d.id === 'celu' ? { ...d, nombre: 'Instagram' } : d)))
    const a = (await db().ajustes.get('unicos'))!
    expect(distraccionesDe(a).map((d) => d.nombre)).toEqual(['Instagram', 'Pereza', 'Series'])
    // El asignado al momento sale primero; si no hay, uno al azar sin repetir en el día
    expect(elegirNinja(distraccionesDe(a), 'noche', [])?.nombre).toBe('Series')
    expect(elegirNinja(distraccionesDe(a), 'pilar', ['celu'], () => 0)?.nombre).toBe('Pereza')
    await guardarDistracciones([])
    expect(await prepararPelea('2026-11-02', { momento: 'duda' })).toBeNull()
  })

  it('tope: 2 apariciones automáticas por día y una por momento; el botón «Estoy dudando» no tiene tope; sello del día', async () => {
    const p1 = await prepararPelea('2026-11-02', { momento: 'pilar', pilar: { id: 'entrenamiento', nombre: 'Entrenar', entreno: true } }, () => 0)
    expect(p1).not.toBeNull()
    await registrarPelea(p1!, 'vencido')
    expect(await puedeAparecer('2026-11-02', 'pilar')).toBe(false) // ese momento ya salió hoy
    const p2 = await prepararPelea('2026-11-02', { momento: 'noche' })
    expect(p2).not.toBeNull()
    expect(p2!.distraccion.id).not.toBe(p1!.distraccion.id) // sin repetir en el día
    await registrarPelea(p2!, 'escapo')
    expect(await prepararPelea('2026-11-02', { momento: 'juego' })).toBeNull() // tope de 2
    expect(TOPE_NINJAS_DIA).toBe(2)
    const p3 = await prepararPelea('2026-11-02', { momento: 'duda' })
    expect(p3).not.toBeNull()
    await registrarPelea(p3!, 'vencido')
    const sello = await peleasDelDia('2026-11-02')
    expect(sello.map((x) => x.resultado)).toEqual(['vencido', 'escapo', 'vencido'])
    expect(sello[0]).toMatchObject({ momento: 'pilar', pilar: 'entrenamiento', distraccion: 'celu' })
    expect(await ninjasVencidosSemana('2026-11-04')).toEqual({ vencidos: 2, peleas: 3 })
    // Ajuste apagado: nada
    await guardarAjustes({ ninjas: false })
    expect(await prepararPelea('2026-11-03', { momento: 'duda' })).toBeNull()
  })

  it('el tajo: al volver después de 3 h con un pilar pendiente, una vez por día y no de noche', () => {
    const t = Date.parse('2026-11-02T18:00:00-03:00')
    const h = 3_600_000
    expect(debeMostrarTajo({ ultimaVista: t - 3 * h, ahora: t, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: false })).toBe(true)
    expect(debeMostrarTajo({ ultimaVista: t - 2 * h, ahora: t, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: false })).toBe(false)
    expect(debeMostrarTajo({ ultimaVista: t - 4 * h, ahora: t, pilarPendiente: false, pasoDejoCelu: false, mostradoHoy: false })).toBe(false)
    expect(debeMostrarTajo({ ultimaVista: t - 4 * h, ahora: t, pilarPendiente: true, pasoDejoCelu: true, mostradoHoy: false })).toBe(false)
    expect(debeMostrarTajo({ ultimaVista: t - 4 * h, ahora: t, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: true })).toBe(false)
    expect(debeMostrarTajo({ ultimaVista: null, ahora: t, pilarPendiente: true, pasoDejoCelu: false, mostradoHoy: false })).toBe(false)
  })
})
