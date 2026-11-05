import { describe, expect, it } from 'vitest'
import { HOJA_BASE, arcoSalto, caida, clipPara, elegirMovimiento, escalonCercano, type Hoja } from './rutina'

describe('rutina del compañero', () => {
  it('clips: usa el propio si está en la hoja; si no, caminar o quieto hasta que aparezca', () => {
    expect(clipPara(HOJA_BASE, 'correr')).toMatchObject({ nombre: 'caminar', propio: false })
    expect(clipPara(HOJA_BASE, 'sentado')).toMatchObject({ nombre: 'quieto', propio: false })
    expect(clipPara(HOJA_BASE, 'caminar')).toMatchObject({ nombre: 'caminar', propio: true })
    const conClips: Hoja = { ...HOJA_BASE, clips: { ...HOJA_BASE.clips, correr: { desde: 208, n: 20 }, sentado: { desde: 228, n: 30 } } }
    expect(clipPara(conClips, 'correr')).toMatchObject({ nombre: 'correr', propio: true, clip: { desde: 208 } })
    expect(clipPara(conClips, 'sentado').propio).toBe(true)
  })

  it('elige al azar con pesos: caminar y quieto lo común, salta solo si hay escalón, no repite lo raro', () => {
    let s = 1
    const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const cuenta: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) { const m = elegirMovimiento({ enEscalon: false, hayEscalon: false, anterior: 'quieto' }, azar); cuenta[m] = (cuenta[m] ?? 0) + 1 }
    expect(cuenta.saltar).toBeUndefined()
    expect(cuenta.caminar).toBeGreaterThan(cuenta.voltereta ?? 0)
    expect(cuenta.quieto).toBeGreaterThan(cuenta.alerta ?? 0)
    const conEscalon: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) { const m = elegirMovimiento({ enEscalon: false, hayEscalon: true, anterior: 'voltereta' }, azar); conEscalon[m] = (conEscalon[m] ?? 0) + 1 }
    expect(conEscalon.saltar).toBeGreaterThan(0)
    expect(conEscalon.voltereta).toBeUndefined() // no repite la voltereta seguido
    // Arriba de un escalón: se queda, se sienta o baja cayendo y rodando; nunca camina ahí
    for (let i = 0; i < 200; i++) expect(['enEscalon', 'sentado', 'caerRodar', 'estirarse', 'alerta']).toContain(elegirMovimiento({ enEscalon: true, hayEscalon: false, anterior: 'enEscalon' }, azar))
  })

  it('escalones: el más cerca y a su alcance; ni muy alto ni muy bajo ni muy angosto', () => {
    const lista = [
      { izq: 0, der: 180, alto: 60 },
      { izq: 200, der: 380, alto: 60 },
      { izq: 0, der: 380, alto: 400 }, // muy alto
      { izq: 100, der: 120, alto: 60 }, // muy angosto
      { izq: 0, der: 380, alto: 4 }, // muy bajo
    ]
    expect(escalonCercano(lista, 220, 48)).toBe(lista[1])
    expect(escalonCercano(lista, 10, 48)).toBe(lista[0])
    expect(escalonCercano([{ izq: 300, der: 380, alto: 60 }], 10, 48)).toBeNull() // lejos
    // Arco: empieza en y0, termina en y1 y pasa más alto que el destino; la caída termina en el piso
    expect(arcoSalto(0, 0, 60)).toBe(0)
    expect(arcoSalto(1, 0, 60)).toBe(60)
    expect(Math.max(...Array.from({ length: 21 }, (_, i) => arcoSalto(i / 20, 0, 60)))).toBeGreaterThan(60)
    expect(caida(1, 60)).toBe(0)
    expect(caida(0, 60)).toBe(60)
  })
})
