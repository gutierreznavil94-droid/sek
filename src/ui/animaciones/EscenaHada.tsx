import type { CSSProperties, ReactNode } from 'react'
import { movimientoReducido } from '../componentes'
import { temaActivo } from '../../temas/temas'
import { duracionDe, nombreDePilar, type EnCurso } from './motor'

/**
 * Animaciones grandes del hada (temas con `adornos.animaciones: "hada"`): mismos disparadores y
 * duraciones que las de Shinobi (motor.ts), solo cambia lo que se ve. Todo es CSS sobre una capa
 * rosa → lila; un toque la salta. Con «reducir movimiento» se ve la imagen final, quieta.
 */

const BASE = import.meta.env.BASE_URL

/** Posiciones fijas (no al azar) para que cada vez se vea igual de prolijo. */
const lluvia = (n: number) => Array.from({ length: n }, (_, i) => ({ x: (i * 37 + 11) % 100, d: (i * 53) % 600, t: 0.8 + ((i * 29) % 50) / 100 }))

function Kitty({ className = '' }: { className?: string }) {
  const img = temaActivo().adornos?.imagenAnimaciones
  if (!img) return <span className={`hd-kitty hd-kitty-emoji ${className}`}>🧚</span>
  return <img className={`hd-kitty ${className}`} src={BASE + img} alt="" draggable={false} />
}

function Lluvia({ n, simbolos }: { n: number; simbolos: string[] }) {
  return (
    <div className="hd-lluvia" aria-hidden>
      {lluvia(n).map((p, i) => (
        <span key={i} style={{ left: `${p.x}%`, '--demora': `${p.d}ms`, '--caida': p.t } as CSSProperties}>{simbolos[i % simbolos.length]}</span>
      ))}
    </div>
  )
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** Saca el kanji del subtítulo de Shinobi («段 · nombre» → «nombre»). */
const sinKanji = (s?: string) => (s ?? '').replace(/^[㐀-鿿]+\s*·\s*/, '')

export function EscenaHada({ a, lento = 1, onSaltar }: { a: EnCurso; lento?: number; onSaltar: () => void }) {
  const dur = duracionDe(a) * lento
  const quieto = movimientoReducido()
  const estilo = { '--dur': `${dur}ms` } as CSSProperties
  const clases = `hd-capa ${quieto ? 'quieto' : ''}`

  if (a.tipo === 'parry') {
    return (
      <div className={`${clases} hd-parry`} style={estilo} aria-hidden>
        <span className="hd-corazon-salta">♥<b>+1</b></span>
      </div>
    )
  }

  let variante = ''
  let titulo: ReactNode = null
  let sub: ReactNode = null
  let escena: ReactNode = null

  if (a.tipo === 'ejecucion') {
    variante = 'pilar'
    titulo = '¡Cumplido!'
    sub = <>✨ {mayuscula(nombreDePilar(a.pilar))}</>
    escena = (
      <>
        <Kitty className="hd-vuela" />
        <span className="hd-toque" aria-hidden>✦</span>
        <Lluvia n={22} simbolos={['★', '✦', '★', '♥']} />
      </>
    )
  } else if (a.tipo === 'postura') {
    variante = 'cupcake'
    titulo = a.modo === '321' ? '3 · 2 · 1' : 'Siguiente acción'
    sub = a.modo === '321' ? '🧁 ¡A empezar!' : '🧁 Un paso más'
    escena = (
      <>
        <span className="hd-aura" aria-hidden />
        <span className="hd-cupcake" aria-hidden>🧁</span>
        <Kitty className="hd-manitos" />
      </>
    )
  } else if (a.tipo === 'logro') {
    if (a.clase === 'nivel') {
      variante = 'nivel'
      titulo = `¡${a.texto}!`
      sub = '⭐ ¡Subiste de nivel!'
      const arco = ['♥', '★', '♥', '★', '♥', '★', '♥', '★', '♥']
      escena = (
        <>
          <div className="hd-arcoiris" aria-hidden>
            {arco.map((s, i) => <span key={i} style={{ '--i': i, '--n': arco.length } as CSSProperties}><i>{s}</i></span>)}
          </div>
          <Kitty className="hd-gira" />
        </>
      )
    } else if (a.clase === 'racha') {
      variante = 'racha'
      titulo = a.texto
      sub = '💞 ¡Seguís sumando!'
      escena = (
        <>
          <Kitty className="hd-flota" />
          <div className="hd-corazones" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ '--i': i } as CSSProperties}><i>♡</i><b>♥</b></span>)}
          </div>
          <Lluvia n={16} simbolos={['🌸']} />
        </>
      )
    } else if (a.clase === 'fase') {
      variante = 'fase'
      titulo = a.texto
      sub = <>🎁 {sinKanji(a.sub) || 'Nueva etapa'}</>
      escena = (
        <>
          <Kitty className="hd-al-lado" />
          <div className="hd-regalo" aria-hidden>
            <span className="hd-tapa">🎀</span>
            <span className="hd-caja">🎁</span>
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="hd-mariposa" style={{ '--i': i } as CSSProperties}>🦋</span>)}
          </div>
        </>
      )
    } else {
      variante = 'record'
      titulo = a.texto
      sub = '🏅 ¡Más fuerte que nunca!'
      escena = (
        <>
          <div className="hd-levanta">
            <Kitty />
            <svg className="hd-pesa" viewBox="0 0 120 40" aria-hidden>
              <rect x="14" y="17" width="92" height="6" rx="3" fill="#E7A3C4" />
              <rect x="4" y="4" width="16" height="32" rx="6" fill="#F27BB0" />
              <rect x="100" y="4" width="16" height="32" rx="6" fill="#F27BB0" />
            </svg>
          </div>
          <span className="hd-medalla" aria-hidden>🏅</span>
          <Lluvia n={12} simbolos={['✦', '✧']} />
        </>
      )
    }
  }

  return (
    <div className={`${clases} hd-v-${variante}`} style={estilo} onPointerDown={onSaltar} role="status" aria-label={typeof titulo === 'string' ? titulo : 'Logro'}>
      <div className="hd-escena">{escena}</div>
      {titulo && <div className="hd-titulo">{titulo}</div>}
      {sub && <div className="hd-sub">{sub}</div>}
    </div>
  )
}
