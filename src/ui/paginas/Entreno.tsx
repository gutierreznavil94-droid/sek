/**
 * Modo entreno: con el celu en la mano. Un bloque a la vez, letras y botones
 * grandes, descanso con sombra / descansá / acomodá, temporizadores para el
 * calentamiento, colgarse y el kick boxing. Si la app se cierra, vuelve donde estaba.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BloqueEjercicio, BloqueRutina, Rutina, SerieHecha, SesionEntreno } from '../../data/tipos'
import {
  TOPE_XP_EXTRA,
  alargarDescanso,
  bloqueTerminado,
  descartarEntreno,
  deshacerSerie,
  faseActual,
  iniciarEntreno,
  iniciarReloj,
  irABloque,
  kg,
  listarRutinas,
  marcarBloque,
  moverBloque,
  pararReloj,
  reabrirEntreno,
  registrarSerie,
  rondaActual,
  rutinaDelDia,
  saltarBloque,
  seriesDe,
  sesionEnCurso,
  sugerencia,
  terminarDescanso,
  terminarEntreno,
  ultimaVez,
  type ResultadoTerminar,
} from '../../services/entreno'
import { ahora } from '../../services/reloj'
import { celebrarNivel, celebrarRecord } from '../animaciones/logros'
import { Avisos, Confirmar, Hoja } from '../componentes'
import { avisar, mutar, useDatos, useTic } from '../estado'

function vibrar(patron: number | number[]) {
  try { if ('vibrate' in navigator) navigator.vibrate(patron) } catch { /* sin vibración */ }
}

function reloj(seg: number): string {
  const s = Math.max(0, Math.ceil(seg))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Mantiene la pantalla encendida mientras hay un entreno en curso. */
function usePantallaDespierta(activo: boolean) {
  useEffect(() => {
    if (!activo) return
    type Bloqueo = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Bloqueo> } }
    if (!nav.wakeLock) return
    let bloqueo: Bloqueo | null = null
    const pedir = () => { nav.wakeLock!.request('screen').then((b) => { bloqueo = b }).catch(() => {}) }
    pedir()
    const alVolver = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      bloqueo?.release().catch(() => {})
    }
  }, [activo])
}

async function cargar(hoy: string) {
  const sesion = await sesionEnCurso()
  const rutinas = await listarRutinas()
  const delDia = await rutinaDelDia(hoy)
  const rutina = sesion ? rutinas.find((r) => r.id === sesion.rutinaId) ?? null : null
  let anterior: SerieHecha[] = []
  const bloque = sesion && rutina ? rutina.bloques.find((b) => b.id === sesion.orden[sesion.paso]) : undefined
  if (sesion && bloque?.tipo === 'ejercicio') anterior = await ultimaVez(sesion.rutinaId, bloque.id, sesion.id)
  return { sesion: sesion ?? null, rutinas, delDia: delDia ?? null, rutina, anterior }
}

export function Entreno({ hoy }: { hoy: string }) {
  const datos = useDatos(() => cargar(hoy), [hoy])
  const [resultado, setResultado] = useState<ResultadoTerminar | null>(null)
  const d = datos.datos
  usePantallaDespierta(!!d?.sesion)
  return (
    <div className="app entreno-app">
      <main className="contenido entreno">
        {resultado ? <Resumen r={resultado} rutina={d?.rutinas.find((x) => x.id === resultado.sesion.rutinaId)} onReabrir={async () => { await mutar(() => reabrirEntreno(resultado.sesion.id!)); setResultado(null) }} />
          : !d ? <p className="vacio">Cargando…</p>
          : d.sesion && d.rutina ? <EnCurso s={d.sesion} r={d.rutina} anterior={d.anterior} onTerminado={setResultado} />
          : <Empezar hoy={hoy} rutinas={d.rutinas} delDia={d.delDia} />}
      </main>
      <Avisos />
    </div>
  )
}

// ---------- Antes de empezar ----------

