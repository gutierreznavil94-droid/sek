/**
 * Shinobi articulado: un personaje de anime a tinta cuyas poses son listas de
 * ángulos. Las poses viven en `animaciones/poses.json` (y las que Navil guarda
 * desde el editor, en el teléfono). Entre dos poses clave la app interpola,
 * con anticipación, peso y movimiento secundario (bufanda, mangas, capucha).
 */

import { useEffect, useRef, useState } from 'react'
import posesBase from './poses-base.json'

export type Pose = {
  cadera: [number, number]
  torso: number
  cabeza: number
  sombrero: number
  bufanda: number
  brazoDer: number
  antebrazoDer: number
  brazoIzq: number
  antebrazoIzq: number
  musloDer: number
  piernaDer: number
  musloIzq: number
  piernaIzq: number
  /** Ángulo respecto del antebrazo; null = guardada en la vaina. */
  katana: number | null
}

export type NombrePose = 'guardia' | 'carrera' | 'alzar' | 'corte' | 'bloqueo' | 'caramelo' | 'meditar' | 'victoria'
export const NOMBRES_POSE: NombrePose[] = ['guardia', 'carrera', 'alzar', 'corte', 'bloqueo', 'caramelo', 'meditar', 'victoria']

/** Articulaciones que se pueden mover en el editor, con su rango y una ayuda corta. */
export const ARTICULACIONES: { k: Exclude<keyof Pose, 'cadera' | 'katana'>; t: string; min: number; max: number }[] = [
  { k: 'torso', t: 'Torso', min: -45, max: 60 },
  { k: 'cabeza', t: 'Cabeza', min: -40, max: 40 },
  { k: 'sombrero', t: 'Sombrero', min: -30, max: 30 },
  { k: 'bufanda', t: 'Bufanda', min: -20, max: 110 },
  { k: 'brazoDer', t: 'Brazo (adelante)', min: -90, max: 190 },
  { k: 'antebrazoDer', t: 'Antebrazo (adelante)', min: -20, max: 150 },
  { k: 'brazoIzq', t: 'Brazo (atrás)', min: -90, max: 190 },
  { k: 'antebrazoIzq', t: 'Antebrazo (atrás)', min: -20, max: 150 },
  { k: 'musloDer', t: 'Muslo (adelante)', min: -110, max: 110 },
  { k: 'piernaDer', t: 'Pierna (adelante)', min: -130, max: 30 },
  { k: 'musloIzq', t: 'Muslo (atrás)', min: -110, max: 110 },
  { k: 'piernaIzq', t: 'Pierna (atrás)', min: -130, max: 30 },
]

const BASE = posesBase as unknown as Record<string, Pose | string>

function esPose(v: unknown): v is Pose {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.cadera) && o.cadera.length === 2 && typeof o.torso === 'number' && typeof o.brazoDer === 'number' && typeof o.musloDer === 'number'
}

function limpiar(j: unknown): Partial<Record<NombrePose, Pose>> {
  const r: Partial<Record<NombrePose, Pose>> = {}
  if (!j || typeof j !== 'object') return r
  for (const n of NOMBRES_POSE) {
    const v = (j as Record<string, unknown>)[n]
    if (esPose(v)) r[n] = { ...v, cadera: [Number(v.cadera[0]) || 0, Number(v.cadera[1]) || 0], katana: typeof v.katana === 'number' ? v.katana : null }
  }
  return r
}

const CLAVE_PROPIAS = 'poses-propias'
let deArchivo: Partial<Record<NombrePose, Pose>> = {}
let propias: Partial<Record<NombrePose, Pose>> = leerPropias()
let cargadas = false
const oyentes = new Set<() => void>()
function avisar() {
  for (const o of oyentes) o()
}

function leerPropias(): Partial<Record<NombrePose, Pose>> {
  try {
    const v = localStorage.getItem(CLAVE_PROPIAS)
    return v ? limpiar(JSON.parse(v)) : {}
  } catch {
    return {}
  }
}

/** Pose base (la que viene con la app). */
export function poseBase(n: NombrePose): Pose {
  return BASE[n] as Pose
}

/** Pose vigente: la guardada en el editor > la de animaciones/poses.json > la base. */
export function pose(n: NombrePose): Pose {
  return propias[n] ?? deArchivo[n] ?? poseBase(n)
}

export function origenDePose(n: NombrePose): 'propia' | 'archivo' | 'base' {
  return propias[n] ? 'propia' : deArchivo[n] ? 'archivo' : 'base'
}

export function guardarPosePropia(n: NombrePose, p: Pose): void {
  propias = { ...propias, [n]: p }
  try { localStorage.setItem(CLAVE_PROPIAS, JSON.stringify(propias)) } catch { /* sin almacenamiento */ }
  avisar()
}

export function restaurarPose(n: NombrePose): void {
  const { [n]: _q, ...resto } = propias
  void _q
  propias = resto
  try { localStorage.setItem(CLAVE_PROPIAS, JSON.stringify(propias)) } catch { /* sin almacenamiento */ }
  avisar()
}

