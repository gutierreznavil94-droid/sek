import { useSyncExternalStore } from 'react'
import proximamente from './proximamente.json'
import './shinobi/visual.css'
import { activarTemaVisual } from './registro'
import { EMOJI_POR_KANJI, sinKanjis } from './sinKanjis'

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
  /** Carpeta de `public/` con las escenas animadas del tema (rival, Juego, noche, Sueño). Sin carpeta, SEK usa sus dibujos simples. */
  escenas?: string
  /** Partes escondidas por ahora (no borradas): ver src/temas/archivado.ts. */
  archivado?: { rival?: boolean }
  /** Vista previa de la tarjeta del tema. */
  vistaPrevia: { video?: string; imagen: string }
  icono?: string
  orden?: number
  /** Nombres que se proponen para las tres fases (si falta, los de SEK). */
  nombresFases?: string[]
  /** «Recomendar algo»: link de respuesta del formulario de Google (…/formResponse) y los ids de sus campos (entry.NNN). Sin link, el botón no aparece. */
  recomendaciones?: { formulario: string; campos: { texto: string; parte: string; contacto: string; app: string } }
  /** Frases sueltas del compañero (cortas, alentadoras). Editables desde Ajustes. */
  frases?: string[]
  /** Íconos por nombre genérico («icono-hoy» → «今»). Lo que falte lo toma de Shinobi. */
  iconos?: Record<string, string>
  /** Colores por nombre genérico («color-principal», «color-papel», «color-tinta»), para lo que no es CSS (widgets de Android). */
  colores?: Record<string, string>
  /** Letras por nombre genérico («fuente-decorativa»), como en CSS font-family. Lo que falte lo toma de Shinobi. */
  fuentes?: Record<string, string>
  /** `true`: el tema existe pero no aparece en la lista (se está armando). Se ve igual con VITE_TEMAS_OCULTOS=1. */
  oculto?: boolean
  /** Tarjetas de Progreso: vidrio oscuro (Shinobi) o claro, para temas de fondo claro. */
  vidrio?: 'oscuro' | 'claro'
  /** Adornos del tema. Lo que falte queda como en Shinobi. */
  adornos?: AdornosTema
  /** Tema subido por la persona (archivo .sektema, guardado solo en su celu). Ver propios.ts. */
  propio?: boolean
  /** Tema subido: fondo claro (pantalla clara, texto oscuro) u oscuro. */
  claro?: boolean
  /** Tema subido: una imagen de fondo (data:) que reemplaza a los videos de lluvia, rayos y pc. */
  fondo?: string
  /** Tema subido: videos de fondo de Progreso por nombre (lluvia, rayos, pc), y su cuadro quieto. */
  videosFondo?: Partial<Record<string, string>>
  cuadrosFondo?: Partial<Record<string, string>>
  /** Tema subido: imágenes del widget (4) y de la alarma, y el título del widget. Las usa el APK. */
  widget?: { fondos?: string[]; alarma?: string; titulo?: string; estiloTitulo?: string }
  /** Tema subido: cómo imaginó las escenas de Tensión y No cumplí (por ahora solo se guarda). */
  ideasEscenas?: { tension?: string; noCumpli?: string }
}

export interface AdornosTema {
  /** En qué se convierte la cabecera al bajar: pájaros de tinta (Shinobi) o estrellitas y corazones. */
  aves?: 'pajaros' | 'estrellas'
  /** Animación al cumplir un pilar: el corte (Shinobi) o un chispazo de estrellitas. */
  cumplir?: 'corte' | 'chispazo'
  /** Reemplazos de símbolos que se ven en la app (kanjis, la cruz de «no cumplido»): `{ "食": "🍓" }`. */
  simbolos?: Record<string, string>
  /** `true`: Mi código numera con 1, 2, 3 en vez de 一, 二, 三. */
  numerosComunes?: boolean
  /** Animaciones grandes (pilar, nivel, racha, fase, récord, 3-2-1, serie): las de Shinobi o las del hada. */
  animaciones?: 'shinobi' | 'hada'
  /** Imagen del personaje de las animaciones del hada (dentro de `public/`, fondo transparente). */
  imagenAnimaciones?: string
}

