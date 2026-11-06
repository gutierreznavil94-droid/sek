import { beforeEach, describe, expect, it } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'
import { estadoForja, kanjiSugeridos, pedazosPara } from '../domain/forja'
import { instanteDe, sumarDias } from '../domain/fechas'
import { inicializarSiHaceFalta } from './base'
import { exportarTodo } from './exportar'
import { abandonarHabito, alternarDiaForja, claveXpForjado, crearHabito, listarForja } from './forja'
import { fijarAhora, reiniciarReloj } from './reloj'
import { xpTotal } from './xp'

const Z = 'America/Argentina/Cordoba'
const INI = '2026-11-02' // lunes
let n = 0

beforeEach(async () => {
  await usarBaseDePruebas(`forja-${++n}`)
  reiniciarReloj()
  fijarAhora(instanteDe(INI, '13:00', Z))
  await inicializarSiHaceFalta()
})

const dias = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => sumarDias(INI, desde + i))

describe('reglas de la forja', () => {
  it('pedazos a los 7, 12, 17, 21, 25 y 28; proporcional con otro número', () => {
    expect(pedazosPara(28)).toEqual([7, 12, 17, 21, 25, 28])
    expect(pedazosPara(14)).toEqual([4, 6, 9, 11, 13, 14])
  })

  it('la 1.ª falla de cada semana se perdona; las demás gastan margen', () => {
    // Semana 1: falla el día 3 (perdonada). Semana 2: fallan el 9 y el 10 (1 perdonada, 1 falla).
    const cumplidos = [...dias(0, 1), ...dias(3, 7), ...dias(10, 13)]
    const e = estadoForja({ inicio: INI, cumplidos }, sumarDias(INI, 14))
    expect(e.perdonadas).toBe(2)
    expect(e.fallas).toBe(1)
    expect(e.margenRestante).toBe(1)
    expect(e.validos).toBe(cumplidos.length + 2)
    expect(e.camino[2].estado).toBe('perdonado')
    expect(e.camino[14].estado).toBe('hoy')
  })

  it('sin margen, cada falla de más cierra una grieta y suma un día (nunca reinicia)', () => {
    // Semana 1 sin hacer nada salvo el día 1: 1 perdonada + 5 fallas → 3 de más.
    const e = estadoForja({ inicio: INI, cumplidos: [INI] }, sumarDias(INI, 7))
    expect(e.fallas).toBe(5)
    expect(e.cerradas).toBe(3)
    expect(e.duracion).toBe(33)
    expect(e.validos).toBe(0)
  })

  it('sugiere kanji según el nombre', () => {
    expect(kanjiSugeridos('Leer 10 min')[0]).toBe('読')
    expect(kanjiSugeridos('Sin celu en la cama').slice(0, 2)).toEqual(['眠', '静'])
    expect(kanjiSugeridos('algo')).toHaveLength(6)
  })
})

describe('forja en la base', () => {
  it('marcar da +5 XP; tocar de nuevo desmarca y devuelve la XP', async () => {
    const h = await crearHabito('Leer 10 min', '読', INI)
    const antes = await xpTotal()
    const r = await alternarDiaForja(h.id, INI)
    expect(r.marcado).toBe(true)
    expect(r.xp).toBe(5)
    expect(await xpTotal()).toBe(antes + 5)
    const r2 = await alternarDiaForja(h.id, INI)
    expect(r2.marcado).toBe(false)
    expect(await xpTotal()).toBe(antes)
    expect((await listarForja(INI)).enForja[0].estado.validos).toBe(0)
  })

  it('máximo 3 en forja', async () => {
    for (const k of ['読', '水', '眠']) await crearHabito(`Hábito ${k}`, k, INI)
    await expect(crearHabito('Otro', '心', INI)).rejects.toThrow('Terminá uno antes de empezar otro')
  })

  it('a los 28 válidos se forja (+50 XP), con pedazo en el 7', async () => {
    const h = await crearHabito('Agua', '水', INI)
    let pedazos = 0
    let forjado = false
    for (let i = 0; i < 28; i++) {
      const f = sumarDias(INI, i)
      fijarAhora(instanteDe(f, '13:00', Z))
      const r = await alternarDiaForja(h.id, f)
      if (r.pedazo) pedazos++
      if (i === 6) expect(r.pedazo).toBe(true)
      forjado = r.forjado
    }
    expect(forjado).toBe(true)
    expect(pedazos).toBe(6)
    const l = await listarForja(sumarDias(INI, 28))
    expect(l.enForja).toHaveLength(0)
    expect(l.forjados[0].habito.kanji).toBe('水')
    expect((await db().xp.where('clave').equals(claveXpForjado(h.id)).first())?.cantidad).toBe(50)
  })

  it('abandonar no resta XP y sale en la copia de seguridad', async () => {
    const h = await crearHabito('Meditar', '心', INI)
    await alternarDiaForja(h.id, INI)
    const xp = await xpTotal()
    await abandonarHabito(h.id, INI)
    expect(await xpTotal()).toBe(xp)
    expect((await listarForja(INI)).enForja).toHaveLength(0)
    const copia = await exportarTodo()
    expect(JSON.stringify(copia)).toContain('Meditar')
  })
})