/** Todas las poses vigentes, listas para exportar como poses.json. */
export function posesVigentes(): Record<NombrePose, Pose> {
  const r = {} as Record<NombrePose, Pose>
  for (const n of NOMBRES_POSE) r[n] = pose(n)
  return r
}

/** Lee `animaciones/poses.json` (si existe) para pisar las poses base sin tocar código. */
export async function cargarPoses(): Promise<void> {
  if (cargadas) return
  cargadas = true
  try {
    const r = await fetch('./animaciones/poses.json', { cache: 'no-cache' })
    if (!r.ok) return
    deArchivo = limpiar(await r.json())
    avisar()
  } catch {
    // Sin archivo: se usan las poses base.
  }
}

export function usePoses(): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    const o = () => setV((x) => x + 1)
    oyentes.add(o)
    return () => void oyentes.delete(o)
  }, [])
  return v
}

// ---------- Interpolación ----------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Cada parte del cuerpo llega a la pose un poco antes o después: la cadera
 * (el peso) y la katana van primero; el torso en el medio; la cabeza, los
 * hombros y la bufanda siguen con retraso. Así el movimiento no es mecánico.
 */
const ADELANTO: Partial<Record<keyof Pose, number>> = { cadera: 0.08, katana: 0.1, antebrazoDer: 0.06, musloDer: 0.04, musloIzq: 0.04, cabeza: -0.08, bufanda: -0.14, sombrero: -0.1, brazoIzq: -0.05, antebrazoIzq: -0.08 }
function tramo(k: keyof Pose, t: number): number {
  const a = ADELANTO[k] ?? 0
  return Math.max(0, Math.min(1, (t - Math.max(0, -a)) / (1 - Math.abs(a))))
}

export function mezclar(a: Pose, b: Pose, t: number, porParte = false): Pose {
  const r = { ...a } as Pose
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const f = porParte ? tramo(k, t) : t
    if (k === 'cadera') r.cadera = [lerp(a.cadera[0], b.cadera[0], f), lerp(a.cadera[1], b.cadera[1], f)]
    else if (k === 'katana') r.katana = a.katana === null || b.katana === null ? (f < 0.5 ? a.katana : b.katana) : lerp(a.katana, b.katana, f)
    else r[k] = lerp(a[k], b[k], f)
  }
  return r
}

/**
 * Pose clave de una secuencia. `pose` es un nombre o una pose completa; `mas`
 * ajusta algunas articulaciones sobre esa pose (poses intermedias sin crear
 * nombres nuevos). `curva` es la del tramo que termina en esta clave: suave
 * (cúbica) por defecto, lineal para un golpe, rebote para asentarse con un
 * pequeño sobreimpulso.
 */
export type Clave = { t: number; pose: NombrePose | Pose; mas?: Partial<Pose>; curva?: 'suave' | 'lineal' | 'rebote' | 'entrada' | 'salida' }

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const entrada = (t: number) => t * t * t
const salida = (t: number) => 1 - Math.pow(1 - t, 3)
const rebote = (t: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }
const CURVAS = { suave, lineal: (t: number) => t, rebote, entrada, salida }

export function resolverClave(c: Clave): Pose {
  const base = typeof c.pose === 'string' ? pose(c.pose) : c.pose
  return c.mas ? { ...base, ...c.mas } : base
}

/** Pose en el instante `t` (0..1) de una secuencia de poses clave. */
export function poseEn(claves: Clave[], t: number): Pose {
  if (t <= claves[0].t) return resolverClave(claves[0])
  for (let i = 1; i < claves.length; i++) {
    if (t <= claves[i].t) {
      const a = claves[i - 1]
      const b = claves[i]
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
      const curva = b.curva ?? 'suave'
      // En los golpes (lineal) todo llega junto; en el resto, cada parte con su propio adelanto.
      return mezclar(resolverClave(a), resolverClave(b), CURVAS[curva](f), curva !== 'lineal')
    }
  }
  return resolverClave(claves[claves.length - 1])
}

// ---------- Cinemática: dónde queda cada punto del cuerpo ----------

type M = [number, number, number, number, number, number]
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y]
const R = (ang: number): M => { const r = (-ang * Math.PI) / 180; return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0] }
const ap = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Longitudes fijas del cuerpo: proporción heroica (7,5 cabezas), piernas largas. */
const L = { cadera: 98, torso: 46, cuello: 9, cabeza: 11, brazo: 31, antebrazo: 29, muslo: 47, pierna: 45, katana: 70 }

function matrizTorso(p: Pose): M {
  let m = T(p.cadera[0], -L.cadera + p.cadera[1])
  m = mul(m, R(p.torso))
  return mul(m, T(0, -L.torso))
}

function matrizCodo(p: Pose, adelante: boolean): M {
  let m = mul(matrizTorso(p), R(adelante ? p.brazoDer : p.brazoIzq))
  return mul(m, T(0, L.brazo - 4))
}

/** Matriz de la mano de adelante (origen entre los pies, mirando a la derecha). */
function matrizMano(p: Pose): M {
  let m = mul(matrizTorso(p), R(p.brazoDer))
  m = mul(m, T(0, L.brazo))
  m = mul(m, R(p.antebrazoDer))
  return mul(m, T(0, L.antebrazo))
}

