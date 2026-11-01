import { useState } from 'react'
import { db } from '../../data/db'
import type { Contador } from '../../data/tipos'
import { formatoHora } from '../../domain/fechas'
import { listarAtributos } from '../../services/acciones'
import { obtenerAjustes } from '../../services/base'
import { borrarRegistroContador, guardarContador, listarContadores, nuevoIdContador, resumenContadores, sumarToque, validarContador } from '../../services/contadores'
import { Atras, Chips, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/** Configuración de los contadores de series rápidas y registros de hoy. */
export function Contadores({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({
    contadores: await listarContadores(true),
    resumen: await resumenContadores(hoy),
    atributos: await listarAtributos(),
    registrosHoy: (await db().registrosContador.where('fecha').equals(hoy).toArray()).sort((a, b) => b.instante - a.instante),
    zona: (await obtenerAjustes()).zonaHoraria,
  }), [hoy])
  const [editar, setEditar] = useState<Contador | 'nuevo' | null>(null)
  const [manual, setManual] = useState<Contador | null>(null)
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  return (
    <>
      <Atras />
      <div className="fila entre">
        <h1>Contadores</h1>
        <button className="boton chico primario" onClick={() => setEditar('nuevo')}>+ Nuevo</button>
      </div>
      <p className="texto-2 chico">Series rápidas durante el día: cada toque en Hoy suma la cantidad configurada. Llegar a la meta diaria da XP una vez por día y suma al atributo elegido. No son pilares: no afectan la racha.</p>

      {d.contadores.map((c) => {
        const r = d.resumen.find((x) => x.contador.id === c.id)
        return (
          <Tarjeta key={c.id} compacta>
            <div className="fila entre">
              <div className="col" style={{ gap: 0 }}>
                <b>{c.nombre}{!c.activo && <span className="etiqueta" style={{ marginLeft: 6 }}>inactivo</span>}</b>
                <span className="chico texto-3">+{c.cantidadPorToque} por toque · meta diaria {c.metaDiaria}{c.metaSemanal ? ` · semanal ${c.metaSemanal}` : ''} · +{c.xpMetaDiaria} XP</span>
                {r && <span className="chico texto-2">Hoy {r.hoy} · semana {r.semana} · ciclo {r.ciclo}{r.record ? ` · récord ${r.record.total}` : ''}</span>}
              </div>
              <div className="col" style={{ gap: 4 }}>
                <button className="boton chico" onClick={() => setEditar(c)}>Editar</button>
                {c.activo && <button className="boton chico suave" onClick={() => setManual(c)}>Cargar a mano</button>}
              </div>
            </div>
          </Tarjeta>
        )
      })}

      {d.registrosHoy.length > 0 && (
        <Tarjeta titulo="Registros de hoy">
          <div>
            {d.registrosHoy.map((reg) => (
              <div key={reg.id} className="fila entre chico" style={{ padding: '6px 0', borderTop: '1px solid var(--borde)' }}>
                <span><span className="mono texto-3">{formatoHora(reg.instante, d.zona)}</span> {d.contadores.find((c) => c.id === reg.contadorId)?.nombre ?? reg.contadorId} <b>+{reg.cantidad}</b>{reg.nota ? <span className="texto-3"> · {reg.nota}</span> : ''}</span>
                <button className="boton chico suave" onClick={() => mutar(() => borrarRegistroContador(reg.id!)).then(() => avisar('Registro borrado'))}>Borrar</button>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      {editar && <EditarContador contador={editar === 'nuevo' ? null : editar} atributos={d.atributos} onCerrar={() => setEditar(null)} />}
      {manual && <CargarAMano contador={manual} onCerrar={() => setManual(null)} />}
    </>
  )
}

function EditarContador({ contador, atributos, onCerrar }: { contador: Contador | null; atributos: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(contador?.nombre ?? '')
  const [porToque, setPorToque] = useState(contador?.cantidadPorToque ?? 10)
  const [metaDiaria, setMetaDiaria] = useState(contador?.metaDiaria ?? 50)
  const [metaSemanal, setMetaSemanal] = useState(contador?.metaSemanal ?? 0)
  const [xp, setXp] = useState(contador?.xpMetaDiaria ?? 10)
  const [atributoIds, setAtributoIds] = useState<string[]>(contador?.atributoIds ?? ['fisico'])
  const [activo, setActivo] = useState(contador?.activo ?? true)
  const [errores, setErrores] = useState<string[]>([])
  const guardar = async () => {
    const base = { id: contador?.id ?? nuevoIdContador(), nombre, cantidadPorToque: porToque, metaDiaria, metaSemanal: metaSemanal > 0 ? metaSemanal : undefined, xpMetaDiaria: xp, atributoIds, activo }
    const errs = validarContador(base)
    if (errs.length) return setErrores(errs)
    await mutar(() => guardarContador(base))
    avisar('Contador guardado. Vale de hoy en adelante.', { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={contador ? `Editar ${contador.nombre}` : 'Nuevo contador'}>
      <div className="campo"><label>Nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Sentadillas" /></div>
      <div className="rejilla-2">
        <div className="campo"><label>Cuánto suma cada toque</label><input type="number" inputMode="numeric" min={1} value={porToque} onChange={(e) => setPorToque(Number(e.target.value))} /><span className="ayuda">Subilo cuando aumentes las series.</span></div>
        <div className="campo"><label>Meta diaria</label><input type="number" inputMode="numeric" min={1} value={metaDiaria} onChange={(e) => setMetaDiaria(Number(e.target.value))} /><span className="ayuda">{porToque > 0 ? `${Math.ceil(metaDiaria / porToque)} toques` : ''}</span></div>
        <div className="campo"><label>Meta semanal (opcional)</label><input type="number" inputMode="numeric" min={0} value={metaSemanal} onChange={(e) => setMetaSemanal(Number(e.target.value))} /></div>
        <div className="campo"><label>XP al llegar a la meta</label><input type="number" inputMode="numeric" min={0} max={100} value={xp} onChange={(e) => setXp(Number(e.target.value))} /></div>
      </div>
      <div className="campo"><label>Atributo que alimenta</label><Chips opciones={atributos} valor={atributoIds} onChange={setAtributoIds} multiple /></div>
      {contador && <label className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo (aparece en Hoy)</label>}
      {errores.map((e) => <p key={e} className="error">{e}</p>)}
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}

function CargarAMano({ contador, onCerrar }: { contador: Contador; onCerrar: () => void }) {
  const [cantidad, setCantidad] = useState(contador.cantidadPorToque)
  const [nota, setNota] = useState('')
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={`${contador.nombre}: cargar a mano`}>
      <div className="campo"><label>Cantidad</label><input type="number" inputMode="numeric" min={1} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} /></div>
      <div className="campo"><label>Nota (opcional)</label><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: serie larga en el gimnasio" /></div>
      <button className="boton primario ancho" disabled={!(cantidad > 0)} onClick={() => mutar(() => sumarToque(contador.id, cantidad, nota || undefined)).then((r) => { avisar(`${contador.nombre}: ${r.total} hoy${r.xp ? ` · +${r.xp} XP` : ''}`, { tipo: 'ok' }); onCerrar() })}>Sumar {cantidad}</button>
    </Hoja>
  )
}
