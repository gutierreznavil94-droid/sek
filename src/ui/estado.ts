/**
 * Estado mínimo de la interfaz: un contador de versión que se incrementa
 * tras cada cambio en la base, y un hook para cargar datos que se vuelve a
 * ejecutar con cada versión, al volver a primer plano y al pasar la medianoche.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

let version = 0
const oyentes = new Set<() => void>()

export function notificarCambio(): void {
  version++
  for (const o of oyentes) o()
}

function suscribir(o: () => void): () => void {
  oyentes.add(o)
  return () => oyentes.delete(o)
}

export function useVersion(): number {
  return useSyncExternalStore(suscribir, () => version)
}

export type Carga<T> = { datos: T | null; cargando: boolean; error: string | null; recargar: () => void }

/** Carga datos asíncronos y los recarga cuando la base cambia. */
export function useDatos<T>(cargar: () => Promise<T>, deps: unknown[] = []): Carga<T> {
  const v = useVersion()
  const [estado, setEstado] = useState<{ datos: T | null; cargando: boolean; error: string | null }>({ datos: null, cargando: true, error: null })
  const [tic, setTic] = useState(0)
  const ultimo = useRef(0)
  useEffect(() => {
    const n = ++ultimo.current
    let activo = true
    cargar()
      .then((datos) => {
        if (activo && n === ultimo.current) setEstado({ datos, cargando: false, error: null })
      })
      .catch((e) => {
        if (activo && n === ultimo.current) setEstado((s) => ({ datos: s.datos, cargando: false, error: e instanceof Error ? e.message : String(e) }))
      })
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, tic, ...deps])
  const recargar = useCallback(() => setTic((t) => t + 1), [])
  return { ...estado, recargar }
}

/** Ejecuta una mutación y avisa a toda la interfaz. */
export async function mutar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } finally {
    notificarCambio()
  }
}

// ---------- Avisos flotantes ----------

export type Aviso = { id: number; texto: string; tipo?: 'ok' | 'bajo' | 'normal'; accion?: { texto: string; fn: () => void }; duracionMs?: number }

let avisos: Aviso[] = []
const oyentesAvisos = new Set<() => void>()
let idAviso = 0

export function avisar(texto: string, opciones: Omit<Aviso, 'id' | 'texto'> = {}): void {
  const a: Aviso = { id: ++idAviso, texto, ...opciones }
  avisos = [...avisos, a]
  for (const o of oyentesAvisos) o()
  setTimeout(() => quitarAviso(a.id), opciones.duracionMs ?? (opciones.accion ? 10_000 : 3_500))
}

export function quitarAviso(id: number): void {
  if (!avisos.some((a) => a.id === id)) return
  avisos = avisos.filter((a) => a.id !== id)
  for (const o of oyentesAvisos) o()
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (o) => {
      oyentesAvisos.add(o)
      return () => oyentesAvisos.delete(o)
    },
    () => avisos,
  )
}

/** Reloj de interfaz: se actualiza cada `ms` para temporizadores y cuentas. */
export function useTic(ms: number): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return t
}
