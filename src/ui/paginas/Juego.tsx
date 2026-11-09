import { useEffect, useState, type ReactNode } from 'react'
import type { SesionJuego } from '../../data/tipos'
import { duracionLegible, fechaDe, fechaLegible, formatoHora, instanteDe, sumarDias } from '../../domain/fechas'
import { duracionMs } from '../../domain/juego'
import { obtenerAjustes } from '../../services/base'
import { agregarSesionManual, borrarSesion, corregirSesion, finalizarJuego, historialJuego, iniciarJuego, pausarJuego, reanudarJuego, resumenJuego } from '../../services/juego'
import { ahora } from '../../services/reloj'
import { recordatorios } from '../../reminders/recordatorios'
import { cancelarAvisosJuego, programarAvisosJuego } from '../../services/alarmas'
import { Barra, Confirmar, Explicacion, Hoja, Tarjeta, movimientoReducido } from '../componentes'
import { avisar, mutar, useDatos, useTic } from '../estado'
import { CasaDelJuego } from '../animaciones/Siluetas'
import { carpetaEscenas, temaActivo } from '../../temas/temas'
import { JuegoHada } from '../animaciones/JuegoHada'
import { emitirEvento } from '../../temas/eventos'
import { JuegoShinobi } from '../../temas/shinobi/Escenas'
import { CLASE_JUEGO_CORRIENDO } from '../FondoLluvia'