/** Dónde queda la mano de adelante en una pose (para poner algo en la mano, como el caramelo). */
export function puntoMano(p: Pose): [number, number] {
  return ap(matrizMano(p), 0, 0)
}

/** Dónde queda la boca en una pose (para llevar algo a la boca). */
export function puntoBoca(p: Pose): [number, number] {
  const m = mul(matrizTorso(p), R(p.cabeza))
  return ap(m, 6, -L.cuello - L.cabeza + 6)
}

/** Puntos de la katana (mano, mitad de la hoja y punta) en coordenadas del muñeco (origen entre los pies). */
export function puntosKatana(p: Pose): { mano: [number, number]; medio: [number, number]; punta: [number, number] } | null {
  if (p.katana === null) return null
  const m = mul(matrizMano(p), R(p.katana))
  return { mano: ap(m, 0, 0), medio: ap(m, 0, 8 + L.katana * 0.55), punta: ap(m, 0.6, 8 + L.katana) }
}

// ---------- Tela simulada: cadenas de segmentos con gravedad, viento y asentamiento ----------

type Cadena = { x: number[]; y: number[]; px: number[]; py: number[]; seg: number; peso: number; viento: number; roce: number }

function cadena(n: number, seg: number, x0: number, y0: number, dirX: number, dirY: number, peso: number, viento: number, roce: number): Cadena {
  const x: number[] = [], y: number[] = []
  for (let i = 0; i <= n; i++) { x.push(x0 + dirX * seg * i); y.push(y0 + dirY * seg * i) }
  return { x, y, px: [...x], py: [...y], seg, peso, viento, roce }
}

/** Un paso de Verlet: el punto 0 va pegado al cuerpo; el resto cae, recibe el viento y mantiene las distancias. */
function pasoCadena(c: Cadena, ax: number, ay: number, vx: number, vy: number, dt: number): void {
  const n = c.x.length
  const g = 900 * c.peso
  for (let i = 1; i < n; i++) {
    const ox = c.x[i], oy = c.y[i]
    // Más roce en la punta: la tela se asienta sola.
    const roce = c.roce - (i / n) * 0.015
    const nx = ox + (ox - c.px[i]) * roce + (vx * c.viento) * dt * dt
    const ny = oy + (oy - c.py[i]) * roce + (g + vy * c.viento) * dt * dt
    c.px[i] = ox; c.py[i] = oy
    c.x[i] = nx; c.y[i] = ny
  }
  c.px[0] = c.x[0]; c.py[0] = c.y[0]
  c.x[0] = ax; c.y[0] = ay
  for (let k = 0; k < 3; k++) {
    for (let i = 1; i < n; i++) {
      const dx = c.x[i] - c.x[i - 1], dy = c.y[i] - c.y[i - 1]
      const d = Math.hypot(dx, dy) || 0.0001
      const f = (d - c.seg) / d
      if (i === 1) { c.x[i] -= dx * f; c.y[i] -= dy * f }
      else { c.x[i] -= dx * f * 0.5; c.y[i] -= dy * f * 0.5; c.x[i - 1] += dx * f * 0.5; c.y[i - 1] += dy * f * 0.5 }
    }
  }
}

/** Dibuja una cadena como cinta de tela: ancho que va de `w0` a `w1`, y la punta rasgada si `rasgada`. */
function cinta(c: Cadena, w0: number, w1: number, rasgada = false): string {
  const n = c.x.length
  const izq: string[] = [], der: string[] = []
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 1 : i - 1, b = i === n - 1 ? n - 1 : i + 1
    const dx = c.x[b] - c.x[a], dy = c.y[b] - c.y[a]
    const d = Math.hypot(dx, dy) || 1
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2
    const nx = (-dy / d) * w, ny = (dx / d) * w
    izq.push(`${(c.x[i] + nx).toFixed(1)},${(c.y[i] + ny).toFixed(1)}`)
    der.push(`${(c.x[i] - nx).toFixed(1)},${(c.y[i] - ny).toFixed(1)}`)
  }
  let punta = ''
  if (rasgada) {
    // Tres picos desiguales en el borde, como tela deshilachada.
    const i = n - 1, a = n - 2
    const dx = c.x[i] - c.x[a], dy = c.y[i] - c.y[a]
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d, uy = dy / d
    const nx = -uy, ny = ux
    const w = w1 / 2
    punta = ` L${(c.x[i] - nx * w * 0.6 + ux * 7).toFixed(1)},${(c.y[i] - ny * w * 0.6 + uy * 7).toFixed(1)} L${(c.x[i] - nx * w * 0.2 + ux * 2).toFixed(1)},${(c.y[i] - ny * w * 0.2 + uy * 2).toFixed(1)} L${(c.x[i] + nx * w * 0.3 + ux * 9).toFixed(1)},${(c.y[i] + ny * w * 0.3 + uy * 9).toFixed(1)} L${(c.x[i] + nx * w * 0.8 + ux * 3).toFixed(1)},${(c.y[i] + ny * w * 0.8 + uy * 3).toFixed(1)}`
  }
  return `M${izq.join(' L')}${punta} L${der.reverse().join(' L')} Z`
}

