/**
 * Modo entreno: con el celu en la mano. Un bloque a la vez, letras y botones
 * grandes, descanso con sombra / descansá / acomodá, temporizadores para el
 * calentamiento, colgarse y el kick boxing. Si la app se cierra, vuelve donde estaba.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import type { BloqueEjercicio, BloqueRutina, BloqueTemporizador, Rutina, SerieHecha, SesionEntreno, TiempoHecho } from '../../data/tipos'
import {
  TOPE_XP_EXTRA,
  alargarDescanso,
  bloqueTerminado,
  corregirSerie,
  DESCUENTO_S,
  PREPARACION_S,
  descartarEntreno,
  duracionEntreno,
  estadoCronometro,
  historialTiempo,
  terminarCronometro,
  fijarObjetivoCronometro,
  fijarPeso,
  deshacerSerie,
  faseActual,
  AVISO_FIN_DESCANSO_S,
  historialEjercicio,
  saltarPreparacion,
  tramosRondas,
  type Marca,
  iniciarEntreno,
  inicioTarde,
  iniciarReloj,
  irABloque,
  kg,
  listarRutinas,
  marcarBloque,
  moverBloque,
  objetivoSerie,
  pesoInicial,
  pararReloj,
  reabrirEntreno,
  reiniciarEntreno,
  registrarSerie,
  rondaActual,
  rutinaDelDia,
  saltarBloque,
  seriesDe,
  sesionEnCurso,
  siguienteDistinto,
  sugerencia,
  terminarDescanso,
  terminarEntreno,
  ultimaVez,
  type ResultadoTerminar,
} from '../../services/entreno'
import { db } from '../../data/db'
import { obtenerAjustes } from '../../services/base'
import { ahora } from '../../services/reloj'
import { celebrarNivel, celebrarRecord } from '../animaciones/logros'
import { animar, sonarTaiko } from '../animaciones/motor'
import { Avisos, Confirmar, Hoja } from '../componentes'
import { AguadaFondo, TintaPolvo } from '../TintaPolvo'
import { FondoLluvia } from '../FondoLluvia'
import { ShinobiBarra } from '../Shinobi'
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

type Siguiente = { bloque: BloqueRutina; peso: number; reps: number }
export type Contexto = {
  /** La vez pasada del ejercicio actual. */
  anterior: SerieHecha[]
  /** La última serie anotada y la vez pasada de su ejercicio (para «¿Cuántas hiciste?» en el descanso). */
  ultima?: { serie: SerieHecha; bloque: BloqueEjercicio; anterior: SerieHecha[] }
  /** Lo que sigue después del ejercicio de la última serie (descanso) y del bloque actual. */
  sigueDescanso?: Siguiente
  sigueActual?: Siguiente
  /** Cronómetro actual (colgarse): la vez pasada y el récord. */
  tiempo?: { ultimo: TiempoHecho | null; record: TiempoHecho | null }
  /** Récord del ejercicio actual (serie 1: más peso, o mismo peso y más reps limpias). */
  record?: Marca | null
}

async function siguiente(s: SesionEntreno, r: Rutina, desdeId?: string): Promise<Siguiente | undefined> {
  return comoSiguiente(s, siguienteDistinto(s, r, desdeId))
}

async function comoSiguiente(s: SesionEntreno, b: BloqueRutina | undefined): Promise<Siguiente | undefined> {
  if (!b) return undefined
  if (b.tipo !== 'ejercicio') return { bloque: b, peso: 0, reps: 0 }
  const ult = await ultimaVez(s.rutinaId, b.id, s.id)
  const peso = s.pesos?.[b.id] ?? pesoInicial(b, ult)
  return { bloque: b, peso, reps: objetivoSerie(b, ult, 1, peso) }
}

async function cargar(hoy: string) {
  const sesion = await sesionEnCurso()
  const rutinas = await listarRutinas()
  const delDia = await rutinaDelDia(hoy)
  const rutina = sesion ? rutinas.find((r) => r.id === sesion.rutinaId) ?? null : null
  const ctx: Contexto = { anterior: [] }
  if (sesion && rutina) {
    const bloque = rutina.bloques.find((b) => b.id === sesion.orden[sesion.paso])
    if (bloque?.tipo === 'ejercicio') {
      ctx.anterior = await ultimaVez(sesion.rutinaId, bloque.id, sesion.id)
      ctx.record = (await historialEjercicio(bloque.id)).record
    }
    const serie = sesion.series[sesion.series.length - 1]
    const bu = serie && rutina.bloques.find((b) => b.id === serie.bloqueId)
    if (serie && bu?.tipo === 'ejercicio') {
      ctx.ultima = { serie, bloque: bu, anterior: await ultimaVez(sesion.rutinaId, bu.id, sesion.id) }
      ctx.sigueDescanso = await siguiente(sesion, rutina, bu.id)
    }
    if (bloque) ctx.sigueActual = await siguiente(sesion, rutina, bloque.id)
    // Descanso después de colgarse: no es de una serie; lo que sigue es el bloque actual.
    if (sesion.descanso?.origen) {
      ctx.ultima = undefined
      ctx.sigueDescanso = await comoSiguiente(sesion, bloque)
    }
    if (bloque?.tipo === 'temporizador' && bloque.modo === 'cronometro') ctx.tiempo = await historialTiempo(bloque.nombre, sesion.id)
  }
  // Hora límite para empezar (19:35): si ya pasó, se avisa antes de empezar.
  const limiteInicio = (await db().acciones.get('entrenamiento'))?.horaLimiteInicio ?? null
  const tarde = !sesion && limiteInicio && (await db().compromisos.get(`entrenamiento:${hoy}`)) ? await inicioTarde(hoy, ahora()) : null
  return { sesion: sesion ?? null, rutinas, delDia: delDia ?? null, rutina, ctx, limiteInicio, tarde }
}

