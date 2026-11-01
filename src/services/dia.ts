/**
 * El día: compromisos, su ciclo de vida, el cierre a medianoche y los
 * resúmenes (cumplimiento, racha, atributos).
 */

import { db } from '../data/db'
import type { Accion, Compromiso, DiaCerrado, RegistroSuenio } from '../data/tipos'
import {
  calcularAtributo,
  cumplimiento,
  racha,
  type CompromisoResumen,
  type DesgloseAtributo,
  type DesgloseCumplimiento,
  type EstadoCompromiso,
} from '../domain/cumplimiento'
import { diaSemanaDe, fechaDe, instanteDe, minutosDe, nocheDeSuenio, retrasoAcostarse, sumarDias, type FechaDia } from '../domain/fechas'
import { minutosPorDia } from '../domain/juego'
import { claveXp, type OrigenXp } from '../domain/xp'
import { obtenerAjustes, registrarEvento } from './base'
import { cicloActivo } from './ciclo'
import { limiteJuegoDelDia } from './feriados'
import { ahora } from './reloj'
import { cuotaDelDia } from '../domain/cuotas'
import { anularXp, concederXp, reglaDeAccion, xpDelDia } from './xp'

export function idCompromiso(accionId: string, fecha: FechaDia): string {
  return `${accionId}:${fecha}`
}

/** Tipos de acción que se programan como compromisos visibles en Hoy. */
const TIPOS_PROGRAMABLES: Accion['tipo'][] = ['compromiso', 'entrenamiento', 'acostarse', 'revision_diaria', 'revision_semanal', 'limite_juego']

/** Crea los compromisos de una fecha según las acciones activas. Idempotente. */
export async function generarCompromisosDelDia(fecha: FechaDia): Promise<Compromiso[]> {
  const d = db()
  // Antes del Día 1 del ciclo no se registra nada.
  const ciclo = await cicloActivo()
  if (!ciclo || fecha < ciclo.inicio) return []
  const ds = diaSemanaDe(fecha)
  const acciones = await d.acciones.filter((a) => a.activa).toArray()
  const nuevos: Compromiso[] = []
  await d.transaction('rw', [d.compromisos], async () => {
    for (const a of acciones) {
      if (!TIPOS_PROGRAMABLES.includes(a.tipo)) continue
      if (!a.dias.includes(ds)) continue
      // Una acción creada después de esa fecha no se programa hacia atrás.
      const creadaEl = fechaDe(a.creado)
      if (creadaEl > fecha) continue
      const id = idCompromiso(a.id, fecha)
      const existe = await d.compromisos.get(id)
      if (existe) continue
      const c: Compromiso = {
        id,
        accionId: a.id,
        fecha,
        horaPrevista: a.horasPorDia?.[ds] ?? a.hora,
        estado: 'pendiente',
        actualizado: ahora(),
      }
      await d.compromisos.add(c)
      nuevos.push(c)
    }
  })
  return nuevos
}

export type CompromisoConAccion = Compromiso & { accion: Accion; xpPrevisto: number }

export async function compromisosDelDia(fecha: FechaDia): Promise<CompromisoConAccion[]> {
  const d = db()
  const lista = await d.compromisos.where('fecha').equals(fecha).toArray()
  const acciones = new Map((await d.acciones.toArray()).map((a) => [a.id, a]))
  const ajustes = await obtenerAjustes()
  const resultado: CompromisoConAccion[] = []
  for (const c of lista) {
    const accion = acciones.get(c.accionId)
    if (!accion) continue
    const regla = await reglaDeAccion(c.accionId, fecha)
    const xpPrevisto = regla ? regla.xp : accion.tipo === 'compromiso' ? ajustes.xpCompromisoPorDefecto : 0
    resultado.push({ ...c, accion, xpPrevisto })
  }
  return resultado.sort((a, b) => (a.horaPrevista ?? '99').localeCompare(b.horaPrevista ?? '99') || a.accion.orden - b.accion.orden)
}

function origenDe(tipo: Accion['tipo']): OrigenXp {
  switch (tipo) {
    case 'entrenamiento':
      return 'entrenamiento'
    case 'acostarse':
      return 'suenio'
    case 'limite_juego':
      return 'juego'
    case 'revision_diaria':
      return 'revision'
    case 'revision_semanal':
      return 'semana'
    default:
      return 'compromiso'
  }
}

export function claveDeCompromiso(accion: Pick<Accion, 'id' | 'tipo'>, fecha: FechaDia): string {
  return claveXp(origenDe(accion.tipo), [accion.id, fecha])
}

