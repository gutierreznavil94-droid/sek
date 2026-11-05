import { useState } from 'react'
import { db } from '../../data/db'
import { fechaLegible, nombreDiaSemana } from '../../domain/fechas'
import { alarmasProximas, programarAlarmas, TIPOS_ALARMA } from '../../services/alarmas'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { recordatorios } from '../../reminders/recordatorios'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/**
 * Alarmas. En la app Android se programan en el teléfono (etapa 1 de alarmas
 * directas). En la web no pueden sonar con la app cerrada: esta pantalla lista
 * las horas que conviene cargar en el reloj de Android como respaldo.
 */
export function AlarmasTelefono() {
  const cap = recordatorios.capacidades()
  const datos = useDatos(async () => ({
    acciones: (await db().acciones.filter((a) => a.activa && !!a.hora && a.tipo !== 'acostarse' && a.tipo !== 'revision_diaria').toArray()).sort((a, b) => a.hora!.localeCompare(b.hora!)),
    ajustes: await obtenerAjustes(),
    permiso: await recordatorios.estadoPermiso(),
    proximas: cap.conAppCerrada ? await alarmasProximas(3) : [],
    programadas: cap.conAppCerrada ? await recordatorios.programados() : [],
  }), [])
  const [pidiendo, setPidiendo] = useState(false)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const filas = [
    ...d.acciones.map((a) => ({ hora: a.hora!, nombre: a.nombre, dias: a.dias })),
    { hora: d.ajustes.horaAlistarse, nombre: 'Completar la revisión diaria (menos de 3 min) · marcar manga y empresa si faltan', dias: [0, 1, 2, 3, 4, 5, 6] },
    { hora: d.ajustes.horaDejarCelu, nombre: 'Dejar el celu', dias: [0, 1, 2, 3, 4, 5, 6] },
    { hora: d.ajustes.horaDormido, nombre: 'Estar dormido', dias: [0, 1, 2, 3, 4, 5, 6] },
  ].sort((a, b) => a.hora.localeCompare(b.hora))
  const permisoOk = d.permiso === 'granted'
  const pedir = async () => {
    setPidiendo(true)
    const ok = await recordatorios.pedirPermiso()
    const n = ok ? await mutar(() => programarAlarmas()) : 0
    setPidiendo(false)
    avisar(ok ? (n ? `Permiso concedido. ${n} alarmas programadas.` : 'Permiso concedido.') : 'Sin permiso: las alarmas no van a sonar.', { tipo: ok ? 'ok' : 'bajo' })
    datos.recargar()
  }
  return (
    <>
      <Atras />
      <h1>{cap.conAppCerrada ? 'Alarmas de la app' : 'Alarmas del teléfono'}</h1>
      <Tarjeta titulo="Qué funciona y qué no">
        <p className="chico"><b>Con la app abierta o recién minimizada:</b> avisos en pantalla, sonido y vibración (por ejemplo, el límite de juego mientras corre el temporizador).</p>
        <p className="chico"><b>Con la app cerrada:</b> {cap.descripcion}</p>
        {!cap.conAppCerrada && <p className="chico texto-2">La app Android (en preparación) programa estas alarmas en el teléfono. Hasta probarla en tu celular, el reloj sigue siendo el respaldo.</p>}
        <div className="fila entre chico">
          <span className="texto-2">Permiso de notificaciones: <b>{permisoOk ? 'concedido' : d.permiso === 'denied' ? 'denegado' : d.permiso}</b></span>
          {!permisoOk && d.permiso !== 'no disponible' && d.permiso !== 'denied' && <button className="boton chico primario" disabled={pidiendo} onClick={pedir}>{cap.conAppCerrada ? 'Activar alarmas' : 'Pedir permiso'}</button>}
        </div>
        {cap.conAppCerrada && !permisoOk && <p className="ayuda">Android va a preguntar dos cosas: si la app puede mostrar notificaciones y si puede usar alarmas exactas (para que suenen a la hora justa, aun con la pantalla apagada). Decí que sí a las dos.</p>}
        {cap.conAppCerrada && d.permiso === 'denied' && <p className="ayuda">El permiso está denegado. Activalo en Ajustes de Android → Aplicaciones → SEK → Notificaciones.</p>}
      </Tarjeta>

      {cap.conAppCerrada && (
        <Tarjeta titulo="Qué avisos suenan">
          {TIPOS_ALARMA.map((t) => {
            const apagada = (d.ajustes.alarmasApagadas ?? []).includes(t.tipo)
            const cambiar = () => mutar(async () => {
              const lista = new Set(d.ajustes.alarmasApagadas ?? [])
              if (apagada) lista.delete(t.tipo); else lista.add(t.tipo)
              await guardarAjustes({ alarmasApagadas: [...lista] }, 'Alarmas')
              return programarAlarmas()
            }).then(() => datos.recargar())
            return (
              <label key={t.tipo} className="fila entre chico" style={{ padding: '6px 0', borderTop: '1px solid var(--borde)' }}>
                <span>{t.nombre}</span>
                <input type="checkbox" checked={!apagada} onChange={cambiar} />
              </label>
            )
          })}
          <p className="ayuda">Las alarmas suenan y vibran. «Alistarse para dormir» es tenue: sin sonido.</p>
        </Tarjeta>
      )}

      {cap.conAppCerrada && (
        <Tarjeta titulo="Próximas alarmas en este teléfono">
          {d.programadas.length === 0 && <p className="chico texto-2">Todavía no hay alarmas programadas{permisoOk ? '' : ': falta el permiso'}.</p>}
          {d.proximas.map((x) => (
            <div key={x.id} className="fila entre chico" style={{ padding: '4px 0', borderTop: '1px solid var(--borde)' }}>
              <span>{fechaLegible(x.fecha)} <b className="mono">{x.hora}</b> · {x.titulo}</span>
              <span className={`etiqueta ${d.programadas.some((p) => p.id === x.id) ? 'ok' : ''}`}>{d.programadas.some((p) => p.id === x.id) ? 'programada' : 'no programada'}</span>
            </div>
          ))}
          <p className="ayuda">Se reprograman solas al cambiar un horario en Más. Si cambiás la hora del teléfono o reiniciás, abrí la app una vez.</p>
          <button className="boton chico" onClick={() => mutar(() => programarAlarmas()).then((n) => { avisar(`${n} alarmas programadas`); datos.recargar() })}>Reprogramar ahora</button>
        </Tarjeta>
      )}

      <Tarjeta titulo={cap.conAppCerrada ? 'Las mismas horas, por si querés el reloj de respaldo' : 'Cargá estas alarmas en el reloj de Android'}>
        <p className="chico texto-2">Reloj → Alarma → + → elegí la hora y los días, y ponele el nombre. Una vez y listo.</p>
        <table className="tabla">
          <thead><tr><th>Hora</th><th>Alarma</th><th>Días</th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}><td className="mono"><b>{f.hora}</b></td><td>{f.nombre}</td><td className="chico texto-2">{f.dias.length === 7 ? 'todos' : [1, 2, 3, 4, 5, 6, 0].filter((x) => f.dias.includes(x)).map((x) => nombreDiaSemana(x, true)).join(' ')}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="ayuda">Si cambiás una hora en la app, acordate de cambiarla también en el reloj.</p>
      </Tarjeta>
    </>
  )
}
