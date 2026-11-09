/**
 * Alarmas del día: qué tiene que sonar y cuándo, calculado desde la
 * configuración (horas editables en Más). Se programan detrás de la interfaz
 * de recordatorios: en la web no se programan (solo el reloj del teléfono
 * sirve con la app cerrada); en la app Android son notificaciones reales.
 */

import { db } from '../data/db'
import { diaSemanaDe, fechaDe, instanteDe, minutosDe, sumarDias, type FechaDia } from '../domain/fechas'
import { fijarSonidoAlarmas, recordatorios, type Recordatorio } from '../reminders/recordatorios'
import { obtenerAjustes } from './base'
import { cicloActivo, primerDia } from './ciclo'
import { horaFinMargen } from './dia'
import { fraseDormir, minutosAvisoDormir } from './dormir'
import { bloquesDelDia } from './horario'
import { ahora } from './reloj'
import { AVISOS, configAviso } from './avisos'

export type Alarma = Recordatorio & { fecha: FechaDia; hora: string; tipo: TipoAlarma }

export type TipoAlarma = 'entrenamiento' | 'entreno-aviso' | 'revision' | 'alistarse' | 'celu' | 'dormido' | 'horario' | 'salida' | 'propio'

/** Los avisos de hora fija (Más → Alarmas); los de Juego se programan al arrancar el temporizador. */
export const TIPOS_ALARMA = AVISOS.filter((x) => !x.tipo.startsWith('juego'))

/** Las alarmas de una fecha según la configuración actual. Solo dentro del ciclo. */
export async function alarmasDelDia(fecha: FechaDia): Promise<Alarma[]> {
  const ciclo = await cicloActivo()
  if (!ciclo || fecha < primerDia(ciclo) || fecha > sumarDias(ciclo.inicio, ciclo.duracionDias - 1)) return []
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
  const minAlistarse = minutosAvisoDormir(a)
  const instCelu = instanteDe(fecha, a.horaDejarCelu, a.zonaHoraria)
  // Alistarse para dormir: a la hora de alistarse de Sueño (20:50); si falta, unos minutos antes de «Dejo celu».
  const horaAlist = a.horaAlistarse && minutosDe(a.horaAlistarse) < minutosDe(a.horaDejarCelu) ? a.horaAlistarse : horaMenos(a.horaDejarCelu, minAlistarse)
  const faltanCelu = Math.round((instCelu - instanteDe(fecha, horaAlist, a.zonaHoraria)) / 60_000)
  lista.push({ id: `alarma:alistarse:${fecha}`, tipo: 'alistarse', fecha, hora: horaAlist, titulo: `Alistarse para dormir · Dejo celu en ${faltanCelu} min`, cuerpo: fraseDormir(a, fecha), instante: instanteDe(fecha, horaAlist, a.zonaHoraria) })
  lista.push({ id: `alarma:celu:${fecha}`, tipo: 'celu', fecha, hora: a.horaDejarCelu, titulo: 'Dejo celu', cuerpo: 'Celular abajo, fuera del cuarto. Tocá «Dejo celu» en la app.', instante: instanteDe(fecha, a.horaDejarCelu, a.zonaHoraria) })
  lista.push({ id: `alarma:dormido:${fecha}`, tipo: 'dormido', fecha, hora: a.horaDormido, titulo: 'A dormir', cuerpo: 'Hora de estar dormido. Buenas noches.', instante: instanteDe(fecha, a.horaDormido, a.zonaHoraria) })
  // Mi horario: un aviso al empezar cada franja (los obligatorios también: «Ahora: Facultad, hasta 18:00»).
  for (const b of (await bloquesDelDia(fecha)).filter((x) => x.origen === 'bloque')) {
    lista.push({ id: `alarma:horario:${fecha}:${b.id}`, tipo: 'horario', fecha, hora: b.desde, titulo: `Ahora: ${b.nombre}`, cuerpo: `Hasta las ${b.hasta}.`, instante: instanteDe(fecha, b.desde, a.zonaHoraria) })
  }
  // Avisos propios («+ Agregar aviso»).
  for (const p of a.avisosPropios ?? []) {
    if (!p.dias.includes(ds) || p.modo === 'nada' || !/^\d\d:\d\d$/.test(p.hora)) continue
    lista.push({ id: `alarma:propio:${fecha}:${p.id}`, tipo: 'propio', fecha, hora: p.hora, titulo: p.nombre, cuerpo: 'Aviso propio', instante: instanteDe(fecha, p.hora, a.zonaHoraria), modo: p.modo, vibrar: p.vibrar ?? true })
  }
  // Cada aviso como Notificación, Alarma o Nada, con la hora cambiada a mano si la hay.
  const configurados = lista.map((x) => {
    if (x.tipo === 'propio') return x
    const c = configAviso(a, x.tipo)
    const conHora = c.hora && c.hora !== x.hora ? { ...x, hora: c.hora, instante: instanteDe(fecha, c.hora, a.zonaHoraria) } : x
    return { ...conHora, modo: c.modo, vibrar: c.vibrar }
  })
  const conHorario = await callarEnObligatorios(fecha, configurados.filter((x) => x.tipo === 'horario' || x.modo !== 'nada'), a.zonaHoraria)
  return conHorario
    .map((x) => (x.tipo === 'salida' ? { ...x, modo: configAviso(a, 'salida').modo, vibrar: configAviso(a, 'salida').vibrar } : x))
    .filter((x) => x.modo !== 'nada')
}