export interface TemaProximo { id: string; nombre: string; pista: string }

export const TEMA_POR_DEFECTO = 'shinobi'

/**
 * Completa un tema a medio armar con los valores del tema por defecto: lo que falte en su
 * `tema.json` (personaje, color, fondos, sprite…) se toma de Shinobi, así nada se rompe.
 */
export function completarTema(parcial: Partial<DefinicionTema>, carpeta: string, base?: DefinicionTema): DefinicionTema {
  // Lo vacío ('' o null) cuenta como «falta» y se toma del tema base.
  const lleno = Object.fromEntries(Object.entries(parcial).filter(([, v]) => v !== '' && v !== null && v !== undefined)) as Partial<DefinicionTema>
  const t = base ? { ...base, ...lleno } : (lleno as DefinicionTema)
  return {
    ...t,
    id: parcial.id ?? carpeta,
    vistaPrevia: { ...(base?.vistaPrevia ?? {}), ...(parcial.vistaPrevia ?? {}) } as DefinicionTema['vistaPrevia'],
    oculto: parcial.oculto === true,
  }
}

/**
 * Estilos propios de un tema (cabecera, decoración): `src/temas/<id>/tema.css`, opcional.
 * Cada regla tiene que empezar con `:root[data-tema="<id>"]`, así solo se aplica con ese tema
 * activo y los demás (Shinobi) quedan idénticos. Lo verifica un test.
 */
import.meta.glob('./*/tema.css', { eager: true })

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
/** Mismo que TODOS_LOS_TEMAS (nombre viejo). */
export const TEMAS_TODOS = TODOS_LOS_TEMAS
const base: DefinicionTema = BASE ?? TODOS_LOS_TEMAS[0]
/** Acento de estilos.css: si el tema usa este, no se pisa nada. */
const ACENTO_BASE = '#c8102e'

/** Temas subidos por la persona (se cargan al abrir la app, ver propios.ts). */
let propios: DefinicionTema[] = []
let versionPropios = 0
const oyentesPropios = new Set<() => void>()

/** El tema base (Shinobi): de acá salen los valores que un tema subido no trae. */
export function temaBase(): DefinicionTema {
  return base
}

export function temasPropios(): DefinicionTema[] {
  return propios
}

/** Reemplaza la lista de temas subidos (la llama propios.ts). */
export function fijarTemasPropios(lista: DefinicionTema[]): void {
  propios = lista
  versionPropios++
  for (const o of oyentesPropios) o()
}

/** Los temas para elegir: los que vienen con la app y, después, los subidos. */
export function useTemasElegibles(): DefinicionTema[] {
  useSyncExternalStore((o) => { oyentesPropios.add(o); return () => oyentesPropios.delete(o) }, () => versionPropios, () => versionPropios)
  return [...TEMAS, ...propios]
}

export function temaPorId(id: string | undefined): DefinicionTema {
  return TODOS_LOS_TEMAS.find((t) => t.id === id) ?? propios.find((t) => t.id === id) ?? TODOS_LOS_TEMAS.find((t) => t.id === TEMA_POR_DEFECTO) ?? TODOS_LOS_TEMAS[0]
}

/**
 * Dirección de un archivo del tema: las imágenes de un tema subido ya vienen completas (data:),
 * las de los temas de la app están en `public/` y llevan la base de la página delante.
 */
export function urlTema(ruta: string): string {
  return /^(data:|blob:|https?:)/.test(ruta) ? ruta : `${import.meta.env.BASE_URL}${ruta}`
}

