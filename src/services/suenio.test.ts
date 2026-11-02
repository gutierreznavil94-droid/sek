import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { alarmasDelDia } from './alarmas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes, registrarDejoCelu } from './dia'
import { fijarAhora, reiniciarReloj } from './reloj'
import { corregirNoche, duracionSuenio, entrarModoSuenio, horaDeMinutos, registrarAperturaEnSuenio, resumenSuenio, salirModoSuenio, terminarModoSuenioSiCorresponde, volverAEstimado } from './suenio'
import { finVentana, levantadoEstimado, mejorDato, rangoDormido } from '../sueno/estimar'
import { FUENTES, combinarNoches, nochesEntre } from '../sueno/fuentes'

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

describe('registro de sueño (v0.34: Dejo celu + 15 min y ventana de levantarse)', () => {
  it('dejo celu 21:10 → dormido 21:25 (rango 21:20–21:30); abre la app 05:40 → levantado 05:07 (centro de 05:00–05:15)', async () => {
    await noche('2026-11-02', '21:10', '2026-11-03', '05:40')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.dormido).toBe(en('2026-11-02', '21:25'))
    expect(reg.latenciaMinutos).toBe(15)
    expect(reg.levantado).toBe(en('2026-11-03', '05:00') + 7.5 * 60_000)
    expect(reg.fuenteLevantado).toBe('estimado')
    expect(reg.minutosDormido).toBe(7 * 60 + 43)
    const r = await resumenSuenio('2026-11-03')
    expect(r.anoche!.dormidoRango!.map(horaDeMinutos)).toEqual(['21:20', '21:30'])
    expect(duracionSuenio(r.anoche!.minutos)).toBe('7 h 43 min')
  })

  it('la apertura del celu no cambia la hora de levantarse ni la de dormirse: solo cierra la noche', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', '04:58', ['21:20'])
    await noche('2026-11-03', '21:00', '2026-11-04', '06:30')
    const a = (await db().suenio.where('noche').equals('2026-11-02').first())!
    const b = (await db().suenio.where('noche').equals('2026-11-03').first())!
    expect(a.dormido).toBe(en('2026-11-02', '21:15'))
    expect(a.aperturas).toBe(1)
    expect(a.levantado).toBe(en('2026-11-03', '05:00') + 7.5 * 60_000)
    expect(b.levantado).toBe(en('2026-11-04', '05:00') + 7.5 * 60_000)
  })

  it('salir del modo sueño a las 4:56 cierra la noche con el centro de la ventana', async () => {
    fijarAhora(en('2026-11-02', '21:00'))
    const r = await registrarDejoCelu()
    await entrarModoSuenio(r.noche, !r.cumplido)
    fijarAhora(en('2026-11-03', '04:56'))
    await salirModoSuenio('Salida a mano')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.levantado).toBe(en('2026-11-03', '05:07') + 30_000)
  })

  it('la latencia y la ventana salen de los ajustes (latencia 10 a 30)', async () => {
    await guardarAjustes({ latenciaDormirseMinutos: 20, horaFinSuenio: '05:30' })
    await noche('2026-11-02', '21:00', '2026-11-03', '06:00')
    const reg = (await db().suenio.where('noche').equals('2026-11-02').first())!
    expect(reg.dormido).toBe(en('2026-11-02', '21:20'))
    expect(reg.levantado).toBe(en('2026-11-03', '05:37') + 30_000)
    await guardarAjustes({ latenciaDormirseMinutos: 90 })
    fijarAhora(en('2026-11-03', '21:00'))
    const r = await registrarDejoCelu()
    await entrarModoSuenio(r.noche, !r.cumplido)
    expect((await db().suenio.where('noche').equals('2026-11-03').first())!.dormido).toBe(en('2026-11-03', '21:30'))
  })

  it('cada dato se corrige a mano, queda marcado «corregido» y se puede volver a lo estimado', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', '05:10')
    let reg = await corregirNoche('2026-11-02', { dormido: '21:40', levantado: '05:30' })
    expect(reg.dormido).toBe(en('2026-11-02', '21:40'))
    expect(reg.levantado).toBe(en('2026-11-03', '05:30'))
    expect(reg.minutosDormido).toBe(7 * 60 + 50)
    let r = await resumenSuenio('2026-11-03')
    expect(r.anoche!.fuentes).toEqual({ acostado: 'estimado', dormido: 'corregido', levantado: 'corregido' })
    expect(r.anoche!.corregido).toBe(true)
    expect(r.anoche!.dormidoRango).toBeNull()
    // Corregir la hora de acostarse no toca «Dejo celu» ni el XP
    reg = await corregirNoche('2026-11-02', { acostado: '21:20' })
    expect(reg.horaReal).toBe(en('2026-11-02', '21:00'))
    expect(reg.cumplido).toBe(true)
    await volverAEstimado('2026-11-02', 'levantado')
    r = await resumenSuenio('2026-11-03')
    expect(horaDeMinutos(r.anoche!.levantado)).toBe('05:08')
    expect(r.anoche!.fuentes.levantado).toBe('estimado')
    await expect(corregirNoche('2026-11-02', { levantado: '21:30' })).rejects.toThrow()
  })

  it('una noche sin «Dejo celu» se carga a mano y no cuenta para dormir a horario', async () => {
    fijarAhora(en('2026-11-03', '09:00'))
    const reg = await corregirNoche('2026-11-02', { acostado: '22:30', levantado: '05:10' })
    expect(reg.sinDejoCelu).toBe(true)
    expect(reg.cumplido).toBe(false)
    expect(reg.dormido).toBe(en('2026-11-02', '22:45'))
    const r = await resumenSuenio('2026-11-03')
    expect(r.anoche!.minutos).toBe(6 * 60 + 25)
    expect(r.mejora.racha).toBe(0)
  })

  it('las noches guardadas antes de la v0.34 se leen como «estimado» sin perder nada', async () => {
    await db().suenio.add({ noche: '2026-11-02', horaPrevista: '21:15', horaReal: en('2026-11-02', '21:05'), retrasoMinutos: 0, cumplido: true, rutinaRegistrada: true, creado: 0, dormido: en('2026-11-02', '21:30'), latenciaMinutos: 25, levantado: en('2026-11-03', '04:57'), minutosDormido: 7 * 60 + 27 })
    await db().suenio.add({ noche: '2026-11-03', horaPrevista: '21:15', horaReal: en('2026-11-03', '21:00'), retrasoMinutos: 0, cumplido: true, rutinaRegistrada: true, creado: 0, dormido: en('2026-11-03', '21:25'), levantado: en('2026-11-04', '05:20'), levantadoCorregido: true, minutosDormido: 7 * 60 + 55 })
    const r = await resumenSuenio('2026-11-04')
    expect(r.noches.map((n) => n.minutos)).toEqual([7 * 60 + 27, 7 * 60 + 55])
    expect(r.noches[0].fuentes).toEqual({ acostado: 'estimado', dormido: 'estimado', levantado: 'estimado' })
    expect(r.noches[1].fuentes.levantado).toBe('corregido')
    expect(r.mejora.racha).toBe(2)
  })

  it('cómo vas mejorando: semana contra la anterior, regularidad y racha', async () => {
    for (let i = 0; i < 6; i++) {
      const f = `2026-11-0${2 + i}`
      const sig = `2026-11-0${3 + i}`
      await noche(f, i % 2 ? '21:10' : '21:00', sig, '05:20')
    }
    const r = await resumenSuenio('2026-11-08')
    expect(r.noches).toHaveLength(6)
    expect(r.mejora.racha).toBe(6)
    expect(r.mejora.semana).toBe(7 * 60 + 48)
    expect(r.mejora.semanaAnterior).toBeNull()
    expect(r.mejora.regularidad).toBe(5)
    expect(r.objetivoMinutos).toBe(450)
  })

  it('no hay alarma de despertar', async () => {
    expect((await alarmasDelDia('2026-11-03')).map((a) => a.tipo)).toEqual(['revision', 'celu', 'dormido'])
  })
})