async function cambiarEstado(id: string, cambios: Partial<Compromiso>, tipoEvento: 'editar' | 'corregir' = 'editar', motivo?: string): Promise<Compromiso> {
  const d = db()
  return d.transaction('rw', [d.compromisos, d.eventos], async () => {
    const antes = await d.compromisos.get(id)
    if (!antes) throw new Error(`Compromiso ${id} no existe`)
    const despues: Compromiso = { ...antes, ...cambios, actualizado: ahora() }
    await d.compromisos.put(despues)
    await registrarEvento({ tipo: tipoEvento, entidad: 'compromiso', entidadId: id, antes, despues, motivo })
    return despues
  })
}

export async function iniciarCompromiso(id: string): Promise<Compromiso> {
  return cambiarEstado(id, { estado: 'iniciado', inicioReal: ahora() })
}

export type ResultadoCompletar = { compromiso: Compromiso; xp: number; nuevoNivel: number | null; motivoSinXp?: string }

/**
 * Completa un compromiso y concede su XP (una sola vez). Si la acción es un
 * compromiso diario, aplica el tope de compromisos con XP por día.
 */
export async function completarCompromiso(id: string, opciones?: { minutos?: number; nota?: string; respuesta?: string; esCorreccion?: boolean; motivo?: string; instante?: number }): Promise<ResultadoCompletar> {
  const d = db()
  const antes = await d.compromisos.get(id)
  if (!antes) throw new Error(`Compromiso ${id} no existe`)
  const accion = await d.acciones.get(antes.accionId)
  if (!accion) throw new Error(`Acción ${antes.accionId} no existe`)
  const ajustes = await obtenerAjustes()
  const t = opciones?.instante ?? ahora()
  // Hora límite del pilar (20:50) con margen (hasta las 21:00): marcarlo después cuenta como hecho tarde y no da XP.
  const limite = accion.horaLimite && accion.tipo !== 'acostarse' ? instanteDe(antes.fecha, accion.horaLimite, ajustes.zonaHoraria) + ajustes.margenNocheMinutos * 60_000 : null
  const retrasoMinutos = limite !== null && t > limite ? Math.round((t - limite) / 60_000) : undefined
  const compromiso = await cambiarEstado(
    id,
    { estado: retrasoMinutos ? 'tarde' : 'completado', finReal: t, inicioReal: antes.inicioReal ?? t, minutos: opciones?.minutos, nota: opciones?.nota, respuesta: opciones?.respuesta, retrasoMinutos },
    opciones?.esCorreccion ? 'corregir' : 'editar',
    opciones?.motivo,
  )
  if (retrasoMinutos) {
    await anularXp(claveDeCompromiso(accion, antes.fecha), `Marcado ${retrasoMinutos} min después de la hora límite`)
    return { compromiso, xp: 0, nuevoNivel: null, motivoSinXp: `Marcado ${retrasoMinutos} min después de las ${horaFinMargen(accion.horaLimite!, ajustes.margenNocheMinutos)}: cuenta como tarde, sin XP` }
  }
  // Condición de cumplimiento: minutos mínimos (entrenamiento, manga).
  if (accion.minutosMinimos && opciones?.minutos !== undefined && opciones.minutos < accion.minutosMinimos) {
    return { compromiso, xp: 0, nuevoNivel: null, motivoSinXp: `Menos de ${accion.minutosMinimos} minutos: cuenta como hecho pero sin XP` }
  }
  const regla = await reglaDeAccion(accion.id, antes.fecha)
  const cantidad = regla ? regla.xp : accion.tipo === 'compromiso' ? ajustes.xpCompromisoPorDefecto : 0
  if (accion.tipo === 'compromiso') {
    const hoyXp = await xpDelDia(antes.fecha)
    const yaConXp = hoyXp.filter((r) => r.origen === 'compromiso').length
    if (yaConXp >= ajustes.maxCompromisosXpPorDia) {
      return { compromiso, xp: 0, nuevoNivel: null, motivoSinXp: `Tope de ${ajustes.maxCompromisosXpPorDia} compromisos con XP por día alcanzado` }
    }
  }
  if (cantidad <= 0) return { compromiso, xp: 0, nuevoNivel: null, motivoSinXp: 'Esta acción no da XP' }
  const r = await concederXp({
    clave: claveDeCompromiso(accion, antes.fecha),
    cantidad,
    origen: origenDe(accion.tipo),
    fecha: antes.fecha,
    descripcion: accion.nombre,
    reglaId: regla?.id,
  })
  return { compromiso, xp: r.concedido ? r.cantidad : 0, nuevoNivel: r.nuevoNivel, motivoSinXp: r.concedido ? undefined : r.motivo }
}

export async function omitirCompromiso(id: string, nota?: string): Promise<Compromiso> {
  return cambiarEstado(id, { estado: 'omitido', nota })
}

