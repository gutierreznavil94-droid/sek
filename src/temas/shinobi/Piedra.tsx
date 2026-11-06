/**
 * Forja de hábitos, tema Shinobi: la piedra que se rompe y libera el kanji.
 * SEK solo pasa cuántos días válidos hay; acá se decide cómo se ve:
 * - Piedra tallada gris tinta, siempre la misma forma para cada hábito (sale del id).
 * - Signos shinobi grabados casi invisibles (shuriken, kasa, katana y trazos sueltos del kanji).
 * - Cada día válido nuevo: tajo blanco, temblor, esquirlas y una grieta nueva (ninguna repetida).
 * - 6 pedazos que caen (7, 12, 17, 21, 25, 28 con 28); debajo, el kanji rojo con la fuente de pincel.
 * - Forjado: la piedra se parte entera y el kanji queda libre, latiendo.
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { pedazosPara } from '../../domain/forja'
import { sonarForja } from '../../ui/animaciones/motor'

type P = [number, number]

/** Kanji que ya trae la fuente de pincel de la app; para otro, se pide a Google Fonts solo esa letra. */
const EN_FUENTE = '体力印夜始常弾心忍志掟描整斬昇昼時朝柱次段目眠誓連進鍛静食一二三四五六七八九十水願読学書走歩音健早律耐甦'
const pedidos = new Set<string>()
function asegurarFuente(k: string) {
  if (!k || EN_FUENTE.includes(k) || pedidos.has(k) || typeof document === 'undefined') return
  pedidos.add(k)
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = `https://fonts.googleapis.com/css2?family=Yuji+Syuku&text=${encodeURIComponent(k)}&display=block`
  document.head.appendChild(l)
}

