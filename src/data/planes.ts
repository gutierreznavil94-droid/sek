/**
 * Planes de entrenamiento para elegir «cómo empezar» (primera vez y Mis rutinas).
 * Son solo datos: al elegir uno se copian sus rutinas y después todo se edita libre.
 */
import { RUTINAS_INICIALES, rutinaDeEjemplo } from './semilla'
import type { BloqueEjercicio, BloqueRutina, Rutina } from './tipos'

export type PlanEntreno = {
  id: string
  nombre: string
  descripcion: string
  /** Días fijos del plan (0 = domingo). */
  dias: number[]
  rutinas: Omit<Rutina, 'creado'>[]
}

/** Cómo arrancar: un plan completo, de a poco (rutina cortita) o desde cero (sin rutinas). */
export type EleccionEntreno = { modo: 'plan'; planId: string } | { modo: 'poco' } | { modo: 'cero' }

/** Ejercicio en casa: sin sombra y 1 min de descanso. Tope = el número alto del rango (o 12 / +3 como en la planilla). */
function ej(id: string, nombre: string, grupo: string, series: number, reps: number, extra: Partial<BloqueEjercicio> & { hasta?: number } = {}): BloqueEjercicio {
  const { hasta, ...resto } = extra
  return { id, tipo: 'ejercicio', nombre, grupo, series, reps, repsTope: hasta ?? (reps < 12 ? 12 : reps + 3), peso: 0, descanso: 60, sombra: 0, ...resto }
}

/** Ejercicio por tiempo: una ronda por serie, con descanso entre medio. */
function porTiempo(id: string, nombre: string, series: number, segundos: number, texto: string): BloqueRutina {
  return { id, tipo: 'rondas', nombre, rondas: Array.from({ length: series }, () => ({ segundos, texto })), descansoEntre: 30 }
}

/** Fútbol: 10 min de reloj y una casilla por cada práctica. */
function futbol(p: string, practicas: string[]): BloqueRutina[] {
  return [
    { id: `${p}-futbol`, tipo: 'temporizador', nombre: 'Fútbol', segundos: 600, modo: 'cuenta', nota: 'De 10 a 12 min con pelota' },
    ...practicas.map((nombre, i): BloqueRutina => ({ id: `${p}-futbol-${i + 1}`, tipo: 'casilla', nombre, nota: 'Fútbol' })),
  ]
}

const calma = (p: string, nota: string): BloqueRutina => ({ id: `${p}-calma`, tipo: 'temporizador', nombre: 'Vuelta a la calma', segundos: 300, modo: 'cuenta', nota })

