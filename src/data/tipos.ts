/**
 * Tipos de las tablas. Separa definiciones (lo que configuras) de registros
 * (lo que pasa cada día). Todo cambio de definición o corrección de registro
 * escribe además una fila en `eventos`.
 */

import type { EstadoCompromiso } from '../domain/cumplimiento'
import type { FechaDia } from '../domain/fechas'
import type { SesionJuego } from '../domain/juego'
import type { OrigenXp, RegistroXp } from '../domain/xp'

export type { RegistroXp, OrigenXp, SesionJuego, EstadoCompromiso }

// ---------- Definiciones ----------

export type Identidad = {
  id: 'unica'
  vision: string
  obstaculos: string
  actualizado: number
}

export type Atributo = {
  id: string
  nombre: string
  descripcion: string
  orden: number
  ventanaDias: number
  creado: number
  archivado?: boolean
}

export type Ciclo = {
  id: string
  numero: number
  inicio: FechaDia
  duracionDias: number
  diasPorFase: number
  estado: 'activo' | 'cerrado'
  creado: number
  cerrado?: number
}

export type Fase = {
  id: string
  cicloId: string
  numero: number
  diaInicio: number
  diaFin: number
  foco: string
  queSeMide: string
  notasCierre?: string
  cerradaEn?: number
}

export type Objetivo = {
  id: string
  cicloId: string
  faseNumero: number
  atributoId: string
  titulo: string
  indicador: string
  lineaBase?: string
  meta?: string
  resultado?: string
  creado: number
  archivado?: boolean
}

export type TipoAccion = 'compromiso' | 'entrenamiento' | 'acostarse' | 'limite_juego' | 'revision_diaria' | 'revision_semanal'

export type Accion = {
  id: string
  nombre: string
  tipo: TipoAccion
  condicion: string
  /** Días de la semana en que se programa (0 dom..6 sáb). Vacío = ninguno. */
  dias: number[]
  /** Hora prevista HH:MM, opcional. */
  hora?: string
  /** Hora distinta para algunos días de la semana (0 dom..6 sáb). Si falta, se usa `hora`. */
  horasPorDia?: Record<number, string>
  /** Para entrenamiento o pilares con mínimo: minutos mínimos para contar como hecho. */
  minutosMinimos?: number
  /** Duración fija (entrenamiento): tocar la tarjeta lo marca hecho con estos minutos. */
  duracionMinutos?: number
  /** Pilar del día: aparece arriba de Hoy y cuenta para el cumplimiento diario. */
  pilar?: boolean
  /** Hora límite HH:MM para marcarlo; después queda como «tarde» y no da XP. */
  horaLimite?: string
  /** Pregunta opcional al marcarlo (ej. «¿Qué avancé?»). */
  pregunta?: string
  atributoIds: string[]
  objetivoIds: string[]
  peso: number
  activa: boolean
  orden: number
  creado: number
}

export type ReglaXp = {
  id: string
  accionId: string
  xp: number
  maximo: number
  periodo: 'dia' | 'semana'
  validaDesde: FechaDia
  creado: number
}

export type TipoMeta = 'fin_fase' | 'revision_semanal' | 'propia' | 'inicio_ciclo' | 'fin_ciclo'

export type EstadoMeta = 'pendiente' | 'cumplida' | 'no_cumplida'

export type Meta = {
  id: string
  fecha: FechaDia
  titulo: string
  tipo: TipoMeta
  /** Solo metas propias: se resuelve al llegar la fecha («Lo logré» / «No llegué»). */
  estado?: EstadoMeta
  /** XP que da al cumplirse (metas propias). */
  xp?: number
  resueltaEn?: number
  /** Compatibilidad con versiones anteriores; `estado` manda. */
  cumplida?: boolean
  nota?: string
  creado: number
}

