import { useState } from 'react'
import type { Accion, ReglaXp } from '../../data/tipos'
import { nombreDiaSemana } from '../../domain/fechas'
import { cambiarXpDeAccion, desactivarAccion, guardarAccion, listarAcciones, listarAtributos, reglasDeAccion, validarAccion } from '../../services/acciones'
import { obtenerAjustes } from '../../services/base'
import { reglaDeAccion } from '../../services/xp'
import { nuevoId } from '../../services/reloj'
import { Atras, Chips, Confirmar, DiasSemana, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const TIPOS: { id: Accion['tipo']; nombre: string }[] = [
  { id: 'compromiso', nombre: 'Compromiso' },
  { id: 'entrenamiento', nombre: 'Entrenamiento' },
]

export function Acciones({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => {
    const acciones = await listarAcciones()
    const reglas = new Map<string, ReglaXp | null>()
    for (const a of acciones) reglas.set(a.id, await reglaDeAccion(a.id, hoy))
    return { acciones, reglas, atributos: await listarAtributos(), ajustes: await obtenerAjustes() }
  }, [hoy])
  const [editar, setEditar] = useState<Accion | 'nueva' | null>(null)
  const [desactivar, setDesactivar] = useState<Accion | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  const activas = d.acciones.filter((a) => a.activa)
  const inactivas = d.acciones.filter((a) => !a.activa)
  const xpDe = (a: Accion) => d.reglas.get(a.id)?.xp ?? (a.tipo === 'compromiso' ? d.ajustes.xpCompromisoPorDefecto : 0)
  return (
    <>
      <Atras />
      <div className="fila entre">
        <h1>Acciones y XP</h1>
        <button className="boton chico primario" onClick={() => setEditar('nueva')}>+ Nueva</button>
      </div>
      <p className="texto-2 chico">Cada acción muestra su XP y su condición antes de hacerla. Cambiar el XP crea una regla nueva desde hoy: lo ya ganado no se toca. Además: inicio con 3-2-1 {d.ajustes.xpInicio} XP (máx. {d.ajustes.maxIniciosXpPorDia}/día), racha de 7 días {d.ajustes.xpRacha7} XP.</p>
      <Tarjeta>
        <table className="tabla">
          <thead><tr><th>Acción</th><th>Días</th><th className="num">XP</th></tr></thead>
          <tbody>
            {activas.map((a) => (
              <tr key={a.id} onClick={() => setEditar(a)} style={{ cursor: 'pointer' }}>
                <td>
                  <b>{a.nombre}</b>
                  <div className="muy-chico texto-3">{a.condicion}</div>
                  <div className="muy-chico texto-3">{a.atributoIds.map((id) => d.atributos.find((x) => x.id === id)?.nombre).filter(Boolean).join(', ')}</div>
                </td>
                <td className="chico texto-2">{a.dias.length === 7 ? 'todos' : [1, 2, 3, 4, 5, 6, 0].filter((x) => a.dias.includes(x)).map((x) => nombreDiaSemana(x, true)).join(' ')}{a.hora ? <div className="mono">{a.hora}</div> : null}</td>
                <td className="num"><b>{xpDe(a)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
      {inactivas.length > 0 && (
        <Tarjeta titulo="Desactivadas">
          {inactivas.map((a) => (
            <div key={a.id} className="fila entre chico"><span className="texto-2">{a.nombre}</span><button className="boton chico suave" onClick={() => mutar(() => guardarAccion({ ...a, activa: true }))}>Reactivar</button></div>
          ))}
        </Tarjeta>
      )}
      {editar && <EditarAccion accion={editar === 'nueva' ? null : editar} xpActual={editar === 'nueva' ? d.ajustes.xpCompromisoPorDefecto : xpDe(editar)} atributos={d.atributos} hoy={hoy} onCerrar={() => setEditar(null)} onDesactivar={(a) => { setEditar(null); setDesactivar(a) }} />}
      <Confirmar abierta={!!desactivar} titulo="¿Desactivar acción?" texto="Deja de programarse desde mañana. Su historial y su XP se conservan. Podés reactivarla después." confirmar="Desactivar" peligro onConfirmar={() => { mutar(() => desactivarAccion(desactivar!.id)); setDesactivar(null) }} onCancelar={() => setDesactivar(null)} />
    </>
  )
}

function EditarAccion({ accion, xpActual, atributos, hoy, onCerrar, onDesactivar }: { accion: Accion | null; xpActual: number; atributos: { id: string; nombre: string }[]; hoy: string; onCerrar: () => void; onDesactivar: (a: Accion) => void }) {
  const [nombre, setNombre] = useState(accion?.nombre ?? '')
  const [tipo, setTipo] = useState<Accion['tipo'][]>([accion?.tipo ?? 'compromiso'])
  const [condicion, setCondicion] = useState(accion?.condicion ?? '')
  const [dias, setDias] = useState<number[]>(accion?.dias ?? [1, 2, 3, 4, 5])
  const [hora, setHora] = useState(accion?.hora ?? '')
  const [minutosMinimos, setMinutosMinimos] = useState(accion?.minutosMinimos ?? 0)
  const [pilar, setPilar] = useState(!!accion?.pilar)
  const [horaLimite, setHoraLimite] = useState(accion?.horaLimite ?? '')
  const [pregunta, setPregunta] = useState(accion?.pregunta ?? '')
  const [atributoIds, setAtributoIds] = useState<string[]>(accion?.atributoIds ?? [])
  const [peso, setPeso] = useState(accion?.peso ?? 1)
  const [xp, setXp] = useState(xpActual)
  const [errores, setErrores] = useState<string[]>([])
  const historial = useDatos(() => (accion ? reglasDeAccion(accion.id) : Promise.resolve([])), [accion?.id])
  const fijo = accion && !['compromiso', 'entrenamiento'].includes(accion.tipo)
  const guardar = async () => {
    const base: Omit<Accion, 'creado' | 'orden'> = {
      id: accion?.id ?? nuevoId('acc'),
      nombre: nombre.trim(),
      tipo: fijo ? accion!.tipo : tipo[0],
      condicion: condicion.trim(),
      dias,
      hora: hora || undefined,
      minutosMinimos: minutosMinimos > 0 ? minutosMinimos : undefined,
      pilar: pilar || undefined,
      horaLimite: horaLimite || undefined,
      pregunta: pregunta.trim() || undefined,
      horasPorDia: accion?.horasPorDia,
      atributoIds,
      objetivoIds: accion?.objetivoIds ?? [],
      peso,
      activa: accion?.activa ?? true,
    }
    const errs = validarAccion(base)
    if (errs.length) return setErrores(errs)
    await mutar(async () => {
      await guardarAccion(base)
      if (xp !== xpActual || !accion) await cambiarXpDeAccion(base.id, xp, hoy)
    })
    avisar('Acción guardada. Los cambios aplican desde hoy.', { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={accion ? 'Editar acción' : 'Nueva acción'}>
      <div className="campo"><label>Nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Estudiar 1 hora" /></div>
      {!fijo && <div className="campo"><label>Tipo</label><Chips opciones={TIPOS} valor={tipo} onChange={setTipo} /></div>}
      {fijo && <span className="chico texto-3">Tipo: {accion!.tipo.replace('_', ' ')} (fijo: tiene lógica propia).</span>}
      <div className="campo"><label>Condición de cumplimiento</label><input value={condicion} onChange={(e) => setCondicion(e.target.value)} placeholder="Qué tiene que pasar para marcarla como hecha" /></div>
      <div className="campo"><label>Días</label><DiasSemana valor={dias} onChange={setDias} /></div>
      <div className="rejilla-2">
        <div className="campo"><label>Hora prevista</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        <div className="campo"><label>XP al completar</label><input type="number" inputMode="numeric" min={0} max={200} value={xp} onChange={(e) => setXp(Number(e.target.value))} /></div>
      </div>
      <div className="rejilla-2">
        <div className="campo"><label>Minutos mínimos para dar XP</label><input type="number" inputMode="numeric" min={0} value={minutosMinimos} onChange={(e) => setMinutosMinimos(Number(e.target.value))} /><span className="ayuda">0 = sin mínimo.</span></div>
        {(fijo ? accion!.tipo : tipo[0]) !== 'acostarse' && <div className="campo"><label>Hora límite para marcar</label><input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value)} /><span className="ayuda">Después de esta hora cuenta como tarde, sin XP.</span></div>}
      </div>
      <div className="campo"><label>Pregunta al marcar (opcional)</label><input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Ej.: ¿Qué avancé?" /></div>
      <label className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={pilar} onChange={(e) => setPilar(e.target.checked)} /> Pilar del día (aparece arriba en Hoy y cuenta en el cumplimiento diario)</label>
      <div className="campo"><label>Atributos que alimenta</label><Chips opciones={atributos} valor={atributoIds} onChange={setAtributoIds} multiple /></div>
      <div className="campo"><label>Peso en el atributo (1 a 5)</label><input type="number" inputMode="numeric" min={1} max={5} value={peso} onChange={(e) => setPeso(Number(e.target.value))} /></div>
      {historial.datos && historial.datos.length > 1 && (
        <div className="chico texto-3">Historial de XP: {historial.datos.map((r) => `${r.xp} desde ${r.validaDesde}`).join(' · ')}</div>
      )}
      {errores.map((e) => <p key={e} className="error">{e}</p>)}
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
      {accion && accion.activa && !fijo && <button className="boton peligro ancho" onClick={() => onDesactivar(accion)}>Desactivar</button>}
      {accion && accion.activa && fijo && <button className="boton suave ancho" onClick={() => onDesactivar(accion)}>Desactivar</button>}
    </Hoja>
  )
}