function Empezar({ hoy, rutinas, delDia }: { hoy: string; rutinas: Rutina[]; delDia: Rutina | null }) {
  const [elegida, setElegida] = useState(delDia?.id ?? rutinas[0]?.id)
  const r = rutinas.find((x) => x.id === elegida)
  const n = r?.bloques.filter((b) => b.tipo === 'ejercicio').length ?? 0
  return (
    <>
      <div className="fila entre">
        <Link to="/" className="texto-2">‹ Hoy</Link>
        <Link to="/mas/rutinas" className="texto-2 chico">Editar rutinas</Link>
      </div>
      <div className="col" style={{ gap: 4 }}>
        <span className="seccion-titulo">{delDia ? 'Hoy toca' : 'Hoy es día libre'}</span>
        <h1 className="entreno-titulo">{r?.nombre ?? 'Sin rutinas'}</h1>
        {r && <span className="texto-2">~{r.minutos} min · {n} ejercicios · {r.bloques.length} bloques</span>}
      </div>
      <div className="chips">
        {rutinas.map((x) => <button key={x.id} className={x.id === elegida ? 'activo' : ''} onClick={() => setElegida(x.id)}>{x.nombre.split(' · ')[0]}</button>)}
      </div>
      {r && (
        <ol className="entreno-lista">
          {r.bloques.map((b) => (
            <li key={b.id}><span className="crece">{b.nombre}{b.tipo === 'ejercicio' && b.grupo && <span className="texto-3"> · {b.grupo}</span>}</span><span className="texto-3 mono chico">{resumenBloque(b)}</span></li>
          ))}
        </ol>
      )}
      {r && <button className="boton primario grande ancho entreno-empezar" onClick={() => mutar(() => iniciarEntreno(r.id, hoy))}>Empezar entreno</button>}
    </>
  )
}

function resumenBloque(b: BloqueRutina): string {
  switch (b.tipo) {
    case 'ejercicio': return `${b.series} × ${b.reps}${b.repsExtra ? `+${b.repsExtra}` : ''} · ${b.peso ? `${String(b.peso).replace('.', ',')} kg` : 'corporal'}`
    case 'rondas': return `${b.rondas.length} × ${reloj(b.rondas[0]?.segundos ?? 0)}`
    case 'casilla': return '✓'
    default: return `${b.veces && b.veces > 1 ? `${b.veces} × ` : ''}${reloj(b.segundos)}${b.peso ? ` · ${b.peso} kg` : ''}`
  }
}

// ---------- En curso ----------

