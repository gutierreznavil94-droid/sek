/**
 * «Recomendar algo»: el usuario escribe qué recomienda, de qué parte de la app, y opcional un contacto.
 * Etapa 1, sin servidor: se manda a un formulario de Google de Navil (las respuestas caen en su planilla).
 * El link vive en la configuración del tema (tema.json) o en Ajustes; sin link, el botón no se muestra.
 * Sin internet, queda pendiente y se manda cuando vuelve.
 */
import { db } from '../data/db'
import type { Recomendacion } from '../data/tipos'
import { temaActivo } from '../temas/temas'
import { VERSION_APP } from '../version'
import { obtenerAjustes } from './base'
import { ahora, nuevoId } from './reloj'

export const PARTES = ['Hoy', 'Entreno', 'Comida', 'Progreso', 'Calendario', 'Otra'] as const

/** Campos por defecto: se piden así al crear el formulario (ver recomendaciones-formulario-google.md). */
export type CamposFormulario = { texto: string; parte: string; contacto: string; app: string }

export type ConfigRecomendaciones = { formulario: string; campos: CamposFormulario } | null

/** Normaliza un link de Google Forms: acepta el de «viewform» o el de «formResponse». */
export function urlDeEnvio(link: string): string {
  const l = link.trim()
  if (!l) return ''
  return l.replace(/\/viewform.*$/, '/formResponse').replace(/\?.*$/, '')
}

export async function configRecomendaciones(): Promise<ConfigRecomendaciones> {
  const a = await obtenerAjustes()
  const t = temaActivo().recomendaciones
  const campos: CamposFormulario = t?.campos ?? { texto: 'entry.texto', parte: 'entry.parte', contacto: 'entry.contacto', app: 'entry.app' }
  // El de Ajustes (link + ids separados por espacios, opcional) pisa al del tema.
  if (a.formularioRecomendaciones?.trim()) {
    const [link, ...ids] = a.formularioRecomendaciones.trim().split(/\s+/)
    const c = ids.length >= 4 ? { texto: ids[0], parte: ids[1], contacto: ids[2], app: ids[3] } : campos
    return { formulario: urlDeEnvio(link), campos: c }
  }
  if (t?.formulario) return { formulario: urlDeEnvio(t.formulario), campos }
  return null
}

/** Si el tema trae link (para mostrar el atajo en la primera entrada, sin leer la base). */
export function temaTieneFormulario(): boolean {
  return !!temaActivo().recomendaciones?.formulario
}

export type EnviarFn = (url: string, datos: FormData) => Promise<void>

/** Envío directo al formulario (sin abrir el navegador). La respuesta es opaca: si no tira error, llegó. */
const enviarPorFetch: EnviarFn = async (url, datos) => {
  await fetch(url, { method: 'POST', mode: 'no-cors', body: datos })
}

export async function enviarRecomendacion(d: { texto: string; parte: string; contacto?: string }, enviar: EnviarFn = enviarPorFetch): Promise<Recomendacion> {
  const texto = d.texto.trim()
  if (texto.length < 3) throw new Error('Contanos un poco más (al menos 3 letras)')
  if (!PARTES.includes(d.parte as (typeof PARTES)[number])) throw new Error('Elegí de qué parte de la app es')
  const r: Recomendacion = { id: nuevoId('rec-'), texto: texto.slice(0, 1000), parte: d.parte, contacto: d.contacto?.trim().slice(0, 120) || undefined, estado: 'pendiente', creada: ahora(), intentos: 0 }
  await db().recomendaciones.add(r)
  return (await mandar(r, enviar)) ?? r
}

async function mandar(r: Recomendacion, enviar: EnviarFn): Promise<Recomendacion | null> {
  const c = await configRecomendaciones()
  if (!c) return null
  const datos = new FormData()
  datos.set(c.campos.texto, r.texto)
  datos.set(c.campos.parte, r.parte)
  datos.set(c.campos.contacto, r.contacto ?? '')
  datos.set(c.campos.app, `${temaActivo().nombreApp} v${VERSION_APP} · tema ${temaActivo().id}`)
  try {
    await enviar(c.formulario, datos)
    const ok: Recomendacion = { ...r, estado: 'enviada', enviada: ahora(), intentos: r.intentos + 1 }
    await db().recomendaciones.put(ok)
    return ok
  } catch {
    const p: Recomendacion = { ...r, intentos: r.intentos + 1 }
    await db().recomendaciones.put(p)
    return p
  }
}

/** Al abrir la app o al volver internet: manda lo que quedó esperando. Devuelve cuántas salieron. */
export async function reintentarPendientes(enviar: EnviarFn = enviarPorFetch): Promise<number> {
  const pendientes = await db().recomendaciones.where('estado').equals('pendiente').toArray()
  let n = 0
  for (const r of pendientes) {
    const x = await mandar(r, enviar)
    if (x?.estado === 'enviada') n++
  }
  return n
}

export async function listarRecomendaciones(): Promise<Recomendacion[]> {
  return (await db().recomendaciones.toArray()).sort((a, b) => b.creada - a.creada)
}

export async function borrarRecomendacion(id: string): Promise<void> {
  await db().recomendaciones.delete(id)
}
