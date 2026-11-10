/**
 * Rutinas de entrenamiento: la lista (A, B, C), el editor de bloques y el
 * mini gráfico de cada ejercicio (peso × repeticiones a lo largo del ciclo).
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IDEAS_DE_A_POCO, diasDeEleccion, planPorId, type EleccionEntreno } from '../../data/planes'
import type { BloqueEjercicio, BloqueRutina, Rutina, SerieHecha, SesionEntreno } from '../../data/tipos'
import { nombreDiaSemana } from '../../domain/fechas'
import { aplicarEleccionEntreno, mismoNombreEnOtraRutina, sumarBloqueARutinas, borrarRutina, corregirSerie, crearRutina, diasDeRutinas, guardarRutina, historialEjercicio, igualarDiasEntrenar, kg, listarRutinas, obtenerRutina, sesionEnCurso, type PuntoEjercicio } from '../../services/entreno'
import { db } from '../../data/db'
import { fechaLegible } from '../../domain/fechas'
import { nuevoId } from '../../services/reloj'
import { Atras, DiasSemana, Hoja, Tarjeta } from '../componentes'
import { ComoEmpezar, diasCortos, nombreEleccion } from '../ComoEmpezar'
import { avisar, mutar, useDatos } from '../estado'
import { useFunciones } from '../funciones'

function dias(d: number[]): string {
  const n = [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => nombreDiaSemana(x, true))
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('')
}

const IDEAS_OCULTAS = 'rutinas-ideas-ocultas'

export function Rutinas() {
  const usaF = useFunciones()
  const datos = useDatos(async () => {
    const rutinas = await listarRutinas(true)
    const entreno = await db().acciones.get('entrenamiento')
    return { rutinas, diasRutinas: await diasDeRutinas(), pilar: entreno?.activa && entreno.pilar ? entreno.dias : null }
  }, [])
  const navegar = useNavigate()
  const [elegir, setElegir] = useState(false)
  const [ideasOcultas, setIdeasOcultas] = useState(() => { try { return localStorage.getItem(IDEAS_OCULTAS) === '1' } catch { return false } })
  const d = datos.datos
  const rutinas = d?.rutinas ?? []
  const nueva = async () => {
    const r = await mutar(() => crearRutina())
    navegar(`/mas/rutinas/${r.id}`)
  }
  const ocultarIdeas = () => { setIdeasOcultas(true); try { localStorage.setItem(IDEAS_OCULTAS, '1') } catch { /* sin almacenamiento */ } }
  const distintos = !!d?.pilar && d.diasRutinas.length > 0 && [...d.pilar].sort().join() !== [...d.diasRutinas].sort().join()
  const conEjemplo = rutinas.some((r) => r.id === 'rutina-ejemplo' && r.activa)
  return (
    <>
      <Atras a="/mas" texto="Más" />
      <h1>Mis rutinas</h1>
      <p className="texto-2 chico">{rutinas.length ? `${rutinas.length === 1 ? 'Tu rutina' : `Tus ${rutinas.length} rutinas`}, cada una con sus días. Tocá una para ver y editar sus bloques, ejercicios y días. Los cambios valen desde el próximo entreno.` : 'Todavía no tenés rutinas. Sumá una y armala a tu manera, o elegí un plan listo.'}</p>
      <Link to="/mas/rutinas/historial" className="tarjeta rutina-item">
        <div className="fila entre"><h2>Historial de entrenos</h2><span aria-hidden>›</span></div>
        <span className="texto-2 chico">Todos los entrenos quedan guardados, aunque ese día bajes reps o peso. Ahí podés corregir una serie mal anotada.</span>
      </Link>
      {distintos && (
        <Tarjeta compacta>
          <span className="texto-2 chico">Tu pilar Entrenar toca <b>{diasCortos(d!.pilar!)}</b>, pero tus rutinas son <b>{diasCortos(d!.diasRutinas)}</b>.</span>
          <button className="boton chico" onClick={async () => { await mutar(() => igualarDiasEntrenar()); avisar(`Entrenar: ${diasCortos(d!.diasRutinas)}`, { tipo: 'ok' }) }}>Usar los días de mis rutinas</button>
        </Tarjeta>
      )}
      {usaF('ideasRutina') && conEjemplo && !ideasOcultas && (
        <Tarjeta compacta>
          <b>Ideas para ir agrandándola</b>
          <ul className="texto-2 chico rutinas-ideas">{IDEAS_DE_A_POCO.map((x) => <li key={x}>{x}</li>)}</ul>
          <span className="texto-3 chico">Son solo ideas: vos decidís cuándo.</span>
          <button className="boton chico suave" onClick={ocultarIdeas}>Ocultar ideas</button>
        </Tarjeta>
      )}
      {rutinas.map((r) => {
        const ej = r.bloques.filter((b): b is BloqueEjercicio => b.tipo === 'ejercicio')
        return (
          <Link key={r.id} to={`/mas/rutinas/${r.id}`} className="tarjeta rutina-item">
            <div className="fila entre">
              <h2>{r.nombre.split(' · ')[0]}</h2>
              <span className="texto-3 chico">{r.dias.length ? dias(r.dias) : 'Sin días'} · ~{r.minutos} min</span>
            </div>
            <span className="texto-2">{r.nombre.split(' · ')[1] ?? ''}</span>
            <div className="chips-mini">{ej.map((e) => <span key={e.id}>{e.nombre}</span>)}</div>
            {!r.activa && <span className="texto-3 chico">Pausada</span>}
          </Link>
        )
      })}
      <div className="rutinas-acciones">
        <button className="boton" onClick={nueva}>+ Nueva rutina</button>
        <button className="boton" onClick={() => setElegir(true)}>Elegir cómo empezar</button>
      </div>
      {rutinas.length > 0 && <Link to="/entreno" className="boton primario grande ancho">Empezar entreno</Link>}
      <Hoja abierta={elegir} onCerrar={() => setElegir(false)} titulo="Elegir cómo empezar">
        {elegir && <ElegirComoEmpezar hay={rutinas.length} onListo={() => setElegir(false)} />}
      </Hoja>
    </>
  )
}

