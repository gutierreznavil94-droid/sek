/**
 * Forja de hábitos (reglas puras, sin base de datos ni pantalla).
 *
 * Un hábito nuevo dura `dias` (30) desde que se crea y se forja al juntar `validos` (28) días válidos.
 * - Día válido: un día cumplido, o la 1.ª falla de cada semana de la forja (falla perdonada).
 * - Margen: `dias - validos` fallas no perdonadas no cuestan nada.
 * - Cada falla de más «cierra un poco» la piedra: se pierde la última grieta (−1 válido) y la forja dura 1 día más.
 *   Nunca se reinicia: la forja sigue hasta juntar los días válidos.
 * - Hoy no cuenta como falla mientras no termine.
 */
import { diferenciaDias, sumarDias, type FechaDia } from './fechas'

export type ConfigForja = { dias: number; validos: number; xpDia: number; xpForjado: number; maximo: number }
export const FORJA_DEFECTO: ConfigForja = { dias: 30, validos: 28, xpDia: 5, xpForjado: 50, maximo: 3 }

/** Días válidos en que cae cada uno de los 6 pedazos (con 28). Con otro número, proporcional. */
export const PEDAZOS_BASE = [7, 12, 17, 21, 25, 28]

export function pedazosPara(validos: number): number[] {
  const v = Math.max(1, Math.round(validos))
  const r = PEDAZOS_BASE.map((p) => Math.max(1, Math.round((p * v) / 28)))
  for (let i = 1; i < r.length; i++) if (r[i] <= r[i - 1]) r[i] = r[i - 1] + 1
  r[r.length - 1] = Math.max(r[r.length - 1], v)
  return r
}

/** Cuántos pedazos cayeron con estos días válidos. */
export function pedazosCaidos(validos: number, necesarios: number): number {
  return pedazosPara(necesarios).filter((p) => validos >= p).length
}

export type DiaForja = { fecha: FechaDia; estado: 'cumplido' | 'perdonado' | 'falla' | 'hoy' | 'pendiente' | 'futuro' }

export type EstadoForja = {
  /** Días válidos (cumplidos + perdonados − grietas perdidas). */
  validos: number
  necesarios: number
  /** Días que dura la forja (30 + uno por cada falla de más). */
  duracion: number
  /** Día de la forja de hoy (1 = el día que se creó). */
  diaActual: number
  cumplidos: number
  perdonadas: number
  /** Fallas no perdonadas. */
  fallas: number
  /** Fallas que todavía no cuestan nada. */
  margenRestante: number
  /** Grietas perdidas por fallas de más. */
  cerradas: number
  hechoHoy: boolean
  /** Ya se usó la falla perdonada de esta semana de forja. */
  perdonUsadoSemana: boolean
  pedazos: number
  faltan: number
  completo: boolean
  camino: DiaForja[]
}

export function estadoForja(h: { inicio: FechaDia; cumplidos: FechaDia[] }, hoy: FechaDia, cfg: Pick<ConfigForja, 'dias' | 'validos'> = FORJA_DEFECTO): EstadoForja {
  const necesarios = Math.max(1, Math.min(cfg.validos, cfg.dias))
  const margen = Math.max(0, cfg.dias - necesarios)
  const hechos = new Set(h.cumplidos.filter((f) => f >= h.inicio && f <= hoy))
  const diaActual = Math.max(1, diferenciaDias(h.inicio, hoy) + 1)
  const semanas = new Set<number>()
  let perdonadas = 0
  let fallas = 0
  const estados = new Map<FechaDia, DiaForja['estado']>()
  for (let i = 0; i < diaActual - 1; i++) {
    const f = sumarDias(h.inicio, i)
    if (hechos.has(f)) { estados.set(f, 'cumplido'); continue }
    const semana = Math.floor(i / 7)
    if (!semanas.has(semana)) { semanas.add(semana); perdonadas++; estados.set(f, 'perdonado') } else { fallas++; estados.set(f, 'falla') }
  }
  const hechoHoy = hechos.has(hoy)
  estados.set(hoy, hechoHoy ? 'cumplido' : 'hoy')
  const cerradas = Math.max(0, fallas - margen)
  const validos = Math.max(0, Math.min(necesarios, hechos.size + perdonadas - cerradas))
  const duracion = cfg.dias + cerradas
  const largo = Math.max(duracion, diaActual)
  const camino: DiaForja[] = []
  for (let i = 0; i < largo; i++) {
    const f = sumarDias(h.inicio, i)
    camino.push({ fecha: f, estado: estados.get(f) ?? (f > hoy ? 'futuro' : 'pendiente') })
  }
  return {
    validos,
    necesarios,
    duracion,
    diaActual,
    cumplidos: hechos.size,
    perdonadas,
    fallas,
    margenRestante: Math.max(0, margen - fallas),
    cerradas,
    hechoHoy,
    perdonUsadoSemana: semanas.has(Math.floor((diaActual - 1) / 7)),
    pedazos: pedazosCaidos(validos, necesarios),
    faltan: Math.max(0, necesarios - validos),
    completo: validos >= necesarios,
    camino,
  }
}

/** Kanji sugeridos según el nombre del hábito (los que coinciden primero, completando hasta 6). */
const PISTAS: [RegExp, string][] = [
  [/le(e|er|o)|libro|lectura/i, '読'],
  [/agua|tomar|hidrat/i, '水'],
  [/dorm|sueñ|cama|acost/i, '眠'],
  [/flexi|ejerc|entren|correr|cuerpo|gym|camin|estir/i, '体'],
  [/medit|mente|respir|pensar|diario/i, '心'],
  [/celu|pantalla|calma|silencio|redes/i, '静'],
  [/estud|aprend|curso|idioma/i, '学'],
  [/dibuj|pint|manga|arte/i, '描'],
  [/com(er|ida)|fruta|verdura|azúcar|azucar/i, '食'],
  [/temprano|mañana|madrug|levant/i, '朝'],
  [/escrib/i, '書'],
]
const RELLENO = ['志', '力', '心', '静', '体', '忍', '鍛', '進']

export function kanjiSugeridos(nombre: string): string[] {
  const r: string[] = []
  for (const [re, k] of PISTAS) if (re.test(nombre) && !r.includes(k)) r.push(k)
  for (const k of RELLENO) { if (r.length >= 6) break; if (!r.includes(k)) r.push(k) }
  return r.slice(0, 6)
}

/** Un kanji (o un carácter) por hábito. */
export function limpiarKanji(texto: string): string {
  return [...texto.trim()][0] ?? ''
}
