/**
 * Alarmas del día: qué tiene que sonar y cuándo, calculado desde la
 * configuración (horas editables en Más). Se programan detrás de la interfaz
 * de recordatorios: en la web no se programan (solo el reloj del teléfono
 * sirve con la app cerrada); en la app Android son notificaciones reales.
 */

import { db } from '../data/db'
import { diaSemanaDe, fechaDe, instanteDe, minutosDe, sumarDias, type FechaDia } from '../domain/fechas'
import { recordatorios, type Recordatorio } from '../reminders/recordatorios'
import { obtenerAjustes } from './base'
import { cicloActivo } from './ciclo'
import { horaFinMargen } from './dia'
import { bloquesDelDia } from './horario'
import { ahora } from './reloj'

export type Alarma = Recordatorio & { fecha: FechaDia; hora: string; tipo: 'entrenamiento' | 'entreno-aviso' | 'revision' | 'celu' | 'dormido' | 'salida' }

/** Las alarmas de una fecha según la configuración actual. Solo dentro del ciclo. */
export async function alarmasDelDia(fecha: FechaDia): Promise<Alarma[]> {
  const ciclo = await cicloActivo()
  if (!ciclo || fecha < ciclo.inicio || fecha > sumarDias(ciclo.inicio, ciclo.duracionDias - 1)) return []
  const a = await obtenerAjustes()
  const d = db()
  const lista: Alarma[] = []
  // Despertar: unos minutos antes de la hora de levantarse (cierra el registro de sueño de la noche anterior).
  const entreno = await d.acciones.get('entrenamiento')
  const ds = diaSemanaDe(fecha)
  if (entreno?.activa && entreno.dias.includes(ds)) {
    const c = await d.compromisos.get(`entrenamiento:${fecha}`)
    const hora = c?.horaPrevista ?? entreno.horasPorDia?.[ds] ?? entreno.hora ?? '07:00'
    if (!c || c.estado === 'pendiente' || c.estado === 'iniciado') {
      lista.push({ id: `alarma:entrenamiento:${fecha}`, tipo: 'entrenamiento', fecha, hora, titulo: 'Entrenamiento', cuerpo: `${entreno.duracionMinutos ?? entreno.minutosMinimos ?? 42} min. Tocá el pilar al terminar.`, instante: instanteDe(fecha, hora, a.zonaHoraria) })
    }
    // Aviso de las 19:00 si todavía no empezó (en la app Android suena aunque esté cerrada; si ya empezó, se reprograma sin él).
    if (entreno.avisoInicio?.activo && entreno.horaLimiteInicio && (!c || c.estado === 'pendiente')) {
      const h = entreno.avisoInicio.hora
      const faltan = minutosDe(entreno.horaLimiteInicio) - minutosDe(h)
      lista.push({ id: `alarma:entreno-aviso:${fecha}`, tipo: 'entreno-aviso', fecha, hora: h, titulo: 'Empezá el entreno', cuerpo: `Quedan ${faltan} min: hasta las ${entreno.horaLimiteInicio} el pilar cuenta.`, instante: instanteDe(fecha, h, a.zonaHoraria) })
    }
  }
  const revision = await d.acciones.get('revision_diaria')
  const horaRev = revision?.horaLimite ?? a.horaAlistarse
  lista.push({ id: `alarma:revision:${fecha}`, tipo: 'revision', fecha, hora: horaRev, titulo: 'Completá tu revisión ahora', cuerpo: `Menos de 3 min. Marcá manga y empresa si faltan: a las ${horaFinMargen(horaRev, a.margenNocheMinutos)} queda sin cumplir.`, instante: instanteDe(fecha, horaRev, a.zonaHoraria) })
  lista.push({ id: `alarma:celu:${fecha}`, tipo: 'celu', fecha, hora: a.horaDejarCelu, titulo: 'Dejo celu', cuerpo: 'Celular abajo, fuera del cuarto. Tocá «Dejo celu» en la app.', instante: instanteDe(fecha, a.horaDejarCelu, a.zonaHoraria) })
  lista.push({ id: `alarma:dormido:${fecha}`, tipo: 'dormido', fecha, hora: a.horaDormido, titulo: 'A dormir', cuerpo: 'Hora de estar dormido. Buenas noches.', instante: instanteDe(fecha, a.horaDormido, a.zonaHoraria) })
  return callarEnObligatorios(fecha, lista, a.zonaHoraria)
}

/**
 * Mi horario: durante un bloque obligatorio (facultad, trabajo) no suenan avisos de pilares; al salir llega
 * uno solo con lo que falta. El del entrenamiento a su hora sigue igual.
 */
async function callarEnObligatorios(fecha: FechaDia, lista: Alarma[], zona: string): Promise<Alarma[]> {
  const obligatorios = (await bloquesDelDia(fecha)).filter((b) => b.tipo === 'obligatorio')
  if (!obligatorios.length) return lista.sort((x, y) => x.instante - y.instante)
  const salida: Alarma[] = []
  for (const b of obligatorios) {
    const desde = instanteDe(fecha, b.desde, zona)
    const fin = instanteDe(fecha, b.hasta, zona)
    const calladas = lista.filter((x) => x.tipo !== 'entrenamiento' && x.instante >= desde && x.instante < fin)
    if (!calladas.length) continue
    lista = lista.filter((x) => !calladas.includes(x))
    const faltan = calladas.map((x) => x.titulo)
    salida.push({ id: `alarma:salida:${fecha}:${b.id}`, tipo: 'salida', fecha, hora: b.hasta, titulo: `Saliste de ${b.nombre}`, cuerpo: `Te queda: ${faltan.join(' · ')}`, instante: fin })
  }
  return [...lista, ...salida].sort((x, y) => x.instante - y.instante)
}

/** Alarmas de los próximos `dias` días que todavía no sonaron. */
export async function alarmasProximas(dias = 7): Promise<Alarma[]> {
  const a = await obtenerAjustes()
  const hoy = fechaDe(ahora(), a.zonaHoraria)
  const t = ahora()
  const todas: Alarma[] = []
  for (let i = 0; i < dias; i++) todas.push(...(await alarmasDelDia(sumarDias(hoy, i))))
  return todas.filter((x) => x.instante > t)
}

/**
 * Reprograma todas las alarmas en el dispositivo. Solo donde pueden sonar con
 * la app cerrada (app Android); en la web no hace nada y devuelve 0.
 * Se llama al abrir la app y después de cada cambio de horarios.
 */
export async function programarAlarmas(dias = 7): Promise<number> {
  if (!recordatorios.capacidades().conAppCerrada) return 0
  const previas = await recordatorios.programados()
  for (const p of previas) if (p.id.startsWith('alarma:')) await recordatorios.cancelar(p.id)
  const proximas = await alarmasProximas(dias)
  for (const r of proximas) await recordatorios.programar(r)
  return proximas.length
}

