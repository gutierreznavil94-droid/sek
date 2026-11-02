/**
 * Utilidades comunes de los servicios: ajustes, eventos e inicialización.
 */

import { db } from '../data/db'
import { ACCIONES_INICIALES, AJUSTES_INICIALES, ATRIBUTOS_INICIALES, IDENTIDAD_INICIAL, reglasIniciales } from '../data/semilla'
import type { Ajustes, Evento, Identidad, TipoEvento } from '../data/tipos'
import { fechaDe } from '../domain/fechas'
import { cargarContadoresIniciales } from './contadores'
import { cargarRutinasIniciales } from './entreno'
import { cargarFeriadosIniciales } from './feriados'
import { ahora } from './reloj'

export async function obtenerAjustes(): Promise<Ajustes> {
  const a = await db().ajustes.get('unicos')
  return { ...AJUSTES_INICIALES, ...(a ?? {}) }
}

export async function guardarAjustes(cambios: Partial<Ajustes>, motivo?: string): Promise<Ajustes> {
  const antes = await obtenerAjustes()
  const despues = { ...antes, ...cambios, id: 'unicos' as const }
  await db().transaction('rw', db().ajustes, db().eventos, async () => {
    await db().ajustes.put(despues)
    await registrarEvento({ tipo: 'editar', entidad: 'ajustes', entidadId: 'unicos', antes, despues, motivo })
  })
  return despues
}

export async function obtenerIdentidad(): Promise<Identidad> {
  const i = await db().identidad.get('unica')
  return i ?? { ...IDENTIDAD_INICIAL, actualizado: 0 }
}

export async function guardarIdentidad(cambios: Partial<Pick<Identidad, 'vision' | 'obstaculos'>>): Promise<void> {
  const antes = await obtenerIdentidad()
  const despues: Identidad = { ...antes, ...cambios, id: 'unica', actualizado: ahora() }
  await db().transaction('rw', db().identidad, db().eventos, async () => {
    await db().identidad.put(despues)
    await registrarEvento({ tipo: 'editar', entidad: 'identidad', entidadId: 'unica', antes, despues })
  })
}

/** Registra una fila de historial. Debe llamarse dentro de la transacción del cambio. */
export async function registrarEvento(e: Omit<Evento, 'id' | 'instante'> & { instante?: number }): Promise<void> {
  await db().eventos.add({ ...e, instante: e.instante ?? ahora() })
}

export async function fechaHoy(): Promise<string> {
  const a = await obtenerAjustes()
  return fechaDe(ahora(), a.zonaHoraria)
}

/** Carga los datos iniciales si la base está vacía, y aplica migraciones si ya había datos. Es idempotente. */
export async function inicializarSiHaceFalta(): Promise<void> {
  const d = db()
  const yaHay = await d.atributos.count()
  if (yaHay > 0) {
    await migrar()
    return
  }
  const t = ahora()
  const hoy = fechaDe(t, AJUSTES_INICIALES.zonaHoraria)
  await d.transaction('rw', [d.ajustes, d.identidad, d.atributos, d.acciones, d.reglasXp, d.eventos], async () => {
    await d.ajustes.put(AJUSTES_INICIALES)
    await d.identidad.put({ ...IDENTIDAD_INICIAL, actualizado: t })
    await d.atributos.bulkPut(ATRIBUTOS_INICIALES.map((a) => ({ ...a, creado: t })))
    await d.acciones.bulkPut(ACCIONES_INICIALES.map((a) => ({ ...a, creado: t })))
    await d.reglasXp.bulkPut(reglasIniciales(hoy).map((r) => ({ ...r, creado: t })))
    await registrarEvento({ tipo: 'crear', entidad: 'semilla', entidadId: 'inicial', instante: t })
  })
  await cargarFeriadosIniciales()
  await cargarContadoresIniciales()
  await cargarRutinasIniciales()
}

/**
 * Migraciones de datos existentes (cambios 03): pilares, descanso en tres
 * pasos y límite de juego por tipo de día. Solo añade lo que falta.
 */
