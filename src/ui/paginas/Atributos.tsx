import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Atributo } from '../../data/tipos'
import { archivarAtributo, guardarAtributo, listarAcciones, listarAtributos } from '../../services/acciones'
import { atributosHoy } from '../../services/dia'
import { nuevoId } from '../../services/reloj'
import { Atras, Confirmar, Hoja, Tarjeta, clasePorcentaje } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function Atributos({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({ lista: await listarAtributos(), valores: await atributosHoy(hoy), acciones: await listarAcciones() }), [hoy])
  const [editar, setEditar] = useState<Atributo | 'nuevo' | null>(null)
  const [archivar, setArchivar] = useState<Atributo | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  return (
    <>
      <Atras />
      <div className="fila entre">
        <h1>Atributos</h1>
        <button className="boton chico" onClick={() => setEditar('nuevo')}>+ Nuevo</button>
      </div>
      <p className="texto-2 chico">Cada atributo es el % de cumplimiento de las acciones vinculadas en una ventana móvil. Sube o baja. Vinculá acciones desde <Link to="/mas/acciones">Acciones</Link>.</p>
      {d.lista.map((a) => {
        const v = d.valores.find((x) => x.atributoId === a.id)
        const acciones = d.acciones.filter((ac) => ac.activa && ac.atributoIds.includes(a.id))
        return (
          <Tarjeta key={a.id} compacta>
            <div className="fila entre">
              <div className="crece">
                <b>{a.nombre}</b>
                <div className="chico texto-2">{a.descripcion}</div>
              </div>
              <span className={`grande ${clasePorcentaje(v?.valor ?? null)}`}>{v?.valor ?? '—'}</span>
            </div>
            <div className="chico texto-3">Ventana: {a.ventanaDias} días · Acciones: {acciones.length ? acciones.map((x) => x.nombre).join(', ') : 'ninguna'}</div>
            <div className="fila" style={{ gap: 6 }}>
              <button className="boton chico" onClick={() => setEditar(a)}>Editar</button>
              <button className="boton chico suave" onClick={() => setArchivar(a)}>Archivar</button>
            </div>
          </Tarjeta>
        )
      })}
      {editar && <EditarAtributo atributo={editar === 'nuevo' ? null : editar} orden={d.lista.length + 1} onCerrar={() => setEditar(null)} />}
      <Confirmar abierta={!!archivar} titulo="¿Archivar atributo?" texto="Deja de mostrarse. Su historial se conserva y las acciones vinculadas siguen existiendo." confirmar="Archivar" peligro onConfirmar={() => { mutar(() => archivarAtributo(archivar!.id)); setArchivar(null) }} onCancelar={() => setArchivar(null)} />
    </>
  )
}

function EditarAtributo({ atributo, orden, onCerrar }: { atributo: Atributo | null; orden: number; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(atributo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(atributo?.descripcion ?? '')
  const [ventana, setVentana] = useState(atributo?.ventanaDias ?? 14)
  const [error, setError] = useState('')
  const guardar = async () => {
    try {
      await mutar(() => guardarAtributo({ id: atributo?.id ?? nuevoId('atr'), nombre: nombre.trim(), descripcion: descripcion.trim(), ventanaDias: ventana, orden: atributo?.orden ?? orden }))
      avisar('Atributo guardado', { tipo: 'ok' })
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={atributo ? 'Editar atributo' : 'Nuevo atributo'}>
      <div className="campo"><label>Nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="campo"><label>Descripción</label><input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
      <div className="campo"><label>Ventana de cálculo (días)</label><input type="number" inputMode="numeric" min={3} max={60} value={ventana} onChange={(e) => setVentana(Number(e.target.value))} /><span className="ayuda">Cuántos días hacia atrás se miran para calcular el valor. 14 es un buen punto de partida.</span></div>
      {error && <p className="error">{error}</p>}
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