/** «22:30» menos 30 min → «22:00». */
function horaMenos(hora: string, minutos: number): string {
  const m = (((minutosDe(hora) - minutos) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
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
    const calladas = lista.filter((x) => x.tipo !== 'entrenamiento' && x.tipo !== 'horario' && x.instante >= desde && x.instante < fin)
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
  fijarSonidoAlarmas((await obtenerAjustes()).sonidoAlarma)
  const previas = await recordatorios.programados()
  for (const p of previas) if (p.id.startsWith('alarma:')) await recordatorios.cancelar(p.id)
  const proximas = await alarmasProximas(dias)
  for (const r of proximas) await recordatorios.programar(r)
  return proximas.length
}

/**
 * Avisos de Juego (al % y al 100 % del tiempo diario), según lo que queda hoy. Se programan al arrancar o reanudar
 * el temporizador y se cancelan al pausar o terminar.
 */
export async function programarAvisosJuego(minutosHoy: number, limiteMinutos: number): Promise<void> {
  const a = await obtenerAjustes()
  fijarSonidoAlarmas(a.sonidoAlarma)
  const t = ahora()
  const mitad = configAviso(a, 'juego-mitad')
  const limite = configAviso(a, 'juego-limite')
  await cancelarAvisosJuego()
  const enMitad = (limiteMinutos * mitad.porcentaje) / 100 - minutosHoy
  if (mitad.modo !== 'nada' && enMitad > 0) {
    await recordatorios.programar({ id: 'juego-cerca', titulo: 'Juego', cuerpo: `Vas por el ${mitad.porcentaje} % del tiempo de hoy (${limiteMinutos} min).`, instante: t + enMitad * 60_000, modo: mitad.modo, vibrar: mitad.vibrar })
  }
  const enLimite = limiteMinutos - minutosHoy
  if (limite.modo !== 'nada' && enLimite > 0) {
    await recordatorios.programar({ id: 'juego-limite', titulo: 'Juego: tiempo cumplido', cuerpo: `Llegaste a los ${limiteMinutos} min de hoy. Pausá o terminá la sesión.`, instante: t + enLimite * 60_000, modo: limite.modo, vibrar: limite.vibrar })
  }
}

export async function cancelarAvisosJuego(): Promise<void> {
  await recordatorios.cancelar('juego-cerca')
  await recordatorios.cancelar('juego-limite')
}

/** La hora que usa la app para cada aviso hoy (antes de cambiarla a mano), para mostrarla en Más → Alarmas. */
export async function horasDeEntrada(fecha: FechaDia): Promise<Partial<Record<TipoAlarma, string>>> {
  const a = await obtenerAjustes()
  const d = db()
  const ds = diaSemanaDe(fecha)
  const entreno = await d.acciones.get('entrenamiento')
  const revision = await d.acciones.get('revision_diaria')
  const minAlistarse = minutosAvisoDormir(a)
  return {
    entrenamiento: entreno?.horasPorDia?.[ds] ?? entreno?.hora ?? '07:00',
    'entreno-aviso': entreno?.avisoInicio?.hora,
    revision: revision?.horaLimite ?? a.horaAlistarse,
    alistarse: a.horaAlistarse && minutosDe(a.horaAlistarse) < minutosDe(a.horaDejarCelu) ? a.horaAlistarse : horaMenos(a.horaDejarCelu, minAlistarse),
    celu: a.horaDejarCelu,
    dormido: a.horaDormido,
  }
}
