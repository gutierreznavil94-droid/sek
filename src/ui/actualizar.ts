import { descargarEInstalar, pedirPermisoInstalar, puedeInstalar } from '../nativo/sek'
import type { Novedad } from '../services/actualizacion'
import { avisar } from './estado'

/**
 * Baja el APK nuevo y abre el instalador de Android. La primera vez Android pide «instalar apps desconocidas»:
 * se abre ese ajuste y, al volver, se toca «Actualizar» de nuevo.
 */
export async function instalarActualizacion(n: Novedad): Promise<boolean> {
  if (!(await puedeInstalar())) {
    avisar('Android va a pedir permiso para instalar la versión nueva: activá «Permitir de esta fuente», volvé y tocá «Bajar e instalar» otra vez.', { duracionMs: 12_000 })
    await pedirPermisoInstalar()
    return false
  }
  avisar(`Bajando la v${n.version}…`, { duracionMs: 8_000 })
  try {
    await descargarEInstalar(n.url)
    return true
  } catch (e) {
    avisar(`No se pudo bajar: ${e instanceof Error ? e.message : String(e)}`, { tipo: 'bajo' })
    return false
  }
}
