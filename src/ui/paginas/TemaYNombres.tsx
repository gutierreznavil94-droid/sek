import { useEffect, useState } from 'react'
import { NOMBRES_FASES_INICIALES } from '../../data/semilla'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { aplicarTema } from '../../temas/temas'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import { ListaTemas } from './PrimeraVez'

/** Más → Tema y nombres: el tema de la app, su nombre, el tuyo y los nombres de las fases. Nada de esto toca los datos. */
export function TemaYNombres() {
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const [nombreApp, setNombreApp] = useState('')
  const [nombre, setNombre] = useState('')
  const [fases, setFases] = useState<string[]>(NOMBRES_FASES_INICIALES)
  const a = ajustes.datos
  useEffect(() => {
    if (!a) return
    setNombreApp(a.nombreApp)
    setNombre(a.nombrePersona)
    setFases(a.nombresFases?.length ? a.nombresFases : NOMBRES_FASES_INICIALES)
  }, [a])
  if (!a) return null

  const elegirTema = async (id: string) => {
    if (id === a.tema) return
    await mutar(() => guardarAjustes({ tema: id }, 'Cambio de tema'))
    aplicarTema(id, a.nombreApp)
    avisar('Tema cambiado. Tus datos siguen igual.', { tipo: 'ok' })
  }
  const guardar = async () => {
    const limpias = fases.map((f, i) => f.trim() || NOMBRES_FASES_INICIALES[i] || `Fase ${i + 1}`)
    await mutar(() => guardarAjustes({ nombreApp: nombreApp.trim() || 'SEK', nombrePersona: nombre.trim(), nombresFases: limpias }, 'Nombres'))
    aplicarTema(a.tema, nombreApp.trim() || 'SEK')
    avisar('Nombres guardados', { tipo: 'ok' })
  }

  return (
    <>
      <Atras />
      <h1>Tema y nombres</h1>
      <Tarjeta titulo="Tema">
        <p className="chico texto-2">La cara de la app: personaje, fondos y color. Cambiarlo no toca tu XP, tus pilares ni tu historial.</p>
        <ListaTemas valor={a.tema} onElegir={elegirTema} />
      </Tarjeta>
      <Tarjeta titulo="Nombres">
        <div className="campo">
          <label htmlFor="tn-app">Nombre de la app</label>
          <input id="tn-app" value={nombreApp} maxLength={20} onChange={(e) => setNombreApp(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="tn-nombre">Tu nombre</label>
          <input id="tn-nombre" value={nombre} placeholder="Opcional" onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="separador" />
        <p className="chico texto-2">Nombres de las fases del ciclo (se ven en la barra de arriba).</p>
        {fases.map((f, i) => (
          <div className="campo" key={i}>
            <label htmlFor={`tn-fase-${i}`}>Fase {i + 1}</label>
            <input id={`tn-fase-${i}`} value={f} placeholder={NOMBRES_FASES_INICIALES[i]} onChange={(e) => setFases(fases.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
        <button className="boton primario ancho" onClick={guardar}>Guardar nombres</button>
      </Tarjeta>
    </>
  )
}
