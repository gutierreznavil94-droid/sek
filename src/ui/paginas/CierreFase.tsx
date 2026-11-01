import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../data/db'
import { fechaDelDiaDelCiclo, fechaLegible, sumarDias } from '../../domain/fechas'
import { cerrarFase, estadoDelCiclo, fasesDelCiclo, guardarObjetivo, objetivosDelCiclo } from '../../services/ciclo'
import { cumplimientoEntre } from '../../services/dia'
import { Atras, Porcentaje, Tarjeta, clasePorcentaje } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/** Cierre de fase: línea de base frente a resultados, y ajuste de objetivos de la siguiente. Al día 90, comparación del ciclo. */
export function CierreFase({ hoy }: { hoy: string }) {
  const numero = Number(useParams().numero)
  const navegar = useNavigate()
  const [notas, setNotas] = useState('')
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const datos = useDatos(async () => {
    const estado = await estadoDelCiclo(hoy)
    if (!estado) return null
    const fases = await fasesDelCiclo(estado.ciclo.id)
    const fase = fases.find((f) => f.numero === numero)
    if (!fase) return null
    const objetivos = await objetivosDelCiclo(estado.ciclo.id)
    const ini = estado.ciclo.inicio
    const desde = fechaDelDiaDelCiclo(ini, fase.diaInicio)
    const hasta = fechaDelDiaDelCiclo(ini, Math.min(fase.diaFin, estado.dia))
    const resumen = async (a: string, b: string) => {
      const c = await cumplimientoEntre(a, b, hoy)
      const comps = await db().compromisos.where('fecha').between(a, b, true, true).toArray()
      const entren = comps.filter((x) => x.accionId === 'entrenamiento' && x.estado !== 'reprogramado')
      const noches = await db().suenio.where('noche').between(a, b, true, true).toArray()
      const dias = await db().diasCerrados.where('fecha').between(a, b, true, true).toArray()
      const juego = dias.reduce((s, d) => s + d.minutosJuego, 0)
      const inicios = (await db().siguienteAccion.where('creado').between(Date.parse(a), Date.parse(b) + 86_400_000 * 2, true, true).toArray()).filter((i) => i.iniciado).length
      const xp = (await db().xp.where('fecha').between(a, b, true, true).toArray()).filter((r) => !r.anulado).reduce((s, r) => s + r.cantidad, 0)
      return { c, entren: { previstos: entren.length, hechos: entren.filter((x) => x.estado === 'completado').length }, noches: { total: noches.length, cumplidas: noches.filter((n) => n.cumplido).length }, juegoMin: juego, diasConDatos: dias.length, inicios, xp }
    }
    const faseRes = await resumen(desde, hasta)
    const baseRes = await resumen(ini, sumarDias(ini, 6))
    const anterior = numero > 1 ? await resumen(fechaDelDiaDelCiclo(ini, fases[numero - 2].diaInicio), fechaDelDiaDelCiclo(ini, fases[numero - 2].diaFin)) : null
    const esUltima = numero === fases.length
    const cicloRes = esUltima ? await resumen(ini, hasta) : null
    const siguiente = fases.find((f) => f.numero === numero + 1)
    const atributos = await db().atributos.filter((a) => !a.archivado).toArray()
    const atrInicio = await db().atributosDiarios.where('fecha').equals(sumarDias(desde, 6)).toArray()
    const atrFin = await db().atributosDiarios.where('fecha').equals(hasta).toArray()
    return { estado, fase, fases, objetivos, desde, hasta, faseRes, baseRes, anterior, esUltima, cicloRes, siguiente, atributos, atrInicio, atrFin }
  }, [hoy, numero])
  const d = datos.datos
  if (datos.cargando) return <p className="vacio">Cargando…</p>
  if (!d) return <><Atras a="/progreso" texto="Progreso" /><p className="vacio">No existe esa fase.</p></>
  const objs = d.objetivos.filter((o) => o.faseNumero === numero)
  const enCurso = d.estado.dia <= d.fase.diaFin

  const cerrar = async () => {
    await mutar(async () => {
      for (const o of objs) if (resultados[o.id] !== undefined && resultados[o.id] !== (o.resultado ?? '')) await guardarObjetivo({ ...o, resultado: resultados[o.id] })
      await cerrarFase(d.fase.id, notas)
    })
    avisar(`Fase ${numero} cerrada`, { tipo: 'ok' })
    navegar(d.esUltima ? '/mas/nuevo-ciclo' : '/mas/objetivos')
  }

  const Fila = ({ etiqueta, base, valor, ant, unidad = '' }: { etiqueta: string; base: string | number | null; valor: string | number | null; ant?: string | number | null; unidad?: string }) => (
    <tr><td>{etiqueta}</td><td className="num texto-3">{base ?? '—'}{base !== null && unidad}</td>{d.anterior && <td className="num texto-2">{ant ?? '—'}{ant !== null && ant !== undefined && unidad}</td>}<td className="num"><b>{valor ?? '—'}{valor !== null && unidad}</b></td></tr>
  )

  return (
    <>
      <Atras a="/progreso" texto="Progreso" />
      <h1>{d.esUltima ? `Fin del ciclo ${d.estado.ciclo.numero}` : `Cierre de la fase ${numero}`}</h1>
      <p className="texto-2 chico">{d.fase.foco} · días {d.fase.diaInicio}–{d.fase.diaFin} ({fechaLegible(d.desde)} a {fechaLegible(fechaDelDiaDelCiclo(d.estado.ciclo.inicio, d.fase.diaFin))}){enCurso && ' · todavía en curso'}</p>

      <Tarjeta titulo="Resultados">
        <p className="chico texto-2">Línea de base = primeros 7 días del ciclo. Nada se inventa: si no hay registros, aparece «—».</p>
        <table className="tabla">
          <thead><tr><th>Indicador</th><th className="num">Base</th>{d.anterior && <th className="num">Fase {numero - 1}</th>}<th className="num">{d.esUltima ? 'Ciclo' : `Fase ${numero}`}</th></tr></thead>
          <tbody>
            {(() => {
              const r = d.esUltima && d.cicloRes ? d.cicloRes : d.faseRes
              const a = d.anterior
              return (
                <>
                  <Fila etiqueta="Cumplimiento" base={d.baseRes.c.porcentaje} ant={a?.c.porcentaje} valor={r.c.porcentaje} unidad=" %" />
                  <Fila etiqueta="Entrenamientos hechos / previstos" base={`${d.baseRes.entren.hechos}/${d.baseRes.entren.previstos}`} ant={a ? `${a.entren.hechos}/${a.entren.previstos}` : null} valor={`${r.entren.hechos}/${r.entren.previstos}`} />
                  <Fila etiqueta="Noches a hora / registradas" base={`${d.baseRes.noches.cumplidas}/${d.baseRes.noches.total}`} ant={a ? `${a.noches.cumplidas}/${a.noches.total}` : null} valor={`${r.noches.cumplidas}/${r.noches.total}`} />
                  <Fila etiqueta="Juego por día" base={d.baseRes.diasConDatos ? Math.round(d.baseRes.juegoMin / d.baseRes.diasConDatos) : null} ant={a ? (a.diasConDatos ? Math.round(a.juegoMin / a.diasConDatos) : null) : null} valor={r.diasConDatos ? Math.round(r.juegoMin / r.diasConDatos) : null} unidad=" min" />
                  <Fila etiqueta="Inicios con 3-2-1" base={d.baseRes.inicios} ant={a?.inicios} valor={r.inicios} />
                  <Fila etiqueta="XP ganado" base={d.baseRes.xp} ant={a?.xp} valor={r.xp} />
                </>
              )
            })()}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta titulo="Atributos: inicio y fin de la fase">
        {d.atributos.map((a) => {
          const i = d.atrInicio.find((x) => x.atributoId === a.id)?.valor ?? null
          const f = d.atrFin.find((x) => x.atributoId === a.id)?.valor ?? null
          return <div key={a.id} className="fila entre chico"><span>{a.nombre}</span><span><span className="texto-3">{i ?? '—'}</span> → <b className={clasePorcentaje(f)}>{f ?? '—'}</b></span></div>
        })}
      </Tarjeta>

      <Tarjeta titulo={`Objetivos de la fase ${numero}`}>
        {objs.length === 0 && <p className="chico texto-3">No definiste objetivos para esta fase. <Link to="/mas/objetivos">Definirlos</Link>.</p>}
        {objs.map((o) => (
          <div key={o.id} className="col" style={{ gap: 4 }}>
            <b className="chico">{o.titulo}</b>
            <span className="muy-chico texto-3">{o.indicador}{o.lineaBase ? ` · base: ${o.lineaBase}` : ''}{o.meta ? ` · meta: ${o.meta}` : ''}</span>
            <input placeholder="Resultado real" value={resultados[o.id] ?? o.resultado ?? ''} onChange={(e) => setResultados({ ...resultados, [o.id]: e.target.value })} style={{ background: 'var(--fondo)', border: '1px solid var(--borde)', borderRadius: 10, padding: 10 }} />
          </div>
        ))}
      </Tarjeta>

      {!d.fase.cerradaEn ? (
        <Tarjeta titulo="Cerrar la fase">
          <div className="campo">
            <label>Qué aprendí y qué ajusto para la siguiente</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          {d.siguiente && <p className="chico texto-2">Después de cerrar vas a poder ajustar los objetivos de la fase {d.siguiente.numero} ({d.siguiente.foco}).</p>}
          {d.esUltima && <p className="chico texto-2">Al cerrar, podés empezar un ciclo nuevo. Nivel, XP e historial se conservan.</p>}
          <button className="boton primario ancho" onClick={cerrar} disabled={enCurso && !d.esUltima}>{enCurso ? `Se puede cerrar desde el día ${d.fase.diaFin + 1}` : d.esUltima ? 'Cerrar ciclo' : `Cerrar fase ${numero}`}</button>
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Fase cerrada">
          <p className="chico texto-2" style={{ whiteSpace: 'pre-wrap' }}>{d.fase.notasCierre || 'Sin notas.'}</p>
          {d.esUltima && <Link className="boton primario" to="/mas/nuevo-ciclo">Empezar nuevo ciclo</Link>}
        </Tarjeta>
      )}
      <div className="fila entre">
        <span className="chico texto-3">Cumplimiento en lo que va de la fase: <Porcentaje valor={d.faseRes.c.porcentaje} /></span>
      </div>
    </>
  )
}
