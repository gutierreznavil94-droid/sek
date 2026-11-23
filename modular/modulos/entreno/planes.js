'use strict'
/**
 * Planes de entrenamiento para elegir «cómo empezar» y las series rápidas iniciales. Son solo datos:
 * al elegir uno se copian sus rutinas y después todo se edita libre. Traído de src/data/planes.ts y semilla.ts.
 */

// ---------- Rutinas de entrenamiento (planilla «HORARIO FINAL 2026» de Navil) ----------

/**
 * Ejercicio con los valores de la planilla. Rango de repeticiones: mínimo = la
 * planilla y tope = 12 (si la planilla ya pide 12 o más, tope = planilla + 3).
 */
function ej(id, nombre, grupo, series, reps, peso, extra = {}) {
  return { id, tipo: 'ejercicio', nombre, grupo, series, reps, repsTope: reps < 12 ? 12 : reps + 3, peso, descanso: 90, sombra: 30, ...extra }
}

const calentamiento = (r) => ({ id: `${r}-calentar`, tipo: 'calentamiento', nombre: 'Calentamiento', segundos: 180, nota: 'Banda elástica' })
const colgarse = (r) => ({ id: `${r}-colgarse`, tipo: 'temporizador', nombre: 'Colgarse en barra', segundos: 70, veces: 1, peso: 15, nota: 'Recuperación', modo: 'cronometro' })
const kick = (r) => ({
  id: `${r}-kick`,
  tipo: 'rondas',
  nombre: 'Kick boxing',
  rondas: [
    { segundos: 60, texto: 'Enfoque en velocidad y ritmo' },
    { segundos: 60, texto: 'Combinación y vaciado (FULL)' },
  ],
})
const estirar = (r) => ({ id: `${r}-estirar`, tipo: 'casilla', nombre: 'Estirar' })

const RUTINAS_INICIALES = [
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
      ej('a-jalon-triceps', 'Jalón tríceps polea', 'Tríceps', 2, 12, 5, { repsExtra: 3, admiteAyuda: true, nota: 'Codo costilla · las últimas 3 con ayuda de una mano' }),
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


/** Ejercicio en casa: sin sombra y 1 min de descanso. Tope = el número alto del rango (o 12 / +3 como en la planilla). */
function ejCasa(id, nombre, grupo, series, reps, extra = {}) {
  const { hasta, ...resto } = extra
  return { id, tipo: 'ejercicio', nombre, grupo, series, reps, repsTope: hasta ?? (reps < 12 ? 12 : reps + 3), peso: 0, descanso: 60, sombra: 0, ...resto }
}

/** Ejercicio por tiempo: una ronda por serie, con descanso entre medio. */
function porTiempo(id, nombre, series, segundos, texto) {
  return { id, tipo: 'rondas', nombre, rondas: Array.from({ length: series }, () => ({ segundos, texto })), descansoEntre: 30 }
}

/** Fútbol: 10 min de reloj y una casilla por cada práctica. */
function futbol(p, practicas) {
  return [
    { id: `${p}-futbol`, tipo: 'temporizador', nombre: 'Fútbol', segundos: 600, modo: 'cuenta', nota: 'De 10 a 12 min con pelota' },
    ...practicas.map((nombre, i) => ({ id: `${p}-futbol-${i + 1}`, tipo: 'casilla', nombre, nota: 'Fútbol' })),
  ]
}

const calma = (p, nota) => ({ id: `${p}-calma`, tipo: 'temporizador', nombre: 'Vuelta a la calma', segundos: 300, modo: 'cuenta', nota })

/** Plan de Nay (de su foto): martes, miércoles, jueves y sábado. Sin calentamiento. */
const PLAN_NAY = {
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
        ejCasa('nm-sentadillas', 'Sentadillas', 'Piernas', 3, 12),
        ejCasa('nm-puente', 'Puente de glúteos', 'Glúteos', 3, 15),
        ejCasa('nm-patadas', 'Patadas de glúteos en cuatro apoyos', 'Glúteos', 2, 10, { nota: 'Por pierna' }),
        ejCasa('nm-sentadillas-pausa', 'Sentadillas con pausa abajo', 'Piernas', 2, 8),
        ejCasa('nm-zancadas', 'Zancadas hacia atrás', 'Piernas', 2, 8, { nota: 'Por pierna. Si cuestan o molestan las rodillas, cambialas por sentadillas normales' }),
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
        ejCasa('nx-flexiones-pared', 'Flexiones contra la pared', 'Pecho', 3, 10),
        ejCasa('nx-remo', 'Remo con mancuerna', 'Espalda', 3, 12, { peso: 1, nota: 'Por brazo' }),
        ejCasa('nx-curl', 'Curl de bíceps con mancuernas', 'Bíceps', 2, 12, { peso: 1 }),
        ejCasa('nx-flexiones-elevadas', 'Flexiones con manos en superficie firme y elevada', 'Pecho', 2, 6, { hasta: 8, nota: 'Si cuestan, seguí con flexiones contra la pared' }),
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
        ejCasa('nj-crunch', 'Crunch abdominal', 'Abdomen', 2, 10, { hasta: 12 }),
        ejCasa('nj-dead-bug', 'Dead bug', 'Abdomen', 2, 8, { nota: 'Por lado' }),
        porTiempo('nj-plancha', 'Plancha', 3, 20, 'De 15 a 20 s'),
        ejCasa('nj-talones', 'Toques de talones acostada', 'Abdomen', 2, 12, { nota: 'Por lado' }),
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
        ejCasa('ns-sentadillas', 'Sentadillas', 'Piernas', 2, 12),
        ejCasa('ns-flexiones-pared', 'Flexiones contra la pared', 'Pecho', 2, 10),
        ejCasa('ns-puente', 'Puente de glúteos', 'Glúteos', 2, 15),
        ejCasa('ns-remo', 'Remo con mancuerna', 'Espalda', 2, 12, { peso: 1, nota: 'Por brazo' }),
        ejCasa('ns-burpee', 'Burpee adaptado', 'Cuerpo completo', 2, 5, { nota: 'Sin salto ni flexión' }),
        { id: 'ns-saltos', tipo: 'casilla', nombre: 'Extra: 2 series de 5 saltos de sentadilla suaves', nota: 'Solo si ya dominás la técnica' },
        ...futbol('ns', ['Zigzag con pelota', 'Pases contra la pared', 'Control orientado (recibir y mover hacia un costado)', 'Conducción con cambios de velocidad', 'Practicar lo que más cueste']),
        calma('ns', 'Caminar suave y estirar'),
      ],
    },
  ],
}


