import { useState } from 'react'
import type { Fase, Objetivo } from '../../data/tipos'
import { listarAtributos } from '../../services/acciones'
import { archivarObjetivo, estadoDelCiclo, fasesDelCiclo, guardarFase, guardarObjetivo, objetivosDelCiclo } from '../../services/ciclo'
import { Atras, Chips, Confirmar, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

export function Objetivos({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => {
    const estado = await estadoDelCiclo(hoy)
    if (!estado) return null
    return { estado, fases: await fasesDelCiclo(estado.ciclo.id), objetivos: await objetivosDelCiclo(estado.ciclo.id), atributos: await listarAtributos() }
  }, [hoy])
  const [editar, setEditar] = useState<{ fase: number; objetivo: Objetivo | null } | null>(null)
  const [editarFase, setEditarFase] = useState<Fase | null>(null)
  const [borrar, setBorrar] = useState<Objetivo | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  return (
    <>
      <Atras />
      <h1>Objetivos y fases</h1>
      <p className="texto-2 chico">Las fases son etapas de evaluación, no desbloquean nada. Cada objetivo pertenece a un atributo y tiene un indicador medible.</p>
      {d.fases.map((f) => {
        const objs = d.objetivos.filter((o) => o.faseNumero === f.numero)
        const actual = f.numero === d.estado.faseNumero
        return (
          <Tarjeta key={f.id} titulo={<span className={actual ? 'acento' : ''}>Fase {f.numero} · días {f.diaInicio}–{f.diaFin}</span>} derecha={<button className="boton chico suave" onClick={() => setEditarFase(f)}>✎</button>}>
            <div className="chico"><b>{f.foco}</b><div className="texto-2">{f.queSeMide}</div></div>
            {objs.map((o) => (
              <div key={o.id} className="fila entre arriba" style={{ borderTop: '1px solid var(--borde)', paddingTop: 8 }}>
                <div className="crece">
                  <b className="chico">{o.titulo}</b>
                  <div className="muy-chico texto-3">{d.atributos.find((a) => a.id === o.atributoId)?.nombre} · {o.indicador}{o.lineaBase ? ` · base ${o.lineaBase}` : ''}{o.meta ? ` · meta ${o.meta}` : ''}{o.resultado ? ` · resultado ${o.resultado}` : ''}</div>
                </div>
                <button className="boton chico suave" onClick={() => setEditar({ fase: f.numero, objetivo: o })}>✎</button>
                <button className="boton chico suave" onClick={() => setBorrar(o)}>🗑</button>
              </div>
            ))}
            <button className="boton chico" onClick={() => setEditar({ fase: f.numero, objetivo: null })}>+ Objetivo</button>
          </Tarjeta>
        )
      })}
      {editar && <EditarObjetivo cicloId={d.estado.ciclo.id} fase={editar.fase} objetivo={editar.objetivo} atributos={d.atributos} onCerrar={() => setEditar(null)} />}
      {editarFase && <EditarFase fase={editarFase} onCerrar={() => setEditarFase(null)} />}
      <Confirmar abierta={!!borrar} titulo="¿Quitar objetivo?" texto="Se archiva; queda en el historial." confirmar="Quitar" peligro onConfirmar={() => { mutar(() => archivarObjetivo(borrar!.id)); setBorrar(null) }} onCancelar={() => setBorrar(null)} />
    </>
  )
}

function EditarObjetivo({ cicloId, fase, objetivo, atributos, onCerrar }: { cicloId: string; fase: number; objetivo: Objetivo | null; atributos: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const [titulo, setTitulo] = useState(objetivo?.titulo ?? '')
  const [indicador, setIndicador] = useState(objetivo?.indicador ?? '')
  const [atributoId, setAtributoId] = useState<string[]>(objetivo ? [objetivo.atributoId] : atributos[0] ? [atributos[0].id] : [])
  const [lineaBase, setLineaBase] = useState(objetivo?.lineaBase ?? '')
  const [meta, setMeta] = useState(objetivo?.meta ?? '')
  const valido = titulo.trim().length >= 3 && indicador.trim().length >= 3 && atributoId.length === 1
  const guardar = async () => {
    await mutar(() => guardarObjetivo({ id: objetivo?.id, cicloId, faseNumero: fase, atributoId: atributoId[0], titulo: titulo.trim(), indicador: indicador.trim(), lineaBase: lineaBase.trim() || undefined, meta: meta.trim() || undefined, resultado: objetivo?.resultado }))
    avisar('Objetivo guardado', { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={objetivo ? 'Editar objetivo' : `Nuevo objetivo · fase ${fase}`}>
      <div className="campo"><label>Objetivo</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: entrenar 3 veces por semana" /></div>
      <div className="campo"><label>Atributo</label><Chips opciones={atributos} valor={atributoId} onChange={setAtributoId} /></div>
      <div className="campo"><label>Indicador medible</label><input value={indicador} onChange={(e) => setIndicador(e.target.value)} placeholder="Ej.: entrenamientos hechos / previstos" /></div>
      <div className="rejilla-2">
        <div className="campo"><label>Línea de base</label><input value={lineaBase} onChange={(e) => setLineaBase(e.target.value)} placeholder="Ej.: 1/3" /></div>
        <div className="campo"><label>Meta</label><input value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Ej.: 3/3" /></div>
      </div>
      <button className="boton primario ancho" disabled={!valido} onClick={guardar}>Guardar</button>
    </Hoja>
  )
}

function EditarFase({ fase, onCerrar }: { fase: Fase; onCerrar: () => void }) {
  const [foco, setFoco] = useState(fase.foco)
  const [queSeMide, setQueSeMide] = useState(fase.queSeMide)
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={`Fase ${fase.numero}`}>
      <div className="campo"><label>Foco</label><input value={foco} onChange={(e) => setFoco(e.target.value)} /></div>
      <div className="campo"><label>Qué se mide</label><textarea value={queSeMide} onChange={(e) => setQueSeMide(e.target.value)} /></div>
      <button className="boton primario ancho" disabled={foco.trim().length < 2} onClick={() => mutar(() => guardarFase({ ...fase, foco: foco.trim(), queSeMide: queSeMide.trim() })).then(onCerrar)}>Guardar</button>
    </Hoja>
  )
}
