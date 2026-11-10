/**
 * Temporizador de juego manual. La sesión activa vive en la base de datos,
 * así que cerrar o recargar la app no la pierde.
 */

import { db } from '../data/db'
import type { SesionJuego } from '../data/tipos'
import { lunesDe, sumarDias, type FechaDia } from '../domain/fechas'
import { duracionMs, estaPausada, estadoLimite, minutosPorDia, minutosPorDiaConCelu, type EstadoLimite } from '../domain/juego'
import { tramosCelu } from './juegoCelu'
import { obtenerAjustes, registrarEvento } from './base'
import { limiteJuegoDelDia } from './feriados'
import { ahora } from './reloj'

export async function sesionActiva(): Promise<SesionJuego | undefined> {
  const d = db()
  const t = await d.temporizador.get('activo')
  if (!t) return undefined
  const s = await d.sesionesJuego.get(t.sesionId)
  if (!s || s.fin) {
    await d.temporizador.delete('activo')
    return undefined
  }
  return s
}

export async function iniciarJuego(): Promise<SesionJuego> {
  const d = db()
  const activa = await sesionActiva()
  if (activa) return activa
  return d.transaction('rw', [d.sesionesJuego, d.temporizador, d.eventos], async () => {
    const s: SesionJuego = { inicio: ahora(), pausas: [] }
    const id = await d.sesionesJuego.add(s)
    await d.temporizador.put({ id: 'activo', sesionId: id as number })
    await registrarEvento({ tipo: 'crear', entidad: 'sesionJuego', entidadId: String(id), despues: s })
    return { ...s, id: id as number }
  })
}

export async function pausarJuego(): Promise<SesionJuego | undefined> {
  const d = db()
  const s = await sesionActiva()
  if (!s || estaPausada(s)) return s
  const pausas = [...s.pausas, { desde: ahora() }]
  await d.sesionesJuego.update(s.id!, { pausas })
  return { ...s, pausas }
}

export async function reanudarJuego(): Promise<SesionJuego | undefined> {
  const d = db()
  const s = await sesionActiva()
  if (!s || !estaPausada(s)) return s
  const pausas = s.pausas.map((p, i) => (i === s.pausas.length - 1 ? { ...p, hasta: ahora() } : p))
  await d.sesionesJuego.update(s.id!, { pausas })
  return { ...s, pausas }
}

export async function finalizarJuego(nota?: string): Promise<SesionJuego | undefined> {
  const d = db()
  const s = await sesionActiva()
  if (!s) return undefined
  const t = ahora()
  const pausas = s.pausas.map((p) => (p.hasta === undefined ? { ...p, hasta: t } : p))
  const despues = { ...s, pausas, fin: t, nota }
  await d.transaction('rw', [d.sesionesJuego, d.temporizador, d.eventos], async () => {
    await d.sesionesJuego.put(despues)
    await d.temporizador.delete('activo')
    await registrarEvento({ tipo: 'editar', entidad: 'sesionJuego', entidadId: String(s.id), antes: s, despues })
  })
  return despues
}

/** Corrige a mano el inicio y fin de una sesión terminada. Queda en el historial. */
export async function corregirSesion(id: number, inicio: number, fin: number, motivo: string): Promise<void> {
  const d = db()
  if (fin <= inicio) throw new Error('El fin debe ser posterior al inicio')
  await d.transaction('rw', [d.sesionesJuego, d.eventos], async () => {
    const antes = await d.sesionesJuego.get(id)
    if (!antes) return
    const despues: SesionJuego = { ...antes, inicio, fin, pausas: [], corregida: true }
    await d.sesionesJuego.put(despues)
    await registrarEvento({ tipo: 'corregir', entidad: 'sesionJuego', entidadId: String(id), antes, despues, motivo })
  })
}

/** Añade una sesión pasada a mano (olvidé registrar). */
export async function agregarSesionManual(inicio: number, fin: number, motivo: string): Promise<number> {
  const d = db()
  if (fin <= inicio) throw new Error('El fin debe ser posterior al inicio')
  return d.transaction('rw', [d.sesionesJuego, d.eventos], async () => {
    const s: SesionJuego = { inicio, fin, pausas: [], corregida: true, nota: motivo }
    const id = (await d.sesionesJuego.add(s)) as number
    await registrarEvento({ tipo: 'crear', entidad: 'sesionJuego', entidadId: String(id), despues: s, motivo })
    return id
  })
}

export async function borrarSesion(id: number, motivo: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.sesionesJuego, d.temporizador, d.eventos], async () => {
    const antes = await d.sesionesJuego.get(id)
    if (!antes) return
    await d.sesionesJuego.delete(id)
    const t = await d.temporizador.get('activo')
    if (t?.sesionId === id) await d.temporizador.delete('activo')
    await registrarEvento({ tipo: 'borrar', entidad: 'sesionJuego', entidadId: String(id), antes, motivo })
  })
}

export type ResumenJuego = {
  activa: SesionJuego | undefined
  pausada: boolean
  minutosSesion: number
  minutosHoy: number
  minutosSemana: number
  /** Suma de los límites de los 7 días de la semana. */
  limiteSemana: number
  /** Límite que aplica hoy. */
  limiteMinutos: number
  limitesPorDia: Map<FechaDia, number>
  estado: EstadoLimite
  porDia: Map<FechaDia, number>
  /** Hoy, por separado: lo del temporizador y lo que contaron solos los juegos del celu (sin lo que se pisa). */
  minutosManualHoy: number
  minutosCeluHoy: number
}

export async function resumenJuego(hoy: FechaDia): Promise<ResumenJuego> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const activa = await sesionActiva()
  const t = ahora()
  const desde = sumarDias(hoy, -60)
  const sesiones = await d.sesionesJuego.filter((s) => (s.fin ?? t) >= Date.parse(desde)).toArray()
  const manual = minutosPorDia(sesiones, t, ajustes.zonaHoraria)
  const celu = await tramosCelu(Date.parse(desde), t).catch(() => [])
  const porDia = celu.length ? minutosPorDiaConCelu(sesiones, celu, t, ajustes.zonaHoraria) : manual
  const minutosHoy = Math.round(porDia.get(hoy) ?? 0)
  const minutosManualHoy = Math.round(manual.get(hoy) ?? 0)
  const lunes = lunesDe(hoy)
  let minutosSemana = 0
  let limiteSemana = 0
  const limitesPorDia = new Map<FechaDia, number>()
  for (let i = -60; i < 7; i++) {
    const f = sumarDias(lunes, i)
    const lim = await limiteJuegoDelDia(f)
    limitesPorDia.set(f, lim)
    if (i >= 0) {
      minutosSemana += porDia.get(f) ?? 0
      limiteSemana += lim
    }
  }
  const limiteMinutos = limitesPorDia.get(hoy) ?? ajustes.limiteJuegoSemana
  return {
    activa,
    pausada: activa ? estaPausada(activa) : false,
    minutosSesion: activa ? duracionMs(activa, t) / 60_000 : 0,
    minutosHoy,
    minutosSemana: Math.round(minutosSemana),
    limiteSemana,
    limiteMinutos,
    limitesPorDia,
    estado: estadoLimite(minutosHoy, limiteMinutos, ajustes.avisoJuegoPorcentaje),
    porDia,
    minutosManualHoy,
    minutosCeluHoy: Math.max(0, minutosHoy - minutosManualHoy),
  }
}

export async function historialJuego(limite = 50): Promise<SesionJuego[]> {
  return db().sesionesJuego.orderBy('inicio').reverse().limit(limite).toArray()
}
