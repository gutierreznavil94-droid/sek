/**
 * «Lo no cumplido resta» en la base: qué faltó un día, aplicar las restas al cerrarlo y el aviso de hoy.
 * Las cuentas están en domain/resta.ts. Cada resta queda en el historial de XP con su nombre
 * («Entrenamiento sin hacer») y una clave única: el mismo día nunca resta dos veces.
 */
import { db } from '../data/db'
import type { Ajustes } from '../data/tipos'
import { cuotaDelDia } from '../domain/cuotas'
import { diaSemanaDe, fechaDe, type FechaDia } from '../domain/fechas'
import { balanceDe, configResta, restasDelDia, type ConfigResta, type Faltante } from '../domain/resta'
import { claveXp, totalXp } from '../domain/xp'
import { guardarAjustes, obtenerAjustes, registrarEvento } from './base'
import { cicloActivo } from './ciclo'
import { ahora } from './reloj'
import { anularXp, reglaDeAccion } from './xp'

export const claveResta = (id: string, fecha: FechaDia) => claveXp('resta', [id, fecha])

/** Lee la configuración y, si está prendida y todavía no tiene día de inicio, lo fija hoy (nunca hacia atrás). */
export async function asegurarInicioResta(hoy: FechaDia): Promise<ConfigResta> {
  const a = await obtenerAjustes()
  const cfg = configResta(a)
  if (cfg.activa && !cfg.desde) {
    await guardarAjustes({ xpResta: { ...(a.xpResta ?? {}), activa: true, porcentaje: cfg.porcentaje, desde: hoy } }, 'Lo no cumplido resta: empieza hoy')
    return { ...cfg, desde: hoy }
  }
  return cfg
}

/** Prender o apagar desde Más → Ajustes. Al prender, vale desde hoy (lo de antes no se toca). */
export async function cambiarResta(cambios: { activa?: boolean; porcentaje?: number }, hoy: FechaDia): Promise<Ajustes> {
  const a = await obtenerAjustes()
  const cfg = configResta(a)
  const activa = cambios.activa ?? cfg.activa
  const prende = activa && !cfg.activa
  const porcentaje = cambios.porcentaje !== undefined ? Math.max(10, Math.min(100, Math.round(cambios.porcentaje))) : cfg.porcentaje
  return guardarAjustes({ xpResta: { activa, porcentaje, desde: prende || !cfg.desde ? hoy : cfg.desde } }, activa ? `Lo no cumplido resta ${porcentaje} %` : 'Lo no cumplido ya no resta')
}

/**
 * Lo que tocaba ese día y no se cumplió. `abierto` (hoy): cuenta también lo pendiente, para el aviso.
 * Pilar: tiene compromiso ese día (si no, era descanso o no tocaba) y quedó sin marcar; «tarde» ya está hecho.
 * Serie: activa, creada antes de terminar el día y por debajo de la cuota (la primera meta).
 */
export async function faltantesDelDia(fecha: FechaDia, abierto = false): Promise<Faltante[]> {
  const d = db()
  const ciclo = await cicloActivo()
  if (!ciclo || fecha < ciclo.inicio) return []
  if (await d.excepciones.get(fecha)) return []
  const a = await obtenerAjustes()
  const r: Faltante[] = []
  const acciones = (await d.acciones.filter((x) => x.activa && !!x.pilar).toArray()).sort((x, y) => x.orden - y.orden)
  for (const accion of acciones) {
    const c = await d.compromisos.get(`${accion.id}:${fecha}`)
    if (!c) continue
    const falta = c.estado === 'omitido' || c.estado === 'no_registrado' || (abierto && (c.estado === 'pendiente' || c.estado === 'iniciado'))
    if (!falta) continue
    // Comer según el plan: un día sin comidas cargadas no se evalúa (ni hoy, ni al cerrar).
    if (abierto && accion.tipo === 'comida_plan') continue
    if (!accion.dias.includes(diaSemanaDe(fecha)) && accion.tipo !== 'entrenamiento') continue
    const regla = await reglaDeAccion(accion.id, fecha)
    const xp = regla ? regla.xp : accion.tipo === 'compromiso' ? a.xpCompromisoPorDefecto : 0
    if (xp > 0) r.push({ id: accion.id, nombre: accion.nombre, xp, tipo: 'pilar' })
  }
  const contadores = (await d.contadores.toArray()).filter((c) => c.activo).sort((x, y) => x.orden - y.orden)
  for (const c of contadores) {
    if (c.creado && fechaDe(c.creado, a.zonaHoraria) > fecha) continue
    const regs = await d.registrosContador.where('[contadorId+fecha]').equals([c.id, fecha]).toArray()
    const total = regs.reduce((s, x) => s + x.cantidad, 0)
    if (total >= cuotaDelDia(c, fecha).cuota) continue
    if (c.xpMetaDiaria > 0) r.push({ id: `serie-${c.id}`, nombre: c.nombre, xp: c.xpMetaDiaria, tipo: 'serie' })
  }
  return r
}

/** Al cerrar el día: guarda una resta por cada cosa que faltó. Idempotente. Devuelve lo que restó. */
export async function aplicarRestas(fecha: FechaDia): Promise<number> {
  const d = db()
  const cfg = configResta(await obtenerAjustes())
  if (!cfg.activa || !cfg.desde || fecha < cfg.desde) return 0
  const faltantes = await faltantesDelDia(fecha)
  if (!faltantes.length) return 0
  return d.transaction('rw', [d.xp, d.eventos], async () => {
    // Las que ya estaban (otra apertura cerró el día) no se repiten.
    const ya = new Set((await d.xp.where('fecha').equals(fecha).toArray()).filter((x) => x.origen === 'resta').map((x) => x.clave))
    const nuevas = faltantes.filter((f) => !ya.has(claveResta(f.id, fecha)))
    const restas = restasDelDia(nuevas, cfg, fecha, totalXp(await d.xp.toArray()))
    let total = 0
    for (const x of restas) {
      const clave = claveResta(x.id, fecha)
      await d.xp.add({ clave, cantidad: -x.cantidad, origen: 'resta', fecha, creado: ahora(), descripcion: `${x.nombre} sin hacer` })
      await registrarEvento({ tipo: 'anular_xp', entidad: 'xp', entidadId: clave, motivo: `${x.nombre} sin hacer`, despues: { cantidad: -x.cantidad } })
      total += x.cantidad
    }
    return total
  })
}

/** Si se corrige (el pilar se marca después, la serie llega a la cuota), la resta de ese día se devuelve. */
export async function devolverResta(id: string, fecha: FechaDia, motivo = 'Corregido: ya está hecho'): Promise<boolean> {
  return anularXp(claveResta(id, fecha), motivo)
}

/** Aviso de hoy (Revisión diaria y notificación al alistarse): lo que falta y cuánto restaría. */
export async function avisoRestaHoy(hoy: FechaDia): Promise<{ faltantes: Faltante[]; porcentaje: number } | null> {
  const cfg = configResta(await obtenerAjustes())
  if (!cfg.activa || !cfg.desde || hoy < cfg.desde) return null
  const faltantes = await faltantesDelDia(hoy, true)
  return faltantes.length ? { faltantes, porcentaje: cfg.porcentaje } : null
}

/** «Ayer: +35 / −8»: lo ganado y lo perdido de un día. */
export async function balanceDelDia(fecha: FechaDia): Promise<{ mas: number; menos: number }> {
  return balanceDe(await db().xp.where('fecha').equals(fecha).toArray())
}
