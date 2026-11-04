import { useState } from 'react'
import type { SesionJuego } from '../../data/tipos'
import { duracionLegible, fechaDe, fechaLegible, formatoHora, instanteDe, sumarDias } from '../../domain/fechas'
import { duracionMs } from '../../domain/juego'
import { obtenerAjustes } from '../../services/base'
import { agregarSesionManual, borrarSesion, corregirSesion, finalizarJuego, historialJuego, iniciarJuego, pausarJuego, reanudarJuego, resumenJuego } from '../../services/juego'
import { ahora } from '../../services/reloj'
import { recordatorios } from '../../reminders/recordatorios'
import { Barra, Confirmar, Explicacion, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos, useTic } from '../estado'
import { CasaDelJuego } from '../animaciones/Siluetas'

export function Juego({ hoy }: { hoy: string }) {
  const tic = useTic(1000)
  const datos = useDatos(async () => ({ resumen: await resumenJuego(hoy), historial: await historialJuego(40), ajustes: await obtenerAjustes() }), [hoy])
  const [editar, setEditar] = useState<SesionJuego | null | 'nueva'>(null)
  const [borrar, setBorrar] = useState<SesionJuego | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const { resumen: r, ajustes } = d
  const activa = r.activa
  const msSesion = activa ? duracionMs(activa, tic) : 0
  const minutosHoy = Math.round(r.minutosHoy + (activa && !r.pausada ? (tic - ahora()) / 60_000 : 0))
  const estado = minutosHoy >= r.limiteMinutos ? 'superado' : minutosHoy >= (r.limiteMinutos * ajustes.avisoJuegoPorcentaje) / 100 ? 'cerca' : 'ok'

  const iniciar = async () => {
    await mutar(iniciarJuego)
    const restante = Math.max(0, r.limiteMinutos - r.minutosHoy)
    const aviso = Math.max(0, (r.limiteMinutos * ajustes.avisoJuegoPorcentaje) / 100 - r.minutosHoy)
    // Avisos mientras la app esté abierta (la web no garantiza más).
    await recordatorios.programar({ id: 'juego-cerca', titulo: 'Juego', cuerpo: `Vas por el ${ajustes.avisoJuegoPorcentaje} % del límite`, instante: Date.now() + aviso * 60_000 })
    await recordatorios.programar({ id: 'juego-limite', titulo: 'Juego', cuerpo: `Llegaste al límite de ${r.limiteMinutos} min`, instante: Date.now() + restante * 60_000 })
    recordatorios.pedirPermiso()
  }
  const finalizar = async () => {
    await mutar(() => finalizarJuego())
    await recordatorios.cancelar('juego-cerca')
    await recordatorios.cancelar('juego-limite')
    avisar('Sesión guardada')
  }

  return (
    <>
      <Tarjeta compacta>
        <div className="fila entre">
          <span className="seccion-titulo">Temporizador de juego</span>
          <Explicacion titulo="Cómo funciona">
            <p>Es manual: iniciás, pausás y finalizás. La sesión activa queda guardada en el teléfono, así que cerrar la app no la pierde.</p>
            <p className="texto-2 chico">Registrar el juego no da XP. Respetar el límite del día ({r.limiteMinutos} min hoy: {ajustes.limiteJuegoSemana} de lunes a viernes, {ajustes.limiteJuegoFinde} sábados, domingos y feriados) sí, y se resuelve al cerrar el día. Los avisos de límite solo suenan con la app abierta; con la app cerrada, poné una alarma en el teléfono.</p>
          </Explicacion>
        </div>
        <div className="fila entre juego-temporizador">
          <div>
            <div className={`juego-segundos mono ${estado === 'superado' ? 'bajo' : estado === 'cerca' ? 'medio' : ''}`}>{activa ? tiempo(msSesion) : '00:00'}</div>
            <div className="texto-3 muy-chico">{activa ? (r.pausada ? 'En pausa' : `Jugando desde las ${formatoHora(activa.inicio, ajustes.zonaHoraria)}`) : 'Sin sesión activa'}</div>
          </div>
          {!activa && <button className="boton primario" onClick={iniciar}>▶ Iniciar</button>}
          {activa && (
            <div className="fila" style={{ gap: 6 }}>
              {r.pausada ? <button className="boton" onClick={() => mutar(reanudarJuego)}>▶ Reanudar</button> : <button className="boton" onClick={() => mutar(pausarJuego)}>❚❚ Pausar</button>}
              <button className="boton peligro" onClick={finalizar}>■ Finalizar</button>
            </div>
          )}
        </div>
        {/* La casa: pelean hasta que empezás a jugar; jugando, concentrados; en pausa, té. Clips J1–J5 cuando estén. */}
        <CasaDelJuego activa={!!activa} pausada={!!r.pausada} />
      </Tarjeta>

      <Tarjeta compacta>
        <div className="fila entre">
          <span className="texto-2">Hoy</span>
          <b className={`mono ${estado === 'superado' ? 'bajo' : estado === 'cerca' ? 'medio' : ''}`}>{minutosHoy} / {r.limiteMinutos} min</b>
        </div>
        <Barra valor={(100 * minutosHoy) / Math.max(1, r.limiteMinutos)} clase={estado === 'superado' ? 'bajo' : estado === 'cerca' ? 'medio' : 'ok'} />
        {estado === 'superado' && <span className="chico bajo">Superaste el límite de hoy por {minutosHoy - r.limiteMinutos} min.</span>}
        {estado === 'cerca' && <span className="chico medio">Te quedan {r.limiteMinutos - minutosHoy} min.</span>}
        <div className="fila entre chico">
          <span className="texto-2">Esta semana</span>
          <span className="mono">{duracionLegible(r.minutosSemana)} <span className="texto-3">(límite {duracionLegible(r.limiteSemana)})</span></span>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Últimos 7 días">
        <div className="barras">
          {Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6)).map((f) => {
            const m = Math.round(r.porDia.get(f) ?? 0) + (f === hoy ? minutosHoy - r.minutosHoy : 0)
            const lim = r.limitesPorDia.get(f) ?? r.limiteMinutos
            const alto = Math.min(100, (100 * m) / Math.max(1, lim * 1.5))
            return <div key={f} className={m === 0 ? 'sin' : m > lim ? 'bajo' : 'ok'} style={{ height: `${Math.max(3, alto)}%` }} title={`${fechaLegible(f)}: ${m} de ${lim} min`} />
          })}
        </div>
        <div className="barras-etq">
          {Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6)).map((f) => <div key={f}>{fechaLegible(f).split(' ')[0]}</div>)}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Historial" derecha={<button className="boton chico" onClick={() => setEditar('nueva')}>+ Añadir a mano</button>}>
        {d.historial.length === 0 && <p className="vacio">Todavía no hay sesiones.</p>}
        <div>
          {d.historial.map((s) => (
            <div key={s.id} className="fila entre chico" style={{ padding: '8px 0', borderTop: '1px solid var(--borde)' }}>
              <div>
                <div>{fechaLegible(fechaDe(s.inicio, ajustes.zonaHoraria))} · {formatoHora(s.inicio, ajustes.zonaHoraria)}–{s.fin ? formatoHora(s.fin, ajustes.zonaHoraria) : '…'}</div>
                <div className="texto-3 muy-chico">{s.corregida && 'corregida · '}{s.pausas.length > 0 && `${s.pausas.length} pausa${s.pausas.length > 1 ? 's' : ''} · `}{s.nota}</div>
              </div>
              <div className="fila" style={{ gap: 4 }}>
                <b className="mono">{duracionLegible(duracionMs(s, tic) / 60_000)}</b>
                {s.fin && <button className="boton chico suave" onClick={() => setEditar(s)} aria-label="Corregir">✎</button>}
                <button className="boton chico suave" onClick={() => setBorrar(s)} aria-label="Borrar">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </Tarjeta>

      {editar && <EditarSesion sesion={editar === 'nueva' ? null : editar} zona={ajustes.zonaHoraria} hoy={hoy} onCerrar={() => setEditar(null)} />}
      <Confirmar abierta={!!borrar} titulo="¿Borrar esta sesión?" texto="Queda registrado en el historial que se borró." confirmar="Borrar" peligro onConfirmar={() => { mutar(() => borrarSesion(borrar!.id!, 'Borrada desde Juego')); setBorrar(null) }} onCancelar={() => setBorrar(null)} />
    </>
  )
}

function tiempo(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function aLocal(instante: number, zona: string): string {
  return `${fechaDe(instante, zona)}T${formatoHora(instante, zona)}`
}

function EditarSesion({ sesion, zona, hoy, onCerrar }: { sesion: SesionJuego | null; zona: string; hoy: string; onCerrar: () => void }) {
  const [inicio, setInicio] = useState(sesion ? aLocal(sesion.inicio, zona) : `${hoy}T20:00`)
  const [fin, setFin] = useState(sesion?.fin ? aLocal(sesion.fin, zona) : `${hoy}T21:00`)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const guardar = async () => {
    try {
      const [fi, hi] = inicio.split('T')
      const [ff, hf] = fin.split('T')
      const ti = instanteDe(fi, hi, zona)
      const tf = instanteDe(ff, hf, zona)
      if (tf <= ti) throw new Error('El fin debe ser después del inicio.')
      if (tf - ti > 16 * 3_600_000) throw new Error('Una sesión no puede durar más de 16 horas.')
      if (!motivo.trim()) throw new Error('Escribí el motivo: queda en el historial.')
      await mutar(async () => { if (sesion) await corregirSesion(sesion.id!, ti, tf, motivo.trim()); else await agregarSesionManual(ti, tf, motivo.trim()) })
      avisar('Guardado con registro de corrección', { tipo: 'ok' })
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={sesion ? 'Corregir sesión' : 'Añadir sesión a mano'}>
      <div className="campo"><label>Inicio</label><input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
      <div className="campo"><label>Fin</label><input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
      <div className="campo"><label>Motivo</label><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: me olvidé de iniciar el temporizador" /></div>
      {error && <p className="error">{error}</p>}
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