function semillaDe(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function azar(semilla: number) {
  let a = semilla || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const camino = (ps: P[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const desde = (c: P, ang: number, r: number): P => [c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r]
const hacia = (a: P, b: P, d: number): P => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [a[0] + (dx / l) * d, a[1] + (dy / l) * d] }

type Grieta = { d: string; cinta: string; ancho: number; ang: number; inicio: P; fin: P; roja: boolean }

/** Trazo de pincel: una cinta que se afina hasta la punta. */
function cinta(ps: P[], w0: number): string {
  const n = ps.length
  const izq: P[] = [], der: P[] = []
  for (let i = 0; i < n; i++) {
    const a = ps[Math.max(0, i - 1)], b = ps[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    const w = (w0 * (1 - (i / (n - 1)) * 0.88)) / 2
    izq.push([ps[i][0] - (dy / l) * w, ps[i][1] + (dx / l) * w])
    der.push([ps[i][0] + (dy / l) * w, ps[i][1] - (dx / l) * w])
  }
  return camino([...izq, ...der.reverse()]) + ' Z'
}
type Forma = {
  contorno: string
  luz: string
  facetas: { d: string; tono: 'luz' | 'medio' | 'sombra' }[]
  centro: P
  cunas: string[]
  centros: P[]
  grietas: Grieta[]
  signos: { shuriken: string; kasa: string; katana: string; trazos: { x: number; y: number; w: number; h: number }[] }
}

/** Todo sale del id: la misma piedra cada vez que se abre la app. */
function formaDe(id: string, necesarios: number): Forma {
  const r = azar(semillaDe(id))
  const j = (m: number) => (r() * 2 - 1) * m
  // Roca redondeada de 10 a 12 facetas, con 2 o 3 puntas cortas que sobresalen apenas.
  const n = 10 + Math.floor(r() * 3)
  const g0 = r() * Math.PI * 2
  const puntas = new Set([Math.floor(r() * n), Math.floor(r() * n), Math.floor(r() * n)])
  const vert: P[] = Array.from({ length: n }, (_, i) => {
    const ang = g0 + (i * Math.PI * 2) / n + j(0.12)
    const rad = 39 + j(2.2) + (puntas.has(i) ? 3.5 + r() * 1.5 : 0)
    return [50 + Math.cos(ang) * rad, 51 + Math.sin(ang) * rad * 0.95]
  })
  const contorno = camino(vert) + ' Z'
  // Facetas planas: cara de arriba, y un anillo de caras con luz (arriba a la izquierda) o sombra (abajo a la derecha).
  const ci: P = [46 + j(1.5), 45 + j(1.5)]
  const inner: P[] = vert.map((v) => [ci[0] + (v[0] - 50) * (0.56 + j(0.05)), ci[1] + (v[1] - 51) * (0.56 + j(0.05))])
  const facetas: { d: string; tono: 'luz' | 'medio' | 'sombra' }[] = [{ d: camino(inner) + ' Z', tono: 'medio' }]
  const bordesLuz: string[] = []
  for (let i = 0; i < n; i++) {
    const a = vert[i], b = vert[(i + 1) % n]
    const mx = (a[0] + b[0]) / 2 - 50, my = (a[1] + b[1]) / 2 - 51, ml = Math.hypot(mx, my) || 1
    const luz = (mx / ml) * -0.6 + (my / ml) * -0.8
    const tono = luz > 0.3 ? 'luz' : luz < -0.3 ? 'sombra' : 'medio'
    facetas.push({ d: camino([a, b, inner[(i + 1) % n], inner[i]]) + ' Z', tono })
    if (luz > 0.45) bordesLuz.push(camino([hacia(a, b, 1.5), hacia(b, a, 1.5)]))
  }
  const luz = bordesLuz.join(' ')
  const centro: P = [50 + j(5), 50 + j(5)]
  // 6 grietas troncales: son también los bordes de los 6 pedazos.
  const a0 = r() * Math.PI * 2
  const angs = Array.from({ length: 6 }, (_, i) => a0 + (i * Math.PI) / 3 + j(0.2))
  const troncos: P[][] = angs.map((a) => {
    const ps: P[] = [centro]
    for (const dist of [9, 19, 31, 45, 80]) {
      const p = desde(centro, a, dist)
      const per = j(dist > 60 ? 0 : 2.2)
      ps.push([p[0] - Math.sin(a) * per, p[1] + Math.cos(a) * per])
    }
    return ps
  })
  const cunas = angs.map((a, i) => {
    const b = angs[(i + 1) % 6] + (i === 5 ? Math.PI * 2 : 0)
    const arco = [0.25, 0.5, 0.75].map((f) => desde(centro, a + (b - a) * f, 90))
    return camino([...troncos[i], ...arco, ...[...troncos[(i + 1) % 6]].reverse()]) + ' Z'
  })
  const centros = angs.map((a, i) => desde(centro, a + (((angs[(i + 1) % 6] + (i === 5 ? Math.PI * 2 : 0)) - a) / 2), 26))
  const grietas: Grieta[] = []
  troncos.forEach((t, i) => { const ps = t.slice(0, 5); grietas.push({ d: camino(ps), cinta: cinta(ps, 2.8 - i * 0.12), ancho: 2.8 - i * 0.12, ang: angs[i], inicio: centro, fin: t[4], roja: true }) })
  // Ramas: cada una sale de un tronco distinto y en otra altura, alternando lados. Ninguna repetida.
  const alturas = [0.55, 0.3, 0.78, 0.42, 0.66, 0.2]
  for (let k = 0; grietas.length < Math.max(6, necesarios); k++) {
    const ti = (k * 5) % 6
    const m = Math.floor(k / 6)
    const t = troncos[ti]
    const f = alturas[m % alturas.length] * 4
    const seg = Math.min(3, Math.floor(f))
    const u = f - seg
    const ini: P = [t[seg][0] + (t[seg + 1][0] - t[seg][0]) * u, t[seg][1] + (t[seg + 1][1] - t[seg][1]) * u]
    const lado = (k + m) % 2 ? 1 : -1
    const ang = angs[ti] + lado * (0.55 + r() * 0.4)
    const largo = Math.max(6, 16 - m * 1.6 + j(3))
    const ps: P[] = [ini]
    for (let s = 1; s <= 3; s++) { const p = desde(ini, ang + j(0.25), (largo * s) / 3); ps.push(p) }
    const ancho = Math.max(0.9, 1.6 - m * 0.12)
    grietas.push({ d: camino(ps), cinta: cinta(ps, ancho), ancho, ang, inicio: ini, fin: ps[3], roja: true })
  }
  // Signos grabados: shuriken, borde de kasa, katana y 3 recortes del kanji.
  const sx = 24 + r() * 14, sy = 22 + r() * 12
  const shur: P[] = []
  for (let i = 0; i < 8; i++) shur.push(desde([sx, sy], (i * Math.PI) / 4 + 0.3, i % 2 ? 2 : 6))
  const kx = 58 + r() * 14, ky = 70 + r() * 8
  const kasa = `M${kx - 12},${ky} Q${kx},${ky - 9} ${kx + 12},${ky} M${kx - 14},${ky + 1.5} L${kx + 14},${ky + 1.5}`
  const kax = 62 + r() * 10, kay = 18 + r() * 8
  const katana = `M${kax},${kay} L${kax + 18},${kay + 26} M${kax + 2.5},${kay + 6} L${kax + 7},${kay + 2.8}`
  const trazos = Array.from({ length: 3 }, (_, i) => ({ x: 28 + i * 13 + j(4), y: 34 + j(10), w: 10 + r() * 6, h: 9 + r() * 7 }))
  return { contorno, luz, facetas, centro, cunas, centros, grietas, signos: { shuriken: camino(shur) + ' Z', kasa, katana, trazos } }
}

/** Lenguas de fuego que suben despacio desde detrás de la piedra (ángulos alrededor de la mitad de arriba). */
const LENGUAS = [
  { ang: -Math.PI * 0.5, alto: 1.15, ancho: 1.1, curva: 1.5, demora: 0, dura: 1.9 },
  { ang: -Math.PI * 0.68, alto: 0.95, ancho: 0.9, curva: -2, demora: 0.5, dura: 2.2 },
  { ang: -Math.PI * 0.32, alto: 1, ancho: 0.95, curva: 2, demora: 0.9, dura: 2 },
  { ang: -Math.PI * 0.84, alto: 0.7, ancho: 0.8, curva: -2.5, demora: 0.3, dura: 2.4 },
  { ang: -Math.PI * 0.16, alto: 0.75, ancho: 0.8, curva: 2.5, demora: 1.2, dura: 2.3 },
  { ang: -Math.PI * 0.98, alto: 0.45, ancho: 0.7, curva: -2, demora: 0.7, dura: 2.6 },
  { ang: -Math.PI * 0.02, alto: 0.5, ancho: 0.7, curva: 2, demora: 1.5, dura: 2.5 },
]

type Golpe = { n: number; grieta: number; pedazo: number | null; forjado: boolean }

export function PiedraShinobi({ id, kanji, validos, necesarios, tam = 96, reducido = false, conSonido = true }: {
  id: string
  kanji: string
  validos: number
  necesarios: number
  tam?: number
  reducido?: boolean
  conSonido?: boolean
}) {
  const u = useId().replace(/:/g, '')
  const forma = useMemo(() => formaDe(id, necesarios), [id, necesarios])
  const umbrales = useMemo(() => pedazosPara(necesarios), [necesarios])
  const v = Math.max(0, Math.min(validos, necesarios))
  const completo = v >= necesarios
  const caidos = umbrales.filter((p) => v >= p).length
  const previo = useRef(v)
  const [golpe, setGolpe] = useState<Golpe | null>(null)
  useEffect(() => { asegurarFuente(kanji) }, [kanji])
  useEffect(() => {
    const antes = previo.current
    previo.current = v
    if (v !== antes + 1 || reducido) { setGolpe(null); return }
    const pedazo = umbrales.filter((p) => v >= p).length > umbrales.filter((p) => antes >= p).length ? umbrales.filter((p) => v >= p).length - 1 : null
    const g: Golpe = { n: Date.now(), grieta: v - 1, pedazo, forjado: v >= necesarios }
    setGolpe(g)
    if (conSonido) {
      sonarForja('paso')
      if (g.forjado) sonarForja('forjado', 0.35)
      else if (pedazo !== null) sonarForja('pedazo', 0.35)
    }
    const t = window.setTimeout(() => setGolpe((x) => (x?.n === g.n ? null : x)), g.forjado ? 1600 : 1300)
    return () => window.clearTimeout(t)
  }, [v, umbrales, necesarios, reducido, conSonido])

  // Pedazos que se ven: los que no cayeron, más el que está cayendo ahora (o todos si se está forjando).
  const caidosAntes = umbrales.filter((p) => v - 1 >= p).length
  const visibles = forma.cunas.map((_, i) => i).filter((i) => i >= caidos || (!!golpe && i >= caidosAntes))
  const grietas = forma.grietas.slice(0, v)
  // Fuego: casi nada en 0, apenas a los 5, claro a los 14, fuerte a los 21; forjado arde entero.
  const fuego = completo ? 1 : Math.pow(v / Math.max(1, necesarios), 1.3)
  // En la piedra chica de Hoy las grietas se engrosan para que se lean.
  const grueso = tam < 80 ? 1.6 : 1
  const signos = Math.min(0.9, 0.42 + v * 0.017)
  const g = golpe
  const nueva = g ? forma.grietas[g.grieta] : null
  const tajo = nueva ? [desde(nueva.fin, nueva.ang, 30), desde(nueva.fin, nueva.ang + Math.PI, 70)] : null
  return (
    <svg
      className={`piedra-forja ${completo ? 'forjada' : ''} ${g ? 'golpe' : ''} ${g?.forjado ? 'estallando' : ''} ${reducido ? 'quieta' : ''}`}
      viewBox="-6 -6 112 116"
      width={tam}
      height={(tam * 116) / 112}
      role="img"
      aria-label={completo ? `Forjado: ${kanji}` : `Piedra: ${v} de ${necesarios} días`}
    >
      <defs>
        <linearGradient id={`pg${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7C766F" />
          <stop offset="1" stopColor="#47433F" />
        </linearGradient>
        <radialGradient id={`ph${u}`} cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#0c0b0a" stopOpacity="0.8" />
          <stop offset="0.7" stopColor="#0c0b0a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#0c0b0a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`pa${u}`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#ff7a2e" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#e0213b" stopOpacity="0.7" />
          <stop offset="1" stopColor="#b0101f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`pl${u}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff8a3a" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#e0213b" stopOpacity="0.75" />
          <stop offset="1" stopColor="#e0213b" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`pc${u}`}><path d={forma.contorno} /></clipPath>
        {forma.cunas.map((d, i) => <clipPath key={i} id={`pw${u}${i}`}><path d={d} /></clipPath>)}
        {forma.signos.trazos.map((t, i) => <clipPath key={i} id={`pt${u}${i}`}><rect x={t.x} y={t.y} width={t.w} height={t.h} /></clipPath>)}
      </defs>
      <ellipse className="pf-sombra" cx="50" cy="99" rx={completo ? 26 : 40} ry="5" />
      {fuego > 0.03 && (
        <g className="pf-aura" aria-hidden style={{ opacity: Math.min(1, 0.15 + fuego * 0.85) }}>
          <circle className="pf-aura-brasa" cx="50" cy="52" r={(completo ? 34 : 40) + fuego * 16} fill={`url(#pa${u})`} style={{ opacity: completo ? 0.9 : fuego * 0.8 }} />
          {LENGUAS.map((l, k) => {
            const base = completo ? 20 : 33
            const p = desde([50, 52], l.ang, base)
            const h = (completo ? 26 : 8 + 24 * fuego) * l.alto
            const w = (completo ? 7 : 6) * l.ancho
            return <path key={k} className="pf-lengua" fill={`url(#pl${u})`} d={`M${(p[0] - w).toFixed(1)},${p[1].toFixed(1)} Q${(p[0] - w * 0.7).toFixed(1)},${(p[1] - h * 0.55).toFixed(1)} ${(p[0] + l.curva).toFixed(1)},${(p[1] - h).toFixed(1)} Q${(p[0] + w * 0.8).toFixed(1)},${(p[1] - h * 0.5).toFixed(1)} ${(p[0] + w).toFixed(1)},${p[1].toFixed(1)} Z`} style={{ animationDelay: `${l.demora}s`, animationDuration: `${l.dura}s`, transformOrigin: `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px` }} />
          })}
        </g>
      )}
      {/* Hueco oscuro y suave detrás (sin bordes duros): ahí se ve el kanji por donde cayeron pedazos. */}
      {!completo && caidos > 0 && <path d={forma.contorno} fill={`url(#ph${u})`} />}
      {/* El kanji como los íconos de Progreso: pincel blanco papel con la sombra roja corrida. */}
      <g clipPath={completo ? undefined : `url(#pc${u})`}><g className={`pf-kanji ${completo ? 'arde' : ''}`}>
        <text className="pf-kanji-sombra" x="54" y="56" textAnchor="middle" dominantBaseline="central" fontSize={completo ? 62 : 50}>{kanji}</text>
        <text className="pf-kanji-tinta" x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize={completo ? 62 : 50}>{kanji}</text>
      </g></g>
      {/* Antes del primer pedazo, una piedra entera debajo tapa las uniones finas entre pedazos (no deben parecer grietas). */}
      {caidos === 0 && <path d={forma.contorno} className="pf-faceta medio" />}
      {visibles.map((i) => {
        const cae = g && (g.pedazo === i || g.forjado)
        const c = forma.centros[i]
        const dx = (c[0] - forma.centro[0]) * (g?.forjado ? 1.6 : 0.6)
        const dy = g?.forjado ? (c[1] - forma.centro[1]) * 1.6 : 70
        return (
          <g key={i} clipPath={`url(#pw${u}${i})`} className={cae ? (g!.forjado ? 'pf-pedazo estalla' : 'pf-pedazo cae') : 'pf-pedazo'} style={{ '--dx': `${dx.toFixed(1)}px`, '--dy': `${dy.toFixed(1)}px`, '--rot': `${(i % 2 ? 1 : -1) * (14 + i * 4)}deg`, transformOrigin: `${c[0].toFixed(1)}px ${c[1].toFixed(1)}px` } as CSSProperties}>
            <g clipPath={`url(#pc${u})`}>
              {forma.facetas.map((f, k) => <path key={k} d={f.d} className={`pf-faceta ${f.tono}`} />)}
              <g className="pf-signos" style={{ opacity: signos }}>
                <path d={forma.signos.shuriken} />
                <path d={forma.signos.kasa} className="linea" />
                <path d={forma.signos.katana} className="linea" />
                {forma.signos.trazos.map((_, k) => <text key={k} clipPath={`url(#pt${u}${k})`} x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="64" className="pf-trazo">{kanji}</text>)}
              </g>
              {grietas.map((gr, k) => (
                <g key={k} className={g && k === g.grieta ? 'pf-grieta nueva' : 'pf-grieta'}>
                  <path d={gr.cinta} className="pf-grieta-luz" transform="translate(0.5 0.7)" />
                  <path d={gr.d} className="pf-grieta-tinta" strokeWidth={gr.ancho * grueso} pathLength={1} />
                  {g && k === g.grieta && <path d={gr.d} className="pf-grieta-abre" strokeWidth={gr.ancho * grueso} pathLength={1} />}
                  <path d={gr.d} className="pf-grieta-brillo" strokeWidth={gr.ancho * grueso * 1.3} style={{ opacity: 0.35 + fuego * 0.6 }} pathLength={1} />
                  <path d={gr.d} className="pf-grieta-roja" strokeWidth={Math.max(0.5, gr.ancho * grueso * 0.45)} pathLength={1} />
                </g>
              ))}
            </g>
            <path d={forma.luz} className="pf-luz" clipPath={`url(#pc${u})`} />
            <path d={forma.contorno} className="pf-borde" />
          </g>
        )
      })}
      {g && tajo && (
        <g className="pf-golpe" aria-hidden key={g.n}>
          <circle className="pf-destello" cx={nueva!.inicio[0]} cy={nueva!.inicio[1]} r="20" />
          <path className="pf-tajo" d={camino(tajo)} pathLength={1} />
          {Array.from({ length: 6 }, (_, k) => {
            const a = nueva!.ang + Math.PI / 2 + (k - 2.5) * 0.5
            const p = nueva!.fin
            return <path key={k} className="pf-esquirla" d={`M${p[0]},${p[1]} l2.2,-1 l-0.6,2.4 Z`} style={{ '--ex': `${(Math.cos(a) * (14 + k * 3)).toFixed(1)}px`, '--ey': `${(Math.sin(a) * (14 + k * 3) - 8).toFixed(1)}px`, animationDelay: `${0.12 + k * 0.02}s` } as CSSProperties} />
          })}
          {(g.pedazo !== null || g.forjado) && Array.from({ length: 6 }, (_, k) => {
            const c = g.forjado ? forma.centro : forma.centros[g.pedazo ?? 0]
            return <circle key={`p${k}`} className="pf-polvo" cx={c[0] + (k - 2.5) * 5} cy={Math.min(94, c[1] + 26)} r={2 + (k % 3) * 0.8} style={{ animationDelay: `${0.7 + k * 0.04}s` }} />
          })}
        </g>
      )}
    </svg>
  )
}
