/** Fuente «estimada»: lo que registra la app sola cada noche, con las correcciones a mano. */

import { db } from '../../data/db'
import type { RegistroSuenio } from '../../data/tipos'
import type { FechaDia } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import { dormidoEstimado, levantadoEstimado } from '../estimar'
import type { FuenteDeSuenio, NocheDeFuente } from './tipos'

type AjustesNoche = { latenciaDormirseMinutos: number; horaFinSuenio: string; zonaHoraria: string }

/** Convierte un registro guardado en una noche con la fuente de cada dato. Las noches viejas (sin fuente) quedan como «estimado». */
export function nocheDesdeRegistro(r: RegistroSuenio, a: AjustesNoche): NocheDeFuente {
  const acostado = r.acostadoManual ?? r.horaReal
  const fAcostado = r.fuenteAcostado ?? (r.acostadoManual !== undefined ? 'corregido' : 'estimado')
  const fDormido = r.fuenteDormido ?? 'estimado'
  const fLevantado = r.fuenteLevantado ?? (r.levantadoCorregido ? 'corregido' : 'estimado')
  const dormido = r.dormido ?? dormidoEstimado(acostado, r.latenciaMinutos ?? a.latenciaDormirseMinutos)
  const levantado = r.levantado ?? levantadoEstimado(r.noche, a.horaFinSuenio, a.zonaHoraria)
  return {
    noche: r.noche,
    acostado: { valor: acostado, fuente: fAcostado },
    dormido: { valor: dormido, fuente: fDormido },
    levantado: { valor: levantado, fuente: fLevantado },
    etapas: r.etapas,
  }
}

export const fuenteEstimada: FuenteDeSuenio = {
  id: 'estimada',
  nombre: 'Estimado por la app',
  disponible: async () => true,
  async traerNoches(desde: FechaDia, hasta: FechaDia) {
    const a = await obtenerAjustes()
    const regs = await db().suenio.where('noche').between(desde, hasta, true, true).toArray()
    return regs.map((r) => nocheDesdeRegistro(r, a))
  },
}
