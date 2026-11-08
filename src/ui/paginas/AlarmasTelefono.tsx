import { useEffect, useState } from 'react'
import { db } from '../../data/db'
import type { Ajustes, AvisoPropio, ModoAviso } from '../../data/tipos'
import { fechaDe, fechaLegible, nombreDiaSemana } from '../../domain/fechas'
import { abrirAjusteAlarmas, elegirTonoDelCelu, estadoAlarmasNativas, probarAlarma } from '../../nativo/sek'
import { alarmasProximas, horasDeEntrada, programarAlarmas } from '../../services/alarmas'
import { AVISOS, avisoPropioNuevo, configAviso, conAviso, nombreModo, type DefAviso } from '../../services/avisos'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { ahora } from '../../services/reloj'
import { recordatorios } from '../../reminders/recordatorios'
import { Atras, DiasSemana, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const MODOS: ModoAviso[] = ['notificacion', 'alarma', 'nada']

/** Selector de 3 botones: Notificación · Alarma · Nada. */
function SelectorModo({ valor, onChange }: { valor: ModoAviso; onChange: (m: ModoAviso) => void }) {
  return (
    <div className="modo-aviso" role="radiogroup">
      {MODOS.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={valor === m} className={`${m} ${valor === m ? 'activo' : ''}`} onClick={() => onChange(m)}>
          {nombreModo(m)}
        </button>
      ))}
    </div>
  )
}

/**
 * Más → Alarmas. Cada aviso se elige como Notificación, Alarma (alarma real de Android: pantalla completa, suena
 * hasta apagarla) o Nada; tocando la fila se cambia la hora, el porcentaje (Juego) y la vibración. En la web las
 * alarmas no pueden sonar con la app cerrada: queda la tabla para cargar en el reloj del teléfono.
 */
