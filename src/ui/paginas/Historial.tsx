import { useState } from 'react'
import { db } from '../../data/db'
import type { Evento } from '../../data/tipos'
import { fechaDe, fechaLegible, formatoHora } from '../../domain/fechas'
import { Atras, Tarjeta } from '../componentes'
import { useDatos } from '../estado'

const NOMBRES: Record<Evento['tipo'], string> = {
  crear: 'Creado',
  editar: 'Editado',
  borrar: 'Borrado',
  corregir: 'Corregido',
  anular_xp: 'XP anulado',
  cerrar_dia: 'Día cerrado',
  subir_nivel: 'Subida de nivel',
  importar: 'Importación',
  exportar: 'Exportación',
  cerrar_fase: 'Fase cerrada',
  nuevo_ciclo: 'Nuevo ciclo',
  modo_suenio: 'Modo sueño',
}

export function Historial() {
  const [limite, setLimite] = useState(60)
  const [filtro, setFiltro] = useState<string>('todos')
  const datos = useDatos(async () => {
    const q = db().eventos.orderBy('instante').reverse()
    const lista = filtro === 'todos' ? await q.limit(limite).toArray() : await q.filter((e) => e.tipo === filtro).limit(limite).toArray()
    return { lista, total: await db().eventos.count() }
  }, [limite, filtro])
  const d = datos.datos
  if (!d) return <p className="vacio">Cargando…</p>
  return (
    <>
      <Atras />
      <h1>Historial de cambios</h1>
      <p className="chico texto-2">{d.total} eventos. Nada se borra: cada cambio, corrección o anulación queda aquí.</p>
      <div className="chips">
        {['todos', 'corregir', 'anular_xp', 'subir_nivel', 'cerrar_dia', 'editar'].map((f) => <button key={f} className={filtro === f ? 'activo' : ''} onClick={() => setFiltro(f)}>{f === 'todos' ? 'Todos' : NOMBRES[f as Evento['tipo']]}</button>)}
      </div>
      <Tarjeta>
        <div>
          {d.lista.map((e) => (
            <div key={e.id} className="col chico" style={{ padding: '8px 0', borderTop: '1px solid var(--borde)', gap: 2 }}>
              <div className="fila entre"><b>{NOMBRES[e.tipo]} · {e.entidad}</b><span className="texto-3 muy-chico">{fechaLegible(fechaDe(e.instante))} {formatoHora(e.instante)}</span></div>
              <span className="texto-3 muy-chico">{e.entidadId}{e.motivo ? ` · ${e.motivo}` : ''}</span>
              {(e.tipo === 'corregir' || e.tipo === 'anular_xp') && e.antes != null && (
                <details className="muy-chico texto-3"><summary>Antes / después</summary><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify({ antes: e.antes, despues: e.despues }, null, 1)}</pre></details>
              )}
            </div>
          ))}
        </div>
        {d.lista.length >= limite && <button className="boton ancho" onClick={() => setLimite(limite + 100)}>Ver más</button>}
      </Tarjeta>
    </>
  )
}
