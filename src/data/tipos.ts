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
  /** Día 0 (calentamiento): el día anterior al Día 1. Se registra y suma XP, pero nunca resta. */
  diaCero?: FechaDia
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

export type TipoAccion = 'compromiso' | 'entrenamiento' | 'acostarse' | 'limite_juego' | 'revision_diaria' | 'revision_semanal' | 'comida_plan'

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
  /** Entrenamiento: hora límite para empezar (HH:MM). Si empieza después, el pilar queda tarde, sin XP. */
  horaLimiteInicio?: string
  /** Entrenamiento: aviso si todavía no empezó (hora HH:MM y si está activo). */
  avisoInicio?: { activo: boolean; hora: string }
  /** Segundo tope (manga): volver a marcar al llegar a estos minutos da el extra. 0 o vacío = sin extra. */
  minutosExtra?: number
  /** XP del extra (una vez por día). Por defecto 10. */
  xpExtra?: number
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
  /** Día en que se marcó cumplida. Si se cumplió antes de la fecha, el sello y el XP van a este día. */
  cumplidaEl?: FechaDia
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
  /** Segundo tope del día (por defecto 1,5 × la cuota). */
  metaExtra?: number
  /** XP adicional al llegar al extra (una vez por día). Por defecto 10. */
  xpExtra?: number
  /** (Viejo) paso de la cuota. Ya no se usa: ahora se suben las reps por serie. */
  pasoSubida?: number
  /** Series por día (por defecto 5). La cuota es reps por serie × series. */
  seriesPorDia?: number
  /** Cuota fijada a mano: no se recalcula al subir las reps por serie. */
  cuotaAMano?: boolean
  /** Cuántas reps por serie sube cuando la app lo propone (por defecto 1). */
  pasoReps?: number
  /** Cambios de cuota: cada uno vale desde su fecha. Los días anteriores conservan la que tenían. */
  historialCuota?: CambioCuota[]
  /** No proponer subir la cuota antes de esta fecha. */
  proximaPropuesta?: FechaDia
  /** Sin la propuesta de subir cada 3 días (se eligió en el primer arranque o en el contador). */
  sinSubida?: boolean
  atributoIds: string[]
  orden: number
  activo: boolean
  creado: number
}

export type CambioCuota = {
  desde: FechaDia
  cuota: number
  extra: number
  porToque: number
  motivo: 'inicio' | 'sugerida' | 'manual'
}

export type RegistroContador = {
  id?: number
  contadorId: string
  fecha: FechaDia
  instante: number
  cantidad: number
  nota?: string
}

/** Fecha clave del calendario (印): una nota para tener a la vista. No da XP ni cuenta como meta. */
export type FechaClave = {
  id: string
  /** AAAA-MM-DD. Si se repite cada año, vale el mes y día. */
  fecha: string
  titulo: string
  nota?: string
  anual?: boolean
  /** Con hora (examen, trámite) se trata como bloque obligatorio ese día en Mi horario. */
  hora?: string
  horaFin?: string
  creada: number
}

// ---------- Mi horario ----------

export type TipoBloque = 'obligatorio' | 'entreno' | 'otro'

/** Bloque fijo de la semana: colegio, facultad, trabajo, entreno, otro. */
export type BloqueHorario = {
  id: string
  nombre: string
  tipo: TipoBloque
  /** Días de la semana (0 dom..6 sáb). */
  dias: number[]
  desde: string
  hasta: string
}

export type Horario = { id: string; nombre: string; bloques: BloqueHorario[] }

export type ConfigHorario = {
  /** Id del horario en uso («Cuatrimestre», «Vacaciones»). */
  activo: string
  horarios: Horario[]
  /** Por fecha, ids de bloques que ese día no van («hoy no hay cursada»). */
  excepciones: Record<FechaDia, string[]>
}

/** Regla de «Mi código» (掟): solo se lee, no se marca ni da XP. */
export type GrupoCodigo = 'cuerpo' | 'mente' | 'comida' | 'cuidado'
/** Momento del día de una regla: mañana, tarde, noche o siempre (costumbres que valen todo el día). */
export type MomentoCodigo = 'manana' | 'tarde' | 'noche' | 'siempre'
export type ReglaCodigo = {
  id: string
  texto: string
  /** Área (vista «Por área»). */
  grupo: GrupoCodigo
  /** Orden dentro de su área. */
  orden: number
  /** Momento (vista «Por momento»). Si falta, «siempre». */
  momento?: MomentoCodigo
  /** Orden dentro de su momento. Si falta, se usa `orden`. */
  ordenMomento?: number
  creado: number
}

