/**
 * Avisos (Más → Alarmas): cada aviso de la app se elige como Notificación, Alarma o Nada.
 *
 * - Notificación: aviso normal de Android (respeta No molestar).
 * - Alarma: alarma real (en la app Android suena y vibra con pantalla completa hasta «Apagar» o «Posponer»).
 * - Nada: no avisa.
 *
 * Los valores de entrada salen de lo que pidió Navil (8 nov 2026): Juego al 50 % notificación, Juego al 100 % alarma,
 * Alistarse para dormir alarma, Dejo celu nada, Entreno notificación. Todo editable.
 */
import type { Ajustes, AvisoPropio, ConfigAviso, ModoAviso } from '../data/tipos'
import { FUNCION_DEL_AVISO, usa } from './funciones'

export type TipoAviso =
  | 'juego-mitad' | 'juego-limite'
  | 'entrenamiento' | 'entreno-aviso' | 'revision' | 'alistarse' | 'celu' | 'dormido' | 'horario' | 'salida'

export type DefAviso = {
  tipo: TipoAviso
  nombre: string
  /** Cuándo suena, en palabras (si la hora no es editable). */
  cuando?: string
  modo: ModoAviso
  /** Se le puede cambiar la hora a mano. */
  horaEditable?: boolean
  /** Se le puede cambiar el porcentaje (Juego). */
  conPorcentaje?: boolean
}

/** La lista de avisos, en el orden en que se muestran. */
export const AVISOS: DefAviso[] = [
  { tipo: 'juego-mitad', nombre: 'Juego: primer aviso', cuando: 'al llegar al % del tiempo diario', modo: 'notificacion', conPorcentaje: true },
  { tipo: 'juego-limite', nombre: 'Juego: tiempo cumplido', cuando: 'al llegar al 100 % del tiempo diario', modo: 'alarma' },
  { tipo: 'entrenamiento', nombre: 'Entreno', modo: 'notificacion', horaEditable: true },
  { tipo: 'entreno-aviso', nombre: 'Empezá el entreno (si no empezaste)', modo: 'notificacion', horaEditable: true },
  { tipo: 'revision', nombre: 'Revisión diaria', modo: 'notificacion', horaEditable: true },
  { tipo: 'alistarse', nombre: 'Alistarse para dormir', modo: 'alarma', horaEditable: true },
  { tipo: 'celu', nombre: 'Dejo celu', modo: 'nada', horaEditable: true },
  { tipo: 'dormido', nombre: 'A dormir', modo: 'notificacion', horaEditable: true },
  { tipo: 'horario', nombre: 'Mi horario: al empezar cada franja', cuando: 'al empezar cada franja', modo: 'notificacion' },
  { tipo: 'salida', nombre: 'Al salir de un obligatorio: lo que falta', cuando: 'al terminar la franja', modo: 'notificacion' },
]

export const PORCENTAJE_JUEGO = 50

export type AvisoEfectivo = { modo: ModoAviso; hora?: string; porcentaje: number; vibrar: boolean }

/** Cómo está configurado un aviso: lo guardado o, si falta, el de entrada (lo apagado antes de v0.88.3 queda en Nada). */
export function configAviso(a: Pick<Ajustes, 'avisos' | 'alarmasApagadas' | 'funciones'>, tipo: TipoAviso | string): AvisoEfectivo {
  const def = AVISOS.find((x) => x.tipo === tipo)
  const c: ConfigAviso = a.avisos?.[tipo] ?? {}
  const apagadoViejo = (a.alarmasApagadas ?? []).includes(tipo)
  // Si su parte de la app está apagada («¿Qué querés usar?»), el aviso no suena.
  const funcion = FUNCION_DEL_AVISO[tipo]
  const sinFuncion = !!funcion && !usa(a, funcion)
  return {
    modo: sinFuncion ? 'nada' : c.modo ?? (apagadoViejo ? 'nada' : def?.modo ?? 'notificacion'),
    hora: c.hora && /^\d\d:\d\d$/.test(c.hora) ? c.hora : undefined,
    porcentaje: Math.min(99, Math.max(5, Math.round(c.porcentaje ?? PORCENTAJE_JUEGO))),
    vibrar: c.vibrar ?? true,
  }
}

/** Ajustes nuevos con un aviso cambiado (para guardarAjustes). */
export function conAviso(a: Pick<Ajustes, 'avisos'>, tipo: string, cambio: Partial<ConfigAviso>): Record<string, ConfigAviso> {
  const previo = a.avisos?.[tipo] ?? {}
  const nuevo: ConfigAviso = { ...previo, ...cambio }
  if (cambio.hora === undefined && 'hora' in cambio) delete nuevo.hora
  return { ...(a.avisos ?? {}), [tipo]: nuevo }
}

export function nombreModo(m: ModoAviso): string {
  return m === 'alarma' ? 'Alarma' : m === 'nada' ? 'Nada' : 'Notificación'
}

/** Un aviso propio nuevo con valores de entrada. */
export function avisoPropioNuevo(nombre: string, hora: string, dias: number[], modo: ModoAviso): AvisoPropio {
  return { id: `propio-${Date.now().toString(36)}`, nombre: nombre.trim() || 'Aviso', hora, dias: dias.length ? dias : [0, 1, 2, 3, 4, 5, 6], modo, vibrar: true }
}