/** Hoja para cargar un plan, la rutina cortita o empezar de cero. Si ya hay rutinas, confirma antes de reemplazarlas. */
function ElegirComoEmpezar({ hay, onListo }: { hay: number; onListo: () => void }) {
  const [e, setE] = useState<EleccionEntreno>({ modo: 'plan', planId: 'plan-nay' })
  const [confirmar, setConfirmar] = useState(false)
  const [igualar, setIgualar] = useState(true)
  const dias = diasDeEleccion(e)
  const aplicar = async (reemplazar: boolean) => {
    try {
      const r = await mutar(() => aplicarEleccionEntreno(e, { reemplazar, igualarDias: igualar && !!dias }))
      avisar(e.modo === 'cero' ? 'Listo: sin rutinas. Sumá la primera con «+ Nueva rutina».' : `${nombreEleccion(e)}: ${r.cargadas === 1 ? '1 rutina cargada' : `${r.cargadas} rutinas cargadas`}`, { tipo: 'ok' })
      onListo()
    } catch (x) {
      avisar(x instanceof Error ? x.message : String(x), { tipo: 'bajo' })
    }
  }
  if (confirmar) {
    const plan = e.modo === 'plan' ? planPorId(e.planId) : undefined
    return (
      <div className="col" style={{ gap: 10 }}>
        <p>{e.modo === 'cero' ? `¿Borrar tus ${hay === 1 ? 'rutina' : `${hay} rutinas`} y empezar desde cero?` : `Ya tenés ${hay === 1 ? '1 rutina' : `${hay} rutinas`}. ¿Qué hacemos con ${hay === 1 ? 'ella' : 'ellas'}?`}</p>
        <p className="texto-2 chico">Tus entrenos, récords e historial quedan guardados igual.</p>
        {dias && (
          <button className={`boton chico ${igualar ? 'ok' : ''}`} aria-pressed={igualar} onClick={() => setIgualar(!igualar)}>
            {igualar ? '✓ ' : ''}Pasar el pilar Entrenar a {diasCortos(dias)}
          </button>
        )}
        {e.modo !== 'cero' && <button className="boton primario" onClick={() => aplicar(false)}>Sumar {plan ? 'el plan' : 'la rutina'} a las mías</button>}
        <button className={`boton ${e.modo === 'cero' ? 'primario' : ''}`} onClick={() => aplicar(true)}>{e.modo === 'cero' ? 'Sí, empezar desde cero' : 'Reemplazar mis rutinas'}</button>
        <button className="boton suave" onClick={() => setConfirmar(false)}>‹ Volver</button>
      </div>
    )
  }
  return (
    <div className="col" style={{ gap: 10 }}>
      <ComoEmpezar valor={e} onChange={setE} />
      <p className="ayuda">Después podés editar todo: días, ejercicios, series y pesos.</p>
      <button className="boton primario" onClick={() => (hay > 0 ? setConfirmar(true) : aplicar(true))}>{e.modo === 'cero' ? 'Seguir' : 'Cargar'}</button>
    </div>
  )
}

