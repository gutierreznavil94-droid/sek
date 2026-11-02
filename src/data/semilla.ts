/**
 * Datos iniciales: identidad, cinco atributos, acciones de la fase 1 y sus
 * reglas de XP. Todo es editable desde la app después.
 */

import type { Contador, Accion, Ajustes, Atributo, BloqueEjercicio, BloqueRutina, Feriado, Identidad, ReglaXp, Rutina } from './tipos'
import { ZONA_POR_DEFECTO } from '../domain/fechas'

export const AJUSTES_INICIALES: Ajustes = {
  id: 'unicos',
  zonaHoraria: ZONA_POR_DEFECTO,
  baseNivel: 100,
  limiteJuegoSemana: 60,
  limiteJuegoFinde: 120,
  avisoJuegoPorcentaje: 80,
  horaAlistarse: '20:50',
  horaDejarCelu: '21:15',
  horaDormido: '21:20',
  horaCorteNoche: '06:00',
  margenNocheMinutos: 10,
  horaLimiteCelu: '22:15',
  horaFinSuenio: '05:00',
  latenciaSuenioMinutos: 25,
  minutosAntesDelCelu: 5,
  latenciaDormirseMinutos: 15,
  relojInteligente: false,
  objetivoSuenioHoras: 7.5,
  umbralRacha: 75,
  xpRacha7: 20,
  minimoProgramadosAtributo: 5,
  maxCompromisosXpPorDia: 5,
  maxIniciosXpPorDia: 3,
  xpInicio: 5,
  xpCompromisoPorDefecto: 10,
  diasAvisoCopia: 7,
  animaciones: 'todas',
  sonidoAnimaciones: false,
  nombrePersonaje: 'Shinobi',
  temaAnimaciones: 'claro',
  diaInicioSemana: 1,
}

export const IDENTIDAD_INICIAL: Omit<Identidad, 'actualizado'> = {
  id: 'unica',
  vision:
    'Persona disciplinada que cumple sus compromisos; físico estético, buena postura y fuerza; confianza y respeto propio y hacia los demás; autocontrol físico, mental y emocional; claridad mental y foco; que actúa sin depender de las ganas.',
  obstaculos: 'Postergación, exceso de tiempo de juego, falta de constancia, distracción, sensación de estancamiento, comparación excesiva con otros.',
}

export const ATRIBUTOS_INICIALES: Omit<Atributo, 'creado'>[] = [
  { id: 'disciplina', nombre: 'Disciplina y ejecución', descripcion: 'Cumplir lo planificado y empezar sin postergar.', orden: 1, ventanaDias: 14 },
  { id: 'fisico', nombre: 'Físico y presencia', descripcion: 'Entrenamiento, postura, fuerza y descanso.', orden: 2, ventanaDias: 14 },
  { id: 'autocontrol', nombre: 'Autocontrol', descripcion: 'Respetar límites: juego, hora de acostarse, impulsos.', orden: 3, ventanaDias: 14 },
  { id: 'claridad', nombre: 'Claridad mental y foco', descripcion: 'Saber cuál es la siguiente acción y sostener la atención.', orden: 4, ventanaDias: 14 },
  { id: 'confianza', nombre: 'Confianza, respeto y estabilidad emocional', descripcion: 'Coherencia entre lo que digo y lo que hago; revisar sin castigarme.', orden: 5, ventanaDias: 14 },
]

const TODOS = [0, 1, 2, 3, 4, 5, 6]

