/**
 * La ÚNICA parte de Organización que guarda y lee. La app madre le pasa una:
 * en SEK usa la base local del teléfono (Dexie); en Tumi se cambiará por su servidor.
 */
import type { DatosOrganizacion } from './tipos'

export interface Almacen {
  /** Lo guardado, o null si todavía no hay nada. Organización lo valida y migra. */
  leer(): Promise<unknown>
  guardar(datos: DatosOrganizacion): Promise<void>
}

/** Almacén en memoria (pruebas y vista previa). */
export function almacenEnMemoria(inicial: unknown = null): Almacen & { actual(): unknown } {
  let datos: unknown = inicial
  return {
    async leer() { return datos === null ? null : JSON.parse(JSON.stringify(datos)) },
    async guardar(d) { datos = JSON.parse(JSON.stringify(d)) },
    actual: () => datos,
  }
}