export function Entreno({ hoy }: { hoy: string }) {
  const datos = useDatos(() => cargar(hoy), [hoy])
  const [resultado, setResultado] = useState<ResultadoTerminar | null>(null)
  const d = datos.datos
  usePantallaDespierta(!!d?.sesion)
  return (
    <div className="app entreno-app">
      {!d?.sesion && <LluviaEntreno />}
      <main className="contenido entreno">
        {resultado ? <Resumen r={resultado} rutina={d?.rutinas.find((x) => x.id === resultado.sesion.rutinaId)} onReabrir={async () => { await mutar(() => reabrirEntreno(resultado.sesion.id!)); setResultado(null) }} />
          : !d ? <p className="vacio">Cargando…</p>
          : d.sesion && d.rutina ? <EnCurso s={d.sesion} r={d.rutina} ctx={d.ctx} onTerminado={setResultado} />
          : <Empezar hoy={hoy} rutinas={d.rutinas} delDia={d.delDia} limiteInicio={d.limiteInicio} tarde={d.tarde} />}
      </main>
      <Avisos />
    </div>
  )
}

/** Tormenta de fondo del entreno (se calma en el descanso). Apagable en Ajustes → Fondo con lluvia. */
function LluviaEntreno({ calma = false }: { calma?: boolean }) {
  const a = useDatos(() => obtenerAjustes(), [])
  if (!a.datos || a.datos.fondoLluvia?.entreno === false) return null
  return <FondoLluvia variante="entreno" calma={calma} />
}

// ---------- Antes de empezar ----------

function Empezar({ hoy, rutinas, delDia, limiteInicio, tarde }: { hoy: string; rutinas: Rutina[]; delDia: Rutina | null; limiteInicio: string | null; tarde: { minutos: number; limite: string } | null }) {
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
      {r && tarde && <p className="entreno-tarde" role="status"><b>Pasaron las {tarde.limite}:</b> el entreno cuenta, pero el pilar queda tarde (sin su XP). Las mejoras y récords se guardan igual.</p>}
      {r && !tarde && delDia && limiteInicio && <p className="ayuda centro">Empezalo hasta las {limiteInicio} para que cuente el pilar; la hora en que terminás no importa.</p>}
      {r && <button className="boton primario grande ancho entreno-empezar" onClick={() => mutar(() => iniciarEntreno(r.id, hoy))}>{tarde ? 'Empezar igual' : 'Empezar entreno'}</button>}
    </>
  )
}

function resumenBloque(b: BloqueRutina): string {
  switch (b.tipo) {
    case 'ejercicio': return `${b.series} × ${b.reps}${b.repsExtra ? (b.admiteAyuda ? ` +${b.repsExtra} ayuda` : `+${b.repsExtra}`) : ''} · ${b.peso ? `${String(b.peso).replace('.', ',')} kg` : 'corporal'}`
    case 'rondas': return `${b.rondas.length} × ${reloj(b.rondas[0]?.segundos ?? 0)}${b.rondas.length > 1 && (b.descansoEntre ?? 60) > 0 ? ` · ${reloj(b.descansoEntre ?? 60)} entre` : ''}`
    case 'casilla': return '✓'
    default: return `${b.veces && b.veces > 1 ? `${b.veces} × ` : ''}${reloj(b.segundos)}${b.peso ? ` · ${b.peso} kg` : ''}`
  }
}

// ---------- En curso ----------

