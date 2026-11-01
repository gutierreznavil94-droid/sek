import { useEffect, useState } from 'react'
import type { ModoSuenio } from '../data/tipos'
import { formatoHora } from '../domain/fechas'
import { salirModoSuenio } from '../services/suenio'
import { Confirmar } from './componentes'
import { mutar, useTic } from './estado'

/**
 * Pantalla del modo sueño: casi negra, con la hora, hasta cuándo dura y la
 * hora a la que hay que estar dormido. No deja usar el resto de la app.
 * Primero muestra «Buenas noches» con el resumen del día; a los segundos (o
 * con un toque) pasa al reloj.
 */
export function PantallaSuenio({ estado, zona, horaDormido, horaFin }: { estado: ModoSuenio; zona: string; horaDormido: string; horaFin: string }) {
  const tic = useTic(15_000)
  const [saludo, setSaludo] = useState(() => Date.now() - estado.inicio < 60_000)
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => {
    if (!saludo) return
    const id = window.setTimeout(() => setSaludo(false), 8000)
    return () => window.clearTimeout(id)
  }, [saludo])
  const horaReal = formatoHora(estado.inicio, zona)
  return (
    <div className="modo-suenio" role="dialog" aria-label="Modo sueño" onClick={() => saludo && setSaludo(false)}>
      {saludo ? (
        <div className="suenio-saludo">
          <div className="suenio-titulo">{estado.tarde ? `Registrado a las ${horaReal}.` : ''} Buenas noches</div>
          <div className="suenio-resumen">{estado.resumen}</div>
          {!estado.tarde && <div className="suenio-nota">Celu dejado a tiempo. +XP guardado.</div>}
          <div className="suenio-nota">Tocá para pasar al reloj</div>
        </div>
      ) : (
        <div className="suenio-reloj">
          <div className="suenio-hora">{formatoHora(tic, zona)}</div>
          <div className="suenio-linea">Modo sueño hasta las {horaFin}</div>
          <div className="suenio-linea">A dormir a las {horaDormido}</div>
          {estado.aperturas.length > 0 && <div className="suenio-nota">Abriste la app {estado.aperturas.length === 1 ? '1 vez' : `${estado.aperturas.length} veces`} esta noche. Queda anotado, nada más.</div>}
        </div>
      )}
      <button className="suenio-salir" onClick={(e) => { e.stopPropagation(); setConfirmar(true) }}>Salir del modo sueño</button>
      <Confirmar
        abierta={confirmar}
        titulo="¿Salir del modo sueño?"
        texto="Es para emergencias o correcciones. Queda registrado en el historial. No cambia el XP de la noche."
        confirmar="Salir"
        peligro
        onConfirmar={() => { setConfirmar(false); mutar(() => salirModoSuenio('Salida a mano desde la pantalla de sueño')) }}
        onCancelar={() => setConfirmar(false)}
      />
    </div>
  )
}

