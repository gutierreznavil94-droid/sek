/**
 * Botón 「進」 Tensión: cinemática con los clips de Luma (public/animaciones/tension/):
 * T1 la mirada → T2 el ejército → T3 la mano → T3b la espera (bucle hasta tocar) → T4 la carga → kanji 進 y «Avanzá igual.».
 * Sin tope ni XP. Si no le das la mano («No le doy la mano», a los 5 s de espera): caída y nuevo round. El botón solo aparece cuando los clips existen (hayClipsTension). Kanji y frase editables en Ajustes.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { obtenerAjustes } from '../services/base'
import { configuracionAnimaciones, sonarLluvia, sonarTaiko } from './animaciones/motor'
import { pedirCaida } from './Caida'

export const CLIPS_TENSION = ['t1-mirada', 't2-ejercito', 't3-mano', 't3b-espera', 't4-carga'] as const
type Clip = (typeof CLIPS_TENSION)[number]
export const KANJI_TENSION = '進'
export const FRASE_TENSION = 'Avanzá igual.'

function rutaClip(c: Clip): string { return `${import.meta.env.BASE_URL}animaciones/tension/${c}.mp4` }

// ---------- ¿Están los clips? (se revisa una vez por carga) ----------
let hayClips: boolean | null = null
let revisando: Promise<boolean> | null = null
const oyentesClips = new Set<() => void>()

export function hayClipsTension(): Promise<boolean> {
  if (hayClips !== null) return Promise.resolve(hayClips)
  if (!revisando) {
    revisando = (async () => {
      try {
        if (typeof fetch === 'undefined') return false
        const r = await fetch(rutaClip('t1-mirada'), { method: 'HEAD', cache: 'no-store' })
        // En GitHub Pages un archivo que falta devuelve 404; en el servidor local puede devolver index.html: se exige video.
        return r.ok && (r.headers.get('content-type') ?? '').startsWith('video')
      } catch {
        return false
      }
    })().then((v) => { hayClips = v; for (const o of oyentesClips) o(); return v })
  }
  return revisando
}

/** true cuando los clips están en public/animaciones/tension/ (false mientras se revisa o si faltan). */
export function useClipsTension(): boolean {
  useEffect(() => { void hayClipsTension() }, [])
  return useSyncExternalStore((o) => { oyentesClips.add(o); return () => oyentesClips.delete(o) }, () => hayClips === true, () => false)
}

// ---------- Pedido ----------
let abierta = false
const oyentes = new Set<() => void>()
export function pedirTension(): void { abierta = true; for (const o of oyentes) o() }
function cerrarTension(): void { abierta = false; for (const o of oyentes) o() }

export function TensionCapa() {
  const activa = useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => abierta, () => false)
  if (!activa) return null
  return <Tension onFin={cerrarTension} />
}

type Fase = Clip | 'final'
const SIGUIENTE: Record<Clip, Fase> = { 't1-mirada': 't2-ejercito', 't2-ejercito': 't3-mano', 't3-mano': 't3b-espera', 't3b-espera': 't3b-espera', 't4-carga': 'final' }

function Tension({ onFin }: { onFin: () => void }) {
  const [fase, setFase] = useState<Fase>('t1-mirada')
  const [texto, setTexto] = useState({ kanji: KANJI_TENSION, frase: FRASE_TENSION })
  const video = useRef<HTMLVideoElement>(null)
  const sonido = configuracionAnimaciones().sonido
  useEffect(() => { void obtenerAjustes().then((a) => setTexto({ kanji: a.tension?.kanji?.trim() || KANJI_TENSION, frase: a.tension?.frase ?? FRASE_TENSION })) }, [])
  // Lluvia suave generada durante T1–T3; silencio en la espera; taiko al aparecer el kanji.
  useEffect(() => {
    if (!sonido) return
    if (fase === 'final') { sonarTaiko(); return }
    if (fase === 't3b-espera') return
    return sonarLluvia()
  }, [fase, sonido])
  useEffect(() => {
    if (fase === 'final') { try { navigator.vibrate?.([60, 40, 200]) } catch { /* sin vibración */ } }
  }, [fase])
  // Si un clip no carga (archivo roto), se salta al siguiente para no dejar la pantalla trabada.
  const siguiente = () => { if (fase !== 'final') setFase(SIGUIENTE[fase]) }
  useEffect(() => {
    const v = video.current
    if (!v || fase === 'final') return
    v.play().catch(() => undefined)
  }, [fase])
  const espera = fase === 't3b-espera'
  const final = fase === 'final'
  // Si no le das la mano: a los 5 s de espera aparece «Soltar la mano», que lleva a la caída (nuevo round).
  const [puedeSoltar, setPuedeSoltar] = useState(false)
  useEffect(() => {
    if (!espera) return
    const id = window.setTimeout(() => setPuedeSoltar(true), 5000)
    return () => window.clearTimeout(id)
  }, [espera])
  const soltar = () => { onFin(); void pedirCaida('tension') }
  const tocar = () => {
    if (espera) setFase('t4-carga')
    else if (final) onFin()
  }
  return (
    <div className={`tn-capa ${fase}`} role="dialog" aria-label="Tensión" onPointerDown={tocar}>
      {!final && (
        <video key={fase} ref={video} className="tn-video" src={rutaClip(fase)} playsInline muted autoPlay loop={espera} preload="auto" onEnded={espera ? undefined : siguiente} onError={siguiente} />
      )}
      {espera && (
        <div className="tn-espera" aria-hidden>
          <span className="tn-aro" />
          <span className="tn-tocalo">Tocalo</span>
        </div>
      )}
      {espera && puedeSoltar && <button type="button" className="tn-soltar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); soltar() }}>No le doy la mano</button>}
      {final && (
        <div className="tn-final">
          <div className="tn-kanji" aria-label={texto.kanji}>{texto.kanji}</div>
          {texto.frase && <div className="tn-frase">{texto.frase}</div>}
          <div className="tn-cerrar">tocá para volver</div>
        </div>
      )}
      {!final && !espera && <button type="button" className="tn-saltar" onClick={(e) => { e.stopPropagation(); onFin() }} onPointerDown={(e) => e.stopPropagation()}>Salir</button>}
    </div>
  )
}
