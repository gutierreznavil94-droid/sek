/**
 * Tema Shinobi: cómo se ve cada evento genérico. Tinta, sello hanko y rojo en líneas finas.
 * Sin React: se dibujan capas sueltas encima del elemento y se borran solas.
 */
import { animar, sinMovimiento, type DetalleEvento, type Efectos } from '../eventos'
import { efectosComun } from '../comun/efectos'

const ROJO = '#C8102E'
const TINTA = '#121110'
const PAPEL = '#F1EBDF'

/** Una capa fija encima de la pantalla, en el lugar del elemento (o en el centro). Se borra sola. */
function capa(d: DetalleEvento, ms: number, estilo: Partial<CSSStyleDeclaration> = {}): HTMLDivElement | null {
  if (typeof document === 'undefined' || sinMovimiento()) return null
  const r = d.elemento?.getBoundingClientRect?.()
  const c = document.createElement('div')
  c.setAttribute('aria-hidden', 'true')
  Object.assign(c.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '250',
    left: `${r ? r.left : 0}px`, top: `${r ? r.top : 0}px`,
    width: `${r ? r.width : innerWidth}px`, height: `${r ? r.height : innerHeight}px`,
    ...estilo,
  })
  document.body.appendChild(c)
  setTimeout(() => c.remove(), ms)
  return c
}

/** Sello 済 que cae sobre la tarea, con dos gotas de tinta. */
function sello(d: DetalleEvento): void {
  const c = capa(d, 900)
  if (!c) return
  const s = document.createElement('span')
  s.textContent = '済'
  Object.assign(s.style, {
    position: 'absolute', right: '10px', top: '50%', width: '34px', height: '34px', marginTop: '-17px',
    display: 'grid', placeItems: 'center', border: `2px solid ${ROJO}`, borderRadius: '6px', color: ROJO,
    fontFamily: "'Pincel', 'Yuji Syuku', serif", fontSize: '19px', background: 'rgba(200,16,46,.08)',
  })
  c.appendChild(s)
  animar(s, [
    { transform: 'rotate(-12deg) scale(2.4)', opacity: 0 },
    { transform: 'rotate(-12deg) scale(.92)', opacity: 1, offset: 0.55 },
    { transform: 'rotate(-12deg) scale(1)', opacity: 0.9, offset: 0.75 },
    { transform: 'rotate(-12deg) scale(1)', opacity: 0 },
  ], { duration: 880, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'forwards' })
  for (let i = 0; i < 3; i++) {
    const g = document.createElement('i')
    Object.assign(g.style, { position: 'absolute', right: `${18 + i * 9}px`, top: '50%', width: '5px', height: '5px', borderRadius: '50%', background: i === 1 ? ROJO : TINTA })
    c.appendChild(g)
    animar(g, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(i - 1) * 22}px, ${-18 - i * 6}px)`, opacity: 0 }], { duration: 600, delay: 220, easing: 'ease-out', fill: 'forwards' })
  }
}

/** Estallido de tinta en el centro: gotas negras, rojas y de papel. */
function estallido(d: DetalleEvento, cantidad: number): void {
  const c = capa({}, 1500)
  if (!c) return
  const r = d.elemento?.getBoundingClientRect?.()
  const cx = r ? r.left + r.width / 2 : innerWidth / 2
  const cy = r ? r.top + r.height / 2 : innerHeight * 0.38
  const colores = [TINTA, ROJO, PAPEL]
  for (let i = 0; i < cantidad; i++) {
    const g = document.createElement('i')
    const t = 4 + Math.random() * 7
    Object.assign(g.style, { position: 'absolute', left: `${cx}px`, top: `${cy}px`, width: `${t}px`, height: `${t}px`, borderRadius: '50%', background: colores[i % 3], boxShadow: i % 3 === 2 ? '0 0 0 1px rgba(0,0,0,.4)' : 'none' })
    c.appendChild(g)
    const ang = Math.random() * Math.PI * 2
    const dist = 60 + Math.random() * 140
    animar(g, [
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist + 60}px)) scale(1)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' })
  }
}

/** Corte rojo en diagonal sobre el elemento. */
function tajo(d: DetalleEvento): void {
  const c = capa(d, 700)
  if (!c) return
  const l = document.createElement('i')
  Object.assign(l.style, { position: 'absolute', left: '-10%', top: '50%', width: '120%', height: '3px', background: ROJO, boxShadow: `0 0 10px ${ROJO}`, transform: 'rotate(-14deg) scaleX(0)', transformOrigin: 'left center' })
  c.appendChild(l)
  animar(l, [{ transform: 'rotate(-14deg) scaleX(0)', opacity: 1 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 1, offset: 0.4 }, { transform: 'rotate(-14deg) scaleX(1)', opacity: 0 }], { duration: 640, easing: 'ease-out', fill: 'forwards' })
  efectosComun.pelear(d)
}

/** Línea roja fina que recorre el borde de abajo (recompensa). */
function brilloRojo(d: DetalleEvento): void {
  const c = capa(d, 900)
  if (!c) return
  const l = document.createElement('i')
  Object.assign(l.style, { position: 'absolute', left: '0', bottom: '0', width: '100%', height: '2px', background: ROJO, boxShadow: `0 0 12px ${ROJO}`, transformOrigin: 'left center' })
  c.appendChild(l)
  animar(l, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.6 }, { transform: 'scaleX(1)', opacity: 0 }], { duration: 880, easing: 'ease-out', fill: 'forwards' })
}

/** Aparece como trazo de pincel: se descubre de izquierda a derecha. */
function pincel(d: DetalleEvento): void {
  animar(d.elemento, [{ clipPath: 'inset(0 100% 0 0)', opacity: 0.4 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
}

/** Alerta: el borde se enciende en rojo y tiembla. */
function alerta(d: DetalleEvento): void {
  animar(d.elemento, [{ boxShadow: '0 0 0 0 rgba(200,16,46,0)' }, { boxShadow: `0 0 0 2px ${ROJO}, 0 0 18px rgba(200,16,46,.55)` }, { boxShadow: '0 0 0 0 rgba(200,16,46,0)' }], { duration: 700 })
  efectosComun.alerta(d)
}

export const efectosShinobi: Efectos = {
  completar: sello,
  aparecer: pincel,
  logro: (d) => estallido(d, 70),
  recompensa: brilloRojo,
  alerta,
  descanso: efectosComun.descanso,
  dormir: efectosComun.dormir,
  pelear: tajo,
  robo: tajo,
  // Estoy dudando, Juego y pausa: las escenas animadas del tema (Escenas.tsx) escuchan el evento; acá, el simple de Común.
  duda: efectosComun.alerta,
  jugar: efectosComun.completar,
  pausa: efectosComun.descanso,
  quieto: () => undefined,
}
