import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import type { BloqueEjercicio } from '../data/tipos'
import { instanteDe } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { iniciarCiclo } from './ciclo'
import {
  TOPE_XP_EXTRA,
  corregirSerie,
  deshacerSerie,
  ejercicios,
  fasesDescanso,
  faseActual,
  fijarPeso,
  historialEjercicio,
  iniciarEntreno,
  listarRutinas,
  marcarBloque,
  mejoraDe,
  objetivoSerie,
  obtenerRutina,
  pesoInicial,
  reabrirEntreno,
  registrarSerie,
  resumenFuerza,
  rutinaDelDia,
  seriesDe,
  sesionEnCurso,
  siguienteDistinto,
  sugerencia,
  terminarEntreno,
  ultimaVez,
} from './entreno'
import { avanzar, fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0
const dia = (f: string, h = '07:00') => fijarAhora(instanteDe(f, h, Z))

beforeEach(async () => {
  await usarBaseDePruebas(`entreno-${++n}`)
  reiniciarReloj()
  dia('2026-11-02')
  await inicializarSiHaceFalta()
  await iniciarCiclo('2026-11-02')
})

/** Hace la rutina A completa; `ajuste` cambia reps o peso de un ejercicio. */
async function hacerRutinaA(fecha: string, ajuste: Record<string, { reps?: number; peso?: number }> = {}) {
  dia(fecha)
  const r = (await obtenerRutina('rutina-a'))!
  let s = await iniciarEntreno('rutina-a', fecha)
  for (const b of r.bloques) {
    if (b.tipo !== 'ejercicio') {
      s = await marcarBloque(s.id!, b.id)
      continue
    }
    for (let i = 0; i < b.series; i++) {
      avanzar(60_000)
      s = await registrarSerie(s.id!, b.id, { reps: ajuste[b.id]?.reps ?? b.reps, repsExtra: b.repsExtra, peso: ajuste[b.id]?.peso ?? b.peso })
    }
  }
  avanzar(10 * 60_000)
  return terminarEntreno(s.id!)
}

describe('rutinas de la planilla', () => {
  it('carga A, B y C con sus días (pierna miércoles y sábado) y el entreno de lunes a sábado', async () => {
    const rutinas = await listarRutinas()
    expect(rutinas.map((r) => r.nombre)).toEqual(['Rutina A · Pecho, hombro y tríceps', 'Rutina B · Espalda, bíceps y abdomen', 'Rutina C · Pierna'])
    expect(rutinas.map((r) => r.dias)).toEqual([[1, 4], [2, 5], [3, 6]])
    expect((await db().acciones.get('entrenamiento'))!.dias).toEqual([1, 2, 3, 4, 5, 6])
    expect((await rutinaDelDia('2026-11-07'))!.id).toBe('rutina-c') // sábado
    expect(await rutinaDelDia('2026-11-08')).toBeUndefined() // domingo libre
  })

  it('los bloques van en el orden de la planilla, con notas, extra y descansos', async () => {
    const a = (await obtenerRutina('rutina-a'))!
    expect(a.bloques.map((b) => b.nombre)).toEqual(['Calentamiento', 'Press banca', 'Press inclinado', 'Press mancuerna hombro', 'Vuelos laterales', 'Colgarse en barra', 'Press francés', 'Jalón tríceps polea', 'Kick boxing', 'Estirar'])
    const jalon = a.bloques.find((b) => b.id === 'a-jalon-triceps') as BloqueEjercicio
    expect([jalon.reps, jalon.repsExtra, jalon.nota]).toEqual([12, 3, 'Codo costilla'])
    const colgarse = a.bloques[5]
    expect(colgarse).toMatchObject({ tipo: 'temporizador', segundos: 70, peso: 15, veces: 1 })
    expect(a.bloques[8]).toMatchObject({ tipo: 'rondas', rondas: [{ segundos: 60, texto: 'Enfoque en velocidad y ritmo' }, { segundos: 60, texto: 'Combinación y vaciado (FULL)' }] })
    const c = (await obtenerRutina('rutina-c'))!
    expect(ejercicios(c)[0]).toMatchObject({ nombre: 'Sentadillas con barra', descanso: 120 })
    expect(ejercicios(c).every((e) => e.series === 2)).toBe(true)
  })
})

describe('descanso con fases', () => {
  const b = { series: 2, descanso: 90, sombra: 30 }
  it('después de la primera serie: sombra 0:30 y después descansá', () => {
    expect(fasesDescanso(b, 1, 'Press inclinado')).toEqual([
      { tipo: 'sombra', segundos: 30, texto: 'Sombra' },
      { tipo: 'descanso', segundos: 60, texto: 'Descansá' },
    ])
  })
  it('después de la última serie: sin sombra, acomodá para el siguiente', () => {
    expect(fasesDescanso(b, 2, 'Press inclinado')).toEqual([{ tipo: 'acomodar', segundos: 90, texto: 'Acomodá para el siguiente: Press inclinado' }])
    expect(fasesDescanso({ ...b, descanso: 120 }, 2, 'Zancadas')[0].segundos).toBe(120)
  })
  it('la fase actual sigue al reloj', () => {
    const d = { inicio: 0, fases: fasesDescanso(b, 1, 'x') }
    expect(faseActual(d, 10_000)).toMatchObject({ indice: 0, restante: 20, totalRestante: 80 })
    expect(faseActual(d, 45_000)).toMatchObject({ indice: 1, restante: 45 })
    expect(faseActual(d, 91_000)).toBeNull()
  })
  it('al anotar series la sesión guarda el descanso que corresponde y pasa al siguiente ejercicio', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await marcarBloque(s.id!, 'a-calentar')
    expect(s.orden[s.paso]).toBe('a-press-banca')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(s.descanso!.fases.map((f) => f.tipo)).toEqual(['sombra', 'descanso'])
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(s.descanso!.fases[0].texto).toBe('Acomodá para el siguiente: Press inclinado')
    expect(s.orden[s.paso]).toBe('a-press-inclinado')
    s = await deshacerSerie(s.id!)
    expect(s.series).toHaveLength(1)
    expect(s.orden[s.paso]).toBe('a-press-banca')
  })
})