describe('fuentes de sueño', () => {
  it('prioridad por dato: reloj > corregido > estimado', () => {
    const e = { noche: '2026-11-02', acostado: { valor: 1, fuente: 'estimado' as const }, dormido: { valor: 2, fuente: 'estimado' as const }, levantado: { valor: 9, fuente: 'corregido' as const } }
    const reloj = { noche: '2026-11-02', dormido: { valor: 3, fuente: 'reloj' as const }, levantado: { valor: 8, fuente: 'reloj' as const }, etapas: [{ tipo: 'profundo' as const, inicio: 3, fin: 5 }] }
    const [n] = combinarNoches([[e], [reloj]])
    expect(n.acostado).toEqual({ valor: 1, fuente: 'estimado' })
    expect(n.dormido).toEqual({ valor: 3, fuente: 'reloj' })
    expect(n.levantado).toEqual({ valor: 8, fuente: 'reloj' })
    expect(n.etapas).toHaveLength(1)
    expect(mejorDato([{ valor: 1, fuente: 'corregido' as const }, { valor: 2, fuente: 'estimado' as const }])?.valor).toBe(1)
  })

  it('una fuente de reloj se suma sin tocar las pantallas', async () => {
    await noche('2026-11-02', '21:00', '2026-11-03', '05:30')
    const reloj = { id: 'reloj', nombre: 'Reloj', disponible: async () => true, traerNoches: async () => [{ noche: '2026-11-02', dormido: { valor: en('2026-11-02', '21:50'), fuente: 'reloj' as const }, levantado: { valor: en('2026-11-03', '05:02'), fuente: 'reloj' as const } }] }
    const [n] = await nochesEntre('2026-11-01', '2026-11-03', [...FUENTES, reloj])
    expect(n.dormido?.fuente).toBe('reloj')
    expect(n.acostado?.fuente).toBe('estimado')
  })

  it('estimación: rango de dormido y ventana', () => {
    expect(rangoDormido(0, 15)).toEqual([10 * 60_000, 20 * 60_000])
    expect(finVentana('05:00')).toBe('05:15')
    expect(levantadoEstimado('2026-11-02', '05:00', Z)).toBe(en('2026-11-03', '05:07') + 30_000)
  })
})
