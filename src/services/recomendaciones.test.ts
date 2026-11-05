import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { guardarAjustes, inicializarSiHaceFalta } from './base'
import { exportarTodo } from './exportar'
import { configRecomendaciones, enviarRecomendacion, listarRecomendaciones, reintentarPendientes, urlDeEnvio } from './recomendaciones'

let n = 0
const LINK = 'https://docs.google.com/forms/d/e/ABC/viewform?usp=sf_link'

beforeEach(async () => {
  await usarBaseDePruebas(`rec-${++n}`)
  await inicializarSiHaceFalta()
})

describe('configuración', () => {
  it('sin link no hay a dónde mandar; con el link de Ajustes (y sus campos) sí', async () => {
    expect(await configRecomendaciones()).toBeNull()
    await guardarAjustes({ formularioRecomendaciones: `${LINK} entry.11 entry.22 entry.33 entry.44` })
    const c = await configRecomendaciones()
    expect(c?.formulario).toBe('https://docs.google.com/forms/d/e/ABC/formResponse')
    expect(c?.campos).toEqual({ texto: 'entry.11', parte: 'entry.22', contacto: 'entry.33', app: 'entry.44' })
  })
  it('normaliza el link', () => {
    expect(urlDeEnvio(LINK)).toBe('https://docs.google.com/forms/d/e/ABC/formResponse')
    expect(urlDeEnvio('https://docs.google.com/forms/d/e/ABC/formResponse')).toBe('https://docs.google.com/forms/d/e/ABC/formResponse')
  })
})

describe('envío', () => {
  beforeEach(() => guardarAjustes({ formularioRecomendaciones: `${LINK} entry.1 entry.2 entry.3 entry.4` }))

  it('manda los cuatro campos al formulario y queda «enviada»', async () => {
    const mandados: { url: string; datos: Record<string, string> }[] = []
    const r = await enviarRecomendacion({ texto: 'Que el entreno avise antes', parte: 'Entreno', contacto: 'navil@x.com' }, async (url, datos) => { mandados.push({ url, datos: Object.fromEntries([...datos.entries()].map(([k, v]) => [k, String(v)])) }) })
    expect(r.estado).toBe('enviada')
    expect(mandados).toHaveLength(1)
    expect(mandados[0].url).toBe('https://docs.google.com/forms/d/e/ABC/formResponse')
    expect(mandados[0].datos['entry.1']).toBe('Que el entreno avise antes')
    expect(mandados[0].datos['entry.2']).toBe('Entreno')
    expect(mandados[0].datos['entry.3']).toBe('navil@x.com')
    expect(mandados[0].datos['entry.4']).toMatch(/^SEK v\d+\.\d+ · tema shinobi$/)
    expect((await exportarTodo()).tablas.recomendaciones).toHaveLength(1)
  })
  it('sin internet queda pendiente y sale al reintentar', async () => {
    const r = await enviarRecomendacion({ texto: 'Modo oscuro total', parte: 'Otra' }, async () => { throw new Error('sin red') })
    expect(r.estado).toBe('pendiente')
    expect(r.intentos).toBe(1)
    expect(await reintentarPendientes(async () => { throw new Error('sin red') })).toBe(0)
    expect(await reintentarPendientes(async () => {})).toBe(1)
    const lista = await listarRecomendaciones()
    expect(lista[0].estado).toBe('enviada')
    expect(lista[0].intentos).toBe(3)
    expect((await db().recomendaciones.where('estado').equals('pendiente').count())).toBe(0)
  })
  it('valida texto y parte', async () => {
    await expect(enviarRecomendacion({ texto: 'ab', parte: 'Hoy' }, async () => {})).rejects.toThrow('más')
    await expect(enviarRecomendacion({ texto: 'algo bueno', parte: 'Zzz' }, async () => {})).rejects.toThrow('parte')
  })
})
