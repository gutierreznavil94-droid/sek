import { describe, expect, it } from 'vitest'
import {
  desfaseMinutos,
  diaDelCiclo,
  diferenciaDias,
  esFechaValida,
  faseDelDia,
  fechaDe,
  fechaLegible,
  inicioDelDia,
  instanteDe,
  lunesDe,
  nocheDeSuenio,
  partesLocales,
  proximaMedianoche,
  retrasoAcostarse,
  sumarDias,
} from './fechas'

const ZONA = 'America/Argentina/Cordoba'

describe('fechas en Córdoba', () => {
  it('convierte un instante UTC a la fecha local correcta', () => {
    // 2026-11-03 02:30 UTC = 2026-11-02 23:30 en Córdoba (UTC-3)
    const t = Date.UTC(2026, 10, 3, 2, 30)
    expect(fechaDe(t, ZONA)).toBe('2026-11-02')
    const p = partesLocales(t, ZONA)
    expect(p.hora).toBe(23)
    expect(p.minuto).toBe(30)
    expect(p.diaSemana).toBe(1) // lunes
  })

  it('el desfase de Córdoba es -180 minutos', () => {
    expect(desfaseMinutos(Date.UTC(2026, 0, 15, 12), ZONA)).toBe(-180)
    expect(desfaseMinutos(Date.UTC(2026, 6, 15, 12), ZONA)).toBe(-180)
  })

  it('inicioDelDia devuelve las 00:00 locales', () => {
    const t = inicioDelDia('2026-11-03', ZONA)
    const p = partesLocales(t, ZONA)
    expect(p.fecha).toBe('2026-11-03')
    expect(p.hora).toBe(0)
    expect(p.minuto).toBe(0)
    expect(t).toBe(Date.UTC(2026, 10, 3, 3, 0))
  })

  it('la próxima medianoche avanza el día aunque el teléfono esté en otra zona', () => {
    const t = Date.UTC(2026, 10, 3, 1, 0) // 22:00 del 2 de nov en Córdoba
    const m = proximaMedianoche(t, ZONA)
    expect(fechaDe(m, ZONA)).toBe('2026-11-03')
    expect(fechaDe(m - 1, ZONA)).toBe('2026-11-02')
  })

  it('funciona también para una zona con cambio de hora', () => {
    const z = 'Europe/Madrid'
    const t = inicioDelDia('2026-03-29', z) // día de cambio a horario de verano
    const p = partesLocales(t, z)
    expect(p.fecha).toBe('2026-03-29')
    expect(p.hora).toBe(0)
  })

  it('instanteDe arma una hora concreta del día', () => {
    const t = instanteDe('2026-11-03', '23:30', ZONA)
    const p = partesLocales(t, ZONA)
    expect(p.fecha).toBe('2026-11-03')
    expect(p.hora).toBe(23)
    expect(p.minuto).toBe(30)
  })
})

describe('días del ciclo', () => {
  it('el día 1 es la fecha de inicio y avanza por fecha de calendario', () => {
    expect(diaDelCiclo('2026-11-01', '2026-11-01')).toBe(1)
    expect(diaDelCiclo('2026-11-01', '2026-11-02')).toBe(2)
    expect(diaDelCiclo('2026-11-01', '2026-11-30')).toBe(30)
    expect(diaDelCiclo('2026-11-01', '2027-01-29')).toBe(90)
    expect(diaDelCiclo('2026-11-01', '2027-01-30')).toBe(91)
  })

  it('antes del inicio devuelve 0 o negativo', () => {
    expect(diaDelCiclo('2026-11-01', '2026-10-31')).toBe(0)
  })

  it('fases de 30 días', () => {
    expect(faseDelDia(1)).toBe(1)
    expect(faseDelDia(30)).toBe(1)
    expect(faseDelDia(31)).toBe(2)
    expect(faseDelDia(60)).toBe(2)
    expect(faseDelDia(61)).toBe(3)
    expect(faseDelDia(90)).toBe(3)
  })

  it('sumar y restar días cruza meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-03-01', -1)).toBe('2027-02-28')
    expect(diferenciaDias('2026-02-27', '2026-03-02')).toBe(3)
  })

  it('valida fechas', () => {
    expect(esFechaValida('2026-02-29')).toBe(false)
    expect(esFechaValida('2028-02-29')).toBe(true)
    expect(esFechaValida('2026-13-01')).toBe(false)
    expect(esFechaValida('hola')).toBe(false)
  })

  it('lunes de la semana', () => {
    expect(lunesDe('2026-11-04')).toBe('2026-11-02') // miércoles → lunes
    expect(lunesDe('2026-11-08')).toBe('2026-11-02') // domingo → lunes anterior
    expect(lunesDe('2026-11-02')).toBe('2026-11-02')
  })

  it('fecha legible en español', () => {
    expect(fechaLegible('2026-11-02')).toBe('lun 2 nov')
  })
})

describe('noche de acostarse que cruza la medianoche', () => {
  it('un registro a las 00:40 pertenece a la noche anterior', () => {
    const t = instanteDe('2026-11-04', '00:40', ZONA)
    expect(nocheDeSuenio(t, ZONA)).toBe('2026-11-03')
  })

  it('un registro a las 23:20 pertenece a esa misma noche', () => {
    const t = instanteDe('2026-11-03', '23:20', ZONA)
    expect(nocheDeSuenio(t, ZONA)).toBe('2026-11-03')
  })

  it('después de la hora de corte ya es la noche del día en curso', () => {
    const t = instanteDe('2026-11-04', '06:00', ZONA)
    expect(nocheDeSuenio(t, ZONA)).toBe('2026-11-04')
    expect(nocheDeSuenio(t - 1, ZONA)).toBe('2026-11-03')
  })

  it('calcula el retraso aunque la hora real sea después de las 00:00', () => {
    const real = instanteDe('2026-11-04', '00:40', ZONA)
    expect(retrasoAcostarse('2026-11-03', '23:30', real, ZONA)).toBe(70)
    const antes = instanteDe('2026-11-03', '23:10', ZONA)
    expect(retrasoAcostarse('2026-11-03', '23:30', antes, ZONA)).toBe(-20)
  })
})
