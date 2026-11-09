/**
 * Escenas de logro: tinta sobre papel claro, con el shinobi articulado
 * (ver munieco.tsx) como silueta negra y el rojo como único acento.
 * Todo es SVG + CSS, sin librerías. El parry usa un sprite sacado del video de Luma de Navil.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { rutaTema, urlTema } from '../../temas/temas'
import { movimientoReducido } from '../componentes'
import { KANJI, duracionDe, elegirCorte, nombreDePilar, useAnimacionActual, type EnCurso, type EstiloCorte } from './motor'
import { Munieco, Sombrero, poseEn, puntoBoca, puntoMano, puntosKatana, useSecuenciaDOM, type Clave } from './munieco'

const ROJO = '#c8102e'
const TINTA = 'var(--sh-tinta)'
const ENEMIGO = 'var(--sh-enemigo)'
const ENEMIGO_2 = 'var(--sh-enemigo-2)'
const PAPEL = 'var(--sh-papel)'
const SUELO_Y = 205
/** Filtro de tinta escurrida (bordes de pincel). Se puede apagar desde Ver animaciones si el teléfono va lento. */
const TINTA_ESCURRIDA = 'url(#shTinta)'
/** El muñeco se dibuja un poco más chico para entrar en la escena. */
const ESCALA = 0.82

// ---------- Secuencias de poses clave (instantes como fracción de la duración) ----------
// Principios: anticipación lenta → tensión → golpe en 2 cuadros → pausa de impacto → recuperación con sobreimpulso.

/** Ejecución: entra con un paso, el peso va atrás y abajo, la katana sube en arco; paso con peso; corte seco; queda con la katana extendida. */
const SEC_EJECUCION: Clave[] = [
  // Entrada: llega caminando (el escenario lo trae desde la izquierda) y apoya
  { t: 0, pose: 'carrera', mas: { cadera: [-4, 2], torso: 16, cabeza: -2, brazoDer: 42, antebrazoDer: 70, katana: -30, brazoIzq: 20, antebrazoIzq: 50, musloDer: 36, piernaDer: -42, musloIzq: -34, piernaIzq: -24 } },
  { t: 0.07, pose: 'guardia', mas: { cadera: [0, 4], torso: 10 }, curva: 'salida' },
  { t: 0.13, pose: 'guardia', curva: 'rebote' },
  // Anticipación: se agacha, el peso atrás, la katana sube en arco (codo primero)
  { t: 0.2, pose: 'guardia', mas: { cadera: [-5, 5], torso: -6, cabeza: 5, brazoDer: 80, antebrazoDer: 95, katana: -70, musloDer: 34, piernaDer: -34 } },
  { t: 0.27, pose: 'alzar', mas: { cadera: [-9, 7], torso: -15, cabeza: 9, musloDer: 38, piernaDer: -40 }, curva: 'salida' },
  // Tensión: casi congelado, un poco más de carga
  { t: 0.33, pose: 'alzar', mas: { cadera: [-11, 9], torso: -19, cabeza: 11, brazoDer: 142, katana: -106 } },
  // Paso de avance con peso: la pierna sube, el torso se adelanta (el escenario lo mueve 105 px)
  { t: 0.37, pose: 'carrera', mas: { brazoDer: 138, antebrazoDer: 62, katana: -102, torso: 14, cadera: [0, -2], musloDer: 80, piernaDer: -100 }, curva: 'entrada' },
  { t: 0.41, pose: 'carrera', mas: { brazoDer: 132, antebrazoDer: 58, katana: -98, torso: 24, cadera: [8, -4], musloDer: 60, piernaDer: -60 } },
  // Apoyo del pie de adelante
  { t: 0.445, pose: 'alzar', mas: { cadera: [11, 2], torso: 16, cabeza: 0, brazoDer: 124, katana: -94, musloDer: 55, piernaDer: -50, musloIzq: -40, piernaIzq: -6 } },
  // Golpe: 2 cuadros, lineal
  { t: 0.468, pose: 'corte', mas: { torso: 36, cadera: [14, 0] }, curva: 'lineal' },
  // Pausa de impacto
  { t: 0.52, pose: 'corte', mas: { torso: 36, cadera: [14, 0] } },
  // Seguimiento con sobreimpulso: la katana termina extendida
  { t: 0.64, pose: 'corte', mas: { torso: 27, cadera: [12, 1], brazoDer: 63, antebrazoDer: -2, katana: 1 }, curva: 'rebote' },
  // Recuperación lenta: se endereza, baja la katana a un costado y la sacude (chiburi); el enemigo cae mientras tanto
  { t: 0.78, pose: 'corte', mas: { torso: 14, cadera: [12, -2], cabeza: 0, brazoDer: 30, antebrazoDer: 10, katana: 20, musloDer: 42, piernaDer: -30, musloIzq: -30, piernaIzq: -4 }, curva: 'suave' },
  { t: 0.9, pose: 'corte', mas: { torso: 11, cadera: [12, -1], cabeza: 2, brazoDer: 23, antebrazoDer: 14, katana: 27, musloDer: 40, piernaDer: -28, musloIzq: -28, piernaIzq: -2 } },
  // Pose final: se asienta, respira
  { t: 1, pose: 'corte', mas: { torso: 12, cadera: [12, 0], cabeza: 1, brazoDer: 26, antebrazoDer: 12, katana: 23, musloDer: 40, piernaDer: -28, musloIzq: -28, piernaIzq: -2 } },
]
/** Logro grande: la ejecución comprimida al 62 % y, al final, la pose de victoria. */
const SEC_LOGRO: Clave[] = [
  ...SEC_EJECUCION.slice(0, 13).map((c) => ({ ...c, t: Math.round(c.t * 0.62 * 1000) / 1000 })),
  { t: 0.56, pose: 'corte', mas: { torso: 24, cadera: [12, 1], brazoDer: 58, antebrazoDer: 2, katana: 2 } },
  { t: 0.66, pose: 'victoria', mas: { cadera: [2, 2], brazoDer: 120, antebrazoDer: 20, katana: -30, torso: 4 } },
  { t: 0.76, pose: 'victoria', mas: { cadera: [0, -4] }, curva: 'rebote' },
  // La pose de victoria respira: el brazo baja apenas y vuelve a alzarse, la cabeza mira al cielo
  { t: 0.88, pose: 'victoria', mas: { cadera: [0, -1], brazoDer: 138, antebrazoDer: 10, katana: -36, cabeza: 15, torso: -8 } },
  { t: 1, pose: 'victoria', mas: { cadera: [0, 0], brazoDer: 152, antebrazoDer: -2, cabeza: 10, torso: -5 } },
]
/** Parry: sube la hoja en arco y en seco, recibe el golpe con los pies afirmados, el torso absorbe (se hunde) y rebota. */
const SEC_PARRY: Clave[] = [
  { t: 0.04, pose: 'guardia' },
  { t: 0.1, pose: 'guardia', mas: { brazoDer: 70, antebrazoDer: 80, katana: -60, cadera: [-1, 1], torso: 2 } },
  { t: 0.16, pose: 'bloqueo', mas: { cadera: [-2, 2] }, curva: 'lineal' },
  { t: 0.22, pose: 'bloqueo', mas: { cadera: [-5, 7], torso: -14, cabeza: 4, musloDer: 34, piernaDer: -38 }, curva: 'salida' },
  { t: 0.3, pose: 'bloqueo', mas: { cadera: [-5, 7], torso: -14, cabeza: 4, musloDer: 34, piernaDer: -38 } },
  { t: 0.4, pose: 'bloqueo', mas: { cadera: [-3, 3], torso: -7, cabeza: 2 } },
  { t: 0.5, pose: 'bloqueo', mas: { cadera: [-2, 1], torso: -3 }, curva: 'rebote' },
  { t: 0.72, pose: 'guardia', mas: { brazoDer: 50, antebrazoDer: 80, katana: -40, torso: 4 } },
  { t: 1, pose: 'guardia' },
]
/** Postura del caramelo: se arrodilla con peso, lleva el caramelo a la boca en arco, junta las manos en oración. */
function secPostura(modo: '321' | 'siguiente'): Clave[] {
  const cabeza = modo === 'siguiente' ? 32 : 22
  return [
    { t: 0.04, pose: 'guardia' },
    { t: 0.09, pose: 'guardia', mas: { cadera: [0, 8], torso: 8, cabeza: 2 } },
    // Baja de a poco: media rodilla primero
    { t: 0.155, pose: 'caramelo', mas: { cadera: [0, 26], torso: 14, cabeza: 0, brazoDer: 30, antebrazoDer: 62, musloDer: 70, piernaDer: -80, musloIzq: -20, piernaIzq: -40 } },
    { t: 0.22, pose: 'caramelo', mas: { cadera: [0, 46], brazoDer: 40, antebrazoDer: 60, cabeza: 2 }, curva: 'salida' },
    { t: 0.3, pose: 'caramelo', mas: { cadera: [0, 55], brazoDer: 46, antebrazoDer: 70 }, curva: 'rebote' },
    { t: 0.37, pose: 'caramelo', mas: { brazoDer: 62, antebrazoDer: 98 } },
    { t: 0.44, pose: 'caramelo' },
    { t: 0.54, pose: 'caramelo' },
    { t: 0.6, pose: 'caramelo', mas: { brazoDer: 50, antebrazoDer: 112, brazoIzq: 42, antebrazoIzq: 88, cabeza: 12 } },
    { t: 0.68, pose: 'meditar', mas: { cabeza } },
    { t: 0.8, pose: 'meditar', mas: { cabeza: cabeza + 3, cadera: [0, 53] }, curva: 'rebote' },
    { t: 1, pose: 'meditar', mas: { cabeza: cabeza + 2 } },
  ]
}

