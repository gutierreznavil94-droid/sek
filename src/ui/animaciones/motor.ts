/**
 * Motor de animaciones de logro: una cola mínima fuera de React, para poder
 * llamar `animar(...)` desde cualquier botón después de guardar el registro.
 * Las animaciones nunca bloquean ni cambian datos: solo se muestran.
 */

import { useSyncExternalStore } from 'react'

export type PilarAnim = 'entrenamiento' | 'empresa' | 'manga' | 'acostarse'
export type EstiloCorte = 'horizontal' | 'diagonal' | 'ascendente' | 'estocada' | 'vertical'

export type Animacion =
  | { tipo: 'ejecucion'; pilar: string; estilo?: EstiloCorte }
  | { tipo: 'parry'; nombre?: string; /** La versión anterior (muñeco SVG), guardada para volver. */ vieja?: boolean }
  | { tipo: 'postura'; modo: '321' | 'siguiente' }
  | { tipo: 'logro'; clase: 'nivel' | 'racha' | 'fase' | 'record'; texto: string; sub?: string }

export type ModoAnimaciones = 'todas' | 'logros' | 'ninguna'

/** Duración máxima de cada animación (ms), según lo pedido. */
export const DURACION: Record<Animacion['tipo'], number> = {
  ejecucion: 1500,
  parry: 2875, // parry hecho con el video de Luma (69 cuadros a 24 fps)
  postura: 1200,
  logro: 2000,
}

/** Duración de una animación en particular (el parry anterior, de muñeco, dura 600 ms). */
export function duracionDe(a: Animacion): number {
  if (a.tipo === 'parry' && a.vieja) return 600
  return DURACION[a.tipo]
}

/** Kanji de cada momento (con su significado, para mostrarlo al lado). */
export const KANJI: Record<string, { k: string; significado: string }> = {
  entrenamiento: { k: '鍛', significado: 'forjar' },
  empresa: { k: '進', significado: 'avanzar' },
  manga: { k: '描', significado: 'dibujar' },
  acostarse: { k: '静', significado: 'calma' },
  meta: { k: '志', significado: 'propósito' },
  '321': { k: '始', significado: 'empezar' },
  siguiente: { k: '次', significado: 'siguiente' },
  nivel: { k: '昇', significado: 'ascender' },
  racha: { k: '連', significado: 'seguidos' },
  fase: { k: '段', significado: 'etapa' },
  record: { k: '力', significado: 'fuerza' },
  parry: { k: '忍', significado: 'perseverar' },
}

/** Corte por defecto de cada pilar; a veces sale otro al azar para que no se repita. */
const CORTE_DE_PILAR: Record<string, EstiloCorte> = {
  entrenamiento: 'horizontal',
  empresa: 'estocada',
  manga: 'ascendente',
  acostarse: 'diagonal',
  meta: 'vertical',
}
const CORTES: EstiloCorte[] = ['horizontal', 'diagonal', 'ascendente', 'estocada', 'vertical']

export function nombreDePilar(id: string): string {
  return { entrenamiento: 'Entrenamiento', empresa: 'Avanzar en la empresa', manga: 'Dibujar manga', acostarse: 'Dormir a horario', meta: 'Meta cumplida' }[id] ?? id
}

export function elegirCorte(pilar: string, azar = Math.random): EstiloCorte {
  const base = CORTE_DE_PILAR[pilar] ?? 'diagonal'
  if (azar() < 0.65) return base
  const otros = CORTES.filter((c) => c !== base)
  return otros[Math.floor(azar() * otros.length) % otros.length]
}

type Config = { modo: ModoAnimaciones; sonido: boolean; nombre: string; lento: number; tema: 'claro' | 'oscuro'; tinta: boolean }
function leerTinta(): boolean {
  try { return localStorage.getItem('anim-tinta') !== 'no' } catch { return true }
}
let config: Config = { modo: 'todas', sonido: false, nombre: 'Shinobi', lento: 1, tema: 'claro', tinta: leerTinta() }

export function configurarAnimaciones(c: Partial<Config>): void {
  config = { ...config, ...c }
  if (c.tinta !== undefined) try { localStorage.setItem('anim-tinta', c.tinta ? 'si' : 'no') } catch { /* sin almacenamiento */ }
  avisarOyentes()
}

export function configuracionAnimaciones(): Config {
  return config
}

export type EnCurso = Animacion & { id: number; inicio: number }

let cola: EnCurso[] = []
let siguienteId = 0
const oyentes = new Set<() => void>()
function avisarOyentes() {
  for (const o of oyentes) o()
}