/** Plan de Nay (de su foto): martes, miércoles, jueves y sábado. Sin calentamiento. */
export const PLAN_NAY: PlanEntreno = {
  id: 'plan-nay',
  nombre: 'Piernas, brazos, abdomen y fútbol',
  descripcion: '4 días en casa (mar, mié, jue y sáb): fuerza, fútbol 10–12 min y vuelta a la calma.',
  dias: [2, 3, 4, 6],
  rutinas: [
    {
      id: 'nay-martes',
      nombre: 'Martes · Piernas y glúteos',
      dias: [2],
      minutos: 40,
      orden: 1,
      activa: true,
      bloques: [
        ej('nm-sentadillas', 'Sentadillas', 'Piernas', 3, 12),
        ej('nm-puente', 'Puente de glúteos', 'Glúteos', 3, 15),
        ej('nm-patadas', 'Patadas de glúteos en cuatro apoyos', 'Glúteos', 2, 10, { nota: 'Por pierna' }),
        ej('nm-sentadillas-pausa', 'Sentadillas con pausa abajo', 'Piernas', 2, 8),
        ej('nm-zancadas', 'Zancadas hacia atrás', 'Piernas', 2, 8, { nota: 'Por pierna. Si cuestan o molestan las rodillas, cambialas por sentadillas normales' }),
        ...futbol('nm', ['Conducir la pelota entre conos o botellas', 'Zigzag con la pelota', 'Cambios de dirección', 'Conducir con pie derecho y después izquierdo', 'Terminar con pases contra la pared y control']),
        calma('nm', 'Caminar suave y estirar las piernas sin forzar'),
      ],
    },
    {
      id: 'nay-miercoles',
      nombre: 'Miércoles · Brazos y espalda',
      dias: [3],
      minutos: 40,
      orden: 2,
      activa: true,
      bloques: [
        ej('nx-flexiones-pared', 'Flexiones contra la pared', 'Pecho', 3, 10),
        ej('nx-remo', 'Remo con mancuerna', 'Espalda', 3, 12, { peso: 1, nota: 'Por brazo' }),
        ej('nx-curl', 'Curl de bíceps con mancuernas', 'Bíceps', 2, 12, { peso: 1 }),
        ej('nx-flexiones-elevadas', 'Flexiones con manos en superficie firme y elevada', 'Pecho', 2, 6, { hasta: 8, nota: 'Si cuestan, seguí con flexiones contra la pared' }),
        porTiempo('nx-circulos', 'Círculos de brazos', 2, 20, 'Controlados'),
        ...futbol('nx', ['Pases contra la pared', 'Recibir y controlar antes de devolver', 'Practicar con ambos pies', 'Conducción corta y cambio de dirección']),
        calma('nx', 'Mover suave hombros, brazos y espalda'),
      ],
    },
    {
      id: 'nay-jueves',
      nombre: 'Jueves · Abdomen y zona media',
      dias: [4],
      minutos: 40,
      orden: 3,
      activa: true,
      bloques: [
        ej('nj-crunch', 'Crunch abdominal', 'Abdomen', 2, 10, { hasta: 12 }),
        ej('nj-dead-bug', 'Dead bug', 'Abdomen', 2, 8, { nota: 'Por lado' }),
        porTiempo('nj-plancha', 'Plancha', 3, 20, 'De 15 a 20 s'),
        ej('nj-talones', 'Toques de talones acostada', 'Abdomen', 2, 12, { nota: 'Por lado' }),
        porTiempo('nj-rodillas', 'Rodillas arriba en el lugar', 3, 20, 'Ritmo controlado'),
        ...futbol('nj', ['Conducción entre conos', 'Control de pelota', 'Pases contra la pared', 'Cambios de dirección suaves y progresivos']),
        calma('nj', 'Caminar y relajar suave espalda y piernas'),
      ],
    },
    {
      id: 'nay-sabado',
      nombre: 'Sábado · Cuerpo completo',
      dias: [6],
      minutos: 40,
      orden: 4,
      activa: true,
      bloques: [
        { id: 'ns-circuito', tipo: 'casilla', nombre: 'Circuito de 2 vueltas', nota: 'Hacé los 5 ejercicios y repetí la vuelta. Descansá cuando haga falta' },
        ej('ns-sentadillas', 'Sentadillas', 'Piernas', 2, 12),
        ej('ns-flexiones-pared', 'Flexiones contra la pared', 'Pecho', 2, 10),
        ej('ns-puente', 'Puente de glúteos', 'Glúteos', 2, 15),
        ej('ns-remo', 'Remo con mancuerna', 'Espalda', 2, 12, { peso: 1, nota: 'Por brazo' }),
        ej('ns-burpee', 'Burpee adaptado', 'Cuerpo completo', 2, 5, { nota: 'Sin salto ni flexión' }),
        { id: 'ns-saltos', tipo: 'casilla', nombre: 'Extra: 2 series de 5 saltos de sentadilla suaves', nota: 'Solo si ya dominás la técnica' },
        ...futbol('ns', ['Zigzag con pelota', 'Pases contra la pared', 'Control orientado (recibir y mover hacia un costado)', 'Conducción con cambios de velocidad', 'Practicar lo que más cueste']),
        calma('ns', 'Caminar suave y estirar'),
      ],
    },
  ],
}

/** Las rutinas de la planilla de Navil (A, B y C, cada una 2 veces por semana). */
export const PLAN_GIMNASIO: PlanEntreno = {
  id: 'plan-gimnasio',
  nombre: 'Gimnasio A · B · C',
  descripcion: '3 rutinas con pesas, cada una 2 veces por semana (lun a sáb), con kick boxing.',
  dias: [1, 2, 3, 4, 5, 6],
  rutinas: RUTINAS_INICIALES,
}

export const PLANES: PlanEntreno[] = [PLAN_NAY, PLAN_GIMNASIO]

export function planPorId(id: string): PlanEntreno | undefined {
  return PLANES.find((p) => p.id === id)
}

/** Ideas para «de a poco»: solo sugerencias, nunca obligan. */
export const IDEAS_DE_A_POCO = [
  'Cuando las repeticiones te salgan fáciles, sumá una serie.',
  'Cada semana podés sumar un ejercicio nuevo (+ Ejercicio).',
  'Si te queda tiempo, agregá unos minutos de algo que te guste: fútbol, baile, caminar.',
  'Cuando quieras, sumá otro día de entreno.',
]

/** Las rutinas que trae cada elección. «De a poco» usa los días del pilar Entrenar. */
export function rutinasDeEleccion(e: EleccionEntreno, diasPilar: number[]): Omit<Rutina, 'creado'>[] {
  if (e.modo === 'cero') return []
  if (e.modo === 'poco') return [rutinaDeEjemplo(diasPilar)]
  const plan = planPorId(e.planId)
  if (!plan) throw new Error('Ese plan no existe')
  return plan.rutinas.map((r) => ({ ...r, dias: [...r.dias], bloques: r.bloques.map((b) => ({ ...b })) }))
}

/** Los días que propone una elección (null = los que ya tenga el pilar). */
export function diasDeEleccion(e: EleccionEntreno): number[] | null {
  return e.modo === 'plan' ? planPorId(e.planId)?.dias ?? null : null
}