/** Dibuja una cadena como línea fina (cordones). */
function hilo(c: Cadena): string {
  return 'M' + c.x.map((x, i) => `${x.toFixed(1)},${c.y[i].toFixed(1)}`).join(' L')
}

/** Movimiento secundario: tela simulada (formas listas para dibujar), estela de la katana, respiración y vaivén del kasa. */
export type Secundario = {
  /** Trazados de cada tela, por nombre (bufanda1, bufanda2, faldonAtras, faldonAdelante, mangaAtras, mangaAdelante, cordon1, cordon2). */
  telas: Record<string, string>
  /** Velocidad de la katana (0..1): estela de desenfoque en el golpe. */
  estela: number
  /** Respiración (−1..1), ciclo lento. */
  respira: number
  /** Vaivén del kasa (grados). */
  kasa: number
}

const SIN_SECUNDARIO: Secundario = { telas: {}, estela: 0, respira: 0, kasa: 0 }

/**
 * Simulador del movimiento secundario, con paso fijo de 16 ms: es
 * determinista (pausar y buscar un instante da siempre el mismo cuadro) y
 * avanza de a poco, cuadro a cuadro. `viento(t)` es un viento extra de la
 * escena (por ejemplo, el avance del personaje), en px/s² hacia atrás.
 */
export function crearSecundario(claves: Clave[], dur: number, viento?: (t: number) => number) {
  const paso = 16
  const dt = paso / 1000
  let i = 0
  let estela = 0
  let prev = poseEn(claves, 0)
  let telas: Record<string, Cadena> = {}
  const anclas = (p: Pose) => {
    const torso = matrizTorso(p)
    const cuello = ap(torso, -10, -4)
    const caderaM = mul(T(p.cadera[0], -L.cadera + p.cadera[1]), R(p.torso))
    return {
      bufanda1: cuello, bufanda2: ap(torso, -8, 1),
      faldonAtras: ap(caderaM, -13, 13), faldonAdelante: ap(caderaM, 11, 13),
      mangaAtras: ap(matrizCodo(p, false), 0, 0), mangaAdelante: ap(matrizCodo(p, true), 0, 0),
      cordon1: ap(caderaM, 4, -6), cordon2: ap(caderaM, -2, -6),
    }
  }
  const reiniciar = () => {
    i = 0; estela = 0
    prev = poseEn(claves, 0)
    const a = anclas(prev)
    telas = {
      bufanda1: cadena(8, 9, a.bufanda1[0], a.bufanda1[1], -0.95, 0.3, 0.22, 2.6, 0.968),
      bufanda2: cadena(7, 8, a.bufanda2[0], a.bufanda2[1], -0.9, 0.45, 0.26, 2.3, 0.968),
      faldonAtras: cadena(4, 10, a.faldonAtras[0], a.faldonAtras[1], -0.2, 1, 1, 0.5, 0.93),
      faldonAdelante: cadena(4, 10, a.faldonAdelante[0], a.faldonAdelante[1], 0.1, 1, 1, 0.5, 0.93),
      mangaAtras: cadena(3, 8, a.mangaAtras[0], a.mangaAtras[1], -0.3, 1, 0.9, 0.7, 0.94),
      mangaAdelante: cadena(3, 8, a.mangaAdelante[0], a.mangaAdelante[1], -0.3, 1, 0.9, 0.7, 0.94),
      cordon1: cadena(3, 9, a.cordon1[0], a.cordon1[1], 0, 1, 1, 0.5, 0.95),
      cordon2: cadena(3, 9, a.cordon2[0], a.cordon2[1], 0, 1, 1, 0.5, 0.95),
    }
    // Deja que la tela cuelgue antes de empezar (así no «cae» en el primer cuadro).
    for (let k = 0; k < 40; k++) for (const n in telas) pasoCadena(telas[n], a[n as keyof typeof a][0], a[n as keyof typeof a][1], -120, 0, dt)
  }
  reiniciar()
  // `pose` es la pose ya calculada para este instante (evita calcularla dos veces por cuadro).
  return (ms: number, pose?: Pose): Secundario => {
    const n = Math.max(0, Math.min(Math.ceil(dur / paso), Math.round(Math.min(ms, dur) / paso)))
    if (n < i) reiniciar()
    if (i < n) {
      // Una sola pose por cuadro (los pasos de 16 ms que caben en el cuadro usan la misma): más barato y no se nota.
      const pasos = n - i
      const p = pose ?? poseEn(claves, Math.min(1, (n * paso) / dur))
      const a = anclas(p)
      // Katana: velocidad angular → estela que se apaga rápido.
      const vk = (p.katana !== null && prev.katana !== null ? Math.abs(p.katana - prev.katana) + Math.abs(p.antebrazoDer - prev.antebrazoDer) * 0.7 + Math.abs(p.brazoDer - prev.brazoDer) * 0.5 : 0) / pasos
      for (; i < n;) {
        i++
        const seg = (i * paso) / 1000
        const t = Math.min(1, (i * paso) / dur)
        // Viento suave, siempre hacia atrás, con ráfagas; más el viento de la escena.
        const ventarron = -(140 + 90 * Math.sin(seg * 1.9) + 60 * Math.sin(seg * 0.7 + 1.3) + 30 * Math.sin(seg * 4.1)) - (viento ? viento(t) : 0)
        const vy = -40 * Math.sin(seg * 2.3 + 0.5)
        for (const nombre in telas) {
          const an = a[nombre as keyof typeof a]
          pasoCadena(telas[nombre], an[0], an[1], ventarron, vy, dt)
        }
        estela = Math.max(estela * 0.7, Math.min(1, vk / 12))
      }
      prev = p
    }
    const seg = ms / 1000
    return {
      telas: {
        bufanda1: cinta(telas.bufanda1, 8, 2.5),
        bufanda2: cinta(telas.bufanda2, 7, 2),
        faldonAtras: cinta(telas.faldonAtras, 16, 26, true),
        faldonAdelante: cinta(telas.faldonAdelante, 16, 24, true),
        mangaAtras: cinta(telas.mangaAtras, 17, 4),
        mangaAdelante: cinta(telas.mangaAdelante, 18, 4),
        cordon1: hilo(telas.cordon1),
        cordon2: hilo(telas.cordon2),
      },
      estela,
      respira: Math.sin(seg * Math.PI * 2 * 0.28),
      kasa: Math.sin(seg * 1.1) * 1.2 + Math.sin(seg * 0.37) * 0.8,
    }
  }
}