describe('reanudar', () => {
  it('si la app se cierra, el entreno sigue donde estaba', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await marcarBloque(s.id!, 'a-calentar')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    const vuelta = (await sesionEnCurso())!
    expect(vuelta.id).toBe(s.id)
    expect(vuelta.series).toHaveLength(1)
    expect(vuelta.descanso).toBeDefined()
    // Empezar de nuevo devuelve el mismo entreno, no uno nuevo.
    expect((await iniciarEntreno('rutina-a')).id).toBe(s.id)
  })
})

describe('peso antes de la serie y progresión basada en la serie 1', () => {
  const b: BloqueEjercicio = { id: 'x', tipo: 'ejercicio', nombre: 'Press banca', series: 2, reps: 8, repsTope: 12, peso: 53, descanso: 90, sombra: 30 }
  const serie = (n: number, reps: number, peso = 53) => ({ bloqueId: 'x', n, reps, peso, instante: 0 })
  it('sin historial: el peso y las reps de la planilla, sin sugerencia', () => {
    expect(sugerencia(b, [])).toBeNull()
    expect(pesoInicial(b, [])).toBe(53)
    expect(objetivoSerie(b, [], 1, 53)).toBe(8)
  })
  it('serie 1 sin llegar al tope: +1 rep; la serie 2 apunta a lo que hizo en la serie 2', () => {
    const antes = [serie(1, 10), serie(2, 8)]
    expect(sugerencia(b, antes)).toMatchObject({ subirPeso: false })
    expect(objetivoSerie(b, antes, 1, 53)).toBe(11)
    expect(objetivoSerie(b, antes, 2, 53)).toBe(8)
  })
  it('serie 1 en el tope: pregunta si sube peso sin proponer un número', () => {
    const antes = [serie(1, 12), serie(2, 9)]
    const s = sugerencia(b, antes)!
    expect(s.subirPeso).toBe(true)
    expect(s.texto).toBe('La vez pasada llegaste a 12: ¿subís peso?')
    expect(s).not.toHaveProperty('peso')
    // El peso arranca en el de la vez pasada; si Navil lo sube, el objetivo vuelve al mínimo.
    expect(pesoInicial(b, antes)).toBe(53)
    expect(objetivoSerie(b, antes, 1, 55)).toBe(8)
    expect(objetivoSerie(b, antes, 2, 55)).toBe(8)
  })
  it('el tope por defecto es 12 (mínimo = la planilla)', async () => {
    const a = (await obtenerRutina('rutina-a'))!
    expect(ejercicios(a).find((e) => e.id === 'a-press-banca')).toMatchObject({ reps: 8, repsTope: 12 })
    expect(ejercicios(a).some((e) => 'incremento' in e)).toBe(false)
  })
  it('el «peso de hoy» se guarda antes de la primera serie y se usa en todas', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await fijarPeso(s.id!, 'a-press-banca', 55.5)
    expect((await sesionEnCurso())!.pesos!['a-press-banca']).toBe(55.5)
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8 })
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 7 })
    expect(seriesDe(s, 'a-press-banca').map((x) => x.peso)).toEqual([55.5, 55.5])
  })
})