function EnCurso({ s, r, anterior, onTerminado }: { s: SesionEntreno; r: Rutina; anterior: SerieHecha[]; onTerminado: (x: ResultadoTerminar) => void }) {
  const tic = useTic(250)
  const t = Math.max(tic, ahora())
  const [bloques, setBloques] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const bloque = r.bloques.find((b) => b.id === s.orden[s.paso])
  const fase = s.descanso ? faseActual(s.descanso, t) : null
  const hechos = s.orden.filter((id) => { const b = r.bloques.find((x) => x.id === id); return b && bloqueTerminado(s, b) }).length

  // Vibración suave al cambiar de fase del descanso y al terminarlo.
  const clave = s.descanso ? `${s.descanso.inicio}:${fase?.indice ?? 'fin'}` : null
  const previa = useRef<string | null>(null)
  useEffect(() => {
    if (previa.current && clave && previa.current !== clave && previa.current.split(':')[0] === clave.split(':')[0]) vibrar(clave.endsWith('fin') ? [200, 100, 200] : 200)
    previa.current = clave
  }, [clave])

  const terminar = async () => {
    const x = await mutar(() => terminarEntreno(s.id!))
    const records = x.resumen.ejercicios.filter((e) => e.record).map((e) => e.nombre)
    celebrarRecord(records)
    celebrarNivel(x.nuevoNivel)
    vibrar([100, 60, 100, 60, 300])
    onTerminado(x)
  }

  return (
    <>
      <div className="fila entre entreno-cab">
        <Link to="/" className="texto-2">‹ Hoy</Link>
        <span className="mono texto-2">{reloj((t - s.inicio) / 1000)}</span>
        <button className="boton chico suave" onClick={() => setBloques(true)}>Bloques {hechos}/{s.orden.length}</button>
      </div>
      <div className="entreno-puntos" aria-hidden>
        {s.orden.map((id, i) => { const b = r.bloques.find((x) => x.id === id); return <span key={id} className={`${b && bloqueTerminado(s, b) ? (s.saltados.includes(id) ? 'saltado' : 'hecho') : ''} ${i === s.paso ? 'actual' : ''}`} /> })}
      </div>
      <div className="texto-3 chico">{r.nombre}</div>

      {s.descanso && fase ? (
        <Descanso s={s} fase={fase} r={r} />
      ) : !bloque ? (
        <section className="entreno-fin col">
          <span className="entreno-k" aria-hidden>鍛</span>
          <h1 className="entreno-titulo">Todo hecho</h1>
          <p className="texto-2">{s.series.length} series anotadas. Terminá para guardar y marcar el pilar.</p>
          <button className="boton primario grande ancho" onClick={terminar}>Terminar entreno</button>
          {s.series.length > 0 && <button className="boton suave" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer la última serie</button>}
        </section>
      ) : bloque.tipo === 'ejercicio' ? (
        <Ejercicio key={`${bloque.id}:${seriesDe(s, bloque.id).length}`} s={s} b={bloque} anterior={anterior} />
      ) : bloque.tipo === 'casilla' ? (
        <section className="col entreno-bloque">
          <span className="seccion-titulo">Para cerrar</span>
          <h1 className="entreno-titulo">{bloque.nombre}</h1>
          {bloque.nota && <p className="entreno-nota">{bloque.nota}</p>}
          <button className="entreno-casilla" onClick={() => mutar(() => marcarBloque(s.id!, bloque.id))}><span className="caja" aria-hidden>✓</span> Listo, estiré</button>
        </section>
      ) : (
        <Temporizador key={bloque.id} s={s} b={bloque} t={t} />
      )}

      {bloque && !(s.descanso && fase) && (
        <div className="fila entre entreno-pie">
          <button className="enlace texto-3" onClick={() => mutar(() => saltarBloque(s.id!, bloque.id))}>Saltar {bloque.tipo === 'ejercicio' ? 'ejercicio' : 'bloque'}</button>
          {s.series.length > 0 && bloque.tipo === 'ejercicio' && <button className="enlace texto-3" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer serie</button>}
        </div>
      )}

      <Hoja abierta={bloques} onCerrar={() => setBloques(false)} titulo="Bloques de hoy">
        <p className="ayuda">Tocá uno para ir. Con las flechas cambiás el orden.</p>
        <ol className="entreno-lista editable">
          {s.orden.map((id, i) => {
            const b = r.bloques.find((x) => x.id === id)
            if (!b) return null
            const listo = bloqueTerminado(s, b)
            return (
              <li key={id} className={i === s.paso ? 'actual' : ''}>
                <button className="crece entreno-ir" onClick={() => { void mutar(() => irABloque(s.id!, id)); setBloques(false) }}>
                  <span className={listo ? (s.saltados.includes(id) ? 'texto-3 tachado' : 'texto-3') : ''}>{listo && !s.saltados.includes(id) ? '✓ ' : ''}{b.nombre}</span>
                  {b.tipo === 'ejercicio' && <span className="texto-3 mono chico"> {seriesDe(s, id).length}/{b.series}</span>}
                </button>
                <button className="boton chico suave" aria-label="Subir" disabled={i === 0} onClick={() => mutar(() => moverBloque(s.id!, id, -1))}>↑</button>
                <button className="boton chico suave" aria-label="Bajar" disabled={i === s.orden.length - 1} onClick={() => mutar(() => moverBloque(s.id!, id, 1))}>↓</button>
              </li>
            )
          })}
        </ol>
        <div className="botonera">
          <button className="boton" onClick={() => { setBloques(false); void terminar() }}>Terminar ya</button>
          <button className="boton peligro" onClick={() => setDescartar(true)}>Descartar</button>
        </div>
      </Hoja>
      <Confirmar abierta={descartar} titulo="¿Descartar el entreno?" texto="Se borran las series de hoy y el pilar vuelve a pendiente." confirmar="Descartar" peligro onCancelar={() => setDescartar(false)} onConfirmar={() => { setDescartar(false); setBloques(false); void mutar(() => descartarEntreno(s.id!)) }} />
    </>
  )
}

function Stepper({ etiqueta, valor, paso, min = 0, formato, onCambio, marca }: { etiqueta: string; valor: number; paso: number; min?: number; formato?: (v: number) => string; onCambio: (v: number) => void; marca?: 'mejor' | 'igual' | null }) {
  const redondear = (v: number) => Math.round(v * 100) / 100
  return (
    <div className={`stepper ${marca ?? ''}`}>
      <span className="etiqueta">{etiqueta}</span>
      <div className="fila">
        <button className="boton grande" aria-label={`Menos ${etiqueta}`} onClick={() => onCambio(Math.max(min, redondear(valor - paso)))}>−</button>
        <span className="valor mono">{formato ? formato(valor) : valor}</span>
        <button className="boton grande" aria-label={`Más ${etiqueta}`} onClick={() => onCambio(redondear(valor + paso))}>+</button>
      </div>
    </div>
  )
}

