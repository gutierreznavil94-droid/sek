import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { alarmasDelDia } from './alarmas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes, registrarDejoCelu } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'
import { corregirLevantado, duracionSuenio, entrarModoSuenio, horaDeMinutos, latenciaAprendida, registrarAperturaEnSuenio, registrarDespertar, resumenSuenio, salirModoSuenio, terminarModoSuenioSiCorresponde } from './suenio'

const Z = 'America/Argentina/Cordoba'
const en = (fecha: string, hm: string) => instanteDe(fecha, hm, Z)
let n = 0

/** Una noche completa: dejo celu a `hm`, aperturas opcionales, y se levanta a `levanta` (HH:MM del día siguiente). */
async function noche(fecha: string, hm: string, siguiente: string, levanta: string | null, aperturas: string[] = []) {
  fijarAhora(en(fecha, hm))
  const r = await registrarDejoCelu()
  await entrarModoSuenio(r.noche, !r.cumplido)
  for (const a of aperturas) {
    fijarAhora(en(fecha, a))
    await registrarAperturaEnSuenio()
  }
  // La noche se cierra con la primera apertura de la app a la mañana (o a la tarde, si no la abrió).
  fijarAhora(en(siguiente, levanta ?? '14:00'))
  await terminarModoSuenioSiCorresponde()
}

beforeEach(async () => {
  await usarBaseDePruebas(`prueba-suenio-${++n}`)
  reiniciarReloj()
  fijarAhora(en('2026-11-02', '08:00'))
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
  await cerrarDiasPendientes()
})

describe('registro de sueño (cambios 11)', () => {
  it('dejo celu 21:10 → dormido 21:35 (25 min); abre la app 05:02 → levantado 04:57 → 7 h 22 min', async () => {
    await noche('2026-11-02', '21:10', '2026-11-03', '05:02')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.dormido).toBe(en('2026-11-02', '21:35'))
    expect(reg.despertarPrevisto).toBe(en('2026-11-03', '05:00'))
    expect(reg.levantado).toBe(en('2026-11-03', '04:57'))
    expect(reg.minutosDormido).toBe(7 * 60 + 22)
    expect(duracionSuenio(reg.minutosDormido!)).toBe('7 h 22 min')
  })

  it('abrir el celu a los 20 min corre la hora de dormirse; abrirlo a las 3:00 no', async () => {
    await noche('2026-11-02', '21:10', '2026-11-03', '05:00', ['21:30'])
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.dormido).toBe(en('2026-11-02', '21:55'))
    expect(reg.aperturas).toBe(1)
    expect(reg.minutosDormido).toBe(7 * 60)
    // Segunda noche: apertura de madrugada (ya dormía) no cambia la estimación
    fijarAhora(en('2026-11-03', '21:00'))
    const r = await registrarDejoCelu()
    await entrarModoSuenio(r.noche, !r.cumplido)
    fijarAhora(en('2026-11-04', '03:00'))
    await registrarAperturaEnSuenio()
    const reg2 = (await db().suenio.where('noche').equals('2026-11-03').first())!
    // Con una sola noche observada todavía se usa la base (25): 21:00 + 25 = 21:25
    expect(reg2.dormido).toBe(en('2026-11-03', '21:25'))
    expect(reg2.aperturas).toBe(1)
  })

  it('si no abre la app a la mañana, se usa el despertar previsto; abrirla a la tarde no lo estira', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', null)
    fijarAhora(en('2026-11-03', '14:00'))
    const reg = (await registrarDespertar('2026-11-02'))!
    expect(reg.levantado).toBe(en('2026-11-03', '05:00'))
    expect(reg.minutosDormido).toBe(7 * 60 + 35)
  })

  it('salir del modo sueño a las 4:56 cierra la noche: levantado = 4:51 (5 min antes de agarrar el celu)', async () => {
    fijarAhora(en('2026-11-02', '21:00'))
    const r = await registrarDejoCelu()
    await entrarModoSuenio(r.noche, !r.cumplido)
    fijarAhora(en('2026-11-03', '04:56'))
    await salirModoSuenio('Salida a mano')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.levantado).toBe(en('2026-11-03', '04:51'))
    expect(reg.minutosDormido).toBe(7 * 60 + 26)
  })

  it('la hora de levantarse se puede corregir a mano y queda marcada', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', '05:10')
    const reg = (await corregirLevantado('2026-11-02', '05:30'))!
    expect(reg.levantado).toBe(en('2026-11-03', '05:30'))
    expect(reg.minutosDormido).toBe(8 * 60 + 5)
    expect(reg.levantadoCorregido).toBe(true)
    const r = await resumenSuenio('2026-11-03')
    expect(r.anoche?.corregido).toBe(true)
    expect(horaDeMinutos(r.anoche!.levantado)).toBe('05:30')
  })

  it('aprende la latencia: con aperturas tempranas repetidas pasa de 25 a la mediana real', async () => {
    expect(await latenciaAprendida()).toBe(25)
    await noche('2026-11-02', '21:00', '2026-11-03', '05:00', ['21:20'])
    await noche('2026-11-03', '21:00', '2026-11-04', '05:00', ['21:30'])
    await noche('2026-11-04', '21:00', '2026-11-05', '05:00', ['21:16'])
    // Latencias reales: 45, 55 y 41 → mediana 45
    expect(await latenciaAprendida()).toBe(45)
    fijarAhora(en('2026-11-05', '21:00'))
    const r = await registrarDejoCelu()
    await entrarModoSuenio(r.noche, !r.cumplido)
    const reg = (await db().suenio.where('noche').equals('2026-11-05').first())!
    expect(reg.dormido).toBe(en('2026-11-05', '21:45'))
    expect(reg.latenciaMinutos).toBe(45)
  })

  it('el resumen de 14 días: promedios, regularidad, diferencia con el objetivo y «anoche»', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', '05:00')
    await noche('2026-11-03', '21:30', '2026-11-04', '05:10')
    await noche('2026-11-04', '21:00', '2026-11-05', '04:50')
    const r = await resumenSuenio('2026-11-05')
    expect(r.noches).toHaveLength(3)
    expect(r.anoche?.noche).toBe('2026-11-04')
    expect(horaDeMinutos(r.promedio!.acostado)).toBe('21:10')
    expect(horaDeMinutos(r.promedio!.dormido)).toBe('21:35')
    // Se levanta 5 min antes de abrir la app: 04:55, 05:05 y 04:45
    expect(horaDeMinutos(r.promedio!.levantado)).toBe('04:55')
    // 7:30, 7:10 y 7:20 → 7 h 20 min; objetivo 7,5 h → faltan 10 min
    expect(r.promedio!.minutos).toBe(7 * 60 + 20)
    expect(r.diferenciaObjetivo).toBe(-10)
    expect(r.regularidadMinutos).toBe(14)
    expect(r.objetivoMinutos).toBe(450)
  })

  it('no hay alarma de despertar; los minutos antes de agarrar el celu se respetan desde los ajustes', async () => {
    expect((await alarmasDelDia('2026-11-03')).map((a) => a.tipo)).toEqual(['revision', 'celu', 'dormido'])
    await guardarAjustes({ minutosAntesDelCelu: 10 })
    await noche('2026-11-02', '21:00', '2026-11-03', '05:12')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.levantado).toBe(en('2026-11-03', '05:02'))
  })
})
