import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { duracionLegible, fechaLegible, fechaDe } from '../../domain/fechas'
import { cerrarInicio, crearSiguienteAccion, iniciosRecientes } from '../../services/inicios'
import { Tarjeta } from '../componentes'
import { mutar, useDatos } from '../estado'
import { animar } from '../animaciones/motor'

/**
 * Siguiente acción: una tarea ambigua se convierte en una acción concreta
 * de menos de 5 minutos. Sin cuestionarios: una sola pregunta.
 */
export function SiguienteAccion({ hoy }: { hoy: string }) {
  const navegar = useNavigate()
  const [ambigua, setAmbigua] = useState('')
  const [concreta, setConcreta] = useState('')
  const recientes = useDatos(() => iniciosRecientes(15), [hoy])

  const lanzar = async () => {
    const r = await mutar(() => crearSiguienteAccion(ambigua, concreta))
    animar({ tipo: 'postura', modo: 'siguiente' })
    navegar(`/321?accion=${encodeURIComponent(concreta.trim())}&id=${r.id}`)
  }

  return (
    <div className="app">
      <div className="contenido" style={{ paddingTop: 24 }}>
        <div className="fila entre">
          <h1>Siguiente acción</h1>
          <button className="boton chico suave" onClick={() => navegar(-1)}>Cerrar</button>
        </div>
        <Tarjeta>
          <div className="campo">
            <label>¿Qué tenés que hacer? (vale que sea vago)</label>
            <input autoFocus value={ambigua} onChange={(e) => setAmbigua(e.target.value)} placeholder="Ej.: la facultad" />
          </div>
          <div className="campo">
            <label>¿Cuál es la primera acción física, de menos de 5 minutos?</label>
            <input value={concreta} onChange={(e) => setConcreta(e.target.value)} placeholder="Ej.: abrir el apunte en la página 12" />
            <span className="ayuda">Algo que se pueda hacer con el cuerpo ahora: abrir, buscar, escribir una línea, ponerse algo.</span>
          </div>
          <div className="botonera">
            <button className="boton primario grande" disabled={!concreta.trim()} onClick={lanzar}>3 · 2 · 1 y empezar</button>
          </div>
        </Tarjeta>

        {recientes.datos && recientes.datos.length > 0 && (
          <Tarjeta titulo="Últimas">
            <div>
              {recientes.datos.map((r) => (
                <div key={r.id} className="col chico" style={{ padding: '8px 0', borderTop: '1px solid var(--borde)', gap: 2 }}>
                  <div className="fila entre">
                    <b>{r.accionConcreta}</b>
                    <span className="texto-3 muy-chico">{fechaLegible(fechaDe(r.creado))}</span>
                  </div>
                  {r.tareaAmbigua && <span className="texto-3">de: {r.tareaAmbigua}</span>}
                  <div className="fila entre">
                    <span className="texto-2 muy-chico">
                      {r.iniciado ? `Empezada${r.segundosHastaEmpezar !== undefined && r.segundosHastaEmpezar > 0 ? ` a los ${duracionLegible(r.segundosHastaEmpezar / 60)}` : ''}` : 'Sin empezar'}
                      {r.resultado && ` · ${r.resultado.replace('_', ' ')}`}
                    </span>
                    {r.iniciado && !r.resultado && (
                      <div className="fila" style={{ gap: 4 }}>
                        <button className="boton chico suave" onClick={() => mutar(() => cerrarInicio(r.id!, 'hecha'))}>Hecha</button>
                        <button className="boton chico suave" onClick={() => mutar(() => cerrarInicio(r.id!, 'parcial'))}>A medias</button>
                      </div>
                    )}
                    {!r.iniciado && <Link className="boton chico suave" to={`/321?accion=${encodeURIComponent(r.accionConcreta)}&id=${r.id}`}>3-2-1</Link>}
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