/** Foto de progreso (opcional): queda con el día en que se cargó, sin poder cambiarlo. Solo en el celu. */
export type FotoProgreso = {
  id: string
  fecha: string
  /** Día del ciclo (Día N de 90) en que se cargó; 0 si no había ciclo. */
  dia: number
  /** Imagen achicada (máx. ~1080 px) como data URL (webp o jpg). */
  imagen: string
  creada: number
}

/** Día marcado en el Calendario (印): algo importante que hiciste, con un texto corto. */
export type MarcaDia = {
  fecha: string
  texto: string
  creada: number
  editada?: number
}

/** Hábito en forja: algo nuevo que se vuelve costumbre (ver domain/forja.ts). */
export type HabitoForja = {
  id: string
  nombre: string
  /** El kanji escondido en la piedra. */
  kanji: string
  /** Día 1 de la forja. */
  inicio: FechaDia
  /** Días cumplidos (AAAA-MM-DD). */
  cumplidos: FechaDia[]
  /** Fallas no perdonadas al último cálculo (se guarda para el historial; la regla la calcula de nuevo). */
  fallas: number
  estado: 'forja' | 'forjado' | 'abandonado'
  forjadoEn?: FechaDia
  abandonadoEn?: FechaDia
  creado: number
}

/** Partes de la app que cada uno elige usar o no. */
export type Funcion = 'series' | 'juego' | 'sueno' | 'comida' | 'metas' | 'organizacion' | 'revision' | 'tension' | 'forja' | 'horario' | 'planes' | 'ideasRutina'

