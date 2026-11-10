/**
 * «Apps que te atrapan»: al volver desde la otra app, el 3·2·1 de Hoy brilla con íconos del tema
 * (en el centro, más grande) para que lo toques y arranques. Dura 3 minutos o hasta tocarlo.
 */
import { useEffect, useState } from 'react'

const CLAVE = 'llamado-321'
const DURA_MS = 3 * 60_000
const oyentes = new Set<() => void>()

function activo(): boolean {
  try { return Date.now() - Number(localStorage.getItem(CLAVE) ?? 0) < DURA_MS } catch { return false }
}

export function pedirLlamado321(): void {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin memoria */ }
  for (const o of oyentes) o()
}

export function apagarLlamado321(): void {
  try { localStorage.removeItem(CLAVE) } catch { /* sin memoria */ }
  for (const o of oyentes) o()
}

export function useLlamado321(): boolean {
  const [v, setV] = useState(activo)
  useEffect(() => {
    const o = () => setV(activo())
    oyentes.add(o)
    const id = window.setInterval(o, 15_000)
    return () => { oyentes.delete(o); window.clearInterval(id) }
  }, [])
  return v
}
