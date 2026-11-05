import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { PLANES, PLAN_NAY, rutinasDeEleccion } from '../data/planes'
import { RUTINAS_INICIALES } from '../data/semilla'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import {
  aplicarEleccionEntreno,
  borrarRutina,
  crearRutina,
  diasDeRutinas,
  guardarRutina,
  historialEjercicio,
  iniciarEntreno,
  listarRutinas,
  marcarBloque,
  obtenerRutina,
  registrarSerie,
  resumenFuerza,
  rutinaDelDia,
  sesionEnCurso,
  terminarEntreno,
} from './entreno'
import { configurarPrimeraVez, validarPrimeraVez, type ConfigPrimeraVez } from './primeraVez'
import { avanzar, fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
let n = 0
const dia = (f: string, h = '07:00') => fijarAhora(instanteDe(f, h, Z))

beforeEach(async () => {
  await usarBaseDePruebas(`rutinas-${++n}`)
  reiniciarReloj()
  dia('2026-11-02')
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

/** Entreno completo de una rutina (todas las series como dice la rutina). */
async function entrenar(rutinaId: string, fecha: string) {
  dia(fecha)
  const r = (await obtenerRutina(rutinaId))!
  let s = await iniciarEntreno(rutinaId, fecha)
  for (const b of r.bloques) {
    if (b.tipo !== 'ejercicio') { s = await marcarBloque(s.id!, b.id); continue }
    for (let i = 0; i < b.series; i++) { avanzar(60_000); s = await registrarSerie(s.id!, b.id, { reps: b.reps, peso: b.peso }) }
  }
  avanzar(10 * 60_000)
  return terminarEntreno(s.id!)
}

describe('datos de siempre', () => {
  it('quien ya tenía A, B y C las sigue teniendo igual (no hace falta migrar nada)', async () => {
    const rutinas = await listarRutinas(true)
    expect(rutinas.map((r) => r.id)).toEqual(['rutina-a', 'rutina-b', 'rutina-c'])
    expect(rutinas.every((r) => r.borrada === undefined)).toBe(true)
    await inicializarSiHaceFalta()
    expect((await listarRutinas(true)).map((r) => r.id)).toEqual(['rutina-a', 'rutina-b', 'rutina-c'])
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('sumar y borrar rutinas', () => {
  it('una rutina nueva va al final, vacía y editable', async () => {
    const r = await crearRutina()
    expect((await listarRutinas(true)).map((x) => x.id)).toEqual(['rutina-a', 'rutina-b', 'rutina-c', r.id])
    await guardarRutina({ ...r, nombre: 'Rutina D · Cardio', dias: [0], bloques: [{ id: 'd-correr', tipo: 'temporizador', nombre: 'Correr', segundos: 600, modo: 'cuenta' }] })
    expect((await rutinaDelDia('2026-11-08'))?.id).toBe(r.id)
    const otra = await crearRutina()
    expect(otra.id).not.toBe(r.id)
  })

  it('sin entrenos, borrar la elimina', async () => {
    expect(await borrarRutina('rutina-b')).toBe('eliminada')
    expect(await obtenerRutina('rutina-b')).toBeUndefined()
    expect((await listarRutinas(true)).map((r) => r.id)).toEqual(['rutina-a', 'rutina-c'])
  })

  it('con entrenos, la borrada desaparece de la lista pero el historial y los récords siguen', async () => {
    await entrenar('rutina-a', '2026-11-02')
    const antes = await historialEjercicio('a-press-banca')
    expect(await borrarRutina('rutina-a')).toBe('guardada para el historial')
    expect((await listarRutinas(true)).map((r) => r.id)).toEqual(['rutina-b', 'rutina-c'])
    expect(await rutinaDelDia('2026-11-09')).toBeUndefined() // lunes: era de A
    expect((await listarRutinas(true, true)).map((r) => r.id)).toContain('rutina-a')
    expect(await historialEjercicio('a-press-banca')).toEqual(antes)
    expect((await db().sesionesEntreno.where('rutinaId').equals('rutina-a').count())).toBe(1)
    const f = await resumenFuerza('2026-11-02', '2026-11-02')
    expect(f.entrenos).toBe(1)
    // Los nombres salen de la rutina borrada (no quedan ids sueltos).
    expect(f.records.every((x) => !x.nombre.startsWith('a-'))).toBe(true)
  })

  it('un entreno empezado se puede terminar aunque se borre su rutina', async () => {
    dia('2026-11-02')
    const s = await iniciarEntreno('rutina-a', '2026-11-02')
    await borrarRutina('rutina-a')
    expect((await sesionEnCurso())?.id).toBe(s.id)
    avanzar(30 * 60_000)
    const r = await terminarEntreno(s.id!)
    expect(r.sesion.estado).toBe('terminada')
  })
})

describe('elegir cómo empezar', () => {
  it('reemplazar con el plan de Nay: 4 rutinas de martes a sábado y el pilar con esos días', async () => {
    await entrenar('rutina-a', '2026-11-02')
    const r = await aplicarEleccionEntreno({ modo: 'plan', planId: 'plan-nay' }, { reemplazar: true, igualarDias: true })
    expect(r).toEqual({ cargadas: 4, borradas: 3 })
    const rutinas = await listarRutinas(true)
    expect(rutinas.map((x) => x.nombre)).toEqual(['Martes · Piernas y glúteos', 'Miércoles · Brazos y espalda', 'Jueves · Abdomen y zona media', 'Sábado · Cuerpo completo'])
    expect(await diasDeRutinas()).toEqual([2, 3, 4, 6])
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([2, 3, 4, 6])
    expect((await rutinaDelDia('2026-11-07'))?.id).toBe('nay-sabado')
    expect(await rutinaDelDia('2026-11-06')).toBeUndefined() // viernes libre
    // A tenía un entreno: queda para el historial; B y C no tenían y se fueron.
    expect((await obtenerRutina('rutina-a'))?.borrada).toBe(true)
    expect(await obtenerRutina('rutina-b')).toBeUndefined()
  })

  it('sumar agrega al final y no repite si se vuelve a sumar el mismo plan', async () => {
    await aplicarEleccionEntreno({ modo: 'plan', planId: 'plan-nay' }, { reemplazar: false })
    expect((await listarRutinas(true)).map((r) => r.id)).toEqual(['rutina-a', 'rutina-b', 'rutina-c', 'nay-martes', 'nay-miercoles', 'nay-jueves', 'nay-sabado'])
    expect((await aplicarEleccionEntreno({ modo: 'plan', planId: 'plan-nay' }, { reemplazar: false })).cargadas).toBe(0)
    expect(await listarRutinas(true)).toHaveLength(7)
    // Sin igualar, el pilar no cambia.
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('volver al plan de gimnasio recupera A con su historial', async () => {
    await entrenar('rutina-a', '2026-11-02')
    await aplicarEleccionEntreno({ modo: 'plan', planId: 'plan-nay' }, { reemplazar: true, igualarDias: true })
    await aplicarEleccionEntreno({ modo: 'plan', planId: 'plan-gimnasio' }, { reemplazar: true, igualarDias: true })
    const a = await obtenerRutina('rutina-a')
    expect(a?.borrada).toBeUndefined()
    expect(a?.activa).toBe(true)
    expect((await historialEjercicio('a-press-banca')).puntos).toHaveLength(1)
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('desde cero deja sin rutinas y no le saca los días al pilar', async () => {
    await aplicarEleccionEntreno({ modo: 'cero' }, { reemplazar: true, igualarDias: true })
    expect(await listarRutinas(true)).toEqual([])
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('de a poco: la rutina cortita con los días del pilar', async () => {
    await aplicarEleccionEntreno({ modo: 'poco' }, { reemplazar: true })
    const r = await listarRutinas(true)
    expect(r.map((x) => x.id)).toEqual(['rutina-ejemplo'])
    expect(r[0].dias).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('planes', () => {
  it('cada rutina de cada plan pasa la validación del editor', async () => {
    for (const p of PLANES) for (const r of rutinasDeEleccion({ modo: 'plan', planId: p.id }, [])) await guardarRutina({ ...r, creado: 0 })
  })

  it('no repiten ids de bloque entre planes (el historial de cada ejercicio no se mezcla)', () => {
    const ids = PLANES.flatMap((p) => p.rutinas.flatMap((r) => r.bloques.map((b) => b.id)))
    expect(new Set(ids).size).toBe(ids.length)
    expect(PLANES.find((p) => p.id === 'plan-gimnasio')!.rutinas).toBe(RUTINAS_INICIALES)
  })

  it('el plan de Nay es como su foto: fuerza, fútbol con casillas y vuelta a la calma de 5 min', () => {
    expect(PLAN_NAY.rutinas.map((r) => r.dias[0])).toEqual([2, 3, 4, 6])
    for (const r of PLAN_NAY.rutinas) {
      expect(r.bloques.some((b) => b.tipo === 'calentamiento')).toBe(false)
      const futbol = r.bloques.find((b) => b.nombre === 'Fútbol')
      expect(futbol?.tipo === 'temporizador' && futbol.segundos).toBe(600)
      expect(r.bloques.filter((b) => b.tipo === 'casilla' && b.nota === 'Fútbol').length).toBeGreaterThanOrEqual(4)
      const calma = r.bloques[r.bloques.length - 1]
      expect(calma.nombre).toBe('Vuelta a la calma')
      expect(calma.tipo === 'temporizador' && calma.segundos).toBe(300)
    }
    const martes = PLAN_NAY.rutinas[0].bloques
    expect(martes.find((b) => b.id === 'nm-zancadas')).toMatchObject({ series: 2, reps: 8, nota: expect.stringContaining('Por pierna') })
    const jueves = PLAN_NAY.rutinas[2].bloques
    expect(jueves.find((b) => b.id === 'nj-plancha')).toMatchObject({ tipo: 'rondas', rondas: [{ segundos: 20 }, { segundos: 20 }, { segundos: 20 }] })
    expect(jueves.find((b) => b.id === 'nj-crunch')).toMatchObject({ reps: 10, repsTope: 12 })
    const sabado = PLAN_NAY.rutinas[3].bloques
    expect(sabado.filter((b) => b.tipo === 'ejercicio').map((b) => b.tipo === 'ejercicio' && b.series)).toEqual([2, 2, 2, 2, 2])
  })
})

describe('primera vez', () => {
  const config = (cambios: Partial<ConfigPrimeraVez> = {}): ConfigPrimeraVez => ({
    hoy: '2026-11-04',
    nombrePersona: 'Nay',
    nombreApp: 'SEK',
    tema: 'shinobi',
    pilares: [{ clave: 'entrenar', nombre: 'Entrenar', dias: [2, 3, 4, 6], horaLimite: '19:00', minutos: 40 }],
    horarios: { alistarse: '22:00', dejarCelu: '22:30', dormir: '22:40' },
    vision: '',
    obstaculo: '',
    ...cambios,
  })
  beforeEach(async () => {
    await usarBaseDePruebas(`rutinas-pv-${++n}`)
    reiniciarReloj()
    fijarAhora(instanteDe('2026-11-04', '10:00', Z))
    await inicializarSiHaceFalta()
  })

  it('con el plan completo arranca con las 4 rutinas del plan', async () => {
    await configurarPrimeraVez(config({ entreno: { modo: 'plan', planId: 'plan-nay' } }))
    expect((await listarRutinas(true)).map((r) => r.id)).toEqual(['nay-martes', 'nay-miercoles', 'nay-jueves', 'nay-sabado'])
    expect((await db().acciones.get('entrenamiento'))?.dias).toEqual([2, 3, 4, 6])
  })

  it('desde cero arranca sin rutinas; sin elegir nada, la de ejemplo como siempre', async () => {
    await configurarPrimeraVez(config({ entreno: { modo: 'cero' } }))
    expect(await db().rutinas.count()).toBe(0)
    await usarBaseDePruebas(`rutinas-pv-${++n}`)
    await inicializarSiHaceFalta()
    await configurarPrimeraVez(config())
    expect((await listarRutinas(true)).map((r) => ({ id: r.id, dias: r.dias }))).toEqual([{ id: 'rutina-ejemplo', dias: [2, 3, 4, 6] }])
  })

  it('un plan que no existe no deja empezar', () => {
    expect(validarPrimeraVez(config({ entreno: { modo: 'plan', planId: 'nada' } }))).toContain('Elegí un plan de entrenamiento.')
  })
})