export const ACCIONES_INICIALES: Omit<Accion, 'creado'>[] = [
  {
    id: 'entrenamiento',
    nombre: 'Entrenamiento',
    tipo: 'entrenamiento',
    condicion: 'Hacer el entrenamiento completo (42 min) el día programado. Los demás días el pilar muestra «Descanso».',
    dias: [1, 2, 3, 4, 5, 6],
    hora: '07:00',
    minutosMinimos: 42,
    duracionMinutos: 42,
    pilar: true,
    atributoIds: ['fisico'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 1,
  },
  {
    id: 'manga',
    nombre: 'Dibujar manga',
    tipo: 'compromiso',
    condicion: 'Al menos 15 minutos dibujando. Marcar «Sí» hasta las 20:50; después queda como tarde y no da XP.',
    dias: TODOS,
    horaLimite: '20:50',
    minutosMinimos: 15,
    pilar: true,
    atributoIds: ['claridad'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 3,
  },
  {
    id: 'empresa',
    nombre: 'Avanzar en la empresa',
    tipo: 'compromiso',
    condicion: 'Avancé al menos en una cosa importante. Marcar «Sí» hasta las 20:50; después queda como tarde y no da XP.',
    dias: TODOS,
    horaLimite: '20:50',
    pregunta: '¿Qué avancé?',
    pilar: true,
    atributoIds: ['disciplina'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 2,
  },
  {
    id: 'acostarse',
    nombre: 'Dormir a horario',
    tipo: 'acostarse',
    condicion: 'Tocar «Dejo celu» hasta las 21:15 (celular abajo, fuera del cuarto). Después queda como tarde con los minutos de retraso. Cuenta para la noche planificada aunque sea después de las 00:00.',
    dias: TODOS,
    hora: '21:15',
    horaLimite: '21:15',
    pilar: true,
    atributoIds: ['autocontrol'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 4,
  },
  {
    id: 'limite_juego',
    nombre: 'Respetar el límite de juego',
    tipo: 'limite_juego',
    condicion: 'Al cerrar el día, el tiempo de juego registrado no supera el límite. Registrar el juego no da XP; respetar el límite sí.',
    dias: TODOS,
    atributoIds: ['autocontrol'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 5,
  },
  {
    id: 'revision_diaria',
    nombre: 'Revisión diaria',
    tipo: 'revision_diaria',
    condicion: 'Tres pasos en menos de 3 minutos: qué cumplí (se muestra solo), el obstáculo principal y un ajuste para mañana. Hasta las 20:50, con 10 minutos de margen.',
    dias: TODOS,
    hora: '20:50',
    horaLimite: '20:50',
    atributoIds: ['claridad', 'confianza'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 6,
  },
  {
    id: 'revision_semanal',
    nombre: 'Revisión semanal',
    tipo: 'revision_semanal',
    condicion: 'Completar la revisión de la semana (domingo).',
    dias: [0],
    hora: '19:00',
    atributoIds: ['claridad', 'confianza'],
    objetivoIds: [],
    peso: 1,
    activa: true,
    orden: 7,
  },
]

export function reglasIniciales(desde: string): Omit<ReglaXp, 'creado'>[] {
  return [
    { id: 'r_entrenamiento', accionId: 'entrenamiento', xp: 30, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_acostarse', accionId: 'acostarse', xp: 20, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_manga', accionId: 'manga', xp: 15, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_empresa', accionId: 'empresa', xp: 15, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_limite_juego', accionId: 'limite_juego', xp: 15, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_revision_diaria', accionId: 'revision_diaria', xp: 10, maximo: 1, periodo: 'dia', validaDesde: desde },
    { id: 'r_revision_semanal', accionId: 'revision_semanal', xp: 25, maximo: 1, periodo: 'semana', validaDesde: desde },
  ]
}


export const FASES_INICIALES = [
  { numero: 1, foco: 'Disciplina y ejecución', queSeMide: 'Línea de base (primeros 7 días) y % de compromisos cumplidos.' },
  { numero: 2, foco: 'Constancia y autocontrol', queSeMide: 'Menos incumplimientos repetidos, respetar límites, volver a la rutina tras un mal día. Comparación con la fase 1.' },
  { numero: 3, foco: 'Consolidar la identidad con resultados', queSeMide: 'Cumplimiento, regularidad de entrenamiento y descanso, control del juego, capacidad de empezar tareas, coherencia objetivos-acciones.' },
]

/**
 * Feriados nacionales de Argentina entre noviembre de 2026 y enero de 2027.
 * El 20 de noviembre es trasladable (ley 27.399): en 2026 cae viernes y pasa
 * al lunes 23. Se pueden marcar o quitar días desde el Calendario.
 */
export const FERIADOS_INICIALES: Omit<Feriado, 'creado'>[] = [
  { fecha: '2026-11-23', nombre: 'Día de la Soberanía Nacional (trasladado del 20)' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción de María' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
]

/** Contadores de series rápidas iniciales. Cantidad por toque y meta diaria se editan en «Más → Contadores». */
export const CONTADORES_INICIALES: Omit<Contador, 'creado'>[] = [
  { id: 'flexiones', nombre: 'Flexiones', cantidadPorToque: 14, metaDiaria: 70, xpMetaDiaria: 10, metaExtra: 105, xpExtra: 10, seriesPorDia: 5, atributoIds: ['fisico'], orden: 1, activo: true },
  { id: 'dominadas', nombre: 'Dominadas', cantidadPorToque: 7, metaDiaria: 35, xpMetaDiaria: 10, metaExtra: 53, xpExtra: 10, seriesPorDia: 5, atributoIds: ['fisico'], orden: 2, activo: true },
]

// ---------- Rutinas de entrenamiento (planilla «HORARIO FINAL 2026» de Navil) ----------

/**
 * Ejercicio con los valores de la planilla. Rango de repeticiones: mínimo = la
 * planilla y tope = 12 (si la planilla ya pide 12 o más, tope = planilla + 3).
 */
function ej(id: string, nombre: string, grupo: string | undefined, series: number, reps: number, peso: number, extra: Partial<BloqueEjercicio> = {}): BloqueEjercicio {
  return { id, tipo: 'ejercicio', nombre, grupo, series, reps, repsTope: reps < 12 ? 12 : reps + 3, peso, descanso: 90, sombra: 30, ...extra }
}

const calentamiento = (r: string): BloqueRutina => ({ id: `${r}-calentar`, tipo: 'calentamiento', nombre: 'Calentamiento', segundos: 180, nota: 'Banda elástica' })
const colgarse = (r: string): BloqueRutina => ({ id: `${r}-colgarse`, tipo: 'temporizador', nombre: 'Colgarse en barra', segundos: 70, veces: 1, peso: 15, nota: 'Recuperación', modo: 'cronometro' })
const kick = (r: string): BloqueRutina => ({
  id: `${r}-kick`,
  tipo: 'rondas',
  nombre: 'Kick boxing',
  rondas: [
    { segundos: 60, texto: 'Enfoque en velocidad y ritmo' },
    { segundos: 60, texto: 'Combinación y vaciado (FULL)' },
  ],
})
const estirar = (r: string): BloqueRutina => ({ id: `${r}-estirar`, tipo: 'casilla', nombre: 'Estirar' })

export const RUTINAS_INICIALES: Omit<Rutina, 'creado'>[] = [
  {
    id: 'rutina-a',
    nombre: 'Rutina A · Pecho, hombro y tríceps',
    dias: [1, 4],
    minutos: 42,
    orden: 1,
    activa: true,
    bloques: [
      calentamiento('a'),
      ej('a-press-banca', 'Press banca', 'Pecho', 2, 8, 53),
      ej('a-press-inclinado', 'Press inclinado', 'Pecho', 2, 7, 48),
      ej('a-press-hombro', 'Press mancuerna hombro', 'Hombro', 2, 6, 12.5, { nota: 'Disco más atrás' }),
      ej('a-vuelos', 'Vuelos laterales', 'Hombro', 2, 11, 5),
      colgarse('a'),
      ej('a-press-frances', 'Press francés', 'Tríceps', 2, 5, 15),
      ej('a-jalon-triceps', 'Jalón tríceps polea', 'Tríceps', 2, 12, 5, { repsExtra: 3, nota: 'Codo costilla' }),
      kick('a'),
      estirar('a'),
    ],
  },
  {
    id: 'rutina-b',
    nombre: 'Rutina B · Espalda, bíceps y abdomen',
    dias: [2, 5],
    minutos: 42,
    orden: 2,
    activa: true,
    bloques: [
      calentamiento('b'),
      ej('b-dominadas', 'Dominadas neutro', 'Espalda', 2, 11, 6),
      ej('b-remo', 'Remo con mancuerna', 'Espalda', 2, 14, 5, { nota: 'Con buena técnica' }),
      ej('b-curl-z', 'Curl con barra Z', 'Bíceps', 2, 5, 20),
      ej('b-martillo', 'Curl martillo', 'Bíceps', 2, 9, 10, { nota: 'Controlado' }),
      colgarse('b'),
      ej('b-abdomen-barra', 'Abdomen en barra', 'Abdomen', 2, 18, 0),
      ej('b-abdomen-declinado', 'Abdomen en press declinado', 'Abdomen', 2, 10, 0),
      kick('b'),
      estirar('b'),
    ],
  },
  {
    id: 'rutina-c',
    nombre: 'Rutina C · Pierna',
    dias: [3, 6],
    minutos: 35,
    orden: 3,
    activa: true,
    bloques: [
      calentamiento('c'),
      ej('c-sentadillas', 'Sentadillas con barra', 'Pierna', 2, 7, 20, { descanso: 120, nota: 'Controlado' }),
      ej('c-zancadas', 'Zancadas con subida', 'Pierna', 2, 7, 10, { nota: 'Controlado' }),
      ej('c-rumano', 'Peso muerto rumano', 'Pierna', 2, 7, 20, { nota: 'Controlado' }),
      ej('c-gemelos-barra', 'Gemelos con barra', 'Gemelos', 2, 20, 20, { nota: 'Controlado, sin disco por ahora' }),
      ej('c-gemelos-sentado', 'Gemelos sentado', 'Gemelos', 2, 18, 10, { nota: 'Controlado' }),
      colgarse('c'),
      kick('c'),
      estirar('c'),
    ],
  },
]