export function AlarmasTelefono() {
  const cap = recordatorios.capacidades()
  const datos = useDatos(async () => {
    const ajustes = await obtenerAjustes()
    return {
      acciones: (await db().acciones.filter((a) => a.activa && !!a.hora && a.tipo !== 'acostarse' && a.tipo !== 'revision_diaria').toArray()).sort((a, b) => a.hora!.localeCompare(b.hora!)),
      ajustes,
      horas: await horasDeEntrada(fechaDe(ahora(), ajustes.zonaHoraria)),
      permiso: await recordatorios.estadoPermiso(),
      nativas: await estadoAlarmasNativas(),
      proximas: cap.conAppCerrada ? await alarmasProximas(2) : [],
      programadas: cap.conAppCerrada ? await recordatorios.programados() : [],
    }
  }, [])
  const [pidiendo, setPidiendo] = useState(false)
  // Al volver de un ajuste de Android (alarmas exactas, pantalla completa) se relee el estado.
  useEffect(() => {
    const volver = () => { if (document.visibilityState === 'visible') datos.recargar() }
    document.addEventListener('visibilitychange', volver)
    return () => document.removeEventListener('visibilitychange', volver)
  }, [datos])
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const a = d.ajustes
  const permisoOk = d.permiso === 'granted'

  const guardar = (cambio: Parameters<typeof guardarAjustes>[0], texto?: string) =>
    mutar(async () => {
      await guardarAjustes(cambio, 'Alarmas')
      return programarAlarmas()
    }).then(() => { if (texto) avisar(texto, { tipo: 'ok' }); datos.recargar() })

  const pedir = async () => {
    setPidiendo(true)
    const ok = await recordatorios.pedirPermiso()
    const n = ok ? await mutar(() => programarAlarmas()) : 0
    setPidiendo(false)
    avisar(ok ? (n ? `Permiso concedido. ${n} avisos programados.` : 'Permiso concedido.') : 'Sin permiso: los avisos no van a sonar.', { tipo: ok ? 'ok' : 'bajo' })
    datos.recargar()
  }

  const sonido = a.sonidoAlarma || 'sek'
  const nombreSonido = sonido === 'sek' ? 'Gong de SEK' : sonido === 'celu' ? 'Alarma del celu' : (a.sonidoAlarmaNombre || 'Tono elegido')
  const faltaNativo = d.nativas && (!d.nativas.exactas || !d.nativas.pantallaCompleta)

  const filasReloj = [
    ...d.acciones.map((x) => ({ hora: x.hora!, nombre: x.nombre, dias: x.dias })),
    { hora: a.horaAlistarse, nombre: 'Alistarse para dormir · revisión diaria', dias: [0, 1, 2, 3, 4, 5, 6] },
    { hora: a.horaDejarCelu, nombre: 'Dejar el celu', dias: [0, 1, 2, 3, 4, 5, 6] },
    { hora: a.horaDormido, nombre: 'Estar dormido', dias: [0, 1, 2, 3, 4, 5, 6] },
  ].sort((x, y) => x.hora.localeCompare(y.hora))

  return (
    <>
      <Atras />
      <h1>Alarmas</h1>

      {(!permisoOk || faltaNativo || !cap.conAppCerrada) && (
        <Tarjeta titulo="Para que suenen">
          {!cap.conAppCerrada && <p className="chico">{cap.descripcion}</p>}
          {!permisoOk && d.permiso !== 'no disponible' && (
            <div className="fila entre chico">
              <span className="texto-2">Notificaciones: <b>{d.permiso === 'denied' ? 'denegadas' : 'sin permiso'}</b></span>
              {d.permiso !== 'denied' && <button className="boton chico primario" disabled={pidiendo} onClick={pedir}>{cap.conAppCerrada ? 'Activar alarmas' : 'Pedir permiso'}</button>}
            </div>
          )}
          {d.permiso === 'denied' && <p className="ayuda">Activalas en Ajustes de Android → Aplicaciones → SEK → Notificaciones.</p>}
          {d.nativas && !d.nativas.exactas && (
            <div className="fila entre chico">
              <span className="texto-2">Alarmas exactas: <b>sin permiso</b></span>
              <button className="boton chico primario" onClick={() => abrirAjusteAlarmas('exactas')}>Dar permiso</button>
            </div>
          )}
          {d.nativas && !d.nativas.pantallaCompleta && (
            <div className="fila entre chico">
              <span className="texto-2">Alarma en pantalla completa: <b>sin permiso</b></span>
              <button className="boton chico primario" onClick={() => abrirAjusteAlarmas('pantalla')}>Dar permiso</button>
            </div>
          )}
          {faltaNativo && <p className="ayuda">Sin estos permisos la Alarma llega como notificación y puede atrasarse. Android abre el ajuste: activá SEK y volvé.</p>}
        </Tarjeta>
      )}

      <Tarjeta titulo="Avisos">
        <p className="ayuda" style={{ marginTop: 0 }}>Elegí cómo avisa cada uno. <b>Alarma</b> suena y vibra con pantalla completa, aunque el celu esté bloqueado o en No molestar, hasta «Apagar» o «Posponer 5 min». Tocá el nombre para cambiar la hora.</p>
        <ListaAvisos ajustes={a} horas={d.horas} onCambio={(c, t) => void guardar(c, t)} />
      </Tarjeta>

      <Tarjeta titulo="Sonido de la alarma">
        <div className="chips">
          <button type="button" className={sonido === 'sek' ? 'activo' : ''} onClick={() => guardar({ sonidoAlarma: 'sek' })}>Gong de SEK</button>
          <button type="button" className={sonido === 'celu' ? 'activo' : ''} onClick={() => guardar({ sonidoAlarma: 'celu' })}>Alarma del celu</button>
          {cap.conAppCerrada && (
            <button type="button" className={sonido !== 'sek' && sonido !== 'celu' ? 'activo' : ''} onClick={async () => {
              const t = await elegirTonoDelCelu()
              if (t) void guardar({ sonidoAlarma: t.uri, sonidoAlarmaNombre: t.nombre }, `Tono: ${t.nombre}`)
            }}>{sonido !== 'sek' && sonido !== 'celu' ? nombreSonido : 'Elegir del celu…'}</button>
          )}
        </div>
        {cap.conAppCerrada && (
          <div className="fila entre chico" style={{ marginTop: 10 }}>
            <span className="texto-2">Suena: <b>{nombreSonido}</b></span>
            <button type="button" className="boton chico" onClick={async () => {
              const ok = await probarAlarma(5, sonido, true)
              avisar(ok ? 'Alarma de prueba en 5 s: bloqueá el celu para verla' : 'No se pudo programar la prueba', { tipo: ok ? 'ok' : 'bajo' })
            }}>Probar en 5 s</button>
          </div>
        )}
      </Tarjeta>

      {cap.conAppCerrada && (
        <Tarjeta titulo="Próximos avisos en este celu">
          {d.proximas.length === 0 && <p className="chico texto-2">No hay avisos para hoy ni mañana{permisoOk ? '' : ': falta el permiso'}.</p>}
          {d.proximas.map((x) => {
            const prog = d.programadas.some((p) => p.id === x.id)
            return (
              <div key={x.id} className="fila entre chico" style={{ padding: '4px 0', borderTop: '1px solid var(--borde)' }}>
                <span>{fechaLegible(x.fecha)} <b className="mono">{x.hora}</b> · {x.titulo}</span>
                <span className={`etiqueta ${prog ? 'ok' : ''}`}>{prog ? nombreModo(x.modo === 'alarma' ? 'alarma' : 'notificacion') : 'no programado'}</span>
              </div>
            )
          })}
          <p className="ayuda">Se reprograman solos al cambiar un horario. Si reiniciás el celu, las alarmas vuelven solas; abrí la app una vez para las notificaciones.</p>
          <button className="boton chico" onClick={() => mutar(() => programarAlarmas()).then((n) => { avisar(`${n} avisos programados`); datos.recargar() })}>Reprogramar ahora</button>
        </Tarjeta>
      )}

      {!cap.conAppCerrada && (
        <Tarjeta titulo="Cargá estas alarmas en el reloj de Android">
          <p className="chico texto-2">Reloj → Alarma → + → elegí la hora y los días, y ponele el nombre. Una vez y listo.</p>
          <table className="tabla">
            <thead><tr><th>Hora</th><th>Alarma</th><th>Días</th></tr></thead>
            <tbody>
              {filasReloj.map((f, i) => (
                <tr key={i}><td className="mono"><b>{f.hora}</b></td><td>{f.nombre}</td><td className="chico texto-2">{f.dias.length === 7 ? 'todos' : [1, 2, 3, 4, 5, 6, 0].filter((x) => f.dias.includes(x)).map((x) => nombreDiaSemana(x, true)).join(' ')}</td></tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </>
  )
}

type CambioAvisos = Partial<Pick<Ajustes, 'avisos' | 'avisosPropios'>>

/**
 * Lista de avisos (Notificación · Alarma · Nada), con hora, % y vibración al tocar la fila, y los avisos propios.
 * La usan Más → Alarmas (guarda al toque) y el primer arranque (guarda al final).
 */
export function ListaAvisos({ ajustes: a, horas, onCambio }: { ajustes: Pick<Ajustes, 'avisos' | 'avisosPropios' | 'alarmasApagadas'>; horas: Partial<Record<string, string>>; onCambio: (c: CambioAvisos, texto?: string) => void }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<{ nombre: string; hora: string; dias: number[]; modo: ModoAviso } | null>(null)
  const propios = a.avisosPropios ?? []
  const guardarPropios = (lista: AvisoPropio[], texto?: string) => onCambio({ avisosPropios: lista }, texto)
  const cuando = (def: DefAviso) => {
    const c = configAviso(a, def.tipo)
    if (def.tipo === 'juego-mitad') return `al ${c.porcentaje} % del tiempo de juego`
    if (def.horaEditable) {
      const h = c.hora ?? horas[def.tipo as keyof typeof horas]
      return h ? `${h}${c.hora ? ' (a mano)' : ''}` : 'según el día'
    }
    return def.cuando ?? ''
  }

  return (
    <>
      {AVISOS.map((def) => {
        const c = configAviso(a, def.tipo)
        const editando = abierto === def.tipo
        return (
          <div key={def.tipo} className={`fila-aviso ${c.modo}`}>
            <button type="button" className="fila-aviso-nombre" onClick={() => setAbierto(editando ? null : def.tipo)} aria-expanded={editando}>
              <span>{def.nombre}<span className="desc">{cuando(def)}</span></span>
              <span className="flecha">{editando ? '⌃' : '⌄'}</span>
            </button>
            <SelectorModo valor={c.modo} onChange={(m) => onCambio({ avisos: conAviso(a, def.tipo, { modo: m }) }, `${def.nombre}: ${nombreModo(m)}`)} />
            {editando && (
              <div className="fila-aviso-edicion">
                {def.horaEditable && (
                  <div className="fila entre chico">
                    <label htmlFor={`hora-${def.tipo}`}>Hora</label>
                    <span className="fila" style={{ gap: 8 }}>
                      <input id={`hora-${def.tipo}`} type="time" value={c.hora ?? horas[def.tipo as keyof typeof horas] ?? ''} onChange={(e) => e.target.value && onCambio({ avisos: conAviso(a, def.tipo, { hora: e.target.value }) })} />
                      {c.hora && <button type="button" className="boton chico" onClick={() => onCambio({ avisos: conAviso(a, def.tipo, { hora: undefined }) }, 'Vuelve a la hora de la app')}>Usar la de la app</button>}
                    </span>
                  </div>
                )}
                {def.horaEditable && !c.hora && <p className="ayuda">Si cambiás la hora en Sueño o Mi horario, esta se actualiza sola.</p>}
                {def.conPorcentaje && (
                  <div className="fila entre chico">
                    <label htmlFor="porcentaje-juego">Avisar al</label>
                    <span className="fila" style={{ gap: 6 }}>
                      <input id="porcentaje-juego" type="number" inputMode="numeric" min={5} max={99} style={{ width: 72 }} value={c.porcentaje} onChange={(e) => { const v = Number(e.target.value); if (v >= 5 && v <= 99) onCambio({ avisos: conAviso(a, def.tipo, { porcentaje: v }) }) }} />
                      <span>%</span>
                    </span>
                  </div>
                )}
                <label className="fila entre chico">
                  <span>Vibrar</span>
                  <input type="checkbox" checked={c.vibrar} onChange={() => onCambio({ avisos: conAviso(a, def.tipo, { vibrar: !c.vibrar }) })} />
                </label>
              </div>
            )}
          </div>
        )
      })}

      {propios.map((p) => {
        const editando = abierto === p.id
        return (
          <div key={p.id} className={`fila-aviso ${p.modo}`}>
            <button type="button" className="fila-aviso-nombre" onClick={() => setAbierto(editando ? null : p.id)} aria-expanded={editando}>
              <span>{p.nombre}<span className="desc">{p.hora} · {p.dias.length === 7 ? 'todos los días' : [1, 2, 3, 4, 5, 6, 0].filter((x) => p.dias.includes(x)).map((x) => nombreDiaSemana(x, true)).join(' ')}</span></span>
              <span className="flecha">{editando ? '⌃' : '⌄'}</span>
            </button>
            <SelectorModo valor={p.modo} onChange={(m) => guardarPropios(propios.map((x) => (x.id === p.id ? { ...x, modo: m } : x)), `${p.nombre}: ${nombreModo(m)}`)} />
            {editando && (
              <div className="fila-aviso-edicion">
                <div className="campo"><label htmlFor={`nombre-${p.id}`}>Nombre</label><input id={`nombre-${p.id}`} defaultValue={p.nombre} onBlur={(e) => e.target.value.trim() && e.target.value !== p.nombre && guardarPropios(propios.map((x) => (x.id === p.id ? { ...x, nombre: e.target.value.trim() } : x)))} /></div>
                <div className="fila entre chico">
                  <label htmlFor={`hora-${p.id}`}>Hora</label>
                  <input id={`hora-${p.id}`} type="time" value={p.hora} onChange={(e) => e.target.value && guardarPropios(propios.map((x) => (x.id === p.id ? { ...x, hora: e.target.value } : x)))} />
                </div>
                <DiasSemana valor={p.dias} onChange={(v) => v.length && guardarPropios(propios.map((x) => (x.id === p.id ? { ...x, dias: v } : x)))} />
                <label className="fila entre chico">
                  <span>Vibrar</span>
                  <input type="checkbox" checked={p.vibrar ?? true} onChange={() => guardarPropios(propios.map((x) => (x.id === p.id ? { ...x, vibrar: !(p.vibrar ?? true) } : x)))} />
                </label>
                <button type="button" className="boton chico peligro" onClick={() => { setAbierto(null); void guardarPropios(propios.filter((x) => x.id !== p.id), 'Aviso borrado') }}>Borrar este aviso</button>
              </div>
            )}
          </div>
        )
      })}

      {nuevo ? (
        <div className="fila-aviso-edicion nuevo-aviso">
          <div className="campo"><label htmlFor="nuevo-nombre">Nombre</label><input id="nuevo-nombre" value={nuevo.nombre} placeholder="Ej.: Tomar agua" onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></div>
          <div className="fila entre chico">
            <label htmlFor="nuevo-hora">Hora</label>
            <input id="nuevo-hora" type="time" value={nuevo.hora} onChange={(e) => setNuevo({ ...nuevo, hora: e.target.value })} />
          </div>
          <DiasSemana valor={nuevo.dias} onChange={(v) => setNuevo({ ...nuevo, dias: v })} />
          <SelectorModo valor={nuevo.modo} onChange={(m) => setNuevo({ ...nuevo, modo: m })} />
          <div className="fila" style={{ gap: 8 }}>
            <button type="button" className="boton primario" disabled={!nuevo.nombre.trim() || !nuevo.hora} onClick={() => { void guardarPropios([...propios, avisoPropioNuevo(nuevo.nombre, nuevo.hora, nuevo.dias, nuevo.modo)], 'Aviso agregado'); setNuevo(null) }}>Guardar aviso</button>
            <button type="button" className="boton" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="boton agregar-aviso" onClick={() => setNuevo({ nombre: '', hora: '12:00', dias: [0, 1, 2, 3, 4, 5, 6], modo: 'notificacion' })}>+ Agregar aviso</button>
      )}
    </>
  )
}