function EnCurso({ s, r, ctx, onTerminado }: { s: SesionEntreno; r: Rutina; ctx: Contexto; onTerminado: (x: ResultadoTerminar) => void }) {
  const tic = useTic(250)
  const t = Math.max(tic, ahora())
  const [bloques, setBloques] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const bloque = r.bloques.find((b) => b.id === s.orden[s.paso])
  const fase = s.descanso ? faseActual(s.descanso, t) : null
  const hechos = s.orden.filter((id) => { const b = r.bloques.find((x) => x.id === id); return b && bloqueTerminado(s, b) }).length

  // Vibración suave al cambiar de fase del descanso y al terminarlo.
  const clave = s.descanso ? `${s.descanso.inicio}:${fase?.indice ?? 'fin'}` : null
  const barra = useRef<HTMLDivElement>(null)
  const [reiniciar, setReiniciar] = useState(false)
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
        <span className="mono texto-2" aria-label="Duración del entreno">{reloj(duracionEntreno(s, t))}</span>
        <button className="boton chico suave" onClick={() => setBloques(true)}>Bloques {hechos}/{s.orden.length}</button>
      </div>
      <div className="entreno-camino">
        <ShinobiBarra key={s.inicio} indice={bloque ? s.paso : s.orden.length} total={s.orden.length} barra={barra} />
        <div className="entreno-puntos" aria-hidden ref={barra}>
          {s.orden.map((id, i) => { const b = r.bloques.find((x) => x.id === id); return <span key={id} className={`${b && bloqueTerminado(s, b) ? (s.saltados.includes(id) ? 'saltado' : 'hecho') : ''} ${i === s.paso ? 'actual' : ''}`} /> })}
        </div>
      </div>
      <LineaAhora s={s} bloque={bloque} fase={fase} ctx={ctx} />
      <AguadaFondo tenue={!!(s.descanso && fase)} />
      <TintaPolvo bloque={bloque?.id ?? null} visible={!(s.descanso && fase)} tenue={!!(s.descanso && fase)} />
      <LluviaEntreno calma={!!(s.descanso && fase)} />

      {s.descanso && fase ? (
        <Descanso key={s.descanso.inicio} s={s} fase={fase} r={r} ctx={ctx} />
      ) : !bloque ? (
        <section className="entreno-fin col">
          <span className="entreno-k" aria-hidden>鍛</span>
          <h1 className="entreno-titulo">Todo hecho</h1>
          <p className="texto-2">{s.series.length} series anotadas. Terminá para guardar y marcar el pilar.</p>
          <button className="boton primario grande ancho" onClick={terminar}>Terminar entreno</button>
          {s.series.length > 0 && <button className="boton suave" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer la última serie</button>}
        </section>
      ) : bloque.tipo === 'ejercicio' ? (
        <Ejercicio key={`${bloque.id}:${seriesDe(s, bloque.id).length}`} s={s} b={bloque} anterior={ctx.anterior} record={ctx.record} />
      ) : bloque.tipo === 'casilla' ? (
        <section className="col entreno-bloque">
          <span className="seccion-titulo">Para cerrar</span>
          <h1 className="entreno-titulo">{bloque.nombre}</h1>
          {bloque.nota && <p className="entreno-nota">{bloque.nota}</p>}
          <button className="entreno-casilla" onClick={() => mutar(() => marcarBloque(s.id!, bloque.id))}><span className="caja" aria-hidden>✓</span> Listo, estiré</button>
        </section>
      ) : (
        bloque.tipo === 'temporizador' && bloque.modo === 'cronometro'
          ? <Cronometro key={bloque.id} s={s} b={bloque} t={t} hist={ctx.tiempo} />
          : <Temporizador key={bloque.id} s={s} b={bloque} t={t} />
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
      <div className="entreno-reiniciar">
        <button className="boton chico contorno-papel" onClick={() => setReiniciar(true)}>↺ Reiniciar</button>
      </div>
      <Confirmar abierta={reiniciar} titulo="¿Reiniciar la rutina desde cero?" texto="Se borra lo de hoy: series, pesos, tiempos y el XP de este entreno. Lo de días anteriores no se toca." confirmar="Reiniciar" peligro onCancelar={() => setReiniciar(false)} onConfirmar={() => { setReiniciar(false); void mutar(() => reiniciarEntreno(s.id!)) }} />
      <Confirmar abierta={descartar} titulo="¿Descartar el entreno?" texto="Se borran las series de hoy y el pilar vuelve a pendiente." confirmar="Descartar" peligro onCancelar={() => setDescartar(false)} onConfirmar={() => { setDescartar(false); setBloques(false); void mutar(() => descartarEntreno(s.id!)) }} />
    </>
  )
}

function Stepper({ etiqueta, valor, paso, min = 0, formato, onCambio, marca, escribible, compacto }: { etiqueta: string; valor: number; paso: number; min?: number; formato?: (v: number) => string; onCambio: (v: number) => void; marca?: 'mejor' | 'igual' | null; escribible?: boolean; compacto?: boolean }) {
  const redondear = (v: number) => Math.round(v * 100) / 100
  const [escribiendo, setEscribiendo] = useState(false)
  return (
    <div className={`stepper ${marca ?? ''} ${compacto ? 'compacto' : ''}`}>
      <span className="etiqueta">{etiqueta}</span>
      <div className="fila">
        <button className="boton grande" aria-label={`Menos ${etiqueta}`} onClick={() => onCambio(Math.max(min, redondear(valor - paso)))}>−</button>
        {escribiendo ? (
          <input className="valor mono" type="number" inputMode="decimal" step="0.5" autoFocus defaultValue={valor} aria-label={etiqueta}
            onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= min) onCambio(redondear(v)); setEscribiendo(false) }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        ) : (
          <button className="valor mono" onClick={() => escribible && setEscribiendo(true)} aria-label={escribible ? `${etiqueta}: tocá para escribir` : etiqueta}>{formato ? formato(valor) : valor}</button>
        )}
        <button className="boton grande" aria-label={`Más ${etiqueta}`} onClick={() => onCambio(redondear(valor + paso))}>+</button>
      </div>
    </div>
  )
}

const tot = (y: SerieHecha) => y.reps + (y.repsExtra ?? 0)
const reps = (x: SerieHecha) => `${x.reps}${x.repsExtra ? `+${x.repsExtra}` : ''}${x.ayuda ? ` +${x.ayuda} ayuda` : ''}`

function textoSeries(series: SerieHecha[]): string {
  if (!series.length) return ''
  const peso = series[0].peso
  const mismoPeso = series.every((x) => x.peso === peso)
  return mismoPeso ? `${series.map((x) => `S${x.n} ${reps(x)}`).join(' · ')} · ${kg(peso)}` : series.map((x) => `S${x.n} ${reps(x)} × ${kg(x.peso)}`).join(' · ')
}

/** Verde si superó la misma serie de la vez pasada (mismo peso), gris si la igualó. Más peso también es verde. */
function marcaSerie(x: Pick<SerieHecha, 'reps' | 'repsExtra' | 'peso'>, ref?: SerieHecha): 'mejor' | 'igual' | null {
  if (!ref) return null
  if (x.peso > ref.peso) return 'mejor'
  if (x.peso < ref.peso) return null
  const a = x.reps + (x.repsExtra ?? 0)
  return a > tot(ref) ? 'mejor' : a === tot(ref) ? 'igual' : null
}

function textoSigue(x: Siguiente): string {
  const b = x.bloque
  if (b.tipo === 'ejercicio') return `${kg(x.peso)} · ${b.series} ${b.series === 1 ? 'serie' : 'series'} × ${x.reps}${b.repsExtra ? (b.admiteAyuda ? ` +${b.repsExtra} ayuda` : `+${b.repsExtra}`) : ''} reps`
  return resumenBloque(b)
}