/** Reprograma a otra fecha: el original no cuenta ni da XP; se crea uno nuevo en la fecha destino. */
export async function reprogramarCompromiso(id: string, nuevaFecha: FechaDia): Promise<Compromiso> {
  const d = db()
  const antes = await d.compromisos.get(id)
  if (!antes) throw new Error(`Compromiso ${id} no existe`)
  if (nuevaFecha <= antes.fecha) throw new Error('La nueva fecha debe ser posterior')
  return d.transaction('rw', [d.compromisos, d.eventos], async () => {
    await cambiarEstado(id, { estado: 'reprogramado', reprogramadoA: nuevaFecha })
    const nuevoId = idCompromiso(antes.accionId, nuevaFecha)
    const existe = await d.compromisos.get(nuevoId)
    if (existe) return existe
    const nuevo: Compromiso = {
      id: nuevoId,
      accionId: antes.accionId,
      fecha: nuevaFecha,
      horaPrevista: antes.horaPrevista,
      estado: 'pendiente',
      reprogramadoDesde: antes.fecha,
      actualizado: ahora(),
    }
    await d.compromisos.add(nuevo)
    await registrarEvento({ tipo: 'crear', entidad: 'compromiso', entidadId: nuevoId, despues: nuevo, motivo: `Reprogramado desde ${antes.fecha}` })
    return nuevo
  })
}

/** Vuelve a pendiente y anula el XP que hubiera dado. Queda en el historial. */
export async function deshacerCompromiso(id: string, motivo = 'Deshacer'): Promise<Compromiso> {
  const d = db()
  const antes = await d.compromisos.get(id)
  if (!antes) throw new Error(`Compromiso ${id} no existe`)
  const accion = await d.acciones.get(antes.accionId)
  if (accion) await anularXp(claveDeCompromiso(accion, antes.fecha), motivo)
  return cambiarEstado(id, { estado: 'pendiente', finReal: undefined, minutos: undefined, retrasoMinutos: undefined, respuesta: undefined }, 'corregir', motivo)
}

/** Corrección explícita de un día ya cerrado (ventana de 48 h en la interfaz). */
export async function corregirCompromiso(id: string, nuevoEstado: EstadoCompromiso, motivo: string, minutos?: number): Promise<void> {
  const d = db()
  const antes = await d.compromisos.get(id)
  if (!antes) throw new Error(`Compromiso ${id} no existe`)
  if (nuevoEstado === 'completado') {
    // Una corrección explícita se evalúa a la hora prevista del día, no a la hora de la corrección.
    const ajustes = await obtenerAjustes()
    await completarCompromiso(id, { minutos, esCorreccion: true, motivo, instante: instanteDe(antes.fecha, '12:00', ajustes.zonaHoraria) })
  } else {
    const accion = await d.acciones.get(antes.accionId)
    if (accion) await anularXp(claveDeCompromiso(accion, antes.fecha), motivo)
    await cambiarEstado(id, { estado: nuevoEstado, finReal: undefined }, 'corregir', motivo)
  }
  await recalcularDiaCerrado(antes.fecha)
}

// ---------- Dejo celu (dormir a horario) ----------

export type ResultadoAcostarse = { registro: RegistroSuenio; cumplido: boolean; xp: number; nuevoNivel: number | null; noche: FechaDia }

/**
 * «Dejo celu»: registra la hora real de dejar el celular. Pertenece a la noche
 * planificada aunque sea después de las 00:00. Si es hasta la hora límite, el
 * pilar «Dormir a horario» queda cumplido y da su XP una sola vez; si no,
 * queda como tarde con los minutos de retraso. Deja registrada también la
 * rutina nocturna: no hay que marcarla aparte.
 */