/** Viento extra de la escena (px/s² hacia atrás) durante el avance del personaje. */
const VIENTO_EJECUCION = (t: number) => (t > 0.3 && t < 0.47 ? 900 : t < 0.1 ? 350 : 0)
const VIENTO_LOGRO = (t: number) => (t > 0.186 && t < 0.29 ? 900 : t < 0.06 ? 350 : 0)
const SIN_VIENTO = () => 0

const SEC_REPOSO: Clave[] = [{ t: 0, pose: 'guardia' }]

/** Shinobi en reposo: guardia con respiración, kasa que se mece y tela al viento, en un SVG chico (Ver animaciones). */
export function MuniecoVivo() {
  // Solo se mueve cuando está a la vista y no hay una escena encima (si no, le roba cuadros a la escena).
  const [visible, setVisible] = useState(true)
  const [svg, setSvg] = useState<SVGSVGElement | null>(null)
  const escena = useAnimacionActual()
  useEffect(() => {
    if (!svg || typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting))
    o.observe(svg)
    return () => o.disconnect()
  }, [svg])
  const { inicial, ref, munieco } = useSecuenciaDOM(SEC_REPOSO, 60_000, undefined, visible && !escena && !movimientoReducido())
  return (
    <svg ref={setSvg} className="sh-reposo" viewBox="0 0 240 240" aria-label="Shinobi en reposo">
      <rect x={0} y={0} width={240} height={240} fill="var(--sh-papel, #f3efe6)" />
      <path d="M-10,214 C40,202 90,208 140,202 C190,196 220,206 250,200 L250,240 L-10,240 Z" fill="var(--sh-tinta, #141414)" />
      <g ref={ref}>
        <g transform={`translate(130,${SUELO_Y}) scale(0.95)`}>
          <Munieco ref={munieco} p={inicial} />
        </g>
      </g>
    </svg>
  )
}

/** Muñeco que sigue una secuencia de poses durante `dur` ms. */
function Actor({ claves, dur, x, sinSombrero, className, viento = SIN_VIENTO }: { claves: Clave[]; dur: number; x: number; sinSombrero?: boolean; className?: string; viento?: (t: number) => number }) {
  const { inicial, ref, munieco } = useSecuenciaDOM(claves, dur, viento)
  return (
    <g ref={ref} className={className}>
      {/* Sin filtro de tinta sobre el muñeco: el contorno rasgado y las vetas ya dan la textura, y el filtro
          obligaba a volver a dibujar todo el personaje con desplazamiento en cada cuadro (costaba ~5 fps). */}
      <g transform={`translate(${x},${SUELO_Y}) scale(${ESCALA})`}>
        <Munieco ref={munieco} p={inicial} sinSombrero={sinSombrero} />
      </g>
    </g>
  )
}

// ---------- Enemigos: tres variantes originales, con volumen y pliegues, mirando a la izquierda ----------

export type VarianteEnemigo = 'ronin' | 'bandido' | 'soldado'
export const VARIANTES_ENEMIGO: VarianteEnemigo[] = ['ronin', 'bandido', 'soldado']

/** Pliegue en línea de papel. */
function Pl({ d, w = 1.1, o = 0.5 }: { d: string; w?: number; o?: number }) {
  return <path d={d} fill="none" stroke={PAPEL} strokeWidth={w} strokeLinecap="round" opacity={o} />
}

