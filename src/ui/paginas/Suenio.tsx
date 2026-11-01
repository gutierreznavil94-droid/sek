import { useEffect, useState } from 'react'
import { fechaLegible } from '../../domain/fechas'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { corregirLevantado, duracionSuenio, horaDeMinutos, resumenSuenio, type NocheDeSuenio } from '../../services/suenio'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/**
 * Sueño y ritmo circadiano: cuánto dormís y a qué hora, aprendido de
 * «Dejo celu», las aperturas de la noche y la hora en que te levantás.
 */
export function Suenio({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({ r: await resumenSuenio(hoy, 14), a: await obtenerAjustes() }), [hoy])
  const [horaFin, setHoraFin] = useState('05:00')
  const [latencia, setLatencia] = useState(25)
  const [antes, setAntes] = useState(5)
  useEffect(() => {
    if (!datos.datos) return
    setHoraFin(datos.datos.a.horaFinSuenio)
    setLatencia(datos.datos.a.latenciaSuenioMinutos ?? 25)
    setAntes(datos.datos.a.minutosAntesDelCelu ?? 5)
  }, [datos.datos])
  if (!datos.datos) return <p className="vacio">Cargando…</p>
  const { r, a } = datos.datos
  const guardar = async () => {
    await mutar(() => guardarAjustes({ horaFinSuenio: horaFin, latenciaSuenioMinutos: Math.max(0, Math.min(90, latencia)), minutosAntesDelCelu: Math.max(0, Math.min(60, antes)) }))
    avisar('Guardado', { tipo: 'ok' })
  }
  return (
    <>
      <Atras />
      <h1>Sueño y ritmo</h1>
      <p className="texto-2 chico">La app lo registra sola, sin alarmas: «Dejo celu» + {r.latenciaAprendida} min = dormido (si abrís el celu enseguida, corre esa hora). A la mañana, la primera vez que abrís la app cierra la noche: hora de levantarse = esa apertura − {a.minutosAntesDelCelu ?? 5} min.</p>

      <Tarjeta titulo="Anoche">
        {r.anoche ? <Noche n={r.anoche} objetivo={r.objetivoMinutos} corregible onCorregir={async (hm) => { await mutar(() => corregirLevantado(r.anoche!.noche, hm)); avisar('Hora corregida', { tipo: 'ok' }); datos.recargar() }} /> : <p className="texto-2 chico">Todavía no hay registro de anoche. Marcá «Dejo celu» en Hoy cuando te vayas a dormir.</p>}
      </Tarjeta>

      <Tarjeta titulo="Últimos 14 días">
        {r.promedio ? (
          <>
            <div className="suenio-cifras">
              <div><b>{duracionSuenio(r.promedio.minutos)}</b><span>por noche</span></div>
              <div><b>{horaDeMinutos(r.promedio.acostado)}</b><span>dejás el celu</span></div>
              <div><b>{horaDeMinutos(r.promedio.dormido)}</b><span>te dormís</span></div>
              <div><b>{horaDeMinutos(r.promedio.levantado)}</b><span>te levantás</span></div>
            </div>
            <p className="chico texto-2" style={{ marginTop: 8 }}>
              {r.diferenciaObjetivo !== null && (r.diferenciaObjetivo >= -15 ? `Llegás al objetivo de ${duracionSuenio(r.objetivoMinutos)}.` : `Te faltan ${duracionSuenio(-r.diferenciaObjetivo)} por noche para el objetivo de ${duracionSuenio(r.objetivoMinutos)}.`)}
              {r.regularidadMinutos !== null && ` Tu hora de acostarte varía unos ${r.regularidadMinutos} min${r.regularidadMinutos <= 20 ? ': muy regular.' : r.regularidadMinutos <= 45 ? ': bastante regular.' : ': conviene emparejarla.'}`}
            </p>
            <Ritmo noches={r.noches} ventana={[a.horaDormido, a.horaFinSuenio]} />
            <p className="ayuda">Cada barra es una noche: del momento en que te dormiste hasta que te levantaste. El punto es «Dejo celu». La franja clara es tu ventana ideal ({a.horaDormido} a {a.horaFinSuenio}). Las barras rayadas son noches sin apertura a la mañana (se usó la hora prevista).</p>
          </>
        ) : (
          <p className="texto-2 chico">Con dos o tres noches registradas aparece acá tu ritmo.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Ajustes del sueño">
        <div className="rejilla-2">
          <div className="campo"><label>Hora de levantarse</label><input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} /></div>
          <div className="campo"><label>Min. antes de agarrar el celu</label><input type="number" inputMode="numeric" value={antes} onChange={(e) => setAntes(Number(e.target.value))} /><span className="ayuda">Te levantás y recién después abrís la app: se restan estos minutos.</span></div>
          <div className="campo"><label>Minutos hasta dormirte</label><input type="number" inputMode="numeric" value={latencia} onChange={(e) => setLatencia(Number(e.target.value))} /><span className="ayuda">Base. La app aprende sola: ahora usa {r.latenciaAprendida} min.</span></div>
        </div>
        <button className="boton primario ancho" onClick={guardar}>Guardar</button>
        <p className="ayuda">El objetivo de horas de sueño y la hora de dejar el celu se cambian en Más → Entrenamiento y descanso.</p>
      </Tarjeta>
    </>
  )
}

function Noche({ n, objetivo, corregible, onCorregir }: { n: NocheDeSuenio; objetivo: number; corregible?: boolean; onCorregir?: (hm: string) => void }) {
  const ok = n.minutos >= objetivo - 15
  const [editando, setEditando] = useState(false)
  const [hm, setHm] = useState(horaDeMinutos(n.levantado))
  const arriba = n.corregido ? 'corregida a mano' : n.estimado ? 'hora prevista, no abriste la app' : 'estimada: primera apertura menos unos minutos'
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="fila entre">
        <b style={{ fontSize: '1.3rem' }}>{duracionSuenio(n.minutos)}{n.estimado ? ' (estimado)' : ''}</b>
        <span className={`chico ${ok ? 'texto-verde' : 'texto-2'}`}>{ok ? 'objetivo cumplido' : `${duracionSuenio(objetivo - n.minutos)} menos que el objetivo`}</span>
      </div>
      <span className="chico texto-2">Celu a las {horaDeMinutos(n.acostado)}{n.cumplido ? '' : ' (tarde)'} · dormido ~{horaDeMinutos(n.dormido)} · arriba {horaDeMinutos(n.levantado)}{n.aperturas ? ` · ${n.aperturas} ${n.aperturas === 1 ? 'apertura' : 'aperturas'} del celu` : ''}</span>
      {corregible && !editando && <span className="chico texto-2">Hora de levantarse: {arriba}. <button className="enlace" onClick={() => setEditando(true)}>Corregir</button></span>}
      {corregible && editando && (
        <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
          <label className="chico texto-2" htmlFor="hora-levantado">Me levanté a las</label>
          <input id="hora-levantado" type="time" value={hm} onChange={(e) => setHm(e.target.value)} />
          <button className="boton chico primario" onClick={() => { setEditando(false); onCorregir?.(hm) }}>Guardar</button>
          <button className="boton chico suave" onClick={() => setEditando(false)}>Cancelar</button>
        </div>
      )}
    </div>
  )
}