export async function registrarDejoCelu(instante = ahora(), nota?: string): Promise<ResultadoAcostarse> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const noche = nocheDeSuenio(instante, ajustes.zonaHoraria, ajustes.horaCorteNoche)
  const ciclo = await cicloActivo()
  if (!ciclo || noche < ciclo.inicio) throw new Error('El ciclo todavía no empezó: no se registra nada antes del Día 1')
  const accion = await d.acciones.get('acostarse')
  const id = idCompromiso('acostarse', noche)
  let compromiso = await d.compromisos.get(id)
  const horaPrevista = compromiso?.horaPrevista ?? accion?.horaLimite ?? ajustes.horaDejarCelu
  const retrasoMinutos = retrasoAcostarse(noche, horaPrevista, instante, ajustes.zonaHoraria)
  const cumplido = retrasoMinutos <= 0
  // Ventana: después de la hora límite tardía (22:15) ya no se registra; la noche queda omitida al cerrar el día.
  if (instante > instanteDe(noche, ajustes.horaLimiteCelu, ajustes.zonaHoraria)) {
    throw new Error(`Pasaron las ${ajustes.horaLimiteCelu}: «Dejo celu» ya no se registra. La noche queda sin cumplir.`)
  }
  const registro: RegistroSuenio = { noche, horaPrevista, horaReal: instante, retrasoMinutos: Math.max(0, retrasoMinutos), cumplido, rutinaRegistrada: true, nota, creado: ahora() }
  await d.transaction('rw', [d.suenio, d.compromisos, d.eventos], async () => {
    const previo = await d.suenio.where('noche').equals(noche).first()
    if (previo) {
      await d.suenio.update(previo.id!, registro)
      await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: previo, despues: registro })
    } else {
      await d.suenio.add(registro)
      await registrarEvento({ tipo: 'crear', entidad: 'suenio', entidadId: noche, despues: registro })
    }
    if (!compromiso && accion) {
      compromiso = { id, accionId: 'acostarse', fecha: noche, horaPrevista, estado: 'pendiente', actualizado: ahora() }
      await d.compromisos.add(compromiso)
    }
  })
  let xp = 0
  let nuevoNivel: number | null = null
  if (compromiso) {
    if (cumplido) {
      const r = await completarCompromiso(id, { nota, instante })
      xp = r.xp
      nuevoNivel = r.nuevoNivel
    } else {
      await anularXp(claveXp('suenio', ['acostarse', noche]), 'Dejó el celu después de la hora límite')
      await cambiarEstado(id, { estado: 'tarde', finReal: instante, retrasoMinutos, nota: `Dejó el celu ${retrasoMinutos} min tarde` })
    }
  }
  return { registro, cumplido, xp, nuevoNivel, noche }
}

/** Deshace el registro de «Dejo celu» de una noche. Queda en el historial. */
export async function deshacerDejoCelu(noche: FechaDia, motivo = 'Deshacer «Dejo celu»'): Promise<void> {
  const d = db()
  const previo = await d.suenio.where('noche').equals(noche).first()
  await anularXp(claveXp('suenio', ['acostarse', noche]), motivo)
  await d.transaction('rw', [d.suenio, d.eventos], async () => {
    if (previo) {
      await d.suenio.delete(previo.id!)
      await registrarEvento({ tipo: 'corregir', entidad: 'suenio', entidadId: noche, antes: previo, motivo })
    }
  })
  const c = await d.compromisos.get(idCompromiso('acostarse', noche))
  if (c) await cambiarEstado(c.id, { estado: 'pendiente', finReal: undefined, retrasoMinutos: undefined, nota: undefined }, 'corregir', motivo)
}

/** Alias conservado para compatibilidad. */
export const registrarAcostarse = registrarDejoCelu

// ---------- Ventana de la noche (20:50 + margen) ----------

/** HH:MM de una hora límite más su margen (20:50 + 10 → 21:00). */
export function horaFinMargen(horaLimite: string, margenMinutos: number): string {
  const total = minutosDe(horaLimite) + margenMinutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export type VentanaNoche = {
  /** Hora del aviso único (20:50). */
  horaAviso: string
  /** Hora en que lo pendiente queda omitido (21:00). */
  horaCierre: string
  instanteAviso: number
  instanteCierre: number
  /** Hasta cuándo se puede marcar «Dejo celu» tarde (22:15). */
  instanteFinCelu: number
}

/** Horas de la noche de una fecha: aviso de las 20:50, cierre a las 21:00 y fin de la ventana de «Dejo celu». */
export async function ventanaNoche(fecha: FechaDia): Promise<VentanaNoche> {
  const a = await obtenerAjustes()
  const revision = await db().acciones.get('revision_diaria')
  const horaAviso = revision?.horaLimite ?? a.horaAlistarse
  const horaCierre = horaFinMargen(horaAviso, a.margenNocheMinutos)
  return {
    horaAviso,
    horaCierre,
    instanteAviso: instanteDe(fecha, horaAviso, a.zonaHoraria),
    instanteCierre: instanteDe(fecha, horaAviso, a.zonaHoraria) + a.margenNocheMinutos * 60_000,
    instanteFinCelu: instanteDe(fecha, a.horaLimiteCelu, a.zonaHoraria),
  }
}

/**
 * A las 21:00 (hora límite + margen) lo que sigue sin marcar queda omitido:
 * manga, empresa y la revisión diaria. Idempotente; devuelve los ids omitidos.
 */
export async function cerrarVentanaNoche(fecha: FechaDia): Promise<string[]> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const t = ahora()
  const acciones = new Map((await d.acciones.toArray()).map((a) => [a.id, a]))
  const pendientes = await d.compromisos.where('fecha').equals(fecha).filter((c) => c.estado === 'pendiente' || c.estado === 'iniciado').toArray()
  const omitidos: string[] = []
  for (const c of pendientes) {
    const a = acciones.get(c.accionId)
    if (!a?.horaLimite || a.tipo === 'acostarse') continue
    const cierre = instanteDe(fecha, a.horaLimite, ajustes.zonaHoraria) + ajustes.margenNocheMinutos * 60_000
    if (t <= cierre) continue
    await cambiarEstado(c.id, { estado: 'omitido', nota: `Sin marcar a las ${horaFinMargen(a.horaLimite, ajustes.margenNocheMinutos)}` })
    omitidos.push(c.id)
  }
  return omitidos
}

