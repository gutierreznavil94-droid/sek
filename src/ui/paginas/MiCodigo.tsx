/**
 * «掟 Mi código»: el código personal de Navil (reglas, costumbres, principios).
 * Se abre desde Progreso y se ve sobre el mismo video del shinobi.
 * Dos vistas: por momento del día (朝 昼 夜 常) o por área (体 心 食 整).
 * Las reglas solo se leen: no se marcan ni dan XP.
 */

import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GrupoCodigo, MomentoCodigo, ReglaCodigo } from '../../data/tipos'
import { agregarRegla, borrarRegla, editarRegla, GRUPOS_CODIGO, listarCodigo, momentoDe, MOMENTOS_CODIGO, moverRegla, reglasDelGrupo, type VistaCodigo } from '../../services/codigo'
import { Confirmar, Hoja, movimientoReducido } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const Juramento = lazy(() => import('./Juramento'))

const CLAVE_VISTA = 'codigo-vista'
function vistaGuardada(): VistaCodigo {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'area' ? 'area' : 'momento'
  } catch {
    return 'momento'
  }
}

const areaDe = (r: ReglaCodigo) => GRUPOS_CODIGO.find((g) => g.id === r.grupo)!
const momentoInfo = (r: ReglaCodigo) => MOMENTOS_CODIGO.find((m) => m.id === momentoDe(r))!