export function EditarRutina() {
  const { id } = useParams()
  const datos = useDatos(() => obtenerRutina(id ?? ''), [id])
  const [r, setR] = useState<Rutina | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [grafico, setGrafico] = useState<BloqueEjercicio | null>(null)
  const [borrar, setBorrar] = useState(false)
  const navegar = useNavigate()
  // Se carga una sola vez por rutina (si no, cada guardado automático pisaría lo que estás escribiendo).
  // Si quedó un borrador sin guardar (se apagó el celu, se cerró la app), se retoma ese.
  const cargada = useRef<string | null>(null)
  const ultimo = useRef<string>('')
  const pendiente = useRef<{ x: Rutina; json: string } | null>(null)
  useEffect(() => {
    if (!datos.datos || cargada.current === datos.datos.id) return
    cargada.current = datos.datos.id
    ultimo.current = JSON.stringify(datos.datos)
    setR(leerBorrador(datos.datos.id) ?? datos.datos)
  }, [datos.datos])
  const [guardado, setGuardado] = useState<{ estado: 'listo' | 'guardando' | 'error'; texto?: string }>({ estado: 'listo' })
  // Guardado automático: el borrador va al instante al teléfono y la rutina se guarda 1 s después del último cambio.
  useEffect(() => {
    if (!r) return
    const json = JSON.stringify(r)
    if (json === ultimo.current) return
    guardarBorrador(r)
    pendiente.current = { x: r, json }
    setGuardado({ estado: 'guardando' })
    const t = window.setTimeout(() => void guardarYa(r, json), 1000)
    const alSalir = () => { if (document.visibilityState === 'hidden') { window.clearTimeout(t); void guardarYa(r, json) } }
    document.addEventListener('visibilitychange', alSalir)
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', alSalir) }
  }, [r])
  // Al salir de la pantalla antes del segundo, se guarda igual.
  useEffect(() => () => { const p = pendiente.current; if (p) void guardarRutina(p.x).then(() => borrarBorrador(p.x.id)).catch(() => {}) }, [])
  const guardarYa = async (x: Rutina, json: string) => {
    if (json === ultimo.current) return
    try {
      await mutar(() => guardarRutina(x))
      ultimo.current = json
      if (pendiente.current?.json === json) pendiente.current = null
      borrarBorrador(x.id)
      setGuardado({ estado: 'listo' })
    } catch (e) {
      // Queda el borrador en el teléfono; se guarda solo apenas se corrija.
      setGuardado({ estado: 'error', texto: e instanceof Error ? e.message : String(e) })
    }
  }
  const [enCurso, setEnCurso] = useState(false)
  // Ejercicios enlazados: las otras rutinas (para «🔗 En N rutinas», «Sumar a otra rutina» y «¿Es el mismo?»).
  const otras = useDatos(async () => (await listarRutinas(true)).filter((x) => x.id !== id), [id])
  const [sumar, setSumar] = useState<{ bloqueId: string; elegidas: string[] } | null>(null)
  const [mismo, setMismo] = useState<{ bloqueId: string; rutina: Rutina; bloque: BloqueRutina } | null>(null)
  useEffect(() => { void sesionEnCurso().then((s) => setEnCurso(!!s && s.rutinaId === id)) }, [id])
  if (!r && datos.datos === undefined && !datos.cargando) return <><Atras a="/mas/rutinas" texto="Rutinas" /><p className="vacio">Esta rutina ya no está.</p></>
  if (!r) return <p className="vacio">Cargando…</p>
  const confirmarBorrar = async () => {
    try {
      const como = await mutar(() => borrarRutina(r.id))
      avisar(como === 'eliminada' ? 'Rutina borrada' : 'Rutina borrada. Sus entrenos siguen en el historial.', { tipo: 'ok' })
      navegar('/mas/rutinas')
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  const cambiarBloque = (bid: string, cambios: Partial<BloqueRutina>) => setR({ ...r, bloques: r.bloques.map((b) => (b.id === bid ? ({ ...b, ...cambios } as BloqueRutina) : b)) })
  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= r.bloques.length) return
    const b = [...r.bloques]
    ;[b[i], b[j]] = [b[j], b[i]]
    setR({ ...r, bloques: b })
  }
  const enlazadaEn = (bid: string) => (otras.datos ?? []).filter((x) => x.bloques.some((b) => b.id === bid))
  const revisarNombre = async (b: BloqueRutina) => {
    if (enlazadaEn(b.id).length) return
    const m = await mismoNombreEnOtraRutina(r.id, b)
    if (m) setMismo({ bloqueId: b.id, ...m })
  }
  const enlazar = () => {
    if (!mismo) return
    setR({ ...r, bloques: r.bloques.map((b) => (b.id === mismo.bloqueId ? mismo.bloque : b)) })
    setAbierto(mismo.bloque.id)
    avisar(`Enlazado con ${mismo.rutina.nombre}: se actualizan juntos.`, { tipo: 'ok' })
    setMismo(null)
  }
  const confirmarSumar = async () => {
    if (!sumar) return
    try {
      await mutar(() => guardarRutina(r))
      const n = await mutar(() => sumarBloqueARutinas(r.id, sumar.bloqueId, sumar.elegidas))
      avisar(n === 1 ? 'Sumado a 1 rutina: quedan enlazados.' : `Sumado a ${n} rutinas: quedan enlazados.`, { tipo: 'ok' })
      setSumar(null)
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  const quitar = (bid: string) => setR({ ...r, bloques: r.bloques.filter((b) => b.id !== bid) })
  const agregar = (tipo: BloqueRutina['tipo'] = 'ejercicio') => {
    const id = nuevoId(tipo === 'ejercicio' ? 'ej' : 'bl')
    const nuevo: BloqueRutina =
      tipo === 'ejercicio' ? { id, tipo, nombre: 'Nuevo ejercicio', series: 2, reps: 8, repsTope: 12, peso: 0, descanso: 90, sombra: 30 }
      : tipo === 'rondas' ? { id, tipo, nombre: 'Rondas', rondas: [{ segundos: 60, texto: 'Ronda 1' }, { segundos: 60, texto: 'Ronda 2' }], descansoEntre: 60 }
      : tipo === 'casilla' ? { id, tipo, nombre: 'Nueva casilla' }
      : { id, tipo: 'temporizador', nombre: 'Temporizador', segundos: 60, modo: 'cuenta' }
    // Los ejercicios van antes del kick boxing; lo demás, al final (antes de estirar).
    const iKick = tipo === 'ejercicio' ? r.bloques.findIndex((b) => b.tipo === 'rondas') : r.bloques.findIndex((b) => b.tipo === 'casilla')
    const b = [...r.bloques]
    b.splice(iKick >= 0 ? iKick : b.length, 0, nuevo)
    setR({ ...r, bloques: b })
    setAbierto(nuevo.id)
  }
  return (
    <>
      <Atras a="/mas/rutinas" texto="Rutinas" />
      <Tarjeta>
        <div className="campo"><label>Nombre</label><input value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} /></div>
        <div className="campo"><label>Días</label><DiasSemana valor={r.dias} onChange={(v) => setR({ ...r, dias: v })} /></div>
        <div className="rejilla-2">
          <div className="campo"><label>Duración (min)</label><input type="number" inputMode="numeric" value={r.minutos} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setR({ ...r, minutos: Number(e.target.value) })} /></div>
          <div className="campo"><label>Activa</label><button className={`boton ${r.activa ? 'ok' : ''}`} onClick={() => setR({ ...r, activa: !r.activa })}>{r.activa ? 'Sí' : 'Pausada'}</button></div>
        </div>
      </Tarjeta>
      <span className="seccion-titulo">Bloques en orden</span>
      <div className="col" style={{ gap: 8 }}>
        {r.bloques.map((b, i) => (
          <div key={b.id} className={`tarjeta compacta bloque-ed ${b.tipo}`}>
            <div className="fila">
              <button className="crece bloque-ed-cab" onClick={() => setAbierto(abierto === b.id ? null : b.id)}>
                <span className="texto-3 mono chico">{i + 1}</span> <b>{b.nombre}</b>
                <span className="texto-3 chico"> · {descripcion(b)}</span>
                {enlazadaEn(b.id).length > 0 && <span className="enlace-chip">🔗 En {enlazadaEn(b.id).length + 1} rutinas</span>}
              </button>
              <button className="boton chico suave" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
              <button className="boton chico suave" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === r.bloques.length - 1}>↓</button>
            </div>
            {abierto === b.id && <EditorBloque b={b} onCambio={(c) => cambiarBloque(b.id, c)} onQuitar={() => quitar(b.id)} onGrafico={b.tipo === 'ejercicio' ? () => setGrafico(b) : undefined}
              enlazadas={enlazadaEn(b.id).map((x) => x.nombre)} onNombreListo={() => void revisarNombre(b)}
              onSumar={(b.tipo === 'ejercicio' || b.tipo === 'temporizador') && (otras.datos ?? []).some((x) => !x.bloques.some((y) => y.id === b.id)) ? () => setSumar({ bloqueId: b.id, elegidas: [] }) : undefined} />}
          </div>
        ))}
      </div>
      <div className="rejilla-2">
        <button className="boton" onClick={() => agregar('ejercicio')}>+ Ejercicio</button>
        <button className="boton" onClick={() => agregar('temporizador')}>+ Temporizador</button>
        <button className="boton" onClick={() => agregar('rondas')}>+ Rondas</button>
        <button className="boton" onClick={() => agregar('casilla')}>+ Casilla</button>
      </div>
      <p className="ayuda">Los cambios valen desde el próximo entreno.{enCurso ? ' Tenés esta rutina en curso: si la cambiás ahora, el entreno de hoy ya toma los cambios.' : ''}</p>
      <p className={`guardado-auto ${guardado.estado}`} role="status">
        {guardado.estado === 'listo' ? '✓ Se guarda solo' : guardado.estado === 'guardando' ? 'Guardando…' : `Sin guardar: ${guardado.texto}. Lo que escribiste queda en el teléfono hasta que lo corrijas.`}
      </p>
      <button className="boton suave ancho" onClick={() => setBorrar(true)}>Borrar rutina</button>
      <Hoja abierta={borrar} onCerrar={() => setBorrar(false)} titulo="¿Borrar esta rutina?">
        <div className="col" style={{ gap: 10 }}>
          <p>«{r.nombre}» deja de aparecer en tus rutinas y en el entreno.</p>
          <p className="texto-2 chico">Los entrenos que ya hiciste con ella quedan guardados en el historial, con sus récords.{enCurso ? ' El entreno de hoy, si lo tenés empezado, lo podés terminar igual.' : ''}</p>
          <button className="boton primario" onClick={confirmarBorrar}>Sí, borrar</button>
          <button className="boton suave" onClick={() => setBorrar(false)}>No, dejarla</button>
        </div>
      </Hoja>
      <Hoja abierta={!!sumar} onCerrar={() => setSumar(null)} titulo="Sumar a otra rutina">
        {sumar && (
          <div className="col" style={{ gap: 10 }}>
            <p className="texto-2 chico">Elegí a cuáles. Queda el mismo ejercicio en todas: lo que mejores en una (objetivo, peso, reps) se actualiza en las otras, y el historial es uno solo.</p>
            {(otras.datos ?? []).filter((x) => !x.bloques.some((y) => y.id === sumar.bloqueId)).map((x) => {
              const si = sumar.elegidas.includes(x.id)
              return (
                <button key={x.id} className={`boton ancho enlace-opcion ${si ? 'ok' : ''}`} aria-pressed={si} onClick={() => setSumar({ ...sumar, elegidas: si ? sumar.elegidas.filter((y) => y !== x.id) : [...sumar.elegidas, x.id] })}>
                  {si ? '✓ ' : ''}{x.nombre}
                </button>
              )
            })}
            <p className="ayuda">Se pone en el mismo lugar que acá (por ejemplo, antes del kick boxing); después lo podés mover.</p>
            <button className="boton primario" disabled={!sumar.elegidas.length} onClick={() => void confirmarSumar()}>Sumar</button>
          </div>
        )}
      </Hoja>
      <Hoja abierta={!!mismo} onCerrar={() => setMismo(null)} titulo="¿Es el mismo ejercicio?">
        {mismo && (
          <div className="col" style={{ gap: 10 }}>
            <p>«{mismo.bloque.nombre}» ya está en <b>{mismo.rutina.nombre}</b> ({descripcion(mismo.bloque)}).</p>
            <p className="texto-2 chico">Si es el mismo, se enlazan: toma lo de esa rutina y desde ahora se actualizan juntos, con un solo historial.</p>
            <button className="boton primario" onClick={enlazar}>Sí, el mismo: se actualiza en las dos</button>
            <button className="boton" onClick={() => { cambiarBloque(mismo.bloqueId, { separado: true }); setMismo(null) }}>No, es otro</button>
          </div>
        )}
      </Hoja>
      <Hoja abierta={!!grafico} onCerrar={() => setGrafico(null)} titulo={grafico?.nombre}>
        {grafico && <HistorialEjercicio b={grafico} />}
      </Hoja>
    </>
  )
}

