/** «¿Qué querés usar?» en la interfaz: `usaUI('juego')` sin esperar (usa lo último cargado). */
import type { Ajustes, Funcion } from '../data/tipos'
import { obtenerAjustes } from '../services/base'
import { usa } from '../services/funciones'
import { useDatos } from './estado'

let ultimo: Ajustes['funciones'] | undefined

export function useFunciones(): (f: Funcion) => boolean {
  const a = useDatos(() => obtenerAjustes(), [])
  if (a.datos) ultimo = a.datos.funciones
  return (f) => usa({ funciones: a.datos?.funciones ?? ultimo }, f)
}
