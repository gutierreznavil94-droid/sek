import { useSyncExternalStore } from 'react'
import proximamente from './proximamente.json'

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
  /** `true`: el tema existe pero no aparece en la lista (se está armando). Se ve igual con VITE_TEMAS_OCULTOS=1. */
  oculto?: boolean
}

export interface TemaProximo { id: string; nombre: string; pista: string }

export const TEMA_POR_DEFECTO = 'shinobi'

/**
 * Completa un tema a medio armar con los valores del tema por defecto: lo que falte en su
 * `tema.json` (personaje, color, fondos, sprite…) se toma de Shinobi, así nada se rompe.
 */
export function completarTema(parcial: Partial<DefinicionTema>, carpeta: string, base?: DefinicionTema): DefinicionTema {
  const t = base ? { ...base, ...parcial } : (parcial as DefinicionTema)
  return {
    ...t,
    id: parcial.id ?? carpeta,
    vistaPrevia: { ...(base?.vistaPrevia ?? {}), ...(parcial.vistaPrevia ?? {}) } as DefinicionTema['vistaPrevia'],
    oculto: parcial.oculto === true,
  }
}

const archivos = import.meta.glob<{ default: Partial<DefinicionTema> }>('./*/tema.json', { eager: true })
const crudos = Object.entries(archivos).map(([ruta, m]) => ({ carpeta: ruta.split('/')[1], datos: m.default }))
const crudoBase = crudos.find((c) => c.carpeta === TEMA_POR_DEFECTO)
const BASE = crudoBase ? completarTema(crudoBase.datos, crudoBase.carpeta) : undefined
const mostrarOcultos = import.meta.env?.VITE_TEMAS_OCULTOS === '1'

/** Todos los temas, también los ocultos (sirve para no perder el tema de quien ya lo eligió). */
export const TODOS_LOS_TEMAS: DefinicionTema[] = crudos
  .map((c) => (c.carpeta === TEMA_POR_DEFECTO ? BASE! : completarTema(c.datos, c.carpeta, BASE)))
  .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
/** Los temas que se ofrecen en la lista. */
export const TEMAS: DefinicionTema[] = TODOS_LOS_TEMAS.filter((t) => !t.oculto || mostrarOcultos)
export const TEMAS_PROXIMOS: TemaProximo[] = proximamente.temas
/** Acento de estilos.css: si el tema usa este, no se pisa nada. */
const ACENTO_BASE = '#c8102e'

export function temaPorId(id: string | undefined): DefinicionTema {
  return TODOS_LOS_TEMAS.find((t) => t.id === id) ?? TODOS_LOS_TEMAS.find((t) => t.id === TEMA_POR_DEFECTO) ?? TODOS_LOS_TEMAS[0]
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

export function useTema(): DefinicionTema {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, temaActivo, temaActivo)
}
