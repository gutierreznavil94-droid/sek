/**
 * Temas subidos por la persona: un archivo `.sektema` (texto JSON) con nombre, colores, emojis e imágenes.
 * Se guarda solo en este celu (no va en la app ni en la tienda) y se puede borrar cuando quiera.
 * No trae código ni estilos: solo datos que se revisan uno por uno; lo que no sirve se descarta.
 * Lo que el archivo no trae se toma de Shinobi, así nada se rompe.
 */
import Dexie, { type EntityTable } from 'dexie'
import { fijarTemasPropios, temaBase, temasPropios, type AdornosTema, type DefinicionTema } from './temas'

export const FORMATO_TEMA = 'sek-tema'
export const EXTENSION_TEMA = '.sektema'

/** Nombres de color que puede traer un tema (los mismos de los widgets y de Organización). */
export const COLORES_TEMA = [
  'color-fondo', 'color-tarjeta', 'color-tarjeta-2', 'color-borde', 'color-texto', 'color-texto-2', 'color-texto-3',
  'color-principal', 'color-hecho', 'color-aviso', 'color-con-alguien',
  'color-importancia-alta', 'color-importancia-media', 'color-importancia-baja',
] as const

/** Lo que trae el archivo. Todo es opcional menos el nombre. */
export interface ArchivoTema {
  formato: typeof FORMATO_TEMA
  version: 1
  nombre: string
  descripcion?: string
  personaje?: string
  saludo?: string
  /** Fondo claro (texto oscuro) u oscuro. Si falta, se deduce del color de fondo. */
  claro?: boolean
  colores?: Partial<Record<(typeof COLORES_TEMA)[number], string>>
  /** Reemplazos de kanjis por emojis: { "水": "💧" }. */
  simbolos?: Record<string, string>
  adornos?: Pick<AdornosTema, 'aves' | 'cumplir' | 'animaciones' | 'numerosComunes'>
  frases?: string[]
  imagenes?: {
    /** Fondo de Progreso y de las escenas (vertical, sin texto). */
    fondo?: string
    /** Tarjeta del tema en la lista. Si falta, el fondo. */
    vistaPrevia?: string
    /** Personaje de las animaciones grandes (fondo transparente). */
    personaje?: string
    /** Fondos del widget (hasta 4, horizontales). */
    widget?: string[]
    /** Fondo de la alarma (vertical). */
    alarma?: string
  }
  widget?: { titulo?: string; estiloTitulo?: string }
  escenas?: { tension?: string; noCumpli?: string }
}

interface TemaGuardado {
  id: string
  archivo: ArchivoTema
  subido: string
}

class BaseTemas extends Dexie {
  temas!: EntityTable<TemaGuardado, 'id'>
  constructor() {
    super('sek-temas-propios')
    this.version(1).stores({ temas: 'id' })
  }
}
let base: BaseTemas | null = null
const bd = () => (base ??= new BaseTemas())

// ---------- Revisión del archivo ----------

const MAX_IMAGEN = 4 * 1024 * 1024
const MAX_TOTAL = 16 * 1024 * 1024
const HEX = /^#[0-9a-f]{6}$/i
const IMAGEN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

export class TemaInvalido extends Error {}

const texto = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[<>]/g, '').trim()
  return t ? t.slice(0, max) : undefined
}
const imagen = (v: unknown, nombre: string): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || !IMAGEN.test(v)) throw new TemaInvalido(`La imagen «${nombre}» no es PNG, JPG ni WebP.`)
  if (v.length > MAX_IMAGEN * 1.37) throw new TemaInvalido(`La imagen «${nombre}» pesa más de 4 MB. Achicala y probá de nuevo.`)
  return v
}
const uno = <T extends string>(v: unknown, opciones: readonly T[]): T | undefined => (opciones.includes(v as T) ? (v as T) : undefined)

