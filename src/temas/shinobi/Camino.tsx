/**
 * «道 El camino» (Progreso): el progreso no es lineal. Un trazo de pincel que sube y baja como la ladera
 * de una montaña, un punto por día del ciclo. SEK pasa los días (subida de cada uno y sus marcas);
 * acá se decide cómo se ve: pincel blanco papel con filo y sombra roja, aguada gris debajo,
 * y la montaña siempre a todo el ancho: con cada día se comprime (no hay nada prearmado hacia adelante).
 */
import { useMemo, useState } from 'react'

export type DiaCamino = {
  fecha: string
  /** 0 a 1: qué tan cumplido fue el día (pilares). null = día sin datos. */
  cumplido: number | null
  xp: number
  caida?: boolean
  forja?: boolean
  marca?: string
  etiqueta: string
}

type P = [number, number]
const W = 360, H = 120, X0 = 12, X1 = 348, ARRIBA = 18, ABAJO = 116

/** Catmull-Rom → muchos puntos: curvas suaves, sin quiebres de polígono. */
function suave(ps: P[], pasos = 10): P[] {
  if (ps.length < 3) return ps
  const out: P[] = []
  for (let i = 0; i < ps.length - 1; i++) {
    const p0 = ps[Math.max(0, i - 1)], p1 = ps[i], p2 = ps[i + 1], p3 = ps[Math.min(ps.length - 1, i + 2)]
    for (let k = 0; k < pasos; k++) {
      const t = k / pasos, t2 = t * t, t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(ps[ps.length - 1])
  return out
}
const linea = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

/** Cinta de pincel: el grosor respira a lo largo del trazo, entra fino y termina en punta (hoy). */
function pincel(ps: P[], base: number): string {
  const n = ps.length
  if (n < 2) return ''
  const izq: P[] = [], der: P[] = []
  for (let i = 0; i < n; i++) {
    const a = ps[Math.max(0, i - 1)], b = ps[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    const t = i / (n - 1)
    const entra = Math.min(1, t * 14)
    const punta = Math.min(1, (1 - t) * 9)
    const respira = 1 + 0.28 * Math.sin(t * 23) + 0.16 * Math.sin(t * 61 + 1)
    const w = (base * entra * (0.25 + 0.75 * punta) * respira) / 2
    izq.push([ps[i][0] - (dy / l) * w, ps[i][1] + (dx / l) * w])
    der.push([ps[i][0] + (dy / l) * w, ps[i][1] - (dx / l) * w])
  }
  return linea([...izq, ...der.reverse()]) + ' Z'
}

export function CaminoMontana({ dias, duracion, reducido = false }: { dias: DiaCamino[]; duracion: number; reducido?: boolean }) {
  const [sel, setSel] = useState<number | null>(null)
  const c = useMemo(() => {
    // La montaña ocupa siempre todo el ancho: cada día nuevo la comprime un poco (nada prearmado hacia adelante).
    const total = Math.max(dias.length, 2)
    const xDe = (i: number) => X0 + ((X1 - X0) * i) / (total - 1)
    // Altura: sube con los días cumplidos, baja en los flojos; una caída es una bajada marcada.
    const alt: number[] = []
    let h = 0
    dias.forEach((d, i) => {
      if (i > 0) {
        const r = d.cumplido
        h += r === null ? -0.15 : r >= 0.75 ? 1 + Math.min(0.5, d.xp / 200) : r >= 0.4 ? 0.35 : -0.8
        if (d.caida) h -= 1.6
      }
      alt.push(h)
    })
    // Suavizado de 3 días: se lee la ladera, no cada escalón.
    const suav = alt.map((_, i) => { const v = alt.slice(Math.max(0, i - 1), i + 2); return v.reduce((a, b) => a + b, 0) / v.length })
    // Con un solo día, el camino arranca plano de lado a lado.
    if (suav.length === 1) suav.push(suav[0])
    const min = Math.min(...suav), max = Math.max(...suav, min + 3)
    const yDe = (v: number) => ABAJO - 10 - ((v - min) / (max - min)) * (ABAJO - ARRIBA - 20)
    const puntos: P[] = suav.map((v, i) => [xDe(i), yDe(v)])
    const camino = suave(puntos, total > 40 ? 4 : 10)
    return { puntos, camino }
  }, [dias, duracion])

  const ultimo = c.puntos[c.puntos.length - 1]
  const ladera = c.camino.length > 1 ? `${linea(c.camino)} L${c.camino[c.camino.length - 1][0].toFixed(1)},${H} L${c.camino[0][0].toFixed(1)},${H} Z` : ''
  const d = sel !== null ? dias[sel] : null
  return (
    <div className={`camino ${reducido ? 'quieto' : ''}`}>
      <h2 className="camino-frase">El progreso no es lineal.</h2>
      <svg className="camino-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`El camino: ${dias.length} días de ${duracion}`}>
        <defs>
          <linearGradient id="cm-aguada" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3735" stopOpacity="0.85" />
            <stop offset="1" stopColor="#141312" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cm-lejos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b5753" stopOpacity="0.4" />
            <stop offset="1" stopColor="#2a2826" stopOpacity="0" />
          </linearGradient>
          <filter id="cm-brillo" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
        </defs>
        {ladera && <path className="camino-ladera" d={ladera} fill="url(#cm-aguada)" />}
        <g className="camino-trazo">
          <path className="camino-brillo" d={linea(c.camino)} filter="url(#cm-brillo)" />
          <path className="camino-sombra" d={pincel(c.camino, 5.6)} transform="translate(2.4 2.6)" />
          <path className="camino-tinta" d={pincel(c.camino, 5.6)} />
        </g>
        {dias.map((x, i) => {
          const p = c.puntos[i]
          // 鍛 chiquito, sin amontonarse: uno cada tanto cuando hay varios días de forja seguidos.
          const forjaVisible = x.forja && !dias.slice(Math.max(0, i - 3), i).some((y) => y.forja)
          return (
            <g key={x.fecha}>
              {x.caida && <circle className="camino-caida" cx={p[0]} cy={p[1] + 8} r="2.4" />}
              {forjaVisible && <text className="camino-k forja" x={p[0]} y={p[1] + (x.caida ? 20 : 13)} textAnchor="middle">鍛</text>}
              {x.marca && <g transform={`translate(${p[0]} ${p[1] - 12})`}><rect className="camino-sello" x="-5" y="-5" width="10" height="10" rx="1.5" /><text className="camino-k sello" y="0.5" textAnchor="middle" dominantBaseline="central">印</text></g>}
              <circle className="camino-toque" cx={p[0]} cy={p[1]} r={Math.max(5, Math.min(14, (X1 - X0) / Math.max(dias.length, 1) / 2 + 2))} onClick={() => setSel(sel === i ? null : i)} />
            </g>
          )
        })}
        {ultimo && <circle className="camino-hoy" cx={ultimo[0]} cy={ultimo[1]} r="2.6" />}
        {d && sel !== null && <circle className="camino-elegido" cx={c.puntos[sel][0]} cy={c.puntos[sel][1]} r="5" />}
      </svg>
      <p className="camino-pie av-nota">{d ? <><b>{d.etiqueta}</b>{d.marca ? ` · 印 ${d.marca}` : ''}{d.caida ? ' · caída, seguiste' : ''}{d.forja ? ' · 鍛 forja' : ''}</> : <>Día {dias.length} de {duracion} · tocá un punto para ver ese día</>}</p>
    </div>
  )
}
