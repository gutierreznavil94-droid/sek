/**
 * Sincronización entre dispositivos con Supabase.
 *
 * Idea simple y robusta: cada usuario tiene UNA fila en la tabla `respaldo` con
 * la copia completa de sus datos (las mismas tablas que «Copia de seguridad»).
 * - Al cambiar algo acá, a los pocos segundos se sube la copia entera.
 * - Cuando otro dispositivo sube algo, Supabase avisa al instante y acá se
 *   baja y reemplaza lo local.
 * - Si los dos cambiaron sin conexión, gana el cambio más nuevo.
 * - La primera vez que un dispositivo entra a la cuenta: si la nube ya tiene
 *   datos, se usan esos (reemplazan lo local); si está vacía, se suben los de acá.
 *
 * En «modo prueba» no se sincroniza nada.
 */

import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js'
import { db, TABLAS } from '../data/db'
import { enModoPrueba } from '../data/modoPrueba'
import { notificarCambio } from '../ui/estado'
import { SINCRONIZACION_CONFIGURADA, SUPABASE_CLAVE_PUBLICA, SUPABASE_URL } from './config'

export type EstadoSync = {
  configurada: boolean
  conectado: boolean
  email: string | null
  /** 'ok' al día, 'subiendo', 'bajando', 'sin-conexion', 'error' */
  fase: 'apagada' | 'ok' | 'subiendo' | 'bajando' | 'sin-conexion' | 'error'
  ultima: number | null
  error: string | null
}

const CLAVE_VISTO = 'sek.sync.visto' // `actualizado` de la última copia que este dispositivo subió o bajó
const CLAVE_SUCIO = 'sek.sync.sucio' // instante del último cambio local sin subir (0 = nada pendiente)
const CLAVE_DISPOSITIVO = 'sek.sync.dispositivo'
const ESPERA_SUBIDA_MS = 2500

let cliente: SupabaseClient | null = null
let canal: RealtimeChannel | null = null
let sesion: Session | null = null
let aplicando = false
let temporizador: ReturnType<typeof setTimeout> | null = null
let enCurso: Promise<void> | null = null
let ganchosPuestos = false

let estado: EstadoSync = { configurada: SINCRONIZACION_CONFIGURADA, conectado: false, email: null, fase: 'apagada', ultima: null, error: null }
const oyentes = new Set<() => void>()
function cambiarEstado(p: Partial<EstadoSync>): void {
  estado = { ...estado, ...p }
  for (const o of oyentes) o()
}
export function estadoSync(): EstadoSync { return estado }
export function alCambiarSync(o: () => void): () => void { oyentes.add(o); return () => { oyentes.delete(o) } }