export type Ajustes = {
  id: 'unicos'
  /** Ya se cargaron las reglas de ejemplo de «Mi código» (para no volver a cargarlas si se borran). */
  codigoSembrado?: boolean
  /** Ya se aplicó el equilibrio de XP del 2 nov 2026 (extra de series +5, metas pendientes de 30 a 15). */
  xpEquilibrado?: boolean
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
  /** Ya no se usa (v0.34): la hora de levantarse sale de la ventana habitual, no de la apertura del celu. */
  minutosAntesDelCelu: number
  /** Minutos que se tarda en dormirse después de «Dejo celu» (10 a 30, por defecto 15). Reemplaza la latencia aprendida. */
  latenciaDormirseMinutos: number
  /** Reloj inteligente conectado (todavía no hay ninguno: próximamente). */
  relojInteligente: boolean
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
  /** Compañero del tema (el shinobi que se pasea): se pasea / quieto / apagado. Se pasea si falta. */
  companero?: ModoCompanero
  /** Frases sueltas del compañero (si falta, las del tema). */
  frasesCompanero?: string[]
  /** Ninjas de la distracción: lista editable. Si falta, las 3 de muestra; vacía = no aparecen. */
  distracciones?: Distraccion[]
  /** Ninjas de la distracción y el tajo: sí / no (sí si falta). */
  ninjas?: boolean
  /** Brillo de pendientes en Hoy (pilares, reglas y series titilan según el estado). Encendido si falta. */
  brilloPendientes?: boolean
  /** Fruta del día (la manzana al lado del agua): nombre y dos objetivos. Si falta: «Fruta», 1 y 2. */
  fruta?: ConfigFruta
  /** Tira «Ninjas vencidos esta semana» en Progreso (sí si falta). */
  ninjasEnProgreso?: boolean
  /** Batalla contra la distracción (minijuego): activa, contador y reps por toque. */
  batalla?: ConfigBatalla
  /** Cinemática «Tensión»: kanji y frase del final. */
  tension?: ConfigTension
  /** «Apps que te atrapan» (solo app Android): al pasarse de minutos, la escena de Tensión. */
  vigia?: { activo: boolean; repetir: number; apps: { paquete: string; nombre: string; minutos: number }[] }
  caida?: ConfigCaida
  /** Lo no cumplido resta (v0.83): prendido, % de la XP que da y desde qué día vale (nunca hacia atrás). */
  xpResta?: { activa?: boolean; porcentaje?: number; desde?: FechaDia }
  /** Forja de hábitos: días, válidos necesarios, XP por día y al forjarse, máximo a la vez (si falta, los de domain/forja). */
  forja?: Partial<{ dias: number; validos: number; xpDia: number; xpForjado: number; maximo: number }>
  /** Rival escurridizo: modo y XP que roba. */
  rival?: ConfigRival
  /** Adaptación del sueño: desde cuándo, etapas editables y tolerancia de «a horario». */
  adaptacion?: ConfigAdaptacion
  /** Fondo con lluvia dibujada en Hoy, Calendario, Juego y Sueño (todos encendidos si falta). */
  fondoLluvia?: { hoy?: boolean; calendario?: boolean; juego?: boolean; sueno?: boolean; comida?: boolean; entreno?: boolean; mas?: boolean }
  /** Ya no se usa (v0.88.3): reemplazado por `avisos` (lo apagado acá pasa a «Nada»). */
  alarmasApagadas?: string[]
  /** Avisos (Más → Alarmas): por tipo, si es Notificación, Alarma o Nada, y lo editado a mano. Si falta, los de entrada. */
  avisos?: Record<string, ConfigAviso>
  /** Qué partes de la app se usan (primer arranque, «¿Qué querés usar?»). Lo que falte toma su valor por defecto (ver services/funciones). */
  funciones?: Partial<Record<Funcion, boolean>>
  /** Avisos propios agregados con «+ Agregar aviso». */
  avisosPropios?: AvisoPropio[]
  /** Sonido de las alarmas: 'sek' (gong de la app), 'celu' (alarma del teléfono) o la dirección de un tono elegido. */
  sonidoAlarma?: string
  /** Nombre del tono elegido del celu (para mostrarlo). */
  sonidoAlarmaNombre?: string
  /** Calendario: mostrar la franja fina de Mi horario arriba de cada día (gris). */
  calendarioHorario?: boolean
  /** Pájaro torpe: a veces uno de los pájaros del encabezado se choca con el borde (sí si falta). */
  pajaroTorpe?: boolean
  /** Recordatorio tenue en Hoy para alistarse a dormir: cuántos minutos antes de «Dejo celu» (30 si falta). */
  minutosAvisoDormir?: number
  /** Frases del recordatorio, rotan una por noche. Si falta, las tres de la app. */
  frasesDormir?: string[]
  /** Golpe de taiko una sola vez a 10 s del fin del descanso (independiente del sonido de animaciones). Encendido si falta. */
  sonidoAviso10s?: boolean
  /** Nombre del personaje de las animaciones (provisional). */
  nombrePersonaje: string
  /** Fondo de las escenas: papel claro (como la referencia) u oscuro. */
  /** Fondo de las escenas: épico (oscuro con cielo de lluvia), papel claro u oscuro liso. */
  temaAnimaciones: 'claro' | 'oscuro' | 'epico'
  /** Ya se pasó al fondo épico por defecto (4 nov 2026). */
  fondoEpicoAplicado?: boolean
  ultimaExportacion?: number
  diaInicioSemana: 1
  /** Tema elegido (carpeta de src/temas). Por defecto «shinobi». */
  tema: string
  /** Nombre de la persona (primera vez). Vacío si nunca se pidió. */
  nombrePersona: string
  /** Nombre que la persona le dio a su app (por defecto SEK). */
  nombreApp: string
  /** Nombres de las fases del ciclo, en orden (Disciplina, Constancia, Mi yo ideal). */
  nombresFases: string[]
  /** Se completó la pantalla de primera vez (las bases viejas no la tienen: no les aparece). */
  primeraVezHecha?: boolean
  /** Objetivo de comida (Más → Comida). Sin esto, la tarjeta de Hoy invita a configurarlo. */
  comida?: ObjetivoComida
  /** Agua: envases propios, cuál es el del toque y objetivo a mano (sin esto, 35 ml por kilo del peso de Comida). */
  agua?: ConfigAgua
  /** Mi horario (Calendario): bloques fijos de la semana, horarios guardados y excepciones por fecha. */
  horario?: ConfigHorario
  /** Link del formulario de Google para «Recomendar algo» (pisa el del tema). Vacío = botón oculto. */
  formularioRecomendaciones?: string
  /** La app se armó en la primera vez: las migraciones de los pilares de Navil no se aplican. */
  aMedida?: boolean
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
  /** Segunda marca del día (manga a los 30 min): el extra. No cambia el cumplimiento. */
  extra?: boolean
  excepcion?: boolean
  actualizado: number
}

