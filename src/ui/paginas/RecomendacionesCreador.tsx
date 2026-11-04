/** Más → Recomendaciones del creador: los 4 pilares de Navil, con «Agregar los que me falten». */
import { Link } from 'react-router-dom'
import { agregarPilaresDelCreador, pilaresDelCreadorQueTiene } from '../../services/primeraVez'
import { Atras } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import { TarjetaCreador } from './PrimeraVez'

export function RecomendacionesCreador({ hoy }: { hoy: string }) {
  const datos = useDatos(() => pilaresDelCreadorQueTiene(), [])
  const tiene = datos.datos
  if (!tiene) return null
  const agregar = async () => {
    try {
      const r = await mutar(() => agregarPilaresDelCreador(hoy))
      avisar(r.length ? `Agregados: ${r.join(', ')}` : 'Ya los tenías todos', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  return (
    <>
      <Atras />
      <h1>Recomendaciones del creador</h1>
      <TarjetaCreador usados={[...tiene]} onUsar={agregar} etiquetaBoton="Agregar los que me falten" />
      <p className="ayuda">Los que agregues se editan igual que siempre en <Link to="/mas/acciones">Pilares y acciones</Link>: nombre, hora límite, mínimo y XP.</p>
    </>
  )
}
