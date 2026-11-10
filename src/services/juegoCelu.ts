/**
 * Juego que cuenta solo: el tiempo en los juegos del celu (Juego → «Mis juegos del celu», solo APK)
 * se suma al temporizador manual, sin contar dos veces lo que se pisa. Android guarda el uso de varios días,
 * así que un día se cierra bien aunque no hayas abierto SEK.
 */
import type { Tramo } from '../domain/juego'
import { minutosPorDia, minutosPorDiaConCelu } from '../domain/juego'
import { fechaDe, sumarDias, type FechaDia } from '../domain/fechas'
import { db } from '../data/db'
import { guardarVigiaNativo, tramosDeJuegosCelu } from '../nativo/sek'
import { obtenerAjustes } from './base'
import { limiteJuegoDelDia } from './feriados'
import { ahora } from './reloj'
import { configAviso } from './avisos'

let cache: { clave: string; cuando: number; tramos: Tramo[] } | null = null

/** Tramos de juegos del celu entre dos instantes (con un poco de memoria para no preguntarle a Android a cada rato). */
export async function tramosCelu(desde: number, hasta: number): Promise<Tramo[]> {
  const a = await obtenerAjustes()
  const juegos = (a.vigia?.juegos ?? []).map((j) => j.paquete)
  if (!juegos.length) return []
  const clave = `${juegos.join(',')}|${desde}`
  const t = ahora()
  if (cache && cache.clave === clave && t - cache.cuando < 20_000 && hasta <= t) return cache.tramos
  const tramos = await tramosDeJuegosCelu(juegos, desde, hasta)
  cache = { clave, cuando: t, tramos }
  return tramos
}

export function olvidarTramosCelu(): void { cache = null }

/** Minutos de juego de una fecha: manual + celu. */
export async function minutosJuegoDelDia(fecha: FechaDia): Promise<number> {
  const a = await obtenerAjustes()
  const sesiones = await db().sesionesJuego.toArray()
  const desde = Date.parse(sumarDias(fecha, -1))
  const celu = await tramosCelu(desde, ahora()).catch(() => [])
  return Math.round(minutosPorDiaConCelu(sesiones, celu, ahora(), a.zonaHoraria).get(fecha) ?? 0)
}

/** Le pasa a Android la config de «Apps que te atrapan» + juegos, los límites de juego y lo manual de hoy. */
export async function sincronizarVigia(): Promise<void> {
  const a = await obtenerAjustes()
  if (!a.vigia) return
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const limitesJuego: Record<string, number> = {}
  for (let i = 0; i < 8; i++) { const f = sumarDias(hoy, i); limitesJuego[f] = await limiteJuegoDelDia(f) }
  const manual = minutosPorDia(await db().sesionesJuego.toArray(), ahora(), a.zonaHoraria)
  await guardarVigiaNativo(a.vigia, {
    limitesJuego,
    manualJuego: { [hoy]: Math.round(manual.get(hoy) ?? 0) },
    avisoJuego: configAviso(a, 'juego-mitad').porcentaje ?? a.avisoJuegoPorcentaje ?? 50,
  })
}