function textoSeries(series: SerieHecha[]): string {
  if (!series.length) return ''
  const peso = series[0].peso
  const mismoPeso = series.every((x) => x.peso === peso)
  const reps = series.map((x) => `${x.reps}${x.repsExtra ? `+${x.repsExtra}` : ''}`).join(' · ')
  return mismoPeso ? `${reps} reps · ${kg(peso)}` : series.map((x) => `${x.reps} × ${kg(x.peso)}`).join(' · ')
}

function Ejercicio({ s, b, anterior }: { s: SesionEntreno; b: BloqueEjercicio; anterior: SerieHecha[] }) {
  const hechas = seriesDe(s, b.id)
  const n = hechas.length + 1
  const sug = sugerencia(b, anterior)
  const previaHoy = hechas[hechas.length - 1]
  const laVezPasada = anterior.find((x) => x.n === n) ?? anterior[anterior.length - 1]
  const [reps, setReps] = useState(previaHoy?.reps ?? sug.reps)
  const [extra, setExtra] = useState(previaHoy?.repsExtra ?? laVezPasada?.repsExtra ?? b.repsExtra ?? 0)
  const [peso, setPeso] = useState(previaHoy?.peso ?? laVezPasada?.peso ?? b.peso)
  const pasoPeso = b.incremento > 0 ? b.incremento : 1
  const comparar = (a: number, ref: number | undefined) => (ref === undefined ? null : a > ref ? 'mejor' : a === ref ? 'igual' : null)
  const guardar = async () => {
    await mutar(() => registrarSerie(s.id!, b.id, { reps, repsExtra: b.repsExtra !== undefined ? extra : undefined, peso }))
    vibrar(60)
  }
  return (
    <section className="col entreno-bloque">
      <span className="seccion-titulo">{b.grupo ?? 'Ejercicio'}</span>
      <h1 className="entreno-titulo">{b.nombre}</h1>
      {b.nota && <p className="entreno-nota">«{b.nota}»</p>}
      <div className="fila entre">
        <span className="entreno-serie">Serie {Math.min(n, b.series)} de {b.series}</span>
        <span className="texto-2 mono">Objetivo {sug.reps}{b.repsExtra ? `+${b.repsExtra}` : ''} · {kg(sug.peso)}</span>
      </div>
      <p className="texto-2 chico">{anterior.length ? <>La vez pasada: <b>{textoSeries(anterior)}</b></> : 'Primera vez con la app: arranca con lo de tu planilla.'}</p>
      {sug.sube !== 'nada' && (
        <button className={`entreno-sugerencia ${sug.sube}`} onClick={() => { setReps(sug.reps); setPeso(sug.peso) }}>
          <span>{sug.sube === 'peso' ? '▲ Subí peso' : '▲ +1 rep'}</span><span className="chico">{sug.texto}</span>
        </button>
      )}
      <Stepper etiqueta="Repeticiones" valor={reps} paso={1} onCambio={setReps} marca={comparar(reps, laVezPasada?.reps)} />
      {b.repsExtra !== undefined && <Stepper etiqueta="Extra" valor={extra} paso={1} formato={(v) => `+${v}`} onCambio={setExtra} marca={comparar(extra, laVezPasada?.repsExtra)} />}
      <Stepper etiqueta="Peso" valor={peso} paso={pasoPeso} formato={(v) => (v === 0 ? 'corporal' : `${String(v).replace('.', ',')} kg`)} onCambio={setPeso} marca={comparar(peso, laVezPasada?.peso)} />
      <button className="boton primario grande ancho entreno-hecha" onClick={guardar}>Serie hecha</button>
      {hechas.length > 0 && (
        <div className="entreno-hoy chico">
          {hechas.map((x) => {
            const ref = anterior.find((a) => a.n === x.n)
            const tot = (y: SerieHecha) => y.reps + (y.repsExtra ?? 0)
            const m = !ref ? '' : x.peso > ref.peso || (x.peso === ref.peso && tot(x) > tot(ref)) ? 'mejor' : x.peso === ref.peso && tot(x) === tot(ref) ? 'igual' : ''
            return <span key={x.n} className={`marca ${m}`}>S{x.n}: {x.reps}{x.repsExtra ? `+${x.repsExtra}` : ''} × {kg(x.peso)}</span>
          })}
        </div>
      )}
    </section>
  )
}