/** Movimiento secundario en el instante `ms` de la secuencia (desde el principio; para pruebas y capturas). */
export function secundarioEn(claves: Clave[], dur: number, ms: number): Secundario {
  return crearSecundario(claves, dur)(ms)
}

/**
 * Sigue el reloj de una animación CSS del propio elemento (así «saltar», la
 * cámara lenta y las capturas pausadas la controlan igual que al resto).
 */
export function useSecuencia(claves: Clave[], dur: number): { pose: Pose; sec: Secundario; ref: React.RefObject<SVGGElement | null> } {
  const ref = useRef<SVGGElement>(null)
  const [p, setP] = useState<{ pose: Pose; sec: Secundario }>(() => ({ pose: poseEn(claves, 0), sec: SIN_SECUNDARIO }))
  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    // Sin propiedades: solo sirve de reloj, no pisa la opacidad ni el transform del CSS.
    const a = el.animate([{}, {}], { duration: dur, fill: 'forwards' })
    const secundario = crearSecundario(claves, dur)
    let id = 0
    const paso = () => {
      const ms = Number(a.currentTime ?? 0)
      const pose = poseEn(claves, Math.min(1, ms / dur))
      setP({ pose, sec: secundario(ms, pose) })
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(id)
      a.cancel()
    }
  }, [claves, dur])
  return { pose: p.pose, sec: p.sec, ref }
}

/**
 * Igual que useSecuencia, pero sin volver a renderizar React en cada cuadro:
 * calcula la pose y escribe las transformaciones y la tela directo en el SVG
 * del muñeco (ver aplicarPose). Es lo que usan las escenas, por rendimiento.
 * `viento(t)` es el viento extra de la escena (avance del personaje).
 */
export function useSecuenciaDOM(claves: Clave[], dur: number, viento?: (t: number) => number, activo = true): { inicial: Pose; ref: React.RefObject<SVGGElement | null>; munieco: React.RefObject<SVGGElement | null> } {
  const ref = useRef<SVGGElement>(null)
  const munieco = useRef<SVGGElement>(null)
  const [inicial] = useState<Pose>(() => poseEn(claves, 0))
  useEffect(() => {
    const el = ref.current
    const m = munieco.current
    // `activo` en false (muñeco fuera de pantalla o tapado por una escena) frena el bucle: no gasta cuadros.
    if (!activo || !el || !m || typeof el.animate !== 'function') return
    const a = el.animate([{}, {}], { duration: dur, fill: 'forwards' })
    const secundario = crearSecundario(claves, dur, viento)
    const aplicar = prepararAplicar(m)
    let id = 0
    const paso = () => {
      const ms = Number(a.currentTime ?? 0)
      const pose = poseEn(claves, Math.min(1, ms / dur))
      aplicar(pose, secundario(ms, pose))
      id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(id)
      a.cancel()
    }
  }, [claves, dur, viento, activo])
  return { inicial, ref, munieco }
}

// ---------- Dibujo del muñeco: sombra negra de tinta ----------

const TINTA = 'var(--sh-tinta, #111)'
/** Vetas de «tinta seca»: gris muy oscuro dentro de la sombra. */
const SECA = 'var(--sh-tinta-seca, #3a3836)'
const ROJO = '#c8102e'

function rot(a: number) {
  return `rotate(${-a})`
}

/**
 * Todo lo que cambia con la pose, en un solo lugar: transformaciones de cada
 * articulación, tela simulada y estela de la katana. Lo usa el render de
 * React y también `aplicarPose`, que escribe lo mismo directo en el DOM.
 */
