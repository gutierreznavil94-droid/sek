/**
 * Siluetas y escenitas a tinta armadas con el muñeco articulado (sin clips de Luma):
 * - EscenaCasa (Juego): la casa con la mesa y el televisor; los dos en guardia, jugando o tomando té.
 * - BuenasNoches (modo sueño): el shinobi deja la katana y el sombrero y se acuesta.
 * - CompaneroDormido (Hoy, después de «Dejo celu»): la cama en una esquina.
 * Cuando lleguen los clips (J1–J5, N1–N2) se reemplaza cada escena por su video; el resto de la pantalla no cambia.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Munieco, pose } from './munieco'
import { Enemigo } from './Escena'

const TINTA = 'var(--sh-tinta, #141414)'
const PAPEL = 'var(--sh-papel, #f3efe6)'

/** Shinobi quieto en guardia (mira a la derecha), con los pies en (0,0). */
function ShinobiGuardia({ x, y = 0, escala = 0.82, espejo = false }: { x: number; y?: number; escala?: number; espejo?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${espejo ? -escala : escala},${escala})`}>
      <Munieco p={pose('guardia')} />
    </g>
  )
}

/** Silueta sentada de espaldas a nosotros, frente al televisor: un bulto con cabeza; con mando o taza según el estado. */
function Sentado({ x, y, color = TINTA, mando, taza, sombrero }: { x: number; y: number; color?: string; mando?: boolean; taza?: boolean; sombrero?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Piernas cruzadas, espalda y cabeza */}
      <path d="M-22,0 C-24,-10 -14,-14 0,-14 C14,-14 24,-10 22,0 Z" fill={color} />
      <path d="M-14,-10 C-16,-36 -10,-50 0,-52 C10,-50 16,-36 14,-10 Z" fill={color} />
      <circle cx={0} cy={-58} r={8.5} fill={color} />
      {sombrero && <path d="M-15,-61 L15,-61 L2,-71 L-2,-71 Z" fill={color} />}
      {/* Brazos hacia adelante con el mando, o con la taza (sube y baja) */}
      {mando && <path d="M-10,-30 L-6,-22 L6,-22 L10,-30" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />}
      {mando && <rect x={-7} y={-25} width={14} height={6} rx={2} fill={color} className="sl-mando" />}
      {taza && <g className="sl-taza"><path d="M-8,-30 L-4,-24 L4,-24 L8,-30" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" /><rect x={-4} y={-30} width={8} height={7} rx={1.5} fill={PAPEL} stroke={color} strokeWidth={1.2} /><path d="M-1,-33 C-2,-36 0,-37 -1,-40 M2,-33 C1,-36 3,-37 2,-40" fill="none" stroke={color} strokeWidth={0.8} opacity={0.6} className="sl-vapor" /></g>}
    </g>
  )
}

export type EstadoCasa = 'pelea' | 'jugando' | 'te'

/**
 * La casa: pared con una ventana, mesa baja y televisor. Estados: pelea (los dos en guardia, con un pequeño vaivén),
 * jugando (sentados con mandos, pantalla prendida) y té (sentados con tazas). `transicion` marca «a jugar» o «terminar».
 */
export function EscenaCasa({ estado, transicion }: { estado: EstadoCasa; transicion?: 'a-jugar' | 'terminar' | null }) {
  const sentados = estado !== 'pelea'
  const tv = estado === 'jugando'
  return (
    <svg className={`sl-casa ${estado} ${transicion ?? ''}`} viewBox="0 0 360 160" aria-label={estado === 'pelea' ? 'El shinobi y el rival pelean en la casa' : estado === 'jugando' ? 'Los dos juegan frente al televisor' : 'Los dos toman té en la pausa'}>
      <rect x={0} y={0} width={360} height={160} fill={PAPEL} />
      {/* Pared: una línea de zócalo, una ventana con la luna */}
      <line x1={0} y1={128} x2={360} y2={128} stroke={TINTA} strokeWidth={1.2} opacity={0.5} />
      <rect x={250} y={18} width={62} height={46} fill="none" stroke={TINTA} strokeWidth={1.6} />
      <line x1={281} y1={18} x2={281} y2={64} stroke={TINTA} strokeWidth={1} opacity={0.6} />
      <line x1={250} y1={41} x2={312} y2={41} stroke={TINTA} strokeWidth={1} opacity={0.6} />
      <circle cx={296} cy={32} r={5} fill={TINTA} opacity={0.5} />
      {/* Cuadro colgado con el kanji 家 */}
      <rect x={40} y={22} width={30} height={30} fill="none" stroke={TINTA} strokeWidth={1.4} />
      <text x={55} y={44} textAnchor="middle" fontSize={18} fontFamily="'Noto Serif JP', serif" fill={TINTA}>家</text>
      {/* Mesa baja con el televisor */}
      <path d="M118,128 L126,98 L234,98 L242,128 Z" fill="none" stroke={TINTA} strokeWidth={1.8} strokeLinejoin="round" />
      <line x1={126} y1={98} x2={234} y2={98} stroke={TINTA} strokeWidth={3} />
      <rect x={148} y={62} width={64} height={36} rx={2} fill={TINTA} />
      <rect x={152} y={66} width={56} height={26} rx={1} className="sl-pantalla" fill={tv ? '#cfe8d6' : '#3a3836'} />
      {tv && <g className="sl-juego"><rect x={160} y={74} width={6} height={6} fill={TINTA} /><rect x={190} y={80} width={8} height={4} fill={TINTA} /><circle cx={180} cy={72} r={2} fill={TINTA} /></g>}
      <line x1={180} y1={98} x2={180} y2={102} stroke={TINTA} strokeWidth={2} />
      {/* Katanas en la pared mientras juegan */}
      {sentados && <g className="sl-katanas"><line x1={300} y1={92} x2={344} y2={84} stroke={TINTA} strokeWidth={2.2} strokeLinecap="round" /><line x1={300} y1={102} x2={344} y2={94} stroke="#8a8a92" strokeWidth={2.2} strokeLinecap="round" /></g>}
      {/* Suelo de pincel */}
      <path d="M-5,150 C60,146 120,152 180,148 C240,144 300,152 365,147 L365,160 L-5,160 Z" fill={TINTA} />
      {/* Los personajes */}
      {!sentados && (
        <g className="sl-peleando">
          <g className="sl-shinobi"><ShinobiGuardia x={80} y={150} /></g>
          <g className="sl-rival" transform="translate(290,150) scale(1.1)"><Enemigo variante="ronin" /></g>
        </g>
      )}
      {sentados && (
        <g className="sl-sentados">
          <Sentado x={140} y={150} mando={tv} taza={estado === 'te'} sombrero />
          <Sentado x={222} y={150} color="#4b4b4b" mando={tv} taza={estado === 'te'} />
        </g>
      )}
    </svg>
  )
}

/** Escena de la casa con el pequeño cambio de estado animado («a jugar» / «terminar»), para Juego. */
export function CasaDelJuego({ activa, pausada }: { activa: boolean; pausada: boolean }) {
  const estado: EstadoCasa = !activa ? 'pelea' : pausada ? 'te' : 'jugando'
  const [anterior, setAnterior] = useState(estado)
  const [transicion, setTransicion] = useState<'a-jugar' | 'terminar' | null>(null)
  useEffect(() => {
    if (anterior === estado) return
    if (anterior === 'pelea') setTransicion('a-jugar')
    else if (estado === 'pelea') setTransicion('terminar')
    setAnterior(estado)
    const id = window.setTimeout(() => setTransicion(null), 1200)
    return () => window.clearTimeout(id)
  }, [estado, anterior])
  return (
    <div className="sl-casa-marco" aria-hidden={false}>
      <EscenaCasa estado={estado} transicion={transicion} />
      <span className="sl-casa-nota">{estado === 'pelea' ? 'Pelean en la casa hasta que empieces a jugar' : estado === 'jugando' ? 'Jugando, concentrados' : 'Pausa: té'}</span>
    </div>
  )
}

/**
 * Buenas noches: el shinobi deja la katana apoyada en la pared, cuelga el sombrero, se acuesta y se queda dormido
 * (respiración lenta en bucle). Una sola vez por pantalla; el último cuadro queda.
 */
export function BuenasNoches({ estilo }: { estilo?: CSSProperties }) {
  return (
    <svg className="sl-noche" viewBox="0 0 360 170" style={estilo} aria-label="El shinobi deja la katana y el sombrero y se acuesta">
      {/* Pared y suelo */}
      <line x1={0} y1={138} x2={360} y2={138} stroke="#6b6f78" strokeWidth={1} opacity={0.5} />
      <rect x={262} y={18} width={54} height={40} fill="none" stroke="#6b6f78" strokeWidth={1.4} />
      <circle cx={300} cy={30} r={5} fill="#9a9ea8" opacity={0.6} />
      {/* Katana contra la pared y el sombrero colgado: aparecen en orden */}
      <g className="sl-noche-katana"><line x1={52} y1={136} x2={64} y2={78} stroke="#9a9ea8" strokeWidth={2.4} strokeLinecap="round" /><circle cx={62} cy={88} r={3} fill="none" stroke="#9a9ea8" strokeWidth={1.2} /></g>
      <g className="sl-noche-sombrero"><circle cx={96} cy={48} r={2} fill="#9a9ea8" /><path d="M78,66 L114,66 L98,50 L94,50 Z" fill="#9a9ea8" /></g>
      {/* La cama */}
      <g className="sl-noche-cama">
        <rect x={150} y={108} width={170} height={28} rx={3} fill="none" stroke="#9a9ea8" strokeWidth={1.8} />
        <rect x={152} y={118} width={166} height={18} fill="#2a2d33" />
        <rect x={158} y={102} width={34} height={14} rx={4} fill="#9a9ea8" />
        <line x1={150} y1={136} x2={150} y2={146} stroke="#9a9ea8" strokeWidth={2} />
        <line x1={320} y1={136} x2={320} y2={146} stroke="#9a9ea8" strokeWidth={2} />
      </g>
      {/* El shinobi camina hasta la cama y se desvanece; en la cama aparece acostado respirando */}
      <g className="sl-noche-camina" fill="#9a9ea8"><g transform="translate(90,138) scale(0.78)"><Munieco p={pose('carrera')} /></g></g>
      <g className="sl-noche-acostado">
        <path d="M188,118 C210,108 290,110 310,116 C312,124 300,126 260,126 C220,126 192,126 188,118 Z" fill="#9a9ea8" />
        <circle cx={176} cy={110} r={8} fill="#9a9ea8" />
        <text x={300} y={96} fontSize={14} fontFamily="'Noto Serif JP', serif" fill="#6b6f78" className="sl-noche-z">眠</text>
      </g>
    </svg>
  )
}

/** El compañero dormido en su cama, en una esquina de Hoy (después de «Dejo celu»). */
export function CompaneroDormido() {
  return (
    <svg className="companero-cama" viewBox="0 0 120 56" width={120} height={56} aria-label="El compañero duerme">
      <rect x={10} y={30} width={100} height={16} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <rect x={12} y={36} width={96} height={10} fill="currentColor" opacity={0.25} />
      <rect x={14} y={26} width={22} height={9} rx={3} fill="currentColor" />
      <g className="companero-cama-cuerpo"><path d="M34,35 C50,27 92,28 106,33 C106,38 96,39 70,39 C48,39 36,39 34,35 Z" fill="currentColor" /><circle cx={26} cy={30} r={5} fill="currentColor" /></g>
      <line x1={10} y1={46} x2={10} y2={52} stroke="currentColor" strokeWidth={1.6} /><line x1={110} y1={46} x2={110} y2={52} stroke="currentColor" strokeWidth={1.6} />
      <path d="M100,10 L112,10 L104,20 L100,20" fill="none" stroke="currentColor" strokeWidth={1.2} className="companero-cama-z" />
      <text x={84} y={20} fontSize={11} fontFamily="'Noto Serif JP', serif" fill="currentColor" opacity={0.8}>眠</text>
    </svg>
  )
}
