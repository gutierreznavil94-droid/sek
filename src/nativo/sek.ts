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
  guardarTema(o: { tema: string }): Promise<void>
  leerPendientes(): Promise<{ acciones: string }>
  rutaPendiente(): Promise<{ ruta: string | null }>
  version(): Promise<{ nombre: string; codigo: number }>
  puedeInstalar(): Promise<{ puede: boolean }>
  pedirPermisoInstalar(): Promise<void>
  descargarEInstalar(o: { url: string }): Promise<void>
  programarAlarma(o: AlarmaNativa): Promise<void>
  cancelarAlarma(o: { id: string }): Promise<void>
  cancelarAlarmas(o: { prefijo: string }): Promise<void>
  listarAlarmas(): Promise<{ alarmas: string }>
  probarAlarma(o: { segundos: number; sonido: string; vibrar: boolean }): Promise<void>
  estadoAlarmas(): Promise<{ exactas: boolean; pantallaCompleta: boolean }>
  abrirAjusteAlarmas(o: { cual: 'exactas' | 'pantalla' }): Promise<void>
  elegirTono(): Promise<{ uri: string | null; nombre: string }>
}

/** Alarma real de Android: suena y vibra con pantalla completa hasta «Apagar» o «Posponer 5 min». */
export type AlarmaNativa = { id: string; instante: number; titulo: string; cuerpo: string; vibrar: boolean; sonido: string }

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

/** Imágenes del tema para los widgets y la alarma. Se mandan solo cuando cambia el tema (pesan). */
export async function guardarTemaNativo(tema: { id: string; fondos: string[]; alarma?: string }): Promise<void> {
  if (!esAndroid()) return
  const marca = `${tema.id}:${tema.fondos.length}:${tema.fondos.reduce((n, f) => n + f.length, 0)}:${tema.alarma?.length ?? 0}`
  try { if (localStorage.getItem('temaNativo') === marca) return } catch { /* sin memoria: se manda igual */ }
  await Sek.guardarTema({ tema: JSON.stringify(tema) }).catch(() => {})
  try { localStorage.setItem('temaNativo', marca) } catch { /* nada */ }
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

// ---------- Alarmas reales ----------

export async function programarAlarmaNativa(a: AlarmaNativa): Promise<void> {
  if (esAndroid()) await Sek.programarAlarma(a)
}

export async function cancelarAlarmaNativa(id: string): Promise<void> {
  if (esAndroid()) await Sek.cancelarAlarma({ id }).catch(() => {})
}

export async function cancelarAlarmasNativas(prefijo = ''): Promise<void> {
  if (esAndroid()) await Sek.cancelarAlarmas({ prefijo }).catch(() => {})
}

/** Las alarmas reales programadas ahora mismo. */
export async function alarmasNativas(): Promise<AlarmaNativa[]> {
  if (!esAndroid()) return []
  try {
    const lista = JSON.parse((await Sek.listarAlarmas()).alarmas || '[]') as AlarmaNativa[]
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

/** Hace sonar una alarma de prueba dentro de unos segundos (para escuchar el tono con la pantalla apagada). */
export async function probarAlarma(segundos: number, sonido: string, vibrar: boolean): Promise<boolean> {
  if (!esAndroid()) return false
  try { await Sek.probarAlarma({ segundos, sonido, vibrar }); return true } catch { return false }
}

/** Permisos que necesita la alarma real: alarmas exactas y pantalla completa (Android 14+). */
export async function estadoAlarmasNativas(): Promise<{ exactas: boolean; pantallaCompleta: boolean } | null> {
  if (!esAndroid()) return null
  try { return await Sek.estadoAlarmas() } catch { return null }
}

export async function abrirAjusteAlarmas(cual: 'exactas' | 'pantalla'): Promise<void> {
  if (esAndroid()) await Sek.abrirAjusteAlarmas({ cual }).catch(() => {})
}

/** Abre el selector de tonos de Android. Devuelve null si se canceló. */
export async function elegirTonoDelCelu(): Promise<{ uri: string; nombre: string } | null> {
  if (!esAndroid()) return null
  try {
    const r = await Sek.elegirTono()
    return r.uri ? { uri: r.uri, nombre: r.nombre } : null
  } catch {
    return null
  }
}
