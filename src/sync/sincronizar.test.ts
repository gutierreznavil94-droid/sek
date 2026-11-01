import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db, usarBaseDePruebas } from '../data/db'

// Nube falsa en memoria: una fila por usuario, como la tabla `respaldo`.
const nube: { fila: { datos: unknown; actualizado: number; dispositivo: string } | null; subidas: number } = { fila: null, subidas: 0 }
let alCambiarSesion: ((e: string, s: unknown) => void) | null = null
const sesionFalsa = { user: { id: 'u1', email: 'navil@ejemplo.com' } }

vi.mock('./config', () => ({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_CLAVE_PUBLICA: 'clave', SINCRONIZACION_CONFIGURADA: true }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (f: (e: string, s: unknown) => void) => { alCambiarSesion = f; return { data: { subscription: { unsubscribe() {} } } } },
      signInWithPassword: async () => { alCambiarSesion?.('SIGNED_IN', sesionFalsa); return { data: { session: sesionFalsa }, error: null } },
      signUp: async () => { alCambiarSesion?.('SIGNED_IN', sesionFalsa); return { data: { session: sesionFalsa }, error: null } },
      signOut: async () => { alCambiarSesion?.('SIGNED_OUT', null); return { error: null } },
    },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: nube.fila ? structuredClone(nube.fila) : null, error: null }) }),
      upsert: async (f: { datos: unknown; actualizado: number; dispositivo: string }) => { nube.fila = structuredClone(f); nube.subidas++; return { error: null } },
    }),
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: async () => {},
  }),
}))

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  localStorage.clear()
  await usarBaseDePruebas('sync-prueba')
})
afterAll(() => { localStorage.clear() })

describe('sincronización', () => {
  it('nube vacía: al crear la cuenta se suben los datos de este dispositivo', async () => {
    const s = await import('./sincronizar')
    await db().feriados.put({ fecha: '2026-12-25', nombre: 'Navidad' } as never)
    await s.iniciarSincronizacion()
    await s.crearCuenta('navil@ejemplo.com', 'secreta1')
    await s.sincronizar()
    expect(nube.subidas).toBe(1)
    expect((nube.fila!.datos as { tablas: Record<string, unknown[]> }).tablas.feriados).toHaveLength(1)
    expect(s.estadoSync().conectado).toBe(true)
  })

  it('un cambio local se sube solo a los pocos segundos', async () => {
    await db().feriados.put({ fecha: '2026-01-01', nombre: 'Año nuevo' } as never)
    await esperar(3200)
    expect(nube.subidas).toBe(2)
    expect((nube.fila!.datos as { tablas: Record<string, unknown[]> }).tablas.feriados).toHaveLength(2)
  }, 8000)

  it('si otro dispositivo guardó algo más nuevo, se baja y reemplaza lo local (sin volver a subirlo)', async () => {
    const s = await import('./sincronizar')
    const tablas = structuredClone((nube.fila!.datos as { tablas: Record<string, unknown[]> }).tablas)
    tablas.feriados = [{ fecha: '2026-05-25', nombre: 'Revolución de Mayo' }]
    nube.fila = { datos: { app: 'sistema-progreso', version: 1, tablas }, actualizado: Date.now() + 1000, dispositivo: 'celu-otro' }
    const subidasAntes = nube.subidas
    await s.sincronizar()
    const locales = await db().feriados.toArray()
    expect(locales.map((f) => f.fecha)).toEqual(['2026-05-25'])
    await esperar(3000)
    expect(nube.subidas).toBe(subidasAntes)
  }, 8000)

  it('al entrar en un dispositivo nuevo, la nube reemplaza lo local', async () => {
    const s = await import('./sincronizar')
    await s.salir()
    await db().feriados.clear()
    await db().feriados.put({ fecha: '2030-01-01', nombre: 'Local' } as never)
    await s.entrar('navil@ejemplo.com', 'secreta1')
    await s.sincronizar()
    const locales = await db().feriados.toArray()
    expect(locales.map((f) => f.fecha)).toEqual(['2026-05-25'])
  }, 8000)
})