export function Juego({ hoy }: { hoy: string }) {
  const tic = useTic(1000)
  const datos = useDatos(async () => ({ resumen: await resumenJuego(hoy), historial: await historialJuego(3000), ajustes: await obtenerAjustes() }), [hoy])
  const [editar, setEditar] = useState<SesionJuego | null | 'nueva'>(null)
  const [borrar, setBorrar] = useState<SesionJuego | null>(null)
  const d = datos.datos
  // Con el temporizador corriendo, la lluvia del fondo va más lenta y tenue (concentración).
  const corriendo = !!d?.resumen.activa && !d.resumen.pausada
  useEffect(() => {
    document.documentElement.classList.toggle(CLASE_JUEGO_CORRIENDO, corriendo)
    return () => document.documentElement.classList.remove(CLASE_JUEGO_CORRIENDO)
  }, [corriendo])
  if (!d) return <p className="vacio">Cargando…</p>
  const { resumen: r, ajustes } = d
  const activa = r.activa
  const msSesion = activa ? duracionMs(activa, tic) : 0
  const minutosHoy = Math.round(r.minutosHoy + (activa && !r.pausada ? (tic - ahora()) / 60_000 : 0))
  const estado = minutosHoy >= r.limiteMinutos ? 'superado' : minutosHoy >= (r.limiteMinutos * ajustes.avisoJuegoPorcentaje) / 100 ? 'cerca' : 'ok'

  const iniciar = async () => {
    await mutar(iniciarJuego)
    emitirEvento('jugar')
    // Avisos de Más → Alarmas (Notificación, Alarma o Nada), según lo que queda hoy.
    await programarAvisosJuego(r.minutosHoy, r.limiteMinutos)
    recordatorios.pedirPermiso()
  }
  const pausar = async () => {
    emitirEvento('pausa')
    await mutar(pausarJuego)
    await cancelarAvisosJuego()
  }
  const reanudar = async () => {
    emitirEvento('jugar')
    await mutar(reanudarJuego)
    await programarAvisosJuego(minutosHoy, r.limiteMinutos)
  }
  const finalizar = async () => {
    await mutar(() => finalizarJuego())
    await cancelarAvisosJuego()
    avisar('Sesión guardada')
  }

  return (
    <>
      <h1 className="juego-titulo"><span className="juego-kanji" aria-hidden>遊</span>Juego</h1>
      <Tarjeta compacta>
        <div className="fila entre">
          <span className="seccion-titulo">Temporizador de juego</span>
          <Explicacion titulo="Cómo funciona">
            <p>Es manual: iniciás, pausás y finalizás. La sesión activa queda guardada en el teléfono, así que cerrar la app no la pierde.</p>
            <p className="texto-2 chico">Registrar el juego no da XP. Respetar el límite del día ({r.limiteMinutos} min hoy: {ajustes.limiteJuegoSemana} de lunes a viernes, {ajustes.limiteJuegoFinde} sábados, domingos y feriados) sí, y se resuelve al cerrar el día. Los avisos del límite se eligen en Más → Alarmas (Notificación, Alarma o Nada).</p>
          </Explicacion>
        </div>
        <div className="juego-temporizador">
          {/* El ensō se va cerrando con los minutos de hoy contra el límite */}
          <Enso progreso={minutosHoy / Math.max(1, r.limiteMinutos)} estado={estado}>
            <div className={`juego-segundos ${estado === 'superado' ? 'bajo' : estado === 'cerca' ? 'medio' : ''}`}>{activa ? tiempo(msSesion) : '00:00'}</div>
          </Enso>
          <div className="juego-lado">
            <div className="texto-3 muy-chico">{activa ? (r.pausada ? 'En pausa' : `Jugando desde las ${formatoHora(activa.inicio, ajustes.zonaHoraria)}`) : 'Sin sesión activa'}</div>
            {!activa && <button className="boton primario pincel" onClick={iniciar}>▶ Iniciar</button>}
            {activa && (
              <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
                {r.pausada ? <button className="boton pincel" onClick={() => void reanudar()}>▶ Reanudar</button> : <button className="boton pincel" onClick={() => void pausar()}>❚❚ Pausar</button>}
                <button className="boton peligro pincel" onClick={finalizar}>■ Finalizar</button>
              </div>
            )}
          </div>
        </div>
        {/* La casa, enmarcada como un shōji: pelean hasta que empezás a jugar; jugando, concentrados; en pausa, té. */}
        <div className="juego-shoji">{carpetaEscenas() ? <JuegoShinobi activa={!!activa} pausada={!!r.pausada} reducido={movimientoReducido()} /> : temaActivo().propio ? <JuegoHada activa={!!activa} pausada={!!r.pausada} reducido={movimientoReducido()} /> : <CasaDelJuego activa={!!activa} pausada={!!r.pausada} />}</div>
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
        <HistorialPorDia historial={d.historial} zona={ajustes.zonaHoraria} hoy={hoy} tic={tic} onEditar={setEditar} onBorrar={setBorrar} />
      </Tarjeta>

      {editar && <EditarSesion sesion={editar === 'nueva' ? null : editar} zona={ajustes.zonaHoraria} hoy={hoy} onCerrar={() => setEditar(null)} />}
      <Confirmar abierta={!!borrar} titulo="¿Borrar esta sesión?" texto="Queda registrado en el historial que se borró." confirmar="Borrar" peligro onConfirmar={() => { mutar(() => borrarSesion(borrar!.id!, 'Borrada desde Juego')); setBorrar(null) }} onCancelar={() => setBorrar(null)} />
    </>
  )
}

/** Círculo a pincel (ensō) que se cierra con el progreso (0 a 1): un trazo grueso con borde seco y el resto fantasma. */
function Enso({ progreso, estado, children }: { progreso: number; estado: 'ok' | 'cerca' | 'superado'; children: ReactNode }) {
  const p = Math.max(0.07, Math.min(1, progreso))
  const r = 40
  const a0 = -100
  const a1 = a0 + p * 345
  const punto = (a: number) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)]
  const [x0, y0] = punto(a0)
  const [x1, y1] = punto(a1)
  const d = `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
  return (
    <div className={`enso ${estado}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className="enso-fantasma" />
        <path d={d} className="enso-trazo" />
        {p > 0.15 && <path d={d} className="enso-seco" />}
      </svg>
      <div className="enso-centro">{children}</div>
    </div>
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

