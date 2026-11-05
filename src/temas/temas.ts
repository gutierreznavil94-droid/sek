import { useSyncExternalStore } from 'react'
import proximamente from './proximamente.json'
import './shinobi/visual.css'

/**
 * Temas: la cara de la app (personaje, fondos, sprite, color de acento, kanjis).
 * Cada carpeta de `src/temas/` con un `tema.json` es un tema; no hace falta tocar código
 * para sumar uno (ver TEMAS.md en la raíz del repo). Los datos y el motor son comunes.
 */
export interface DefinicionTema {
  id: string
  nombre: string
  descripcion: string
  /** Nombre del personaje de las animaciones. */
  personaje: string
  /** Lo que dice el personaje al terminar la primera vez. `{personaje}` y `{nombre}` se reemplazan. */
  saludo: string
  /** Nombre de la app que se propone en la primera vez. */
  nombreApp: string
  /** Color de acento (hex). */
  acento: string
  /** Mostrar kanjis decorativos (botones de Progreso). */
  kanjis: boolean
  /** Carpeta de `public/` con los videos de fondo: lluvia.mp4/.jpg, rayos.mp4/.jpg, pc.mp4/.jpg. */
  carpetaFondos: string
  /** Hoja de sprites del personaje que camina en la barra del entreno (dentro de `public/`). */
  sprite: string
  /** Vista previa de la tarjeta del tema. */
  vistaPrevia: { video?: string; imagen: string }
  icono?: string
  orden?: number
  /** Nombres que se proponen para las tres fases (si falta, los de SEK). */
  nombresFases?: string[]
  /** Tema en preparación: no aparece en la primera entrada ni en Más → Tema hasta que se saque esto. */
  oculto?: boolean
  /** «Recomendar algo»: link de respuesta del formulario de Google (…/formResponse) y los ids de sus campos (entry.NNN). Sin link, el botón no aparece. */
  recomendaciones?: { formulario: string; campos: { texto: string; parte: string; contacto: string; app: string } }
  /** Frases sueltas del compañero (cortas, alentadoras). Editables desde Ajustes. */
  frases?: string[]
  /** Íconos por nombre genérico («icono-hoy» → «今»). Lo que falte lo toma de Shinobi. */
  iconos?: Record<string, string>
}

export interface TemaProximo { id: string; nombre: string; pista: string }

const archivos = import.meta.glob<{ default: DefinicionTema }>('./*/tema.json', { eager: true })
const todos = Object.values(archivos).map((m) => m.default)
const base = todos.find((t) => t.id === 'shinobi') ?? todos[0]
/** Todos los temas, incluso los ocultos. Lo que le falte a un tema lo toma de Shinobi, así la app no se rompe a medio armar. */
export const TEMAS_TODOS: DefinicionTema[] = todos
  .map((t) => ({ ...base, ...Object.fromEntries(Object.entries(t).filter(([, v]) => v !== '' && v !== null && v !== undefined)) }) as DefinicionTema)
  .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
/** Temas elegibles (los ocultos quedan afuera). */
export const TEMAS: DefinicionTema[] = TEMAS_TODOS.filter((t) => !t.oculto)
export const TEMAS_PROXIMOS: TemaProximo[] = proximamente.temas
export const TEMA_POR_DEFECTO = 'shinobi'
/** Acento de estilos.css: si el tema usa este, no se pisa nada. */
const ACENTO_BASE = '#c8102e'

export function temaPorId(id: string | undefined): DefinicionTema {
  return TEMAS_TODOS.find((t) => t.id === id) ?? TEMAS.find((t) => t.id === TEMA_POR_DEFECTO) ?? TEMAS[0]
}

let activo: DefinicionTema = temaPorId(TEMA_POR_DEFECTO)
const oyentes = new Set<() => void>()

export function temaActivo(): DefinicionTema {
  return activo
}

function rgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null
}

/** Activa un tema: color de acento, kanjis y título de la pestaña. Con Shinobi no cambia nada de lo que ya se ve. */
export function aplicarTema(id: string | undefined, nombreApp?: string): DefinicionTema {
  activo = temaPorId(id)
  if (typeof document !== 'undefined') {
    const raiz = document.documentElement
    const c = rgb(activo.acento)
    if (c && activo.acento.toLowerCase() !== ACENTO_BASE) {
      raiz.style.setProperty('--acento', activo.acento)
      raiz.style.setProperty('--acento-rgb', c)
      raiz.style.setProperty('--acento-suave', `rgba(${c}, 0.16)`)
    } else {
      for (const p of ['--acento', '--acento-rgb', '--acento-suave']) raiz.style.removeProperty(p)
    }
    if (activo.kanjis) delete raiz.dataset.kanjis
    else raiz.dataset.kanjis = 'no'
    raiz.dataset.tema = activo.id
    if (nombreApp && nombreApp.trim()) document.title = nombreApp.trim()
  }
  for (const o of oyentes) o()
  return activo
}

/** Ruta de un archivo de fondo según el tema activo («fondos/lluvia.mp4» → «<carpetaFondos>lluvia.mp4»). */
export function rutaTema(archivo: string, tema: DefinicionTema = activo): string {
  return archivo.startsWith('fondos/') ? tema.carpetaFondos + archivo.slice('fondos/'.length) : archivo
}

/** Texto del saludo con el personaje y el nombre de la persona. */
export function saludoDe(tema: DefinicionTema, nombre: string): string {
  return tema.saludo.replace(/\{personaje\}/g, tema.personaje).replace(/\{nombre\}/g, nombre)
}

/** Ícono del tema activo por nombre genérico (texto o kanji). Si el tema no lo tiene, el de Shinobi; si tampoco, vacío. */
export function iconoTema(nombre: string, tema: DefinicionTema = activo): string {
  return tema.iconos?.[nombre] ?? base.iconos?.[nombre] ?? ''
}

export function useTema(): DefinicionTema {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, temaActivo, temaActivo)
}
