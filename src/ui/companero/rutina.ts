/**
 * La rutina del compañero: qué hace cuando no habla ni pelea. Estados (caminar, correr, saltar a un
 * escalón, parado ahí, sentado, caer y rodar, voltereta, estirarse, alerta) elegidos al azar con pesos.
 * Los clips viven en la hoja de sprites (public/shinobi/camina.json): si un clip no está, el estado usa
 * caminar o quieto y se activa solo cuando el clip aparece en la hoja.
 */

/** Un clip de la hoja. `unaVez`: se reproduce una vez y queda en el último cuadro. `bajar`: px CSS que el muñeco va más abajo
 * (sentado: las piernas cuelgan del borde). `aire`: tramo del clip (0..1) en que está en el aire: la app lo mueve solo ahí. */
export type Clip = { desde: number; n: number; fps?: number; unaVez?: boolean; bajar?: number; aire?: [number, number] }
export type Hoja = { celda: [number, number]; columnas: number; filas: number; clips: Record<string, Clip>; pasoCuadro: number; frenoAvance: number }

/** Hoja de respaldo (la actual) por si el JSON no carga. */
export const HOJA_BASE: Hoja = {
  celda: [48, 35], columnas: 16, filas: 13,
  clips: { caminar: { desde: 0, n: 48, fps: 33.6 }, frenar: { desde: 48, n: 55, fps: 33.6 }, quieto: { desde: 103, n: 105, fps: 12 } },
  pasoCuadro: 0.3348, frenoAvance: 5.8,
}

export type Movimiento = 'quieto' | 'caminar' | 'correr' | 'saltar' | 'enEscalon' | 'sentado' | 'caerRodar' | 'voltereta' | 'estirarse' | 'alerta'

/** Con qué clip se dibuja cada movimiento, y con cuál se reemplaza si todavía no está en la hoja. */
export const CLIP_DE: Record<Movimiento, { clip: string; sino: 'caminar' | 'quieto' }> = {
  quieto: { clip: 'quieto', sino: 'quieto' },
  caminar: { clip: 'caminar', sino: 'caminar' },
  correr: { clip: 'correr', sino: 'caminar' },
  saltar: { clip: 'saltar', sino: 'caminar' },
  enEscalon: { clip: 'quieto', sino: 'quieto' },
  sentado: { clip: 'sentado', sino: 'quieto' },
  caerRodar: { clip: 'caerRodar', sino: 'caminar' },
  voltereta: { clip: 'voltereta', sino: 'caminar' },
  estirarse: { clip: 'estirarse', sino: 'quieto' },
  alerta: { clip: 'alerta', sino: 'quieto' },
}

/** El clip real para un movimiento: el propio si está en la hoja, si no el de respaldo. */
export function clipPara(hoja: Hoja, m: Movimiento): { nombre: string; clip: Clip; propio: boolean } {
  const { clip, sino } = CLIP_DE[m]
  const c = hoja.clips[clip]
  if (c) return { nombre: clip, clip: c, propio: true }
  return { nombre: sino, clip: hoja.clips[sino] ?? HOJA_BASE.clips[sino], propio: clip === sino }
}

/** Pesos: caminar y quieto son lo común; voltereta y alerta, raros. */
export const PESOS: Record<Movimiento, number> = {
  quieto: 30, caminar: 30, correr: 8, saltar: 10, enEscalon: 0, sentado: 6, caerRodar: 0, voltereta: 3, estirarse: 5, alerta: 2,
}

export type Contexto = {
  /** Está parado arriba de un escalón (botón o tarjeta). */
  enEscalon: boolean
  /** Hay un escalón al que puede saltar desde donde está. */
  hayEscalon: boolean
  /** Lo último que hizo (no se repite seguido salvo quieto/caminar). */
  anterior: Movimiento
}

/** Elige el próximo movimiento según el contexto. Arriba de un escalón: queda parado, se sienta o baja cayendo y rodando. */
export function elegirMovimiento(c: Contexto, azar: () => number = Math.random): Movimiento {
  if (c.enEscalon) {
    const opciones: [Movimiento, number][] = [['enEscalon', 30], ['sentado', 25], ['caerRodar', 35], ['estirarse', 8], ['alerta', 4]]
    return sortear(opciones.filter(([m]) => m !== c.anterior || m === 'enEscalon'), azar)
  }
  const opciones = (Object.keys(PESOS) as Movimiento[])
    .filter((m) => PESOS[m] > 0)
    .filter((m) => m !== 'saltar' || c.hayEscalon)
    .filter((m) => m === 'quieto' || m === 'caminar' || m !== c.anterior)
    .map((m): [Movimiento, number] => [m, PESOS[m]])
  return sortear(opciones, azar)
}

function sortear(opciones: [Movimiento, number][], azar: () => number): Movimiento {
  const total = opciones.reduce((s, [, p]) => s + p, 0)
  let r = azar() * total
  for (const [m, p] of opciones) { r -= p; if (r < 0) return m }
  return opciones[opciones.length - 1][0]
}

/** Cuánto dura cada movimiento que no se mueve (segundos), al azar entre mínimo y máximo. */
export const DURACION: Partial<Record<Movimiento, [number, number]>> = {
  quieto: [2, 6], enEscalon: [2, 5], sentado: [4, 9], estirarse: [1.6, 2.4], alerta: [1.2, 1.8], voltereta: [0.7, 0.7],
}

export function duracionDe(m: Movimiento, azar: () => number = Math.random): number {
  const d = DURACION[m] ?? [1, 1]
  return d[0] + azar() * (d[1] - d[0])
}

/** Un escalón: superficie donde se puede parar (borde superior de un botón o tarjeta de Hoy), en coordenadas del piso del compañero. */
export type Escalon = { izq: number; der: number; alto: number; el?: Element }

export const SALTO = { altoMin: 18, altoMax: 175, alcance: 170, duracion: 0.62 }

/** El escalón más cerca al que se puede saltar desde x (alto entre 18 y 150 px, a menos de 170 px). */
export function escalonCercano(lista: Escalon[], x: number, anchoCuerpo: number): Escalon | null {
  let mejor: Escalon | null = null
  let dist = Infinity
  for (const e of lista) {
    if (e.alto < SALTO.altoMin || e.alto > SALTO.altoMax || e.der - e.izq < anchoCuerpo + 8) continue
    const destino = Math.max(e.izq, Math.min(e.der - anchoCuerpo, x))
    const d = Math.abs(destino - x)
    if (d > SALTO.alcance) continue
    if (d < dist) { dist = d; mejor = e }
  }
  return mejor
}

/** Dónde apoyar los pies sobre un escalón: lo más cerca de x, sin pasarse del borde. */
export function apoyoEn(e: Escalon, x: number, anchoCuerpo: number): number {
  return Math.max(e.izq, Math.min(e.der - anchoCuerpo, x))
}

/** Arco de salto: t de 0 a 1, altura desde y0 hasta y1 con una parábola que sube un poco más que el destino. */
export function arcoSalto(t: number, y0: number, y1: number): number {
  const k = Math.max(0, Math.min(1, t))
  const extra = Math.max(24, (y1 - y0) * 0.35)
  return y0 + (y1 - y0) * k + extra * 4 * k * (1 - k)
}

/** Caída: t de 0 a 1, acelera hacia el piso. */
export function caida(t: number, y0: number): number {
  const k = Math.max(0, Math.min(1, t))
  return y0 * (1 - k * k)
}
