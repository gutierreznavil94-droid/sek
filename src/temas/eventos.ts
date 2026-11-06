/**
 * Eventos genéricos que SEK dispara para el tema. SEK no anima nada: avisa qué pasó y cada tema decide qué mostrar
 * (el tema Shinobi, sus clips; uno sin clips, su versión simple). Ninguno es obligatorio: si nadie escucha, no pasa nada.
 * · aparecer: aparece el rival. · duda: tocaste «Estoy dudando». · robo: el rival se lleva XP. · alerta: se acerca algo
 *   (el rival, un horario). · pelear: batalla o minijuego. · completar: marcaste algo (festejo chico). · logro: nivel,
 *   racha, fase, récord (festejo grande). · jugar / pausa: Juego. · dormir: te vas a dormir. · descanso / quieto: calma.
 */
export type EventoTema = 'aparecer' | 'duda' | 'robo' | 'alerta' | 'pelear' | 'completar' | 'logro' | 'jugar' | 'pausa' | 'dormir' | 'descanso' | 'quieto'

const NOMBRE = 'sek-tema'

export function emitirEvento(evento: EventoTema): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<EventoTema>(NOMBRE, { detail: evento }))
}

/** Escucha los eventos del tema. Devuelve con qué dejar de escuchar. */
export function alEvento(fn: (e: EventoTema) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const oyente = (ev: Event) => fn((ev as CustomEvent<EventoTema>).detail)
  window.addEventListener(NOMBRE, oyente)
  return () => window.removeEventListener(NOMBRE, oyente)
}
