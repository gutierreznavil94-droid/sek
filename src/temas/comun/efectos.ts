/** Tema Común: versión simple de cada evento (un pulso, un fundido, un temblor). Es lo que usa un tema sin efectos propios. */
import { animar, type Efectos } from '../eventos'

const pulso = (escala: number, ms: number) => (d: { elemento?: Element | null }) =>
  animar(d.elemento, [{ transform: 'scale(1)' }, { transform: `scale(${escala})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' })

const temblor = (d: { elemento?: Element | null }) =>
  animar(d.elemento, [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 300 })

const fundido = (d: { elemento?: Element | null }) =>
  animar(d.elemento, [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out' })

export const efectosComun: Efectos = {
  completar: pulso(1.04, 260),
  aparecer: (d) => animar(d.elemento, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' }),
  logro: pulso(1.08, 500),
  recompensa: pulso(1.06, 400),
  alerta: temblor,
  descanso: fundido,
  dormir: fundido,
  pelear: temblor,
  robo: temblor,
}