/** Enemigo genérico (origen entre los pies). El brazo con el arma está en `.sh-en-brazo` para que reaccione antes del corte. */
export function Enemigo({ variante = 'ronin', sinArma }: { variante?: VarianteEnemigo; sinArma?: boolean }) {
  if (variante === 'bandido') {
    return (
      <g>
        {/* Bandido: pañuelo en la cabeza, torso descubierto de un lado, pantalón ancho, sable corto */}
        <path d="M-12,-2 C-14,-20 -12,-36 -10,-44 L10,-44 C12,-36 14,-20 12,-2 L6,0 L4,-30 L-4,-30 L-6,0 Z" fill={ENEMIGO} />
        <path d="M-12,-2 C-14,-20 -12,-36 -10,-44 L-3,-44 C-5,-30 -5,-16 -6,0 Z" fill={ENEMIGO_2} />
        <Pl d="M-2,-6 L-3,-26 M7,-6 L8,-26" />
        <path d="M-15,-44 C-18,-60 -16,-78 -10,-86 L12,-86 C18,-78 19,-60 15,-44 Z" fill={ENEMIGO} />
        <path d="M-15,-44 C-18,-60 -16,-78 -10,-86 L-2,-86 C-6,-74 -7,-58 -6,-44 Z" fill={ENEMIGO_2} />
        <Pl d="M2,-84 C-2,-74 -4,-62 -3,-50" w={1.3} o={0.6} />
        <path d="M-16,-50 L16,-50 L15,-43 L-15,-43 Z" fill={ENEMIGO_2} />
        <Pl d="M-15,-46.5 L15,-46.5" w={0.9} />
        {/* Cabeza con pañuelo anudado y venda en la cara */}
        <path d="M-9,-92 C-9,-102 -4,-106 1,-106 C7,-106 10,-101 10,-93 C10,-88 7,-84 1,-83 C-5,-84 -9,-87 -9,-92 Z" fill={ENEMIGO} />
        <path d="M-9,-100 C-4,-106 6,-107 11,-101 L12,-97 L-10,-97 Z" fill={ENEMIGO_2} />
        <path d="M10,-101 C14,-104 18,-100 16,-96 L13,-98 Z" fill={ENEMIGO_2} />
        <Pl d="M-8,-91 L9,-92" w={1.2} o={0.6} />
        {/* Brazo de atrás y brazo con el sable */}
        <path d="M10,-82 C16,-74 18,-66 16,-58 L11,-58 C12,-66 10,-72 6,-78 Z" fill={ENEMIGO_2} />
        <g className="sh-en-brazo" style={{ transformOrigin: '-12px -80px' }}>
          <path d="M-12,-82 C-20,-80 -28,-76 -32,-70 L-28,-64 C-24,-70 -18,-73 -10,-74 Z" fill={ENEMIGO} />
          <Pl d="M-22,-74 L-26,-69" w={0.9} />
          <circle cx={-30} cy={-67} r={4} fill={ENEMIGO} />
          <path d="M-31,-70 L-29,-64 L-50,-88 L-52,-92 Z" fill={ENEMIGO} />
          <Pl d="M-32,-69 L-49,-89" w={0.7} o={0.6} />
        </g>
        {/* Sandalias */}
        <path d="M-7,0 L-16,0 L-17,3 L6,3 L6,0 Z M5,0 L16,0 L17,3 L4,3 Z" fill={ENEMIGO} />
      </g>
    )
  }
  if (variante === 'soldado') {
    return (
      <g>
        {/* Soldado: jingasa, peto de placas, hombreras, lanza corta */}
        <path d="M-11,-2 C-13,-18 -12,-34 -10,-44 L10,-44 C12,-34 13,-18 11,-2 L6,0 L4,-30 L-4,-30 L-6,0 Z" fill={ENEMIGO} />
        <path d="M-11,-2 C-13,-18 -12,-34 -10,-44 L-3,-44 C-5,-30 -5,-16 -6,0 Z" fill={ENEMIGO_2} />
        <path d="M-15,-40 L15,-40 L17,-30 L-17,-30 Z" fill={ENEMIGO_2} />
        <Pl d="M-15,-35 L15,-35" w={0.9} />
        <path d="M-15,-44 C-17,-58 -15,-74 -10,-84 L12,-84 C17,-74 18,-58 16,-44 Z" fill={ENEMIGO} />
        <Pl d="M-12,-56 L13,-56 M-12,-64 L13,-64 M-11,-72 L12,-72 M-4,-50 L-4,-80 M4,-50 L4,-80" w={0.9} o={0.55} />
        <path d="M-20,-84 C-22,-78 -20,-72 -14,-70 L-10,-82 Z M20,-84 C23,-78 21,-72 15,-70 L11,-82 Z" fill={ENEMIGO_2} />
        <path d="M-9,-91 C-9,-100 -4,-104 1,-104 C7,-104 10,-99 10,-92 C10,-87 7,-84 1,-83 C-5,-84 -9,-86 -9,-91 Z" fill={ENEMIGO} />
        <Pl d="M-8,-92 L9,-93" w={1.2} o={0.6} />
        {/* Jingasa: cónico bajo con cresta */}
        <path d="M-24,-98 L24,-98 L4,-114 L0,-116 L-4,-114 Z" fill={ENEMIGO} />
        <Pl d="M-18,-99 L0,-112 M18,-99 L0,-112" w={0.8} />
        <path d="M0,-116 L2,-124 L-2,-124 Z" fill={ENEMIGO} />
        <path d="M10,-80 C16,-72 18,-64 16,-56 L11,-56 C12,-64 10,-70 6,-76 Z" fill={ENEMIGO_2} />
        <g className="sh-en-brazo" style={{ transformOrigin: '-12px -78px' }}>
          <path d="M-12,-80 C-20,-78 -26,-72 -30,-64 L-25,-60 C-22,-66 -17,-70 -10,-72 Z" fill={ENEMIGO} />
          <circle cx={-27} cy={-62} r={4} fill={ENEMIGO} />
          <path d="M-29,-64 L-25,-60 L-62,-110 L-64,-114 Z" fill={ENEMIGO} />
          <path d="M-62,-110 L-70,-124 L-60,-116 Z" fill={ENEMIGO} />
          <Pl d="M-28,-63 L-60,-108" w={0.7} o={0.6} />
        </g>
        <path d="M-7,0 L-16,0 L-17,3 L6,3 L6,0 Z M5,0 L16,0 L17,3 L4,3 Z" fill={ENEMIGO} />
      </g>
    )
  }
  return (
    <g>
      {/* Ronin: sombrero de paja, kimono raído, katana en alto */}
      <path d="M-13,-2 C-15,-20 -13,-36 -11,-44 L11,-44 C13,-36 15,-20 13,-2 L7,0 L4,-30 L-4,-30 L-7,0 Z" fill={ENEMIGO} />
      <path d="M-13,-2 C-15,-20 -13,-36 -11,-44 L-3,-44 C-5,-30 -5,-16 -7,0 Z" fill={ENEMIGO_2} />
      <Pl d="M-1,-6 L-2,-28 M8,-6 L9,-28 M-10,-10 L-10,-30" />
      <path d="M-15,-44 C-18,-60 -16,-78 -11,-86 L13,-86 C18,-78 19,-60 15,-44 Z" fill={ENEMIGO} />
      <path d="M-15,-44 C-18,-60 -16,-78 -11,-86 L-3,-86 C-6,-74 -7,-58 -6,-44 Z" fill={ENEMIGO_2} />
      <Pl d="M4,-84 C0,-74 -2,-62 -1,-50 M-6,-84 C-2,-76 1,-66 2,-56" w={1.2} o={0.6} />
      <path d="M-16,-50 L16,-50 L15,-43 L-15,-43 Z" fill={ENEMIGO_2} />
      <path d="M-9,-92 C-9,-101 -4,-105 1,-105 C7,-105 10,-100 10,-93 C10,-88 7,-84 1,-83 C-5,-84 -9,-87 -9,-92 Z" fill={ENEMIGO} />
      <Pl d="M-8,-92 L9,-93" w={1.2} o={0.6} />
      <path d="M-30,-100 L30,-100 L0,-118 Z" fill={ENEMIGO} />
      <Pl d="M-20,-102 L0,-114 M20,-102 L0,-114" w={0.8} />
      <path d="M11,-82 C17,-74 19,-66 17,-58 L12,-58 C13,-66 11,-72 7,-78 Z" fill={ENEMIGO_2} />
      <g className="sh-en-brazo" style={{ transformOrigin: '-12px -82px' }}>
        <path d="M-12,-84 C-20,-88 -26,-94 -30,-102 L-26,-106 C-22,-99 -17,-94 -10,-91 Z" fill={ENEMIGO} />
        <circle cx={-29} cy={-104} r={4} fill={ENEMIGO} />
        {!sinArma && <path d="M-31,-106 L-27,-102 L-56,-132 L-60,-134 Z" fill={ENEMIGO} />}
        {!sinArma && <Pl d="M-30,-105 L-56,-131" w={0.7} o={0.6} />}
      </g>
      <path d="M-7,0 L-16,0 L-17,3 L6,3 L6,0 Z M5,0 L16,0 L17,3 L4,3 Z" fill={ENEMIGO} />
    </g>
  )
}

// ---------- Fondo: papel, montañas lejanas, pájaros, rama seca, motas y suelo de pincel ----------

function Fondo({ tinte, lluvia, epico }: { tinte?: string; lluvia?: boolean; epico?: boolean }) {
  return (
    <g>
      <defs>
        <filter id="shPapel" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.28  0 0 0 0 0.24  0 0 0 0.18 0" />
        </filter>
        <filter id="shBorron" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="shTinta" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" result="r" />
          <feDisplacementMap in="SourceGraphic" in2="r" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {!epico && <rect x={0} y={0} width={360} height={240} fill="var(--sh-papel)" />}
      {!epico && <rect className="sh-grano" x={0} y={0} width={360} height={240} filter="url(#shPapel)" />}
      {tinte && <rect className="sh-tinte" x={0} y={0} width={360} height={240} fill={tinte} />}
      {/* Montañas lejanas, en gris suave */}
      <g filter={TINTA_ESCURRIDA}>
        <path d="M-10,172 C40,140 80,96 130,88 C170,82 200,120 236,106 C280,90 320,140 370,150 L370,240 L-10,240 Z" fill="var(--sh-lejos-2)" />
        <path d="M-10,186 C50,160 100,132 150,138 C210,146 250,120 300,142 C330,154 350,166 370,170 L370,240 L-10,240 Z" fill="var(--sh-lejos)" />
      </g>
      {lluvia && (
        <g className="sh-lluvia" stroke="var(--sh-tinta)" strokeWidth={0.8} strokeLinecap="round" opacity={0.3}>
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + i * 42} y1={-60} x2={6 + i * 42} y2={-20} />)}
        </g>
      )}
      {/* Ensō de tinta, apenas, detrás de todo */}
      <circle className="sh-enso" cx={180} cy={108} r={94} fill="none" stroke="var(--sh-tinta)" strokeWidth={4} strokeLinecap="round" opacity={0.16} />
      {/* Pájaros lejanos */}
      <g fill="none" stroke="var(--sh-tinta)" strokeWidth={1.3} strokeLinecap="round" opacity={0.7}>
        <path d="M60,44 q5,-5 10,0 q5,-5 10,0" />
        <path d="M82,32 q4,-4 8,0 q4,-4 8,0" />
        <path d="M300,58 q4,-4 8,0 q4,-4 8,0" />
      </g>
      {/* Rama seca en la esquina */}
      <g fill="none" stroke="var(--sh-tinta)" strokeLinecap="round">
        <path d="M372,6 C340,22 326,40 316,60" strokeWidth={2.4} />
        <path d="M344,22 C336,34 338,44 342,52" strokeWidth={1.4} />
        <path d="M330,40 C318,42 312,48 308,56" strokeWidth={1.2} />
        <path d="M352,16 C356,26 352,34 348,40" strokeWidth={1.1} />
      </g>
      {/* Motas de tinta */}
      <g fill="var(--sh-tinta)">
        <circle className="sh-mota sh-mota-1" cx={40} cy={22} r={1.4} /><circle cx={120} cy={16} r={0.9} /><circle className="sh-mota sh-mota-2" cx={210} cy={30} r={1.1} /><circle cx={28} cy={96} r={1.8} /><circle cx={254} cy={20} r={0.8} /><circle className="sh-mota sh-mota-3" cx={336} cy={96} r={1.3} /><ellipse cx={76} cy={64} rx={2.2} ry={1.1} />
      </g>
      {/* Suelo: roca de pinceladas gruesas con pasto */}
      <path d="M-10,214 C30,200 70,206 110,200 C160,192 200,204 250,198 C300,192 340,206 370,200 L370,240 L-10,240 Z" fill="var(--sh-tinta)" />
      <path d="M20,220 C80,214 140,218 200,214 C260,210 320,216 360,212" fill="none" stroke="var(--sh-piedra)" strokeWidth={2.2} strokeLinecap="round" opacity={0.6} />
      <path d="M60,230 C120,226 180,228 240,226" fill="none" stroke="var(--sh-piedra)" strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
      <g fill="none" stroke="var(--sh-tinta)" strokeWidth={1.6} strokeLinecap="round">
        <path d="M24,206 l-3,-9" /><path d="M30,205 l1,-11" /><path d="M36,204 l4,-8" />
        <path d="M316,204 l-3,-10" /><path d="M324,203 l2,-12" /><path d="M331,204 l5,-8" /><path d="M150,200 l2,-8" /><path d="M156,199 l-2,-7" />
      </g>
    </g>
  )
}

