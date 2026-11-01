/**
 * Instalación como app (PWA). En Android/Chrome el navegador avisa con
 * `beforeinstallprompt`; en iPhone no existe y hay que explicar los pasos.
 * No se simula nada: si no se puede instalar, no se ofrece.
 */

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let evento: EventoInstalar | null = null
const oyentes = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    evento = e as EventoInstalar
    for (const o of oyentes) o()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    for (const o of oyentes) o()
  })
}

export function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function esIphone(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

/** Dentro de un visor embebido (iframe, como el link de prueba) el navegador no deja instalar. */
export function enVisorEmbebido(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.self !== window.top } catch { return true }
}

export type EstadoInstalacion = 'instalada' | 'disponible' | 'iphone' | 'no_disponible'

export function estadoInstalacion(): EstadoInstalacion {
  if (yaInstalada()) return 'instalada'
  if (evento) return 'disponible'
  if (esIphone() && !enVisorEmbebido()) return 'iphone'
  return 'no_disponible'
}

export async function instalar(): Promise<'accepted' | 'dismissed' | 'sin_aviso'> {
  if (!evento) return 'sin_aviso'
  await evento.prompt()
  const r = await evento.userChoice
  if (r.outcome === 'accepted') evento = null
  for (const o of oyentes) o()
  return r.outcome
}

export function alCambiarInstalacion(o: () => void): () => void {
  oyentes.add(o)
  return () => oyentes.delete(o)
}
