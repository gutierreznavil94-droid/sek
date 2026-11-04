import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { instanteDe } from '../domain/fechas'
import { TEMAS, TEMAS_PROXIMOS, aplicarTema, rutaTema, saludoDe, temaActivo, temaPorId } from '../temas/temas'
import { inicializarSiHaceFalta, obtenerAjustes, obtenerIdentidad } from './base'
import { cicloActivo, iniciarCiclo } from './ciclo'
import { pilaresDelDia } from './dia'
import { exportarTodo } from './exportar'
import { PILARES_DEL_CREADOR, agregarPilaresDelCreador, configurarPrimeraVez, necesitaPrimeraVez, pilaresDelCreadorQueTiene, validarPrimeraVez, type ConfigPrimeraVez } from './primeraVez'
import { fijarAhora, reiniciarReloj } from './reloj'

const Z = 'America/Argentina/Cordoba'
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`primera-vez-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe('2026-11-04', '10:00', Z))
  await inicializarSiHaceFalta()
})

const config = (cambios: Partial<ConfigPrimeraVez> = {}): ConfigPrimeraVez => ({
  hoy: '2026-11-04',
  nombrePersona: 'Lu',
  nombreApp: 'Mi app',
  tema: 'shinobi',
  pilares: [
    { clave: 'leer', nombre: 'Leer', dias: [0, 1, 2, 3, 4, 5, 6], horaLimite: '21:00', minutos: 20 },
    { clave: 'dibujar', nombre: 'Dibujar', dias: [0, 1, 2, 3, 4, 5, 6], horaLimite: '20:00', minutos: 15 },
    { clave: 'otro', nombre: 'Tocar la guitarra', dias: [1, 3], horaLimite: '19:00', minutos: 10 },
  ],
  horarios: { alistarse: '22:00', dejarCelu: '22:30', dormir: '22:40' },
  vision: 'Alguien constante',
  obstaculo: '',
  ...cambios,
})

describe('primera vez', () => {
  it('aparece solo si la app nunca tuvo un ciclo', async () => {
    expect(await necesitaPrimeraVez()).toBe(true)
    await iniciarCiclo('2026-11-04')
    expect(await necesitaPrimeraVez()).toBe(false)
  })

  it('a quien ya usaba la app (ciclo creado) no le aparece y sigue en Shinobi con los nombres de siempre', async () => {
    await iniciarCiclo('2026-11-01')
    // Ajustes viejos, sin los campos nuevos: la migración solo los agrega.
    const viejo = { ...(await db().ajustes.get('unicos'))! } as Record<string, unknown>
    for (const k of ['tema', 'nombresFases', 'nombrePersona', 'nombreApp', 'primeraVezHecha']) delete viejo[k]
    await db().ajustes.put(viejo as never)
    const pilaresAntes = (await db().acciones.toArray()).filter((a) => a.pilar).map((a) => a.id).sort()
    await inicializarSiHaceFalta()
    const a = await obtenerAjustes()
    expect(a.tema).toBe('shinobi')
    expect(a.nombresFases).toEqual(['Disciplina', 'Constancia', 'Mi yo ideal'])
    expect(a.nombreApp).toBe('SEK')
    expect(a.primeraVezHecha).toBe(true)
    expect(await necesitaPrimeraVez()).toBe(false)
    expect((await db().acciones.toArray()).filter((x) => x.pilar).map((x) => x.id).sort()).toEqual(pilaresAntes)
    expect(await db().rutinas.count()).toBe(3)
  })

  it('arma los pilares elegidos, la rutina de ejemplo y arranca el ciclo hoy', async () => {
    await configurarPrimeraVez(config())
    const c = await cicloActivo()
    expect(c?.inicio).toBe('2026-11-04')
    expect(c?.duracionDias).toBe(90)
    const p = await pilaresDelDia('2026-11-04')
    expect(p.pilares.map((x) => x.accion.nombre).sort()).toEqual(['Dibujar', 'Leer', 'Tocar la guitarra'])
    // Entrenar no se eligió: no cuenta.
    const entreno = await db().acciones.get('entrenamiento')
    expect(entreno?.pilar).toBe(false)
    expect(entreno?.activa).toBe(false)
    // Dormir no se eligió: el modo sueño sigue, pero no es pilar.
    expect((await db().acciones.get('acostarse'))?.pilar).toBe(false)
    expect((await db().acciones.get('empresa'))?.activa).toBe(false)
    const manga = await db().acciones.get('manga')
    expect(manga?.nombre).toBe('Dibujar')
    expect(manga?.horaLimite).toBe('20:00')
    expect(manga?.minutosExtra).toBeUndefined()
    expect((await db().acciones.get('p-otro-1'))?.nombre).toBe('Tocar la guitarra')
    const rutinas = await db().rutinas.toArray()
    expect(rutinas.map((r) => r.id)).toEqual(['rutina-ejemplo'])
    expect(rutinas[0].bloques.filter((b) => b.tipo === 'ejercicio')).toHaveLength(4)
    expect(rutinas[0].bloques[0].tipo).toBe('calentamiento')
    expect(await db().codigo.count()).toBe(0)
    const a = await obtenerAjustes()
    expect(a.nombrePersona).toBe('Lu')
    expect(a.nombreApp).toBe('Mi app')
    expect(a.horaDejarCelu).toBe('22:30')
    expect((await obtenerIdentidad()).vision).toBe('Alguien constante')
    expect(await necesitaPrimeraVez()).toBe(false)
  })

  it('al reabrir, las migraciones no le devuelven los pilares de Navil', async () => {
    await configurarPrimeraVez(config())
    await inicializarSiHaceFalta()
    expect((await db().acciones.get('entrenamiento'))?.pilar).toBe(false)
    expect((await db().acciones.get('manga'))?.minutosExtra).toBeUndefined()
    expect((await db().acciones.get('empresa'))?.pilar).toBe(false)
    expect((await db().rutinas.toArray()).map((r) => r.id)).toEqual(['rutina-ejemplo'])
  })

  it('con Entrenar elegido, el pilar usa sus días, hora y minutos', async () => {
    await configurarPrimeraVez(config({ pilares: [{ clave: 'entrenar', nombre: 'Entrenar', dias: [2, 4], horaLimite: '18:30', minutos: 25 }, { clave: 'dormir', nombre: 'Dormir a horario', dias: [0, 1, 2, 3, 4, 5, 6] }] }))
    const e = await db().acciones.get('entrenamiento')
    expect(e).toMatchObject({ pilar: true, activa: true, dias: [2, 4], horaLimiteInicio: '18:30', duracionMinutos: 25 })
    expect(e?.avisoInicio?.hora).toBe('18:00')
    expect((await db().acciones.get('acostarse'))).toMatchObject({ pilar: true, horaLimite: '22:30' })
    expect((await db().rutinas.get('rutina-ejemplo'))?.dias).toEqual([2, 4])
  })

  it('valida: nombre, al menos un pilar, máximo 5', () => {
    expect(validarPrimeraVez(config({ nombrePersona: ' ' }))).toContain('Falta tu nombre.')
    expect(validarPrimeraVez(config({ pilares: [] }))).toContain('Elegí al menos un pilar.')
    const seis = Array.from({ length: 6 }, () => ({ clave: 'otro' as const, nombre: 'Algo', dias: [1] }))
    expect(validarPrimeraVez(config({ pilares: seis }))).toContain('Máximo 5 pilares.')
  })

  it('la copia de seguridad lleva el tema y los nombres de las fases', async () => {
    await configurarPrimeraVez(config())
    const x = await exportarTodo()
    const aj = (x.tablas.ajustes as { tema: string; nombresFases: string[]; nombrePersona: string }[])[0]
    expect(aj.tema).toBe('shinobi')
    expect(aj.nombresFases).toEqual(['Disciplina', 'Constancia', 'Mi yo ideal'])
    expect(aj.nombrePersona).toBe('Lu')
  })
})

describe('temas', () => {
  it('Shinobi existe, es el de siempre y hay tarjetas «Próximamente»', () => {
    expect(TEMAS.map((t) => t.id)).toContain('shinobi')
    const s = temaPorId('shinobi')
    expect(s).toMatchObject({ personaje: 'Shinobi', nombreApp: 'SEK', kanjis: true, carpetaFondos: 'fondos/', sprite: 'shinobi/camina.webp' })
    expect(TEMAS_PROXIMOS.length).toBeGreaterThan(0)
  })

  it('un tema oculto (plantilla «nay») no se ofrece, pero existe y completa lo que le falta con Shinobi', () => {
    expect(TEMAS.map((t) => t.id)).not.toContain('nay')
    const n = temaPorId('nay')
    expect(n.id).toBe('nay')
    expect(n.oculto).toBe(true)
    expect(n.sprite).toBe('shinobi/camina.webp')
    expect(n.saludo).toContain('{personaje}')
  })

  it('un tema desconocido cae en Shinobi y Shinobi no pisa el color', () => {
    expect(temaPorId('no-existe').id).toBe('shinobi')
    aplicarTema('shinobi', 'SEK')
    expect(temaActivo().id).toBe('shinobi')
    expect(document.documentElement.style.getPropertyValue('--acento')).toBe('')
    expect(document.documentElement.dataset.kanjis).toBeUndefined()
  })

  it('los fondos salen de la carpeta del tema', () => {
    const otro = { ...temaPorId('shinobi'), id: 'otro', carpetaFondos: 'temas/otro/' }
    expect(rutaTema('fondos/lluvia.mp4')).toBe('fondos/lluvia.mp4')
    expect(rutaTema('fondos/lluvia.mp4', otro)).toBe('temas/otro/lluvia.mp4')
    expect(saludoDe(otro, 'Lu')).toContain('Soy Shinobi')
  })
})

describe('recomendaciones del creador (4 nov)', () => {
  it('«Agregar los que me falten» suma los 4 pilares del creador que no tiene, sin pasar el máximo', async () => {
    await configurarPrimeraVez(config({ pilares: [{ clave: 'entrenar', nombre: 'Entrenar', dias: [2, 4], horaLimite: '18:30', minutos: 25 }] }))
    expect([...(await pilaresDelCreadorQueTiene())]).toEqual(['entrenar'])
    const r = await agregarPilaresDelCreador('2026-11-02')
    expect(r).toEqual(['Dormir a horario', 'Dibujar', 'Proyecto propio'])
    expect((await pilaresDelCreadorQueTiene()).size).toBe(PILARES_DEL_CREADOR.length)
    const dibujar = (await db().acciones.get('manga'))!
    expect(dibujar).toMatchObject({ nombre: 'Dibujar', pilar: true, activa: true, horaLimite: '20:50', minutosMinimos: 15 })
    // El pilar que ya tenía no se toca
    expect((await db().acciones.get('entrenamiento'))!.horaLimiteInicio).toBe('18:30')
    // Segunda vez: nada que agregar
    expect(await agregarPilaresDelCreador('2026-11-02')).toEqual([])
  })
})