function descripcion(b: BloqueRutina): string {
  switch (b.tipo) {
    case 'ejercicio': return `${b.series} × ${b.reps}${b.repsExtra ? ` + ${b.repsExtra}${b.admiteAyuda ? ' ayuda' : ''}` : ''} · ${kg(b.peso)} · ${Math.floor(b.descanso / 60)}:${String(b.descanso % 60).padStart(2, '0')}`
    case 'rondas': return b.rondas.map((x) => `${x.segundos} s`).join(' + ')
    case 'casilla': return 'casilla'
    default: return `${b.segundos} s${b.peso ? ` · ${b.peso} kg` : ''}`
  }
}

function Num({ etiqueta, valor, onCambio, paso = 1 }: { etiqueta: string; valor: number | undefined; onCambio: (v: number) => void; paso?: number }) {
  return <div className="campo"><label>{etiqueta}</label><input type="number" inputMode="decimal" step={paso} value={valor ?? 0} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onCambio(Number(e.target.value))} /></div>
}

function EditorBloque({ b, onCambio, onQuitar, onGrafico, enlazadas = [], onSumar, onNombreListo }: { b: BloqueRutina; onCambio: (c: Partial<BloqueRutina>) => void; onQuitar: () => void; onGrafico?: () => void; enlazadas?: string[]; onSumar?: () => void; onNombreListo?: () => void }) {
  return (
    <div className="col" style={{ gap: 8, marginTop: 6 }}>
      <div className="campo"><label>Nombre</label><input value={b.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} onBlur={onNombreListo} /></div>
      {enlazadas.length > 0 && <p className="enlace-aviso">🔗 Es el mismo ejercicio que en {enlazadas.join(', ')}: lo que cambies o mejores acá se actualiza allá también.</p>}
      {b.tipo === 'ejercicio' && (
        <>
          <div className="rejilla-2">
            <div className="campo"><label>Grupo</label><input value={b.grupo ?? ''} onChange={(e) => onCambio({ grupo: e.target.value || undefined })} /></div>
            <Num etiqueta="Series" valor={b.series} onCambio={(v) => onCambio({ series: v })} />
            <Num etiqueta="Reps actuales" valor={b.reps} onCambio={(v) => onCambio({ reps: v })} />
            <Num etiqueta={b.admiteAyuda ? 'Con ayuda (+)' : 'Extra (+)'} valor={b.repsExtra} onCambio={(v) => onCambio({ repsExtra: v > 0 ? v : undefined })} />
            <Num etiqueta="Reps tope" valor={b.repsTope} onCambio={(v) => onCambio({ repsTope: v })} />
            <Num etiqueta="Peso (kg, 0 = corporal)" valor={b.peso} paso={0.5} onCambio={(v) => onCambio({ peso: v })} />
            <Num etiqueta="Descanso (s)" valor={b.descanso} paso={15} onCambio={(v) => onCambio({ descanso: v })} />
            <Num etiqueta="Sombra (s)" valor={b.sombra} paso={5} onCambio={(v) => onCambio({ sombra: v })} />
          </div>
          <div className="campo"><label>Nota</label><input value={b.nota ?? ''} onChange={(e) => onCambio({ nota: e.target.value || undefined })} /></div>
          <label className="fila" style={{ gap: 8 }}>
            <input type="checkbox" checked={!!b.admiteAyuda} onChange={(e) => onCambio({ admiteAyuda: e.target.checked || undefined })} />
            <span>Admite reps con ayuda <span className="texto-3 chico">(se anotan aparte: «8 +3 ayuda»; no cuentan para récord ni para subir peso, sí para el volumen)</span></span>
          </label>
          <p className="ayuda"><b>Reps actuales</b>: las que hiciste la vez pasada en la serie 1 con {kg(b.peso)}{b.tramoDesde ? ` (desde el ${b.tramoDesde.slice(8)}/${b.tramoDesde.slice(5, 7)})` : ''}; cada vez que las superás es récord y quedan las nuevas. Al llegar a {b.repsTope}, subís el peso: ahí empieza un tramo nuevo y la primera sesión fija las reps actuales.</p>
        </>
      )}
      {(b.tipo === 'calentamiento' || b.tipo === 'temporizador') && (
        <div className="rejilla-2">
          <Num etiqueta={b.tipo === 'temporizador' && b.modo === 'cronometro' ? 'Objetivo (s) · sube 1 s solo al superarlo' : 'Segundos'} valor={b.segundos} paso={b.tipo === 'temporizador' && b.modo === 'cronometro' ? 1 : 5} onCambio={(v) => onCambio({ segundos: v })} />
          <Num etiqueta="Peso (kg)" valor={b.peso} paso={0.5} onCambio={(v) => onCambio({ peso: v || undefined })} />
          {b.tipo === 'temporizador' && b.modo === 'cronometro' && <Num etiqueta="Descanso después, sin sombra (s)" valor={b.descansoDespues ?? 60} paso={15} onCambio={(v) => onCambio({ descansoDespues: v })} />}
          {b.tipo === 'temporizador' && (
            <div className="campo"><label>Tipo</label><button className="boton" onClick={() => onCambio({ modo: b.modo === 'cronometro' ? 'cuenta' : 'cronometro' })}>{b.modo === 'cronometro' ? 'Cronómetro (cuenta para arriba)' : 'Cuenta regresiva'}</button></div>
          )}
        </div>
      )}
      {b.tipo === 'rondas' && b.rondas.map((x, i) => (
        <div key={i} className="rejilla-2">
          <Num etiqueta={`Ronda ${i + 1} (s)`} valor={x.segundos} paso={5} onCambio={(v) => onCambio({ rondas: b.rondas.map((y, j) => (j === i ? { ...y, segundos: v } : y)) })} />
          <div className="campo"><label>Texto</label><input value={x.texto} onChange={(e) => onCambio({ rondas: b.rondas.map((y, j) => (j === i ? { ...y, texto: e.target.value } : y)) })} /></div>
        </div>
      ))}
      {b.tipo === 'rondas' && (
        <div className="rejilla-2">
          <Num etiqueta="Descanso entre rondas (s)" valor={b.descansoEntre ?? 60} paso={15} onCambio={(v) => onCambio({ descansoEntre: v })} />
          <div className="campo"><label>Rondas</label><div className="fila" style={{ gap: 6 }}>
            <button className="boton chico" onClick={() => onCambio({ rondas: [...b.rondas, { segundos: 60, texto: `Ronda ${b.rondas.length + 1}` }] })}>+ ronda</button>
            <button className="boton chico" disabled={b.rondas.length <= 1} onClick={() => onCambio({ rondas: b.rondas.slice(0, -1) })}>− ronda</button>
          </div></div>
        </div>
      )}
      <div className="botonera">
        {onGrafico && <button className="boton" onClick={onGrafico}>Ver progreso</button>}
        {onSumar && <button className="boton" onClick={onSumar}>🔗 Sumar a otra rutina</button>}
        <button className="boton peligro" onClick={onQuitar}>{enlazadas.length ? 'Quitar de esta rutina' : 'Quitar'}</button>
      </div>
    </div>
  )
}

