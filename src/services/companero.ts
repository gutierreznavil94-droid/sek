/**
 * El compañero del tema (en Shinobi, el shinobi que se pasea por la app): qué dice y cuándo.
 * Frases sueltas del tema (editables) y consejos según los datos, con prioridad y topes por día.
 * Nunca toca datos: solo mira y habla.
 */
import { db } from '../data/db'
import type { Ajustes } from '../data/tipos'
import { minutosDe, partesLocales, sumarDias, type FechaDia } from '../domain/fechas'
import { temaActivo, type DefinicionTema } from '../temas/temas'
import { aguaDelDia } from './agua'
import { obtenerAjustes } from './base'
import { ID_PILAR_COMIDA, comidasDelDia } from './comidas'
import { pilaresDelDia, rachaActual } from './dia'
import { ahora } from './reloj'

/** Máximo de consejos que dice solo por día (al tocarlo siempre responde). */
export const TOPE_CONSEJOS_DIA = 3

export const FRASES_DEFECTO = [
  'Un paso hoy vale más que diez mañana.',
  'Ya estás acá: eso ya es entrenar.',
  'La lluvia no para y vos tampoco.',
]

/** Frases vigentes: las de Ajustes (sin vacías), si no las del tema, si no las de la app. */
export function frasesCompanero(a: Pick<Ajustes, 'frasesCompanero'>, tema: Pick<DefinicionTema, 'frases'> = temaActivo()): string[] {
  const propias = (a.frasesCompanero ?? []).map((x) => x.trim()).filter(Boolean)
  if (propias.length) return propias
  const delTema = (tema.frases ?? []).map((x) => x.trim()).filter(Boolean)
  return delTema.length ? delTema : FRASES_DEFECTO
}

/** Elige una frase que no se dijo hoy (si se dijeron todas, vuelve a empezar). */
export function fraseSuelta(frases: string[], usadas: number[], azar: () => number = Math.random): { indice: number; texto: string } {
  if (!frases.length) return { indice: -1, texto: '' }
  let libres = frases.map((_, i) => i).filter((i) => !usadas.includes(i))
  if (!libres.length) libres = frases.map((_, i) => i)
  const indice = libres[Math.floor(azar() * libres.length) % libres.length]
  return { indice, texto: frases[indice] }
}

export type DatosConsejo = {
  /** Minutos desde las 00:00 (hora local). */
  minutoActual: number
  /** Pilares de hoy todavía sin hacer, con su hora límite (para el entreno, «empezar hasta»). */
  pilaresPendientes: { id: string; nombre: string; horaLimite?: string; entreno?: boolean }[]
  agua: { ml: number; objetivo: number } | null
  comida: { activa: boolean; cargadas: number }
  racha: number
  /** Minutos que faltan para «Dejo celu»; null si ya se marcó. */
  minutosHastaDejoCelu: number | null
  /** Todos los pilares de hoy hechos. */
  diaCompleto: boolean
  /** Días sin abrir la app antes de hoy. */
  diasSinAbrir: number
}

export type Consejo = { clave: string; texto: string; accion?: { etiqueta: string; ruta: string } }

/** Todos los consejos que aplican ahora, del más útil al menos. */
export function consejosPosibles(d: DatosConsejo): Consejo[] {
  const r: Consejo[] = []
  for (const p of d.pilaresPendientes) {
    if (!p.horaLimite) continue
    const faltan = minutosDe(p.horaLimite) - d.minutoActual
    if (faltan >= 0 && faltan <= 30) r.push({ clave: `pilar:${p.id}`, texto: `${p.nombre} empieza hasta las ${p.horaLimite}. Arranquemos.`, accion: { etiqueta: 'Empezar', ruta: p.entreno ? '/entreno' : '/' } })
  }
  if (d.agua && d.minutoActual >= 15 * 60 && d.agua.ml < d.agua.objetivo / 2) {
    r.push({ clave: 'agua', texto: `Falta agua: ${d.agua.objetivo - d.agua.ml} ml.`, accion: { etiqueta: 'Tomar', ruta: '/agua' } })
  }
  if (d.comida.activa && d.comida.cargadas === 0 && d.minutoActual >= 14 * 60) {
    r.push({ clave: 'comida', texto: '¿Comiste? Anotalo en un toque.', accion: { etiqueta: 'Anotar', ruta: '/comida' } })
  }
  if (d.racha >= 3) r.push({ clave: 'racha', texto: `${d.racha} días seguidos. No lo cortes hoy.` })
  if (d.minutosHastaDejoCelu !== null && d.minutosHastaDejoCelu > 0 && d.minutosHastaDejoCelu <= 30) {
    r.push({ clave: 'dormir', texto: `Se apaga la lámpara en ${d.minutosHastaDejoCelu} min.` })
  }
  if (d.diaCompleto) r.push({ clave: 'completo', texto: 'Día completo. Mañana seguimos.' })
  if (d.diasSinAbrir >= 2) r.push({ clave: 'volviste', texto: 'Volviste. Eso es lo que cuenta.' })
  return r
}

