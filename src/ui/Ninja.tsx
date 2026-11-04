/**
 * Ninjas de la distracción: la pelea (escena corta con los clips de Luma: el shinobi bloquea, el ninja cae)
 * y la carta que queda después con «Empezar {pilar}» / «Ahora no». Se pide con `pedirPelea` desde Hoy.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { accionDePelea, fraseDePelea, registrarPelea, type Pelea } from '../services/ninjas'
import { DURACION, animar, lentoDe, type Animacion } from './animaciones/motor'
import { avisar, mutar } from './estado'

let pendiente: Pelea | null = null
const oyentes = new Set<() => void>()
function avisarOyentes() { for (const o of oyentes) o() }

/** Pide una pelea (una a la vez: si hay una en curso, se ignora). */
export function pedirPelea(p: Pelea): boolean {
  if (pendiente) return false
  pendiente = p
  avisarOyentes()
  return true
}

export function hayPelea(): boolean { return pendiente !== null }

function usePelea(): Pelea | null {
  return useSyncExternalStore((o) => { oyentes.add(o); return () => oyentes.delete(o) }, () => pendiente, () => pendiente)
}

export function NinjaPelea() {
  const pelea = usePelea()
  const navegar = useNavigate()
  const [carta, setCarta] = useState(false)
  useEffect(() => {
    if (!pelea) { setCarta(false); return }
    const a: Animacion = { tipo: 'ejecucion', pilar: 'ninja', titulo: `${pelea.distraccion.nombre} cae`, rival: pelea.distraccion.nombre, estilo: 'diagonal' }
    animar(a, { forzar: true })
    const id = window.setTimeout(() => setCarta(true), DURACION.ejecucion * lentoDe(a) + 350)
    return () => window.clearTimeout(id)
  }, [pelea])
  if (!pelea || !carta) return null
  const accion = accionDePelea(pelea.momento)
  const cerrar = () => { pendiente = null; avisarOyentes() }
  const responder = async (resultado: 'vencido' | 'escapo') => {
    await mutar(() => registrarPelea(pelea, resultado))
    cerrar()
    if (resultado === 'vencido') { avisar(`Venciste a ${pelea.distraccion.nombre}`, { tipo: 'ok' }); navegar(accion.ruta) }
  }
  return (
    <div className="ninja-carta-fondo" role="dialog" aria-label={`${pelea.distraccion.nombre} apareció`}>
      <div className="ninja-carta">
        <span className="ninja-cartel">{pelea.distraccion.nombre}</span>
        <p className="ninja-frase">{fraseDePelea(pelea.momento, pelea.distraccion.nombre)}</p>
        <div className="botonera">
          <button type="button" className="boton grande primario" onClick={() => responder('vencido')}>{accion.etiqueta}</button>
          <button type="button" className="boton grande" onClick={() => responder('escapo')}>Ahora no</button>
        </div>
        <span className="muy-chico texto-3">Sin XP por la pelea: lo que vale es lo que hagas después.</span>
      </div>
    </div>
  )
}