// ---------- Cierre de día ----------

/** Instante a partir del cual se puede cerrar la fecha `fecha` (la hora de corte de la noche siguiente). */
async function instanteDeCierre(fecha: FechaDia): Promise<number> {
  const a = await obtenerAjustes()
  return instanteDe(sumarDias(fecha, 1), a.horaCorteNoche, a.zonaHoraria)
}

/**
 * Cierra todos los días anteriores que sigan abiertos. Se llama al abrir la
 * app, al volver a primer plano y al pasar la medianoche.
 * Devuelve las fechas cerradas.
 */
export async function cerrarDiasPendientes(): Promise<FechaDia[]> {
  const d = db()
  const ciclo = await cicloActivo()
  if (!ciclo) return []
  const ajustes = await obtenerAjustes()
  const hoy = fechaDe(ahora(), ajustes.zonaHoraria)
  const cerradas: FechaDia[] = []
  const ultimoCerrado = (await d.diasCerrados.orderBy('fecha').last())?.fecha
  let f = ultimoCerrado ? sumarDias(ultimoCerrado, 1) : ciclo.inicio
  let guardia = 0
  while (f < hoy && guardia++ < 1000) {
    if (ahora() < (await instanteDeCierre(f))) break
    await cerrarDia(f)
    cerradas.push(f)
    f = sumarDias(f, 1)
  }
  // Asegura los compromisos de hoy y aplica el cierre de las 21:00 si ya pasó.
  if (hoy >= ciclo.inicio) {
    await generarCompromisosDelDia(hoy)
    await cerrarVentanaNoche(hoy)
  }
  return cerradas
}

async function cerrarDia(fecha: FechaDia): Promise<DiaCerrado> {
  const d = db()
  const ajustes = await obtenerAjustes()
  await generarCompromisosDelDia(fecha)
  const excepcion = await d.excepciones.get(fecha)
  // 1. Lo que quedó sin marcar pasa a "omitido".
  const pendientes = await d.compromisos.where('fecha').equals(fecha).filter((c) => c.estado === 'pendiente' || c.estado === 'iniciado').toArray()
  for (const c of pendientes) {
    if (c.accionId === 'limite_juego') continue
    await cambiarEstado(c.id, { estado: 'omitido', nota: 'Sin marcar al cerrar el día' })
  }
  // 2. Límite de juego: se decide una sola vez al cerrar.
  const limite = await d.compromisos.get(idCompromiso('limite_juego', fecha))
  const sesiones = await d.sesionesJuego.toArray()
  const minutosJuego = Math.round(minutosPorDia(sesiones, ahora(), ajustes.zonaHoraria).get(fecha) ?? 0)
  const limiteMin = await limiteJuegoDelDia(fecha)
  if (limite && (limite.estado === 'pendiente' || limite.estado === 'iniciado')) {
    if (minutosJuego <= limiteMin) await completarCompromiso(limite.id, { instante: instanteDe(fecha, '23:59', ajustes.zonaHoraria) })
    else await cambiarEstado(limite.id, { estado: 'omitido', nota: `${minutosJuego} min de juego, límite ${limiteMin}` })
  }
  // 3. Cumplimiento del día y foto de atributos.
  const cerrado = await recalcularDiaCerrado(fecha, minutosJuego, !!excepcion)
  // 4. Bonificación de racha: cada bloque de 7 días.
  const r = await rachaHasta(fecha)
  if (r > 0 && r % 7 === 0) {
    await concederXp({ clave: claveXp('racha7', [fecha]), cantidad: ajustes.xpRacha7, origen: 'racha7', fecha, descripcion: `Racha de ${r} días` })
  }
  await d.transaction('rw', [d.eventos], async () => {
    await registrarEvento({ tipo: 'cerrar_dia', entidad: 'dia', entidadId: fecha, despues: cerrado })
  })
  return cerrado
}

