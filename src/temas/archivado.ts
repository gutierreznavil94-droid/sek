/**
 * Archivado (v0.86, pedido de Navil): partes que se esconden por ahora sin borrarlas. El código, los clips y las
 * pruebas quedan; el interruptor está en el `tema.json` («archivado»: { «rival»: true }).
 * - rival: «Dudo», el rival que se mete en Hoy (asoma, corre, salta, roba y la alerta al aparecer), la escena del
 *   duelo con personajes y la línea de Ninjas vencidos. Tensión y «No cumplí» siguen pidiendo sus flexiones en
 *   una pantalla simple.
 */
import { temaActivo } from './temas'

export type Archivado = { rival?: boolean }
let forzado: Archivado | null = null

/** ¿El rival (y todo lo suyo) está archivado en el tema activo? */
export function rivalArchivado(): boolean {
  return (forzado ?? temaActivo().archivado ?? {}).rival === true
}

/** Para las pruebas (y para retomarlo): pisa lo del tema. `null` vuelve a lo del tema. */
export function forzarArchivado(a: Archivado | null): void {
  forzado = a
}