function TarjetaSigue({ x, grande, titulo }: { x?: Siguiente; grande?: boolean; titulo?: string }) {
  if (!x) return <div className="entreno-sigue"><span className="seccion-titulo">{titulo ?? 'Sigue'}</span><b>Terminar el entreno</b></div>
  const nota = 'nota' in x.bloque ? x.bloque.nota : undefined
  return (
    <div className={`entreno-sigue ${grande ? 'grande' : ''}`} aria-label="Lo que sigue">
      <span className="seccion-titulo">{titulo ?? (grande ? 'Acomodá para' : 'Sigue')}</span>
      <b className="nombre">{x.bloque.nombre}</b>
      <span className="mono datos">{textoSigue(x)}</span>
      {nota && <span className="entreno-nota">«{nota}»</span>}
    </div>
  )
}

function Ejercicio({ s, b, anterior, record }: { s: SesionEntreno; b: BloqueEjercicio; anterior: SerieHecha[]; record?: Marca | null }) {
  const hechas = seriesDe(s, b.id)
  const n = hechas.length + 1
  const sug = sugerencia(b, anterior)
  const [peso, setPeso] = useState(s.pesos?.[b.id] ?? hechas[hechas.length - 1]?.peso ?? pesoInicial(b, anterior))
  const [corregir, setCorregir] = useState<SerieHecha | null>(null)
  const objetivo = objetivoSerie(b, anterior, n, peso)
  const pesoAntes = pesoInicial(b, anterior)
  const cambiarPeso = (v: number) => { setPeso(v); void mutar(() => fijarPeso(s.id!, b.id, v)) }
  const guardar = async () => {
    await mutar(() => registrarSerie(s.id!, b.id, { reps: objetivo, repsExtra: b.repsExtra, peso }))
    vibrar(60)
    // La serie ya quedó guardada y el descanso corre por su cuenta: el parry solo se muestra (un toque lo salta).
    animar({ tipo: 'parry' })
  }
  const primera = hechas.length === 0
  return (
    <section className="col entreno-bloque">
      <span className="seccion-titulo">{b.grupo ?? 'Ejercicio'}</span>
      <h1 className="entreno-titulo">{b.nombre}</h1>
      {b.nota && <p className="entreno-nota">«{b.nota}»</p>}
      <p className="texto-2 chico">{anterior.length ? <>La vez pasada: <b>{textoSeries(anterior)}</b></> : 'Primera vez con la app: arrancá con lo de tu planilla.'}{record && <> · <span className="entreno-record">Récord: <b>{record.reps} × {kg(record.peso)}</b></span></>}</p>
      {primera && sug?.subirPeso && <div className="entreno-sugerencia peso"><span>▲ {sug.texto}</span><span className="chico">Si subís, poné el peso nuevo con − / + o tocando el número. Lo que hagas hoy con el peso nuevo queda como tus reps actuales.</span></div>}
      <Stepper etiqueta={primera ? 'Peso de hoy' : 'Peso'} valor={peso} paso={0.5} escribible compacto={!primera} formato={(v) => (v === 0 ? 'corporal' : `${String(v).replace('.', ',')} kg`)} onCambio={cambiarPeso} marca={anterior.length ? (peso > pesoAntes ? 'mejor' : peso === pesoAntes ? 'igual' : null) : null} />
      <div className="entreno-objetivo">
        <span className="entreno-serie">Serie {Math.min(n, b.series)} de {b.series}</span>
        <span className="mono"><b>{objetivo}</b>{b.repsExtra ? (b.admiteAyuda ? <b className="entreno-ayuda"> +{b.repsExtra} ayuda</b> : <b>+{b.repsExtra}</b>) : null} reps</span>
      </div>
      {n === 1 && sug && !sug.subirPeso && <p className="ayuda">{sug.texto} Una más que las actuales ya es récord.</p>}
      {n === 1 && anterior.length > 0 && peso !== b.peso && <p className="ayuda">Peso nuevo: tramo nuevo. Lo que hagas hoy en la serie 1 queda como tus reps actuales con {kg(peso)}.</p>}
      {n > 1 && anterior.find((x) => x.n === n) && <p className="ayuda">Objetivo de la serie {n}: lo que hiciste en la serie {n} la vez pasada. Si sale un poco menos, no resta.</p>}
      <button className="boton primario grande ancho entreno-hecha" onClick={guardar}>Serie hecha</button>
      <p className="ayuda centro">Las repeticiones las anotás en el descanso.</p>
      {hechas.length > 0 && (
        <div className="entreno-hoy chico">
          {hechas.map((x) => <button key={x.n} className={`marca ${marcaSerie(x, anterior.find((a) => a.n === x.n)) ?? ''}`} onClick={() => setCorregir(x)}>S{x.n}: {reps(x)} × {kg(x.peso)}{x.segundos !== undefined ? <span className="texto-3"> · {x.segundos} s</span> : null} ✎</button>)}
        </div>
      )}
      {b.admiteAyuda && <p className="ayuda">Las reps con ayuda quedan en el historial y suman al volumen, pero no cuentan para el récord ni para subir peso.</p>}
      <Hoja abierta={!!corregir} onCerrar={() => setCorregir(null)} titulo={corregir ? `Corregir serie ${corregir.n}` : ''}>
        {corregir && <CorregirSerie s={s} b={b} x={corregir} ref_={anterior.find((a) => a.n === corregir.n)} />}
      </Hoja>
    </section>
  )
}

