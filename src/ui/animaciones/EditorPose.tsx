import { useEffect, useRef, useState } from 'react'
import { avisar } from '../estado'
import { ARTICULACIONES, Munieco, NOMBRES_POSE, guardarPosePropia, origenDePose, pose, posesVigentes, restaurarPose, usePoses, type NombrePose, type Pose } from './munieco'

const ETIQUETA: Record<NombrePose, string> = {
  guardia: 'Guardia',
  carrera: 'Carrera',
  alzar: 'Alzar la katana',
  corte: 'Corte',
  bloqueo: 'Bloqueo (parry)',
  caramelo: 'Caramelo (arrodillado)',
  meditar: 'Oración (arrodillado, manos juntas)',
  victoria: 'Victoria',
}

/** Descarga un archivo de texto desde el navegador. */
function descargar(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Editor simple de poses: deslizadores por articulación, foto de fondo para
 * calcar, guardar en el teléfono, exportar poses.json y restaurar.
 */
export function EditorPose() {
  const version = usePoses()
  const [nombre, setNombre] = useState<NombrePose>('guardia')
  const [p, setP] = useState<Pose>(() => pose('guardia'))
  const [foto, setFoto] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setP(pose(nombre))
  }, [nombre, version])
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto) }, [foto])

  const set = (k: keyof Pose, v: number) => setP((x) => ({ ...x, [k]: v }))
  const origen = origenDePose(nombre)
  const cambiada = JSON.stringify(p) !== JSON.stringify(pose(nombre))

  return (
    <div className="editor-pose">
      <div className="chips" style={{ marginBottom: 10 }}>
        {NOMBRES_POSE.map((n) => (
          <button key={n} type="button" className={n === nombre ? 'activo' : ''} onClick={() => setNombre(n)}>{ETIQUETA[n]}</button>
        ))}
      </div>
      <div className="lienzo" aria-label="Vista de la pose">
        {foto && <img src={foto} alt="" />}
        <svg viewBox="0 0 360 240" aria-hidden>
          <line x1={0} y1={205} x2={360} y2={205} stroke="#8d8a82" strokeWidth={1} strokeDasharray="4 4" />
          <g transform="translate(180,205) scale(0.95)"><Munieco p={p} /></g>
        </svg>
      </div>
      <p className="ayuda" style={{ marginTop: 6 }}>
        {origen === 'propia' ? 'Esta pose es tuya (guardada en este teléfono).' : origen === 'archivo' ? 'Pose de animaciones/poses.json.' : 'Pose que viene con la app.'} Positivo = hacia adelante.
      </p>
      <div className="control">
        <label>Cadera: altura</label>
        <span className="valor">{Math.round(p.cadera[1])}</span>
        <input type="range" min={-30} max={60} value={p.cadera[1]} onChange={(e) => setP((x) => ({ ...x, cadera: [x.cadera[0], Number(e.target.value)] }))} aria-label="Cadera: altura" />
      </div>
      {ARTICULACIONES.map((a) => (
        <div className="control" key={a.k}>
          <label htmlFor={`pose-${a.k}`}>{a.t}</label>
          <span className="valor">{Math.round(p[a.k])}°</span>
          <input id={`pose-${a.k}`} type="range" min={a.min} max={a.max} value={p[a.k]} onChange={(e) => set(a.k, Number(e.target.value))} />
        </div>
      ))}
      <div className="control">
        <label htmlFor="pose-katana">Katana (en la mano)</label>
        <span className="valor">{p.katana === null ? 'en la vaina' : `${Math.round(p.katana)}°`}</span>
        <input id="pose-katana" type="range" min={-120} max={120} value={p.katana ?? 0} disabled={p.katana === null} onChange={(e) => set('katana', Number(e.target.value))} />
        <label className="fila chico" style={{ gap: 6, gridColumn: '1 / -1' }}><input type="checkbox" checked={p.katana !== null} onChange={(e) => setP((x) => ({ ...x, katana: e.target.checked ? 0 : null }))} /> Katana en la mano</label>
      </div>
      <div className="acciones">
        <button className="boton primario chico" disabled={!cambiada} onClick={() => { guardarPosePropia(nombre, p); avisar('Pose guardada', { tipo: 'ok' }) }}>Guardar pose</button>
        <button className="boton chico" disabled={origen !== 'propia' && !cambiada} onClick={() => { restaurarPose(nombre); setP(pose(nombre)); avisar('Pose restaurada') }}>Restaurar</button>
        <button className="boton chico" onClick={() => descargar('poses.json', JSON.stringify(posesVigentes(), null, 2))}>Exportar poses</button>
      </div>
      <div className="fila" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
        <input ref={archivo} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFoto(URL.createObjectURL(f)) }} />
        <button className="boton chico suave" onClick={() => archivo.current?.click()}>{foto ? 'Cambiar foto' : 'Cargar foto de tu dibujo'}</button>
        {foto && <button className="boton chico suave" onClick={() => setFoto(null)}>Quitar foto</button>}
      </div>
      <p className="ayuda">La foto se ve semitransparente atrás del muñeco, para calcar la pose moviendo los deslizadores. No se guarda en la app.</p>
    </div>
  )
}