// ---------- Corte: línea, mitades del enemigo y sangre de tinta ----------

type Geo = { a: [number, number]; b: [number, number]; mitadA: string; mitadB: string; varA: CSSProperties; varB: CSSProperties; centro: [number, number] }

const LINEAS: Record<EstiloCorte, { a: [number, number]; b: [number, number]; da: [number, number, number]; db: [number, number, number] }> = {
  horizontal: { a: [-50, -58], b: [50, -66], da: [22, -10, 9], db: [2, 3, -3] },
  diagonal: { a: [-42, -112], b: [44, -26], da: [18, 16, 11], db: [-4, 3, -4] },
  ascendente: { a: [-44, -22], b: [42, -114], da: [16, -16, -9], db: [-3, 3, 4] },
  vertical: { a: [-3, -126], b: [3, 6], da: [-14, 5, -9], db: [14, 5, 9] },
  estocada: { a: [-70, -70], b: [34, -70], da: [16, 0, 16], db: [16, 0, 16] },
}

function geometria(estilo: EstiloCorte): Geo {
  const l = LINEAS[estilo]
  const [x1, y1] = l.a
  const [x2, y2] = l.b
  let mitadA: string
  let mitadB: string
  if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
    const yEn = (x: number) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1)
    mitadA = `-80,-150 80,-150 80,${yEn(80)} -80,${yEn(-80)}`
    mitadB = `-80,${yEn(-80)} 80,${yEn(80)} 80,20 -80,20`
  } else {
    const xEn = (y: number) => x1 + ((x2 - x1) * (y - y1)) / (y2 - y1)
    mitadA = `-80,-150 ${xEn(-150)},-150 ${xEn(20)},20 -80,20`
    mitadB = `${xEn(-150)},-150 80,-150 80,20 ${xEn(20)},20`
  }
  const v = (d: [number, number, number]) => ({ '--dx': `${d[0]}px`, '--dy': `${d[1]}px`, '--rot': `${d[2]}deg` }) as CSSProperties
  return { a: l.a, b: l.b, mitadA, mitadB, varA: v(l.da), varB: v(l.db), centro: [(x1 + x2) / 2, (y1 + y2) / 2] }
}

function Sangre({ cx, cy, semilla, sinMancha }: { cx: number; cy: number; semilla: number; sinMancha?: boolean }) {
  // Manchas fijas (no aleatorias en cada render) para que el dibujo sea estable.
  const gotas = useMemo(() => {
    const r: { dx: number; dy: number; r: number; d: number }[] = []
    let s = semilla
    const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 11; i++) r.push({ dx: (azar() - 0.3) * 110, dy: (azar() - 0.8) * 90, r: 1.5 + azar() * 3.8, d: azar() * 0.06 })
    return r
  }, [semilla])
  return (
    <g>
      {!sinMancha && <path className="sh-mancha" style={{ transformOrigin: `${cx}px ${cy}px` }} d={`M${cx - 30},${cy + 2} C${cx - 20},${cy - 16} ${cx - 2},${cy - 8} ${cx + 8},${cy - 20} C${cx + 16},${cy - 8} ${cx + 34},${cy - 10} ${cx + 40},${cy + 2} C${cx + 20},${cy + 8} ${cx + 4},${cy + 16} ${cx - 10},${cy + 10} C${cx - 18},${cy + 14} ${cx - 28},${cy + 8} ${cx - 30},${cy + 2} Z`} fill={ROJO} />}
      {/* Arco grande de sangre de tinta que sale del corte */}
      <path className="sh-arco" d={`M${cx - 20},${cy + 6} C${cx + 10},${cy - 50} ${cx + 50},${cy - 70} ${cx + 86},${cy - 92}`} fill="none" stroke={ROJO} strokeWidth={5} strokeLinecap="round" pathLength={100} />
      {gotas.map((g, i) => (
        <circle key={i} className="sh-gota" cx={cx} cy={cy} r={g.r} fill={ROJO} style={{ '--gx': `${g.dx}px`, '--gy': `${g.dy}px`, animationDelay: `calc(var(--dur) * ${g.d})` } as CSSProperties} />
      ))}
    </g>
  )
}

function Kanji({ k, x, y, tam = 64, clase = 'sh-kanji', color = ROJO }: { k: string; x: number; y: number; tam?: number; clase?: string; color?: string }) {
  return (
    <text className={clase} x={x} y={y} textAnchor="middle" fontSize={tam} fill={color} fontFamily="'Pincel','Noto Serif JP','Noto Serif CJK JP','Hiragino Mincho ProN','Yu Mincho',serif" fontWeight={400}>
      {k}
    </text>
  )
}

// ---------- Escenas ----------

const ACTOR_X = 70
/** Posición de la cabeza al final del corte (para que el sombrero salga de ahí en los logros). */
const CABEZA_FIN = { x: ACTOR_X + 105 + 24 * ESCALA, y: SUELO_Y - 168 * ESCALA }

