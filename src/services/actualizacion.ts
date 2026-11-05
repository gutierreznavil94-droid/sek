/**
 * «Buscar actualización» (app Android): mira el último Release del repo en GitHub y lo compara con la versión
 * que trae la app. Si hay una nueva, la app la baja y abre el instalador de Android (se instala encima y los
 * datos quedan). Al abrir la app se revisa sola una vez por día.
 */
import { VERSION_APP } from '../version'

export const REPO = 'gutierreznavil94-droid/sek'
export const LINK_APK = `https://github.com/${REPO}/releases/latest/download/sek.apk`
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const CLAVE_DIA = 'sek-actualizacion-revisada'

export type Novedad = { version: string; notas: string; url: string }

/** Compara «0.52» con «0.60» o «1.0»: >0 si a es más nueva. */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string) => v.replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  const x = partes(a), y = partes(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** Lo que cambió, en pocas líneas (el texto del Release sin el pie). */
export function notasCortas(cuerpo: string, max = 6): string {
  return cuerpo
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('🤖') && !l.includes('claude.ai') && !/^(Co-Authored-By|Claude-Session)/i.test(l))
    .slice(0, max)
    .join('\n')
}

/** Devuelve la versión nueva, o null si la app ya está al día. Tira error si no hay internet. */
export async function buscarActualizacion(actual = VERSION_APP, pedir: typeof fetch = fetch): Promise<Novedad | null> {
  const r = await pedir(API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}`)
  const j = (await r.json()) as { tag_name?: string; body?: string; assets?: { name: string; browser_download_url: string }[] }
  const version = (j.tag_name ?? '').replace(/^v/i, '')
  if (!version || compararVersiones(version, actual) <= 0) return null
  const apk = j.assets?.find((a) => a.name === 'sek.apk')
  return { version, notas: notasCortas(j.body ?? ''), url: apk?.browser_download_url ?? LINK_APK }
}

/** ¿Toca revisar hoy? (una vez por día, guardado en el teléfono). */
export function tocaRevisarHoy(hoy: string): boolean {
  try {
    if (localStorage.getItem(CLAVE_DIA) === hoy) return false
    localStorage.setItem(CLAVE_DIA, hoy)
    return true
  } catch {
    return false
  }
}
