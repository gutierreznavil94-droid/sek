/**
 * «¿Qué querés usar?»: cada parte de la app se puede apagar. Lo que se apaga no se ve en Hoy ni en Más,
 * se salta su paso en el primer arranque y sus avisos no suenan. Los datos no se borran: al prenderla vuelve igual.
 * Lo del creador viene prendido; lo que sumó App Nay (planes de entreno e ideas) viene apagado.
 */
import type { Ajustes, Funcion } from '../data/tipos'

export type DefFuncion = { id: Funcion; nombre: string; detalle: string; de: 'sek' | 'nay'; defecto: boolean }

export const FUNCIONES: DefFuncion[] = [
  { id: 'series', nombre: 'Series rápidas', detalle: 'Flexiones, dominadas… con cuota por día', de: 'sek', defecto: true },
  { id: 'juego', nombre: 'Juego', detalle: 'Temporizador de juego con tiempo por día', de: 'sek', defecto: true },
  { id: 'sueno', nombre: 'Sueño', detalle: 'Modo sueño, alistarse y buenas noches', de: 'sek', defecto: true },
  { id: 'comida', nombre: 'Comida y agua', detalle: 'Calorías, proteína, agua y fruta', de: 'sek', defecto: true },
  { id: 'metas', nombre: 'Metas', detalle: 'Metas con fecha y la semana en Hoy', de: 'sek', defecto: true },
  { id: 'organizacion', nombre: 'Tareas', detalle: 'Organización: notas y tareas del día', de: 'sek', defecto: true },
  { id: 'revision', nombre: 'Revisión diaria', detalle: 'Repaso del día a la noche', de: 'sek', defecto: true },
  { id: 'tension', nombre: 'Tensión y No cumplí', detalle: 'Escenas y flexiones cuando fallás', de: 'sek', defecto: true },
  { id: 'forja', nombre: 'Forja de hábitos', detalle: 'La piedra de 30 días por hábito', de: 'sek', defecto: true },
  { id: 'horario', nombre: 'Mi horario', detalle: 'Bloques fijos de la semana y la barra del día', de: 'sek', defecto: true },
  { id: 'planes', nombre: 'Planes de entreno', detalle: '«Elegir cómo empezar»: plan completo, de a poco o desde cero', de: 'nay', defecto: false },
  { id: 'ideasRutina', nombre: 'Ideas para la rutina', detalle: 'Consejos para ir agrandando la rutina de ejemplo', de: 'nay', defecto: false },
]

/** ¿Se usa esta parte? Lo no elegido toma su valor por defecto. */
export function usa(a: Pick<Ajustes, 'funciones'> | null | undefined, f: Funcion): boolean {
  return a?.funciones?.[f] ?? FUNCIONES.find((x) => x.id === f)?.defecto ?? true
}

/** Todas, con el valor que tienen ahora (para la pantalla de elegir). */
export function funcionesElegidas(a: Pick<Ajustes, 'funciones'> | null | undefined): Record<Funcion, boolean> {
  return Object.fromEntries(FUNCIONES.map((x) => [x.id, usa(a, x.id)])) as Record<Funcion, boolean>
}

/** De qué parte depende cada aviso (los que no están, no dependen de ninguna). */
export const FUNCION_DEL_AVISO: Record<string, Funcion> = {
  'juego-mitad': 'juego',
  'juego-limite': 'juego',
  revision: 'revision',
  alistarse: 'sueno',
  dormido: 'sueno',
  horario: 'horario',
  salida: 'horario',
}
