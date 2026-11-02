import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../data/db'
import { diferenciaDias, fechaDe, fechaDelDiaDelCiclo, fechaLegible, lunesDe, sumarDias } from '../../domain/fechas'
import { estadoNivel, etapaDeNivel, tablaNiveles, xpParaNivel } from '../../domain/niveles'
import { obtenerAjustes } from '../../services/base'
import { estadoDelCiclo } from '../../services/ciclo'
import { atributosHoy, cumplimientoPorDia, pilaresPorDia, rachaActual, type EstadoPilar } from '../../services/dia'
import { xpAntesDe, xpPorDia, xpTotal } from '../../services/xp'
import { resumenContadores } from '../../services/contadores'
import { duracionSuenio, resumenSuenio, type ResumenSuenio } from '../../services/suenio'
import { Hoja, clasePorcentaje, elegirMovimiento, movimientoReducido } from '../componentes'
import { useDatos } from '../estado'
import { graficoMetas } from '../../services/metas'
import { FilaMeta } from '../metas'
import { VERSION_APP } from '../../version'
import { VIDEOS, VIDRIO_EN_DESTELLO, intensidadDestello, type VideoFondo, elegirVideo, useModoFondo, usePantallaHorizontal, VIDEO_PC, video as datosVideo } from '../../fondos/elegir'

const BASE = import.meta.env.BASE_URL

/**
 * Progreso: el video vertical del shinobi a pantalla completa de fondo (lluvia
 * o rayos según el día) y, encima, todo de vidrio semitransparente:
 * nivel, XP, racha, XP por día, pilares del ciclo, series rápidas y atributos.
 * El día del ciclo y las fases ya van en la cabecera, así que acá no se repiten.
 */
type Rango = 'semana' | 'mes' | 'ciclo'