/** Colores de un tema subido → variables de estilos.css. */
const VARIABLES_DE_COLOR: Record<string, string[]> = {
  'color-fondo': ['--fondo'],
  'color-tarjeta': ['--fondo-2', '--papel'],
  'color-tarjeta-2': ['--fondo-3', '--papel-2'],
  'color-borde': ['--borde', '--borde-papel'],
  'color-texto': ['--texto', '--tinta'],
  'color-texto-2': ['--texto-2'],
  'color-texto-3': ['--texto-3'],
  'color-hecho': ['--ok'],
}
const VARIABLES_PROPIAS = [...Object.values(VARIABLES_DE_COLOR).flat(), '--ok-suave', '--papel-rgb', '--tp-texto', '--tp-texto-2', '--tp-texto-3', '--tp-cab-desde', '--tp-cab-hasta', '--tp-aviso', '--tp-con-alguien', '--tp-alta']

let activo: DefinicionTema = temaPorId(TEMA_POR_DEFECTO)
const oyentes = new Set<() => void>()

export function temaActivo(): DefinicionTema {
  return activo
}

/** Ruta completa de la carpeta de escenas del tema activo, o null si el tema no trae escenas (SEK usa su versión simple). */
export function carpetaEscenas(): string | null {
  return activo.escenas && !activo.propio ? `${import.meta.env.BASE_URL}${activo.escenas}` : null
}

function rgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null
}

/** Mezcla dos colores hex: `cuanto` es cuánto del segundo (0 a 1). */
export function mezclar(a: string, b: string, cuanto: number): string {
  const x = rgb(a)?.split(', ').map(Number)
  const y = rgb(b)?.split(', ').map(Number)
  if (!x || !y) return a
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * cuanto).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Activa un tema: color de acento, kanjis y título de la pestaña. Con Shinobi no cambia nada de lo que ya se ve. */
export function aplicarTema(id: string | undefined, nombreApp?: string): DefinicionTema {
  activo = temaPorId(id)
  activarTemaVisual(activo.id)
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
    for (const p of VARIABLES_PROPIAS) raiz.style.removeProperty(p)
    if (activo.propio) {
      const col = activo.colores ?? {}
      for (const [nombre, vars] of Object.entries(VARIABLES_DE_COLOR)) if (col[nombre]) for (const v of vars) raiz.style.setProperty(v, col[nombre])
      const hecho = col['color-hecho'] && rgb(col['color-hecho'])
      if (hecho) raiz.style.setProperty('--ok-suave', `rgba(${hecho}, 0.14)`)
      // Bordes y velos suaves: en Shinobi son de papel claro sobre negro; acá, del color de los bordes del tema.
      const borde = rgb(col['color-borde'] ?? col['color-texto-3'] ?? '')
      if (borde) raiz.style.setProperty('--papel-rgb', borde)
      if (col['color-texto']) raiz.style.setProperty('--tp-texto', col['color-texto'])
      if (col['color-texto-2']) raiz.style.setProperty('--tp-texto-2', col['color-texto-2'])
      // Fondo claro: tarjetas y bordes un poco más suaves que el color elegido, para que no quede todo tan marcado.
      if (activo.claro) {
        if (col['color-tarjeta']) raiz.style.setProperty('--fondo-2', mezclar(col['color-tarjeta'], '#FFFFFF', 0.35))
        if (col['color-tarjeta-2']) raiz.style.setProperty('--fondo-3', mezclar(col['color-tarjeta-2'], '#FFFFFF', 0.3))
        if (col['color-borde'] && col['color-tarjeta']) raiz.style.setProperty('--borde', mezclar(col['color-borde'], col['color-tarjeta'], 0.4))
      }
      if (col['color-texto-3']) raiz.style.setProperty('--tp-texto-3', col['color-texto-3'])
      raiz.style.setProperty('--tp-cab-desde', col['color-tarjeta'] ?? activo.acento)
      raiz.style.setProperty('--tp-cab-hasta', col['color-tarjeta-2'] ?? col['color-tarjeta'] ?? activo.acento)
      if (col['color-aviso']) raiz.style.setProperty('--tp-aviso', col['color-aviso'])
      if (col['color-importancia-alta']) raiz.style.setProperty('--tp-alta', col['color-importancia-alta'])
      if (col['color-con-alguien']) raiz.style.setProperty('--tp-con-alguien', col['color-con-alguien'])
      raiz.dataset.temaPropio = activo.claro ? 'claro' : 'oscuro'
    } else delete raiz.dataset.temaPropio
    sinKanjis(!!activo.propio, activo.adornos?.simbolos)
    if (activo.kanjis) delete raiz.dataset.kanjis
    else raiz.dataset.kanjis = 'no'
    raiz.dataset.tema = activo.id
    if (nombreApp && nombreApp.trim()) document.title = nombreApp.trim()
  }
  for (const o of oyentes) o()
  return activo
}

