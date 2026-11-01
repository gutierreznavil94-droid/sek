import { useState } from 'react'
import type { Meta } from '../../data/tipos'
import { esFechaValida, fechaLegible, sumarDias } from '../../domain/fechas'
import { borrarMetaPropia, crearMeta, diasParaMeta, editarMeta, reabrirMeta, resolverMeta, resumenMetas, XP_META_POR_DEFECTO } from '../../services/metas'
import { Atras, Confirmar, Hoja } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/** Metas con fecha: qué querés lograr y para cuándo. Al llegar el día, verde o rojo. */
export function Metas({ hoy }: { hoy: string }) {
  const datos = useDatos(() => resumenMetas(hoy), [hoy])
  const [editar, setEditar] = useState<Meta | 'nueva' | null>(null)
  const [borrar, setBorrar] = useState<Meta | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const total = d.pendientes.length + d.vencidas.length + d.cumplidas.length + d.noCumplidas.length

  const Fila = ({ m, clase }: { m: Meta; clase: string }) => {
    const dias = diasParaMeta(m, hoy)
    return (
      <div className={`meta-fila ${clase}`}>
        <span className="punto-estado" aria-hidden />
        <div className="crece col" style={{ gap: 0 }} onClick={() => setEditar(m)}>
          <span style={{ fontWeight: 600 }}>{m.titulo}</span>
          <span className="chico texto-3">
            {fechaLegible(m.fecha)}
            {clase === 'pendiente' && ` · ${dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `faltan ${dias} días`}`}
            {clase === 'vencida' && ' · esperando respuesta'}
            {clase === 'cumplida' && ` · +${m.xp ?? XP_META_POR_DEFECTO} XP`}
            {clase === 'no_cumplida' && ' · no cumplida'}
          </span>
        </div>
        {clase === 'vencida' && (
          <div className="col" style={{ gap: 4 }}>
            <button className="boton chico ok" onClick={() => mutar(() => resolverMeta(m.id, true)).then((r) => avisar(`Meta cumplida: +${r.xp} XP`, { tipo: 'ok' }))}>Lo logré</button>
            <button className="boton chico peligro" onClick={() => mutar(() => resolverMeta(m.id, false))}>No llegué</button>
          </div>
        )}
        {(clase === 'cumplida' || clase === 'no_cumplida') && (
          <button className="boton chico suave" onClick={() => mutar(() => resolverMeta(m.id, clase === 'no_cumplida', 'Corrección desde Metas')).then(() => avisar('Corregido (queda en el historial)'))}>{clase === 'cumplida' ? 'No la logré' : 'Sí la logré'}</button>
        )}
      </div>
    )
  }

  return (
    <>
      <Atras />
      <div className="fila entre">
        <h1>Metas con fecha</h1>
        <button className="boton chico primario" onClick={() => setEditar('nueva')}>+ Nueva meta</button>
      </div>
      <p className="texto-2 chico">Qué querés lograr y para cuándo. El día que vence, Hoy te pregunta si la lograste: verde si sí, rojo si no. Cumplirla da XP una sola vez.</p>

      {total === 0 && <p className="vacio">Todavía no hay metas. Ejemplo: «Terminar el capítulo 1 del manga» para el 30 de noviembre.</p>}

      {d.vencidas.length > 0 && (
        <section className="col" style={{ gap: 4 }}>
          <span className="seccion-titulo">Esperan tu respuesta</span>
          <div>{d.vencidas.map((m) => <Fila key={m.id} m={m} clase="vencida" />)}</div>
        </section>
      )}
      {d.pendientes.length > 0 && (
        <section className="col" style={{ gap: 4 }}>
          <span className="seccion-titulo">Próximas</span>
          <div>{d.pendientes.map((m) => <Fila key={m.id} m={m} clase="pendiente" />)}</div>
        </section>
      )}
      {d.cumplidas.length > 0 && (
        <section className="col" style={{ gap: 4 }}>
          <span className="seccion-titulo ok">Cumplidas · {d.cumplidas.length}</span>
          <div>{d.cumplidas.map((m) => <Fila key={m.id} m={m} clase="cumplida" />)}</div>
        </section>
      )}
      {d.noCumplidas.length > 0 && (
        <section className="col" style={{ gap: 4 }}>
          <span className="seccion-titulo bajo">No cumplidas · {d.noCumplidas.length}</span>
          <div>{d.noCumplidas.map((m) => <Fila key={m.id} m={m} clase="no_cumplida" />)}</div>
        </section>
      )}
      <p className="ayuda">Tocá una meta para editar el título, la fecha o el XP. Las metas automáticas del ciclo (fin de fase, revisión semanal) se ven en el calendario y no se marcan en verde o rojo.</p>

      {editar && <EditarMeta meta={editar === 'nueva' ? null : editar} hoy={hoy} onCerrar={() => setEditar(null)} onBorrar={(m) => { setEditar(null); setBorrar(m) }} />}
      <Confirmar abierta={!!borrar} titulo="¿Borrar meta?" texto={borrar?.titulo} confirmar="Borrar" peligro onConfirmar={() => { mutar(() => borrarMetaPropia(borrar!.id)); setBorrar(null) }} onCancelar={() => setBorrar(null)} />
    </>
  )
}

function EditarMeta({ meta, hoy, onCerrar, onBorrar }: { meta: Meta | null; hoy: string; onCerrar: () => void; onBorrar: (m: Meta) => void }) {
  const [titulo, setTitulo] = useState(meta?.titulo ?? '')
  const [fecha, setFecha] = useState(meta?.fecha ?? sumarDias(hoy, 7))
  const [xp, setXp] = useState(meta?.xp ?? XP_META_POR_DEFECTO)
  const [nota, setNota] = useState(meta?.nota ?? '')
  const valida = titulo.trim().length > 0 && esFechaValida(fecha)
  const guardar = async () => {
    if (!valida) return
    await mutar(() => (meta ? editarMeta(meta.id, { titulo: titulo.trim(), fecha, xp, nota: nota || undefined }) : crearMeta({ titulo, fecha, xp, nota: nota || undefined })))
    avisar(meta ? 'Meta guardada' : `Meta creada para el ${fechaLegible(fecha)}`, { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={meta ? 'Editar meta' : 'Nueva meta'}>
      <div className="campo"><label>Qué querés lograr</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Terminar el capítulo 1" autoFocus /></div>
      <div className="rejilla-2">
        <div className="campo"><label>Para cuándo</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={hoy} /></div>
        <div className="campo"><label>XP si la cumplís</label><input type="number" inputMode="numeric" min={0} max={500} value={xp} onChange={(e) => setXp(Number(e.target.value))} /></div>
      </div>
      <div className="botonera">
        {[7, 14, 30].map((n) => <button key={n} className="boton chico" onClick={() => setFecha(sumarDias(hoy, n))}>en {n} días</button>)}
      </div>
      <div className="campo"><label>Nota (opcional)</label><input value={nota} onChange={(e) => setNota(e.target.value)} /></div>
      {meta && meta.estado && meta.estado !== 'pendiente' && (
        <button className="boton ancho" onClick={() => mutar(() => reabrirMeta(meta.id)).then(onCerrar)}>Volver a pendiente</button>
      )}
      <button className="boton primario ancho" disabled={!valida} onClick={guardar}>{meta ? 'Guardar' : 'Crear meta'}</button>
      {meta && <button className="boton peligro ancho" onClick={() => onBorrar(meta)}>Borrar</button>}
    </Hoja>
  )
}
