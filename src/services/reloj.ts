/**
 * Reloj inyectable: toda la app pide la hora aquí, así las pruebas pueden
 * "viajar en el tiempo" (por ejemplo, cruzar la medianoche).
 */

let desfase = 0
let fijo: number | null = null

export function ahora(): number {
  return fijo ?? Date.now() + desfase
}

export function fijarAhora(instante: number | null): void {
  fijo = instante
}

export function avanzar(ms: number): void {
  if (fijo !== null) fijo += ms
  else desfase += ms
}

export function reiniciarReloj(): void {
  fijo = null
  desfase = 0
}

export function nuevoId(prefijo = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefijo ? `${prefijo}_${r}` : r
}
