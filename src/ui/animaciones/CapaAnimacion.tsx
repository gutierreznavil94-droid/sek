import { Suspense, lazy, useEffect } from 'react'
import { obtenerAjustes } from '../../services/base'
import { useDatos } from '../estado'
import { cargarPoses } from './munieco'
import { configurarAnimaciones, duracionDe, lentoDe, saltar, terminar, useAnimacionActual, useConfigAnimaciones } from './motor'

// La escena (SVG y poses) se carga recién la primera vez que hace falta: no suma al arranque.
const Escena = lazy(() => import('./Escena').then((m) => ({ default: m.Escena })))

/** Muestra la animación en curso encima de toda la app. Se termina sola o con un toque. */
export function CapaAnimacion() {
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const a = useAnimacionActual()
  const config = useConfigAnimaciones()
  const aj = ajustes.datos
  useEffect(() => {
    if (aj) configurarAnimaciones({ modo: aj.animaciones ?? 'todas', sonido: !!aj.sonidoAnimaciones, nombre: aj.nombrePersonaje || 'Shinobi', tema: aj.temaAnimaciones ?? 'claro' })
  }, [aj])
  useEffect(() => {
    cargarPoses()
    // Precarga la escena cuando la app ya está quieta, para que la primera animación no espere.
    const id = window.setTimeout(() => void import('./Escena'), 3000)
    return () => window.clearTimeout(id)
  }, [])
  useEffect(() => {
    if (!a) return
    const id = window.setTimeout(() => terminar(a.id), duracionDe(a) * lentoDe(a) + 250)
    return () => window.clearTimeout(id)
  }, [a, config.lento])
  if (!a) return null
  return (
    <Suspense fallback={null}>
      <Escena key={a.id} a={a} nombre={config.nombre} lento={lentoDe(a)} tema={config.tema} tinta={config.tinta} onSaltar={saltar} />
    </Suspense>
  )
}