/** «¿Cuántas hiciste?»: se guarda solo con cada toque. */
function CorregirSerie({ s, b, x, ref_, conPeso = true, titulo }: { s: SesionEntreno; b: BloqueEjercicio; x: SerieHecha; ref_?: SerieHecha; conPeso?: boolean; titulo?: string }) {
  const [r, setR] = useState(x.reps)
  const [e, setE] = useState(x.repsExtra ?? 0)
  const [ay, setAy] = useState(x.ayuda ?? 0)
  const [p, setP] = useState(x.peso)
  const guardar = (c: { reps?: number; repsExtra?: number; ayuda?: number; peso?: number }) => void mutar(() => corregirSerie(s.id!, b.id, x.n, c))
  return (
    <div className="col" style={{ gap: 10 }}>
      <Stepper etiqueta={titulo ?? `¿Cuántas hiciste? · serie ${x.n}`} valor={r} paso={1} onCambio={(v) => { setR(v); guardar({ reps: v }) }} marca={marcaSerie({ reps: r, repsExtra: e, peso: p }, ref_)} />
      {b.admiteAyuda && <Stepper etiqueta="Con ayuda (no cuentan para récord)" valor={ay} paso={1} formato={(v) => `+${v}`} onCambio={(v) => { setAy(v); guardar({ ayuda: v }) }} />}
      {!b.admiteAyuda && b.repsExtra !== undefined && <Stepper etiqueta="Extra" valor={e} paso={1} formato={(v) => `+${v}`} onCambio={(v) => { setE(v); guardar({ repsExtra: v }) }} />}
      {conPeso && <Stepper etiqueta="Peso" valor={p} paso={0.5} escribible compacto formato={(v) => (v === 0 ? 'corporal' : `${String(v).replace('.', ',')} kg`)} onCambio={(v) => { setP(v); guardar({ peso: v }) }} />}
      {ref_ && <p className="ayuda">La vez pasada: {reps(ref_)} × {kg(ref_.peso)} · se guarda solo</p>}
    </div>
  )
}

/**
 * Línea fija debajo de la barra de bloques: qué estás haciendo ahora y qué viene después (ronda 8).
 * Así no hace falta leer toda la pantalla para ubicarse.
 */
function LineaAhora({ s, bloque, fase, ctx }: { s: SesionEntreno; bloque?: BloqueRutina; fase: ReturnType<typeof faseActual>; ctx: Contexto }) {
  let ahoraTxt = ''
  let despues = ''
  if (s.descanso && fase) {
    const f = fase.fase
    const u = ctx.ultima
    const faltan = u ? u.bloque.series - seriesDe(s, u.bloque.id).length : 0
    ahoraTxt = f.tipo === 'preparar' || f.tipo === 'sombra' ? 'Sombra' : f.tipo === 'acomodar' ? 'Acomodá' : 'Descanso'
    despues = u && faltan > 0 ? `${u.bloque.nombre} · serie ${u.serie.n + 1}` : ctx.sigueDescanso?.bloque.nombre ?? 'Terminar'
  } else if (bloque) {
    ahoraTxt = bloque.tipo === 'ejercicio' ? `${bloque.nombre} · serie ${Math.min(seriesDe(s, bloque.id).length + 1, bloque.series)}/${bloque.series}` : bloque.nombre
    despues = ctx.sigueActual?.bloque.nombre ?? 'Terminar'
  } else {
    ahoraTxt = 'Todo hecho'
  }
  return (
    <div className="entreno-linea" aria-live="polite">
      <span><span className="texto-3">Ahora:</span> <b>{ahoraTxt}</b></span>
      {despues && <span><span className="texto-3">Después:</span> <b>{despues}</b></span>}
    </div>
  )
}

