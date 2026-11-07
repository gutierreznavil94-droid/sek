/**
 * Formato de los datos de Organización (ver CONTRATO.md). Solo se suman campos; nunca se pisa lo cargado.
 * Sin React y sin nada de SEK.
 */

/** Fecha local «AAAA-MM-DD». */
export type Dia = string

export type Estado = 'por_hacer' | 'hecho'
export type Quien = 'yo' | 'delegar' | 'alguien'
export type Importancia = 'alta' | 'media' | 'baja'
export type Rapidez = 'rapida' | 'lenta'
export type Donde = 'celu' | 'compu' | 'calle'

export interface Tarea {
  id: string
  texto: string
  estado: Estado
  quien: Quien
  /** A quién se delega o a quién se necesita (si `quien` no es «yo»). */
  quienNombre?: string
  imp?: Importancia
  rapidez?: Rapidez
  /** Sin `donde` = «Sin dónde». */
  donde?: Donde
  /** Sin `fecha` = «Libre». */
  fecha?: Dia
  /** Instantes (ms). */
  creada: number
  hecha?: number
}

export interface Frente {
  id: string
  nombre: string
  /** 'sueltas' = el frente especial de cosas sin proyecto (no se finaliza ni se elimina). */
  tipo?: 'sueltas'
  icono: string
  color: string
  sub?: string
  nota?: string
  /** Último día en que se tocó (para «N días quieto»). */
  movido: Dia
  /** Palabras que aprendió para sugerir este frente, y las que NO son de acá. */
  palabras?: string[]
  no?: string[]
  tareas: Tarea[]
  finalizado?: Dia
}

/** Algo anotado que falta clasificar. */
export interface ItemBandeja {
  id: string
  texto: string
  /** Si al anotar se eligió frente, queda premarcado. */
  frente?: string
  /** Datos que ya tenía (si volvió a Clasificar por estar incompleta). */
  previo?: Partial<Tarea>
  creada: number
}

export interface AjustesOrganizacion {
  /** Cuántas de «Hoy me toca a mí» se ven a la vez (1 a 9). */
  limiteHoy: number
  /** Sugerir frente al clasificar. */
  sugerir: boolean
  /** Qué se ve en el tablero. */
  vista: 'todo' | 'solo'
}

export interface DatosOrganizacion {
  /** Versión del formato. Sube solo si cambia la forma de los datos (con migración). */
  formato: 1
  frentes: Frente[]
  archivados: Frente[]
  bandeja: ItemBandeja[]
  ajustes: AjustesOrganizacion
}

/** Avisos que Organización le da a la app que la monta. */
export type Aviso = 'tarea.hecha' | 'tarea.creada' | 'tarea.cambiada' | 'frente.cambiado'