async function migrar(): Promise<void> {
  const d = db()
  const t = ahora()
  const hoy = fechaDe(t, (await obtenerAjustes()).zonaHoraria)
  await d.transaction('rw', [d.acciones, d.reglasXp, d.ajustes, d.eventos], async () => {
    for (const base of ACCIONES_INICIALES) {
      let existente = await d.acciones.get(base.id)
      if (!existente) {
        await d.acciones.put({ ...base, creado: t })
        const regla = reglasIniciales(hoy).find((r) => r.accionId === base.id)
        if (regla) await d.reglasXp.put({ ...regla, creado: t })
        await registrarEvento({ tipo: 'crear', entidad: 'accion', entidadId: base.id, despues: base, motivo: 'Migración: pilar nuevo' })
      } else if (existente.nombre === 'Entrenamiento programado') {
        existente = { ...existente, nombre: 'Entrenamiento' }
        await d.acciones.put(existente)
      }
      // Cambios 05: el entrenamiento tiene duración fija (un toque = hecho).
      if (existente && base.tipo === 'entrenamiento' && existente.duracionMinutos === undefined) {
        existente = { ...existente, duracionMinutos: base.duracionMinutos, minutosMinimos: base.minutosMinimos, condicion: base.condicion }
        await d.acciones.put(existente)
      }
      // Cambios 06: la revisión diaria pasa de las 22:30 a las 20:50 (con margen hasta las 21:00).
      if (existente && base.tipo === 'revision_diaria' && existente.hora === '22:30') {
        const despues = { ...existente, hora: base.hora, horaLimite: base.horaLimite, condicion: base.condicion }
        await d.acciones.put(despues)
        await registrarEvento({ tipo: 'editar', entidad: 'accion', entidadId: base.id, antes: existente, despues, motivo: 'Migración: revisión diaria a las 20:50' })
        existente = despues
      }
      if (existente && base.pilar && !existente.pilar) {
        const despues = { ...existente, pilar: true, horaLimite: base.horaLimite, ...(base.id === 'acostarse' ? { nombre: base.nombre, condicion: base.condicion, hora: base.hora, atributoIds: base.atributoIds } : {}) }
        await d.acciones.put(despues)
        await registrarEvento({ tipo: 'editar', entidad: 'accion', entidadId: base.id, antes: existente, despues, motivo: 'Migración: ahora es pilar' })
      }
    }
    // Cambios 07.1: orden de los pilares 1 Entrenamiento · 2 Empresa · 3 Manga · 4 Dormir (solo si estaba el orden viejo).
    // Se fija por id, sea cual sea el valor guardado (había teléfonos con «Dormir a horario» en el 2).
    const ordenFijo: Record<string, number> = { entrenamiento: 1, empresa: 2, manga: 3, acostarse: 4 }
    for (const [id, orden] of Object.entries(ordenFijo)) {
      const a = await d.acciones.get(id)
      if (a && a.orden !== orden) {
        await d.acciones.put({ ...a, orden })
        await registrarEvento({ tipo: 'editar', entidad: 'accion', entidadId: id, antes: { orden: a.orden }, despues: { orden }, motivo: 'Migración: orden fijo de pilares' })
      }
    }
    // Ajustes viejos: el límite único pasa a ser el de la semana; la hora de acostarse vieja no se conserva.
    const viejo = (await d.ajustes.get('unicos')) as (Partial<Ajustes> & { limiteJuegoMinutos?: number }) | undefined
    // Cambios 04: la racha pasa de 80 % a 75 % (3 de 4 pilares). Solo si no se tocó a mano.
    if (viejo && viejo.umbralRacha === 80) {
      await d.ajustes.put({ ...AJUSTES_INICIALES, ...viejo, umbralRacha: 75 } as Ajustes)
      await registrarEvento({ tipo: 'editar', entidad: 'ajustes', entidadId: 'unicos', motivo: 'Migración: umbral de racha 75 %' })
    }
    if (viejo && viejo.limiteJuegoMinutos !== undefined && viejo.limiteJuegoSemana === undefined) {
      const { limiteJuegoMinutos, ...resto } = viejo
      void limiteJuegoMinutos
      await d.ajustes.put({ ...AJUSTES_INICIALES, ...resto } as Ajustes)
    }
  })
  await cargarFeriadosIniciales()
  await cargarContadoresIniciales()
  await cargarRutinasIniciales()
}

export type EventoTipo = TipoEvento
