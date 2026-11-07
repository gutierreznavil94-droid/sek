/**
 * Caída: SEK dispara el evento genérico «caida» (botón «No cumplí mi palabra» o soltar la mano en Tensión),
 * guarda la marca del día y saca la XP. La escena la pone el tema. Al cerrarla, «Deshacer» durante 10 s.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { DESHACER_CAIDA_MS, deshacerCaida, registrarCaida, xpCaidaDe } from '../services/caidas'
import { obtenerAjustes } from '../services/base'
import { ahora } from '../services/reloj'
import { fechaDe } from '../domain/fechas'
import type { Caida } from '../data/tipos'
import { pedirDuelo } from './Duelo'
import { EscenaCaida } from '../temas/shinobi/EscenaCaida'
import { configuracionAnimaciones, sonarEstampida } from './animaciones/motor'
import { Confirmar, movimientoReducido } from './componentes'
import { avisar, mutar } from './estado'

type Pedido = { caida: Caida | null; xp: number; desdeTension: boolean; n: number }
let cuenta = 0
let pedido: Pedido | null = null
const oyentes = new Set<() => void>()
function avisarOyentes() { for (const o of oyentes) o() }

/** Registra la caída de hoy y muestra la escena. `prueba`: solo la escena (Ver animaciones), sin tocar datos. */
export async function pedirCaida(origen: Caida['origen'], op: { fecha?: string; prueba?: boolean; desdeTension?: boolean } = {}): Promise<void> {
  const a = await obtenerAjustes()
  const desdeTension = !!op.desdeTension
  if (op.prueba) { pedido = { caida: null, xp: xpCaidaDe(a), desdeTension, n: ++cuenta }; avisarOyentes(); return }
  const caida = await mutar(() => registrarCaida(op.fecha ?? fechaDe(ahora(), a.zonaHoraria), origen))
  pedido = { caida, xp: caida.xp, desdeTension, n: ++cuenta }
  avisarOyentes()
}

/** «Levantarme»: antes de cerrar, el duelo pide las flexiones (la serie más la mitad; desde Tensión, la serie). */
function levantarme() {
  const p = pedido
  if (!p) return
  pedido = null
  avisarOyentes()
  pedirDuelo({ motivo: p.desdeTension ? 'tension' : 'caida', prueba: !p.caida, onFin: () => avisarCaida(p) })
}

function avisarCaida(p: NonNullable<typeof pedido>) {
  if (!p.caida) return
  const id = p.caida.id
  avisar(p.xp > 0 ? `Caída anotada · −${p.xp} XP` : 'Caída anotada', {
    duracionMs: DESHACER_CAIDA_MS,
    accion: { texto: 'Deshacer', fn: () => { void mutar(() => deshacerCaida(id)).then((ok) => ok && avisar('Caída deshecha: volvió la XP')) } },
  })
}

export function CaidaCapa() {
  const p = useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pedido, () => null)
  if (!p) return null
  return <EscenaCaidaConSonido key={p.n} xp={p.xp} desdeTension={p.desdeTension} />
}

function EscenaCaidaConSonido({ xp, desdeTension }: { xp: number; desdeTension: boolean }) {
  const [reducido] = useState(() => movimientoReducido())
  const sonido = configuracionAnimaciones().sonido
  useEffect(() => { if (!reducido && !desdeTension) sonarEstampida() }, [reducido, desdeTension])
  return <EscenaCaida xp={xp} reducido={reducido} desdeTension={desdeTension} sonido={sonido} onFin={levantarme} />
}

/** «No cumplí»: botón chico de contorno (borde rojo) en la cabecera de Hoy, junto a «Dudo» y «Tensión». Pide confirmar antes de la escena. */
export function BotonNoCumpli({ fecha, className = 'boton-no-cumpli', texto = 'No cumplí mi palabra' }: { fecha?: string; className?: string; texto?: string }) {
  const [abierta, setAbierta] = useState(false)
  const [xp, setXp] = useState(20)
  return (
    <>
      <button type="button" className={className} aria-label="No cumplí mi palabra" onClick={() => { void obtenerAjustes().then((a) => setXp(xpCaidaDe(a))); setAbierta(true) }}>{texto}</button>
      <Confirmar
        abierta={abierta}
        titulo="¿Seguro?"
        texto={xp > 0 ? `Perdés ${xp} XP y queda la marca. El día sigue: no se reinicia nada.` : 'Queda la marca. El día sigue: no se reinicia nada.'}
        confirmar="Sí, caí"
        cancelar="Volver"
        onCancelar={() => setAbierta(false)}
        onConfirmar={() => { setAbierta(false); void pedirCaida('boton', { fecha }) }}
      />
    </>
  )
}