/**
 * Qué consejo decir. Solo (sin tocarlo): el más útil que no se dijo hoy, mientras no se pase el tope.
 * Al tocarlo (`forzado`): siempre el más útil, aunque ya se haya dicho.
 */
export function elegirConsejo(d: DatosConsejo, dichosHoy: string[], forzado = false, tope = TOPE_CONSEJOS_DIA): Consejo | null {
  const posibles = consejosPosibles(d)
  if (forzado) return posibles[0] ?? null
  if (dichosHoy.length >= tope) return null
  return posibles.find((c) => !dichosHoy.includes(c.clave)) ?? null
}

// ---------- Estado del día (vive en el teléfono) ----------

export type EstadoCompanero = { fecha: FechaDia; consejos: string[]; frases: number[]; hablo: boolean }
const CLAVE = 'sek-companero'
const CLAVE_APERTURA = 'sek-ultima-apertura'

export function estadoCompanero(hoy: FechaDia): EstadoCompanero {
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as EstadoCompanero | null
    if (x && x.fecha === hoy) return x
  } catch { /* sin almacenamiento */ }
  return { fecha: hoy, consejos: [], frases: [], hablo: false }
}

export function guardarEstadoCompanero(e: EstadoCompanero): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(e)) } catch { /* sin almacenamiento */ }
}

/** Anota que hoy se abrió la app y devuelve cuántos días pasaron desde la última vez (0 si fue hoy o ayer). */
export function registrarApertura(hoy: FechaDia): number {
  let dias = 0
  try {
    const ultima = localStorage.getItem(CLAVE_APERTURA)
    if (ultima && ultima < hoy) {
      let f = ultima
      while (f < hoy && dias < 60) { f = sumarDias(f, 1); dias++ }
      dias -= 1 // ayer no cuenta como día sin abrir
    }
    localStorage.setItem(CLAVE_APERTURA, hoy)
  } catch { /* sin almacenamiento */ }
  return Math.max(0, dias)
}

/** Junta lo que el compañero mira para aconsejar. */
export async function datosConsejo(hoy: FechaDia, diasSinAbrir = 0): Promise<DatosConsejo> {
  const a = await obtenerAjustes()
  const p = partesLocales(ahora(), a.zonaHoraria)
  const minutoActual = p.hora * 60 + p.minuto
  const pil = await pilaresDelDia(hoy)
  const pilaresPendientes = pil.pilares.filter((x) => x.estado === 'pendiente').map((x) => ({ id: x.accion.id, nombre: x.accion.nombre, horaLimite: x.accion.tipo === 'entrenamiento' ? x.accion.horaLimiteInicio ?? x.horaLimite : x.horaLimite, entreno: x.accion.tipo === 'entrenamiento' }))
  const agua = await aguaDelDia(hoy)
  const comidaAccion = await db().acciones.get(ID_PILAR_COMIDA)
  const comidas = await comidasDelDia(hoy)
  const racha = await rachaActual(hoy)
  const nocheAbierta = minutoActual < minutosDe(a.horaCorteNoche) ? sumarDias(hoy, -1) : hoy
  const suenio = await db().suenio.where('noche').equals(nocheAbierta).first()
  const minutosHastaDejoCelu = suenio ? null : minutosDe(a.horaDejarCelu) - minutoActual
  return {
    minutoActual,
    pilaresPendientes,
    agua: { ml: agua.ml, objetivo: agua.objetivo },
    comida: { activa: !!comidaAccion?.activa, cargadas: comidas.lista.length },
    racha,
    minutosHastaDejoCelu,
    diaCompleto: pil.aplican > 0 && pil.cumplidos === pil.aplican,
    diasSinAbrir,
  }
}