/** Símbolo a mostrar con el tema activo: el reemplazo del tema o el mismo (Shinobi no reemplaza nada). */
export function simbolo(s: string, tema: DefinicionTema = activo): string {
  return tema.adornos?.simbolos?.[s] ?? (tema.propio ? EMOJI_POR_KANJI[s] : undefined) ?? s
}

/** Adorno elegido por el tema activo, con el de Shinobi si no eligió. */
export function adorno<K extends 'aves' | 'cumplir' | 'animaciones'>(clave: K, tema: DefinicionTema = activo): NonNullable<AdornosTema[K]> {
  const porDefecto = { aves: 'pajaros', cumplir: 'corte', animaciones: 'shinobi' } as const
  return (tema.adornos?.[clave] ?? porDefecto[clave]) as NonNullable<AdornosTema[K]>
}

/** Ruta de un archivo de fondo según el tema activo («fondos/lluvia.mp4» → «<carpetaFondos>lluvia.mp4»). */
export function rutaTema(archivo: string, tema: DefinicionTema = activo): string {
  if (tema.propio && archivo.startsWith('fondos/')) {
    const [nombre, ext] = archivo.slice('fondos/'.length).split('.')
    if (ext === 'mp4' || ext === 'webm') return tema.videosFondo?.[nombre] ?? tema.videosFondo?.lluvia ?? ''
    return tema.cuadrosFondo?.[nombre] ?? tema.fondo ?? tema.vistaPrevia.imagen
  }
  return archivo.startsWith('fondos/') ? tema.carpetaFondos + archivo.slice('fondos/'.length) : archivo
}

/** Texto del saludo con el personaje y el nombre de la persona. */
export function saludoDe(tema: DefinicionTema, nombre: string): string {
  return tema.saludo.replace(/\{personaje\}/g, tema.personaje).replace(/\{nombre\}/g, nombre)
}

/** Ícono del tema activo por nombre genérico (texto o kanji). Si el tema no lo tiene, el de Shinobi; si tampoco, vacío. */
export function iconoTema(nombre: string, tema: DefinicionTema = activo): string {
  const i = tema.iconos?.[nombre] ?? base.iconos?.[nombre] ?? ''
  return tema.propio ? simbolo(i, tema) : i
}

/** Color del tema activo por nombre genérico. Si el tema no lo tiene, el de Shinobi; «color-principal» cae en el acento. */
export function colorTema(nombre: string, tema: DefinicionTema = activo): string {
  return tema.colores?.[nombre] ?? (nombre === 'color-principal' ? tema.acento : undefined) ?? base.colores?.[nombre] ?? ''
}

/** Letra del tema activo por nombre genérico («fuente-decorativa»). Si el tema no la tiene, la de Shinobi; si tampoco, vacío. */
export function fuenteTema(nombre: string, tema: DefinicionTema = activo): string {
  return tema.fuentes?.[nombre] ?? base.fuentes?.[nombre] ?? ''
}

export function useTema(): DefinicionTema {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, temaActivo, temaActivo)
}
