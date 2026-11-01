import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../data/db'
import { diferenciaDias, esFechaValida, esHoraValida, fechaLegible, sumarDias } from '../../domain/fechas'
import { guardarAccion } from '../../services/acciones'
import { cambiarInicioCiclo, cicloActivo, iniciarCiclo } from '../../services/ciclo'
import { cerrarDiasPendientes } from '../../services/dia'
import { Confirmar, DiasSemana, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/**
 * Pantalla de inicio de ciclo: fecha del Día 1 y días de entrenamiento.
 * Con `nuevo`, además permite cambiar la fecha del ciclo actual o empezar otro.
 */
export function Inicio({ hoy, nuevo }: { hoy: string; nuevo?: boolean }) {
  const [fecha, setFecha] = useState(hoy)
  const [duracion, setDuracion] = useState(90)
  const [dias, setDias] = useState<number[]>([1, 3, 5])
  const [hora, setHora] = useState('07:00')
  const [confirmar, setConfirmar] = useState<'nuevo' | 'cambiar' | null>(null)
  const navegar = useNavigate()
  const datos = useDatos(async () => ({ activo: await cicloActivo(), entreno: await db().acciones.get('entrenamiento') }), [])
  const activo = datos.datos?.activo
  useEffect(() => {
    if (datos.datos?.entreno) {
      setDias(datos.datos.entreno.dias)
      setHora(datos.datos.entreno.hora ?? '07:00')
    }
    if (nuevo && datos.datos?.activo) setFecha(datos.datos.activo.inicio)
  }, [datos.datos, nuevo])

  const valida = esFechaValida(fecha)
  const guardarEntreno = async () => {
    const e = datos.datos?.entreno
    if (e && esHoraValida(hora)) await guardarAccion({ ...e, dias, hora })
  }
  const empezar = async () => {
    await mutar(async () => {
      await guardarEntreno()
      await iniciarCiclo(fecha, { duracionDias: duracion })
      await cerrarDiasPendientes()
    })
    avisar(`Ciclo iniciado. Día 1: ${fechaLegible(fecha)}`, { tipo: 'ok' })
    navegar('/')
  }
  const cambiar = async () => {
    await mutar(async () => {
      await cambiarInicioCiclo(fecha)
      await cerrarDiasPendientes()
    })
    avisar(`Fecha de inicio cambiada. Día 1: ${fechaLegible(fecha)}`, { tipo: 'ok' })
    navegar('/')
  }
  const faltan = diferenciaDias(hoy, fecha)
  const Ayuda = () => (
    <span className="ayuda">
      El día va de 00:00 a 00:00 (hora de Córdoba). {faltan === 0 ? 'Hoy es el día 1.' : faltan > 0 ? `Empieza en ${faltan} día${faltan === 1 ? '' : 's'}; hasta entonces el panel dice «Empieza en X días».` : 'La fecha ya pasó: los días anteriores se cierran sin datos.'}
    </span>
  )

  return (
    <div className={nuevo ? '' : 'app'}>
      <div className="contenido" style={{ paddingTop: nuevo ? 0 : 40 }}>
        {!nuevo && (
          <div className="col" style={{ gap: 4 }}>
            <h1>SEK</h1>
            <p className="texto-2">90 días para convertir tu visión en acciones diarias. Todo se guarda en este teléfono.</p>
          </div>
        )}

        {nuevo && activo && (
          <Tarjeta titulo={`Ciclo ${activo.numero}: cambiar la fecha de inicio`}>
            <p className="texto-2 chico">Empezó el {fechaLegible(activo.inicio, false)}. Cambiar la fecha mueve el Día 1 y las metas automáticas; el XP, el nivel y los registros no se tocan.</p>
            <div className="campo">
              <label htmlFor="fecha2">Nueva fecha del Día 1</label>
              <input id="fecha2" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <Ayuda />
            </div>
            <button className="boton primario ancho" disabled={!valida || fecha === activo.inicio} onClick={() => setConfirmar('cambiar')}>Cambiar fecha de inicio</button>
          </Tarjeta>
        )}

        <Tarjeta titulo={nuevo ? 'Empezar un ciclo nuevo' : 'Día 1 del ciclo'}>
          {nuevo && activo && <p className="texto-2 chico">El ciclo {activo.numero} se cerrará. Tu nivel, tu XP y todo el historial se conservan.</p>}
          {!nuevo && (
            <div className="campo">
              <label htmlFor="fecha">Fecha de inicio</label>
              <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <Ayuda />
            </div>
          )}
          {nuevo && (
            <div className="campo">
              <label htmlFor="fecha3">Fecha de inicio del ciclo nuevo</label>
              <input id="fecha3" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          )}
          <div className="campo">
            <label htmlFor="dur">Duración</label>
            <select id="dur" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
              <option value={90}>90 días (3 fases de 30)</option>
              <option value={60}>60 días (2 fases de 30)</option>
              <option value={120}>120 días (4 fases de 30)</option>
            </select>
          </div>
          {!nuevo && (
            <div className="botonera">
              <button className="boton" onClick={() => setFecha(hoy)}>Hoy</button>
              <button className="boton" onClick={() => setFecha(sumarDias(hoy, 1))}>Mañana</button>
            </div>
          )}
          {!nuevo && (
            <>
              <div className="separador" />
              <div className="campo">
                <label>¿Qué días entrenás?</label>
                <DiasSemana valor={dias} onChange={setDias} />
              </div>
              <div className="campo">
                <label htmlFor="hora">Hora de entrenamiento</label>
                <input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                <span className="ayuda">Se puede cambiar después, con una hora distinta por día, en «Más → Entrenamiento y descanso».</span>
              </div>
            </>
          )}
          <button className="boton primario grande ancho" disabled={!valida || (!nuevo && dias.length === 0)} onClick={() => (nuevo ? setConfirmar('nuevo') : empezar())}>
            {nuevo ? 'Empezar nuevo ciclo' : 'Empezar'}
          </button>
        </Tarjeta>

        {!nuevo && (
          <Tarjeta titulo="Qué vas a ver">
            <ul className="texto-2 chico" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Arriba, siempre: «Día X de 90» y la fecha.</li>
              <li>Compromisos del día con su XP a la vista.</li>
              <li>Temporizador de juego, hora de acostarse, 3-2-1 y Siguiente acción.</li>
              <li>Calendario con cada día coloreado según lo que cumpliste.</li>
            </ul>
            <p className="ayuda">Hacé una copia de seguridad cada semana: los datos viven solo en este teléfono.</p>
          </Tarjeta>
        )}

        <Confirmar
          abierta={confirmar === 'nuevo'}
          titulo="¿Empezar un ciclo nuevo?"
          texto="El ciclo actual se cierra. Nivel, XP, historial y calendario se conservan. Los objetivos del ciclo nuevo los definís después en «Más → Objetivos»."
          confirmar="Empezar"
          onConfirmar={() => { setConfirmar(null); empezar() }}
          onCancelar={() => setConfirmar(null)}
        />
        <Confirmar
          abierta={confirmar === 'cambiar'}
          titulo="¿Cambiar la fecha de inicio?"
          texto={`El Día 1 pasa a ser el ${fechaLegible(fecha, false)}. Las metas de fin de fase y revisiones semanales se mueven. Nada de lo registrado se pierde.`}
          confirmar="Cambiar"
          onConfirmar={() => { setConfirmar(null); cambiar() }}
          onCancelar={() => setConfirmar(null)}
        />
      </div>
    </div>
  )
}
