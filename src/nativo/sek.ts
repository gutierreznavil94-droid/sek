/**
 * Puente con la parte Android de SEK (plugin «Sek» en android/app/src/main/java/ar/sek/app/SekPlugin.java).
 * En la web no hace nada: cada función devuelve un valor neutro.
 *
 * - Widgets: la app les pasa los datos del día (JSON) y lee lo que se marcó desde el widget con la app cerrada.
 * - Accesos directos: la ruta pedida al abrir desde un acceso directo («Dejo celu», «+1 vaso»…).
 * - Actualización: baja el APK nuevo y abre el instalador de Android.
 */
import { registerPlugin } from '@capacitor/core'

/** Algo que se tocó en el widget con la app cerrada. */
export type AccionWidget = { tipo: 'pilar'; id: string; instante: number } | { tipo: 'vaso'; instante: number } | { tipo: 'fruta'; instante: number }

type PluginSek = {
  guardarWidget(o: { datos: string }): Promise<void>
  leerPendientes(): Promise<{ acciones: string }>
  rutaPendiente(): Promise<{ ruta: string | null }>
  version(): Promise<{ nombre: string; codigo: number }>
  puedeInstalar(): Promise<{ puede: boolean }>
  pedirPermisoInstalar(): Promise<void>
  descargarEInstalar(o: { url: string }): Promise<void>
}

const Sek = registerPlugin<PluginSek>('Sek')

export function esAndroid(): boolean {
  const w = globalThis as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
  try {
    return !!w.Capacitor?.isNativePlatform?.() && w.Capacitor?.getPlatform?.() === 'android'
  } catch {
    return false
  }
}

export async function guardarDatosWidget(datos: unknown): Promise<void> {
  if (!esAndroid()) return
  await Sek.guardarWidget({ datos: JSON.stringify(datos) }).catch(() => {})
}

/** Lo marcado en el widget desde la última vez (se vacía al leerlo). */
export async function leerAccionesWidget(): Promise<AccionWidget[]> {
  if (!esAndroid()) return []
  try {
    const { acciones } = await Sek.leerPendientes()
    const lista = JSON.parse(acciones || '[]') as AccionWidget[]
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

/** Ruta de un acceso directo (se vacía al leerla), por ejemplo «/?atajo=vaso». */
export async function rutaDeAtajo(): Promise<string | null> {
  if (!esAndroid()) return null
  try { return (await Sek.rutaPendiente()).ruta } catch { return null }
}

export async function puedeInstalar(): Promise<boolean> {
  if (!esAndroid()) return false
  try { return (await Sek.puedeInstalar()).puede } catch { return false }
}

export async function pedirPermisoInstalar(): Promise<void> {
  if (esAndroid()) await Sek.pedirPermisoInstalar().catch(() => {})
}

export async function descargarEInstalar(url: string): Promise<void> {
  if (!esAndroid()) { window.open(url, '_blank'); return }
  await Sek.descargarEInstalar({ url })
}
