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
  // Piedra tallada tranquila: casi cuadrada, esquinas suavemente redondeadas, lados apenas irregulares.
  const esq: P[] = [[11 + j(1.5), 11 + j(1.5)], [89 + j(1.5), 10 + j(1.5)], [90 + j(1.5), 89 + j(1.2)], [10 + j(1.5), 90 + j(1.2)]]
  const medio = (a: P, b: P, k: number): P => { const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [m[0] + (dy / l) * k, m[1] - (dx / l) * k] }
  const rad = 10
  const hacia = (a: P, b: P, d: number): P => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [a[0] + (dx / l) * d, a[1] + (dy / l) * d] }
  let contorno = ''
  for (let i = 0; i < 4; i++) {
    const a = esq[i], b = esq[(i + 1) % 4], ant = esq[(i + 3) % 4]
    const m = medio(a, b, -1.2 - r() * 1.2)
    const p1 = hacia(a, ant, rad), p2 = hacia(a, b, rad)
    contorno += `${i ? 'L' : 'M'}${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${a[0].toFixed(1)},${a[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)} Q${m[0].toFixed(1)},${m[1].toFixed(1)} ${hacia(b, a, rad)[0].toFixed(1)},${hacia(b, a, rad)[1].toFixed(1)} `
  }
  contorno += 'Z'
  const l1 = hacia(esq[0], esq[1], rad * 0.9), l2 = hacia(esq[1], esq[0], rad * 0.9)
  const luz = `M${l1[0].toFixed(1)},${(l1[1] + 1.1).toFixed(1)} L${l2[0].toFixed(1)},${(l2[1] + 1.1).toFixed(1)}`
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
  troncos.forEach((t, i) => { const ps = t.slice(0, 5); grietas.push({ d: camino(ps), cinta: cinta(ps, 1.8 - i * 0.08), ancho: 1.8 - i * 0.08, ang: angs[i], inicio: centro, fin: t[4], roja: i % 2 === 0 }) })
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
    const ancho = Math.max(0.55, 1.05 - m * 0.1)
    grietas.push({ d: camino(ps), cinta: cinta(ps, ancho), ancho, ang, inicio: ini, fin: ps[3], roja: k % 3 === 0 })
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
  return { contorno, luz, centro, cunas, centros, grietas, signos: { shuriken: camino(shur) + ' Z', kasa, katana, trazos } }
}

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
  // El hilo rojo aparece recién con el primer pedazo y crece de a poco.
  const rojo = caidos > 0 ? Math.min(0.75, 0.2 + caidos * 0.1) : 0
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
        <clipPath id={`pc${u}`}><path d={forma.contorno} /></clipPath>
        {forma.cunas.map((d, i) => <clipPath key={i} id={`pw${u}${i}`}><path d={d} /></clipPath>)}
        {forma.signos.trazos.map((t, i) => <clipPath key={i} id={`pt${u}${i}`}><rect x={t.x} y={t.y} width={t.w} height={t.h} /></clipPath>)}
      </defs>
      <ellipse className="pf-sombra" cx="50" cy="99" rx={completo ? 26 : 40} ry="5" />
      {/* Hueco oscuro y suave detrás (sin bordes duros): ahí se ve el kanji por donde cayeron pedazos. */}
      {!completo && caidos > 0 && <path d={forma.contorno} fill={`url(#ph${u})`} />}
      {/* El kanji como los íconos de Progreso: pincel blanco papel con la sombra roja corrida. */}
      <g className="pf-kanji">
        <text className="pf-kanji-sombra" x="54" y="56" textAnchor="middle" dominantBaseline="central" fontSize="62">{kanji}</text>
        <text className="pf-kanji-tinta" x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="62">{kanji}</text>
      </g>
      {/* Antes del primer pedazo, una piedra entera debajo tapa las uniones finas entre pedazos (no deben parecer grietas). */}
      {caidos === 0 && <path d={forma.contorno} fill={`url(#pg${u})`} />}
      {visibles.map((i) => {
        const cae = g && (g.pedazo === i || g.forjado)
        const c = forma.centros[i]
        const dx = (c[0] - forma.centro[0]) * (g?.forjado ? 1.6 : 0.6)
        const dy = g?.forjado ? (c[1] - forma.centro[1]) * 1.6 : 70
        return (
          <g key={i} clipPath={`url(#pw${u}${i})`} className={cae ? (g!.forjado ? 'pf-pedazo estalla' : 'pf-pedazo cae') : 'pf-pedazo'} style={{ '--dx': `${dx.toFixed(1)}px`, '--dy': `${dy.toFixed(1)}px`, '--rot': `${(i % 2 ? 1 : -1) * (14 + i * 4)}deg`, transformOrigin: `${c[0].toFixed(1)}px ${c[1].toFixed(1)}px` } as CSSProperties}>
            <g clipPath={`url(#pc${u})`}>
              <path d={forma.contorno} fill={`url(#pg${u})`} />
              <g className="pf-signos" style={{ opacity: signos }}>
                <path d={forma.signos.shuriken} />
                <path d={forma.signos.kasa} className="linea" />
                <path d={forma.signos.katana} className="linea" />
                {forma.signos.trazos.map((_, k) => <text key={k} clipPath={`url(#pt${u}${k})`} x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="64" className="pf-trazo">{kanji}</text>)}
              </g>
              {grietas.map((gr, k) => (
                <g key={k} className={g && k === g.grieta ? 'pf-grieta nueva' : 'pf-grieta'}>
                  <path d={gr.cinta} className="pf-grieta-luz" transform="translate(0.5 0.7)" />
                  <path d={gr.cinta} className="pf-grieta-tinta" />
                  {g && k === g.grieta && <path d={gr.d} className="pf-grieta-abre" strokeWidth={gr.ancho * 0.8} pathLength={1} />}
                  {rojo > 0 && gr.roja && <path d={gr.d} className="pf-grieta-roja" strokeWidth={Math.max(0.22, gr.ancho * 0.22)} style={{ opacity: rojo }} pathLength={1} />}
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