function Descanso({ s, fase, r, ctx }: { s: SesionEntreno; fase: NonNullable<ReturnType<typeof faseActual>>; r: Rutina; ctx: Contexto }) {
  const f = fase.fase
  void r
  const pct = Math.max(0, Math.min(100, (fase.restante / f.segundos) * 100))
  const u = ctx.ultima
  // ¿Falta alguna serie del ejercicio que acaba de hacer?
  const faltan = u ? u.bloque.series - seriesDe(s, u.bloque.id).length : 0
  const pesoActual = u ? s.pesos?.[u.bloque.id] ?? u.serie.peso : 0
  const objetivoProxima = u && faltan > 0 ? objetivoSerie(u.bloque, u.anterior, u.serie.n + 1, pesoActual) : 0
  // Ámbar a 10 s del final (con una vibración) y otra vibración a 3 s: para alistarse.
  const ambar = fase.totalRestante <= AVISO_FIN_DESCANSO_S && f.tipo !== 'preparar'
  const avisado = useRef<Set<string>>(new Set())
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const conTaiko = ajustes.datos?.sonidoAviso10s !== false
  useEffect(() => {
    const k = (x: string) => `${s.descanso!.inicio}:${x}`
    if (f.tipo === 'preparar' && !avisado.current.has(k(`p${fase.restante}`))) { avisado.current.add(k(`p${fase.restante}`)); vibrar(fase.restante === 1 ? 160 : 70) }
    // A 10 s: vibra y, una sola vez, un golpe de taiko para alistarse (a 3 s y al final no suena).
    if (fase.totalRestante <= AVISO_FIN_DESCANSO_S && fase.totalRestante > 3 && !avisado.current.has(k('10'))) { avisado.current.add(k('10')); vibrar(120); if (conTaiko) sonarTaiko() }
    if (fase.totalRestante <= 3 && fase.totalRestante > 0 && !avisado.current.has(k('3'))) { avisado.current.add(k('3')); vibrar([80, 60, 80]) }
  }, [f.tipo, fase.restante, fase.totalRestante, s.descanso, conTaiko])
  const despuesDeBarra = !!s.descanso!.origen
  const total = s.descanso!.fases.reduce((t, x) => t + x.segundos, 0)
  const capaParry = useCapaParry(f.tipo === 'preparar')
  if (f.tipo === 'preparar') {
    return (
      <section className="col entreno-descanso preparar" aria-live="assertive">
        <p className="entreno-fase centro">Sombra en</p>
        <div key={fase.restante} className="entreno-321 mono" aria-label={`Sombra en ${fase.restante}`}>{fase.restante}</div>
        {/* Mientras se ve el parry, la cuenta va debajo del dibujo (sin taparlo): así se ve el 3-2-1 completo. */}
        {capaParry && createPortal(<div className="sh-321" aria-hidden><span>Sombra en</span><b key={fase.restante} className="mono">{fase.restante}</b></div>, capaParry)}
        <p className="ayuda centro">Estos 3 s ya cuentan dentro del descanso de {reloj(total)}.</p>
        <button className="enlace texto-3 chico centro" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer la serie</button>
      </section>
    )
  }
  return (
    <section className={`col entreno-descanso ${f.tipo} ${ambar ? 'ambar' : ''}`} aria-live="polite">
      <div className="fila entre entreno-fase-fila"><h1 className="entreno-fase">{f.tipo === 'acomodar' ? 'Acomodá' : despuesDeBarra ? 'Descanso' : f.texto}</h1><span className="entreno-reloj mono">{reloj(fase.restante)}</span></div>
      <div className="entreno-barra"><div style={{ width: `${pct}%` }} /></div>
      {ambar && <p className="entreno-alistate">Alistate: {faltan > 0 && u ? `serie ${u.serie.n + 1} de ${u.bloque.nombre}` : ctx.sigueDescanso?.bloque.nombre ?? 'terminar'} en {reloj(fase.totalRestante)}</p>}
      {despuesDeBarra && <p className="ayuda">Después de colgarse: descanso de {reloj(f.segundos)}, sin sombra.</p>}
      {s.descanso!.fases.length > 1 && <p className="ayuda">{s.descanso!.fases.filter((x) => x.tipo !== 'preparar').map((x) => `${x.tipo === 'sombra' ? 'Sombra' : 'Descansá'} ${reloj(x.segundos)}`).join(' → ')} · total {reloj(total)}</p>}
      {u && faltan > 0 ? (
        <div className="entreno-ahora">
          <span className="seccion-titulo">Ahora</span>
          <b className="te-queda">Te queda {faltan} {faltan === 1 ? 'serie' : 'series'} de {u.bloque.nombre}</b>
          <span className="mono datos">{kg(pesoActual)} · objetivo {objetivoProxima}{u.bloque.repsExtra ? (u.bloque.admiteAyuda ? ` +${u.bloque.repsExtra} ayuda` : `+${u.bloque.repsExtra}`) : ''} reps</span>
          <TarjetaSigue x={ctx.sigueDescanso} titulo="Para alistar" />
        </div>
      ) : (
        <TarjetaSigue x={ctx.sigueDescanso} grande titulo={despuesDeBarra ? 'Sigue' : undefined} />
      )}
      {u && <div className="entreno-cuantas"><CorregirSerie s={s} b={u.bloque} x={u.serie} ref_={u.anterior.find((a) => a.n === u.serie.n)} conPeso={false} titulo={`${u.bloque.nombre} · serie ${u.serie.n}${u.serie.segundos !== undefined ? ` · ${u.serie.segundos} s` : ''} · ¿cuántas hiciste?`} /></div>}
      <div className="botonera">
        <button className="boton grande" onClick={() => mutar(() => alargarDescanso(s.id!, 30))}>+30 s</button>
        <button className="boton grande primario" onClick={() => mutar(() => terminarDescanso(s.id!))}>Saltar descanso</button>
      </div>
      {!despuesDeBarra && <button className="enlace texto-3 chico centro" onClick={() => mutar(() => deshacerSerie(s.id!))}>Deshacer la serie</button>}
    </section>
  )
}

/** La capa del parry si está en pantalla (se busca mientras dura la cuenta 3-2-1). */
function useCapaParry(activo: boolean): HTMLElement | null {
  const [capa, setCapa] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!activo) { setCapa(null); return }
    const buscar = () => setCapa((document.querySelector('.sh-capa') as HTMLElement | null) ?? null)
    buscar()
    const id = window.setInterval(buscar, 100)
    return () => clearInterval(id)
  }, [activo])
  return capa
}