/** Ejecución: anticipación, paso con peso, corte que atraviesa al enemigo, sangre de tinta y kanji del pilar. */
function Ejecucion({ estilo, kanji, dur, sinSalida, sinActor, enemigo }: { estilo: EstiloCorte; kanji: string; dur: number; sinSalida?: boolean; sinActor?: boolean; enemigo: VarianteEnemigo }) {
  const g = geometria(estilo)
  const ex = 250
  const corteA = { x: ex + g.a[0], y: SUELO_Y + g.a[1] }
  const corteB = { x: ex + g.b[0], y: SUELO_Y + g.b[1] }
  const [ccx, ccy] = [ex + g.centro[0], SUELO_Y + g.centro[1]]
  return (
    <g className={`sh-ej ${estilo} ${sinSalida ? '' : 'con-salida'}`}>
      {/* Enemigo: entero hasta el corte (reacciona antes), después en dos mitades que caen con peso y se disuelven */}
      <g transform={`translate(${ex},${SUELO_Y})`}>
        <g className="sh-entero" style={{ transformOrigin: '0px 0px' }}><Enemigo variante={enemigo} /></g>
        {estilo === 'estocada' ? (
          <g className="sh-mitad caida" style={g.varA}><Enemigo variante={enemigo} /></g>
        ) : (
          <>
            <defs>
              <clipPath id={`shA-${estilo}`}><polygon points={g.mitadA} /></clipPath>
              <clipPath id={`shB-${estilo}`}><polygon points={g.mitadB} /></clipPath>
            </defs>
            <g className="sh-mitad" style={g.varB}><g clipPath={`url(#shB-${estilo})`}><Enemigo variante={enemigo} /></g></g>
            <g className="sh-mitad" style={g.varA}><g clipPath={`url(#shA-${estilo})`}><Enemigo variante={enemigo} /></g></g>
          </>
        )}
      </g>
      {/* Estelas de velocidad del paso */}
      <g className="sh-estelas" stroke={TINTA} strokeLinecap="round" opacity={0.6}>
        <line x1={70} y1={150} x2={250} y2={150} strokeWidth={2} />
        <line x1={90} y1={170} x2={280} y2={168} strokeWidth={3} />
        <line x1={60} y1={186} x2={230} y2={186} strokeWidth={1.5} />
      </g>
      {/* Personaje: avanza (CSS) mientras pasa de guardia a carrera y corte (poses) */}
      {!sinActor && <Actor className="sh-actor" claves={SEC_EJECUCION} dur={dur} x={ACTOR_X} viento={VIENTO_EJECUCION} />}
      {/* Líneas de velocidad del golpe, línea del corte y destello */}
      <g className="sh-velocidad" stroke={TINTA} strokeWidth={1.2} strokeLinecap="round" opacity={0.55}>
        {[-26, -14, 0, 12, 24].map((d, i) => (
          <line key={i} x1={ccx - 60 + d * 0.3} y1={ccy + d - 4} x2={ccx + 50 + d * 0.2} y2={ccy + d * 0.9 - 2} />
        ))}
      </g>
      <line className="sh-linea" x1={corteA.x} y1={corteA.y} x2={corteB.x} y2={corteB.y} stroke={TINTA} strokeWidth={4} strokeLinecap="round" pathLength={100} />
      <line className="sh-linea roja" x1={corteA.x} y1={corteA.y} x2={corteB.x} y2={corteB.y} stroke={ROJO} strokeWidth={1.6} strokeLinecap="round" pathLength={100} />
      <path className="sh-pincelada" d={`M${corteA.x},${corteA.y} Q${ccx + (corteB.y - corteA.y) * 0.12},${ccy - (corteB.x - corteA.x) * 0.12} ${corteB.x},${corteB.y}`} fill="none" stroke={ROJO} strokeWidth={7} strokeLinecap="round" pathLength={100} opacity={0.85} />
      <Sangre cx={ccx} cy={ccy} semilla={estilo.length * 97} />
      <g className="sh-papeles" fill="var(--sh-papel)" stroke="var(--sh-tinta)" strokeWidth={0.5}>
        {[[-34, -26, 120], [38, -20, -90], [14, -36, 180], [-10, -40, -150]].map(([dx, dy, r], i) => (
          <path key={i} className="sh-papel" style={{ '--px': `${dx}px`, '--py': `${dy}px`, '--pr': `${r}deg`, transformOrigin: `${ccx}px ${ccy}px` } as CSSProperties} d={`M${ccx},${ccy} l6,2 l-3,5 Z`} />
        ))}
      </g>
      <circle className="sh-destello" cx={ccx} cy={ccy} r={70} fill={ROJO} filter="url(#shBorron)" />
      <Kanji k={kanji} x={310} y={86} />
    </g>
  )
}

const PARRY_X = 150
/** Punto donde se encuentran las dos hojas: la mitad de la katana del shinobi en la pose de bloqueo. */
const CONTACTO_PARRY = (() => {
  const k = puntosKatana(poseEn(SEC_PARRY, 0.2))
  const [mx, my] = k ? k.medio : [40, -120]
  return { x: PARRY_X + mx * ESCALA, y: SUELO_Y + my * ESCALA }
})()

function Parry({ dur }: { dur: number }) {
  const { x: cx, y: cy } = CONTACTO_PARRY
  const ex = 244
  const mano = { x: ex - 29, y: SUELO_Y - 104 }
  return (
    <g className="sh-parry">
      <g transform={`translate(${ex},${SUELO_Y})`}><g className="sh-parry-enemigo"><Enemigo variante="ronin" sinArma /></g></g>
      {/* Hoja enemiga: baja hasta el punto de contacto y sale desviada */}
      <g className="sh-hoja-enemiga" style={{ transformOrigin: `${mano.x}px ${mano.y}px` }}>
        <line x1={mano.x} y1={mano.y} x2={cx} y2={cy} stroke={ENEMIGO} strokeWidth={3.4} strokeLinecap="round" />
        <line x1={mano.x + 2} y1={mano.y - 2} x2={cx + 2} y2={cy - 1} stroke={PAPEL} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
      </g>
      <Actor className="sh-actor" claves={SEC_PARRY} dur={dur} x={PARRY_X} />
      <circle className="sh-anillo" cx={cx} cy={cy} r={18} fill="none" stroke={TINTA} strokeWidth={2.5} />
      <g className="sh-chispas" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 12 }, (_, i) => {
          const ang = (i / 12) * Math.PI * 2 + 0.3
          const r1 = 5
          const r2 = 20 + (i % 3) * 9
          return <line key={i} x1={cx + Math.cos(ang) * r1} y1={cy + Math.sin(ang) * r1} x2={cx + Math.cos(ang) * r2} y2={cy + Math.sin(ang) * r2} stroke={i % 2 ? '#ffb347' : '#ff7a1a'} strokeWidth={2.2} strokeLinecap="round" />
        })}
      </g>
      <circle className="sh-brillo" cx={cx} cy={cy} r={12} fill="#fff6d6" />
    </g>
  )
}

/**
 * Parry hecho con el video de Luma de Navil (scripts/parry-sprites.py): los cuadros 13 a 100 seguidos a
 * ~46 fps (casi el doble de rápido que el video, Navil lo quiere ágil), sin saltos ni pausas: el rival salta y ataca, choque (destello, chispas y el kanji 忍 con su aura),
 * forcejeo, se separan, el rival sale despedido y vuelven a guardia hasta que la tela se asienta.
 */
const PARRY_HOJA = { w: 407, h: 187, cols: 10, filas: 9 }
/** Cuántos cuadros de 24 fps se muestra cada celda de la hoja, en orden (velocidad natural del video). */
const PARRY_TIEMPOS: number[] = Array(88).fill(1)
const PARRY_CELDA_CHOQUE = 16
const PARRY_TICKS = PARRY_TIEMPOS.reduce((a, b) => a + b, 0)
const PARRY_INICIOS = PARRY_TIEMPOS.map((_, i) => PARRY_TIEMPOS.slice(0, i).reduce((a, b) => a + b, 0) / PARRY_TICKS)
/** Momento del choque y del rebote (fracción de la duración). */
const PARRY_CHOQUE = PARRY_INICIOS[PARRY_CELDA_CHOQUE]
const PARRY_REBOTE = PARRY_INICIOS[42] // cuadro 55: se separan
const PARRY_CAJA = { x: 30, ancho: 300 }
const PARRY_ALTO = (PARRY_CAJA.ancho * PARRY_HOJA.h) / PARRY_HOJA.w
const PARRY_Y = SUELO_Y - (181 / PARRY_HOJA.h) * PARRY_ALTO
const PARRY_CONTACTO = { x: PARRY_CAJA.x + (190 / PARRY_HOJA.w) * PARRY_CAJA.ancho, y: PARRY_Y + (84 / PARRY_HOJA.h) * PARRY_ALTO }
// La fuente de pincel de los kanji también, para que el 忍 no salga con la letra del sistema.
if (typeof document !== 'undefined') document.fonts?.load("64px Pincel", '忍').catch(() => undefined)
// Las hojas se cargan de antemano para que el primer parry no salga vacío.
if (typeof Image !== 'undefined') for (const t of ['claro', 'oscuro']) { const im = new Image(); im.src = `${import.meta.env.BASE_URL}animaciones/parry/parry-${t}.webp`; im.decode?.().catch(() => undefined) }

