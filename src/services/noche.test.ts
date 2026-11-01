import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes, cerrarVentanaNoche, completarCompromiso, pilaresDelDia, registrarDejoCelu, ventanaNoche } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'
import { guardarRevision, datosSemana } from './revisiones'
import { entrarModoSuenio, modoSuenioActivo, registrarAperturaEnSuenio, salirModoSuenio, terminarModoSuenioSiCorresponde } from './suenio'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
const F = '2026-11-02'
const en = (hm: string, fecha = F) => instanteDe(fecha, hm, Z)
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`prueba-noche-${++n}`)
  reiniciarReloj()
  fijarAhora(en('08:00'))
  await inicializarSiHaceFalta()
  await iniciarCiclo(F)
  await cerrarDiasPendientes()
})

describe('cambios 06 · las 20:50 son el máximo, con 10 minutos de margen', () => {
  it('la ventana de la noche: aviso 20:50, cierre 21:00, dejo celu tarde hasta 22:15', async () => {
    const v = await ventanaNoche(F)
    expect(v.horaAviso).toBe('20:50')
    expect(v.horaCierre).toBe('21:00')
    expect(v.instanteCierre - v.instanteAviso).toBe(10 * 60_000)
    expect(v.instanteFinCelu).toBe(en('22:15'))
  })

  it('manga a las 20:55 cuenta (margen); a las 21:05 queda tarde y sin XP', async () => {
    fijarAhora(en('20:55'))
    const r1 = await completarCompromiso(`manga:${F}`)
    expect(r1.compromiso.estado).toBe('completado')
    expect(r1.xp).toBe(15)
    fijarAhora(en('21:05'))
    const r2 = await completarCompromiso(`empresa:${F}`)
    expect(r2.compromiso.estado).toBe('tarde')
    expect(r2.xp).toBe(0)
    expect(r2.motivoSinXp).toContain('21:00')
  })

  it('a las 21:00 lo que sigue sin marcar queda omitido: manga, empresa y la revisión', async () => {
    fijarAhora(en('20:59'))
    expect(await cerrarVentanaNoche(F)).toEqual([])
    fijarAhora(en('21:01'))
    const omitidos = (await cerrarVentanaNoche(F)).sort()
    expect(omitidos).toEqual([`empresa:${F}`, `manga:${F}`, `revision_diaria:${F}`])
    const p = await pilaresDelDia(F)
    expect(p.pilares.find((x) => x.accion.id === 'manga')?.estado).toBe('omitido')
    // Dormir a horario y entrenamiento no se tocan.
    expect(p.pilares.find((x) => x.accion.id === 'acostarse')?.estado).toBe('pendiente')
    // Idempotente y lo aplica también cerrarDiasPendientes.
    expect(await cerrarVentanaNoche(F)).toEqual([])
    await cerrarDiasPendientes()
  })

  it('la revisión guardada a las 20:52 da sus 10 XP una sola vez', async () => {
    fijarAhora(en('20:52'))
    const r = await guardarRevision('diaria', F, { obstaculo: 'Ninguno', detalle: '', ajuste: 'Entrenar apenas llego' }, {})
    expect(r.xp).toBe(10)
    const r2 = await guardarRevision('diaria', F, { obstaculo: 'Cansancio', detalle: '', ajuste: 'Otro' }, {})
    expect(r2.xp).toBe(0)
    expect(await xpTotal()).toBe(10)
  })
})

describe('cambios 06 · dejo celu y modo sueño', () => {
  it('21:10 = cumplido con XP; 21:40 = tarde sin XP; 22:20 ya no se registra', async () => {
    fijarAhora(en('21:10'))
    const a = await registrarDejoCelu()
    expect(a.cumplido).toBe(true)
    expect(a.xp).toBe(20)
    // Otra noche: tarde.
    await db().suenio.clear()
    await db().compromisos.update(`acostarse:${F}`, { estado: 'pendiente' })
    fijarAhora(en('21:40'))
    const b = await registrarDejoCelu()
    expect(b.cumplido).toBe(false)
    expect(b.registro.retrasoMinutos).toBe(25)
    expect(b.xp).toBe(0)
    fijarAhora(en('22:20'))
    await expect(registrarDejoCelu()).rejects.toThrow('22:15')
    await db().suenio.clear()
    await db().compromisos.update(`acostarse:${F}`, { estado: 'pendiente' })
    const p = await pilaresDelDia(F)
    expect(p.pilares.find((x) => x.accion.id === 'acostarse')?.ventanaCerrada).toBe(true)
  })

  it('entra en modo sueño hasta las 5:00, sobrevive a recargar, y termina solo a esa hora', async () => {
    fijarAhora(en('21:10'))
    const r = await registrarDejoCelu()
    const m = await entrarModoSuenio(r.noche, !r.cumplido)
    expect(m.hasta).toBe(en('05:00', '2026-11-03'))
    expect(m.tarde).toBe(false)
    expect(m.resumen).toContain('pilares hoy')
    // «Recargar»: el estado sigue en la base.
    expect((await modoSuenioActivo())?.noche).toBe(F)
    expect(await terminarModoSuenioSiCorresponde(en('03:00', '2026-11-03'))).toBeNull()
    // Abrir la app durante el modo sueño queda anotado (solo la hora), sin XP.
    const xpAntes = await xpTotal()
    expect(await registrarAperturaEnSuenio(en('23:30'))).toBe(1)
    expect(await registrarAperturaEnSuenio(en('23:30') + 10_000)).toBe(1) // misma apertura
    expect(await registrarAperturaEnSuenio(en('01:00', '2026-11-03'))).toBe(2)
    expect(await xpTotal()).toBe(xpAntes)
    const t = await terminarModoSuenioSiCorresponde(en('05:00', '2026-11-03'))
    expect(t?.noche).toBe(F)
    expect(await modoSuenioActivo()).toBeUndefined()
    // La revisión semanal ve las aperturas.
    fijarAhora(en('10:00', '2026-11-03'))
    const semana = await datosSemana('2026-11-03', '2026-11-03')
    expect(semana.aperturasSuenio).toBe(2)
  })

  it('salir antes de hora queda en el historial', async () => {
    fijarAhora(en('21:40'))
    const r = await registrarDejoCelu()
    const m = await entrarModoSuenio(r.noche, !r.cumplido)
    expect(m.tarde).toBe(true)
    await salirModoSuenio('Emergencia')
    expect(await modoSuenioActivo()).toBeUndefined()
    const ev = await db().eventos.filter((e) => e.tipo === 'modo_suenio' && !!e.motivo?.includes('Emergencia')).toArray()
    expect(ev.length).toBe(1)
  })
})