describe('repeticiones anotadas en el descanso', () => {
  it('«Serie hecha» arranca el descanso al instante y lo que se marca en el descanso queda guardado', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(s.descanso!.inicio).toBe(s.series[0].instante)
    s = await corregirSerie(s.id!, 'a-press-banca', 1, { reps: 10 })
    expect((await sesionEnCurso())!.series[0].reps).toBe(10)
    expect((await sesionEnCurso())!.descanso).toBeDefined() // el descanso sigue
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    s = await corregirSerie(s.id!, 'a-press-banca', 2, { reps: 7 })
    expect(seriesDe(s, 'a-press-banca').map((x) => x.reps)).toEqual([10, 7])
  })

  it('en el descanso se sabe qué sigue: el próximo ejercicio aunque falte una serie', async () => {
    const r = (await obtenerRutina('rutina-a'))!
    let s = await iniciarEntreno('rutina-a')
    s = await marcarBloque(s.id!, 'a-calentar')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(siguienteDistinto(s, r, 'a-press-banca')!.nombre).toBe('Press inclinado')
    s = await registrarSerie(s.id!, 'a-press-inclinado', { reps: 7, peso: 48 })
    s = await registrarSerie(s.id!, 'a-press-inclinado', { reps: 7, peso: 48 })
    // Después de inclinado sigue hombro (press banca quedó con una serie pendiente, ya pasó).
    expect(siguienteDistinto(s, r, 'a-press-inclinado')!.nombre).toBe('Press mancuerna hombro')
  })
})

describe('comparación serie con serie', () => {
  const v = (n: number, reps: number, peso = 53) => ({ bloqueId: 'x', n, reps, peso, instante: 0 })
  it('la serie 2 más baja no resta; más reps en cualquier serie con el mismo peso es mejora', () => {
    expect(mejoraDe([v(1, 10), v(2, 7)], [v(1, 10), v(2, 9)])).toMatchObject({ mejora: false })
    expect(mejoraDe([v(1, 11), v(2, 7)], [v(1, 10), v(2, 9)])).toMatchObject({ mejora: true, motivo: 'más reps' })
    expect(mejoraDe([v(1, 10), v(2, 10)], [v(1, 10), v(2, 9)])).toMatchObject({ mejora: true, motivo: 'más reps' })
    expect(mejoraDe([v(1, 8, 55), v(2, 6, 55)], [v(1, 12), v(2, 10)])).toMatchObject({ mejora: true, motivo: 'más peso' })
    expect(mejoraDe([v(1, 10), v(2, 9)], [v(1, 10), v(2, 9)])).toMatchObject({ mejora: false, igual: true })
  })
})

