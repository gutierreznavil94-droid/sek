import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { alarmasDelDia } from './alarmas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import { cerrarDiasPendientes, generarCompromisosDelDia } from './dia'
import { agregarFechaClave } from './fechasClave'
import { marcarFeriado } from './feriados'
import {
  ID_BLOQUE_ENTRENO, activarHorario, apagarBloqueEnFecha, bloquesDelDia, borrarHorario, configHorario, copiarADias, correrEntreno, encenderBloqueEnFecha, finDeObligatorio,
  guardarBloque, huecosDelDia, momento, nuevoHorario, textoMomento,
} from './horario'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
const LUNES = '2026-11-02'
const MARTES = '2026-11-03'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`horario-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(LUNES, '08:00', Z))
  await inicializarSiHaceFalta()
  await db().acciones.update('entrenamiento', { dias: [1, 3, 5], hora: '19:00', horaLimiteInicio: '19:35' })
  await iniciarCiclo('2026-11-01')
  await cerrarDiasPendientes()
})

describe('bloques de la semana', () => {
  it('un bloque obligatorio de lunes a viernes aparece esos días, con el entreno y el sueño', async () => {
    await guardarBloque({ nombre: 'Facultad', tipo: 'obligatorio', dias: [1, 2, 3, 4, 5], desde: '14:00', hasta: '18:00' })
    const lunes = await bloquesDelDia(LUNES)
    expect(lunes.map((b) => `${b.nombre} ${b.desde}-${b.hasta}`)).toEqual(['Dormir 00:00-05:00', 'Facultad 14:00-18:00', 'Entrenamiento 19:00-20:17', 'Dormir 21:20-24:00'])
    expect(lunes.find((b) => b.id === ID_BLOQUE_ENTRENO)?.variable).toBe(true)
    const martes = await bloquesDelDia(MARTES)
    expect(martes.filter((b) => b.tipo !== 'dormir').map((b) => b.nombre)).toEqual(['Facultad'])
    const domingo = await bloquesDelDia('2026-11-08')
    expect(domingo.filter((b) => b.tipo !== 'dormir')).toHaveLength(0)
  })
  it('valida nombre, horas y días', async () => {
    await expect(guardarBloque({ nombre: ' ', tipo: 'otro', dias: [1], desde: '08:00', hasta: '09:00' })).rejects.toThrow('nombre')
    await expect(guardarBloque({ nombre: 'X', tipo: 'otro', dias: [1], desde: '09:00', hasta: '08:00' })).rejects.toThrow('después')
    await expect(guardarBloque({ nombre: 'X', tipo: 'otro', dias: [], desde: '08:00', hasta: '09:00' })).rejects.toThrow('día')
  })
  it('editar un bloque lo reemplaza; copiar a otros días suma días', async () => {
    const b = await guardarBloque({ nombre: 'Cole', tipo: 'obligatorio', dias: [1], desde: '08:00', hasta: '12:00' })
    await guardarBloque({ ...b, hasta: '13:00' })
    await copiarADias(b.id, [2, 3])
    const h = (await configHorario()).horarios[0]
    expect(h.bloques).toHaveLength(1)
    expect(h.bloques[0].dias).toEqual([1, 2, 3])
    expect(h.bloques[0].hasta).toBe('13:00')
  })
  it('el bloque de entreno escribe en la acción: días, hora y «Empezar hasta»', async () => {
    await guardarBloque({ id: ID_BLOQUE_ENTRENO, nombre: 'Entrenamiento', tipo: 'entreno', dias: [2, 4], desde: '18:30', hasta: '19:10' })
    const a = await db().acciones.get('entrenamiento')
    expect(a?.dias).toEqual([2, 4])
    expect(a?.hora).toBe('18:30')
    expect(a?.horaLimiteInicio).toBe('19:10')
    expect((await bloquesDelDia(MARTES)).find((b) => b.id === ID_BLOQUE_ENTRENO)?.desde).toBe('18:30')
    expect((await configHorario()).horarios[0].bloques).toHaveLength(0)
  })
})

describe('excepciones, feriados y fechas clave', () => {
  it('«hoy no hay cursada» apaga el bloque solo ese día; se puede volver a encender', async () => {
    const b = await guardarBloque({ nombre: 'Facultad', tipo: 'obligatorio', dias: [1, 2], desde: '14:00', hasta: '18:00' })
    await apagarBloqueEnFecha(LUNES, b.id)
    expect((await bloquesDelDia(LUNES)).some((x) => x.id === b.id)).toBe(false)
    expect((await bloquesDelDia(LUNES, { conApagados: true })).find((x) => x.id === b.id)?.motivoApagado).toBe('excepcion')
    expect((await bloquesDelDia(MARTES)).some((x) => x.id === b.id)).toBe(true)
    await encenderBloqueEnFecha(LUNES, b.id)
    expect((await bloquesDelDia(LUNES)).some((x) => x.id === b.id)).toBe(true)
    expect((await configHorario()).excepciones).toEqual({})
  })
  it('los feriados apagan los obligatorios, no los otros', async () => {
    await guardarBloque({ nombre: 'Facultad', tipo: 'obligatorio', dias: [1], desde: '14:00', hasta: '18:00' })
    await guardarBloque({ nombre: 'Inglés', tipo: 'otro', dias: [1], desde: '10:00', hasta: '11:00' })
    await marcarFeriado(LUNES)
    const l = await bloquesDelDia(LUNES, { conApagados: true })
    expect(l.find((x) => x.nombre === 'Facultad')?.motivoApagado).toBe('feriado')
    expect(l.find((x) => x.nombre === 'Inglés')?.apagado).toBeUndefined()
  })
  it('una fecha clave con hora es un bloque obligatorio ese día (2 h si no tiene fin)', async () => {
    await agregarFechaClave(MARTES, 'Examen', undefined, false, { hora: '09:00', horaFin: '11:30' })
    await agregarFechaClave(MARTES, 'Trámite', undefined, false, { hora: '15:00' })
    const m = (await bloquesDelDia(MARTES)).filter((b) => b.origen === 'fechaClave')
    expect(m.map((b) => `${b.nombre} ${b.desde}-${b.hasta} ${b.tipo}`)).toEqual(['Examen 09:00-11:30 obligatorio', 'Trámite 15:00-17:00 obligatorio'])
  })
})

describe('dónde estoy y qué entra', () => {
  it('momento: ahora, después y minutos libres; huecos del día', async () => {
    await guardarBloque({ nombre: 'Facultad', tipo: 'obligatorio', dias: [1], desde: '14:00', hasta: '18:00' })
    const m1 = await momento(LUNES, instanteDe(LUNES, '15:00', Z))
    expect(m1.ahora?.nombre).toBe('Facultad')
    expect(m1.enObligatorio).toBe(true)
    expect(m1.siguiente?.nombre).toBe('Entrenamiento')
    expect(m1.libres).toBe(60)
    expect(textoMomento(m1)).toBe('Ahora: Facultad hasta 18:00 · después: Entrenamiento 19:00')
    const m2 = await momento(LUNES, instanteDe(LUNES, '18:20', Z))
    expect(m2.ahora).toBeNull()
    expect(m2.libres).toBe(40)
    expect(textoMomento(m2)).toBe('Libre 40 min · después: Entrenamiento 19:00')
    const huecos = await huecosDelDia(LUNES)
    expect(huecos).toEqual([
      { desde: '05:00', hasta: '14:00', minutos: 540 },
      { desde: '18:00', hasta: '19:00', minutos: 60 },
      { desde: '20:17', hasta: '20:50', minutos: 33 },
    ])
  })
  it('«hoy a las 19:30» corre solo el entreno de ese día', async () => {
    await generarCompromisosDelDia(LUNES)
    await correrEntreno(LUNES, '19:30')
    expect((await bloquesDelDia(LUNES)).find((b) => b.id === ID_BLOQUE_ENTRENO)?.desde).toBe('19:30')
    expect((await db().acciones.get('entrenamiento'))?.hora).toBe('19:00')
    expect((await bloquesDelDia('2026-11-04')).find((b) => b.id === ID_BLOQUE_ENTRENO)?.desde).toBe('19:00')
    await expect(correrEntreno(MARTES, '19:30')).rejects.toThrow('no hay entreno')
  })
})

describe('avisos', () => {
  it('durante un bloque obligatorio no suenan los avisos; al salir llega uno solo; el del entreno sigue', async () => {
    await guardarBloque({ nombre: 'Trabajo', tipo: 'obligatorio', dias: [1], desde: '18:30', hasta: '21:00' })
    const l = await alarmasDelDia(LUNES)
    expect(l.map((a) => `${a.hora} ${a.tipo}`)).toEqual(['18:30 horario', '19:00 entrenamiento', '21:00 salida', '21:15 celu', '21:20 dormido'])
    const salida = l.find((a) => a.tipo === 'salida')!
    expect(salida.titulo).toBe('Saliste de Trabajo')
    expect(salida.cuerpo).toContain('Empezá el entreno')
    expect(salida.cuerpo).toContain('revisión')
    expect(l[0].titulo).toBe('Ahora: Trabajo')
    expect(await finDeObligatorio(LUNES, instanteDe(LUNES, '20:50', Z))).toMatchObject({ fin: instanteDe(LUNES, '21:00', Z) })
    expect(await finDeObligatorio(LUNES, instanteDe(LUNES, '10:00', Z))).toBeNull()
  })
})

describe('horarios guardados', () => {
  it('dos horarios que se cambian con un toque; no se borra el último', async () => {
    await guardarBloque({ nombre: 'Facultad', tipo: 'obligatorio', dias: [1], desde: '14:00', hasta: '18:00' })
    const vac = await nuevoHorario('Vacaciones')
    expect((await configHorario()).activo).toBe(vac.id)
    expect((await bloquesDelDia(LUNES)).some((b) => b.nombre === 'Facultad')).toBe(false)
    await activarHorario('horario-1')
    expect((await bloquesDelDia(LUNES)).some((b) => b.nombre === 'Facultad')).toBe(true)
    await borrarHorario(vac.id)
    await expect(borrarHorario('horario-1')).rejects.toThrow('al menos un horario')
  })
})