type Dinamico = { t: Record<string, string>; d: Record<string, string>; o: Record<string, string>; katana: boolean }

function dinamico(p: Pose, sec: Secundario): Dinamico {
  const [cx, cy] = p.cadera
  // Respiración: el pecho sube apenas y los hombros se abren un poco; nunca queda congelado.
  const torso = p.torso + sec.respira * 0.7
  const cabeza = p.cabeza - sec.respira * 0.5
  const respBrazo = sec.respira * 1.1
  const cyCab = -L.cuello - L.cabeza + 1
  const t: Record<string, string> = {
    raiz: `translate(${cx},${-L.cadera + cy - sec.respira * 0.5})`,
    torso: rot(torso),
    brazoI: rot(p.brazoIzq + respBrazo),
    anteI: rot(p.antebrazoIzq),
    brazoD: rot(p.brazoDer - respBrazo),
    anteD: rot(p.antebrazoDer),
    katana: rot(p.katana ?? 0),
    hoja: `scale(1,${(1 + 0.55 * sec.estela).toFixed(3)})`,
    musloI: rot(p.musloIzq),
    piernaI: rot(p.piernaIzq),
    musloD: rot(p.musloDer),
    piernaD: rot(p.piernaDer),
    cabeza: rot(cabeza),
    kasa: `translate(0,${cyCab - 6}) ${rot(p.sombrero + sec.kasa)}`,
  }
  const e = sec.estela
  for (const i of [1, 2, 3]) t[`estela${i}`] = `rotate(${i * 10 * e})`
  const o: Record<string, string> = {}
  for (const i of [1, 2, 3]) o[`estela${i}`] = e > 0.08 ? (e * (0.45 - i * 0.12)).toFixed(3) : '0'
  o.salpica = e > 0.25 ? (e * 0.8).toFixed(3) : '0'
  const d: Record<string, string> = {}
  for (const k in sec.telas) d[k] = sec.telas[k]
  return { t, d, o, katana: p.katana !== null }
}

/** Prepara un escritor que aplica una pose al SVG de un muñeco ya dibujado, sin pasar por React. */
export function prepararAplicar(raiz: SVGGElement): (p: Pose, sec: Secundario) => void {
  const nodos = new Map<string, Element[]>()
  const agregar = (el: Element) => { const k = el.getAttribute('data-j')!; nodos.set(k, [...(nodos.get(k) ?? []), el]) }
  if (raiz.getAttribute('data-j')) agregar(raiz)
  for (const el of raiz.querySelectorAll('[data-j]')) agregar(el)
  const anterior = new Map<string, string>()
  const poner = (k: string, attr: string, v: string) => {
    const clave = `${k}:${attr}`
    if (anterior.get(clave) === v) return
    anterior.set(clave, v)
    for (const el of nodos.get(k) ?? []) el.setAttribute(attr, v)
  }
  return (p, sec) => {
    const din = dinamico(p, sec)
    for (const k in din.t) poner(k, 'transform', din.t[k])
    for (const k in din.d) poner(k, 'd', din.d[k])
    for (const k in din.o) poner(k, 'opacity', din.o[k])
    poner('katana', 'display', din.katana ? 'inline' : 'none')
  }
}

/** Aplica una pose a un muñeco ya dibujado (ver prepararAplicar). */
export function aplicarPose(raiz: SVGGElement, p: Pose, sec: Secundario = SIN_SECUNDARIO): void {
  prepararAplicar(raiz)(p, sec)
}

/** Veta de tinta seca: trazo gris oscuro fino dentro de la sombra. */
function Veta({ d, w = 1.4, o = 0.85 }: { d: string; w?: number; o?: number }) {
  return <path d={d} fill="none" stroke={SECA} strokeWidth={w} strokeLinecap="round" opacity={o} />
}

function Katana({ din }: { din: Dinamico }) {
  const hoja = `M-1.6,8 L1.6,8 Q3.4,${8 + L.katana * 0.55} 0.8,${8 + L.katana} Q-2,${8 + L.katana * 0.55} -1.6,8 Z`
  return (
    <g data-j="katana" transform={din.t.katana} display={din.katana ? 'inline' : 'none'}>
      {/* Estela: copias de la hoja cuando la katana va rápido, y la hoja misma se estira (mancha de tinta) */}
      {[1, 2, 3].map((i) => (
        <path key={i} data-j={`estela${i}`} d={hoja} fill={TINTA} opacity={din.o[`estela${i}`]} transform={din.t[`estela${i}`]} />
      ))}
      <path d="M-2.4,-12 L2.4,-12 L2.6,6 L-2.6,6 Z" fill={TINTA} />
      <ellipse cx={0} cy={6.6} rx={4.8} ry={1.8} fill={TINTA} />
      <g data-j="hoja" transform={din.t.hoja} style={{ transformOrigin: '0px 8px' }}>
        <path d={hoja} fill={TINTA} />
      </g>
      {/* Salpicaduras mínimas que salen del filo al moverse */}
      <g data-j="salpica" opacity={din.o.salpica} fill={TINTA}>
        <circle cx={5} cy={30} r={1.1} /><circle cx={-4} cy={44} r={0.8} /><circle cx={6} cy={58} r={1.3} /><circle cx={-3} cy={66} r={0.7} />
      </g>
    </g>
  )
}

