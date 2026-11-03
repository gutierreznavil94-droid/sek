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
  duracionEntreno,
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
  reiniciarEntreno,
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
import { DESCUENTO_S, PREPARACION_S, estadoCronometro, historialTiempo, iniciarReloj, terminarCronometro } from './entreno'
import { ahora, avanzar, fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
let n = 0
let horaDelDia = '07:00'
const dia = (f: string, h = horaDelDia) => fijarAhora(instanteDe(f, h, Z))

beforeEach(async () => {
  horaDelDia = '07:00'
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
    expect([jalon.reps, jalon.repsExtra, jalon.admiteAyuda]).toEqual([12, 3, true])
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
  it('después de la primera serie: 3-2-1, sombra 0:30 y descansá; el total sigue siendo 1:30', () => {
    const f = fasesDescanso(b, 1, 'Press inclinado')
    expect(f).toEqual([
      { tipo: 'preparar', segundos: 3, texto: 'Sombra en' },
      { tipo: 'sombra', segundos: 30, texto: 'Sombra' },
      { tipo: 'descanso', segundos: 57, texto: 'Descansá' },
    ])
    expect(f.reduce((t, x) => t + x.segundos, 0)).toBe(90)
    expect(fasesDescanso({ ...b, sombra: 0 }, 1).map((x) => x.tipo)).toEqual(['descanso'])
  })
  it('después de la última serie: sin sombra, acomodá para el siguiente', () => {
    expect(fasesDescanso(b, 2, 'Press inclinado')).toEqual([{ tipo: 'acomodar', segundos: 90, texto: 'Acomodá para el siguiente: Press inclinado' }])
    expect(fasesDescanso({ ...b, descanso: 120 }, 2, 'Zancadas')[0].segundos).toBe(120)
  })
  it('la fase actual sigue al reloj', () => {
    const d = { inicio: 0, fases: fasesDescanso(b, 1, 'x') }
    expect(faseActual(d, 1_000)).toMatchObject({ indice: 0, restante: 2 })
    expect(faseActual(d, 13_000)).toMatchObject({ indice: 1, restante: 20, totalRestante: 77 })
    expect(faseActual(d, 45_000)).toMatchObject({ indice: 2, restante: 45 })
    expect(faseActual(d, 91_000)).toBeNull()
  })
  it('al anotar series la sesión guarda el descanso que corresponde y pasa al siguiente ejercicio', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await marcarBloque(s.id!, 'a-calentar')
    expect(s.orden[s.paso]).toBe('a-press-banca')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(s.descanso!.fases.map((f) => f.tipo)).toEqual(['preparar', 'sombra', 'descanso'])
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

  it('reiniciar desde cero borra lo de hoy, desmarca el pilar y no duplica el XP; no toca días anteriores', async () => {
    await hacerRutinaA('2026-11-02')
    const base = await xpTotal()
    const r = await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 9 } })
    expect(await xpTotal()).toBe(base + 45)
    avanzar(5 * 60_000)
    const s = await reiniciarEntreno(r.sesion.id!)
    expect(s).toMatchObject({ estado: 'en_curso', paso: 0, series: [], hechos: [], saltados: [] })
    expect(s.pesos).toBeUndefined()
    expect(s.tiempos).toBeUndefined()
    expect(s.primerMovimiento).toBeUndefined()
    expect(await xpTotal()).toBe(base)
    expect((await db().compromisos.get('entrenamiento:2026-11-05'))!.estado).toBe('iniciado')
    expect((await sesionEnCurso())!.id).toBe(r.sesion.id)
    // Lo de días anteriores sigue: la vez pasada de press banca es la del 2 de noviembre.
    expect((await historialEjercicio('a-press-banca')).puntos).toHaveLength(1)
    // Rehacer la rutina igual da el mismo XP, una sola vez.
    const otra = await hacerRutinaA('2026-11-05', { 'a-press-banca': { reps: 9 } })
    expect(otra.sesion.id).toBe(r.sesion.id)
    expect(otra.resumen.xpExtra).toBe(15)
    expect(await xpTotal()).toBe(base + 45)
  })

  it('reiniciar en medio del entreno vuelve al bloque 1 con el reloj en 0', async () => {
    let s = await iniciarEntreno('rutina-a', '2026-11-02')
    s = await marcarBloque(s.id!, 'a-calentamiento')
    s = await fijarPeso(s.id!, 'a-press-banca', 55)
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 55 })
    avanzar(60_000)
    s = await reiniciarEntreno(s.id!)
    expect(s.paso).toBe(0)
    expect(s.series).toEqual([])
    expect(s.descanso).toBeUndefined()
    expect(s.inicio).toBe(ahora())
    expect(duracionEntreno(s, ahora())).toBe(0)
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

describe('colgarse en barra con cronómetro', () => {
  it('es un cronómetro con peso en las 3 rutinas', async () => {
    for (const id of ['rutina-a', 'rutina-b', 'rutina-c']) {
      const b = (await obtenerRutina(id))!.bloques.find((x) => x.nombre === 'Colgarse en barra')
      expect(b).toMatchObject({ tipo: 'temporizador', modo: 'cronometro', segundos: 70, peso: 15 })
    }
  })

  it('espera 5 s para colgarse, cuenta para arriba y al tocar Listo descuenta 3 s', async () => {
    expect([PREPARACION_S, DESCUENTO_S]).toEqual([5, 3])
    expect(estadoCronometro(0, 2_000)).toMatchObject({ preparando: true, prep: 3 })
    expect(estadoCronometro(0, 7_000)).toMatchObject({ preparando: false, segundos: 2 })
    let s = await iniciarEntreno('rutina-a')
    s = await iniciarReloj(s.id!, 'a-colgarse')
    avanzar((5 + 76) * 1000) // 5 s de preparación + 76 s colgado (incluye bajar)
    const r = await terminarCronometro(s.id!, 'a-colgarse', 17.5)
    expect(r.tiempo).toMatchObject({ segundos: 73, peso: 17.5 })
    expect(r.sesion.hechos).toContain('a-colgarse')
    expect(r.sesion.reloj).toBeUndefined()
  })

  it('el tiempo queda en el historial con la vez pasada y el récord (el mismo en las 3 rutinas)', async () => {
    let s = await iniciarEntreno('rutina-a')
    s = await iniciarReloj(s.id!, 'a-colgarse')
    avanzar(80_000)
    await terminarCronometro(s.id!, 'a-colgarse', 15)
    await terminarEntreno(s.id!)
    dia('2026-11-03')
    s = await iniciarEntreno('rutina-b', '2026-11-03')
    s = await iniciarReloj(s.id!, 'b-colgarse')
    avanzar(70_000)
    await terminarCronometro(s.id!, 'b-colgarse', 15)
    await terminarEntreno(s.id!)
    const h = await historialTiempo('Colgarse en barra')
    expect(h.ultimo).toMatchObject({ segundos: 62, peso: 15 })
    expect(h.record).toMatchObject({ segundos: 72, peso: 15 })
  })
})

describe('duración real del entreno (ronda 5: el reloj marcaba 77:45)', () => {
  it('cuenta desde el primer movimiento, no desde que se abrió la pantalla', async () => {
    const { duracionEntreno } = await import('./entreno')
    let s = await iniciarEntreno('rutina-a')
    avanzar(75 * 60_000) // la pantalla quedó abierta 75 min sin entrenar
    expect(duracionEntreno(s, Date.now())).toBe(0)
    s = await iniciarReloj(s.id!, 'a-calentar')
    avanzar(3 * 60_000)
    s = await marcarBloque(s.id!, 'a-calentar')
    avanzar(60_000)
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    const ahoraMs = s.series[0].instante
    expect(Math.round(duracionEntreno(s, ahoraMs))).toBe(4 * 60)
  })

  it('un hueco largo sin actividad cuenta como mucho 15 min', async () => {
    const { duracionEntreno, PAUSA_MAXIMA_S } = await import('./entreno')
    let s = await iniciarEntreno('rutina-a')
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    avanzar(60 * 60_000)
    s = await registrarSerie(s.id!, 'a-press-banca', { reps: 8, peso: 53 })
    expect(Math.round(duracionEntreno(s, s.series[1].instante))).toBe(PAUSA_MAXIMA_S)
  })
})

describe('hora límite para empezar (19:35)', () => {
  it('empezar 19:35 o antes cuenta aunque termine 20:30', async () => {
    horaDelDia = '19:35'
    const r = await hacerRutinaA('2026-11-02')
    expect(r.xpPilar).toBe(30)
    expect((await db().compromisos.get('entrenamiento:2026-11-02'))!.estado).toBe('completado')
  })

  it('empezar después de las 19:35 se guarda, pero el pilar queda tarde y sin XP', async () => {
    horaDelDia = '19:50'
    const antes = await xpTotal()
    const r = await hacerRutinaA('2026-11-02')
    expect(r.xpPilar).toBe(0)
    expect(r.motivoSinXp).toMatch(/19:35/)
    expect((await db().compromisos.get('entrenamiento:2026-11-02'))!.estado).toBe('tarde')
    expect(r.resumen.series).toBe(12)
    expect(await xpTotal()).toBe(antes)
  })

  it('reiniciar no cambia la hora de inicio que cuenta', async () => {
    dia('2026-11-02', '19:30')
    let s = await iniciarEntreno('rutina-a', '2026-11-02')
    fijarAhora(instanteDe('2026-11-02', '19:50', Z))
    s = await reiniciarEntreno(s.id!)
    expect(s.inicioQueCuenta).toBe(instanteDe('2026-11-02', '19:30', Z))
    const r = await terminarEntreno(s.id!)
    expect(r.xpPilar).toBe(30)
  })

  it('la hora límite se puede editar', async () => {
    const a = (await db().acciones.get('entrenamiento'))!
    expect(a.horaLimiteInicio).toBe('19:35')
    expect(a.avisoInicio).toEqual({ activo: true, hora: '19:00' })
    await db().acciones.put({ ...a, horaLimiteInicio: '20:00' })
    horaDelDia = '19:50'
    expect((await hacerRutinaA('2026-11-02')).xpPilar).toBe(30)
  })
})

describe('ronda 8', () => {
  it('reps con ayuda: se guardan aparte, suman volumen y no cuentan para el récord', async () => {
    const { marcaDe, calcularResumen } = await import('./entreno')
    let s = await iniciarEntreno('rutina-a')
    s = await registrarSerie(s.id!, 'a-jalon-triceps', { reps: 12, repsExtra: 3, peso: 5 })
    expect(s.series[0]).toMatchObject({ reps: 12, ayuda: 3 })
    expect(s.series[0].repsExtra).toBeUndefined()
    expect(marcaDe(s.series)).toMatchObject({ reps: 12, volumen: 75 })
    expect((await calcularResumen(s)).volumen).toBe(75)
  })

  it('kick boxing: descanso de 1:00 entre rondas y 5 s de preparación que se saltean', async () => {
    const { tramosRondas, saltarPreparacion, PREPARACION_S } = await import('./entreno')
    const a = (await obtenerRutina('rutina-a'))!
    const kick = a.bloques.find((b) => b.tipo === 'rondas')!
    if (kick.tipo !== 'rondas') throw new Error()
    expect(tramosRondas(kick).map((x) => `${x.texto}:${x.segundos}`)).toEqual(['Enfoque en velocidad y ritmo:60', 'Descanso:60', 'Combinación y vaciado (FULL):60'])
    let s = await iniciarEntreno('rutina-a')
    const t0 = s.inicio
    s = await iniciarReloj(s.id!, 'a-kick')
    expect(s.reloj).toMatchObject({ segundos: 180, inicio: t0 + PREPARACION_S * 1000 })
    s = await saltarPreparacion(s.id!)
    expect(s.reloj!.inicio).toBe(t0)
  })
})
