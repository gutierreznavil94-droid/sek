/**
 * Fechas y días del ciclo.
 *
 * Regla central: un "día" es una fecha de calendario (AAAA-MM-DD) en la zona
 * horaria configurada (por defecto America/Argentina/Cordoba). Va de 00:00 a
 * 00:00. Todo cálculo de "qué día es" pasa por aquí, nunca por `new Date()`
 * directo, para que el teléfono pueda estar en otra zona sin romper nada.
 */

export const ZONA_POR_DEFECTO = 'America/Argentina/Cordoba'

/** Fecha de calendario en formato AAAA-MM-DD. */
export type FechaDia = string

export type PartesLocales = {
  fecha: FechaDia
  anio: number
  mes: number // 1-12
  dia: number // 1-31
  hora: number // 0-23
  minuto: number // 0-59
  segundo: number
  /** 0 = domingo ... 6 = sábado */
  diaSemana: number
}

const cacheFormateadores = new Map<string, Intl.DateTimeFormat>()

function formateador(zona: string): Intl.DateTimeFormat {
  let f = cacheFormateadores.get(zona)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    cacheFormateadores.set(zona, f)
  }
  return f
}

const DIAS_SEMANA_EN: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Descompone un instante en sus partes de reloj en la zona dada. */
export function partesLocales(instante: Date | number, zona = ZONA_POR_DEFECTO): PartesLocales {
  const d = typeof instante === 'number' ? new Date(instante) : instante
  const partes = formateador(zona).formatToParts(d)
  const v: Record<string, string> = {}
  for (const p of partes) v[p.type] = p.value
  const anio = Number(v.year)
  const mes = Number(v.month)
  const dia = Number(v.day)
  return {
    fecha: `${v.year}-${v.month}-${v.day}`,
    anio,
    mes,
    dia,
    hora: Number(v.hour) % 24,
    minuto: Number(v.minute),
    segundo: Number(v.second),
    diaSemana: DIAS_SEMANA_EN[v.weekday] ?? 0,
  }
}

/** Fecha de calendario (AAAA-MM-DD) de un instante en la zona dada. */
export function fechaDe(instante: Date | number, zona = ZONA_POR_DEFECTO): FechaDia {
  return partesLocales(instante, zona).fecha
}

/** Valida el formato AAAA-MM-DD y que la fecha exista. */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [a, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Número de día "juliano" (días desde la época) de una fecha, usando UTC para no tocar zonas. */
function ordinal(fecha: FechaDia): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000)
}

/** Diferencia en días de calendario: `hasta - desde`. */
export function diferenciaDias(desde: FechaDia, hasta: FechaDia): number {
  return ordinal(hasta) - ordinal(desde)
}