function ParryVideo({ dur, oscuro }: { dur: number; oscuro: boolean }) {
  const vista = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = vista.current
    if (!el) return
    const t0 = performance.now()
    let id = 0
    let ultimo = -1
    const paso = (ahora: number) => {
      const f = Math.min(1, (ahora - t0) / dur)
      let n = 0
      while (n + 1 < PARRY_INICIOS.length && PARRY_INICIOS[n + 1] <= f) n++
      if (n !== ultimo) {
        ultimo = n
        el.setAttribute('viewBox', `${(n % PARRY_HOJA.cols) * PARRY_HOJA.w} ${Math.floor(n / PARRY_HOJA.cols) * PARRY_HOJA.h} ${PARRY_HOJA.w} ${PARRY_HOJA.h}`)
      }
      if (f < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [dur])
  const { x: cx, y: cy } = PARRY_CONTACTO
  const hoja = `${import.meta.env.BASE_URL}animaciones/parry/parry-${oscuro ? 'oscuro' : 'claro'}.webp`
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`
  // Tiempos del choque y del rebote, como porcentajes de la duración (para las animaciones CSS).
  const tiempos = `
    @keyframes sh-pv-destello { 0%, ${pct(PARRY_CHOQUE - 0.001)} { opacity: 0; transform: scale(.5) } ${pct(PARRY_CHOQUE)} { opacity: .95; transform: scale(1.25) } ${pct(PARRY_CHOQUE + 0.025)} { opacity: .95; transform: scale(1.25) } ${pct(PARRY_CHOQUE + 0.026)}, 100% { opacity: 0; transform: scale(1) } }
    @keyframes sh-pv-brillo { 0%, ${pct(PARRY_CHOQUE - 0.001)} { opacity: 0; transform: scale(.4) } ${pct(PARRY_CHOQUE)} { opacity: 1; transform: scale(1.6) } ${pct(PARRY_REBOTE + 0.06)} { opacity: .4; transform: scale(1) } ${pct(PARRY_REBOTE + 0.12)}, 100% { opacity: 0 } }
    @keyframes sh-pv-chispas { 0%, ${pct(PARRY_CHOQUE - 0.001)} { opacity: 0; transform: scale(.2) } ${pct(PARRY_CHOQUE + 0.01)} { opacity: 1; transform: scale(.6) } ${pct(PARRY_REBOTE + 0.14)}, 100% { opacity: 0; transform: scale(1.8) } }
    @keyframes sh-pv-kanji { 0%, ${pct(PARRY_CHOQUE - 0.001)} { opacity: 0; transform: scale(1.8); filter: drop-shadow(0 0 0 rgba(232,50,60,0)) } ${pct(PARRY_CHOQUE + 0.03)} { opacity: 1; transform: scale(.96); filter: drop-shadow(0 0 14px rgba(232,50,60,.95)) drop-shadow(0 0 4px #ffb347) } ${pct(PARRY_CHOQUE + 0.07)} { transform: scale(1); filter: drop-shadow(0 0 7px rgba(232,50,60,.7)) } ${pct(0.75)} { filter: drop-shadow(0 0 11px rgba(232,50,60,.85)) } 100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 7px rgba(232,50,60,.7)) } }
    @keyframes sh-pv-rebote { 0%, ${pct(PARRY_REBOTE - 0.001)} { transform: none } ${pct(PARRY_REBOTE + 0.01)} { transform: translate(-3px, 1px) } ${pct(PARRY_REBOTE + 0.035)} { transform: translate(2.5px, -1px) } ${pct(PARRY_REBOTE + 0.06)} { transform: translate(-1px, 0) } ${pct(PARRY_REBOTE + 0.085)}, 100% { transform: none } }`
  return (
    <g className="sh-parry-video">
      <style>{tiempos}</style>
      <g className="sh-pv-sacudida">
        <svg ref={vista} className="sh-parry-cuadros" x={PARRY_CAJA.x} y={PARRY_Y} width={PARRY_CAJA.ancho} height={PARRY_ALTO} viewBox={`0 0 ${PARRY_HOJA.w} ${PARRY_HOJA.h}`} preserveAspectRatio="none">
          <image href={hoja} x={0} y={0} width={PARRY_HOJA.w * PARRY_HOJA.cols} height={PARRY_HOJA.h * PARRY_HOJA.filas} />
        </svg>
      </g>
      <circle className="sh-pv-destello" cx={cx} cy={cy} r={22} fill="#fff6d6" />
      <g className="sh-pv-chispas" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 14 }, (_, i) => {
          const ang = (i / 14) * Math.PI * 2 + 0.2
          const r1 = 6
          const r2 = 18 + (i % 4) * 8
          return <line key={i} x1={cx + Math.cos(ang) * r1} y1={cy + Math.sin(ang) * r1} x2={cx + Math.cos(ang) * r2} y2={cy + Math.sin(ang) * r2} stroke={i % 2 ? '#ffb347' : '#ff7a1a'} strokeWidth={2} strokeLinecap="round" />
        })}
      </g>
      <circle className="sh-pv-brillo" cx={cx} cy={cy} r={9} fill="#fffbe8" />
      <Kanji k={KANJI.parry.k} x={310} y={86} clase="sh-kanji sh-pv-kanji" />
    </g>
  )
}

/**
 * Ejecución hecha con los dos videos de Luma de Navil (scripts/ejecucion-sprites.py): el ronin da el paso, carga y
 * corta mientras el rival espera en guardia; en el cuadro en que la hoja queda extendida (46 %, el mismo instante
 * que los efectos de la app) el golpe se congela un instante y arranca la caída del rival, que termina disolviéndose
 * en tinta. 84 cuadros; en «normal» dura 1,5 s (ver cuadroEjecucion).
 */
const EJ_HOJA = { w: 436, h: 158, cols: 10, filas: 9, cuadros: 84 }
const EJ_CAJA = { x: 0, ancho: 360 }
const EJ_ALTO = (EJ_CAJA.ancho * EJ_HOJA.h) / EJ_HOJA.w
const EJ_Y = SUELO_Y - (153 / EJ_HOJA.h) * EJ_ALTO
const aEscena = (x: number, y: number) => ({ x: EJ_CAJA.x + (x / EJ_HOJA.w) * EJ_CAJA.ancho, y: EJ_Y + (y / EJ_HOJA.h) * EJ_ALTO })
const EJ_PUNTA = aEscena(247, 41)
const EJ_TORSO = aEscena(223, 46)
if (typeof Image !== 'undefined') for (const t of ['claro', 'oscuro']) { const im = new Image(); im.src = `${import.meta.env.BASE_URL}animaciones/ejecucion/ejecucion-${t}.webp`; im.decode?.().catch(() => undefined) }
if (typeof document !== 'undefined') document.fonts?.load('64px Pincel', '鍛進描静斬').catch(() => undefined)

/**
 * Cuadro de la tira según la fracción del tiempo (en «normal», 1,5 s):
 * corte rápido 0 → 0,45 s (cuadros 0 a 39), golpe congelado en el cuadro 39 hasta 0,6 s (destello, flash y tinta),
 * caída del rival 0,6 → 1,2 s (cuadros 39 a 72) y disolución en tinta 1,2 → 1,5 s (cuadros 72 a 84).
 * Rápida y Lenta estiran o achican todo igual: el golpe cae siempre al 30 %.
 */
export const TRAMOS_EJECUCION = { impacto: 0.3, finCongelado: 0.4, finCaida: 0.8 }
export function cuadroEjecucion(f: number): number {
  const IMPACTO = 39
  const FIN_CAIDA = 72
  const { impacto, finCongelado, finCaida } = TRAMOS_EJECUCION
  if (f < impacto) return (f / impacto) * IMPACTO
  if (f < finCongelado) return IMPACTO
  if (f < finCaida) return IMPACTO + ((f - finCongelado) / (finCaida - finCongelado)) * (FIN_CAIDA - IMPACTO)
  return Math.min(EJ_HOJA.cuadros, FIN_CAIDA + ((f - finCaida) / (1 - finCaida)) * (EJ_HOJA.cuadros - FIN_CAIDA))
}

function EjecucionVideo({ kanji, dur, oscuro }: { kanji: string; dur: number; oscuro: boolean }) {
  const vista = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = vista.current
    if (!el) return
    const t0 = performance.now()
    let id = 0
    let ultimo = -1
    const paso = (ahora: number) => {
      const f = Math.min(1, (ahora - t0) / dur)
      const n = Math.min(EJ_HOJA.cuadros - 1, Math.floor(cuadroEjecucion(f)))
      if (n !== ultimo) {
        ultimo = n
        el.setAttribute('viewBox', `${(n % EJ_HOJA.cols) * EJ_HOJA.w} ${Math.floor(n / EJ_HOJA.cols) * EJ_HOJA.h} ${EJ_HOJA.w} ${EJ_HOJA.h}`)
      }
      if (f < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [dur])
  const hoja = `${import.meta.env.BASE_URL}animaciones/ejecucion/ejecucion-${oscuro ? 'oscuro' : 'claro'}.webp`
  return (
    <g className="sh-ej-video">
      <svg ref={vista} className="sh-parry-cuadros" x={EJ_CAJA.x} y={EJ_Y} width={EJ_CAJA.ancho} height={EJ_ALTO} viewBox={`0 0 ${EJ_HOJA.w} ${EJ_HOJA.h}`} preserveAspectRatio="none">
        <image href={hoja} x={0} y={0} width={EJ_HOJA.w * EJ_HOJA.cols} height={EJ_HOJA.h * EJ_HOJA.filas} />
      </svg>
      <Sangre cx={EJ_TORSO.x} cy={EJ_TORSO.y} semilla={131} sinMancha />
      <circle className="sh-destello" cx={EJ_PUNTA.x} cy={EJ_PUNTA.y} r={70} fill={ROJO} filter="url(#shBorron)" />
      <circle className="sh-ejv-flash" cx={EJ_PUNTA.x} cy={EJ_PUNTA.y} r={26} fill="#fffbe8" />
      <Kanji k={kanji} x={312} y={70} />
    </g>
  )
}

/**
 * Avanza los cuadros de una tira (sprite) cambiando el viewBox del <svg> con requestAnimationFrame.
 * `mueve` es la fracción de la duración en que se pasan todos los cuadros; después queda el último.
 */
function useCuadros(hoja: { w: number; h: number; cols: number; cuadros: number }, dur: number, mueve = 1) {
  const vista = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const el = vista.current
    if (!el) return
    const t0 = performance.now()
    let id = 0
    let ultimo = -1
    const paso = (ahora: number) => {
      const f = Math.min(1, (ahora - t0) / dur)
      const n = Math.min(hoja.cuadros - 1, Math.floor((f / mueve) * hoja.cuadros))
      if (n !== ultimo) {
        ultimo = n
        el.setAttribute('viewBox', `${(n % hoja.cols) * hoja.w} ${Math.floor(n / hoja.cols) * hoja.h} ${hoja.w} ${hoja.h}`)
      }
      if (f < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [dur, hoja, mueve])
  return vista
}

/**
 * Caramelo con el video de Luma (scripts/solo-sprites.py, caramelo-3.mp4 del cuadro 8 al 84): medio paso, se arrodilla,
 * lleva la mano a la bufanda (la app dibuja el caramelo rojo en la mano) y junta las manos; desde ahí sube el aura.
 * Escala de la escena: 0,19 por px del video.
 */
const CAR_HOJA = { w: 176, h: 235, cols: 10, filas: 6, cuadros: 56 }
const CAR_CAJA = { x: 111, y: SUELO_Y - 550 * 0.19, ancho: 420 * 0.19, alto: 560 * 0.19 }
const CAR_MANO = { x: CAR_CAJA.x + 345 * 0.19, y: CAR_CAJA.y + 235 * 0.19 }
/** Logro con el video de Luma (logro-4.mp4 del cuadro 13 al 96): corte, el kasa vuela, katana al cielo (cuadro 56 de 80). */
const LOG_HOJA = { w: 357, h: 273, cols: 10, filas: 8, cuadros: 80 }
const LOG_CAJA = { x: 92, y: SUELO_Y - 643 * 0.19, ancho: 850 * 0.19, alto: 650 * 0.19 }
const LOG_PUNTA = { x: LOG_CAJA.x + 368 * 0.19, y: LOG_CAJA.y + 6 * 0.19 }
if (typeof Image !== 'undefined') for (const n of ['caramelo', 'logro']) for (const t of ['claro', 'oscuro']) { const im = new Image(); im.src = `${import.meta.env.BASE_URL}animaciones/${n}/${n}-${t}.webp`; im.decode?.().catch(() => undefined) }

function PosturaVideo({ modo, dur, oscuro }: { modo: '321' | 'siguiente'; dur: number; oscuro: boolean }) {
  const color = modo === '321' ? '#e8323c' : '#8b6cf0'
  const k = KANJI[modo].k
  const vista = useCuadros(CAR_HOJA, dur)
  const hoja = `${import.meta.env.BASE_URL}animaciones/caramelo/caramelo-${oscuro ? 'oscuro' : 'claro'}.webp`
  const x = CAR_CAJA.x + 59
  return (
    <g className={`sh-postura sh-postura-video ${modo === 'siguiente' ? 'lenta' : ''}`} style={{ '--aura': color } as CSSProperties}>
      <g transform={`translate(${x},${SUELO_Y})`}>
        <path className="sh-aura" filter="url(#shBorron)" d="M-40,0 C-48,-36 -26,-54 -16,-84 C-10,-70 -2,-96 6,-106 C10,-84 20,-76 26,-90 C38,-62 46,-36 40,0 Z" fill={color} />
        {modo === 'siguiente' && <path className="sh-aura sh-aura-2" filter="url(#shBorron)" d="M-30,0 C-36,-30 -18,-44 -10,-70 C-4,-58 2,-80 8,-88 C12,-70 20,-62 24,-74 C32,-50 36,-28 30,0 Z" fill="#3fbf7f" />}
        <g className="sh-aura-giro" style={{ transformOrigin: '0px -40px' }}>
          <ellipse cx={0} cy={-4} rx={44} ry={9} fill="none" stroke={color} strokeWidth={2} opacity={0.5} strokeDasharray="14 10" />
        </g>
      </g>
      <circle className="sh-onda" cx={x} cy={SUELO_Y - 40} r={30} fill="none" stroke={color} strokeWidth={3} />
      <svg ref={vista} className="sh-parry-cuadros" x={CAR_CAJA.x} y={CAR_CAJA.y} width={CAR_CAJA.ancho} height={CAR_CAJA.alto} viewBox={`0 0 ${CAR_HOJA.w} ${CAR_HOJA.h}`} preserveAspectRatio="none">
        <image href={hoja} x={0} y={0} width={CAR_HOJA.w * CAR_HOJA.cols} height={CAR_HOJA.h * CAR_HOJA.filas} />
      </svg>
      <circle className="sh-caramelo-v" cx={CAR_MANO.x} cy={CAR_MANO.y} r={2.6} fill={ROJO} stroke="var(--sh-papel)" strokeWidth={0.7} />
      <Kanji k={k} x={300} y={92} clase="sh-kanji sh-kanji-aura" color={color} />
    </g>
  )
}

function LogroVideo({ clase, dur, oscuro }: { clase: 'nivel' | 'racha' | 'fase' | 'record'; dur: number; oscuro: boolean }) {
  const k = KANJI[clase].k
  // 2 s de movimiento (77 % de 2,6 s) y después la pose de victoria quieta con el sello.
  const vista = useCuadros(LOG_HOJA, dur, 2000 / 2600)
  const hoja = `${import.meta.env.BASE_URL}animaciones/logro/logro-${oscuro ? 'oscuro' : 'claro'}.webp`
  return (
    <g className="sh-logro sh-logro-video">
      <svg ref={vista} className="sh-parry-cuadros" x={LOG_CAJA.x} y={LOG_CAJA.y} width={LOG_CAJA.ancho} height={LOG_CAJA.alto} viewBox={`0 0 ${LOG_HOJA.w} ${LOG_HOJA.h}`} preserveAspectRatio="none">
        <image href={hoja} x={0} y={0} width={LOG_HOJA.w * LOG_HOJA.cols} height={LOG_HOJA.h * LOG_HOJA.filas} />
      </svg>
      <circle className="sh-logv-brillo" cx={LOG_PUNTA.x} cy={LOG_PUNTA.y} r={16} fill="#fffbe8" />
      <circle className="sh-logv-flash" cx={180} cy={120} r={260} fill="#fff" />
      <g className="sh-sello" style={{ transformOrigin: '72px 62px' }}>
        <rect x={44} y={34} width={56} height={56} rx={7} fill={ROJO} />
        <rect x={49} y={39} width={46} height={46} rx={4} fill="none" stroke="#f6d9d9" strokeWidth={1.5} />
        <Kanji k={k} x={72} y={78} tam={38} clase="" color="#fff" />
      </g>
    </g>
  )
}

function Postura({ modo, dur }: { modo: '321' | 'siguiente'; dur: number }) {
  const color = modo === '321' ? '#e8323c' : '#8b6cf0'
  const k = KANJI[modo].k
  const x = 170
  const claves = useMemo(() => secPostura(modo), [modo])
  // El caramelo aparece en la mano y va a la boca (puntos calculados de la pose).
  const [mx, my] = puntoMano(poseEn(claves, 0.3))
  const [bx, by] = puntoBoca(poseEn(claves, 0.42))
  return (
    <g className={`sh-postura ${modo === 'siguiente' ? 'lenta' : ''}`} style={{ '--aura': color, '--cx': `${(mx - bx) * ESCALA}px`, '--cy': `${(my - by) * ESCALA}px` } as CSSProperties}>
      <g transform={`translate(${x},${SUELO_Y})`}>
        <path className="sh-aura" filter="url(#shBorron)" d="M-40,0 C-48,-36 -26,-54 -16,-84 C-10,-70 -2,-96 6,-106 C10,-84 20,-76 26,-90 C38,-62 46,-36 40,0 Z" fill={color} />
        <g className="sh-aura-giro" style={{ transformOrigin: '0px -40px' }}>
          <ellipse cx={0} cy={-4} rx={44} ry={9} fill="none" stroke={color} strokeWidth={2} opacity={0.5} strokeDasharray="14 10" />
        </g>
      </g>
      <circle className="sh-onda" cx={x} cy={SUELO_Y - 40} r={30} fill="none" stroke={color} strokeWidth={3} />
      <Actor claves={claves} dur={dur} x={x} />
      <circle className="sh-caramelo" cx={x + bx * ESCALA} cy={SUELO_Y + by * ESCALA} r={3.6} fill={color} stroke="var(--sh-papel)" strokeWidth={0.8} />
      <Kanji k={k} x={300} y={92} clase="sh-kanji sh-kanji-aura" color={color} />
    </g>
  )
}

function Logro({ clase, dur, enemigo }: { clase: 'nivel' | 'racha' | 'fase' | 'record'; dur: number; enemigo: VarianteEnemigo }) {
  const estilo: EstiloCorte = clase === 'nivel' ? 'diagonal' : clase === 'racha' || clase === 'record' ? 'horizontal' : 'vertical'
  const k = KANJI[clase].k
  return (
    <g className="sh-logro">
      {/* Enemigo, corte y sangre van comprimidos al 62 % de la duración; el actor sigue toda la duración */}
      <g className="sh-sub" style={{ '--dur': `${dur * 0.62}ms` } as CSSProperties}>
        <Ejecucion estilo={estilo} kanji="" dur={dur * 0.62} sinSalida sinActor enemigo={enemigo} />
      </g>
      <Actor className="sh-actor sh-actor-logro" claves={SEC_LOGRO} dur={dur} x={ACTOR_X} viento={VIENTO_LOGRO} />
      {/* El sombrero sale despedido con el corte, gira y cae al suelo */}
      <g transform={`translate(${CABEZA_FIN.x},${CABEZA_FIN.y})`} style={{ '--caida': `${SUELO_Y - CABEZA_FIN.y - 3}px` } as CSSProperties}>
        <g className="sh-kasa-vuela"><g className="sh-kasa-giro"><g transform={`scale(${ESCALA})`}><Sombrero ang={0} /></g></g></g>
      </g>
      <g className="sh-sello" style={{ transformOrigin: '72px 62px' }}>
        <rect x={44} y={34} width={56} height={56} rx={7} fill={ROJO} />
        <rect x={49} y={39} width={46} height={46} rx={4} fill="none" stroke="#f6d9d9" strokeWidth={1.5} />
        <Kanji k={k} x={72} y={78} tam={38} clase="" color="#fff" />
      </g>
    </g>
  )
}

// ---------- Capa: superpone la escena actual sobre toda la app ----------

/** Fondo épico: carbón con el cielo de lluvia de Progreso desenfocado y oscurecido, y lluvia fina. Sin paso por blanco. */
export function FondoEpico() {
  const img = urlTema(rutaTema('fondos/lluvia.jpg'))
  return (
    <div className="sh-epico" aria-hidden>
      <div className="sh-epico-cielo" style={{ backgroundImage: `url(${img})` }} />
      <div className="sh-epico-lluvia" />
    </div>
  )
}

export function Escena({ a, nombre, lento = 1, tema = 'epico', tinta = true, onSaltar }: { a: EnCurso; nombre: string; lento?: number; tema?: 'claro' | 'oscuro' | 'epico'; tinta?: boolean; onSaltar: () => void }) {
  const dur = duracionDe(a) * lento
  const reducido = movimientoReducido()
  const estilo = useMemo<EstiloCorte>(() => (a.tipo === 'ejecucion' ? a.estilo ?? elegirCorte(a.pilar) : 'diagonal'), [a])
  const enemigo = useMemo<VarianteEnemigo>(() => VARIANTES_ENEMIGO[Math.floor(Math.random() * VARIANTES_ENEMIGO.length) % VARIANTES_ENEMIGO.length], [a])
  let titulo: ReactNode = null
  let sub: ReactNode = null
  let kanji = ''
  let color = ROJO
  if (a.tipo === 'ejecucion') {
    const k = KANJI[a.pilar] ?? { k: '斬', significado: 'cortar' }
    kanji = k.k
    titulo = a.titulo ?? nombreDePilar(a.pilar)
    sub = <>{k.k} · {k.significado} · {nombre}</>
  } else if (a.tipo === 'postura') {
    const k = KANJI[a.modo]
    kanji = k.k
    color = a.modo === '321' ? '#e8323c' : '#8b6cf0'
    titulo = a.modo === '321' ? '3 · 2 · 1' : 'Siguiente acción'
    sub = <>{k.k} · {k.significado} · caramelo de monje</>
  } else if (a.tipo === 'logro') {
    const k = KANJI[a.clase]
    kanji = k.k
    titulo = a.texto
    sub = a.sub ?? <>{k.k} · {k.significado}</>
  } else if (a.tipo === 'parry' && !a.vieja) {
    kanji = KANJI.parry.k
    sub = <>{KANJI.parry.k} · {KANJI.parry.significado}</>
  } else {
    kanji = '弾'
  }

  const epico = tema === 'epico'
  const temaClase = `${tema === 'oscuro' ? 'oscura' : epico ? 'oscura epica' : ''} ${tinta ? '' : 'sin-tinta'}`
  if (reducido) {
    // Sin movimiento: solo un destello de color y el texto.
    if (a.tipo === 'parry' && a.vieja) return null
    return (
      <div className={`sh-capa reducida ${temaClase}`} style={{ '--color': color } as CSSProperties} onPointerDown={onSaltar} role="status" aria-label={typeof titulo === 'string' ? titulo : 'Logro'}>
        <div className="sh-reducida-k" style={{ color }}>{kanji}</div>
        {titulo && <div className="sh-titulo">{titulo}</div>}
        {sub && <div className="sh-sub-texto">{sub}</div>}
      </div>
    )
  }

  // El parry anterior (muñeco) es chiquito abajo y deja pasar los toques; el de Luma es una escena grande como las demás.
  const parry = a.tipo === 'parry' && !!a.vieja
  const parryVideo = a.tipo === 'parry' && !a.vieja
  const luma = (a.tipo === 'postura' || a.tipo === 'logro') && !a.vieja
  const ejVideo = a.tipo === 'ejecucion' && !a.vieja
  return (
    <div className={`sh-capa ${parry ? 'parry-chico' : ''} ${parryVideo ? 'parry-video' : ''} ${luma ? 'luma' : ''} ${ejVideo ? 'ej-video' : ''} ${a.tipo} ${temaClase}`} style={{ '--dur': `${dur}ms` } as CSSProperties} onPointerDown={parry ? undefined : onSaltar} role="status" aria-label={a.tipo === 'parry' ? 'Parry' : typeof titulo === 'string' ? titulo : 'Animación de logro'}>
      {epico && <FondoEpico />}
      <svg className="sh-escenario" viewBox="0 0 360 240" aria-hidden>
        <Fondo tinte={a.tipo === 'postura' ? color : undefined} lluvia={a.tipo === 'logro' || epico} epico={epico} />
        {a.tipo === 'ejecucion' && (a.vieja ? <Ejecucion estilo={estilo} kanji={kanji} dur={dur} enemigo={enemigo} /> : <EjecucionVideo kanji={kanji} dur={dur} oscuro={tema === 'oscuro'} />)}
        {a.tipo === 'parry' && (a.vieja ? <Parry dur={dur} /> : <ParryVideo dur={dur} oscuro={tema === 'oscuro'} />)}
        {a.tipo === 'postura' && (a.vieja ? <Postura modo={a.modo} dur={dur} /> : <PosturaVideo modo={a.modo} dur={dur} oscuro={tema === 'oscuro'} />)}
        {a.tipo === 'logro' && (a.vieja ? <Logro clase={a.clase} dur={dur} enemigo={enemigo} /> : <LogroVideo clase={a.clase} dur={dur} oscuro={tema === 'oscuro'} />)}
      </svg>
      {a.tipo === 'ejecucion' && a.rival && <div className="sh-cartel-rival">{a.rival}</div>}
      {!parry && (
        <div className="sh-textos">
          {titulo && <div className="sh-titulo">{titulo}</div>}
          {sub && <div className="sh-sub-texto">{sub}</div>}
          <div className="sh-saltar">tocá para saltar</div>
        </div>
      )}
    </div>
  )
}

