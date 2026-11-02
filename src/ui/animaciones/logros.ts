/**
 * Cuándo se dispara cada animación. Siempre se llama DESPUÉS de guardar el
 * registro: la animación solo se muestra, no cambia XP ni datos.
 */
import { animar, configuracionAnimaciones } from './motor'

function unaVez(clave: string): boolean {
  try {
    if (localStorage.getItem(clave)) return false
    localStorage.setItem(clave, '1')
  } catch {
    // Sin almacenamiento: se muestra igual.
  }
  return true
}

/** Pilar cumplido: ejecución; si además subió de nivel, el logro grande después. */
export function celebrarPilar(pilar: string, nuevoNivel: number | null): { nivelMostrado: boolean } {
  animar({ tipo: 'ejecucion', pilar })
  return celebrarNivel(nuevoNivel)
}

/** Subir de nivel: logro grande. Devuelve si se mostró (si no, la app muestra su aviso de siempre). */
export function celebrarNivel(nuevoNivel: number | null): { nivelMostrado: boolean } {
  if (!nuevoNivel) return { nivelMostrado: false }
  return { nivelMostrado: animar({ tipo: 'logro', clase: 'nivel', texto: `Nivel ${nuevoNivel}`, sub: '昇 · ascender' }) }
}

/** Racha múltiplo de 7: una sola vez por día. */
export function celebrarRacha(racha: number, hoy: string): void {
  if (racha < 7 || racha % 7 !== 0) return
  if (configuracionAnimaciones().modo === 'ninguna') return
  if (!unaVez(`anim-racha-${hoy}`)) return
  animar({ tipo: 'logro', clase: 'racha', texto: `${racha} días seguidos`, sub: '連 · racha' })
}

/** Primer día de una fase nueva (2 o 3): una sola vez. */
export function celebrarFase(numero: number, nombre: string | undefined, cicloId: string): void {
  if (numero < 2) return
  if (configuracionAnimaciones().modo === 'ninguna') return
  if (!unaVez(`anim-fase-${cicloId}-${numero}`)) return
  animar({ tipo: 'logro', clase: 'fase', texto: `Fase ${numero}`, sub: nombre ? `段 · ${nombre}` : '段 · nueva etapa' })
}

/** Récord personal en un ejercicio (al terminar el entreno). Uno solo, aunque haya varios. */
export function celebrarRecord(ejercicios: string[]): void {
  if (!ejercicios.length) return
  const texto = ejercicios.length === 1 ? `Récord · ${ejercicios[0]}` : `${ejercicios.length} récords`
  animar({ tipo: 'logro', clase: 'record', texto, sub: '力 · fuerza' })
}