/** Colgarse en barra: cronómetro que cuenta para arriba, con peso. 5 s para colgarse; al tocar Listo se descuentan 3 s. */
function Cronometro({ s, b, t, hist }: { s: SesionEntreno; b: BloqueTemporizador; t: number; hist?: { ultimo: TiempoHecho | null; record: TiempoHecho | null } }) {
  const corriendo = s.reloj?.bloqueId === b.id ? s.reloj : undefined
  const [peso, setPeso] = useState(s.pesos?.[b.id] ?? hist?.ultimo?.peso ?? b.peso ?? 0)
  const e = corriendo ? estadoCronometro(corriendo.inicio, t) : null
  // Objetivo en segundos (el de la rutina): si lo superás sube 1 s solo; a mano se cambia con el stepper.
  const objetivo = b.segundos
  // En pantalla corre el tiempo real; al tocar «Listo» se descuentan 3 s. Se pone verde cuando lo guardado ya supera el objetivo. Sin vibrar.
  const enPantalla = objetivo + DESCUENTO_S
  const fase = !e ? null : e.preparando ? 'prep' : objetivo && e.segundos > enPantalla ? 'objetivo' : 'colgado'
  const listo = async () => {
    const r = await mutar(() => terminarCronometro(s.id!, b.id, peso))
    if (r.subio) avisar(`Récord. Próxima vez: ${r.objetivo} s`, { tipo: 'ok' })
    else avisar(`${b.nombre}: ${reloj(r.tiempo.segundos)}${peso ? ` con ${kg(peso)}` : ''} (ya descontados ${DESCUENTO_S} s)`, { tipo: 'ok' })
  }
  const pct = e && objetivo ? Math.min(100, (e.segundos / enPantalla) * 100) : 0
  const texto = (x: TiempoHecho) => `${reloj(x.segundos)} · ${kg(x.peso)}`
  return (
    <section className="col entreno-bloque entreno-timer cronometro">
      <span className="seccion-titulo">{b.nota ?? 'Cronómetro'}</span>
      <h1 className="entreno-titulo">{b.nombre}</h1>
      <p className="texto-2 chico">
        {hist?.ultimo ? <>La vez pasada: <b>{texto(hist.ultimo)}</b>{hist.record && (hist.record.segundos !== hist.ultimo.segundos || hist.record.peso !== hist.ultimo.peso) ? <> · récord <b>{texto(hist.record)}</b></> : null}</> : `Todavía sin tiempos. Objetivo: ${objetivo} s.`}
      </p>
      {!corriendo ? (
        <>
          <Stepper etiqueta="Peso" valor={peso} paso={0.5} escribible formato={(v) => (v === 0 ? 'corporal' : `${String(v).replace('.', ',')} kg`)} onCambio={(v) => { setPeso(v); void mutar(() => fijarPeso(s.id!, b.id, v)) }} marca={hist?.ultimo ? (peso > hist.ultimo.peso ? 'mejor' : peso === hist.ultimo.peso ? 'igual' : null) : null} />
          <Stepper etiqueta="Objetivo" valor={objetivo} paso={1} escribible formato={(v) => `${v} s`} onCambio={(v) => { void mutar(() => fijarObjetivoCronometro(b.nombre, v)) }} />
          <div className="entreno-reloj mono">0:00</div>
          <button className="boton primario grande ancho entreno-hecha" onClick={() => mutar(() => iniciarReloj(s.id!, b.id))}>Empezar</button>
          <p className="ayuda centro">Si superás {objetivo} s, la próxima vez el objetivo sube a {objetivo + 1} s (solo 1 s, aunque lo pases por mucho). Tenés {PREPARACION_S} s para colgarte; al tocar «Listo» se descuentan {DESCUENTO_S} s.</p>
        </>
      ) : e!.preparando ? (
        <>
          <p className="entreno-fase centro">Acomodate y colgate</p>
          <div className="entreno-reloj mono entreno-prep">{e!.prep}</div>
          <div className="botonera">
            <button className="boton grande" onClick={() => mutar(() => pararReloj(s.id!))}>Cancelar</button>
            <button className="boton grande primario" onClick={() => mutar(() => saltarPreparacion(s.id!))}>Ya estoy colgado</button>
          </div>
        </>
      ) : (
        <>
          <p className={`entreno-fase centro ${fase === 'objetivo' ? 'ok' : ''}`}>{fase === 'objetivo' ? `¡Superaste ${reloj(objetivo)}! Seguí` : `Colgado · con ${kg(peso)}`}</p>
          <div className={`entreno-reloj mono ${fase === 'objetivo' ? 'verde' : ''}`}>{reloj(Math.floor(e!.segundos))}</div>
          {objetivo > 0 && <div className="entreno-barra cronometro"><div style={{ width: `${pct}%` }} /></div>}
          {objetivo > 0 && <p className="ayuda centro">Objetivo: {objetivo} s · se pone verde en {reloj(enPantalla)} (por los {DESCUENTO_S} s que se descuentan)</p>}
          <button className="boton primario grande ancho entreno-hecha" onClick={listo}>Listo</button>
          <button className="enlace texto-3" onClick={() => mutar(() => pararReloj(s.id!))}>Reiniciar</button>
        </>
      )}
    </section>
  )
}

