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
import { EscenaCaida } from '../temas/shinobi/EscenaCaida'
import { sonarEstampida } from './animaciones/motor'
import { Confirmar, movimientoReducido } from './componentes'
import { avisar, mutar } from './estado'

type Pedido = { caida: Caida | null; xp: number }
let pedido: Pedido | null = null
const oyentes = new Set<() => void>()
function avisarOyentes() { for (const o of oyentes) o() }

/** Registra la caída de hoy y muestra la escena. `prueba`: solo la escena (Ver animaciones), sin tocar datos. */
export async function pedirCaida(origen: Caida['origen'], op: { fecha?: string; prueba?: boolean } = {}): Promise<void> {
  const a = await obtenerAjustes()
  if (op.prueba) { pedido = { caida: null, xp: xpCaidaDe(a) }; avisarOyentes(); return }
  const caida = await mutar(() => registrarCaida(op.fecha ?? fechaDe(ahora(), a.zonaHoraria), origen))
  pedido = { caida, xp: caida.xp }
  avisarOyentes()
}

function cerrar() {
  const p = pedido
  pedido = null
  avisarOyentes()
  if (!p?.caida) return
  const id = p.caida.id
  avisar(p.xp > 0 ? `Caída anotada · −${p.xp} XP` : 'Caída anotada', {
    duracionMs: DESHACER_CAIDA_MS,
    accion: { texto: 'Deshacer', fn: () => { void mutar(() => deshacerCaida(id)).then((ok) => ok && avisar('Caída deshecha: volvió la XP')) } },
  })
}

export function CaidaCapa() {
  const p = useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pedido, () => null)
  if (!p) return null
  return <EscenaCaidaConSonido key={p.caida?.id ?? 'prueba'} xp={p.xp} />
}

function EscenaCaidaConSonido({ xp }: { xp: number }) {
  const [reducido] = useState(() => movimientoReducido())
  useEffect(() => { if (!reducido) sonarEstampida() }, [reducido])
  return <EscenaCaida xp={xp} reducido={reducido} onFin={cerrar} />
}

/** «No cumplí mi palabra»: discreto, abajo de Hoy. Pide confirmar antes de la escena. */
export function BotonNoCumpli({ fecha }: { fecha?: string }) {
  const [abierta, setAbierta] = useState(false)
  const [xp, setXp] = useState(20)
  return (
    <>
      <button type="button" className="boton-no-cumpli" onClick={() => { void obtenerAjustes().then((a) => setXp(xpCaidaDe(a))); setAbierta(true) }}>No cumplí mi palabra</button>
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
