import { useEffect, useState } from 'react'
import { recordatorios } from '../../reminders/recordatorios'
import { programarAlarmas } from '../../services/alarmas'
import { Link } from 'react-router-dom'
import { db } from '../../data/db'
import { esHoraValida, fechaLegible, formatoHora, minutosDe, nombreDiaSemana, sumarDias } from '../../domain/fechas'
import { guardarAccion } from '../../services/acciones'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { reprogramarCompromiso } from '../../services/dia'
import { Atras, DiasSemana, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function Entrenamiento({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({
    entreno: await db().acciones.get('entrenamiento'),
    acostarse: await db().acciones.get('acostarse'),
    ajustes: await obtenerAjustes(),
    proximos: await db().compromisos.where('fecha').between(hoy, sumarDias(hoy, 7), true, true).filter((c) => c.accionId === 'entrenamiento' && (c.estado === 'pendiente' || c.estado === 'iniciado')).toArray(),
    noches: await db().suenio.orderBy('noche').reverse().limit(7).toArray(),
  }), [hoy])
  const [dias, setDias] = useState<number[]>([])
  const [horaEntreno, setHoraEntreno] = useState('07:00')
  const [minimo, setMinimo] = useState(30)
  const [horasPorDia, setHorasPorDia] = useState<Record<number, string>>({})
  const [limiteInicio, setLimiteInicio] = useState('19:35')
  const [avisoActivo, setAvisoActivo] = useState(true)
  const [horaAviso, setHoraAviso] = useState('19:00')
  const [permiso, setPermiso] = useState('')
  const [horaAlistarse, setHoraAlistarse] = useState('20:50')
  const [horaDejarCelu, setHoraDejarCelu] = useState('21:15')
  const [horaDormido, setHoraDormido] = useState('21:20')
  const [objetivoSuenio, setObjetivoSuenio] = useState(7.5)
  const [corte, setCorte] = useState('06:00')
  const [limiteCelu, setLimiteCelu] = useState('22:15')
  const [finSuenio, setFinSuenio] = useState('05:00')
  const d = datos.datos
  useEffect(() => {
    if (!d) return
    setDias(d.entreno?.dias ?? [])
    setHoraEntreno(d.entreno?.hora ?? '07:00')
    setMinimo(d.entreno?.minutosMinimos ?? 30)
    setHorasPorDia(d.entreno?.horasPorDia ?? {})
    setLimiteInicio(d.entreno?.horaLimiteInicio ?? '19:35')
    setAvisoActivo(d.entreno?.avisoInicio?.activo ?? true)
    setHoraAviso(d.entreno?.avisoInicio?.hora ?? '19:00')
    recordatorios.estadoPermiso().then(setPermiso).catch(() => {})
    setHoraAlistarse(d.ajustes.horaAlistarse)
    setHoraDejarCelu(d.ajustes.horaDejarCelu)
    setHoraDormido(d.ajustes.horaDormido)
    setObjetivoSuenio(d.ajustes.objetivoSuenioHoras)
    setCorte(d.ajustes.horaCorteNoche)
    setLimiteCelu(d.ajustes.horaLimiteCelu)
    setFinSuenio(d.ajustes.horaFinSuenio)
  }, [d])
  if (!d) return <p className="vacio">Cargando…</p>

  const guardarEntreno = async () => {
    if (!d.entreno) return
    if (!esHoraValida(horaEntreno)) return avisar('Hora de entrenamiento inválida', { tipo: 'bajo' })
    const extras: Record<number, string> = {}
    for (const [k, v] of Object.entries(horasPorDia)) if (dias.includes(Number(k)) && v && v !== horaEntreno) { if (!esHoraValida(v)) return avisar('Hora inválida en un día', { tipo: 'bajo' }); extras[Number(k)] = v }
    if (!esHoraValida(limiteInicio) || !esHoraValida(horaAviso)) return avisar('Revisá la hora límite y la del aviso (HH:MM)', { tipo: 'bajo' })
    if (avisoActivo && minutosDe(horaAviso) >= minutosDe(limiteInicio)) return avisar('El aviso tiene que ser antes de la hora límite para empezar', { tipo: 'bajo' })
    await mutar(() => guardarAccion({ ...d.entreno!, dias, hora: horaEntreno, minutosMinimos: minimo, horasPorDia: Object.keys(extras).length ? extras : undefined, horaLimiteInicio: limiteInicio, avisoInicio: { activo: avisoActivo, hora: horaAviso } }))
    programarAlarmas().catch(() => {})
    avisar('Entrenamiento guardado. Vale de hoy en adelante; los días pasados no cambian.', { tipo: 'ok' })
  }
  const guardarDescanso = async () => {
    if (!esHoraValida(horaAlistarse) || !esHoraValida(horaDejarCelu) || !esHoraValida(horaDormido) || !esHoraValida(corte) || !esHoraValida(limiteCelu) || !esHoraValida(finSuenio)) return avisar('Revisá las horas (HH:MM)', { tipo: 'bajo' })
    if (!(minutosDe(horaAlistarse) < minutosDe(horaDejarCelu) && minutosDe(horaDejarCelu) < minutosDe(horaDormido))) {
      return avisar('El orden tiene que ser: alistarme < dejar el celu < estar dormido', { tipo: 'bajo' })
    }
    if (minutosDe(limiteCelu) <= minutosDe(horaDejarCelu)) return avisar('La hora hasta la que se puede marcar tarde tiene que ser después de la de dejar el celu', { tipo: 'bajo' })
    await mutar(async () => {
      await guardarAjustes({ horaAlistarse, horaDejarCelu, horaDormido, objetivoSuenioHoras: objetivoSuenio, horaCorteNoche: corte, horaLimiteCelu: limiteCelu, horaFinSuenio: finSuenio })
      if (d.acostarse) await guardarAccion({ ...d.acostarse, hora: horaDejarCelu, horaLimite: horaDejarCelu })
    })
    avisar('Descanso guardado. Vale de hoy en adelante.', { tipo: 'ok' })
  }

  return (
    <>
      <Atras />
      <h1>Entrenamiento y descanso</h1>
      <div className="lista-nav tarjeta compacta">
        <Link to="/entreno"><span>Empezar entreno<span className="desc">modo juego: series, descanso con sombra, XP por mejorar</span></span><span className="flecha">›</span></Link>
        <Link to="/mas/rutinas"><span>Rutinas<span className="desc">A, B y C · ejercicios, días, pesos y progreso</span></span><span className="flecha">›</span></Link>
      </div>
      <Tarjeta titulo="Entrenamiento">
        <div className="campo"><label>Días</label><DiasSemana valor={dias} onChange={setDias} /></div>
        <div className="rejilla-2">
          <div className="campo"><label>Hora</label><input type="time" value={horaEntreno} onChange={(e) => setHoraEntreno(e.target.value)} /></div>
          <div className="campo"><label>Mínimo (min) para XP</label><input type="number" inputMode="numeric" min={0} value={minimo} onChange={(e) => setMinimo(Number(e.target.value))} /></div>
        </div>
        {dias.length > 0 && (
          <details>
            <summary className="chico texto-2">Hora distinta en algún día</summary>
            <div className="rejilla-2" style={{ marginTop: 8 }}>
              {[1, 2, 3, 4, 5, 6, 0].filter((x) => dias.includes(x)).map((x) => (
                <div key={x} className="campo"><label>{nombreDiaSemana(x)}</label><input type="time" value={horasPorDia[x] ?? horaEntreno} onChange={(e) => setHorasPorDia({ ...horasPorDia, [x]: e.target.value })} /></div>
              ))}
            </div>
          </details>
        )}
        <div className="rejilla-2">
          <div className="campo"><label>Empezar hasta</label><input type="time" value={limiteInicio} onChange={(e) => setLimiteInicio(e.target.value)} /><span className="ayuda">Si empieza después, el entreno cuenta pero el pilar queda tarde, sin XP. La hora de fin no importa.</span></div>
          <div className="campo"><label>Aviso si no empezó</label><input type="time" value={horaAviso} disabled={!avisoActivo} onChange={(e) => setHoraAviso(e.target.value)} /><label className="fila chico" style={{ gap: 6 }}><input type="checkbox" checked={avisoActivo} onChange={(e) => setAvisoActivo(e.target.checked)} /> Aviso activo</label></div>
        </div>
        {avisoActivo && permiso !== 'granted' && permiso !== 'no disponible' && (
          <button className="boton chico" onClick={() => recordatorios.pedirPermiso().then((ok) => { setPermiso(ok ? 'granted' : 'denied'); avisar(ok ? 'Notificaciones activadas' : 'El teléfono no dio permiso para notificaciones', { tipo: ok ? 'ok' : 'bajo' }) })}>Permitir notificaciones</button>
        )}
        <span className="ayuda">{recordatorios.capacidades().conAppCerrada ? 'El aviso suena aunque la app esté cerrada.' : 'En la versión web el aviso sale con la app abierta o recién minimizada (y como cartel en Hoy). Con la app de Android suena aunque esté cerrada.'}</span>
        <span className="ayuda">El cambio vale de hoy en adelante y no altera días pasados. El calendario y «próximo entrenamiento» lo reflejan.</span>
        <button className="boton primario ancho" onClick={guardarEntreno}>Guardar entrenamiento</button>
        {d.proximos.length > 0 && (
          <>
            <div className="separador" />
            <b className="chico">Próximos</b>
            {d.proximos.map((c) => (
              <div key={c.id} className="fila entre chico">
                <span>{fechaLegible(c.fecha)} · {c.horaPrevista}</span>
                <button className="boton chico suave" onClick={() => mutar(() => reprogramarCompromiso(c.id, sumarDias(c.fecha, 1))).then(() => avisar('Movido un día'))}>Mover +1 día</button>
              </div>
            ))}
          </>
        )}
      </Tarjeta>
      <Tarjeta titulo="Descanso">
        <p className="chico texto-2">Tres pasos, en orden. A la hora de alistarse sale un solo aviso: marcar manga y empresa si faltan y hacer la revisión (con 10 minutos de margen). «Dejo celu» registra la hora real y pone la app en modo sueño hasta la hora de fin. Hasta la hora de dejar el celu cuenta como cumplido y da XP; después, tarde.</p>
        <div className="campo"><label>1 · Empezar a alistarme · aviso de revisión</label><input type="time" value={horaAlistarse} onChange={(e) => setHoraAlistarse(e.target.value)} /></div>
        <div className="campo"><label>2 · Dejar el celu (hasta esta hora cuenta)</label><input type="time" value={horaDejarCelu} onChange={(e) => setHoraDejarCelu(e.target.value)} /></div>
        <div className="campo"><label>3 · Estar dormido</label><input type="time" value={horaDormido} onChange={(e) => setHoraDormido(e.target.value)} /></div>
        <div className="rejilla-2">
          <div className="campo"><label>«Dejo celu» tarde hasta</label><input type="time" value={limiteCelu} onChange={(e) => setLimiteCelu(e.target.value)} /><span className="ayuda">Después, el botón desaparece y la noche queda sin cumplir.</span></div>
        </div>
        <p className="ayuda">La hora de levantarte, los minutos hasta dormirte y el objetivo de horas están en la pestaña <Link to="/sueno">Sueño</Link>.</p>
        <div className="campo"><label>Hasta qué hora un registro cuenta para la noche anterior</label><input type="time" value={corte} onChange={(e) => setCorte(e.target.value)} /><span className="ayuda">Si dejás el celu a las 00:40, cuenta para la noche anterior (con el retraso). Antes de esta hora, el día anterior no se cierra.</span></div>
        <button className="boton primario ancho" onClick={guardarDescanso}>Guardar descanso</button>
        {d.noches.length > 0 && (
          <>
            <div className="separador" />
            <b className="chico">Últimas noches</b>
            {d.noches.map((n) => (
              <div key={n.id} className="fila entre chico"><span>{fechaLegible(n.noche)}</span><span className={n.cumplido ? 'ok' : 'bajo'}>{formatoHora(n.horaReal, d.ajustes.zonaHoraria)} · {n.cumplido ? 'a tiempo' : `${n.retrasoMinutos} min tarde`}</span></div>
            ))}
          </>
        )}
      </Tarjeta>
      <p className="ayuda">Recordatorios con la app cerrada: cargá estas horas en el reloj del teléfono. <Link to="/mas/alarmas">Ver alarmas del teléfono</Link>.</p>
    </>
  )
}
