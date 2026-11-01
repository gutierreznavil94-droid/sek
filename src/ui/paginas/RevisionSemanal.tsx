import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { duracionLegible, esFechaValida, fechaLegible, lunesDe, sumarDias } from '../../domain/fechas'
import { datosSemana, guardarRevision, obtenerRevision } from '../../services/revisiones'
import { Atras, Porcentaje, Tarjeta, clasePorcentaje } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function RevisionSemanal({ hoy }: { hoy: string }) {
  const params = useParams()
  const navegar = useNavigate()
  const fecha = params.fecha && esFechaValida(params.fecha) ? params.fecha : hoy
  const lunes = lunesDe(fecha)
  const [queFunciono, setQueFunciono] = useState('')
  const [queCambiar, setQueCambiar] = useState('')
  const datos = useDatos(async () => {
    const actual = await datosSemana(fecha, hoy)
    const anterior = await datosSemana(sumarDias(lunes, -7), hoy)
    const revision = await obtenerRevision('semanal', lunes)
    return { actual, anterior, revision }
  }, [fecha, hoy])
  const d = datos.datos
  useEffect(() => {
    if (d?.revision) {
      setQueFunciono(d.revision.respuestas.queFunciono ?? '')
      setQueCambiar(d.revision.respuestas.queCambiar ?? '')
    }
  }, [d?.revision])
  if (!d) return <p className="vacio">Cargando…</p>
  const a = d.actual
  const b = d.anterior
  const semanaCompleta = a.domingo <= hoy

  const guardar = async () => {
    const r = await mutar(() => guardarRevision('semanal', lunes, { queFunciono, queCambiar }, { ...a, atributos: a.atributos }))
    avisar(r.xp > 0 ? `Revisión semanal guardada. +${r.xp} XP` : 'Revisión semanal guardada', { tipo: 'ok' })
    navegar('/progreso')
  }

  const Comparar = ({ v, ant, mejorSiSube = true, unidad = '' }: { v: number | null; ant: number | null; mejorSiSube?: boolean; unidad?: string }) => {
    if (v === null || ant === null) return null
    const dif = v - ant
    if (dif === 0) return <span className="texto-3 muy-chico">= semana anterior</span>
    const bien = mejorSiSube ? dif > 0 : dif < 0
    return <span className={`muy-chico ${bien ? 'ok' : 'bajo'}`}>{dif > 0 ? '▲' : '▼'} {Math.abs(dif)}{unidad} vs. anterior</span>
  }

  return (
    <>
      <Atras a="/progreso" texto="Progreso" />
      <div className="fila entre">
        <button className="boton chico" onClick={() => navegar(`/semana/${sumarDias(lunes, -7)}`)}>‹</button>
        <h1 className="centro">Semana del {fechaLegible(a.lunes)}</h1>
        <button className="boton chico" disabled={sumarDias(lunes, 7) > hoy} onClick={() => navegar(`/semana/${sumarDias(lunes, 7)}`)}>›</button>
      </div>
      {!semanaCompleta && <p className="chico texto-2">La semana todavía no terminó: los números son parciales.</p>}

      <Tarjeta titulo="Cumplimiento">
        <div className="fila entre"><span className="grande"><Porcentaje valor={a.cumplimiento.porcentaje} /></span><Comparar v={a.cumplimiento.porcentaje} ant={b.cumplimiento.porcentaje} unidad=" pts" /></div>
        <span className="chico texto-2">{a.cumplimiento.cumplidos} de {a.cumplimiento.programados} compromisos</span>
        <div className="barras" style={{ height: 50 }}>
          {a.porDia.map((p) => <div key={p.fecha} className={p.porcentaje === null ? 'sin' : clasePorcentaje(p.porcentaje)} style={{ height: `${Math.max(4, p.porcentaje ?? 0)}%` }} title={`${fechaLegible(p.fecha)}: ${p.porcentaje ?? '—'} %`} />)}
        </div>
        <div className="barras-etq">{a.porDia.map((p) => <div key={p.fecha}>{fechaLegible(p.fecha).split(' ')[0]}</div>)}</div>
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta compacta>
          <span className="texto-3 muy-chico">ENTRENAMIENTOS</span>
          <span className="grande">{a.entrenamientos.hechos} <span className="chico texto-2">/ {a.entrenamientos.previstos}</span></span>
          <Comparar v={a.entrenamientos.hechos} ant={b.entrenamientos.hechos} />
        </Tarjeta>
        <Tarjeta compacta>
          <span className="texto-3 muy-chico">DESCANSO A HORA</span>
          <span className="grande">{a.descanso.cumplidas} <span className="chico texto-2">/ {a.descanso.noches}</span></span>
          <span className="muy-chico texto-3">{a.descanso.retrasoMedio !== null ? `retraso medio ${a.descanso.retrasoMedio} min` : 'sin registros'}{a.aperturasSuenio > 0 ? ` · app abierta en modo sueño: ${a.aperturasSuenio}` : ''}</span>
        </Tarjeta>
        <Tarjeta compacta>
          <span className="texto-3 muy-chico">JUEGO</span>
          <span className="grande">{duracionLegible(a.juego.minutos)}</span>
          <span className="muy-chico texto-3">{a.juego.diasSobreLimite} día{a.juego.diasSobreLimite === 1 ? '' : 's'} sobre el límite</span>
          <Comparar v={a.juego.minutos} ant={b.juego.minutos} mejorSiSube={false} unidad=" min" />
        </Tarjeta>
        <Tarjeta compacta>
          <span className="texto-3 muy-chico">INICIOS CON 3-2-1</span>
          <span className="grande">{a.inicios}</span>
          <Comparar v={a.inicios} ant={b.inicios} />
          <span className="muy-chico texto-3">{a.xp} XP en la semana</span>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Atributos">
        {a.atributos.map((at) => {
          const ant = b.atributos.find((x) => x.id === at.id)
          return (
            <div key={at.id} className="fila entre chico">
              <span>{at.nombre}</span>
              <span className="fila" style={{ gap: 8 }}><Comparar v={at.valor} ant={ant?.valor ?? null} /><b className={clasePorcentaje(at.valor)}>{at.valor ?? '—'}</b></span>
            </div>
          )
        })}
      </Tarjeta>

      <Tarjeta titulo="Reflexión breve">
        <div className="campo"><label>Qué funcionó</label><input value={queFunciono} onChange={(e) => setQueFunciono(e.target.value)} /></div>
        <div className="campo"><label>Qué cambio para la semana que viene</label><input value={queCambiar} onChange={(e) => setQueCambiar(e.target.value)} /></div>
        <button className="boton primario ancho" disabled={!queFunciono.trim() && !queCambiar.trim()} onClick={guardar}>{d.revision ? 'Actualizar' : 'Guardar revisión semanal'}</button>
      </Tarjeta>
    </>
  )
}