/** Las rutinas de la planilla de Navil (A, B y C, cada una 2 veces por semana). */
const PLAN_GIMNASIO = {
  id: 'plan-gimnasio',
  nombre: 'Gimnasio A · B · C',
  descripcion: '3 rutinas con pesas, cada una 2 veces por semana (lun a sáb), con kick boxing.',
  dias: [1, 2, 3, 4, 5, 6],
  rutinas: RUTINAS_INICIALES,
}

const PLANES = [PLAN_NAY, PLAN_GIMNASIO]
const planPorId = (id) => PLANES.find((p) => p.id === id)

/** Rutina de ejemplo para quien arranca de cero (primera vez): calentamiento + 4 ejercicios, editable en «Mis rutinas». */
function rutinaDeEjemplo(dias) {
  return {
    id: 'rutina-ejemplo',
    nombre: 'Rutina de ejemplo · Cuerpo completo',
    dias,
    minutos: 30,
    orden: 1,
    activa: true,
    bloques: [
      { id: 'e-calentar', tipo: 'calentamiento', nombre: 'Calentamiento', segundos: 180, nota: 'Movilidad suave' },
      ej('e-sentadillas', 'Sentadillas', 'Pierna', 3, 10, 0, { nota: 'Con el peso del cuerpo' }),
      ej('e-flexiones', 'Flexiones', 'Pecho', 3, 8, 0, { nota: 'Apoyando rodillas si hace falta' }),
      ej('e-remo', 'Remo con mancuerna', 'Espalda', 3, 10, 5),
      ej('e-zancadas', 'Zancadas', 'Pierna', 3, 8, 0, { nota: 'Por pierna' }),
    ],
  }
}

/** Ideas para «de a poco»: solo sugerencias, nunca obligan. */
const IDEAS_DE_A_POCO = [
  'Cuando las repeticiones te salgan fáciles, sumá una serie.',
  'Cada semana podés sumar un ejercicio nuevo (+ Ejercicio).',
  'Si te queda tiempo, agregá unos minutos de algo que te guste: fútbol, baile, caminar.',
  'Cuando quieras, sumá otro día de entreno.',
]

/** Series rápidas iniciales (se siembran al crear la cuenta). */
const CONTADORES_INICIALES = [
  { id: 'flexiones', nombre: 'Flexiones', cantidadPorToque: 14, metaDiaria: 70, xpMetaDiaria: 10, metaExtra: 105, xpExtra: 5, seriesPorDia: 5, orden: 1, activo: true },
  { id: 'dominadas', nombre: 'Dominadas', cantidadPorToque: 7, metaDiaria: 35, xpMetaDiaria: 10, metaExtra: 53, xpExtra: 5, seriesPorDia: 5, orden: 2, activo: true },
]

const copiar = (x) => JSON.parse(JSON.stringify(x))

/** Las rutinas que trae cada elección: { modo: 'plan', planId } | { modo: 'poco' } | { modo: 'cero' }. «De a poco» usa `diasPilar`. */
function rutinasDeEleccion(e, diasPilar) {
  if (!e || e.modo === 'cero') return []
  if (e.modo === 'poco') return [rutinaDeEjemplo(diasPilar)]
  const plan = planPorId(e.planId)
  if (!plan) return null
  return copiar(plan.rutinas)
}

/** Lista corta para la pantalla. */
const listaPlanes = () => PLANES.map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, dias: p.dias, rutinas: p.rutinas.map((r) => r.nombre) }))

module.exports = { PLANES, planPorId, listaPlanes, rutinasDeEleccion, rutinaDeEjemplo, IDEAS_DE_A_POCO, CONTADORES_INICIALES, RUTINAS_INICIALES }