export function HistorialEjercicio({ b }: { b: BloqueEjercicio }) {
  const h = useDatos(() => historialEjercicio(b.id), [b.id])
  if (!h.datos) return <p className="vacio">Cargando…</p>
  const { puntos, record } = h.datos
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="fila entre">
        <span className="texto-2">Récord <span className="texto-3 chico">(mejor serie)</span></span>
        <b className="mono">{record ? `${record.reps} reps · ${kg(record.peso)}` : '—'}</b>
      </div>
      {puntos.length ? <GraficoEjercicio puntos={puntos} /> : <p className="ayuda">Todavía no hay entrenos con este ejercicio. Después del primero vas a ver acá cómo suben el peso y las repeticiones.</p>}
      {puntos.length > 0 && <p className="ayuda">Barras: peso de cada entreno · línea: repeticiones totales · ★ récord.</p>}
    </div>
  )
}

/** Peso (barras) y repeticiones totales (línea) de cada entreno. */
export function GraficoEjercicio({ puntos }: { puntos: PuntoEjercicio[] }) {
  const W = 320
  const H = 140
  const pad = { i: 30, d: 30, a: 14, b: 22 }
  const ancho = W - pad.i - pad.d
  const alto = H - pad.a - pad.b
  const maxP = Math.max(1, ...puntos.map((p) => p.peso))
  const maxR = Math.max(1, ...puntos.map((p) => p.repsTotal))
  const minR = Math.min(...puntos.map((p) => p.repsTotal))
  const rangoR = Math.max(1, maxR - Math.min(minR, maxR - 4))
  const baseR = maxR - rangoR
  const paso = ancho / puntos.length
  const x = (i: number) => pad.i + paso * i + paso / 2
  const yR = (r: number) => pad.a + alto - ((r - baseR) / rangoR) * alto * 0.9
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yR(p.repsTotal).toFixed(1)}`).join(' ')
  return (
    <svg className="grafico-ejercicio" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Progreso en ${puntos.length} entrenos`}>
      <line x1={pad.i} x2={W - pad.d} y1={pad.a + alto} y2={pad.a + alto} className="eje" />
      {puntos.map((p, i) => {
        const h = p.peso ? (p.peso / maxP) * alto * 0.85 : 2
        return <rect key={i} x={x(i) - Math.min(14, paso * 0.32)} width={Math.min(28, paso * 0.64)} y={pad.a + alto - h} height={h} rx={3} className={`barra-peso ${p.record ? 'record' : ''}`} />
      })}
      <path d={linea} className="linea-reps" fill="none" />
      {puntos.map((p, i) => <circle key={i} cx={x(i)} cy={yR(p.repsTotal)} r={3.5} className="punto-reps" />)}
      {puntos.map((p, i) => p.record && <text key={`r${i}`} x={x(i)} y={yR(p.repsTotal) - 8} textAnchor="middle" className="estrella">★</text>)}
      <text x={pad.i - 4} y={pad.a + 8} textAnchor="end" className="etq">{maxP ? `${String(maxP).replace('.', ',')}` : ''}</text>
      <text x={pad.i - 4} y={pad.a + 20} textAnchor="end" className="etq">kg</text>
      <text x={W - pad.d + 4} y={yR(maxR) + 4} className="etq reps">{maxR}</text>
      <text x={W - pad.d + 4} y={yR(maxR) + 16} className="etq reps">reps</text>
      {puntos.map((p, i) => (puntos.length <= 8 || i % Math.ceil(puntos.length / 8) === 0) && <text key={`f${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="etq">{p.fecha.slice(8)}/{p.fecha.slice(5, 7)}</text>)}
    </svg>
  )
}

/** Historial de entrenos: todos quedan guardados (aunque ese día bajes). Tocar una serie la corrige. */
export function HistorialEntrenos() {
  const datos = useDatos(async () => {
    const sesiones = (await db().sesionesEntreno.filter((s) => s.estado === 'terminada').toArray()).sort((a, b) => (b.fin ?? b.inicio) - (a.fin ?? a.inicio))
    const rutinas = new Map((await listarRutinas(true, true)).map((r) => [r.id, r]))
    return { sesiones, rutinas }
  }, [])
  const [corregir, setCorregir] = useState<{ s: SesionEntreno; x: SerieHecha; b?: BloqueEjercicio } | null>(null)
  const d = datos.datos
  return (
    <>
      <Atras a="/mas/rutinas" texto="Mis rutinas" />
      <h1>Historial de entrenos</h1>
      <p className="texto-2 chico">Cada entreno queda guardado tal cual, aunque ese día hayas hecho menos. El récord se guarda aparte y no se pisa. Tocá una serie para corregirla (no cambia el XP).</p>
      {!d ? <p className="vacio">Cargando…</p> : d.sesiones.length === 0 ? <p className="vacio">Todavía no terminaste ningún entreno.</p> : d.sesiones.map((s) => {
        const r = d.rutinas.get(s.rutinaId)
        const ids = [...new Set(s.series.map((x) => x.bloqueId))]
        return (
          <Tarjeta key={s.id} compacta>
            <div className="fila entre"><b>{fechaLegible(s.fecha, false)}</b><span className="texto-3 chico">{r?.nombre.split(' · ')[0] ?? s.rutinaId}</span></div>
            {ids.map((id) => {
              const b = r?.bloques.find((x) => x.id === id)
              const series = s.series.filter((x) => x.bloqueId === id).sort((a, c) => a.n - c.n)
              return (
                <div key={id} className="hist-ejercicio">
                  <span className="chico">{b?.nombre ?? id}</span>
                  <div className="chips-mini">
                    {series.map((x) => (
                      <button key={x.n} className="hist-serie mono" onClick={() => setCorregir({ s, x, b: b?.tipo === 'ejercicio' ? b : undefined })}>
                        S{x.n} {x.reps}{x.repsExtra ? `+${x.repsExtra}` : ''}{x.ayuda ? ` +${x.ayuda} ayuda` : ''} × {kg(x.peso)} ✎
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {(s.tiempos ?? []).map((x) => <div key={x.bloqueId} className="fila entre chico"><span>{x.nombre}</span><span className="mono">{Math.floor(x.segundos / 60)}:{String(x.segundos % 60).padStart(2, '0')} · {kg(x.peso)}</span></div>)}
          </Tarjeta>
        )
      })}
      <Hoja abierta={!!corregir} onCerrar={() => setCorregir(null)} titulo={corregir ? `Corregir serie ${corregir.x.n}` : ''}>
        {corregir && <CorregirHistorial key={`${corregir.s.id}:${corregir.x.bloqueId}:${corregir.x.n}`} {...corregir} onListo={() => setCorregir(null)} />}
      </Hoja>
    </>
  )
}

function CorregirHistorial({ s, x, b, onListo }: { s: SesionEntreno; x: SerieHecha; b?: BloqueEjercicio; onListo: () => void }) {
  const [reps, setReps] = useState(x.reps)
  const [extra, setExtra] = useState(x.repsExtra ?? 0)
  const [ayuda, setAyuda] = useState(x.ayuda ?? 0)
  const [peso, setPeso] = useState(x.peso)
  const guardar = async () => {
    await mutar(() => corregirSerie(s.id!, x.bloqueId, x.n, { reps, peso, ...(b?.admiteAyuda ? { ayuda } : x.repsExtra !== undefined || extra ? { repsExtra: extra } : {}) }))
    avisar('Serie corregida', { tipo: 'ok' })
    onListo()
  }
  return (
    <div className="col" style={{ gap: 8 }}>
      <p className="texto-2 chico">{b?.nombre ?? x.bloqueId} · {fechaLegible(s.fecha, false)}</p>
      <div className="rejilla-2">
        <Num etiqueta="Reps" valor={reps} onCambio={setReps} />
        {b?.admiteAyuda ? <Num etiqueta="Con ayuda (+)" valor={ayuda} onCambio={setAyuda} /> : <Num etiqueta="Extra (+)" valor={extra} onCambio={setExtra} />}
        <Num etiqueta="Peso (kg)" valor={peso} paso={0.5} onCambio={setPeso} />
      </div>
      <button className="boton primario ancho" onClick={() => void guardar()}>Guardar corrección</button>
    </div>
  )
}

const CLAVE_BORRADOR = 'rutina-borrador:'
function leerBorrador(id: string): Rutina | null {
  try { const t = localStorage.getItem(CLAVE_BORRADOR + id); return t ? (JSON.parse(t) as Rutina) : null } catch { return null }
}
function guardarBorrador(r: Rutina): void {
  try { localStorage.setItem(CLAVE_BORRADOR + r.id, JSON.stringify(r)) } catch { /* sin espacio: queda el guardado normal */ }
}
function borrarBorrador(id: string): void {
  try { localStorage.removeItem(CLAVE_BORRADOR + id) } catch { /* nada */ }
}
