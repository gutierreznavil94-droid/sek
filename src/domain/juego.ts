/**
 * Temporizador de juego.
 *
 * Una sesión guarda marcas de tiempo (inicio, pausas, fin), nunca un contador
 * en memoria. Así, cerrar o recargar la app no pierde nada: la duración se
 * recalcula a partir de las marcas. Una sesión que cruza la medianoche se
 * reparte entre los dos días.
 */

import { fechaDe, inicioDelDia, sumarDias, type FechaDia, ZONA_POR_DEFECTO } from './fechas'

export type TramoPausa = { desde: number; hasta?: number }

export type SesionJuego = {
  id?: number
  inicio: number
  fin?: number
  pausas: TramoPausa[]
  nota?: string
  /** Si se corrigió a mano, el valor original y el motivo quedan en eventos. */
  corregida?: boolean
}

/** Tramos de juego activo [desde, hasta) de una sesión, descontando pausas. */
export function tramosActivos(sesion: SesionJuego, ahora: number): { desde: number; hasta: number }[] {
  const fin = sesion.fin ?? ahora
  const tramos: { desde: number; hasta: number }[] = []
  let cursor = sesion.inicio
  const pausas = [...sesion.pausas].sort((a, b) => a.desde - b.desde)
  for (const p of pausas) {
    const pDesde = Math.max(p.desde, cursor)
    const pHasta = Math.min(p.hasta ?? fin, fin)
    if (pDesde > cursor) tramos.push({ desde: cursor, hasta: Math.min(pDesde, fin) })
    cursor = Math.max(cursor, pHasta)
  }
  if (cursor < fin) tramos.push({ desde: cursor, hasta: fin })
  return tramos
}

/** Duración activa en milisegundos. */
export function duracionMs(sesion: SesionJuego, ahora: number): number {
  return tramosActivos(sesion, ahora).reduce((s, t) => s + (t.hasta - t.desde), 0)
}

export function estaPausada(sesion: SesionJuego): boolean {
  if (sesion.fin) return false
  const ultima = sesion.pausas[sesion.pausas.length - 1]
  return !!ultima && ultima.hasta === undefined
}

/** Minutos de juego por fecha de calendario. Una sesión que cruza las 00:00 se reparte. */
export function minutosPorDia(sesiones: SesionJuego[], ahora: number, zona = ZONA_POR_DEFECTO): Map<FechaDia, number> {
  const mapa = new Map<FechaDia, number>()
  for (const s of sesiones) {
    for (const t of tramosActivos(s, ahora)) {
      let cursor = t.desde
      let guardia = 0
      while (cursor < t.hasta && guardia++ < 100) {
        const fecha = fechaDe(cursor, zona)
        const finDia = inicioDelDia(sumarDias(fecha, 1), zona)
        const hasta = Math.min(finDia, t.hasta)
        mapa.set(fecha, (mapa.get(fecha) ?? 0) + (hasta - cursor) / 60_000)
        cursor = hasta
      }
    }
  }
  return mapa
}

export function minutosDelDia(sesiones: SesionJuego[], fecha: FechaDia, ahora: number, zona = ZONA_POR_DEFECTO): number {
  return minutosPorDia(sesiones, ahora, zona).get(fecha) ?? 0
}

export type EstadoLimite = 'ok' | 'cerca' | 'superado'

export function estadoLimite(minutos: number, limiteMinutos: number, avisoPorcentaje = 80): EstadoLimite {
  if (limiteMinutos <= 0) return 'ok'
  if (minutos >= limiteMinutos) return 'superado'
  if (minutos >= (limiteMinutos * avisoPorcentaje) / 100) return 'cerca'
  return 'ok'
}