/** true si esta animación se mostraría con el modo actual. */
export function permitida(a: Animacion, modo: ModoAnimaciones = config.modo): boolean {
  if (modo === 'ninguna') return false
  if (modo === 'logros') return a.tipo === 'logro'
  return true
}

/**
 * Pide una animación. Devuelve false si el modo la desactiva. `forzar` la
 * muestra igual (vista previa en Más). Un parry reemplaza al parry anterior;
 * el resto espera su turno (máximo 2 en cola).
 */
export function animar(a: Animacion, opciones: { forzar?: boolean } = {}): boolean {
  if (!opciones.forzar && !permitida(a)) return false
  const nueva: EnCurso = { ...a, id: ++siguienteId, inicio: Date.now() } as EnCurso
  if (a.tipo === 'parry') {
    cola = cola.filter((x) => x.tipo !== 'parry')
    // El parry no espera: se muestra encima, sin bloquear.
    cola = [nueva, ...cola]
  } else {
    cola = [...cola.filter((x) => x.tipo !== 'parry'), nueva].slice(0, 3)
  }
  avisarOyentes()
  if (config.sonido) sonar(a)
  return true
}

/** Salta la animación actual (un toque en cualquier parte). */
export function saltar(): void {
  if (!cola.length) return
  cola = cola.slice(1)
  if (cola[0]) cola[0] = { ...cola[0], inicio: Date.now() }
  avisarOyentes()
}

/** Termina una animación concreta (cuando llega a su fin). */
export function terminar(id: number): void {
  const antes = cola.length
  cola = cola.filter((x) => x.id !== id)
  if (cola.length !== antes) {
    if (cola[0]) cola[0] = { ...cola[0], inicio: Date.now() }
    avisarOyentes()
  }
}

export function vaciar(): void {
  cola = []
  avisarOyentes()
}

export function actual(): EnCurso | null {
  return cola[0] ?? null
}

export function useAnimacionActual(): EnCurso | null {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => cola[0] ?? null,
  )
}

export function useConfigAnimaciones(): Config {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => config,
  )
}

// ---------- Sonido generado (sin audios de ningún juego) ----------

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  try {
    ctx = ctx ?? new C()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function ruido(ac: AudioContext, segundos: number): AudioBuffer {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * segundos), ac.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

/** Corte: soplo de aire que barre de agudo a grave. */
function corte(ac: AudioContext, t: number) {
  const src = ac.createBufferSource()
  src.buffer = ruido(ac, 0.3)
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(3800, t)
  f.frequency.exponentialRampToValueAtTime(700, t + 0.25)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
  src.connect(f).connect(g).connect(ac.destination)
  src.start(t)
  src.stop(t + 0.3)
}

/** Choque de metal: parciales inarmónicos que se apagan rápido. */
function choque(ac: AudioContext, t: number) {
  for (const [fr, vol] of [[1730, 0.18], [2610, 0.12], [4150, 0.08], [5900, 0.05]] as const) {
    const o = ac.createOscillator()
    o.type = 'triangle'
    o.frequency.value = fr
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.connect(g).connect(ac.destination)
    o.start(t)
    o.stop(t + 0.36)
  }
  const n = ac.createBufferSource()
  n.buffer = ruido(ac, 0.05)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.3, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  n.connect(g).connect(ac.destination)
  n.start(t)
}

/** Aura: zumbido grave que crece y se apaga. */
function aura(ac: AudioContext, t: number, agudo = false) {
  for (const fr of agudo ? [262, 393] : [196, 294]) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = fr
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    o.connect(g).connect(ac.destination)
    o.start(t)
    o.stop(t + 0.95)
  }
}

/** Golpe grave (tambor) para los logros grandes. */
function tambor(ac: AudioContext, t: number) {
  const o = ac.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.35)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.6, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
  o.connect(g).connect(ac.destination)
  o.start(t)
  o.stop(t + 0.5)
}

export function sonar(a: Animacion): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + 0.01
  const l = config.lento
  try {
    if (a.tipo === 'ejecucion') corte(ac, t + 0.42 * l)
    else if (a.tipo === 'parry') choque(ac, t + (a.vieja ? 0.12 : 0.67) * l)
    else if (a.tipo === 'postura') aura(ac, t + 0.5 * l, a.modo === 'siguiente')
    else {
      corte(ac, t + 0.3 * l)
      tambor(ac, t + 1.2 * l)
    }
  } catch {
    // Sin sonido: no pasa nada.
  }
}