function leerNum(clave: string): number {
  try { return Number(localStorage.getItem(clave) ?? '0') || 0 } catch { return 0 }
}
function guardarNum(clave: string, n: number): void {
  try { localStorage.setItem(clave, String(n)) } catch { /* sin almacenamiento */ }
}
function dispositivo(): string {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO)
    if (!id) {
      const tipo = /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'celu' : 'compu'
      id = `${tipo}-${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem(CLAVE_DISPOSITIVO, id)
    }
    return id
  } catch { return 'desconocido' }
}

async function obtenerCliente(): Promise<SupabaseClient | null> {
  if (!SINCRONIZACION_CONFIGURADA || enModoPrueba()) return null
  if (!cliente) {
    const { createClient } = await import('@supabase/supabase-js')
    cliente = createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sek-sesion' },
    })
  }
  return cliente
}

// ---------- Copia local sin efectos secundarios ----------

type Instantanea = { app: 'sistema-progreso'; version: 1; tablas: Record<string, unknown[]> }

async function leerTodo(): Promise<Instantanea> {
  const d = db()
  const tablas: Record<string, unknown[]> = {}
  await d.transaction('r', d.tables, async () => {
    for (const nombre of TABLAS) tablas[nombre] = await d.table(nombre).toArray()
  })
  return { app: 'sistema-progreso', version: 1, tablas }
}

async function reemplazarTodo(datos: Instantanea): Promise<void> {
  const d = db()
  aplicando = true
  try {
    await d.transaction('rw', d.tables, async () => {
      for (const nombre of TABLAS) {
        const t = d.table(nombre)
        await t.clear()
        const lista = datos.tablas?.[nombre]
        if (Array.isArray(lista) && lista.length) await t.bulkPut(lista)
      }
    })
  } finally {
    aplicando = false
  }
  notificarCambio()
}

// ---------- Detectar cambios locales ----------

function marcarSucio(): void {
  if (aplicando || !sesion) return
  if (!leerNum(CLAVE_SUCIO)) guardarNum(CLAVE_SUCIO, Date.now())
  else guardarNum(CLAVE_SUCIO, Date.now())
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => { temporizador = null; void sincronizar() }, ESPERA_SUBIDA_MS)
}

function ponerGanchos(): void {
  if (ganchosPuestos) return
  ganchosPuestos = true
  const d = db()
  for (const nombre of TABLAS) {
    const t = d.table(nombre)
    // Los ganchos corren dentro de la transacción: solo anotan que hay algo para subir.
    t.hook('creating', () => { marcarSucio() })
    t.hook('updating', () => { marcarSucio() })
    t.hook('deleting', () => { marcarSucio() })
  }
}

// ---------- Subir y bajar ----------

type Fila = { datos: Instantanea; actualizado: number; dispositivo: string | null }

async function leerNube(c: SupabaseClient, conDatos: boolean): Promise<Fila | null> {
  const { data, error } = await c.from('respaldo').select(conDatos ? 'datos, actualizado, dispositivo' : 'actualizado, dispositivo').maybeSingle()
  if (error) throw error
  return (data as Fila | null) ?? null
}

async function subir(c: SupabaseClient): Promise<void> {
  cambiarEstado({ fase: 'subiendo' })
  const sucioAntes = leerNum(CLAVE_SUCIO)
  const datos = await leerTodo()
  const actualizado = Math.max(Date.now(), leerNum(CLAVE_VISTO) + 1)
  const { error } = await c.from('respaldo').upsert({ usuario: sesion!.user.id, datos, actualizado, dispositivo: dispositivo() })
  if (error) throw error
  guardarNum(CLAVE_VISTO, actualizado)
  // Si hubo otro cambio mientras subía, queda pendiente para la próxima.
  if (leerNum(CLAVE_SUCIO) === sucioAntes) guardarNum(CLAVE_SUCIO, 0)
}

async function bajar(c: SupabaseClient): Promise<void> {
  cambiarEstado({ fase: 'bajando' })
  const fila = await leerNube(c, true)
  if (!fila) return
  await reemplazarTodo(fila.datos)
  guardarNum(CLAVE_VISTO, fila.actualizado)
  guardarNum(CLAVE_SUCIO, 0)
}

async function pasoSincronizar(): Promise<void> {
  const c = await obtenerCliente()
  if (!c || !sesion) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { cambiarEstado({ fase: 'sin-conexion' }); return }
  try {
    const nube = await leerNube(c, false)
    const visto = leerNum(CLAVE_VISTO)
    const sucio = leerNum(CLAVE_SUCIO)
    if (!nube) {
      await subir(c) // nube vacía: se suben los datos de este dispositivo
    } else if (visto === 0) {
      await bajar(c) // primera vez en este dispositivo: manda la nube
    } else if (nube.actualizado > visto) {
      // Otro dispositivo guardó algo nuevo.
      if (sucio && sucio > nube.actualizado) await subir(c) // lo de acá es más nuevo
      else await bajar(c)
    } else if (sucio) {
      await subir(c)
    }
    cambiarEstado({ fase: 'ok', ultima: Date.now(), error: null })
  } catch (e) {
    const texto = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
    cambiarEstado({ fase: navigator.onLine === false ? 'sin-conexion' : 'error', error: texto })
  }
}

/** Sincroniza ahora (si ya hay una en curso, espera a esa y hace otra). */
export async function sincronizar(): Promise<void> {
  while (enCurso) await enCurso
  enCurso = pasoSincronizar().finally(() => { enCurso = null })
  await enCurso
}

function escucharNube(c: SupabaseClient): void {
  if (canal || !sesion) return
  canal = c
    .channel('respaldo-' + sesion.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'respaldo', filter: `usuario=eq.${sesion.user.id}` }, (p) => {
      const n = (p.new as { actualizado?: number } | null)?.actualizado
      if (n && n > leerNum(CLAVE_VISTO)) void sincronizar()
    })
    .subscribe()
}

function dejarDeEscuchar(): void {
  if (canal && cliente) void cliente.removeChannel(canal)
  canal = null
}

function aplicarSesion(s: Session | null): void {
  const antes = sesion?.user.id
  sesion = s
  cambiarEstado({ conectado: !!s, email: s?.user.email ?? null, fase: s ? estado.fase === 'apagada' ? 'ok' : estado.fase : 'apagada' })
  if (s && cliente) {
    ponerGanchos()
    escucharNube(cliente)
    if (antes !== s.user.id) void sincronizar()
  } else {
    dejarDeEscuchar()
  }
}

/** Se llama una vez al abrir la app. */
export async function iniciarSincronizacion(): Promise<void> {
  const c = await obtenerCliente()
  if (!c) return
  const { data } = await c.auth.getSession()
  aplicarSesion(data.session)
  c.auth.onAuthStateChange((_e, s) => aplicarSesion(s))
  const alVolver = () => { if (document.visibilityState === 'visible') void sincronizar() }
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('online', () => void sincronizar())
  window.addEventListener('focus', () => void sincronizar())
}

function traducir(e: { message?: string } | null): string {
  const m = e?.message ?? ''
  if (/Invalid login credentials/i.test(m)) return 'Mail o contraseña incorrectos.'
  if (/already registered|already been registered/i.test(m)) return 'Ese mail ya tiene cuenta: tocá «Entrar».'
  if (/Password should be at least/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (/Email not confirmed/i.test(m)) return 'Falta confirmar el mail (revisá tu correo) o apagar «Confirm email» en Supabase.'
  if (/valid email|invalid format/i.test(m)) return 'Revisá el mail.'
  if (/fetch|network/i.test(m)) return 'Sin conexión. Probá de nuevo.'
  return m || 'No se pudo.'
}

export async function crearCuenta(email: string, clave: string): Promise<void> {
  const c = await obtenerCliente()
  if (!c) throw new Error('La sincronización no está configurada.')
  guardarNum(CLAVE_VISTO, 0)
  const { data, error } = await c.auth.signUp({ email: email.trim(), password: clave })
  if (error) throw new Error(traducir(error))
  if (!data.session) throw new Error('Cuenta creada. Confirmá el mail desde tu correo y después tocá «Entrar».')
}

export async function entrar(email: string, clave: string): Promise<void> {
  const c = await obtenerCliente()
  if (!c) throw new Error('La sincronización no está configurada.')
  guardarNum(CLAVE_VISTO, 0)
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password: clave })
  if (error) throw new Error(traducir(error))
}

/** Sale de la cuenta en este dispositivo. Los datos quedan acá y en la nube. */
export async function salir(): Promise<void> {
  const c = await obtenerCliente()
  if (!c) return
  if (leerNum(CLAVE_SUCIO)) await sincronizar()
  await c.auth.signOut()
  guardarNum(CLAVE_VISTO, 0)
  guardarNum(CLAVE_SUCIO, 0)
}