export function sumarDias(fecha: FechaDia, dias: number): FechaDia {
  const [a, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  const aa = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${aa}-${mm}-${dd}`
}

export function compararFechas(a: FechaDia, b: FechaDia): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Día del ciclo: 1 en la fecha de inicio, 2 al día siguiente, etc.
 * Devuelve 0 o negativo si el ciclo todavía no empezó, y más de `duracion`
 * si ya terminó (quien llama decide qué hacer con eso).
 */
export function diaDelCiclo(inicio: FechaDia, hoy: FechaDia): number {
  return diferenciaDias(inicio, hoy) + 1
}

export function fechaDelDiaDelCiclo(inicio: FechaDia, dia: number): FechaDia {
  return sumarDias(inicio, dia - 1)
}

/** Fase (1..n) a la que pertenece un día del ciclo, con fases de `diasPorFase` días. */
export function faseDelDia(dia: number, diasPorFase = 30): number {
  if (dia < 1) return 1
  return Math.floor((dia - 1) / diasPorFase) + 1
}

/** Día de la semana (0 domingo .. 6 sábado) de una fecha de calendario. */
export function diaSemanaDe(fecha: FechaDia): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

/** Semana ISO-ish para claves: lunes a domingo. Devuelve el lunes de esa semana. */
export function lunesDe(fecha: FechaDia): FechaDia {
  const ds = diaSemanaDe(fecha) // 0 dom
  const desdeLunes = (ds + 6) % 7
  return sumarDias(fecha, -desdeLunes)
}

export function domingoDe(fecha: FechaDia): FechaDia {
  return sumarDias(lunesDe(fecha), 6)
}

/**
 * Instante (ms) en que empieza la fecha `fecha` en la zona dada, es decir,
 * las 00:00 locales. Se resuelve por búsqueda porque Intl no da el inverso
 * directo; es exacto para cualquier desfase horario de la zona.
 */
export function inicioDelDia(fecha: FechaDia, zona = ZONA_POR_DEFECTO): number {
  // Punto de partida: medianoche UTC de esa fecha, luego se corrige el desfase.
  const [a, m, d] = fecha.split('-').map(Number)
  const aproximado = Date.UTC(a, m - 1, d)
  // El desfase de la zona en ese momento (en minutos).
  let candidato = aproximado - desfaseMinutos(aproximado, zona) * 60_000
  // Si el desfase cambia justo en el borde (cambio de hora), un segundo ajuste lo corrige.
  const p = partesLocales(candidato, zona)
  if (p.fecha !== fecha || p.hora !== 0 || p.minuto !== 0) {
    candidato = aproximado - desfaseMinutos(candidato, zona) * 60_000
  }
  return candidato
}

/** Desfase de la zona respecto a UTC en minutos, en el instante dado (ej. Córdoba = -180). */
export function desfaseMinutos(instante: number, zona = ZONA_POR_DEFECTO): number {
  const p = partesLocales(instante, zona)
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo)
  const ms = instante - Math.floor(instante / 1000) * 1000
  return Math.round((comoUtc - (instante - ms)) / 60_000)
}

/** Instante en que empieza el día siguiente a `fecha` (la próxima medianoche). */
export function proximaMedianoche(instante: number, zona = ZONA_POR_DEFECTO): number {
  return inicioDelDia(sumarDias(fechaDe(instante, zona), 1), zona)
}

/** Instante de una hora "HH:MM" en una fecha concreta, en la zona dada. */
export function instanteDe(fecha: FechaDia, horaMinuto: string, zona = ZONA_POR_DEFECTO): number {
  const [h, mi] = horaMinuto.split(':').map(Number)
  return inicioDelDia(fecha, zona) + (h * 60 + mi) * 60_000
}

export function esHoraValida(hm: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hm)) return false
  const [h, m] = hm.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

export function minutosDe(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function formatoHora(instante: number, zona = ZONA_POR_DEFECTO): string {
  const p = partesLocales(instante, zona)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/**
 * Noche a la que pertenece un registro de "acostarse".
 *
 * El compromiso de acostarse pertenece a la noche en que estaba planificado.
 * Si el registro cae entre las 00:00 y `horaCorte` (por defecto 06:00), se
 * asigna a la noche anterior; después de la hora de corte, al día en curso.
 */
export function nocheDeSuenio(instante: number, zona = ZONA_POR_DEFECTO, horaCorte = '06:00'): FechaDia {
  const p = partesLocales(instante, zona)
  const minutos = p.hora * 60 + p.minuto
  if (minutos < minutosDe(horaCorte)) return sumarDias(p.fecha, -1)
  return p.fecha
}

/**
 * Retraso en minutos respecto a la hora prevista de acostarse, para una
 * noche concreta. Positivo = tarde, negativo = antes de la hora.
 */
export function retrasoAcostarse(noche: FechaDia, horaPrevista: string, instanteReal: number, zona = ZONA_POR_DEFECTO): number {
  const previsto = instanteDe(noche, horaPrevista, zona)
  return Math.round((instanteReal - previsto) / 60_000)
}

/** Nombres en español para la interfaz. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function nombreMes(mes: number, corto = false): string {
  return (corto ? MESES_CORTOS : MESES)[mes - 1] ?? ''
}

export function nombreDiaSemana(ds: number, corto = false): string {
  return (corto ? DIAS_CORTOS : DIAS)[ds] ?? ''
}

/** "lunes 8 nov" */
export function fechaLegible(fecha: FechaDia, corto = true): string {
  const [, m, d] = fecha.split('-').map(Number)
  const ds = diaSemanaDe(fecha)
  return `${nombreDiaSemana(ds, corto)} ${d} ${nombreMes(m, corto)}`
}

/** Duración en minutos como "1 h 05 min" o "45 min". */
export function duracionLegible(minutos: number): string {
  const m = Math.max(0, Math.round(minutos))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return `${h} h ${String(r).padStart(2, '0')} min`
}
