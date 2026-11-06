/**
 * «Lo no cumplido resta» (v0.83, pedido de Navil): al cerrar el día, cada pilar o serie rápida que tocaba
 * y no se cumplió resta una parte de la XP que da (50 % por defecto, redondeado para arriba).
 *
 * - Doble meta (Dibujar 15/30 min, cuota y extra de las series): con la primera meta ya queda cubierto.
 * - No resta: días de descanso o que no tocan, lo pausado (inactivo), los días con excepción y la forja.
 * - La XP total nunca baja de 0. Se aplica desde el día en que se activa, nunca hacia atrás.
 * Sin React y sin base de datos: las cuentas puras, para probarlas sin la app.
 */
import type { FechaDia } from './fechas'

export type ConfigResta = { activa: boolean; porcentaje: number; desde: FechaDia | null }
export const RESTA_DEFECTO = { activa: true, porcentaje: 50 }

/** Lo guardado en Ajustes (o lo de siempre si falta). `desde` null = todavía no se fijó el día de inicio. */
export function configResta(a: { xpResta?: Partial<ConfigResta> } | null | undefined): ConfigResta {
  const x = a?.xpResta ?? {}
  const p = Number(x.porcentaje)
  return {
    activa: x.activa ?? RESTA_DEFECTO.activa,
    porcentaje: Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : RESTA_DEFECTO.porcentaje,
    desde: x.desde ?? null,
  }
}

/** Cuánto resta algo que da `xp`: la mitad (o el %), redondeado para arriba. */
export function cuantoResta(xp: number, porcentaje: number): number {
  if (!(xp > 0) || !(porcentaje > 0)) return 0
  return Math.ceil((xp * porcentaje) / 100)
}

export type Faltante = { id: string; nombre: string; xp: number; tipo: 'pilar' | 'serie' }

/** ¿Este día cuenta para restar? Activa, con día de inicio y la fecha desde ese día. */
export function aplicaEnFecha(cfg: ConfigResta, fecha: FechaDia): boolean {
  return cfg.activa && !!cfg.desde && fecha >= cfg.desde && cfg.porcentaje > 0
}

export type Resta = { id: string; nombre: string; tipo: Faltante['tipo']; cantidad: number }

/**
 * Las restas de un día. `totalAntes` es la XP total en ese momento: nunca se saca más de lo que hay,
 * así que la última resta puede quedar más chica (o no estar).
 */
export function restasDelDia(faltantes: Faltante[], cfg: ConfigResta, fecha: FechaDia, totalAntes: number): Resta[] {
  if (!aplicaEnFecha(cfg, fecha)) return []
  let queda = Math.max(0, Math.floor(totalAntes))
  const r: Resta[] = []
  for (const f of faltantes) {
    const cantidad = Math.min(queda, cuantoResta(f.xp, cfg.porcentaje))
    if (cantidad <= 0) continue
    queda -= cantidad
    r.push({ id: f.id, nombre: f.nombre, tipo: f.tipo, cantidad })
  }
  return r
}

/** «Te quedan 2 sin hacer: −15 XP si no los hacés hoy» (null si no falta nada). */
export function textoAvisoResta(faltantes: Faltante[], porcentaje: number): string | null {
  const total = faltantes.reduce((s, f) => s + cuantoResta(f.xp, porcentaje), 0)
  if (!faltantes.length || total <= 0) return null
  const n = faltantes.length
  return `Te ${n === 1 ? 'queda 1' : `quedan ${n}`} sin hacer: −${total} XP si no ${n === 1 ? 'lo hacés' : 'los hacés'} hoy`
}

/** Lo ganado y lo perdido de un día, con registros de XP (sin anulados). */
export function balanceDe(registros: { cantidad: number; anulado?: boolean }[]): { mas: number; menos: number } {
  let mas = 0
  let menos = 0
  for (const r of registros) {
    if (r.anulado) continue
    if (r.cantidad >= 0) mas += r.cantidad
    else menos -= r.cantidad
  }
  return { mas, menos }
}