/** Recalcula y guarda el resumen de un día (al cerrar o tras una corrección). */
export async function recalcularDiaCerrado(fecha: FechaDia, minutosJuego?: number, excepcion?: boolean): Promise<DiaCerrado> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const previo = await d.diasCerrados.get(fecha)
  if (minutosJuego === undefined) {
    const sesiones = await d.sesionesJuego.toArray()
    minutosJuego = Math.round(minutosPorDia(sesiones, ahora(), ajustes.zonaHoraria).get(fecha) ?? 0)
  }
  if (excepcion === undefined) excepcion = !!(await d.excepciones.get(fecha))
  const resumen = await resumenDeCompromisos(fecha, fecha)
  const c = cumplimiento(resumen, null)
  const cerrado: DiaCerrado = {
    fecha,
    cumplidos: c.cumplidos,
    programados: c.programados,
    porcentaje: excepcion ? null : c.porcentaje,
    minutosJuego,
    excepcion,
    cerradoEn: previo?.cerradoEn ?? ahora(),
  }
  const atributos = await d.atributos.toArray()
  const ventana = await resumenDeCompromisos(sumarDias(fecha, -30), fecha)
  await d.transaction('rw', [d.diasCerrados, d.atributosDiarios], async () => {
    await d.diasCerrados.put(cerrado)
    for (const a of atributos) {
      const desglose = calcularAtributo(a.id, ventana, fecha, a.ventanaDias, ajustes.minimoProgramadosAtributo)
      const existente = await d.atributosDiarios.where('[atributoId+fecha]').equals([a.id, fecha]).first()
      const fila = { fecha, atributoId: a.id, valor: desglose.valor, cumplidos: desglose.cumplidos, programados: desglose.programados }
      if (existente) await d.atributosDiarios.update(existente.id!, fila)
      else await d.atributosDiarios.add(fila)
    }
  })
  return cerrado
}

// ---------- Resúmenes ----------

/** Compromisos de un rango convertidos al formato de cálculo del dominio. */
export async function resumenDeCompromisos(desde: FechaDia, hasta: FechaDia): Promise<CompromisoResumen[]> {
  const d = db()
  const lista = await d.compromisos.where('fecha').between(desde, hasta, true, true).toArray()
  const acciones = new Map((await d.acciones.toArray()).map((a) => [a.id, a]))
  const excepciones = new Set((await d.excepciones.where('fecha').between(desde, hasta, true, true).toArray()).map((e) => e.fecha))
  const base: CompromisoResumen[] = lista
    .filter((c) => acciones.has(c.accionId))
    .map((c) => {
      const a = acciones.get(c.accionId)!
      return { accionId: c.accionId, fecha: c.fecha, estado: c.estado, peso: a.peso, atributoIds: a.atributoIds, excepcion: excepciones.has(c.fecha), pilar: !!a.pilar }
    })
  // Contadores (flexiones, dominadas): cada día del ciclo cuenta como «programado» para sus atributos,
  // cumplido si se llegó a la meta diaria. No son pilares: no entran en la racha ni en el cumplimiento del día.
  const ciclo = await cicloActivo()
  if (ciclo) {
    const ajustes = await obtenerAjustes()
    const hoy = fechaDe(ahora(), ajustes.zonaHoraria)
    const contadores = (await d.contadores.toArray()).filter((c) => c.activo && c.atributoIds.length > 0)
    for (const c of contadores) {
      const totales = new Map<FechaDia, number>()
      for (const r of await d.registrosContador.where('[contadorId+fecha]').between([c.id, desde], [c.id, hasta], true, true).toArray()) totales.set(r.fecha, (totales.get(r.fecha) ?? 0) + r.cantidad)
      const creadoEl = fechaDe(c.creado, ajustes.zonaHoraria)
      for (let f = desde < ciclo.inicio ? ciclo.inicio : desde; f <= hasta && f <= hoy; f = sumarDias(f, 1)) {
        if (f < creadoEl) continue
        const total = totales.get(f) ?? 0
        const estado: EstadoCompromiso = total >= cuotaDelDia(c, f).cuota ? 'completado' : f === hoy ? 'pendiente' : 'omitido'
        base.push({ accionId: `contador:${c.id}`, fecha: f, estado, peso: 1, atributoIds: c.atributoIds, excepcion: excepciones.has(f), pilar: false })
      }
    }
  }
  return base
}

export async function cumplimientoDelDia(fecha: FechaDia, hoy: FechaDia): Promise<DesgloseCumplimiento> {
  return cumplimiento(await resumenDeCompromisos(fecha, fecha), hoy)
}