function Temporizador({ s, b, t }: { s: SesionEntreno; b: Exclude<BloqueRutina, BloqueEjercicio | { tipo: 'casilla' }>; t: number }) {
  const corriendo = s.reloj?.bloqueId === b.id ? s.reloj : undefined
  // Rondas con descanso entre medio (kick boxing); el calentamiento es un solo tramo.
  const tramos = b.tipo === 'rondas' ? tramosRondas(b) : Array.from({ length: b.veces ?? 1 }, (_, i) => ({ segundos: b.segundos, texto: '', ronda: i, descanso: false as boolean | undefined }))
  const nRondas = b.tipo === 'rondas' ? b.rondas.length : tramos.length
  const preparando = !!corriendo && t < corriendo.inicio
  const prep = preparando ? Math.ceil((corriendo!.inicio - t) / 1000) : 0
  const ronda = corriendo && !preparando ? rondaActual(tramos, corriendo.inicio, t) : null
  const termino = !!corriendo && !preparando && !ronda
  // Vibra en la preparación, entre tramos y al terminar; al terminar, el bloque queda hecho solo.
  const claveRonda = corriendo ? `${corriendo.inicio}:${preparando ? `p${prep}` : ronda?.indice ?? 'fin'}` : null
  const previa = useRef<string | null>(null)
  useEffect(() => {
    if (previa.current && claveRonda && previa.current !== claveRonda) vibrar(claveRonda.endsWith('fin') ? [300, 120, 300] : claveRonda.includes(':p') ? 60 : [200, 100, 200])
    previa.current = claveRonda
  }, [claveRonda])
  const avisoDescanso = useRef<string | null>(null)
  const tramo = ronda ? tramos[ronda.indice] : tramos[0]
  const ambar = !!(ronda && tramo.descanso && ronda.restante <= AVISO_FIN_DESCANSO_S)
  useEffect(() => {
    const k = corriendo && ronda ? `${corriendo.inicio}:${ronda.indice}` : null
    if (ambar && k && avisoDescanso.current !== k) { avisoDescanso.current = k; vibrar(120) }
  }, [ambar, corriendo, ronda])
  useEffect(() => {
    if (termino) void mutar(() => marcarBloque(s.id!, b.id)).then(() => avisar(`${b.nombre}: listo`, { tipo: 'ok' }))
  }, [termino, s.id, b.id, b.nombre])
  const total = tramos.reduce((x, y) => x + y.segundos, 0)
  const pct = ronda ? (ronda.restante / tramo.segundos) * 100 : 100
  const proxima = ronda && tramo.descanso && b.tipo === 'rondas' ? b.rondas[tramo.ronda] : null
  return (
    <section className={`col entreno-bloque entreno-timer ${b.tipo} ${tramo.descanso && ronda ? 'en-descanso' : ''} ${ambar ? 'ambar' : ''}`}>
      <span className="seccion-titulo">{b.tipo === 'calentamiento' ? 'Para arrancar' : b.tipo === 'rondas' ? 'Rondas' : (b.nota ?? 'Temporizador')}</span>
      <h1 className="entreno-titulo">{b.nombre}</h1>
      {b.tipo !== 'rondas' && (b.nota || b.peso) && <p className="entreno-nota">{[b.tipo === 'calentamiento' ? b.nota : null, b.peso ? `con ${b.peso} kg` : null, b.veces ? `${b.veces} vez` : null].filter(Boolean).join(' · ')}</p>}
      {b.tipo === 'rondas' && (
        <div className="col" style={{ gap: 6 }}>
          {b.rondas.map((x, i) => (
            <div key={i}>
              {i > 0 && (b.descansoEntre ?? 60) > 0 && <div className={`entreno-ronda descanso ${ronda && tramo.descanso && tramo.ronda === i ? 'actual' : ''}`}><span className="mono">{reloj(b.descansoEntre ?? 60)}</span><span>Descanso</span></div>}
              <div className={`entreno-ronda ${ronda && !tramo.descanso && tramo.ronda === i ? 'actual' : ronda && i < tramo.ronda ? 'paso' : ''}`}>
                <span className="mono">R{i + 1} · {reloj(x.segundos)}</span><span>{x.texto}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {preparando ? (
        <>
          <p className="entreno-fase centro">Preparate</p>
          <div key={prep} className="entreno-reloj mono entreno-prep">{prep}</div>
          <button className="boton grande ancho" onClick={() => mutar(() => saltarPreparacion(s.id!))}>Arrancar ya</button>
        </>
      ) : (
        <>
          <div className="entreno-reloj mono">{reloj(ronda ? ronda.restante : tramo.segundos)}</div>
          <div className="entreno-barra"><div style={{ width: `${pct}%` }} /></div>
          {b.tipo === 'rondas' && ronda && (tramo.descanso
            ? <p className="entreno-fase centro">Descanso · sigue R{tramo.ronda + 1}: {proxima?.texto}</p>
            : <p className="entreno-fase centro">Ronda {tramo.ronda + 1} de {nRondas}: {tramo.texto}</p>)}
          {!corriendo ? (
            <>
              <button className="boton primario grande ancho" onClick={() => mutar(() => iniciarReloj(s.id!, b.id))}>Empezar · {reloj(total)}</button>
              <p className="ayuda centro">Arranca con 5 s para prepararte (un toque los saltea).</p>
            </>
          ) : (
            <div className="botonera">
              <button className="boton grande" onClick={() => mutar(() => pararReloj(s.id!))}>Reiniciar</button>
              <button className="boton grande ok" onClick={() => mutar(() => marcarBloque(s.id!, b.id))}>Listo</button>
            </div>
          )}
        </>
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
        <div className="fila entre"><span>Por mejorar <span className="texto-3 chico">(+5 récord · +10 subir peso)</span></span><b className="mono">{x.xpExtra > 0 ? `+${x.xpExtra} XP` : '—'}</b></div>
        {x.xpSinTope > x.xpExtra && <p className="ayuda">Llegaste al tope de {TOPE_XP_EXTRA} XP extra por entreno (sumabas {x.xpSinTope}).</p>}
        {r.motivoSinXp && <p className="ayuda">{r.motivoSinXp}</p>}
      </div>
      <ul className="entreno-lista resumen">
        {x.ejercicios.map((e) => (
          <li key={e.bloqueId} className={e.record || e.subioPeso ? 'mejor' : e.igual ? 'igual' : ''}>
            <div className="fila entre" style={{ width: '100%' }}>
              <span className="crece">{e.record ? '★ ' : e.subioPeso ? '▲ ' : e.igual ? '= ' : ''}{e.nombre}</span>
              <b className="mono">{e.xp ? `+${e.xp} XP` : ''}</b>
            </div>
            <span className="chico texto-3 mono">S1 {e.marca.reps} × {kg(e.marca.peso)}{e.antes ? ` · antes ${e.antes.reps} × ${kg(e.antes.peso)}` : ''}</span>
            <span className="chico xp-detalle">{[e.record ? `+5 récord: superaste tus ${e.actuales} actuales` : null, e.subioPeso ? '+10 subiste el peso: tramo nuevo' : null].filter(Boolean).join(' · ') || (e.antes ? (e.marca.peso === e.antes.peso && e.marca.reps >= e.actuales ? `Igual que tus ${e.actuales} actuales` : 'Sin récord esta vez (no resta)') : 'Primera vez: queda como tus reps actuales')}</span>
          </li>
        ))}
      </ul>
      {(r.sesion.tiempos ?? []).map((x) => (
        <div key={x.bloqueId} className="fila entre entreno-tiempo"><span>{x.nombre}</span><b className="mono">{reloj(x.segundos)} · {kg(x.peso)}</b></div>
      ))}
      <p className="ayuda centro">★ récord: superaste tus reps actuales · ▲ subiste el peso · gris: igualaste.</p>
      <button className="boton primario grande ancho" onClick={() => navegar('/')}>Volver a Hoy</button>
      <button className="enlace texto-3 centro" onClick={onReabrir}>Reabrir para corregir una serie</button>
    </section>
  )
}