/** Brazo: hombro ancho, brazo con volumen, antebrazo que se angosta, puño. La manga es tela simulada (ver Munieco). */
function Brazo({ din, adelante }: { din: Dinamico; adelante: boolean }) {
  const s = adelante ? 'D' : 'I'
  return (
    <g data-j={`brazo${s}`} transform={din.t[`brazo${s}`]}>
      <path d={`M-8,-4 C-9.5,8 -8,19 -5.5,${L.brazo} L5.5,${L.brazo} C8,19 9.5,8 8,-4 Z`} fill={TINTA} />
      <ellipse cx={0} cy={-2} rx={8.5} ry={5.5} fill={TINTA} />
      <g transform={`translate(0,${L.brazo})`}>
        <g data-j={`ante${s}`} transform={din.t[`ante${s}`]}>
          <path d={`M-5.5,-3 C-6,10 -5,20 -4,${L.antebrazo} L4,${L.antebrazo} C5,20 6,10 5.5,-3 Z`} fill={TINTA} />
          <g transform={`translate(0,${L.antebrazo})`}>
            <path d="M-5,-1 L5,-1 L5.6,6 Q0,10 -5.6,6 Z" fill={TINTA} />
            <circle cx={adelante ? 3.8 : -3.8} cy={0.8} r={2.1} fill={TINTA} />
            {adelante && <Katana din={din} />}
          </g>
        </g>
      </g>
    </g>
  )
}

/** Pierna: muslo con volumen, rodilla, pantalón que se angosta hacia la sandalia. */
function Pierna({ din, adelante }: { din: Dinamico; adelante: boolean }) {
  const s = adelante ? 'D' : 'I'
  return (
    <g data-j={`muslo${s}`} transform={din.t[`muslo${s}`]}>
      <path d={`M-11,-4 C-13.5,12 -12,30 -8.5,${L.muslo} L8.5,${L.muslo} C12,30 13.5,12 11.5,-4 Z`} fill={TINTA} />
      <g transform={`translate(0,${L.muslo})`}>
        <ellipse cx={0} cy={0} rx={9} ry={6} fill={TINTA} />
        <g data-j={`pierna${s}`} transform={din.t[`pierna${s}`]}>
          <path d={`M-8.5,-3 C-9,12 -7,28 -4.5,${L.pierna} L4.5,${L.pierna} C7,28 9.5,12 9,-3 Z`} fill={TINTA} />
          <g transform={`translate(0,${L.pierna})`}>
            <path d="M-4.5,-7 L5,-7 L6,0 L-5.5,0 Z" fill={TINTA} />
            <path d="M-7,-1 L12.5,-2.8 Q16,0.5 13.5,3.8 L-8,3.8 Z" fill={TINTA} />
          </g>
        </g>
      </g>
    </g>
  )
}

/** Cabeza: cuello con volumen y un kasa muy ancho y bajo que tapa la cabeza hasta el cuello. */
function Cabeza({ din, sinSombrero }: { din: Dinamico; sinSombrero?: boolean }) {
  const cy = -L.cuello - L.cabeza + 1
  return (
    <g data-j="cabeza" transform={din.t.cabeza}>
      <path d="M-5,3 L5.5,3 L5,-9 L-4.5,-9 Z" fill={TINTA} />
      {/* Cráneo (queda casi todo bajo el kasa) y tela de la capucha por la nuca */}
      <path d={`M${-10.5},${cy - 1} C${-10.5},${cy - 10} ${-5},${cy - 12.5} ${1},${cy - 12.5} C${8.5},${cy - 12.5} ${12.5},${cy - 7} ${12.5},${cy + 1} C${12.5},${cy + 5} ${10.5},${cy + 8} ${6.5},${cy + 10.5} L${1},${cy + 12} L${-5},${cy + 10} C${-9.5},${cy + 8} ${-10.5},${cy + 4} ${-10.5},${cy - 1} Z`} fill={TINTA} />
      <path d={`M-9,${cy} C-15,${cy + 8} -14,${cy + 18} -9,${cy + 24} L-2,${cy + 16} C-5,${cy + 10} -5,${cy + 5} -3,${cy - 2} Z`} fill={TINTA} />
      {!sinSombrero && <Sombrero className="sh-kasa" j="kasa" transform={din.t.kasa} />}
    </g>
  )
}

/**
 * Muñeco en una pose. Origen: entre los pies, mirando a la derecha.
 * `sinSombrero` lo dibuja sin el sombrero (cuando vuela en los logros grandes).
 * `sec` es el movimiento secundario (tela simulada, estela, respiración).
 * Cada parte que se mueve lleva `data-j`, para que `aplicarPose` pueda
 * actualizarla sin volver a renderizar.
 */
