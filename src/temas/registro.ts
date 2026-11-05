/**
 * Registro de los efectos de cada tema. Sin React. Al sumar un tema con efectos propios, se registra acá.
 * Un tema sin efectos propios usa los de «comun».
 */
import { registrarEfectos, fijarTemaEfectos } from './eventos'
import { fijarTemaIconos } from './iconos'
import { efectosComun } from './comun/efectos'
import { efectosShinobi } from './shinobi/efectos'

registrarEfectos('comun', efectosComun)
registrarEfectos('shinobi', efectosShinobi)
// Nay todavía no tiene efectos propios: usa los de Común a propósito (cada tema tiene su versión de cada evento).
registrarEfectos('nay', efectosComun)

/** Cambia el tema que decide cómo se ven los eventos y los íconos. */
export function activarTemaVisual(temaId: string): void {
  fijarTemaEfectos(temaId)
  fijarTemaIconos(temaId)
}
