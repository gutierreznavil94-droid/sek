/*
 * Entrada del armado de las escenas del shinobi (herramientas/armar-animaciones.sh). Toma Escena.tsx, motor.ts y
 * munieco.tsx de la v0.88.27 tal cual y los deja en un solo archivo para el navegador:
 *   window.SEK_ANIMAR({ tipo: 'ejecucion', pilar } | { tipo: 'parry' } | { tipo: 'postura', modo } | { tipo: 'logro', clase, texto, sub })
 * Se dibuja encima de la pantalla y se va sola (o con un toque). No guarda nada.
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Escena } from './Escena'
import { animar, duracionDe, lentoDe, saltar, terminar, useAnimacionActual, type Animacion } from './motor'
import { cargarPoses } from './munieco'

function Capa() {
  const a = useAnimacionActual()
  useEffect(() => {
    if (!a) return
    const id = window.setTimeout(() => terminar(a.id), duracionDe(a) * lentoDe(a) + 250)
    return () => window.clearTimeout(id)
  }, [a])
  if (!a) return null
  return <Escena key={a.id} a={a} nombre="Shinobi" lento={lentoDe(a)} tema="epico" tinta onSaltar={saltar} />
}

let montada = false
function montar() {
  if (montada) return
  montada = true
  const caja = document.createElement('div')
  caja.className = 'sek-animaciones'
  document.body.appendChild(caja)
  createRoot(caja).render(<Capa />)
  try { cargarPoses() } catch { /* poses de siempre */ }
}

;(window as unknown as { SEK_ANIMAR: (a: Animacion, o?: { forzar?: boolean }) => boolean }).SEK_ANIMAR = (a, o) => { montar(); return animar(a, o) }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar)
else montar()
