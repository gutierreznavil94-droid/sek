/**
 * Rutinas de entrenamiento: la lista (A, B, C), el editor de bloques y el
 * mini gráfico de cada ejercicio (peso × repeticiones a lo largo del ciclo).
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { BloqueEjercicio, BloqueRutina, Rutina } from '../../data/tipos'
import { nombreDiaSemana } from '../../domain/fechas'
import { guardarRutina, historialEjercicio, kg, listarRutinas, obtenerRutina, type PuntoEjercicio } from '../../services/entreno'
import { nuevoId } from '../../services/reloj'
import { Atras, DiasSemana, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

function dias(d: number[]): string {
  return [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => nombreDiaSemana(x, true)).join(' y ')
}

export function Rutinas() {
  const datos = useDatos(() => listarRutinas(true), [])
  return (
    <>
      <Atras a="/mas/entrenamiento" texto="Entrenamiento" />
      <h1>Rutinas</h1>
      <p className="texto-2 chico">Tus 3 rutinas de la planilla, cada una 2 veces por semana. Domingo libre.</p>
      {(datos.datos ?? []).map((r) => {
        const ej = r.bloques.filter((b): b is BloqueEjercicio => b.tipo === 'ejercicio')
        return (
          <Link key={r.id} to={`/mas/rutinas/${r.id}`} className="tarjeta rutina-item">
            <div className="fila entre">
              <h2>{r.nombre.split(' · ')[0]}</h2>
              <span className="texto-3 chico">{dias(r.dias)} · ~{r.minutos} min</span>
            </div>
            <span className="texto-2">{r.nombre.split(' · ')[1] ?? ''}</span>
            <div className="chips-mini">{ej.map((e) => <span key={e.id}>{e.nombre}</span>)}</div>
            {!r.activa && <span className="texto-3 chico">Pausada</span>}
          </Link>
        )
      })}
      <Link to="/entreno" className="boton primario grande ancho">Empezar entreno</Link>
    </>
  )
}

export function EditarRutina() {
  const { id } = useParams()
  const datos = useDatos(() => obtenerRutina(id ?? ''), [id])
  const [r, setR] = useState<Rutina | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [grafico, setGrafico] = useState<BloqueEjercicio | null>(null)
  useEffect(() => { if (datos.datos) setR(datos.datos) }, [datos.datos])
  if (!r) return <p className="vacio">Cargando…</p>
  const cambiarBloque = (bid: string, cambios: Partial<BloqueRutina>) => setR({ ...r, bloques: r.bloques.map((b) => (b.id === bid ? ({ ...b, ...cambios } as BloqueRutina) : b)) })
  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= r.bloques.length) return
    const b = [...r.bloques]
    ;[b[i], b[j]] = [b[j], b[i]]
    setR({ ...r, bloques: b })
  }
  const quitar = (bid: string) => setR({ ...r, bloques: r.bloques.filter((b) => b.id !== bid) })
  const agregar = () => {
    const nuevo: BloqueEjercicio = { id: nuevoId('ej'), tipo: 'ejercicio', nombre: 'Nuevo ejercicio', series: 2, reps: 8, repsTope: 12, peso: 0, descanso: 90, sombra: 30 }
    const iKick = r.bloques.findIndex((b) => b.tipo === 'temporizador' || b.tipo === 'rondas')
    const b = [...r.bloques]
    b.splice(iKick >= 0 ? iKick : b.length, 0, nuevo)
    setR({ ...r, bloques: b })
    setAbierto(nuevo.id)
  }
  const guardar = async () => {
    try {
      await mutar(() => guardarRutina(r))
      avisar('Rutina guardada', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  return (
    <>
      <Atras a="/mas/rutinas" texto="Rutinas" />
      <Tarjeta>
        <div className="campo"><label>Nombre</label><input value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} /></div>
        <div className="campo"><label>Días</label><DiasSemana valor={r.dias} onChange={(v) => setR({ ...r, dias: v })} /></div>
        <div className="rejilla-2">
          <div className="campo"><label>Duración (min)</label><input type="number" inputMode="numeric" value={r.minutos} onChange={(e) => setR({ ...r, minutos: Number(e.target.value) })} /></div>
          <div className="campo"><label>Activa</label><button className={`boton ${r.activa ? 'ok' : ''}`} onClick={() => setR({ ...r, activa: !r.activa })}>{r.activa ? 'Sí' : 'Pausada'}</button></div>
        </div>
      </Tarjeta>
      <span className="seccion-titulo">Bloques en orden</span>
      <div className="col" style={{ gap: 8 }}>
        {r.bloques.map((b, i) => (
          <div key={b.id} className={`tarjeta compacta bloque-ed ${b.tipo}`}>
            <div className="fila">
              <button className="crece bloque-ed-cab" onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
                <span className="texto-3 mono chico">{i + 1}</span> <b>{b.nombre}</b>
                <span className="texto-3 chico"> · {descripcion(b)}</span>
              </button>
              <button className="boton chico suave" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
              <button className="boton chico suave" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === r.bloques.length - 1}>↓</button>
            </div>
            {abierto === b.id && <EditorBloque b={b} onCambio={(c) => cambiarBloque(b.id, c)} onQuitar={() => quitar(b.id)} onGrafico={b.tipo === 'ejercicio' ? () => setGrafico(b) : undefined} />}
          </div>
        ))}
      </div>
      <button className="boton ancho" onClick={agregar}>+ Agregar ejercicio</button>
      <button className="boton primario grande ancho" onClick={guardar}>Guardar rutina</button>
      <Hoja abierta={!!grafico} onCerrar={() => setGrafico(null)} titulo={grafico?.nombre}>
        {grafico && <HistorialEjercicio b={grafico} />}
      </Hoja>
    </>
  )
}

function descripcion(b: BloqueRutina): string {
  switch (b.tipo) {
    case 'ejercicio': return `${b.series} × ${b.reps}${b.repsExtra ? ` + ${b.repsExtra}` : ''} · ${kg(b.peso)} · ${Math.floor(b.descanso / 60)}:${String(b.descanso % 60).padStart(2, '0')}`
    case 'rondas': return b.rondas.map((x) => `${x.segundos} s`).join(' + ')
    case 'casilla': return 'casilla'
    default: return `${b.segundos} s${b.peso ? ` · ${b.peso} kg` : ''}`
  }
}

function Num({ etiqueta, valor, onCambio, paso = 1 }: { etiqueta: string; valor: number | undefined; onCambio: (v: number) => void; paso?: number }) {
  return <div className="campo"><label>{etiqueta}</label><input type="number" inputMode="decimal" step={paso} value={valor ?? 0} onChange={(e) => onCambio(Number(e.target.value))} /></div>
}

function EditorBloque({ b, onCambio, onQuitar, onGrafico }: { b: BloqueRutina; onCambio: (c: Partial<BloqueRutina>) => void; onQuitar: () => void; onGrafico?: () => void }) {
  return (
    <div className="col" style={{ gap: 8, marginTop: 6 }}>
      <div className="campo"><label>Nombre</label><input value={b.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} /></div>
      {b.tipo === 'ejercicio' && (
        <>
          <div className="rejilla-2">
            <div className="campo"><label>Grupo</label><input value={b.grupo ?? ''} onChange={(e) => onCambio({ grupo: e.target.value || undefined })} /></div>
            <Num etiqueta="Series" valor={b.series} onCambio={(v) => onCambio({ series: v })} />
            <Num etiqueta="Reps mínimo" valor={b.reps} onCambio={(v) => onCambio({ reps: v })} />
            <Num etiqueta="Extra (+)" valor={b.repsExtra} onCambio={(v) => onCambio({ repsExtra: v > 0 ? v : undefined })} />
            <Num etiqueta="Reps tope" valor={b.repsTope} onCambio={(v) => onCambio({ repsTope: v })} />
            <Num etiqueta="Peso (kg, 0 = corporal)" valor={b.peso} paso={0.5} onCambio={(v) => onCambio({ peso: v })} />
            <Num etiqueta="Descanso (s)" valor={b.descanso} paso={15} onCambio={(v) => onCambio({ descanso: v })} />
            <Num etiqueta="Sombra (s)" valor={b.sombra} paso={5} onCambio={(v) => onCambio({ sombra: v })} />
          </div>
          <div className="campo"><label>Nota</label><input value={b.nota ?? ''} onChange={(e) => onCambio({ nota: e.target.value || undefined })} /></div>
          <p className="ayuda">Cuando en la serie 1 llegás a {b.repsTope}, la app te pregunta si subís peso (el peso lo ponés vos) y el objetivo vuelve a {b.reps}.</p>
        </>
      )}
      {(b.tipo === 'calentamiento' || b.tipo === 'temporizador') && (
        <div className="rejilla-2">
          <Num etiqueta="Segundos" valor={b.segundos} paso={5} onCambio={(v) => onCambio({ segundos: v })} />
          <Num etiqueta="Peso (kg)" valor={b.peso} paso={0.5} onCambio={(v) => onCambio({ peso: v || undefined })} />
        </div>
      )}
      {b.tipo === 'rondas' && b.rondas.map((x, i) => (
        <div key={i} className="rejilla-2">
          <Num etiqueta={`Ronda ${i + 1} (s)`} valor={x.segundos} paso={5} onCambio={(v) => onCambio({ rondas: b.rondas.map((y, j) => (j === i ? { ...y, segundos: v } : y)) })} />
          <div className="campo"><label>Texto</label><input value={x.texto} onChange={(e) => onCambio({ rondas: b.rondas.map((y, j) => (j === i ? { ...y, texto: e.target.value } : y)) })} /></div>
        </div>
      ))}
      <div className="botonera">
        {onGrafico && <button className="boton" onClick={onGrafico}>Ver progreso</button>}
        <button className="boton peligro" onClick={onQuitar}>Quitar</button>
      </div>
    </div>
  )
}

export function HistorialEjercicio({ b }: { b: BloqueEjercicio }) {
  const h = useDatos(() => historialEjercicio(b.id), [b.id])
  if (!h.datos) return <p className="vacio">Cargando…</p>
  const { puntos, record } = h.datos
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="fila entre">
        <span className="texto-2">Récord <span className="texto-3 chico">(mejor serie)</span></span>
        <b className="mono">{record ? `${record.reps} reps · ${kg(record.peso)}` : '—'}</b>
      </div>
      {puntos.length ? <GraficoEjercicio puntos={puntos} /> : <p className="ayuda">Todavía no hay entrenos con este ejercicio. Después del primero vas a ver acá cómo suben el peso y las repeticiones.</p>}
      {puntos.length > 0 && <p className="ayuda">Barras: peso de cada entreno · línea: repeticiones totales · ★ récord.</p>}
    </div>
  )
}

/** Peso (barras) y repeticiones totales (línea) de cada entreno. */
export function GraficoEjercicio({ puntos }: { puntos: PuntoEjercicio[] }) {
  const W = 320
  const H = 140
  const pad = { i: 30, d: 30, a: 14, b: 22 }
  const ancho = W - pad.i - pad.d
  const alto = H - pad.a - pad.b
  const maxP = Math.max(1, ...puntos.map((p) => p.peso))
  const maxR = Math.max(1, ...puntos.map((p) => p.repsTotal))
  const minR = Math.min(...puntos.map((p) => p.repsTotal))
  const rangoR = Math.max(1, maxR - Math.min(minR, maxR - 4))
  const baseR = maxR - rangoR
  const paso = ancho / puntos.length
  const x = (i: number) => pad.i + paso * i + paso / 2
  const yR = (r: number) => pad.a + alto - ((r - baseR) / rangoR) * alto * 0.9
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yR(p.repsTotal).toFixed(1)}`).join(' ')
  return (
    <svg className="grafico-ejercicio" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Progreso en ${puntos.length} entrenos`}>
      <line x1={pad.i} x2={W - pad.d} y1={pad.a + alto} y2={pad.a + alto} className="eje" />
      {puntos.map((p, i) => {
        const h = p.peso ? (p.peso / maxP) * alto * 0.85 : 2
        return <rect key={i} x={x(i) - Math.min(14, paso * 0.32)} width={Math.min(28, paso * 0.64)} y={pad.a + alto - h} height={h} rx={3} className={`barra-peso ${p.record ? 'record' : ''}`} />
      })}
      <path d={linea} className="linea-reps" fill="none" />
      {puntos.map((p, i) => <circle key={i} cx={x(i)} cy={yR(p.repsTotal)} r={3.5} className="punto-reps" />)}
      {puntos.map((p, i) => p.record && <text key={`r${i}`} x={x(i)} y={yR(p.repsTotal) - 8} textAnchor="middle" className="estrella">★</text>)}
      <text x={pad.i - 4} y={pad.a + 8} textAnchor="end" className="etq">{maxP ? `${String(maxP).replace('.', ',')}` : ''}</text>
      <text x={pad.i - 4} y={pad.a + 20} textAnchor="end" className="etq">kg</text>
      <text x={W - pad.d + 4} y={yR(maxR) + 4} className="etq reps">{maxR}</text>
      <text x={W - pad.d + 4} y={yR(maxR) + 16} className="etq reps">reps</text>
      {puntos.map((p, i) => (puntos.length <= 8 || i % Math.ceil(puntos.length / 8) === 0) && <text key={`f${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="etq">{p.fecha.slice(8)}/{p.fecha.slice(5, 7)}</text>)}
    </svg>
  )
}