export function Munieco({ p, sinSombrero, className, sec, ref }: { p: Pose; sinSombrero?: boolean; className?: string; sec?: Secundario; ref?: React.Ref<SVGGElement> }) {
  // Sin movimiento secundario dado (editor, vista estática): la tela cuelga asentada.
  const din = dinamico(p, sec ?? secundarioEn([{ t: 0, pose: p }], 1000, 0))
  const tela = (k: string, extra?: Record<string, unknown>) => <path data-j={k} d={din.d[k] ?? ''} fill={TINTA} {...extra} />
  return (
    <g ref={ref} className={className}>
      {/* Tela de atrás: bufanda (dos puntas) y faldón de atrás del abrigo */}
      {tela('bufanda1')}
      {tela('bufanda2')}
      {tela('faldonAtras')}
      <g data-j="raiz" transform={din.t.raiz}>
        {/* Pierna y brazo de atrás */}
        <Pierna din={din} adelante={false} />
        {/* Segunda katana: vaina larga y fina que sobresale mucho hacia atrás */}
        <g transform="translate(-4,-10) rotate(62)">
          <path d="M-2.6,-10 L2.6,-10 L2,88 Q0,92 -2,88 Z" fill={TINTA} />
          <path d="M-3.6,-4 L3.6,-4 L3.2,2 L-3.2,2 Z" fill={TINTA} />
        </g>
      </g>
      {tela('mangaAtras')}
      <g data-j="raiz" transform={din.t.raiz}>
        <g data-j="torso" transform={din.t.torso}>
          <g transform={`translate(0,${-L.torso})`}>
            <Brazo din={din} adelante={false} />
          </g>
        </g>
        {/* Vaina de la primera katana, cruzada a la cadera */}
        <g transform="translate(2,-4) rotate(36)">
          <path d="M-3.2,-8 L3.2,-8 L2.6,74 Q0,78 -2.6,74 Z" fill={TINTA} />
        </g>
      </g>
      {tela('faldonAdelante')}
      <g data-j="raiz" transform={din.t.raiz}>
        {/* Torso: haori de hombros anchos y cintura marcada, con vetas de tinta seca; obi con nudo */}
        <g data-j="torso" transform={din.t.torso}>
          <path d="M-14,-2 L14,-2 L18,16 Q0,19 -18,16 Z" fill={TINTA} />
          <path d={`M-14,0 C-16,-14 -20,-30 -21,${-L.torso + 2} L21,${-L.torso + 2} C20,-30 16,-14 14,0 Z`} fill={TINTA} />
          <Veta d={`M-12,-8 C-13,-18 -15,-28 -16,-38`} w={1.6} o={0.55} />
          <Veta d={`M-6,-4 C-7,-14 -9,-24 -10,-34`} w={1.1} o={0.45} />
          <Veta d={`M8,-30 C9,-24 9,-16 8,-8`} w={1.2} o={0.4} />
          <Veta d={`M2,-40 C1,-34 0,-30 -1,-26`} w={0.9} o={0.35} />
          <path d="M-15,-8 L15,-8 L14,2 L-14,2 Z" fill={TINTA} />
          <path d="M-15,-6 C-22,-13 -26,-4 -19,-1 C-24,2 -26,9 -18,7 L-15,0 Z" fill={TINTA} />
          <g transform={`translate(0,${-L.torso})`}>
            <Cabeza din={din} sinSombrero={sinSombrero} />
          </g>
        </g>
        {/* Pierna de adelante */}
        <Pierna din={din} adelante />
      </g>
      {/* Cordones del obi */}
      {tela('cordon1', { fill: 'none', stroke: TINTA, strokeWidth: 1.6, strokeLinecap: 'round' })}
      {tela('cordon2', { fill: 'none', stroke: TINTA, strokeWidth: 1.3, strokeLinecap: 'round' })}
      {tela('mangaAdelante')}
      <g data-j="raiz" transform={din.t.raiz}>
        <g data-j="torso" transform={din.t.torso}>
          <g transform={`translate(0,${-L.torso})`}>
            <Brazo din={din} adelante />
          </g>
        </g>
      </g>
    </g>
  )
}

/** Sombrero kasa: muy ancho y bajo, con vetas de tinta seca y un filo rojo muy fino en el borde. */
export function Sombrero({ ang = 0, y = 0, className, j, transform }: { ang?: number; y?: number; className?: string; j?: string; transform?: string }) {
  return (
    <g className={className} data-j={j} transform={transform ?? `translate(0,${y}) ${rot(ang)}`}>
      <path d="M-48,4 C-30,-2 -14,-10 -5,-22 L0,-26 L5,-22 C14,-10 30,-2 48,4 C30,8 -30,8 -48,4 Z" fill={TINTA} />
      <Veta d="M-30,-1 C-18,-6 -10,-12 -4,-18" w={1.3} o={0.5} />
      <Veta d="M20,-3 C26,0 32,2 38,3" w={1.1} o={0.4} />
      <Veta d="M-12,-12 C-6,-16 -2,-20 0,-23" w={0.9} o={0.35} />
      <path d="M-48,4 C-30,8 30,8 48,4" fill="none" stroke={ROJO} strokeWidth={1.2} strokeLinecap="round" opacity={0.95} />
      <circle cx={0} cy={-26} r={1.8} fill={TINTA} />
    </g>
  )
}