function Descanso({ s, fase, r }: { s: SesionEntreno; fase: NonNullable<ReturnType<typeof faseActual>>; r: Rutina }) {
  const f = fase.fase
  const proximo = r.bloques.find((b) => b.id === s.orden[s.paso])
  const n = proximo?.tipo === 'ejercicio' ? seriesDe(s, proximo.id).length + 1 : 0
  const pct = Math.max(0, Math.min(100, (fase.restante / f.segundos) * 100))
  return (
    <section className={`col entreno-descanso ${f.tipo}`} aria-live="polite">
      <span className="seccion-titulo">{f.tipo === 'sombra' ? 'Descanso · primero sombra' : f.tipo === 'acomodar' ? 'Descanso · ejercicio terminado' : 'Descanso'}</span>
      <h1 className="entreno-fase">{f.tipo === 'acomodar' ? 'Acomodá para el siguiente' : f.texto}</h1>
      {f.tipo === 'acomodar' && <p className="entreno-nota grande">{f.texto.replace('Acomodá para el siguiente: ', '')}</p>}
      <div className="entreno-reloj mono">{reloj(fase.restante)}</div>
      <div className="entreno-barra"><div style={{ width: `${pct}%` }} /></div>
      <div className="entreno-fases">
        {s.descanso!.fases.map((x, i) => <span key={i} className={`${x.tipo} ${i === fase.indice ? 'actual' : i < fase.indice ? 'paso' : ''}`} style={{ flex: x.segundos }}>{x.tipo === 'sombra' ? 'Sombra' : x.tipo === 'acomodar' ? 'Acomodar' : 'Descansá'} {reloj(x.segundos)}</span>)}
      </div>
      <p className="texto-2 centro">Descanso total: {reloj(fase.totalRestante)}{proximo ? <> · después: <b>{proximo.nombre}{n ? ` · serie ${n}` : ''}</b></> : null}</p>
      <div className="botonera">
        <button className="boton grande" onClick={() => mutar(() => alargarDescanso(s.id!, 30))}>+30 s</button>
        <button className="boton grande primario" onClick={() => mutar(() => terminarDescanso(s.id!))}>Saltar descanso</button>
      </div>
      <button className="enlace texto-3" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer la serie</button>
    </section>
  )
}

