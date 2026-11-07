/**
 * Botón 「進」 Tensión: SEK pide el evento genérico «tension» y el tema pone la escena (src/temas/shinobi/EscenaTension).
 * Si le das la mano: 進 y «Avanzá igual.». Si no: la caída (sigue en la tumba, sin «Te arrasan»).
 * Sin tope ni XP. Si no le das la mano («No le doy la mano», a los 5 s de espera): caída y nuevo round. El botón solo aparece cuando los clips existen (hayClipsTension). Kanji y frase editables en Ajustes.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { obtenerAjustes } from '../services/base'
import { configuracionAnimaciones } from './animaciones/motor'
import { movimientoReducido } from './componentes'
import { pedirDuelo } from './Duelo'
import { CLIP_PRUEBA_TENSION, EscenaTension } from '../temas/shinobi/EscenaTension'
import { pedirCaida } from './Caida'

export const KANJI_TENSION = '進'
export const FRASE_TENSION = 'Avanzá igual.'


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
        const r = await fetch(CLIP_PRUEBA_TENSION, { method: 'HEAD', cache: 'no-store' })
        // En GitHub Pages un archivo que falta devuelve 404; en el servidor local puede devolver index.html: se exige video.
        return r.ok && (r.headers.get('content-type') ?? '').startsWith('video')
      } catch {
        return false
      }
    })().then((v) => { hayClips = v; for (const o of oyentesClips) o(); return v })
  }
  return revisando
}

/** true cuando los clips están en public/temas/shinobi/tension/ (false mientras se revisa o si faltan). */
export function useClipsTension(): boolean {
  useEffect(() => { void hayClipsTension() }, [])
  return useSyncExternalStore((o) => { oyentesClips.add(o); return () => oyentesClips.delete(o) }, () => hayClips === true, () => false)
}

// ---------- Pedido ----------
/** `prueba` (Ver animaciones): no anota la caída. `auto`: elige sola después de cuatro vueltas de la espera. */
type Pedido = { n: number; prueba: boolean; auto?: 'mano' | 'soltar' }
let pedido: Pedido | null = null
let cuenta = 0
const oyentes = new Set<() => void>()
export function pedirTension(op: { prueba?: boolean; auto?: 'mano' | 'soltar' } = {}): void { pedido = { n: ++cuenta, prueba: !!op.prueba, auto: op.auto }; for (const o of oyentes) o() }
function cerrarTension(): void { pedido = null; for (const o of oyentes) o() }

export function TensionCapa() {
  const p = useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pedido, () => null)
  if (!p) return null
  return <Tension key={p.n} pedido={p} />
}

function Tension({ pedido: p }: { pedido: Pedido }) {
  const [texto, setTexto] = useState({ kanji: KANJI_TENSION, frase: FRASE_TENSION })
  const [reducido] = useState(() => movimientoReducido())
  useEffect(() => { void obtenerAjustes().then((a) => setTexto({ kanji: a.tension?.kanji?.trim() || KANJI_TENSION, frase: a.tension?.frase ?? FRASE_TENSION })) }, [])
  return (
    <EscenaTension
      kanji={texto.kanji}
      frase={texto.frase}
      sonido={configuracionAnimaciones().sonido}
      reducido={reducido}
      auto={p.auto}
      onFin={() => { cerrarTension(); pedirDuelo({ motivo: 'tension', prueba: p.prueba }) }}
      onSalir={cerrarTension}
      onSoltar={() => { void pedirCaida('tension', { prueba: p.prueba, desdeTension: true }).then(cerrarTension) }}
    />
  )
}