/** Historial agrupado por día: una barra desplegable por día (solo una abierta) y un buscador de fecha arriba. */
function HistorialPorDia({ historial, zona, hoy, tic, onEditar, onBorrar }: {
  historial: SesionJuego[]
  zona: string
  hoy: string
  tic: number
  onEditar: (s: SesionJuego) => void
  onBorrar: (s: SesionJuego) => void
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [buscada, setBuscada] = useState(hoy)
  const [cuantos, setCuantos] = useState(7)
  const [sinJuego, setSinJuego] = useState<string | null>(null)
  const dias: { fecha: string; sesiones: SesionJuego[] }[] = []
  for (const s of historial) {
    const f = fechaDe(s.inicio, zona)
    const ult = dias[dias.length - 1]
    if (ult && ult.fecha === f) ult.sesiones.push(s)
    else dias.push({ fecha: f, sesiones: [s] })
  }
  const buscar = (f: string) => {
    setBuscada(f)
    if (!f) return
    const i = dias.findIndex((x) => x.fecha === f)
    if (i < 0) { setSinJuego(f); setAbierto(null); return }
    setSinJuego(null)
    setAbierto(f)
    if (i >= cuantos) setCuantos(i + 1)
    window.setTimeout(() => document.getElementById(`hj-${f}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }
  if (historial.length === 0) return <p className="vacio">Todavía no hay sesiones.</p>
  return (
    <div className="hj">
      <label className="hj-buscar">
        <span className="texto-3 chico">Buscar día</span>
        <input type="date" value={buscada} max={hoy} onChange={(e) => buscar(e.target.value)} />
      </label>
      {sinJuego && <p className="vacio hj-sin">Sin juego ese día ({fechaLegible(sinJuego)}).</p>}
      {dias.slice(0, cuantos).map((dia) => {
        const abiertoEste = abierto === dia.fecha
        const min = dia.sesiones.reduce((t, s) => t + duracionMs(s, tic), 0) / 60_000
        const n = dia.sesiones.length
        return (
          <div key={dia.fecha} id={`hj-${dia.fecha}`} className={`hj-dia ${abiertoEste ? 'abierto' : ''}`}>
            <button type="button" className="hj-barra" aria-expanded={abiertoEste} onClick={() => setAbierto(abiertoEste ? null : dia.fecha)}>
              <span>{fechaLegible(dia.fecha)}{dia.fecha === hoy ? ' · hoy' : ''}</span>
              <span className="texto-3">{duracionLegible(min)} · {n} {n === 1 ? 'sesión' : 'sesiones'}</span>
              <span className="hj-flecha" aria-hidden>▾</span>
            </button>
            {abiertoEste && (
              <div className="hj-sesiones">
                {dia.sesiones.map((s) => {
                  const ms = duracionMs(s, tic)
                  return (
                    <div key={s.id} className={`fila entre chico hj-sesion ${s.fin && ms < 60_000 ? 'cero' : ''}`}>
                      <div>
                        <div>{formatoHora(s.inicio, zona)}–{s.fin ? formatoHora(s.fin, zona) : '…'}</div>
                        <div className="texto-3 muy-chico">{s.corregida && 'corregida · '}{s.pausas.length > 0 && `${s.pausas.length} pausa${s.pausas.length > 1 ? 's' : ''} · `}{s.nota}</div>
                      </div>
                      <div className="fila" style={{ gap: 4 }}>
                        <b className="mono">{duracionLegible(ms / 60_000)}</b>
                        {s.fin && <button className="boton chico suave" onClick={() => onEditar(s)} aria-label="Corregir">✎</button>}
                        <button className="boton chico suave" onClick={() => onBorrar(s)} aria-label="Borrar">🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {dias.length > cuantos && <button type="button" className="boton chico suave hj-mas" onClick={() => setCuantos((c) => c + 7)}>Ver más</button>}
    </div>
  )
}