/** Gráfico de ritmo: una barra por noche, eje de 20:00 a 09:00 del día siguiente. */
function Ritmo({ noches, ventana }: { noches: NocheDeSuenio[]; ventana: [string, string] }) {
  const min = 20 * 60
  const max = 33 * 60
  const W = 320
  const H = 18 * noches.length + 22
  const x = (m: number) => ((Math.max(min, Math.min(max, m)) - min) / (max - min)) * (W - 44) + 44
  const aMin = (hm: string, maniana: boolean) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m + (maniana ? 1440 : 0) }
  const v0 = aMin(ventana[0], false)
  const v1 = aMin(ventana[1], true)
  return (
    <svg className="suenio-ritmo" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Ritmo de sueño de ${noches.length} noches`}>
      <rect x={x(v0)} y={0} width={Math.max(0, x(v1) - x(v0))} height={H - 16} fill="var(--acento)" opacity={0.08} />
      {[20, 22, 24, 26, 28, 30, 32].map((h) => (
        <g key={h}>
          <line x1={x(h * 60)} y1={0} x2={x(h * 60)} y2={H - 16} stroke="var(--borde)" strokeWidth={1} />
          <text x={x(h * 60)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--texto-3)">{String(h % 24).padStart(2, '0')}</text>
        </g>
      ))}
      {noches.map((n, i) => {
        const y = 4 + i * 18
        const fecha = fechaLegible(n.noche).split(' ').slice(0, 2).join(' ')
        return (
          <g key={n.noche}>
            <text x={0} y={y + 10} fontSize={9} fill="var(--texto-3)">{fecha}</text>
            <rect x={x(n.dormido)} y={y} width={Math.max(2, x(n.levantado) - x(n.dormido))} height={12} rx={3} fill={n.estimado ? 'url(#suenioRayas)' : 'var(--acento)'} opacity={0.85} />
            <circle cx={x(n.acostado)} cy={y + 6} r={2.6} fill={n.cumplido ? 'var(--ok)' : 'var(--bajo)'} />
          </g>
        )
      })}
      <defs>
        <pattern id="suenioRayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="var(--acento)" /></pattern>
      </defs>
    </svg>
  )
}

