import { beforeEach, describe, expect, it } from 'vitest'
import { usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { fijarAhora, reiniciarReloj } from './reloj'
import { ETAPAS_SUGERIDAS, TOLERANCIA_SUGERIDA, estadoAdaptacion, etapaDe, fraseDeEtapa, inicioAdaptacion, normalizarEtapas, tramosDeEtapas, veredictoDe, veredictoNoche, type ConfigEtapa, type EtapaActual } from './adaptacion'
import { corregirNoche, nochesDeSuenio } from './suenio'

const Z = 'America/Argentina/Cordoba'
const INICIO = '2026-11-02'
const etapaEn = (dia: string, etapas: ConfigEtapa[] = ETAPAS_SUGERIDAS): EtapaActual => etapaDe(dia, INICIO, etapas)
/** Acostado a las 21:00 (dejo celu 21:15), durmió `min` minutos. */
const ver = (x: Partial<Parameters<typeof veredictoNoche>[0]> & { etapa: EtapaActual }) => veredictoNoche({ acostado: 21 * 60, horaDejarCelu: '21:15', tolerancia: TOLERANCIA_SUGERIDA, minutos: 7 * 60 + 40, ...x })

describe('adaptación del sueño: etapas', () => {
  it('semanas 1–2 acostumbrando, 3–4 asentando, 5+ estable (lo sugerido)', () => {
    expect(etapaEn('2026-11-02')).toMatchObject({ indice: 0, semana: 1, dia: 1, semanaEnEtapa: 1 })
    expect(etapaEn('2026-11-15')).toMatchObject({ indice: 0, semana: 2, dia: 14 })
    expect(etapaEn('2026-11-16')).toMatchObject({ indice: 1, semana: 3, semanaEnEtapa: 1 })
    expect(etapaEn('2026-11-29')).toMatchObject({ indice: 1, semana: 4 })
    expect(etapaEn('2026-11-30')).toMatchObject({ indice: 2, semana: 5, esUltima: true })
    expect(etapaEn('2027-03-01')).toMatchObject({ indice: 2, esUltima: true })
    // Antes del inicio: día 1.
    expect(etapaEn('2026-10-20')).toMatchObject({ indice: 0, dia: 1 })
  })

  it('las duraciones son editables: 1 semana acostumbrando y 3 asentando', () => {
    const etapas: ConfigEtapa[] = [{ ...ETAPAS_SUGERIDAS[0], semanas: 1 }, { ...ETAPAS_SUGERIDAS[1], semanas: 3 }, ETAPAS_SUGERIDAS[2]]
    expect(etapaEn('2026-11-08', etapas).indice).toBe(0)
    expect(etapaEn('2026-11-09', etapas).indice).toBe(1)
    expect(etapaEn('2026-11-29', etapas)).toMatchObject({ indice: 1, semana: 4 })
    expect(etapaEn('2026-11-30', etapas).indice).toBe(2)
    const tramos = tramosDeEtapas(INICIO, etapas)
    expect(tramos.map((t) => [t.desde, t.hasta])).toEqual([['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-29'], ['2026-11-30', null]])
  })

  it('normaliza lo editado: horas mín ≤ máx, semanas 0–12, despertares 0–5', () => {
    const [e] = normalizarEtapas([{ nombre: ' ', semanas: 40, horasMin: 9, horasMax: 5, despertaresNormales: 9 }])
    expect(e).toEqual({ nombre: 'Etapa', semanas: 12, horasMin: 9, horasMax: 9, despertaresNormales: 5 })
  })

  it('frase de la etapa', () => {
    expect(fraseDeEtapa(etapaEn('2026-11-05'))).toContain('Semana 1 · Acostumbrando')
    expect(fraseDeEtapa(etapaEn('2026-12-05'))).toContain('Estable')
  })
})

describe('adaptación del sueño: veredicto de la noche (prioridad: acostarse a horario)', () => {
  it('a horario y horas en rango: dormiste bien', () => {
    const v = ver({ etapa: etapaEn('2026-11-03') })
    expect(v).toMatchObject({ aHorario: true, enRango: true, tono: 'bien' })
    expect(v.texto).toBe('Dormiste bien: a horario y 7 h 40.')
  })

  it('tolerancia ±20: 21:35 sigue siendo a horario, 21:36 es tarde (no cumplido, como hoy)', () => {
    expect(ver({ etapa: etapaEn('2026-11-03'), acostado: 21 * 60 + 35 }).aHorario).toBe(true)
    const v = ver({ etapa: etapaEn('2026-11-03'), acostado: 21 * 60 + 36 })
    expect(v).toMatchObject({ aHorario: false, tono: 'tarde' })
    expect(v.texto).toBe('Te acostaste tarde (21:36). Mañana, a horario.')
    // Después de medianoche también es tarde.
    expect(ver({ etapa: etapaEn('2026-11-03'), acostado: 24 * 60 + 10 }).texto).toContain('(00:10)')
  })

  it('semana 1–2, a horario pero pocas horas o despertares: es normal, cuerpo acostumbrándose', () => {
    const v = ver({ etapa: etapaEn('2026-11-05'), minutos: 5 * 60 + 30 })
    expect(v).toMatchObject({ aHorario: true, enRango: false, tono: 'normal' })
    expect(v.texto).toBe('Dormiste menos, pero te acostaste a horario. Semana 1: es normal, tu cuerpo se está acostumbrando.')
    const d = ver({ etapa: etapaEn('2026-11-12'), despertares: 3 })
    expect(d.texto).toBe('Te despertaste 3 veces, pero te acostaste a horario. Semana 2: es normal, tu cuerpo se está acostumbrando.')
    // Dentro de los despertares normales de la etapa (2), no cuenta.
    expect(ver({ etapa: etapaEn('2026-11-12'), despertares: 2 }).tono).toBe('bien')
  })

  it('semana 3–4: se está asentando; con 3 noches cortas seguidas, aviso', () => {
    const v = ver({ etapa: etapaEn('2026-11-20'), minutos: 6 * 60 })
    expect(v.tono).toBe('normal')
    expect(v.texto).toBe('Te acostaste a horario; todavía se está asentando (dormiste menos).')
    const a = ver({ etapa: etapaEn('2026-11-20'), minutos: 6 * 60, nochesCortasSeguidas: 3 })
    expect(a.tono).toBe('aviso')
    expect(a.texto).toContain('Van 3 noches seguidas')
  })

  it('estable: a horario pero poco, revisá la causa', () => {
    const v = ver({ etapa: etapaEn('2026-12-10'), minutos: 6 * 60 + 15 })
    expect(v.tono).toBe('aviso')
    expect(v.texto).toBe('A horario, pero dormiste menos: revisá pantalla, café o entreno tarde.')
  })

  it('despertares sin cargar: no se asume nada', () => {
    expect(ver({ etapa: etapaEn('2026-12-10') }).tono).toBe('bien')
  })
})

describe('adaptación del sueño: con la base', () => {
  let n = 0
  beforeEach(async () => {
    await usarBaseDePruebas(`adaptacion-${++n}`)
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-02', '08:00', Z))
    await inicializarSiHaceFalta()
    await iniciarCiclo('2026-11-02')
  })

  it('arranca cuando se creó «Dormir a horario» y es editable con «empecé a mejorar mi sueño el…»', async () => {
    expect(await inicioAdaptacion('2026-11-20')).toBe('2026-11-02')
    await guardarAjustes({ adaptacion: { desde: '2026-10-20' } })
    expect(await inicioAdaptacion('2026-11-20')).toBe('2026-10-20')
    const e = await estadoAdaptacion('2026-11-20')
    expect(e.actual).toMatchObject({ indice: 2, semana: 5 })
    expect(e.tolerancia).toBe(20)
  })

  it('los despertares se cargan al corregir la noche y entran en el veredicto; sin cargarlos, nada', async () => {
    await corregirNoche('2026-11-03', { acostado: '21:05', levantado: '06:40' })
    let noches = await nochesDeSuenio('2026-11-03', '2026-11-03', '2026-11-05')
    expect(noches[0].despertares).toBeUndefined()
    const e = await estadoAdaptacion('2026-11-05')
    expect(veredictoDe(noches[0], e).tono).toBe('bien')
    await corregirNoche('2026-11-03', { despertares: 3 })
    noches = await nochesDeSuenio('2026-11-03', '2026-11-03', '2026-11-05')
    expect(noches[0].despertares).toBe(3)
    expect(veredictoDe(noches[0], e).texto).toContain('Te despertaste 3 veces, pero te acostaste a horario')
    await corregirNoche('2026-11-03', { despertares: null })
    noches = await nochesDeSuenio('2026-11-03', '2026-11-03', '2026-11-05')
    expect(noches[0].despertares).toBeUndefined()
  })

  it('cuenta las noches cortas seguidas para el aviso de «Asentando»', async () => {
    await guardarAjustes({ adaptacion: { desde: '2026-10-10' } })
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) await corregirNoche(d, { acostado: '21:05', levantado: '03:30' })
    const noches = await nochesDeSuenio('2026-11-01', '2026-11-03', '2026-11-05')
    const e = await estadoAdaptacion('2026-11-05')
    expect(etapaDe('2026-11-03', e.inicio, e.etapas).indice).toBe(1)
    expect(veredictoDe(noches[2], e, noches).tono).toBe('aviso')
    expect(veredictoDe(noches[1], e, noches).tono).toBe('normal')
  })
})