export async function cumplimientoEntre(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<DesgloseCumplimiento> {
  return cumplimiento(await resumenDeCompromisos(desde, hasta), hoy)
}

/** Mapa fecha → porcentaje, para calendario y racha. Usa días cerrados y, para hoy, el cálculo en vivo. */
export async function cumplimientoPorDia(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<Map<FechaDia, { porcentaje: number | null; excepcion?: boolean; cumplidos: number; programados: number }>> {
  const d = db()
  const mapa = new Map<FechaDia, { porcentaje: number | null; excepcion?: boolean; cumplidos: number; programados: number }>()
  const cerrados = await d.diasCerrados.where('fecha').between(desde, hasta, true, true).toArray()
  for (const c of cerrados) mapa.set(c.fecha, { porcentaje: c.porcentaje, excepcion: c.excepcion, cumplidos: c.cumplidos, programados: c.programados })
  // Días abiertos dentro del rango (normalmente hoy y, hasta las 06:00, ayer).
  const resumen = await resumenDeCompromisos(desde, hasta)
  const porFecha = new Map<FechaDia, CompromisoResumen[]>()
  for (const r of resumen) {
    if (mapa.has(r.fecha)) continue
    porFecha.set(r.fecha, [...(porFecha.get(r.fecha) ?? []), r])
  }
  for (const [fecha, lista] of porFecha) {
    const c = cumplimiento(lista, hoy)
    mapa.set(fecha, { porcentaje: lista[0]?.excepcion ? null : c.porcentaje, excepcion: lista[0]?.excepcion, cumplidos: c.cumplidos, programados: c.programados })
  }
  return mapa
}

export async function rachaHasta(fecha: FechaDia): Promise<number> {
  const ajustes = await obtenerAjustes()
  const mapa = await cumplimientoPorDia(sumarDias(fecha, -400), fecha, fecha)
  return racha(mapa, fecha, ajustes.umbralRacha)
}

/** Racha mostrada en el panel: cuenta hasta ayer, y suma hoy si hoy ya cumple. */
export async function rachaActual(hoy: FechaDia): Promise<number> {
  const ajustes = await obtenerAjustes()
  const mapa = await cumplimientoPorDia(sumarDias(hoy, -400), hoy, hoy)
  // Hoy suma a la racha solo cuando los pilares cumplidos ya alcanzan el umbral sobre el total del día
  // (no sobre lo resuelto hasta ahora): 1 de 3 a la mañana no cuenta como día logrado.
  const p = await pilaresDelDia(hoy)
  const deHoy = p.aplican > 0 ? (100 * p.cumplidos) / p.aplican : null
  if (deHoy !== null && deHoy >= ajustes.umbralRacha) return racha(new Map([...mapa, [hoy, { porcentaje: deHoy, cumplidos: p.cumplidos, programados: p.aplican }]]), hoy, ajustes.umbralRacha)
  return racha(mapa, sumarDias(hoy, -1), ajustes.umbralRacha)
}

export async function atributosHoy(hoy: FechaDia): Promise<(DesgloseAtributo & { nombre: string; descripcion: string; tendencia: number | null })[]> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const atributos = (await d.atributos.filter((a) => !a.archivado).toArray()).sort((a, b) => a.orden - b.orden)
  const ventana = await resumenDeCompromisos(sumarDias(hoy, -30), hoy)
  const resultado = []
  for (const a of atributos) {
    const desglose = calcularAtributo(a.id, ventana, hoy, a.ventanaDias, ajustes.minimoProgramadosAtributo)
    const hace7 = await d.atributosDiarios.where('[atributoId+fecha]').equals([a.id, sumarDias(hoy, -7)]).first()
    const tendencia = desglose.valor !== null && hace7 && hace7.valor !== null ? desglose.valor - hace7.valor : null
    resultado.push({ ...desglose, nombre: a.nombre, descripcion: a.descripcion, tendencia })
  }
  return resultado
}

export async function marcarExcepcion(fecha: FechaDia, motivo: string): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.excepciones, d.eventos], async () => {
    await d.excepciones.put({ fecha, motivo, creado: ahora() })
    await registrarEvento({ tipo: 'crear', entidad: 'excepcion', entidadId: fecha, despues: { fecha, motivo } })
  })
  if (await d.diasCerrados.get(fecha)) await recalcularDiaCerrado(fecha)
}

export async function quitarExcepcion(fecha: FechaDia): Promise<void> {
  const d = db()
  await d.transaction('rw', [d.excepciones, d.eventos], async () => {
    const antes = await d.excepciones.get(fecha)
    await d.excepciones.delete(fecha)
    await registrarEvento({ tipo: 'borrar', entidad: 'excepcion', entidadId: fecha, antes })
  })
  if (await d.diasCerrados.get(fecha)) await recalcularDiaCerrado(fecha)
}

// ---------- Pilares del día ----------

/** Orden fijo de los pilares (pedido de Navil): no depende del campo `orden` guardado. */
export const ORDEN_PILARES = ['entrenamiento', 'empresa', 'manga', 'acostarse']

/** Ordena pilares: primero los 4 fijos en su orden, después cualquier otro por `orden`. */
export function ordenarPilares<T extends { id: string; orden: number }>(lista: T[]): T[] {
  const pos = (a: T) => { const i = ORDEN_PILARES.indexOf(a.id); return i === -1 ? 100 + a.orden : i }
  return [...lista].sort((a, b) => pos(a) - pos(b))
}

export type EstadoPilar = 'pendiente' | 'cumplido' | 'tarde' | 'omitido' | 'descanso'