function Temporizador({ s, b, t }: { s: SesionEntreno; b: Exclude<BloqueRutina, BloqueEjercicio | { tipo: 'casilla' }>; t: number }) {
  const corriendo = s.reloj?.bloqueId === b.id ? s.reloj : undefined
  const rondas = b.tipo === 'rondas' ? b.rondas : Array.from({ length: b.veces ?? 1 }, () => ({ segundos: b.segundos, texto: '' }))
  const ronda = corriendo ? rondaActual(rondas, corriendo.inicio, t) : null
  const termino = !!corriendo && !ronda
  // Vibra entre rondas y al terminar; al terminar, el bloque queda hecho solo.
  const claveRonda = corriendo ? `${corriendo.inicio}:${ronda?.indice ?? 'fin'}` : null
  const previa = useRef<string | null>(null)
  useEffect(() => {
    if (previa.current && claveRonda && previa.current !== claveRonda) vibrar(claveRonda.endsWith('fin') ? [300, 120, 300] : [200, 100, 200])
    previa.current = claveRonda
  }, [claveRonda])
  useEffect(() => {
    if (termino) void mutar(() => marcarBloque(s.id!, b.id)).then(() => avisar(`${b.nombre}: listo`, { tipo: 'ok' }))
  }, [termino, s.id, b.id, b.nombre])
  const total = rondas.reduce((x, y) => x + y.segundos, 0)
  const actual = ronda ? rondas[ronda.indice] : rondas[0]
  const pct = ronda ? (ronda.restante / actual.segundos) * 100 : 100
  return (
    <section className={`col entreno-bloque entreno-timer ${b.tipo}`}>
      <span className="seccion-titulo">{b.tipo === 'calentamiento' ? 'Para arrancar' : b.tipo === 'rondas' ? 'Rondas' : (b.nota ?? 'Temporizador')}</span>
      <h1 className="entreno-titulo">{b.nombre}</h1>
      {b.tipo !== 'rondas' && (b.nota || b.peso) && <p className="entreno-nota">{[b.tipo === 'calentamiento' ? b.nota : null, b.peso ? `con ${b.peso} kg` : null, b.veces ? `${b.veces} vez` : null].filter(Boolean).join(' · ')}</p>}
      {b.tipo === 'rondas' && (
        <div className="col" style={{ gap: 6 }}>
          {b.rondas.map((x, i) => (
            <div key={i} className={`entreno-ronda ${ronda?.indice === i ? 'actual' : ronda && i < ronda.indice ? 'paso' : ''}`}>
              <span className="mono">R{i + 1} · {reloj(x.segundos)}</span><span>{x.texto}</span>
            </div>
          ))}
        </div>
      )}
      <div className="entreno-reloj mono">{reloj(ronda ? ronda.restante : actual.segundos)}</div>
      <div className="entreno-barra"><div style={{ width: `${pct}%` }} /></div>
      {b.tipo === 'rondas' && ronda && <p className="entreno-fase centro">Ronda {ronda.indice + 1} de {rondas.length}: {actual.texto}</p>}
      {!corriendo ? (
        <button className="boton primario grande ancho" onClick={() => mutar(() => iniciarReloj(s.id!, b.id))}>Empezar · {reloj(total)}</button>
      ) : (
        <div className="botonera">
          <button className="boton grande" onClick={() => mutar(() => pararReloj(s.id!))}>Reiniciar</button>
          <button className="boton grande ok" onClick={() => mutar(() => marcarBloque(s.id!, b.id))}>Listo</button>
        </div>
      )}
    </section>
  )
}

// ---------- Resumen ----------

function Resumen({ r, rutina, onReabrir }: { r: ResultadoTerminar; rutina?: Rutina; onReabrir: () => void }) {
  const navegar = useNavigate()
  const x = r.resumen
  const records = x.ejercicios.filter((e) => e.record)
  return (
    <section className="col entreno-resumen" style={{ gap: 14 }}>
      <span className="entreno-k" aria-hidden>鍛</span>
      <h1 className="entreno-titulo centro">Entreno terminado</h1>
      <p className="texto-2 centro">{rutina?.nombre}</p>
      <div className="entreno-stats">
        <div><b className="mono">{x.minutos}</b><span>min</span></div>
        <div><b className="mono">{x.series}</b><span>series</span></div>
        <div><b className="mono">{x.volumen.toLocaleString('es-AR')}</b><span>kg de volumen</span></div>
        <div><b className="mono">{records.length}</b><span>récords</span></div>
      </div>
      <div className="tarjeta compacta col">
        <div className="fila entre"><span>Pilar Entrenamiento</span><b className="mono">{r.xpPilar > 0 ? `+${r.xpPilar} XP` : '—'}</b></div>
        <div className="fila entre"><span>Por mejorar <span className="texto-3 chico">(+5 mejora · +10 récord)</span></span><b className="mono">{x.xpExtra > 0 ? `+${x.xpExtra} XP` : '—'}</b></div>
        {x.xpSinTope > x.xpExtra && <p className="ayuda">Llegaste al tope de {TOPE_XP_EXTRA} XP extra por entreno (sumabas {x.xpSinTope}).</p>}
        {r.motivoSinXp && <p className="ayuda">{r.motivoSinXp}</p>}
      </div>
      <ul className="entreno-lista">
        {x.ejercicios.map((e) => (
          <li key={e.bloqueId} className={e.mejora || e.record ? 'mejor' : e.igual ? 'igual' : ''}>
            <span className="crece">{e.record ? '★ ' : e.mejora ? '▲ ' : e.igual ? '= ' : ''}{e.nombre}</span>
            <span className="mono chico">{e.marca.repsTotal} reps · {kg(e.marca.peso)}</span>
          </li>
        ))}
      </ul>
      <p className="ayuda centro">Verde: superaste la vez pasada · gris: igualaste · ★ récord personal.</p>
      <button className="boton primario grande ancho" onClick={() => navegar('/')}>Volver a Hoy</button>
      <button className="enlace texto-3 centro" onClick={onReabrir}>Reabrir para corregir una serie</button>
    </section>
  )
}