/** De dónde sale un dato del sueño. Prioridad: reloj > corregido > estimado. */
export type FuenteSuenio = 'estimado' | 'corregido' | 'reloj'

export type EtapaSuenio = { tipo: 'ligero' | 'profundo' | 'rem' | 'despierto'; inicio: number; fin: number }

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
  /** Cuántas veces se despertó en la noche, si la persona lo cargó (0, 1, 2, 3 = «3 o más»). */
  despertares?: number
  /** Minutos dormido: de `dormido` a `levantado` (o al despertar previsto si no abrió la app). */
  minutosDormido?: number
  /** De dónde sale cada dato (v0.34). Sin el campo, cuenta como «estimado» (o «corregido» si levantadoCorregido). */
  fuenteAcostado?: FuenteSuenio
  fuenteDormido?: FuenteSuenio
  fuenteLevantado?: FuenteSuenio
  /** Hora de acostarse corregida a mano (no cambia «Dejo celu» ni el XP de la noche). */
  acostadoManual?: number
  /** La noche se cargó a mano, sin tocar «Dejo celu». */
  sinDejoCelu?: boolean
  /** Etapas del sueño, si las da un reloj (todavía no se muestran). */
  etapas?: EtapaSuenio[]
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

// ---------- Entrenamiento en modo juego (v0.36) ----------

/** Un ejercicio dentro de una rutina. Peso 0 = peso corporal. */
export type BloqueEjercicio = {
  id: string
  tipo: 'ejercicio'
  nombre: string
  /** Músculo o grupo (Pecho, Hombro…). */
  grupo?: string
  series: number
  /**
   * Reps actuales: las que hizo la vez pasada en la serie 1 con el peso actual (o las que cargó a mano).
   * La app las sube sola cada vez que las supera (récord). Al cambiar el peso empieza un tramo nuevo y la
   * primera sesión con ese peso las fija.
   */
  reps: number
  /** Repeticiones extra, como el «+3» de «12 + 3». */
  repsExtra?: number
  /** Tope de repeticiones: si la serie 1 llega, se sugiere subir peso (sin proponer cuánto). */
  repsTope: number
  peso: number
  /** Desde qué día vale el peso actual (tramo). Si falta, desde el primer entreno. */
  tramoDesde?: FechaDia
  /** v0.36 (primera prueba): ya no se usa. El peso nuevo lo pone Navil (la app no conoce sus discos). */
  incremento?: number
  /** Descanso entre series, en segundos. */
  descanso: number
  /** Sombra al principio del descanso (segundos) después de las series que no son la última. 0 = sin sombra. */
  sombra: number
  /** Admite reps con ayuda (p. ej. tríceps en polea: las últimas 3 con una mano). Entonces `repsExtra` es la ayuda planeada. */
  admiteAyuda?: boolean
  nota?: string
}

/** Temporizador simple (calentamiento, colgarse en barra). */
/**
 * Temporizador (calentamiento) o cronómetro (colgarse en barra: cuenta para
 * arriba, con peso; `segundos` es el objetivo).
 */
export type BloqueTemporizador = { id: string; tipo: 'calentamiento' | 'temporizador'; nombre: string; segundos: number; veces?: number; peso?: number; nota?: string; modo?: 'cuenta' | 'cronometro'; /** Cronómetro: descanso después, sin sombra (segundos; si falta, 60). */ descansoDespues?: number }
/** Tiempo registrado con el cronómetro (colgarse en barra). */
export type TiempoHecho = { bloqueId: string; nombre: string; segundos: number; peso: number; instante: number }
/** Rondas con cuenta regresiva (kick boxing). */
export type BloqueRondas = { id: string; tipo: 'rondas'; nombre: string; rondas: { segundos: number; texto: string }[]; /** Descanso entre rondas, en segundos (si falta, 60). */ descansoEntre?: number }
/** Casilla para marcar (estirar). */
export type BloqueCasilla = { id: string; tipo: 'casilla'; nombre: string; nota?: string }

export type BloqueRutina = BloqueEjercicio | BloqueTemporizador | BloqueRondas | BloqueCasilla

export type Rutina = {
  id: string
  nombre: string
  /** Días de la semana (0 = domingo … 6 = sábado). */
  dias: number[]
  bloques: BloqueRutina[]
  /** Duración aproximada en minutos. */
  minutos: number
  orden: number
  activa: boolean
  creado: number
  /** Borrada desde Mis rutinas: ya no aparece, pero sigue guardada para el historial de sus entrenos. */
  borrada?: boolean
}

