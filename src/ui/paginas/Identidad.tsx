import { useEffect, useState } from 'react'
import { guardarIdentidad, obtenerIdentidad } from '../../services/base'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function Identidad() {
  const datos = useDatos(() => obtenerIdentidad(), [])
  const [vision, setVision] = useState('')
  const [obstaculos, setObstaculos] = useState('')
  useEffect(() => {
    if (datos.datos) {
      setVision(datos.datos.vision)
      setObstaculos(datos.datos.obstaculos)
    }
  }, [datos.datos])
  const cambiado = datos.datos && (vision !== datos.datos.vision || obstaculos !== datos.datos.obstaculos)
  return (
    <>
      <Atras />
      <h1>Identidad</h1>
      <p className="texto-2 chico">Cada acción diaria está conectada con la persona que querés llegar a ser. Esto es lo que la app te recuerda.</p>
      <Tarjeta titulo="Yo ideal">
        <div className="campo">
          <textarea value={vision} onChange={(e) => setVision(e.target.value)} rows={6} />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Obstáculos actuales">
        <div className="campo">
          <textarea value={obstaculos} onChange={(e) => setObstaculos(e.target.value)} rows={4} />
        </div>
      </Tarjeta>
      <button className="boton primario ancho" disabled={!cambiado || vision.trim().length < 10} onClick={() => mutar(() => guardarIdentidad({ vision: vision.trim(), obstaculos: obstaculos.trim() })).then(() => avisar('Identidad guardada', { tipo: 'ok' }))}>
        Guardar
      </button>
    </>
  )
}