describe('XP del entreno', () => {
  it('terminar marca el pilar Entrenamiento y da su XP', async () => {
    const antes = await xpTotal()
    const r = await hacerRutinaA('2026-11-02')
    expect(r.xpPilar).toBe(30)
    expect(r.resumen.xpExtra).toBe(0) // primera vez: nada con qué comparar
    expect((await db().compromisos.get('entrenamiento:2026-11-02'))!.estado).toBe('completado')
    expect(await xpTotal()).toBe(antes + 30)
    expect(r.resumen.series).toBe(12)
  })

  it('+5 por mejorar, +10 por récord, con tope de 20 por entreno', async () => {
    await hacerRutinaA('2026-11-02')
    const antes = await xpTotal()
    // Mejora en un ejercicio: +5 mejora y +10 récord = 15.
    let r = await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 9 } })
    expect(r.resumen.ejercicios.find((e) => e.bloqueId === 'a-press-banca')).toMatchObject({ mejora: true, record: true })
    expect(r.resumen.xpExtra).toBe(15)
    expect(await xpTotal()).toBe(antes + 30 + 15)
    // Mejora en tres: 45 sin tope, queda en 20.
    const antes2 = await xpTotal()
    r = await hacerRutinaA('2026-11-09', { 'a-press-banca': { reps: 10 }, 'a-vuelos': { peso: 6 }, 'a-press-frances': { reps: 6 } })
    expect(r.resumen.xpSinTope).toBe(45)
    expect(r.resumen.xpExtra).toBe(TOPE_XP_EXTRA)
    expect(await xpTotal()).toBe(antes2 + 30 + 20)
  })

  it('igualar un récord no da XP y la mejora se compara con la sesión anterior de la misma rutina', async () => {
    await hacerRutinaA('2026-11-02', { 'a-press-banca': { reps: 10 } })
    await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 8 } }) // baja
    const r = await hacerRutinaA('2026-11-09', { 'a-press-banca': { reps: 10 } }) // mejora vs. la anterior, iguala el récord
    const banca = r.resumen.ejercicios.find((e) => e.bloqueId === 'a-press-banca')!
    expect(banca).toMatchObject({ mejora: true, record: false })
    expect(r.resumen.xpExtra).toBe(5)
  })

  it('hacer menos en la serie 2 no quita nada; corregir en el descanso recalcula sin duplicar', async () => {
    await hacerRutinaA('2026-11-02')
    // Serie 1 igual, serie 2 dos menos: sin mejora, sin récord, 0 XP extra (pero nada negativo).
    dia('2026-11-05')
    let s = await iniciarEntreno('rutina-a', '2026-11-05')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    s = await corregirSerie(s.id!, 'a-press-banca', 2, { reps: 6 })
    let r = await terminarEntreno(s.id!)
    expect(r.resumen.xpExtra).toBe(0)
    expect(r.resumen.ejercicios[0]).toMatchObject({ mejora: false, record: false, xp: 0 })
    // Corrige: la serie 1 fueron 9 → mejora + récord de serie 1.
    await reabrirEntreno(s.id!)
    await corregirSerie(s.id!, 'a-press-banca', 1, { reps: 9 })
    r = await terminarEntreno(s.id!)
    expect(r.resumen.ejercicios[0]).toMatchObject({ mejora: true, motivo: 'más reps', record: true, xp: 15 })
    expect(r.resumen.xpExtra).toBe(15)
  })

  it('reabrir para deshacer una serie quita el XP y al terminar de nuevo no se duplica', async () => {
    await hacerRutinaA('2026-11-02')
    const base = await xpTotal()
    const r = await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 9 } })
    expect(await xpTotal()).toBe(base + 45)
    await reabrirEntreno(r.sesion.id!)
    expect(await xpTotal()).toBe(base)
    // Corrige la última serie de jalón (sin cambio de marcas) y vuelve a terminar.
    await deshacerSerie(r.sesion.id!)
    await registrarSerie(r.sesion.id!, 'a-jalon-triceps', { reps: 12, repsExtra: 3, peso: 5 })
    const otra = await terminarEntreno(r.sesion.id!)
    expect(otra.resumen.xpExtra).toBe(15)
    expect(await xpTotal()).toBe(base + 45)
  })

  it('balance: 6 entrenos por semana con el tope no superan a los otros pilares juntos', () => {
    const otros = 20 * 7 + 15 * 7 + 15 * 7 // dormir + manga + empresa
    expect(30 * 6 + TOPE_XP_EXTRA * 6).toBeLessThanOrEqual(otros)
  })
})

describe('historial y fuerza', () => {
  it('cada ejercicio tiene su historial con el récord y la tarjeta Fuerza los resume', async () => {
    await hacerRutinaA('2026-11-02')
    await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 9 } })
    expect((await ultimaVez('rutina-a', 'a-press-banca')).map((s) => s.reps)).toEqual([9, 9])
    const h = await historialEjercicio('a-press-banca')
    expect(h.puntos.map((p) => [p.fecha, p.reps, p.record])).toEqual([['2026-11-02', 8, false], ['2026-11-05', 9, true]])
    expect(h.record).toMatchObject({ peso: 53, reps: 9 })
    const f = await resumenFuerza('2026-11-05', '2026-11-02')
    expect(f.entrenos).toBe(2)
    expect(f.records.map((r) => r.nombre)).toEqual(['Press banca'])
    expect(f.mejoraronEsteMes).toEqual(['Press banca'])
    expect(f.volumenPorSemana.at(-1)!.volumen).toBeGreaterThan(0)
  })
})