export type Pilar = {
  accion: Accion
  compromiso: Compromiso | null
  estado: EstadoPilar
  /** Hora límite que aplica (del pilar, o la hora prevista del entrenamiento). */
  horaLimite?: string
  /** true si la hora límite (con su margen) ya pasó y sigue pendiente. */
  vencido: boolean
  /** Solo «Dormir a horario»: true cuando pasó la hora límite tardía (22:15) y ya no se puede registrar. */
  ventanaCerrada?: boolean
  xpPrevisto: number
}

/**
 * Los pilares de una fecha con su estado. El entrenamiento solo cuenta en sus
 * días; los demás días aparece como «descanso» y no cuenta como incumplido.
 */
export async function pilaresDelDia(fecha: FechaDia): Promise<{ pilares: Pilar[]; cumplidos: number; aplican: number }> {
  const d = db()
  const ajustes = await obtenerAjustes()
  const acciones = ordenarPilares(await d.acciones.filter((a) => a.activa && !!a.pilar).toArray())
  const t = ahora()
  const pilares: Pilar[] = []
  for (const accion of acciones) {
    const c = (await d.compromisos.get(idCompromiso(accion.id, fecha))) ?? null
    const regla = await reglaDeAccion(accion.id, fecha)
    const xpPrevisto = regla ? regla.xp : accion.tipo === 'compromiso' ? ajustes.xpCompromisoPorDefecto : 0
    const horaLimite = accion.tipo === 'acostarse' ? ajustes.horaDejarCelu : accion.horaLimite ?? (accion.tipo === 'entrenamiento' ? undefined : undefined)
    let estado: EstadoPilar
    if (!c || c.estado === 'reprogramado') estado = accion.tipo === 'entrenamiento' ? 'descanso' : 'pendiente'
    else if (c.estado === 'completado') estado = 'cumplido'
    else if (c.estado === 'tarde') estado = 'tarde'
    else if (c.estado === 'omitido' || c.estado === 'no_registrado') estado = 'omitido'
    else estado = 'pendiente'
    if (!c && accion.tipo !== 'entrenamiento' && !accion.dias.includes(diaSemanaDe(fecha))) estado = 'descanso'
    const margen = accion.tipo === 'acostarse' ? 0 : ajustes.margenNocheMinutos * 60_000
    const vencido = estado === 'pendiente' && !!horaLimite && t > instanteDe(fecha, horaLimite, ajustes.zonaHoraria) + margen
    const ventanaCerrada = accion.tipo === 'acostarse' && estado === 'pendiente' ? t > instanteDe(fecha, ajustes.horaLimiteCelu, ajustes.zonaHoraria) : undefined
    pilares.push({ accion, compromiso: c, estado, horaLimite, vencido, ventanaCerrada, xpPrevisto })
  }
  const aplican = pilares.filter((p) => p.estado !== 'descanso').length
  const cumplidos = pilares.filter((p) => p.estado === 'cumplido').length
  return { pilares, cumplidos, aplican }
}

/**
 * Estado de cada pilar por fecha, en orden fijo, para el calendario y el
 * gráfico. Las fechas futuras quedan «pendiente» (punto vacío).
 */
export async function pilaresPorDia(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<Map<FechaDia, { accionId: string; nombre: string; estado: EstadoPilar }[]>> {
  const d = db()
  const acciones = ordenarPilares(await d.acciones.filter((a) => a.activa && !!a.pilar).toArray())
  const comps = await d.compromisos.where('fecha').between(desde, hasta, true, true).toArray()
  const porClave = new Map(comps.map((c) => [c.id, c]))
  const ciclo = await cicloActivo()
  const mapa = new Map<FechaDia, { accionId: string; nombre: string; estado: EstadoPilar }[]>()
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const fila: { accionId: string; nombre: string; estado: EstadoPilar }[] = []
    for (const accion of acciones) {
      const c = porClave.get(idCompromiso(accion.id, f))
      let estado: EstadoPilar
      if (f > hoy || !ciclo || f < ciclo.inicio) {
        estado = accion.dias.includes(diaSemanaDe(f)) ? 'pendiente' : 'descanso'
      } else if (!c || c.estado === 'reprogramado') {
        // Sin compromiso ese día: no aplicaba (descanso, acción creada después, o día anterior al ciclo).
        estado = f === hoy && accion.tipo !== 'entrenamiento' && accion.dias.includes(diaSemanaDe(f)) ? 'pendiente' : 'descanso'
      } else if (c.estado === 'completado') estado = 'cumplido'
      else if (c.estado === 'tarde') estado = 'tarde'
      else if (c.estado === 'omitido' || c.estado === 'no_registrado') estado = 'omitido'
      else estado = 'pendiente'
      fila.push({ accionId: accion.id, nombre: accion.nombre, estado })
    }
    mapa.set(f, fila)
  }
  return mapa
}
