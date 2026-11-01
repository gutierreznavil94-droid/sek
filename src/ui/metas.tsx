import { useEffect, useRef, useState } from 'react'
import type { Meta } from '../data/tipos'
import { cumplirMeta, crearMetaRapida, borrarMetaPropia, desmarcarMeta, editarMeta, estadoVisible } from '../services/metas'
import { celebrarNivel } from './animaciones/logros'
import { animar } from './animaciones/motor'
import { avisar, mutar } from './estado'

/** Marcar / desmarcar una meta: XP, animación corta del shinobi y aviso. */
export async function alternarMeta(m: Meta, hoy: string): Promise<void> {
  if (estadoVisible(m, hoy) === 'cumplida') {
    await mutar(() => desmarcarMeta(m.id))
    avisar('Meta desmarcada')
    return
  }
  const r = await mutar(() => cumplirMeta(m.id))
  animar({ tipo: 'ejecucion', pilar: 'meta', estilo: 'vertical' })
  if (r.nuevoNivel) celebrarNivel(r.nuevoNivel)
  avisar(r.xp > 0 ? `Meta cumplida: +${r.xp} XP` : r.conTope ? 'Meta cumplida (ya sumaste XP de 3 metas hoy)' : 'Meta cumplida', { tipo: 'ok' })
}

/** Una meta con su casilla. En verde suave con brillo al cumplirla; gris tachada si pasó sin cumplir. */
export function FilaMeta({ m, hoy, menu = true, chica = false }: { m: Meta; hoy: string; menu?: boolean; chica?: boolean }) {
  const estado = estadoVisible(m, hoy)
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const largo = useRef<number | null>(null)
  const guardar = async () => {
    const t = editando?.trim()
    if (t && t !== m.titulo) await mutar(() => editarMeta(m.id, { titulo: t }))
    setEditando(null)
  }
  return (
    <div className={`meta-rapida ${estado} ${chica ? 'chica' : ''}`}
      onPointerDown={() => { if (!menu) return; largo.current = window.setTimeout(() => setAbierto(true), 550) }}
      onPointerUp={() => { if (largo.current) clearTimeout(largo.current) }}
      onPointerLeave={() => { if (largo.current) clearTimeout(largo.current) }}>
      <button className="meta-casilla" role="checkbox" aria-checked={estado === 'cumplida'} aria-label={`${m.titulo}: ${estado === 'cumplida' ? 'cumplida' : estado === 'no_cumplida' ? 'no cumplida' : 'pendiente'}`} onClick={() => alternarMeta(m, hoy)}>
        {estado === 'cumplida' ? '✓' : ''}
      </button>
      {editando !== null ? (
        <input className="meta-editar" autoFocus value={editando} onChange={(e) => setEditando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(null) }} onBlur={guardar} />
      ) : (
        <span className="meta-titulo" onClick={() => alternarMeta(m, hoy)}>{m.titulo}</span>
      )}
      {menu && editando === null && (
        <button className="meta-menu" aria-label="Opciones de la meta" onClick={() => setAbierto(!abierto)}>…</button>
      )}
      {abierto && (
        <div className="meta-opciones" role="menu">
          {m.fecha >= hoy && <button role="menuitem" onClick={() => { setAbierto(false); setEditando(m.titulo) }}>Editar</button>}
          <button role="menuitem" className="peligro" onClick={async () => { setAbierto(false); await mutar(() => borrarMetaPropia(m.id)); avisar('Meta borrada') }}>Borrar</button>
          <button role="menuitem" onClick={() => setAbierto(false)}>Cerrar</button>
        </div>
      )}
    </div>
  )
}

/** Campo «Escribir meta»: Enter guarda. Se enfoca solo al abrir el día. */
export function CampoMeta({ fecha, hoy, enfocar }: { fecha: string; hoy: string; enfocar: boolean }) {
  const [texto, setTexto] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (enfocar) ref.current?.focus({ preventScroll: false })
  }, [enfocar, fecha])
  const guardar = async () => {
    const t = texto.trim()
    if (!t) return
    await mutar(() => crearMetaRapida(fecha, t, hoy))
    setTexto('')
    avisar('Meta guardada', { tipo: 'ok' })
    ref.current?.focus()
  }
  return (
    <form className="campo-meta" onSubmit={(e) => { e.preventDefault(); guardar() }}>
      <input ref={ref} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribir meta" enterKeyHint="done" aria-label={`Escribir meta para ${fecha}`} />
      <button type="submit" className="boton chico" disabled={!texto.trim()}>Guardar</button>
    </form>
  )
}