/** Contador de series rápidas (flexiones, dominadas): cada toque suma una cantidad fija. */
export type Contador = {
  id: string
  nombre: string
  /** Cuánto suma cada toque (ej. 14 flexiones). Se sube con el tiempo. */
  cantidadPorToque: number
  metaDiaria: number
  metaSemanal?: number
  /** XP al llegar a la meta diaria (una vez por día). */
  xpMetaDiaria: number
  atributoIds: string[]
  orden: number
  activo: boolean
  creado: number
}

export type RegistroContador = {
  id?: number
  contadorId: string
  fecha: FechaDia
  instante: number
  cantidad: number
  nota?: string
}

export type Ajustes = {
  id: 'unicos'
  zonaHoraria: string
  baseNivel: number
  /** Límite de juego de lunes a viernes, en minutos. */
  limiteJuegoSemana: number
  /** Límite de juego sábados, domingos y feriados, en minutos. */
  limiteJuegoFinde: number
  avisoJuegoPorcentaje: number
  /** Rutina de noche en tres pasos, en orden. */
  horaAlistarse: string
  horaDejarCelu: string
  horaDormido: string
  horaCorteNoche: string
  /** Minutos de margen después de la hora límite de manga, empresa y revisión (20:50 → 21:00). */
  margenNocheMinutos: number
  /** Hasta esta hora «Dejo celu» se puede marcar tarde; después el botón desaparece y la noche queda omitida. */
  horaLimiteCelu: string
  /** Hora de levantarse: termina el modo sueño («Buenos días») y cierra el registro de la noche. */
  horaFinSuenio: string
  /** Minutos que se tarda en dormirse después de «Dejo celu» (la app lo ajusta sola con las aperturas de la noche). */
  latenciaSuenioMinutos: number
  /** Minutos que pasan entre levantarse y agarrar el celu: la hora de levantarse = primera apertura − esto. */
  minutosAntesDelCelu: number
  objetivoSuenioHoras: number
  umbralRacha: number
  xpRacha7: number
  minimoProgramadosAtributo: number
  maxCompromisosXpPorDia: number
  maxIniciosXpPorDia: number
  xpInicio: number
  xpCompromisoPorDefecto: number
  diasAvisoCopia: number
  /** Animaciones de logro: todas, solo logros grandes (nivel, racha, fase) o ninguna. */
  animaciones: 'todas' | 'logros' | 'ninguna'
  /** Sonido de las animaciones (generado por la app). Apagado al inicio. */
  sonidoAnimaciones: boolean
  /** Nombre del personaje de las animaciones (provisional). */
  nombrePersonaje: string
  /** Fondo de las escenas: papel claro (como la referencia) u oscuro. */
  temaAnimaciones: 'claro' | 'oscuro'
  ultimaExportacion?: number
  diaInicioSemana: 1
}

// ---------- Registros ----------

export type Compromiso = {
  id: string
  accionId: string
  fecha: FechaDia
  horaPrevista?: string
  estado: EstadoCompromiso
  inicioReal?: number
  finReal?: number
  /** Si se reprogramó, a qué fecha. */
  reprogramadoA?: FechaDia
  /** Si viene de una reprogramación, de qué fecha. */
  reprogramadoDesde?: FechaDia
  minutos?: number
  nota?: string
  /** Respuesta a la pregunta del pilar (ej. qué avancé). */
  respuesta?: string
  /** Marcado después de la hora límite: cuenta como hecho tarde, sin XP. */
  retrasoMinutos?: number
  excepcion?: boolean
  actualizado: number
}