/** Luminosidad de un color (0 oscuro, 1 claro). */
function luz(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

/** Lee el texto de un archivo de tema y devuelve solo lo que sirve. Si no es un tema, avisa por qué. */
export function revisarTema(textoArchivo: string): ArchivoTema {
  if (textoArchivo.length > MAX_TOTAL * 1.4) throw new TemaInvalido('El archivo es demasiado grande (más de 16 MB).')
  let d: Record<string, unknown>
  try { d = JSON.parse(textoArchivo) } catch { throw new TemaInvalido('Ese archivo no es un tema de SEK.') }
  if (!d || typeof d !== 'object' || d.formato !== FORMATO_TEMA) throw new TemaInvalido('Ese archivo no es un tema de SEK.')
  if (d.version !== 1) throw new TemaInvalido('Este tema es de una versión más nueva de SEK. Actualizá la app.')
  const nombre = texto(d.nombre, 30)
  if (!nombre) throw new TemaInvalido('Al tema le falta el nombre.')

  const colores: ArchivoTema['colores'] = {}
  const c = (d.colores ?? {}) as Record<string, unknown>
  for (const k of COLORES_TEMA) if (typeof c[k] === 'string' && HEX.test(c[k] as string)) colores[k] = (c[k] as string).toUpperCase()

  const simbolos: Record<string, string> = {}
  for (const [k, v] of Object.entries((d.simbolos ?? {}) as Record<string, unknown>).slice(0, 300)) {
    const valor = texto(v, 12)
    if (k.length <= 4 && valor) simbolos[k] = valor
  }

  const a = (d.adornos ?? {}) as Record<string, unknown>
  const adornos: ArchivoTema['adornos'] = {
    aves: uno(a.aves, ['pajaros', 'estrellas'] as const),
    cumplir: uno(a.cumplir, ['corte', 'chispazo'] as const),
    animaciones: uno(a.animaciones, ['shinobi', 'hada'] as const),
    numerosComunes: a.numerosComunes === true ? true : undefined,
  }

  const im = (d.imagenes ?? {}) as Record<string, unknown>
  const widget = Array.isArray(im.widget) ? im.widget.slice(0, 4).map((x, i) => imagen(x, `widget ${i + 1}`)).filter((x): x is string => !!x) : []
  const imagenes: ArchivoTema['imagenes'] = {
    fondo: imagen(im.fondo, 'fondo'),
    vistaPrevia: imagen(im.vistaPrevia, 'vista previa'),
    personaje: imagen(im.personaje, 'personaje'),
    widget: widget.length ? widget : undefined,
    alarma: imagen(im.alarma, 'alarma'),
  }

  const w = (d.widget ?? {}) as Record<string, unknown>
  const e = (d.escenas ?? {}) as Record<string, unknown>
  const frases = Array.isArray(d.frases) ? d.frases.map((f) => texto(f, 120)).filter((f): f is string => !!f).slice(0, 40) : undefined
  const claro = typeof d.claro === 'boolean' ? d.claro : colores['color-fondo'] ? luz(colores['color-fondo']) > 0.6 : false

  return {
    formato: FORMATO_TEMA,
    version: 1,
    nombre,
    descripcion: texto(d.descripcion, 120),
    personaje: texto(d.personaje, 30),
    saludo: texto(d.saludo, 160),
    claro,
    colores,
    simbolos,
    adornos,
    frases: frases?.length ? frases : undefined,
    imagenes,
    widget: { titulo: texto(w.titulo, 30), estiloTitulo: texto(w.estiloTitulo, 80) },
    escenas: { tension: texto(e.tension, 400), noCumpli: texto(e.noCumpli, 400) },
  }
}

/** Id del tema según su nombre: subir de nuevo uno con el mismo nombre lo actualiza. */
export function idDeTema(nombre: string): string {
  const s = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `propio-${s || 'tema'}`
}

/** Convierte el archivo en un tema como los de la app, completando con Shinobi lo que falte. */
export function aDefinicion(archivo: ArchivoTema, id = idDeTema(archivo.nombre)): DefinicionTema {
  const b = temaBase()
  const im = archivo.imagenes ?? {}
  const sinVacios = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
  return {
    ...b,
    id,
    nombre: archivo.nombre,
    descripcion: archivo.descripcion ?? 'Tema subido por vos. Está guardado solo en este celu.',
    personaje: archivo.personaje ?? 'tu compañero',
    saludo: archivo.saludo ?? 'Soy {personaje}. Desde hoy vamos juntos: un día a la vez.',
    acento: archivo.colores?.['color-principal'] ?? b.acento,
    kanjis: true,
    // Sin carpeta de escenas: Tensión y No cumplí van en su versión simple (mensaje y flexiones).
    escenas: undefined,
    // Sin hoja de sprites: el compañero que camina no aparece.
    sprite: '',
    fondo: im.fondo,
    vistaPrevia: { imagen: im.vistaPrevia ?? im.fondo ?? b.vistaPrevia.imagen, video: im.vistaPrevia || im.fondo ? undefined : b.vistaPrevia.video },
    frases: archivo.frases ?? b.frases,
    colores: { ...(archivo.colores ?? {}) },
    vidrio: archivo.claro ? 'claro' : 'oscuro',
    adornos: sinVacios({ ...(archivo.adornos ?? {}), simbolos: archivo.simbolos, imagenAnimaciones: im.personaje }),
    widget: sinVacios({ fondos: im.widget, alarma: im.alarma, titulo: archivo.widget?.titulo, estiloTitulo: archivo.widget?.estiloTitulo }),
    ideasEscenas: archivo.escenas,
    oculto: false,
    orden: 100,
    propio: true,
    claro: archivo.claro === true,
  }
}

// ---------- Guardar, listar y borrar ----------

/** Lee los temas subidos y los suma a la lista. Se llama al abrir la app, antes de aplicar el tema. */
export async function cargarTemasPropios(): Promise<DefinicionTema[]> {
  try {
    const guardados = await bd().temas.toArray()
    const lista = guardados.flatMap((g) => { try { return [aDefinicion(revisarTema(JSON.stringify(g.archivo)), g.id)] } catch { return [] } })
    fijarTemasPropios(lista.sort((x, y) => x.nombre.localeCompare(y.nombre)))
  } catch {
    fijarTemasPropios([])
  }
  return temasPropios()
}

/** Sube un tema desde el texto del archivo. Devuelve su id (para elegirlo enseguida). */
export async function importarTema(textoArchivo: string): Promise<string> {
  const archivo = revisarTema(textoArchivo)
  const id = idDeTema(archivo.nombre)
  await bd().temas.put({ id, archivo, subido: new Date().toISOString() })
  await cargarTemasPropios()
  return id
}

export async function borrarTemaPropio(id: string): Promise<void> {
  await bd().temas.delete(id)
  await cargarTemasPropios()
}

/** El archivo de un tema subido, para volver a compartirlo. */
export async function archivoDeTema(id: string): Promise<string | null> {
  const g = await bd().temas.get(id)
  return g ? JSON.stringify(g.archivo) : null
}
