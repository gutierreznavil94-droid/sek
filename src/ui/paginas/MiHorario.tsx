/**
 * Mi horario: la grilla de la semana dentro del Calendario, la línea del día en Hoy y los
 * bloques del día elegido en el calendario. Todo editable: tocar un bloque lo abre, mantener
 * apretado lo copia a otros días.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BloqueHorario, TipoBloque } from '../../data/tipos'
import { nombreDiaSemana, type FechaDia } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import {
  ID_BLOQUE_ENTRENO, PLANTILLAS, activarHorario, apagarBloqueEnFecha, bloquesDelDia, borrarBloque, borrarHorario, configHorario, copiarADias, correrEntreno,
  encenderBloqueEnFecha, guardarBloque, horarioActivo, huecosDelDia, momento, nuevoHorario, renombrarHorario, textoMomento, type BloqueDia,
} from '../../services/horario'
import { db } from '../../data/db'
import { minutosDe } from '../../domain/fechas'
import { Atras, Confirmar, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos, useTic } from '../estado'

const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0]
const H0 = 6
const H1 = 24
const PX_HORA = 22

const NOMBRE_TIPO: Record<TipoBloque, string> = { obligatorio: 'Obligatorio', entreno: 'Entreno', otro: 'Otro' }

// ---------- Página ----------

export function MiHorario() {
  const datos = useDatos(async () => {
    const c = await configHorario()
    const h = c.horarios.find((x) => x.id === c.activo) ?? c.horarios[0]
    const a = await obtenerAjustes()
    const entreno = await db().acciones.get('entrenamiento')
    const bloqueEntreno: BloqueHorario | null = entreno?.activa ? { id: ID_BLOQUE_ENTRENO, nombre: entreno.nombre, tipo: 'entreno', dias: entreno.dias, desde: entreno.hora ?? '19:00', hasta: entreno.horaLimiteInicio ?? entreno.hora ?? '19:35' } : null
    return { c, h, dormir: { desde: a.horaDormido, hasta: a.horaFinSuenio ?? '06:00' }, bloqueEntreno, duracionEntreno: entreno?.duracionMinutos ?? entreno?.minutosMinimos ?? 42 }
  }, [])
  const [editor, setEditor] = useState<BloqueHorario | 'nuevo' | null>(null)
  const [copiar, setCopiar] = useState<BloqueHorario | null>(null)
  const [horarios, setHorarios] = useState(false)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const bloques: BloqueHorario[] = [...d.h.bloques, ...(d.bloqueEntreno ? [d.bloqueEntreno] : [])]
  return (
    <>
      <Atras a="/calendario" texto="Calendario" />
      <div className="fila entre">
        <h1>Mi horario</h1>
        <button className="boton chico suave" onClick={() => setHorarios(true)}>{d.h.nombre} ▾</button>
      </div>
      <p className="texto-2 chico">Cargá tus bloques fijos y la app ya sabe dónde estás: avisos callados en los obligatorios, huecos libres para lo tuyo, entreno a su hora.</p>
      <Tarjeta>
        <Grilla bloques={bloques} dormir={d.dormir} duracionEntreno={d.duracionEntreno} onTocar={(b) => setEditor(b)} onMantener={(b) => setCopiar(b)} />
        <div className="hor-leyenda chico texto-2">
          <span><i className="hor-muestra obligatorio" /> obligatorio</span>
          <span><i className="hor-muestra entreno" /> entreno</span>
          <span><i className="hor-muestra otro" /> otro</span>
          <span><i className="hor-muestra dormir" /> dormir</span>
        </div>
        <p className="ayuda">Tocá un bloque para editarlo · mantené apretado para copiarlo a otros días. Dormir sale de tus horarios de sueño.</p>
      </Tarjeta>
      <button className="boton primario grande ancho" onClick={() => setEditor('nuevo')}>+ Bloque</button>
      <div className="chips">
        {PLANTILLAS.map((p) => (
          <button key={p.id} type="button" onClick={() => setEditor({ id: '', nombre: p.nombre, tipo: p.tipo, dias: p.dias, desde: p.desde, hasta: p.hasta })}>{p.nombre}</button>
        ))}
        {d.bloqueEntreno && <button type="button" onClick={() => setEditor(d.bloqueEntreno!)}>Entreno</button>}
      </div>
      {bloques.length === 0 && <p className="ayuda centro">Todavía sin bloques. Empezá por una plantilla: Cursada, Trabajo o Entreno.</p>}
      {editor && <EditorBloque b={editor === 'nuevo' ? undefined : editor} onCerrar={() => setEditor(null)} />}
      {copiar && <CopiarADias b={copiar} onCerrar={() => setCopiar(null)} />}
      <Hoja abierta={horarios} onCerrar={() => setHorarios(false)} titulo="Horarios guardados">
        <Horarios activo={d.c.activo} lista={d.c.horarios} onCerrar={() => setHorarios(false)} />
      </Hoja>
    </>
  )
}

function Grilla({ bloques, dormir, duracionEntreno, onTocar, onMantener }: { bloques: BloqueHorario[]; dormir: { desde: string; hasta: string }; duracionEntreno: number; onTocar: (b: BloqueHorario) => void; onMantener: (b: BloqueHorario) => void }) {
  const alto = (H1 - H0) * PX_HORA
  const y = (hm: string) => ((minutosDe(hm) - H0 * 60) / 60) * PX_HORA
  const timer = useRef<number | null>(null)
  const largo = useRef(false)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  return (
    <div className="hor-grilla" style={{ height: alto + 22 }}>
      <div className="hor-horas" aria-hidden>
        {Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i).filter((h) => h % 2 === 0).map((h) => <span key={h} style={{ top: 22 + (h - H0) * PX_HORA }}>{h}</span>)}
      </div>
      {DIAS_ORDEN.map((ds) => (
        <div key={ds} className="hor-col">
          <div className="hor-cab">{nombreDiaSemana(ds, true).slice(0, 2)}</div>
          <div className="hor-dia" style={{ height: alto }}>
            {Array.from({ length: H1 - H0 }, (_, i) => <i key={i} className="hor-raya" style={{ top: i * PX_HORA }} />)}
            {/* Dormir */}
            <div className="hor-bloque dormir" style={{ top: Math.max(0, y(dormir.desde)), height: Math.max(0, alto - Math.max(0, y(dormir.desde))) }} aria-hidden />
            {minutosDe(dormir.hasta) > H0 * 60 && <div className="hor-bloque dormir" style={{ top: 0, height: y(dormir.hasta) }} aria-hidden />}
            {bloques.filter((b) => b.dias.includes(ds)).map((b) => {
              const top = Math.max(0, y(b.desde))
              const fin = b.tipo === 'entreno' ? y(b.hasta) + (duracionEntreno / 60) * PX_HORA : y(b.hasta)
              const h = Math.max(10, Math.min(alto, fin) - top)
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`hor-bloque ${b.tipo}`}
                  style={{ top, height: h }}
                  onPointerDown={() => { largo.current = false; timer.current = window.setTimeout(() => { largo.current = true; onMantener(b) }, 500) }}
                  onPointerUp={() => { if (timer.current) window.clearTimeout(timer.current) }}
                  onPointerLeave={() => { if (timer.current) window.clearTimeout(timer.current) }}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { if (largo.current) { largo.current = false; return } onTocar(b) }}
                  aria-label={`${b.nombre}, ${nombreDiaSemana(ds)} ${b.desde} a ${b.hasta}. Tocá para editar`}
                >
                  <span>{b.nombre}</span>
                  {h >= 30 && <span className="hor-hora">{b.desde}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function EditorBloque({ b, onCerrar }: { b?: BloqueHorario; onCerrar: () => void }) {
  const esEntreno = b?.id === ID_BLOQUE_ENTRENO
  const [nombre, setNombre] = useState(b?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoBloque>(b?.tipo ?? 'obligatorio')
  const [dias, setDias] = useState<number[]>(b?.dias ?? [1, 2, 3, 4, 5])
  const [desde, setDesde] = useState(b?.desde ?? '08:00')
  const [hasta, setHasta] = useState(b?.hasta ?? '12:00')
  const [borrar, setBorrar] = useState(false)
  const guardar = async () => {
    try {
      await mutar(() => guardarBloque({ id: b?.id || undefined, nombre, tipo: esEntreno ? 'entreno' : tipo, dias, desde, hasta }))
      avisar(esEntreno ? 'Entreno guardado: días, hora y «Empezar hasta»' : b?.id ? 'Bloque guardado' : 'Bloque agregado', { tipo: 'ok' })
      onCerrar()
    } catch (e) { avisar(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={esEntreno ? 'Entreno' : b?.id ? 'Editar bloque' : 'Nuevo bloque'}>
      <div className="col" style={{ gap: 10 }}>
        <div className="campo"><label>Nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Facultad" maxLength={40} autoFocus={!b} /></div>
        {!esEntreno && (
          <div className="col" style={{ gap: 4 }}>
            <span className="seccion-titulo">Tipo</span>
            <div className="chips">
              {(['obligatorio', 'otro'] as TipoBloque[]).map((t) => <button key={t} type="button" className={tipo === t ? 'activo' : ''} onClick={() => setTipo(t)}>{NOMBRE_TIPO[t]}</button>)}
            </div>
            <span className="ayuda">{tipo === 'obligatorio' ? 'Colegio, facultad, trabajo: sin avisos mientras dura; un aviso solo al salir. Los feriados lo apagan.' : 'Cualquier cosa fija de la semana. No calla los avisos.'}</span>
          </div>
        )}
        <div className="col" style={{ gap: 4 }}>
          <span className="seccion-titulo">Días</span>
          <div className="hor-dias">
            {DIAS_ORDEN.map((ds) => <button key={ds} type="button" className={dias.includes(ds) ? 'activo' : ''} aria-pressed={dias.includes(ds)} onClick={() => setDias(dias.includes(ds) ? dias.filter((x) => x !== ds) : [...dias, ds])}>{nombreDiaSemana(ds, true).slice(0, 2)}</button>)}
          </div>
        </div>
        <div className="rejilla-2">
          <div className="campo"><label>{esEntreno ? 'Hora habitual' : 'Desde'}</label><input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="campo"><label>{esEntreno ? 'Empezar hasta' : 'Hasta'}</label><input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        </div>
        {esEntreno && <span className="ayuda">Varía un poco cada día: desde Hoy lo corrés («hoy a las 19:30») sin tocar esto. Si empieza después de «Empezar hasta», el pilar queda tarde.</span>}
        <button className="boton primario ancho" disabled={!nombre.trim() || !dias.length} onClick={guardar}>Guardar</button>
        {b?.id && !esEntreno && <button className="boton suave ancho" onClick={() => setBorrar(true)}>Borrar bloque</button>}
      </div>
      <Confirmar abierta={borrar} titulo="¿Borrar este bloque?" texto={`«${nombre}» sale de la semana.`} confirmar="Borrar" peligro onConfirmar={async () => { setBorrar(false); if (b) await mutar(() => borrarBloque(b.id)); avisar('Bloque borrado'); onCerrar() }} onCancelar={() => setBorrar(false)} />
    </Hoja>
  )
}

function CopiarADias({ b, onCerrar }: { b: BloqueHorario; onCerrar: () => void }) {
  const [dias, setDias] = useState<number[]>([])
  const libres = DIAS_ORDEN.filter((ds) => !b.dias.includes(ds))
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={`Copiar «${b.nombre}» a…`}>
      {libres.length === 0 ? <p className="texto-2">Ya está todos los días.</p> : (
        <div className="hor-dias">
          {libres.map((ds) => <button key={ds} type="button" className={dias.includes(ds) ? 'activo' : ''} onClick={() => setDias(dias.includes(ds) ? dias.filter((x) => x !== ds) : [...dias, ds])}>{nombreDiaSemana(ds, true).slice(0, 2)}</button>)}
        </div>
      )}
      <button className="boton primario ancho" style={{ marginTop: 10 }} disabled={!dias.length} onClick={async () => { await mutar(() => copiarADias(b.id, dias)); avisar(`${b.nombre}: copiado a ${dias.length} día${dias.length === 1 ? '' : 's'}`, { tipo: 'ok' }); onCerrar() }}>Copiar</button>
    </Hoja>
  )
}

function Horarios({ activo, lista, onCerrar }: { activo: string; lista: { id: string; nombre: string; bloques: BloqueHorario[] }[]; onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [renombrar, setRenombrar] = useState<string | null>(null)
  const [borrar, setBorrar] = useState<string | null>(null)
  return (
    <div className="col" style={{ gap: 10 }}>
      <p className="ayuda">Dos horarios distintos (por ejemplo «Cuatrimestre» y «Vacaciones») y los cambiás con un toque.</p>
      {lista.map((h) => (
        <div key={h.id} className="fila entre" style={{ gap: 6 }}>
          {renombrar === h.id ? (
            <input autoFocus className="crece" defaultValue={h.nombre} onBlur={async (e) => { await mutar(() => renombrarHorario(h.id, e.target.value)); setRenombrar(null) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} aria-label="Nombre del horario" />
          ) : (
            <button className={`boton crece ${h.id === activo ? 'primario' : ''}`} onClick={async () => { if (h.id !== activo) { await mutar(() => activarHorario(h.id)); avisar(`Horario: ${h.nombre}`, { tipo: 'ok' }) } onCerrar() }}>{h.nombre}<span className="chico texto-3"> · {h.bloques.length} bloque{h.bloques.length === 1 ? '' : 's'}</span></button>
          )}
          <button className="boton chico suave" aria-label={`Renombrar ${h.nombre}`} onClick={() => setRenombrar(h.id)}>✎</button>
          <button className="boton chico suave" aria-label={`Borrar ${h.nombre}`} disabled={lista.length <= 1} onClick={() => setBorrar(h.id)}>✕</button>
        </div>
      ))}
      <div className="fila" style={{ gap: 6 }}>
        <input className="crece" placeholder="Nuevo horario (ej.: Vacaciones)" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del horario nuevo" />
        <button className="boton" disabled={!nombre.trim()} onClick={async () => { await mutar(() => nuevoHorario(nombre)); setNombre(''); avisar('Horario creado y en uso. Cargale bloques.', { tipo: 'ok' }); onCerrar() }}>Crear</button>
      </div>
      <Confirmar abierta={!!borrar} titulo="¿Borrar este horario?" texto="Se borran sus bloques. Las excepciones por fecha quedan." confirmar="Borrar" peligro onConfirmar={async () => { if (borrar) await mutar(() => borrarHorario(borrar)); setBorrar(null); avisar('Horario borrado') }} onCancelar={() => setBorrar(null)} />
    </div>
  )
}

// ---------- Hoy: la línea del día ----------

export function LineaDelDia({ hoy }: { hoy: FechaDia }) {
  const tic = useTic(60_000)
  const datos = useDatos(async () => ({ bloques: await bloquesDelDia(hoy), m: await momento(hoy, Date.now()), zona: (await obtenerAjustes()).zonaHoraria, h: await horarioActivo() }), [hoy, Math.floor(tic / 60_000)])
  const [correr, setCorrer] = useState(false)
  const d = datos.datos
  if (!d) return null
  const visibles = d.bloques.filter((b) => b.tipo !== 'dormir')
  const sinHorario = d.h.bloques.length === 0
  const minAhora = (() => { const x = new Date(tic); return x.getHours() * 60 + x.getMinutes() })()
  const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - H0 * 60) / ((H1 - H0) * 60)) * 100))}%`
  const entreno = visibles.find((b) => b.id === ID_BLOQUE_ENTRENO)
  return (
    <section className="hor-linea" aria-label="Mi horario de hoy">
      <Link to="/calendario/horario" className="hor-linea-link">
        <div className="hor-barra" aria-hidden>
          {visibles.map((b) => <span key={b.id} className={`hor-tramo ${b.tipo}`} style={{ left: pct(b.min), width: `calc(${pct(b.max)} - ${pct(b.min)})` }} title={`${b.nombre} ${b.desde}–${b.hasta}`} />)}
          <span className="hor-ahora" style={{ left: pct(minAhora) }} />
        </div>
        <span className="chico texto-2 hor-texto">{sinHorario && !entreno ? 'Mi horario: cargá tus bloques fijos y la app se adapta ›' : textoMomento(d.m)}</span>
      </Link>
      {entreno && entreno.min > minAhora - 30 && <button className="boton chico suave hor-correr" onClick={() => setCorrer(true)}>Hoy a las…</button>}
      {correr && entreno && <CorrerEntreno hoy={hoy} actual={entreno.desde} onCerrar={() => setCorrer(false)} />}
    </section>
  )
}

function CorrerEntreno({ hoy, actual, onCerrar }: { hoy: FechaDia; actual: string; onCerrar: () => void }) {
  const [hora, setHora] = useState(actual)
  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Entreno de hoy">
      <p className="ayuda">Solo hoy. La semana sigue igual.</p>
      <div className="campo"><label>Hoy a las</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
      <button className="boton primario ancho" onClick={async () => { try { await mutar(() => correrEntreno(hoy, hora)); avisar(`Entreno hoy a las ${hora}`, { tipo: 'ok' }); onCerrar() } catch (e) { avisar(e instanceof Error ? e.message : String(e)) } }}>Guardar</button>
    </Hoja>
  )
}

// ---------- Calendario: bloques y huecos del día elegido ----------

export function HorarioDelDia({ fecha, hoy }: { fecha: FechaDia; hoy: FechaDia }) {
  const datos = useDatos(async () => ({ bloques: (await bloquesDelDia(fecha, { conApagados: true })).filter((b) => b.tipo !== 'dormir'), huecos: await huecosDelDia(fecha) }), [fecha])
  const d = datos.datos
  if (!d || (d.bloques.length === 0)) return null
  const alternar = async (b: BloqueDia) => {
    if (b.origen === 'fechaClave') return
    if (b.apagado && b.motivoApagado === 'feriado') return avisar('Feriado: los obligatorios no van. Para que vaya, quitá el feriado.')
    await mutar(() => (b.apagado ? encenderBloqueEnFecha(fecha, b.id) : apagarBloqueEnFecha(fecha, b.id)))
    avisar(b.apagado ? `${b.nombre}: vuelve ese día` : `${b.nombre}: ese día no hay`)
  }
  return (
    <div className="hor-dia-lista">
      <div className="fila entre"><span className="seccion-titulo">Horario</span><Link to="/calendario/horario" className="chico texto-3">Mi horario ›</Link></div>
      {d.bloques.map((b) => (
        <button key={b.id} type="button" className={`hor-dia-fila ${b.tipo} ${b.apagado ? 'apagado' : ''}`} onClick={() => alternar(b)} aria-label={`${b.nombre} ${b.desde} a ${b.hasta}${b.apagado ? ', apagado ese día' : ''}. Tocá para ${b.apagado ? 'encender' : 'apagar'} ese día`} disabled={b.origen === 'fechaClave'}>
          <i className={`hor-muestra ${b.tipo}`} aria-hidden />
          <span className="crece">{b.nombre}<span className="texto-3 chico"> · {b.desde}–{b.hasta}{b.variable ? ' · hoy' : ''}</span></span>
          <span className="chico texto-3">{b.apagado ? (b.motivoApagado === 'feriado' ? 'feriado' : 'no hay') : fecha >= hoy && b.origen !== 'fechaClave' ? 'apagar' : ''}</span>
        </button>
      ))}
      {fecha >= hoy && d.huecos.length > 0 && <p className="chico texto-2" style={{ margin: 0 }}>Libre: {d.huecos.map((h) => `${h.desde}–${h.hasta} (${h.minutos >= 60 ? `${Math.floor(h.minutos / 60)} h${h.minutos % 60 ? ` ${h.minutos % 60}` : ''}` : `${h.minutos} min`})`).join(' · ')}</p>}
    </div>
  )
}