/** Registro de «Dejo celu»: la hora real de dejar el celular. También deja registrada la rutina nocturna. */
export type RegistroSuenio = {
  id?: number
  noche: FechaDia
  /** Hora límite para dejar el celu esa noche. */
  horaPrevista: string
  horaReal: number
  retrasoMinutos: number
  cumplido: boolean
  rutinaRegistrada: boolean
  nota?: string
  creado: number
  // ---- Registro de sueño (cambios 11): la app lo completa sola ----
  /** Instante estimado en que se durmió: dejo celu (o la última apertura temprana) + latencia. */
  dormido?: number
  /** Minutos que tardó en dormirse según la estimación (latencia usada esa noche). */
  latenciaMinutos?: number
  /** Latencia observada (minutos) cuando una apertura temprana corrió la hora de dormirse; de acá aprende la app. */
  latenciaReal?: number
  /** La hora de levantarse la corrigió la persona a mano. */
  levantadoCorregido?: boolean
  /** Hora de levantarse prevista esa noche (fin del modo sueño). */
  despertarPrevisto?: number
  /** Instante en que se levantó de verdad (primera vez que abre la app a la mañana, o «Ya me levanté»). */
  levantado?: number
  /** Minutos dormido: de `dormido` a `levantado` (o al despertar previsto si no abrió la app). */
  minutosDormido?: number
  /** Aperturas de la app durante la noche (cantidad). */
  aperturas?: number
}

export type Feriado = {
  fecha: FechaDia
  nombre: string
  /** true si lo marcó el usuario (los precargados se pueden quitar igual). */
  propio?: boolean
  creado: number
}

export type SiguienteAccion = {
  id?: number
  tareaAmbigua: string
  accionConcreta: string
  creado: number
  iniciado?: number
  terminado?: number
  resultado?: 'hecha' | 'parcial' | 'no_hecha'
  /** Segundos entre crearla e iniciarla. */
  segundosHastaEmpezar?: number
  compromisoId?: string
}

export type TipoRevision = 'diaria' | 'semanal' | 'fase' | 'ciclo'

export type Revision = {
  id: string
  tipo: TipoRevision
  /** Fecha del día, lunes de la semana, o id de fase/ciclo. */
  periodo: string
  respuestas: Record<string, string>
  /** Foto de los números en el momento de la revisión. */
  foto: Record<string, unknown>
  creado: number
  actualizado: number
}

export type RegistroNivel = {
  id?: number
  nivel: number
  alcanzado: number
  xpTotal: number
}

export type AtributoDiario = {
  id?: number
  fecha: FechaDia
  atributoId: string
  valor: number | null
  cumplidos: number
  programados: number
}

export type DiaCerrado = {
  fecha: FechaDia
  cumplidos: number
  programados: number
  porcentaje: number | null
  minutosJuego: number
  excepcion?: boolean
  cerradoEn: number
}

export type Excepcion = {
  fecha: FechaDia
  motivo: string
  creado: number
}

export type TipoEvento =
  | 'crear'
  | 'editar'
  | 'borrar'
  | 'corregir'
  | 'anular_xp'
  | 'cerrar_dia'
  | 'subir_nivel'
  | 'importar'
  | 'exportar'
  | 'cerrar_fase'
  | 'nuevo_ciclo'
  | 'modo_suenio'

export type Evento = {
  id?: number
  instante: number
  tipo: TipoEvento
  entidad: string
  entidadId: string
  antes?: unknown
  despues?: unknown
  motivo?: string
}

/** Modo sueño activo (hay como mucho uno). Se guarda para que recargar la app no lo quite. */
export type ModoSuenio = {
  id: 'activo'
  noche: FechaDia
  /** Instante en que se tocó «Dejo celu». */
  inicio: number
  /** Instante en que termina solo (hora de fin del modo sueño). */
  hasta: number
  /** true si «Dejo celu» fue después de la hora límite: el mensaje es neutro. */
  tarde: boolean
  /** Resumen de una línea que se muestra en «Buenas noches». */
  resumen: string
  /** Veces que se abrió la app durante el modo sueño (solo la hora, dato honesto). */
  aperturas: number[]
}

/** Estado del temporizador activo (hay como mucho uno). */
export type TemporizadorActivo = {
  id: 'activo'
  sesionId: number
}
