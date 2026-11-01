/**
 * Cumplimiento, rachas y atributos.
 *
 * Todo sale de los compromisos programados y su estado. No hay notas
 * subjetivas: cada número se puede explicar con el desglose que devuelve
 * cada función.
 */

import { sumarDias, type FechaDia } from './fechas'

export type EstadoCompromiso = 'pendiente' | 'iniciado' | 'completado' | 'tarde' | 'omitido' | 'reprogramado' | 'no_registrado'

export type CompromisoResumen = {
  accionId: string
  fecha: FechaDia
  estado: EstadoCompromiso
  /** Peso en el cálculo de atributos y cumplimiento (1 por defecto). */
  peso?: number
  /** Atributos a los que alimenta. */
  atributoIds: string[]
  /** true si el día está marcado como excepción (enfermedad, viaje). */
  excepcion?: boolean
  /** Pilar del día. Si hay pilares, el cumplimiento diario se calcula solo sobre ellos. */
  pilar?: boolean
}

/** Cuenta en el denominador: lo que tocaba hacer ese día. */
export function cuentaComoProgramado(c: CompromisoResumen, esHoy: boolean): boolean {
  if (c.excepcion) return false
  if (c.estado === 'reprogramado') return false
  // Del día de hoy solo cuenta lo ya resuelto, para que el valor no caiga cada mañana.
  if (esHoy && (c.estado === 'pendiente' || c.estado === 'iniciado')) return false
  return true
}

export function cuentaComoCumplido(c: CompromisoResumen): boolean {
  return c.estado === 'completado'
}

export type DesgloseCumplimiento = {
  cumplidos: number
  programados: number
  /** 0..100, o null si no había nada programado. */
  porcentaje: number | null
}

/** Cumplimiento de un conjunto de compromisos (de un día, una semana...). */
export function cumplimiento(compromisos: CompromisoResumen[], hoy: FechaDia | null = null): DesgloseCumplimiento {
  let cumplidos = 0
  let programados = 0
  // Si hay pilares, el cumplimiento del día se mide solo sobre los pilares que aplican.
  const hayPilares = compromisos.some((c) => c.pilar)
  for (const c of compromisos) {
    if (hayPilares && !c.pilar) continue
    if (!cuentaComoProgramado(c, c.fecha === hoy)) continue
    programados += c.peso ?? 1
    if (cuentaComoCumplido(c)) cumplidos += c.peso ?? 1
  }
  return {
    cumplidos,
    programados,
    porcentaje: programados > 0 ? Math.round((100 * cumplidos) / programados) : null,
  }
}

export type NivelCumplimiento = 'sin_datos' | 'bajo' | 'medio' | 'alto'

/** Clasificación para el calendario (gris, rojo, ámbar, verde). */
export function nivelCumplimiento(porcentaje: number | null, umbralAlto = 80): NivelCumplimiento {
  if (porcentaje === null) return 'sin_datos'
  if (porcentaje >= umbralAlto) return 'alto'
  if (porcentaje >= 50) return 'medio'
  return 'bajo'
}

/**
 * Racha: días seguidos, terminando en `hasta`, con cumplimiento ≥ umbral.
 * `porDia` mapea fecha → porcentaje (null = sin datos, que corta la racha
 * salvo que sea un día de excepción, que se salta sin contar).
 */
export function racha(
  porDia: Map<FechaDia, { porcentaje: number | null; excepcion?: boolean }>,
  hasta: FechaDia,
  umbral = 80,
  maxDias = 400,
): number {
  let dias = 0
  let f = hasta
  for (let i = 0; i < maxDias; i++) {
    const d = porDia.get(f)
    if (!d) break
    if (d.excepcion) {
      f = sumarDias(f, -1)
      continue
    }
    if (d.porcentaje === null || d.porcentaje < umbral) break
    dias++
    f = sumarDias(f, -1)
  }
  return dias
}

export type DesgloseAtributo = {
  atributoId: string
  /** 0..100, o null si hay datos insuficientes. */
  valor: number | null
  cumplidos: number
  programados: number
  ventanaDias: number
  desde: FechaDia
  hasta: FechaDia
  minimoProgramados: number
  /** Por acción: cuántos programados y cumplidos. */
  porAccion: { accionId: string; cumplidos: number; programados: number }[]
}

/**
 * Valor de un atributo: % de cumplimiento de las acciones vinculadas en una
 * ventana móvil (14 días por defecto). Con menos de `minimoProgramados`
 * compromisos programados devuelve null ("datos insuficientes").
 */
export function calcularAtributo(
  atributoId: string,
  compromisos: CompromisoResumen[],
  hoy: FechaDia,
  ventanaDias = 14,
  minimoProgramados = 5,
): DesgloseAtributo {
  const desde = sumarDias(hoy, -(ventanaDias - 1))
  const porAccion = new Map<string, { cumplidos: number; programados: number }>()
  let cumplidos = 0
  let programados = 0
  for (const c of compromisos) {
    if (!c.atributoIds.includes(atributoId)) continue
    if (c.fecha < desde || c.fecha > hoy) continue
    if (!cuentaComoProgramado(c, c.fecha === hoy)) continue
    const peso = c.peso ?? 1
    const acc = porAccion.get(c.accionId) ?? { cumplidos: 0, programados: 0 }
    acc.programados += peso
    programados += peso
    if (cuentaComoCumplido(c)) {
      acc.cumplidos += peso
      cumplidos += peso
    }
    porAccion.set(c.accionId, acc)
  }
  return {
    atributoId,
    valor: programados >= minimoProgramados ? Math.round((100 * cumplidos) / programados) : null,
    cumplidos,
    programados,
    ventanaDias,
    desde,
    hasta: hoy,
    minimoProgramados,
    porAccion: [...porAccion.entries()].map(([accionId, v]) => ({ accionId, ...v })),
  }
}