/** `ayuda`: reps con ayuda (solo en ejercicios que la admiten). Quedan en el historial y suman al volumen, pero no cuentan para récord ni para subir peso. */
export type SerieHecha = { bloqueId: string; n: number; reps: number; repsExtra?: number; ayuda?: number; peso: number; instante: number; /** Cuánto duró la serie (desde que terminó el descanso anterior hasta «Serie hecha»). Falta en sesiones viejas. */ segundos?: number }

/** Fase del descanso: sombra, descansar o acomodar para el siguiente ejercicio. */
export type FaseDescanso = { tipo: 'preparar' | 'sombra' | 'descanso' | 'acomodar'; segundos: number; texto: string }

export type SesionEntreno = {
  id?: number
  rutinaId: string
  fecha: FechaDia
  inicio: number
  /** Hora de inicio que cuenta para el límite (19:35). Reiniciar no la cambia. Si falta, vale `inicio`. */
  inicioQueCuenta?: number
  fin?: number
  estado: 'en_curso' | 'terminada'
  /** Bloque en el que está (índice dentro de `orden`). */
  paso: number
  /** Orden de los bloques en esta sesión (se puede cambiar o saltar). */
  orden: string[]
  series: SerieHecha[]
  /** Bloques hechos o saltados que no son ejercicios (calentamiento, kick boxing…). */
  hechos: string[]
  saltados: string[]
  /** «Peso de hoy» elegido antes de la primera serie de cada ejercicio. */
  pesos?: Record<string, number>
  /** Primer movimiento real (serie, temporizador o bloque): la duración cuenta desde acá, no desde que se abrió. */
  primerMovimiento?: number
  /** Tiempos de los bloques con cronómetro. */
  tiempos?: TiempoHecho[]
  /** Descanso en marcha: para retomarlo si la app se cierra. */
  descanso?: { inicio: number; fases: FaseDescanso[]; /** Bloque que no es ejercicio después del cual corre (colgarse en barra). */ origen?: string }
  /** Desde cuándo corre la serie en curso (se fija al terminar el descanso o al pasar de bloque). */
  serieDesde?: number
  /** Temporizador en marcha (calentamiento, colgarse, rondas). */
  reloj?: { bloqueId: string; ronda: number; inicio: number; segundos: number }
  xpExtra?: number
  /** Reps actuales y peso de cada ejercicio al terminar (para que reabrir y volver a terminar compare contra lo mismo). */
  base?: Record<string, { reps: number; peso: number; tramoDesde?: FechaDia }>
}

// ---------- Comidas ----------

export type FranjaComida = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'otro'
export type ActividadComida = 'sedentario' | 'ligero' | 'moderado' | 'alto'
export type MetaComida = 'bajar' | 'mantener' | 'ganar'

/** Datos del objetivo y resultado (calorías y proteína por día). `manual`: los números se corrigieron a mano. */
export type ObjetivoComida = {
  peso: number
  altura: number
  edad: number
  sexo: 'hombre' | 'mujer'
  actividad: ActividadComida
  meta: MetaComida
  kcal: number
  proteina: number
  manual?: boolean
}

/** Alimento propio o traído por código de barras. Valores por 100 g. */
export type AlimentoPropio = {
  id: string
  n: string
  kcal: number
  p: number
  c: number
  g: number
  /** Porción habitual: nombre y gramos. */
  por: string
  gr: number
  fuente: 'propio' | 'off'
  codigo?: string
  up?: 1
  creado: number
}

/** Una cosa comida: los totales ya calculados para esa cantidad. */
export type RegistroComida = {
  id: string
  fecha: FechaDia
  franja: FranjaComida
  alimentoId: string
  nombre: string
  gramos: number
  kcal: number
  p: number
  c: number
  g: number
  up?: 1
  instante: number
}

export type RegistroPeso = { id: string; fecha: FechaDia; kg: number; instante: number }

/** Envase de agua: un toque en la cantimplora de Hoy suma el principal. */
export type EnvaseAgua = { id: string; nombre: string; ml: number }

export type ConfigAgua = {
  envases: EnvaseAgua[]
  /** Id del envase que suma con un toque. */
  principal: string
  /** Objetivo diario a mano, en ml. Sin esto se calcula del peso. */
  objetivoMl?: number
  /** Cómo se ve en Hoy: chiquita dentro de la tarjeta de Comida (lo normal), como tarjeta aparte, o no se usa. */
  enHoy?: 'chica' | 'tarjeta' | 'no'
}

