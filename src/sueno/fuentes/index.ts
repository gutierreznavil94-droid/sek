/**
 * Junta todas las fuentes de sueño. Para cada noche y cada dato se queda con
 * el de más prioridad: reloj > corregido > estimado. Para sumar un reloj:
 * escribir la fuente en esta carpeta y agregarla a FUENTES (ver LEEME.md).
 */

import type { FechaDia } from '../../domain/fechas'
import { mejorDato } from '../estimar'
import { fuenteEstimada } from './estimada'
import type { FuenteDeSuenio, NocheDeFuente } from './tipos'

export const FUENTES: FuenteDeSuenio[] = [fuenteEstimada]

export function combinarNoches(listas: NocheDeFuente[][]): NocheDeFuente[] {
  const porNoche = new Map<FechaDia, NocheDeFuente[]>()
  for (const l of listas) for (const n of l) porNoche.set(n.noche, [...(porNoche.get(n.noche) ?? []), n])
  const r: NocheDeFuente[] = []
  for (const [noche, ns] of porNoche) {
    r.push({
      noche,
      acostado: mejorDato(ns.map((n) => n.acostado)),
      dormido: mejorDato(ns.map((n) => n.dormido)),
      levantado: mejorDato(ns.map((n) => n.levantado)),
      etapas: ns.find((n) => n.etapas?.length)?.etapas,
      despertares: ns.find((n) => n.despertares !== undefined)?.despertares,
    })
  }
  return r.sort((a, b) => a.noche.localeCompare(b.noche))
}

export async function nochesEntre(desde: FechaDia, hasta: FechaDia, fuentes = FUENTES): Promise<NocheDeFuente[]> {
  const listas: NocheDeFuente[][] = []
  for (const f of fuentes) if (await f.disponible()) listas.push(await f.traerNoches(desde, hasta))
  return combinarNoches(listas)
}

export type { DatoSuenio, FuenteDeSuenio, NocheDeFuente } from './tipos'
