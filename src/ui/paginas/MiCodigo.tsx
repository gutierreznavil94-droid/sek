/**
 * «掟 Mi código»: el código personal de Navil (reglas, costumbres, principios).
 * Se abre desde Progreso y se ve sobre el mismo video del shinobi.
 * Las reglas solo se leen: no se marcan ni dan XP.
 */

import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GrupoCodigo, ReglaCodigo } from '../../data/tipos'
import { agregarRegla, borrarRegla, editarRegla, GRUPOS_CODIGO, listarCodigo, moverRegla } from '../../services/codigo'
import { Chips, Confirmar, Hoja } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const Juramento = lazy(() => import('./Juramento'))

export function MiCodigo() {
  const datos = useDatos(() => listarCodigo(), [])
  const [nueva, setNueva] = useState(false)
  const [editar, setEditar] = useState<ReglaCodigo | null>(null)
  const [jurada, setJurada] = useState<ReglaCodigo | null>(null)
  const reglas = datos.datos ?? []
  return (
    <div className={`codigo ${jurada ? 'jurando' : ''}`}>
      <Link to="/progreso" className="codigo-volver">‹ Progreso</Link>
      <header className="codigo-cabeza">
        <span className="codigo-kanji" aria-hidden>掟</span>
        <div>
          <h1>Mi código</h1>
          <p className="av-nota">Okite: el código que un shinobi no rompe. No son tareas del día: es tu forma de vivir.</p>
        </div>
      </header>

      {GRUPOS_CODIGO.map((g) => {
        const lista = reglas.filter((r) => r.grupo === g.id)
        if (!lista.length) return null
        return (
          <section key={g.id} className="codigo-grupo" aria-label={g.nombre}>
            <div className="codigo-grupo-titulo"><span className="codigo-grupo-kanji" aria-hidden>{g.kanji}</span>{g.nombre}</div>
            {lista.map((r, i) => (
              <button key={r.id} type="button" className="codigo-regla" onClick={() => setEditar(r)} aria-label={`${r.texto}. Tocá para editar`}>
                <svg className="codigo-pincel" viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden>
                  <path d={i % 2 ? 'M6,2 C3,30 8,60 5,98' : 'M5,2 C8,28 3,64 6,98'} />
                </svg>
                <span className="codigo-texto">{r.texto}</span>
              </button>
            ))}
          </section>
        )
      })}
      {datos.datos && reglas.length === 0 && <p className="av-nota" style={{ textAlign: 'center' }}>Tu código está vacío. Escribí la primera regla.</p>}

      <button type="button" className="boton ancho codigo-nueva" onClick={() => setNueva(true)}>+ Nueva regla</button>
      <p className="av-nota" style={{ textAlign: 'center' }}>Se leen, no se marcan. Tocá una regla para editarla, moverla o borrarla.</p>

      {nueva && (
        <EditorRegla
          titulo="Nueva regla"
          onCerrar={() => setNueva(false)}
          onGuardar={async (texto, grupo) => {
            const r = await mutar(() => agregarRegla(texto, grupo))
            setNueva(false)
            setJurada(r)
          }}
        />
      )}
      {editar && (
        <EditorRegla
          titulo="Editar regla"
          regla={editar}
          primera={reglas.filter((x) => x.grupo === editar.grupo)[0]?.id === editar.id}
          ultima={reglas.filter((x) => x.grupo === editar.grupo).at(-1)?.id === editar.id}
          onCerrar={() => setEditar(null)}
          onGuardar={async (texto, grupo) => {
            await mutar(() => editarRegla(editar.id, { texto, grupo }))
            avisar('Regla guardada', { tipo: 'ok' })
            setEditar(null)
          }}
          onMover={(dir) => mutar(() => moverRegla(editar.id, dir)).then(() => setEditar(null))}
          onBorrar={() => mutar(() => borrarRegla(editar.id)).then(() => { avisar('Regla borrada'); setEditar(null) })}
        />
      )}
      {jurada && (
        <Suspense fallback={null}>
          <Juramento texto={jurada.texto} grupo={GRUPOS_CODIGO.find((g) => g.id === jurada.grupo)?.nombre ?? ''} onFin={() => setJurada(null)} />
        </Suspense>
      )}
    </div>
  )
}

function EditorRegla({ titulo, regla, primera, ultima, onCerrar, onGuardar, onMover, onBorrar }: {
  titulo: string
  regla?: ReglaCodigo
  primera?: boolean
  ultima?: boolean
  onCerrar: () => void
  onGuardar: (texto: string, grupo: GrupoCodigo) => Promise<void>
  onMover?: (dir: -1 | 1) => void
  onBorrar?: () => void
}) {
  const [texto, setTexto] = useState(regla?.texto ?? '')
  const [grupo, setGrupo] = useState<GrupoCodigo[]>([regla?.grupo ?? 'cuerpo'])
  const [borrar, setBorrar] = useState(false)
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={titulo}>
      <div className="campo">
        <label>La regla</label>
        <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: Flexiones cada vez que pierdo el foco" />
      </div>
      <div className="campo"><label>Grupo</label><Chips opciones={GRUPOS_CODIGO.map((g) => ({ id: g.id, nombre: g.nombre }))} valor={grupo} onChange={(v) => v.length && setGrupo(v)} /></div>
      {regla && onMover && (
        <div className="rejilla-2">
          <button className="boton" disabled={primera} onClick={() => onMover(-1)}>↑ Subir</button>
          <button className="boton" disabled={ultima} onClick={() => onMover(1)}>↓ Bajar</button>
        </div>
      )}
      <button className="boton primario ancho" disabled={!texto.trim()} onClick={() => void onGuardar(texto, grupo[0])}>{regla ? 'Guardar' : '誓 Jurar esta regla'}</button>
      {regla && onBorrar && <button className="boton suave ancho" onClick={() => setBorrar(true)}>Borrar regla</button>}
      <Confirmar abierta={borrar} titulo="¿Borrar esta regla?" texto={`«${texto}» sale de tu código.`} confirmar="Borrar" peligro onConfirmar={() => { setBorrar(false); onBorrar?.() }} onCancelar={() => setBorrar(false)} />
    </Hoja>
  )
}