export function MiCodigo() {
  const datos = useDatos(() => listarCodigo(), [])
  const [nueva, setNueva] = useState(false)
  const [editar, setEditar] = useState<ReglaCodigo | null>(null)
  const [jurada, setJurada] = useState<ReglaCodigo | null>(null)
  const [vista, setVista] = useState<VistaCodigo>(vistaGuardada)
  const [fase, setFase] = useState<'' | 'sale' | 'entra'>('')
  const timers = useRef<number[]>([])
  const reglas = datos.datos ?? []
  const grupos = vista === 'area' ? GRUPOS_CODIGO : MOMENTOS_CODIGO

  // Cambio de vista: las tarjetas se disuelven en tinta y se rearman en su nuevo grupo (0,4 s en total).
  const cambiarVista = (v: VistaCodigo) => {
    if (v === vista) return
    try { localStorage.setItem(CLAVE_VISTA, v) } catch { /* sin almacenamiento */ }
    timers.current.forEach((t) => clearTimeout(t))
    if (movimientoReducido()) return setVista(v)
    setFase('sale')
    timers.current = [
      window.setTimeout(() => { setVista(v); setFase('entra') }, 200),
      window.setTimeout(() => setFase(''), 400),
    ]
  }

  const grupoDeEditar = editar ? reglasDelGrupo(reglas, vista, vista === 'area' ? editar.grupo : momentoDe(editar)) : []
  return (
    <div className={`codigo ${jurada ? 'jurando' : ''}`}>
      <Link to="/progreso" className="codigo-volver" onClick={() => { try { sessionStorage.removeItem('progreso-seccion') } catch { /* sin almacenamiento */ } }}>‹ Progreso</Link>
      <header className="codigo-cabeza">
        <span className="codigo-kanji" aria-hidden>掟</span>
        <div>
          <h1>Mi código</h1>
          <p className="av-nota">Okite: el código que un shinobi no rompe. No son tareas del día: es tu forma de vivir.</p>
        </div>
      </header>

      <div className="codigo-vistas" role="tablist" aria-label="Ordenar el código">
        {(['momento', 'area'] as VistaCodigo[]).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} className={vista === v ? 'activa' : ''} onClick={() => cambiarVista(v)}>
            {v === 'momento' ? 'Por momento' : 'Por área'}
            <svg className="codigo-vistas-trazo" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden><path d="M3,5 C25,2 50,7 75,4 C85,3 92,5 97,4" /></svg>
          </button>
        ))}
      </div>

      <div className={`codigo-lista ${fase}`}>
        {grupos.map((g) => {
          const lista = reglasDelGrupo(reglas, vista, g.id)
          if (!lista.length) return null
          return (
            <section key={g.id} className="codigo-grupo" aria-label={g.nombre}>
              <div className="codigo-grupo-titulo"><span className="codigo-grupo-kanji" aria-hidden>{g.kanji}</span>{g.nombre}</div>
              {lista.map((r, i) => {
                const otra = vista === 'area' ? momentoInfo(r) : areaDe(r)
                return (
                  <button key={r.id} type="button" className="codigo-regla" onClick={() => setEditar(r)} aria-label={`${r.texto} (${otra.nombre}). Tocá para editar`}>
                    <svg className="codigo-pincel" viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden>
                      <path d={i % 2 ? 'M6,2 C3,30 8,60 5,98' : 'M5,2 C8,28 3,64 6,98'} />
                    </svg>
                    <span className="codigo-texto">{r.texto}</span>
                    <span className="codigo-otra" aria-hidden title={otra.nombre}>{otra.kanji}</span>
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>
      {datos.datos && reglas.length === 0 && <p className="av-nota" style={{ textAlign: 'center' }}>Tu código está vacío. Escribí la primera regla.</p>}

      <button type="button" className="boton ancho codigo-nueva" onClick={() => setNueva(true)}>+ Nueva regla</button>
      <p className="av-nota" style={{ textAlign: 'center' }}>Se leen, no se marcan. Tocá una regla para editarla, moverla o borrarla.</p>

      {nueva && (
        <EditorRegla
          titulo="Nueva regla"
          onCerrar={() => setNueva(false)}
          onGuardar={async (texto, grupo, momento) => {
            const r = await mutar(() => agregarRegla(texto, grupo, momento))
            setNueva(false)
            setJurada(r)
          }}
        />
      )}
      {editar && (
        <EditorRegla
          titulo="Editar regla"
          regla={editar}
          vista={vista}
          primera={grupoDeEditar[0]?.id === editar.id}
          ultima={grupoDeEditar.at(-1)?.id === editar.id}
          onCerrar={() => setEditar(null)}
          onGuardar={async (texto, grupo, momento) => {
            await mutar(() => editarRegla(editar.id, { texto, grupo, momento }))
            avisar('Regla guardada', { tipo: 'ok' })
            setEditar(null)
          }}
          onMover={(dir) => mutar(() => moverRegla(editar.id, dir, vista)).then(() => setEditar(null))}
          onBorrar={() => mutar(() => borrarRegla(editar.id)).then(() => { avisar('Regla borrada'); setEditar(null) })}
        />
      )}
      {jurada && (
        <Suspense fallback={null}>
          <Juramento texto={jurada.texto} grupo={`${momentoInfo(jurada).nombre} · ${areaDe(jurada).nombre}`} onFin={() => setJurada(null)} />
        </Suspense>
      )}
    </div>
  )
}

/** Fila de botones con kanji de pincel para elegir una etiqueta. */
function Etiquetas<T extends string>({ opciones, valor, onChange, nombre }: { opciones: { id: T; nombre: string; kanji: string }[]; valor: T; onChange: (v: T) => void; nombre: string }) {
  return (
    <div className="codigo-etiquetas" role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} className={valor === o.id ? 'activa' : ''} onClick={() => onChange(o.id)}>
          <span className="codigo-etiqueta-kanji" aria-hidden>{o.kanji}</span>
          <span>{o.nombre}</span>
        </button>
      ))}
    </div>
  )
}

function EditorRegla({ titulo, regla, vista, primera, ultima, onCerrar, onGuardar, onMover, onBorrar }: {
  titulo: string
  regla?: ReglaCodigo
  vista?: VistaCodigo
  primera?: boolean
  ultima?: boolean
  onCerrar: () => void
  onGuardar: (texto: string, grupo: GrupoCodigo, momento: MomentoCodigo) => Promise<void>
  onMover?: (dir: -1 | 1) => void
  onBorrar?: () => void
}) {
  const [texto, setTexto] = useState(regla?.texto ?? '')
  const [grupo, setGrupo] = useState<GrupoCodigo>(regla?.grupo ?? 'cuerpo')
  const [momento, setMomento] = useState<MomentoCodigo>(regla ? momentoDe(regla) : 'siempre')
  const [borrar, setBorrar] = useState(false)
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={titulo}>
      <div className="campo">
        <label>La regla</label>
        <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: Flexiones cada vez que pierdo el foco" />
      </div>
      <div className="campo"><label>Momento</label><Etiquetas nombre="Momento" opciones={MOMENTOS_CODIGO} valor={momento} onChange={setMomento} /></div>
      <div className="campo"><label>Área</label><Etiquetas nombre="Área" opciones={GRUPOS_CODIGO} valor={grupo} onChange={setGrupo} /></div>
      {regla && onMover && (
        <div className="rejilla-2">
          <button className="boton" disabled={primera} onClick={() => onMover(-1)}>↑ Subir</button>
          <button className="boton" disabled={ultima} onClick={() => onMover(1)}>↓ Bajar</button>
        </div>
      )}
      {regla && onMover && <p className="ayuda">Subir y bajar ordena {vista === 'area' ? 'la vista por área' : 'la vista por momento'}; la otra vista guarda su propio orden.</p>}
      <button className="boton primario ancho" disabled={!texto.trim()} onClick={() => void onGuardar(texto, grupo, momento)}>{regla ? 'Guardar' : '誓 Jurar esta regla'}</button>
      {regla && onBorrar && <button className="boton suave ancho" onClick={() => setBorrar(true)}>Borrar regla</button>}
      <Confirmar abierta={borrar} titulo="¿Borrar esta regla?" texto={`«${texto}» sale de tu código.`} confirmar="Borrar" peligro onConfirmar={() => { setBorrar(false); onBorrar?.() }} onCancelar={() => setBorrar(false)} />
    </Hoja>
  )
}