/** Recomendación de un usuario: se manda a un formulario de Google de Navil; si no hay internet, espera. */
export type Recomendacion = {
  id: string
  texto: string
  parte: string
  contacto?: string
  estado: 'pendiente' | 'enviada'
  creada: number
  enviada?: number
  intentos: number
}

/** Fruta del día: dos objetivos, como las series (cuota y extra). */
export type ConfigFruta = { nombre: string; objetivo1: number; objetivo2: number; /** false = no se usa (no aparece en Hoy). */ usar?: boolean }

/** Una fruta comida (un toque en la manzana de Hoy). */
export type TomaFruta = { id: string; fecha: FechaDia; instante: number }

/** Una caída («No cumplí mi palabra» o soltar la mano en Tensión): no reinicia nada, saca XP y deja una tumba rota. */
export type Caida = { id: string; fecha: FechaDia; instante: number; origen: 'boton' | 'tension'; xp: number }
/** Caída: cuánta XP saca (el precio de volver). */
export type ConfigCaida = { xp?: number }

/** Una toma de agua (un toque). */
export type TomaAgua = { id: string; fecha: FechaDia; ml: number; envase?: string; instante: number }

export type ComidaGuardada = { id: string; nombre: string; items: { alimentoId: string; nombre: string; gramos: number }[]; creado: number }

// ---------- Compañero y ninjas de la distracción (4 nov 2026) ----------

export type ModoCompanero = 'pasea' | 'quieto' | 'apagado'

/** Momentos de duda que la app puede ver. */
export type MomentoNinja = 'pilar' | 'noche' | 'duda' | 'juego' | 'batalla'

/** Una distracción (la edita la persona): nombre y, opcional, en qué momento aparece. */
export type Distraccion = { id: string; nombre: string; momento?: MomentoNinja | 'cualquiera' }

/** Una pelea con un ninja de la distracción: vencido (tocó «Empezar») o se escapó. Sin XP. */
export type PeleaNinja = { id?: number; fecha: FechaDia; distraccion: string; momento: MomentoNinja; resultado: 'vencido' | 'escapo'; pilar?: string; instante: number; /** Batalla: reps hechas (la serie que se anotó en el contador). */ reps?: number; /** Rival escurridizo ignorado: XP que se llevó. */ robo?: number }

/** Batalla contra la distracción (minijuego de flexiones). Todo editable en Más → Ver animaciones. */
export type ConfigBatalla = { /** Sí si falta. */ activa?: boolean; /** Contador de reps que se usa (flexiones si falta). */ contadorId?: string; /** Reps por toque (5 si falta). */ repsPorToque?: number; /** Duelo (v0.85): flexiones si no hay serie rápida de flexiones (10 si falta). */ repsSinSerie?: number }

/** Cinemática «Tensión»: kanji y frase del final (editables en Más → Ver animaciones). */
export type ConfigTension = { kanji?: string; frase?: string }
/** Rival escurridizo: cómo aparece una distracción y cuánto XP roba si se lo ignora. */
export type ConfigAdaptacion = { desde?: FechaDia; etapas?: { nombre: string; semanas: number; horasMin: number; horasMax: number; despertaresNormales: number }[]; toleranciaMinutos?: number }
export type ConfigRival = { /** «escurridizo» (muñequito en Hoy, se lo atrapa) o «carta» (la carta directa). Escurridizo si falta. */ modo?: 'escurridizo' | 'carta'; /** XP que roba si se lo ignora (10 si falta, 0 a 30). */ xpRobo?: number }

/** Cómo avisa un aviso: notificación normal, alarma real (pantalla completa, suena hasta apagarla) o nada. */
export type ModoAviso = 'notificacion' | 'alarma' | 'nada'

export type ConfigAviso = {
  modo?: ModoAviso
  /** Hora cambiada a mano («HH:MM»). Si falta, la de la app (se actualiza sola con Sueño o Mi horario). */
  hora?: string
  /** Juego: a qué porcentaje del tiempo diario avisa. */
  porcentaje?: number
  /** Vibrar (sí si falta). */
  vibrar?: boolean
}

export type AvisoPropio = {
  id: string
  nombre: string
  hora: string
  /** Días de la semana (0 domingo). */
  dias: number[]
  modo: ModoAviso
  vibrar?: boolean
}
