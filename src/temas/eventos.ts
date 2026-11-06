/**
 * Eventos genéricos de los temas. Sin React y sin nada de SEK: se puede llevar a otra app tal cual.
 *
 * Las apps (SEK, Organización) no animan directo: avisan qué pasó con `disparar('completar', { elemento })`
 * y el tema activo decide cómo se ve. Si el tema no tiene ese evento, usa el de «comun».
 * Regla: si se suma un evento nuevo, se agrega a TODOS los temas (aunque en Común sea algo simple).
 */

export const EVENTOS = ['completar', 'aparecer', 'logro', 'recompensa', 'alerta', 'descanso', 'dormir', 'pelear', 'robo', 'duda', 'jugar', 'pausa', 'quieto', 'forja-paso', 'forja-pedazo', 'forja-completa'] as const
export type NombreEvento = (typeof EVENTOS)[number]
/** Eventos que se sumaron con las animaciones de v0.65 (Estoy dudando, Juego, pausa, quieto) y la forja de hábitos (v0.74): cada tema puede traer el suyo; si falta, el de Común. */
export const EVENTOS_NUEVOS = ['duda', 'jugar', 'pausa', 'quieto', 'forja-paso', 'forja-pedazo', 'forja-completa'] as const
type EventoNuevo = (typeof EVENTOS_NUEVOS)[number]

export interface DetalleEvento {
  /** Elemento de la pantalla sobre el que pasa (la tarea que se completó, la tarjeta que aparece…). */
  elemento?: Element | null
  /** Texto corto opcional (por ejemplo, el nombre del logro). */
  texto?: string
}

export type Efecto = (detalle: DetalleEvento) => void
export type Efectos = Record<Exclude<NombreEvento, EventoNuevo>, Efecto> & Partial<Record<EventoNuevo, Efecto>>

const porTema = new Map<string, Efectos>()
const oyentes = new Set<(evento: NombreEvento, detalle: DetalleEvento) => void>()
let temaActual = 'shinobi'

/** Cada tema registra sus efectos una vez (ver `registro.ts`). */
export function registrarEfectos(temaId: string, efectos: Efectos): void {
  porTema.set(temaId, efectos)
}

/** Qué tema decide cómo se ven los eventos. */
export function fijarTemaEfectos(temaId: string): void {
  temaActual = temaId
}

export function temaDeEfectos(): string {
  return temaActual
}

/** Avisar que algo pasó. El tema activo lo muestra; quien escuche con `alDisparar` también se entera. */
export function disparar(evento: NombreEvento, detalle: DetalleEvento = {}): void {
  for (const o of oyentes) {
    try { o(evento, detalle) } catch { /* un oyente roto no frena al resto */ }
  }
  const efectos = porTema.get(temaActual) ?? porTema.get('comun')
  const efecto = efectos?.[evento] ?? porTema.get('comun')?.[evento]
  try { efecto?.(detalle) } catch { /* una animación rota nunca rompe la app */ }
}

/** Escuchar eventos (por ejemplo, para sonidos o animaciones viejas en React). Devuelve cómo dejar de escuchar. */
export function alDisparar(fn: (evento: NombreEvento, detalle: DetalleEvento) => void): () => void {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}

/** Con «reducir movimiento» del teléfono, los efectos no se mueven. */
export function sinMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Animar con la Web Animations API, sin romper donde no existe (pruebas, navegadores viejos). */
export function animar(el: Element | null | undefined, cuadros: Keyframe[], opciones: KeyframeAnimationOptions): Animation | null {
  if (!el || sinMovimiento() || typeof (el as HTMLElement).animate !== 'function') return null
  return (el as HTMLElement).animate(cuadros, opciones)
}

// ---------- Atajos para las escenas animadas (compañero, rival, Juego, noche) ----------
/** Igual que `disparar`, sin detalle. */
export type EventoTema = NombreEvento
export function emitirEvento(evento: EventoTema): void {
  disparar(evento)
}
/** Igual que `alDisparar`, solo con el nombre del evento. */
export function alEvento(fn: (evento: EventoTema) => void): () => void {
  return alDisparar((e) => fn(e))
}