export function Progreso({ hoy }: { hoy: string }) {
  const [verNiveles, setVerNiveles] = useState(false)
  const [rango, setRango] = useState<Rango>('semana')
  const [atributoSel, setAtributoSel] = useState<string | null>(null)
  const datos = useDatos(async () => {
    const ajustes = await obtenerAjustes()
    const estado = await estadoDelCiclo(hoy)
    const total = await xpTotal()
    const nivel = estadoNivel(total, ajustes.baseNivel)
    const racha = await rachaActual(hoy)
    const niveles = await db().niveles.toArray()
    const lunes = lunesDe(hoy)
    const porSemana = await xpPorDia(lunes, hoy)
    let xpSemana = 0
    for (const v of porSemana.values()) xpSemana += v
    const xpHoy = porSemana.get(hoy) ?? 0
    const atributos = await atributosHoy(hoy)
    const acciones = new Map((await db().acciones.toArray()).map((a) => [a.id, a.nombre]))
    for (const c of await db().contadores.toArray()) acciones.set(`contador:${c.id}`, `${c.nombre} (meta diaria)`)
    const contadores = await resumenContadores(hoy)
    const sueno = await resumenSuenio(hoy, 14)
    let pilares: { nombre: string; hechos: number; programados: number }[] = []
    let diasCumplidos = 0
    let diasContados = 0
    // Serie del gráfico: desde el Día 1 hasta hoy.
    const serie: PuntoSerie[] = []
    if (estado && !estado.noEmpezado) {
      const inicio = estado.ciclo.inicio
      const hasta = hoy < estado.fechaFin ? hoy : estado.fechaFin
      const porDia = await xpPorDia(inicio, hasta)
      const pil = await pilaresPorDia(inicio, hasta, hoy)
      let acumulado = await xpAntesDe(inicio)
      for (let f = inicio, dia = 1; f <= hasta; f = sumarDias(f, 1), dia++) {
        const xp = porDia.get(f) ?? 0
        acumulado += xp
        serie.push({ fecha: f, dia, xp, acumulado, pilares: (pil.get(f) ?? []).map((p) => ({ nombre: p.nombre, estado: p.estado })) })
      }
      const porPilar = new Map<string, { nombre: string; hechos: number; programados: number }>()
      for (const [, lista] of await pilaresPorDia(inicio, hasta, hoy)) {
        for (const p of lista) {
          if (p.estado === 'pendiente' || p.estado === 'descanso') continue
          const x = porPilar.get(p.accionId) ?? { nombre: p.nombre, hechos: 0, programados: 0 }
          x.programados++
          if (p.estado === 'cumplido' || p.estado === 'tarde') x.hechos++
          porPilar.set(p.accionId, x)
        }
      }
      pilares = [...porPilar.values()]
      for (const [, c] of await cumplimientoPorDia(inicio, hasta, hoy)) {
        if (c.porcentaje === null || c.excepcion) continue
        diasContados++
        if (c.porcentaje >= ajustes.umbralRacha) diasCumplidos++
      }
    }
    return { ajustes, estado, total, nivel, racha, niveles, xpSemana, xpHoy, serie, atributos, acciones, contadores, sueno, pilares, diasCumplidos, diasContados }
  }, [hoy])
  const reducido = useMemo(() => movimientoReducido(), [])
  const modo = useModoFondo()
  // El video arranca justo debajo de la cabecera (su alto cambia con la barra de fases).
  const [arriba, setArriba] = useState(0)
  useEffect(() => {
    const cab = document.querySelector('.cabecera')
    if (!cab) return
    const medir = () => setArriba(cab.getBoundingClientRect().bottom)
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(cab)
    return () => ro?.disconnect()
  }, [])
  const d = datos.datos
  const sel = d?.atributos.find((a) => a.atributoId === atributoSel)
  const fechaNivel = (n: number) => d?.niveles.find((x) => x.nivel === n)
  // Video del día: se decide con la fecha de Córdoba y el Día 1 del ciclo.
  // En la computadora (pantalla horizontal) va el video horizontal; en el celu, el vertical del día.
  const horizontal = usePantallaHorizontal()
  const fondo = d ? (horizontal ? VIDEO_PC : datosVideo(elegirVideo(modo, hoy, d.estado?.ciclo.inicio))) : null

  return (
    <div className="progreso-tinta" data-fondo={fondo?.tipo ?? 'oscuro'} data-vidrio={vidrioClaro() && fondo?.tipo === 'claro' ? 'claro' : undefined} style={{ '--av-arriba': `${arriba}px` } as React.CSSProperties}>
      {/* Fondo fijo: el video vertical cubre toda la pantalla y no se mueve al desplazar */}
      {createPortal(
        <div className="av-fondo" aria-hidden="true" data-orientacion={horizontal ? 'horizontal' : undefined}>
          {fondo && <VideoDeFondo key={fondo.id} fondo={fondo} quieto={reducido} pausado={verNiveles || !!sel} />}
        </div>,
        document.body,
      )}

      <div className="av-contenido">
        {/* Hueco para que el video se vea entero antes de las tarjetas */}
        <div className="av-hueco" />
        {!d ? (
          <p className="av-cargando">Cargando…</p>
        ) : (
          <div className="av-tarjetas">
            {/* Nivel, XP y racha: tocar abre la tabla de niveles */}
            <section className="av-tarjeta av-fila-3 av-tocable" role="button" tabIndex={0} onClick={() => setVerNiveles(true)} onKeyDown={(e) => e.key === 'Enter' && setVerNiveles(true)} aria-label="Nivel, XP y racha. Tocá para ver la tabla de niveles">
              <Dato grande={String(d.nivel.nivel)} chico="NIVEL" sub={etapaDeNivel(d.nivel.nivel)} />
              <Dato grande={String(d.total)} chico="XP TOTAL" sub={`${d.nivel.xpEnNivel} / ${d.nivel.xpParaSiguiente} al nivel ${d.nivel.nivel + 1}`} />
              <Dato grande={String(d.racha)} chico="RACHA" sub={d.racha === 1 ? 'día seguido' : 'días seguidos'} rojo={d.racha > 0} />
              <div className="av-barra" aria-hidden="true"><div style={{ width: `${Math.round(100 * d.nivel.progreso)}%` }} /></div>
            </section>

            {/* Gráfico de XP: semana, mes o ciclo */}
            <section className="av-tarjeta">
              <div className="av-tarjeta-titulo">
                <span>XP</span>
                <div className="seg oscuro" role="tablist" aria-label="Rango del gráfico">
                  {(['semana', 'mes', 'ciclo'] as Rango[]).map((r) => (
                    <button key={r} role="tab" aria-selected={rango === r} className={rango === r ? 'activo' : ''} onClick={() => setRango(r)}>{r === 'semana' ? 'Semana' : r === 'mes' ? 'Mes' : 'Ciclo'}</button>
                  ))}
                </div>
              </div>
              {d.estado && !d.estado.noEmpezado ? (
                <GraficoXp serie={d.serie} rango={rango} hoy={hoy} ciclo={d.estado.ciclo} base={d.ajustes.baseNivel} total={d.total} xpSemana={d.xpSemana} xpHoy={d.xpHoy} />
              ) : (
                <div className="av-nota" style={{ textAlign: 'center', padding: '18px 0' }}>El gráfico empieza el Día 1{d.estado ? ` (${fechaLegible(d.estado.ciclo.inicio)})` : ''}.</div>
              )}
            </section>

            {/* Metas: cumplidas y no cumplidas */}
            <TarjetaMetas hoy={hoy} inicio={d.estado && !d.estado.noEmpezado ? d.estado.ciclo.inicio : hoy} fin={d.estado ? d.estado.fechaFin : sumarDias(hoy, 89)} />

            {/* Sueño: una variable más de mejora. Tocar abre la pantalla Sueño. */}
            <TarjetaSueno r={d.sueno} />

            {/* Pilares del ciclo */}
            {d.pilares.length > 0 && (
              <section className="av-tarjeta">
                <div className="av-tarjeta-titulo"><span>Pilares en el ciclo</span><span className="av-nota">{d.diasCumplidos} de {d.diasContados} días cumplidos</span></div>
                <div className="av-pilares">
                  {d.pilares.map((p) => <Anillo key={p.nombre} nombre={p.nombre} valor={p.programados ? p.hechos / p.programados : 0} texto={`${p.hechos} de ${p.programados}`} />)}
                </div>
              </section>
            )}

            {/* Series rápidas (flexiones, dominadas…) */}
            {d.contadores.length > 0 && (
              <section className="av-tarjeta">
                <div className="av-tarjeta-titulo"><span>Series rápidas</span><span className="av-nota">hoy · semana · récord</span></div>
                {d.contadores.map((c) => (
                  <div key={c.contador.id} className="av-atributo">
                    <div className="av-atributo-fila"><span>{c.contador.nombre}</span><span className="av-mono"><b className={c.metaLogradaHoy ? 'av-rojo' : ''}>{c.hoy}</b><span className="av-nota">/{c.cuotaHoy}</span> · {c.semana} · {c.record ? c.record.total : '—'}</span></div>
                    <div className="av-barra fina" aria-hidden="true"><div style={{ width: `${Math.min(100, (100 * c.hoy) / Math.max(1, c.cuotaHoy))}%` }} /></div>
                    <div className="av-nota">{c.diasConMeta} {c.diasConMeta === 1 ? 'día' : 'días'} en cuota · {c.diasConExtra} en extra</div>
                    {c.subidas.length > 1 && <div className="av-nota">Cuota: {c.subidas.map((x, i) => (i === 0 ? `${x.cuota}` : `${x.cuota} (${fechaLegible(x.desde)})`)).join(' → ')}</div>}
                  </div>
                ))}
              </section>
            )}

            {/* Atributos: tocar uno abre el desglose */}
            {d.atributos.length > 0 && (
              <section className="av-tarjeta">
                <div className="av-tarjeta-titulo"><span>Atributos</span><span className="av-nota">tocá uno para el detalle</span></div>
                {d.atributos.map((a) => (
                  <div key={a.atributoId} className="av-atributo av-tocable" role="button" tabIndex={0} onClick={() => setAtributoSel(a.atributoId)} onKeyDown={(e) => e.key === 'Enter' && setAtributoSel(a.atributoId)}>
                    <div className="av-atributo-fila"><span>{a.nombre}</span><span className="av-mono">{a.valor ?? '—'}{a.tendencia ? <span className={a.tendencia > 0 ? 'av-sube' : 'av-baja'}> {a.tendencia > 0 ? '▲' : '▼'}{Math.abs(a.tendencia)}</span> : null}</span></div>
                    <div className="av-barra fina" aria-hidden="true"><div style={{ width: `${a.valor ?? 0}%` }} /></div>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>

      {d && (
        <Hoja abierta={verNiveles} onCerrar={() => setVerNiveles(false)} titulo="Niveles">
          <p className="chico texto-2">Pasar del nivel n al n+1 cuesta {d.ajustes.baseNivel} × n XP. No hay tope. Al lado de cada nivel alcanzado, la fecha.</p>
          <table className="tabla">
            <thead><tr><th>Nivel</th><th className="num">XP total</th><th>Etapa</th><th>Alcanzado</th></tr></thead>
            <tbody>
              {tablaNiveles(Math.max(15, d.nivel.nivel + 5), d.ajustes.baseNivel).map((f) => {
                const h = fechaNivel(f.nivel)
                return (
                  <tr key={f.nivel} style={f.nivel === d.nivel.nivel ? { color: 'var(--acento)', fontWeight: 700 } : undefined}><td>{f.nivel}</td><td className="num">{f.xpTotal}</td><td>{f.etapa}</td><td className="chico texto-3">{h ? fechaLegible(fechaDe(h.alcanzado, d.ajustes.zonaHoraria)) : f.nivel === 1 ? 'inicio' : ''}</td></tr>
                )
              })}
            </tbody>
          </table>
        </Hoja>
      )}

      <Hoja abierta={!!sel} onCerrar={() => setAtributoSel(null)} titulo={sel?.nombre}>
        {sel && d && (
          <>
            <p className="chico texto-2">{sel.descripcion}</p>
            <div className="fila entre"><span>Valor</span><b className={`grande ${clasePorcentaje(sel.valor)}`}>{sel.valor ?? 'datos insuficientes'}</b></div>
            <p className="chico">
              {sel.cumplidos} cumplidos de {sel.programados} programados entre {fechaLegible(sel.desde)} y {fechaLegible(sel.hasta)} ({sel.ventanaDias} días).
              {sel.valor === null && ` Hacen falta al menos ${sel.minimoProgramados} compromisos programados en la ventana.`}
            </p>
            <table className="tabla">
              <thead><tr><th>Acción</th><th className="num">Cumplidos</th><th className="num">Programados</th></tr></thead>
              <tbody>
                {sel.porAccion.map((p) => <tr key={p.accionId}><td>{d.acciones.get(p.accionId) ?? p.accionId}</td><td className="num">{p.cumplidos}</td><td className="num">{p.programados}</td></tr>)}
              </tbody>
            </table>
            <p className="ayuda">Fórmula: 100 × cumplidos / programados, con el peso de cada acción. Lo pendiente de hoy no cuenta. Podés cambiar qué acciones alimentan este atributo en «Más → Acciones».</p>
          </>
        )}
      </Hoja>
    </div>
  )
}

type PuntoSerie = { fecha: string; dia: number; xp: number; acumulado: number; pilares: { nombre: string; estado: EstadoPilar }[] }

/**
 * Gráfico de XP: una línea gruesa del acumulado con área, puntos donde subiste
 * de nivel, línea punteada hasta el próximo nivel y, debajo, las barras del XP
 * de cada día. Tocar un punto muestra el detalle del día.
 */
function GraficoXp({ serie, rango, hoy, ciclo, base, total, xpSemana, xpHoy }: { serie: PuntoSerie[]; rango: Rango; hoy: string; ciclo: { inicio: string; duracionDias: number; diasPorFase: number }; base: number; total: number; xpSemana: number; xpHoy: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const W = 360
  const H = 150
  const HB = 56
  const mi = { arriba: 14, abajo: 14, izq: 6, der: 6 }
  const nivel = estadoNivel(total, base)
  const faltan = nivel.xpInicioSiguiente - total

  const m = useMemo(() => {
    const diaHoy = Math.max(1, Math.min(ciclo.duracionDias, diferenciaDias(ciclo.inicio, hoy) + 1))
    let d0: number
    let d1: number
    if (rango === 'ciclo') {
      d0 = 1
      d1 = ciclo.duracionDias
    } else {
      const n = rango === 'semana' ? 7 : 30
      d1 = diaHoy
      d0 = Math.max(1, d1 - n + 1)
      if (d1 - d0 + 1 < n) d1 = Math.min(ciclo.duracionDias, d0 + n - 1)
    }
    const visibles = serie.filter((p) => p.dia >= d0 && p.dia <= d1)
    const minY = Math.min(total, ...visibles.map((p) => p.acumulado - p.xp))
    const maxY = Math.max(total, ...visibles.map((p) => p.acumulado))
    const yMin = rango === 'ciclo' ? 0 : Math.max(0, Math.floor(minY * 0.9))
    const yMax = Math.max(Math.ceil(nivel.xpInicioSiguiente * 1.06), Math.ceil(maxY * 1.1), yMin + 50)
    const ancho = W - mi.izq - mi.der
    const alto = H - mi.arriba - mi.abajo
    const x = (dia: number) => mi.izq + ((dia - d0) / Math.max(1, d1 - d0)) * ancho
    const y = (v: number) => mi.arriba + alto - ((v - yMin) / (yMax - yMin)) * alto
    const subidas: { dia: number; nivel: number; xp: number }[] = []
    for (const p of visibles) {
      const antes = p.acumulado - p.xp
      for (let n = 2; n < 400; n++) {
        const u = xpParaNivel(n, base)
        if (u > p.acumulado) break
        if (u > antes) subidas.push({ dia: p.dia, nivel: n, xp: p.acumulado })
      }
    }
    const maxBarra = Math.max(1, ...visibles.map((p) => p.xp))
    return { d0, d1, diaHoy, visibles, x, y, yMin, yMax, subidas, maxBarra, ancho, alto }
  }, [serie, rango, hoy, ciclo, base, total, nivel.xpInicioSiguiente])

  const ruta = m.visibles.map((p, i) => `${i === 0 ? 'M' : 'L'}${m.x(p.dia).toFixed(1)},${m.y(p.acumulado).toFixed(1)}`).join(' ')
  const ultimo = m.visibles[m.visibles.length - 1]
  const area = ultimo ? `${ruta} L${m.x(ultimo.dia).toFixed(1)},${m.y(m.yMin).toFixed(1)} L${m.x(m.visibles[0].dia).toFixed(1)},${m.y(m.yMin).toFixed(1)} Z` : ''
  const puntoHoy = m.visibles.find((p) => p.fecha === hoy)
  const seleccionado = sel !== null ? m.visibles.find((p) => p.dia === sel) : undefined
  const anchoBarra = Math.max(2, (m.ancho / Math.max(1, m.d1 - m.d0 + 1)) * 0.6)
  const yMeta = m.y(nivel.xpInicioSiguiente)
  const animar = !movimientoReducido()

  const tocar = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = ref.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const dia = Math.round(m.d0 + ((px - mi.izq) / m.ancho) * (m.d1 - m.d0))
    const cerca = m.visibles.reduce<PuntoSerie | null>((mejor, p) => (!mejor || Math.abs(p.dia - dia) < Math.abs(mejor.dia - dia) ? p : mejor), null)
    setSel(cerca ? (sel === cerca.dia ? null : cerca.dia) : null)
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <svg ref={ref} className="grafico" viewBox={`0 0 ${W} ${H + HB}`} role="img" aria-label={`XP acumulado: ${total} XP al día ${m.diaHoy}. Te faltan ${faltan} XP para el nivel ${nivel.nivel + 1}`} onClick={tocar}>
        <defs>
          <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--acento)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--acento)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line className="meta-linea" x1={mi.izq} x2={W - mi.der} y1={yMeta} y2={yMeta} />
        <text className="meta-etq" x={W - mi.der} y={yMeta - 4} textAnchor="end">Nivel {nivel.nivel + 1} · faltan {faltan} XP</text>
        {area && <path className="area" d={area} />}
        {ruta && <path className={`linea gruesa ${animar ? 'dibujo' : ''}`} d={ruta} />}
        {m.subidas.map((s) => (
          <g key={s.nivel} className="subida">
            <circle cx={m.x(s.dia)} cy={m.y(s.xp)} r={9} />
            <text x={m.x(s.dia)} y={m.y(s.xp) + 3.5} textAnchor="middle">{s.nivel}</text>
          </g>
        ))}
        {seleccionado && (
          <g>
            <line className="sel-linea" x1={m.x(seleccionado.dia)} x2={m.x(seleccionado.dia)} y1={mi.arriba} y2={H + HB - 4} />
            <circle className="sel-punto" cx={m.x(seleccionado.dia)} cy={m.y(seleccionado.acumulado)} r={4} />
          </g>
        )}
        {puntoHoy && <circle className={`hoy-punto ${animar ? 'late' : ''}`} cx={m.x(puntoHoy.dia)} cy={m.y(puntoHoy.acumulado)} r={5} />}
        <text className="eje" x={mi.izq} y={H - 2}>día {m.d0}</text>
        <text className="eje" x={W - mi.der} y={H - 2} textAnchor="end">día {m.d1}</text>
        {m.visibles.map((p) => {
          const baseY = H + HB - 6
          const h = p.xp > 0 ? Math.max(4, (p.xp / m.maxBarra) * (HB - 14)) : 2
          const cx = m.x(p.dia)
          return <rect key={p.dia} className={`barra-dia ${p.xp === 0 ? 'cero' : ''} ${sel === p.dia ? 'sel' : ''} ${p.fecha === hoy ? 'hoy' : ''}`} x={cx - anchoBarra / 2} y={baseY - h} width={anchoBarra} height={h} rx={Math.min(3, anchoBarra / 3)} />
        })}
      </svg>
      {seleccionado ? (
        <div className="grafico-info">
          <span><b>{fechaLegible(seleccionado.fecha)}</b> <span className="av-nota">· día {seleccionado.dia}</span></span>
          <span className="av-mono">+{seleccionado.xp} XP <span className="av-nota">· {seleccionado.acumulado} total</span></span>
          <span className="pil" title={seleccionado.pilares.map((p) => `${p.nombre}: ${p.estado}`).join(', ')}>
            {seleccionado.pilares.map((p, i) => <i key={i} className={p.estado} />)}
          </span>
        </div>
      ) : (
        <div className="av-nota">hoy +{xpHoy} · esta semana +{xpSemana} · desde el Día 1 ({fechaLegible(fechaDelDiaDelCiclo(ciclo.inicio, 1))}). Tocá un punto para ver ese día.</div>
      )}
    </div>
  )
}

function Dato({ grande, chico, sub, rojo }: { grande: string; chico: string; sub?: string; rojo?: boolean }) {
  return (
    <div className="av-dato">
      <span className={`av-grande ${rojo ? 'rojo' : ''}`}>{grande}</span>
      <span className="av-chico">{chico}</span>
      {sub && <span className="av-nota">{sub}</span>}
    </div>
  )
}

/** Anillo de tinta: el arco lleno es lo cumplido. */
function Anillo({ nombre, valor, texto }: { nombre: string; valor: number; texto: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, valor))
  return (
    <div className="av-anillo" role="img" aria-label={`${nombre}: ${Math.round(v * 100)} %`}>
      <svg viewBox="0 0 64 64">
        <circle className="enso-fondo" cx={32} cy={32} r={r} fill="none" strokeWidth={4.5} strokeDasharray={`${c * 0.94} ${c}`} transform="rotate(-80 32 32)" strokeLinecap="round" />
        <circle className={`enso-valor ${v < 0.75 ? "bajo" : ""}`} cx={32} cy={32} r={r} fill="none" strokeWidth={5.5} strokeLinecap="round" strokeDasharray={`${c * v * 0.94} ${c}`} transform="rotate(-80 32 32)" />
        <text x={32} y={36} textAnchor="middle" fontSize={13} fontWeight={700} fill="#f3efe6">{Math.round(v * 100)}</text>
      </svg>
      <span className="av-anillo-nombre">{nombre}</span>
      <span className="av-nota">{texto}</span>
    </div>
  )
}

/** Opción de vidrio claro con texto tinta para el video de viento (solo para comparar; por defecto, vidrio oscuro). */
function vidrioClaro(): boolean {
  try { return localStorage.getItem('vidrioViento') === 'claro' } catch { return false }
}

/**
 * Video de fondo en bucle (el fundido del final con el principio ya viene en
 * el archivo). Se pausa cuando la app pasa a segundo plano o hay una hoja
 * abierta encima, y se desmonta al salir de Progreso o en modo sueño.
 * Si el teléfono no deja arrancarlo solo (ahorro de batería en iPhone, por
 * ejemplo), arranca con el primer toque o con el botón ▶. Con «reducir
 * movimiento» empieza quieto y el botón ▶ lo pone en movimiento (se recuerda).
 */
function VideoDeFondo({ fondo, quieto, pausado }: { fondo: VideoFondo; quieto: boolean; pausado: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const archivo = BASE + fondo.archivo
  const cuadro = BASE + fondo.cuadroFijo
  const [conMovimiento, setConMovimiento] = useState(false)
  const fijo = quieto && !conMovimiento
  const [frenado, setFrenado] = useState(false)
  // El video se carga entero y se reproduce desde la memoria del teléfono: así anda
  // aunque el servidor no entregue el video por partes (Safari lo exige) y sin conexión.
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (fijo) return
    let vivo = true
    let blobUrl: string | null = null
    videoGuardado(archivo).then((u) => {
      if (!vivo) { if (u) URL.revokeObjectURL(u); return }
      if (u) { blobUrl = u; setSrc(u); return }
      // Primera vez: arranca enseguida desde la red y se guarda entero en segundo plano.
      setSrc(archivo)
      guardarVideo(archivo).catch(() => {})
    })
    return () => { vivo = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [archivo, fijo])
  useEffect(() => {
    const v = ref.current
    if (!v || !src) return
    // iPhone necesita «muted» como atributo para dejar arrancar el video solo.
    v.muted = true
    v.defaultMuted = true
    v.setAttribute('muted', '')
    v.setAttribute('playsinline', '')
    const ajustar = () => {
      if (document.hidden || pausado) { v.pause(); return }
      v.play().then(() => setFrenado(false)).catch(() => setFrenado(true))
    }
    ajustar()
    // Primer toque en cualquier lado: si estaba frenado, arranca.
    const tocar = () => { if (v.paused && !document.hidden && !pausado) ajustar() }
    document.addEventListener('visibilitychange', ajustar)
    document.addEventListener('pointerdown', tocar, { passive: true })
    document.addEventListener('touchend', tocar, { passive: true })
    v.addEventListener('canplay', ajustar, { once: true })
    return () => {
      document.removeEventListener('visibilitychange', ajustar)
      document.removeEventListener('pointerdown', tocar)
      document.removeEventListener('touchend', tocar)
      v.removeEventListener('canplay', ajustar)
    }
  }, [pausado, fijo, src])
  // Tinte del vidrio (tarjetas, cabecera y barra) según el video; en los relámpagos sube para que el texto se siga leyendo.
  useEffect(() => {
    const raiz = document.documentElement.style
    raiz.setProperty('--vidrio-a', String(fondo.vidrio))
    raiz.setProperty('--vidrio-destello', String(VIDRIO_EN_DESTELLO))
    raiz.setProperty('--destello', '0')
    const v = ref.current
    let id = 0
    if (v && fondo.destellos && !fijo) {
      const paso = () => {
        raiz.setProperty('--destello', intensidadDestello(v.currentTime, fondo.destellos).toFixed(2))
        id = requestAnimationFrame(paso)
      }
      id = requestAnimationFrame(paso)
    }
    return () => { cancelAnimationFrame(id); raiz.removeProperty('--vidrio-a'); raiz.removeProperty('--vidrio-destello'); raiz.removeProperty('--destello') }
  }, [fondo, fijo])
  // Guardar los otros videos enteros para usarlos sin conexión (una sola vez, sin apuro).
  useEffect(() => {
    const t = setTimeout(() => { for (const v of [...VIDEOS, VIDEO_PC]) guardarVideo(BASE + v.archivo).catch(() => {}) }, 6000)
    return () => clearTimeout(t)
  }, [])
  const mover = () => {
    if (quieto) elegirMovimiento('siempre') // el teléfono pedía quieto: desde ahora, toda la app con movimiento
    setConMovimiento(true)
    ref.current?.play().then(() => setFrenado(false)).catch(() => {})
  }
  return (
    <>
      {fijo ? (
        <img className="av-video" src={cuadro} alt="" />
      ) : (
        <video ref={ref} className="av-video" src={src ?? undefined} poster={cuadro} onError={() => { if (src === archivo) cargarVideo(archivo).then(setSrc).catch(() => {}) }} autoPlay muted loop playsInline preload="auto" disablePictureInPicture />
      )}
      {(fijo || frenado) && createPortal(
        <button className="av-play" onClick={mover} aria-label="Ver el video en movimiento">▶</button>,
        document.body,
      )}
    </>
  )
}

// Copia de los videos en el teléfono. El nombre lleva la versión: al publicar
// videos nuevos con el mismo nombre de archivo, se vuelven a bajar.
const CACHE_VIDEOS = `videos-fondo-v${VERSION_APP}`

async function abrirCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    for (const k of await caches.keys()) if (k.startsWith('videos-fondo') && k !== CACHE_VIDEOS) caches.delete(k)
    return await caches.open(CACHE_VIDEOS)
  } catch { return null }
}

async function guardarVideo(archivo: string): Promise<Response> {
  const url = new URL(archivo, location.href).href
  const cache = await abrirCache()
  const guardado = await cache?.match(url)
  if (guardado) return guardado
  const r = await fetch(url)
  if (!r.ok) throw new Error(`video ${r.status}`)
  if (cache) await cache.put(url, r.clone()).catch(() => {})
  return r
}

/** Si el video ya está guardado en el teléfono, una dirección para reproducirlo desde la memoria. */
async function videoGuardado(archivo: string): Promise<string | null> {
  try {
    const cache = await abrirCache()
    const r = await cache?.match(new URL(archivo, location.href).href)
    if (!r) return null
    return URL.createObjectURL(new Blob([await r.blob()], { type: 'video/mp4' }))
  } catch { return null }
}

/** Si el video no se puede reproducir desde la red (algunos iPhone), se baja entero y se reproduce desde la memoria. */
async function cargarVideo(archivo: string): Promise<string> {
  const r = await guardarVideo(archivo)
  const b = await r.blob()
  return URL.createObjectURL(new Blob([b], { type: 'video/mp4' }))
}

/** Tarjeta «Metas»: cumplidas / puestas, % y barras apiladas (verde cumplidas, rojo apagado no cumplidas). */
function TarjetaMetas({ hoy, inicio, fin }: { hoy: string; inicio: string; fin: string }) {
  const [rango, setRango] = useState<Rango>('semana')
  const [sel, setSel] = useState<number | null>(null)
  const datos = useDatos(() => graficoMetas(inicio < hoy ? inicio : sumarDias(hoy, -40), fin > hoy ? fin : hoy, hoy), [inicio, fin, hoy])
  const g = datos.datos
  if (!g) return null
  // Grupos: semana = 7 días de esta semana; mes = días del mes; ciclo = semanas del ciclo.
  type Grupo = { etq: string; desde: string; hasta: string }
  const grupos: Grupo[] = []
  if (rango === 'semana') {
    const l = lunesDe(hoy)
    for (let i = 0; i < 7; i++) { const f = sumarDias(l, i); grupos.push({ etq: 'LMXJVSD'[i], desde: f, hasta: f }) }
  } else if (rango === 'mes') {
    const primero = hoy.slice(0, 8) + '01'
    for (let f = primero; f.slice(0, 7) === hoy.slice(0, 7); f = sumarDias(f, 1)) grupos.push({ etq: String(Number(f.slice(8))), desde: f, hasta: f })
  } else {
    for (let f = inicio, n = 1; f <= fin; f = sumarDias(f, 7), n++) grupos.push({ etq: `S${n}`, desde: f, hasta: sumarDias(f, 6) < fin ? sumarDias(f, 6) : fin })
  }
  const filas = grupos.map((gr) => {
    let cumplidas = 0, noCumplidas = 0, pendientes = 0
    const metas = []
    for (const [f, x] of g.porDia) if (f >= gr.desde && f <= gr.hasta) { cumplidas += x.cumplidas; noCumplidas += x.noCumplidas; pendientes += x.pendientes; metas.push(...x.metas) }
    return { ...gr, cumplidas, noCumplidas, pendientes, metas }
  })
  const max = Math.max(1, ...filas.map((f) => f.cumplidas + f.noCumplidas + f.pendientes))
  const enCiclo = [...g.porDia].filter(([f]) => f >= inicio && f <= fin)
  const puestas = enCiclo.reduce((s, [, x]) => s + x.metas.length, 0)
  const cumplidas = enCiclo.reduce((s, [, x]) => s + x.cumplidas, 0)
  const resueltas = enCiclo.reduce((s, [, x]) => s + x.cumplidas + x.noCumplidas, 0)
  const elegida = sel != null ? filas[sel] : null
  const W = 300, H = 80, paso = W / filas.length, ancho = Math.max(3, Math.min(26, paso * 0.62))
  return (
    <section className="av-tarjeta">
      <div className="av-tarjeta-titulo">
        <span>Metas</span>
        <div className="seg oscuro" role="tablist" aria-label="Rango del gráfico de metas">
          {(['semana', 'mes', 'ciclo'] as Rango[]).map((r) => (
            <button key={r} role="tab" aria-selected={rango === r} className={rango === r ? 'activo' : ''} onClick={() => { setRango(r); setSel(null) }}>{r === 'semana' ? 'Semana' : r === 'mes' ? 'Mes' : 'Ciclo'}</button>
          ))}
        </div>
      </div>
      {puestas === 0 ? (
        <div className="av-nota" style={{ textAlign: 'center', padding: '14px 0' }}>Todavía no pusiste metas. Tocá un día en el calendario para agregar una.</div>
      ) : (
        <>
          <div className="metas-resumen">
            <span className="av-grande">{cumplidas}<span className="metas-de">/{puestas}</span></span>
            <span className="av-nota">cumplidas en el ciclo{resueltas ? ` · ${Math.round((100 * cumplidas) / resueltas)} %` : ''}</span>
          </div>
          <svg className="grafico-metas" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`Metas: ${cumplidas} cumplidas de ${puestas}`}>
            {filas.map((f, i) => {
              const x = i * paso + (paso - ancho) / 2
              const hC = (H * f.cumplidas) / max, hN = (H * f.noCumplidas) / max, hP = (H * f.pendientes) / max
              return (
                <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
                  <rect x={i * paso} y={0} width={paso} height={H + 14} fill="transparent" />
                  {f.cumplidas + f.noCumplidas + f.pendientes === 0 && <rect className="gm-vacia" x={x} y={H - 2} width={ancho} height={2} rx={1} />}
                  {hC > 0 && <rect className="gm-cumplida" x={x} y={H - hC} width={ancho} height={hC} rx={2} />}
                  {hN > 0 && <rect className="gm-no" x={x} y={H - hC - hN} width={ancho} height={hN} rx={2} />}
                  {hP > 0 && <rect className="gm-pend" x={x} y={H - hC - hN - hP} width={ancho} height={hP} rx={2} />}
                  {sel === i && <rect className="gm-sel" x={x - 2} y={0} width={ancho + 4} height={H} rx={3} />}
                  {(filas.length <= 14 || i % 5 === 0) && <text className="eje" x={i * paso + paso / 2} y={H + 11} textAnchor="middle">{f.etq}</text>}
                </g>
              )
            })}
          </svg>
          <div className="leyenda-metas av-nota"><i className="gm-cumplida" />cumplidas <i className="gm-no" />no cumplidas <i className="gm-pend" />pendientes</div>
          {elegida && (
            <div className="metas-elegidas">
              <span className="av-nota">{elegida.desde === elegida.hasta ? fechaLegible(elegida.desde) : `${fechaLegible(elegida.desde)} a ${fechaLegible(elegida.hasta)}`}</span>
              {elegida.metas.length === 0 ? <span className="av-nota">Sin metas.</span> : elegida.metas.map((m) => <FilaMeta key={m.id} m={m} hoy={hoy} menu={false} chica />)}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Resumen del sueño en Progreso: horas por noche de la semana con su tendencia, regularidad, racha y las últimas noches. */
function TarjetaSueno({ r }: { r: ResumenSuenio }) {
  const navegar = useNavigate()
  const m = r.mejora
  const ultimas = r.noches.slice(-7)
  const tope = Math.max(r.objetivoMinutos + 60, ...ultimas.map((n) => n.minutos))
  const flecha = (a: number | null, b: number | null, mejorEsMas: boolean) => {
    if (a === null || b === null || Math.abs(a - b) < 5) return null
    const sube = a > b
    return <span className={sube === mejorEsMas ? 'av-verde' : 'av-rojo'}>{sube ? ' ↑' : ' ↓'}</span>
  }
  const abrir = () => navegar('/sueno')
  return (
    <section className="av-tarjeta av-tocable" role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => e.key === 'Enter' && abrir()} aria-label="Sueño. Tocá para abrir la pantalla Sueño">
      <div className="av-tarjeta-titulo"><span>Sueño</span><span className="av-nota">esta semana ›</span></div>
      {ultimas.length ? (
        <div className="av-sueno">
          <div className="av-sueno-cifras">
            <div><b className="av-mono">{m.semana !== null ? duracionSuenio(m.semana) : '—'}{flecha(m.semana, m.semanaAnterior, true)}</b><span className="av-nota">por noche</span></div>
            <div><b className="av-mono">{m.regularidad !== null ? `±${m.regularidad}′` : '—'}{flecha(m.regularidad, m.regularidadAnterior, false)}</b><span className="av-nota">regularidad</span></div>
            <div><b className="av-mono">{m.racha}</b><span className="av-nota">a horario</span></div>
          </div>
          <svg className="av-sueno-mini" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" x2="100" y1={40 - (r.objetivoMinutos / tope) * 38} y2={40 - (r.objetivoMinutos / tope) * 38} className="av-sueno-objetivo" />
            {ultimas.map((n, i) => {
              const w = 100 / 7
              const h = (n.minutos / tope) * 38
              return <rect key={n.noche} x={i * w + w * 0.2} y={40 - h} width={w * 0.6} height={h} rx={1.5} className={n.minutos >= r.objetivoMinutos - 15 ? 'ok' : ''} />
            })}
          </svg>
        </div>
      ) : (
        <div className="av-nota">Con la primera noche registrada aparece acá cómo dormís.</div>
      )}
    </section>
  )
}
