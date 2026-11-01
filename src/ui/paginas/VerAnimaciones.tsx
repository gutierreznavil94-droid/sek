import { useEffect, useState } from 'react'
import type { Ajustes } from '../../data/tipos'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { KANJI, animar, nombreDePilar, configurarAnimaciones, useConfigAnimaciones, type Animacion, type ModoAnimaciones } from '../animaciones/motor'
import { EditorPose } from '../animaciones/EditorPose'
import { MuniecoVivo } from '../animaciones/Escena'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

const PILARES = ['entrenamiento', 'empresa', 'manga', 'acostarse']

const MODOS: { v: ModoAnimaciones; t: string }[] = [
  { v: 'todas', t: 'Todas' },
  { v: 'logros', t: 'Solo logros grandes' },
  { v: 'ninguna', t: 'Ninguna' },
]

/** Vista previa de cada animación, sin tener que cumplir nada, y sus ajustes. */
export function VerAnimaciones() {
  const datos = useDatos(() => obtenerAjustes(), [])
  const config = useConfigAnimaciones()
  const [nombre, setNombre] = useState('')
  const [editor, setEditor] = useState(false)
  useEffect(() => {
    if (datos.datos) setNombre(datos.datos.nombrePersonaje || 'Shinobi')
  }, [datos.datos])
  const a = datos.datos
  if (!a) return <p className="vacio">Cargando…</p>
  const ver = (x: Animacion) => animar(x, { forzar: true })
  const guardar = (c: Partial<Ajustes>, msg: string) => mutar(() => guardarAjustes(c)).then(() => avisar(msg, { tipo: 'ok' }))
  return (
    <>
      <Atras />
      <h1>Ver animaciones</h1>
      <p className="texto-2 chico">Prototipo: tocá cada botón para ver cómo queda. Un toque en la animación la salta. Nada de esto cambia tu XP ni tus registros.</p>

      <Tarjeta titulo="Cumplir un pilar · ejecución">
        <div className="anim-grilla">
          {PILARES.map((p) => (
            <button key={p} className="boton" onClick={() => ver({ tipo: 'ejecucion', pilar: p })}>
              <span className="k">{KANJI[p].k}</span>
              <span className="chico">{nombreDePilar(p)}</span>
            </button>
          ))}
        </div>
        <p className="ayuda">Cada pilar tiene su corte; a veces sale otro al azar para que no se repita.</p>
      </Tarjeta>

      <Tarjeta titulo="Series y concentración">
        <div className="anim-grilla">
          <button className="boton" onClick={() => ver({ tipo: 'parry' })}><span className="k">弾</span><span className="chico">Parry (sumar serie)</span></button>
          <button className="boton" onClick={() => { for (let i = 0; i < 3; i++) window.setTimeout(() => ver({ tipo: 'parry' }), i * 280) }}><span className="k">弾弾</span><span className="chico">Tres series seguidas</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'postura', modo: '321' })}><span className="k">{KANJI['321'].k}</span><span className="chico">3-2-1</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'postura', modo: 'siguiente' })}><span className="k">{KANJI.siguiente.k}</span><span className="chico">Siguiente acción</span></button>
        </div>
      </Tarjeta>

      <Tarjeta titulo="El shinobi, en reposo">
        <div className="sh-reposo-marco"><MuniecoVivo /></div>
        <p className="ayuda">Nunca queda quieto: respira, el kasa se mece y la bufanda y el abrigo van con el viento.</p>
      </Tarjeta>

      <Tarjeta titulo="Logros grandes">
        <div className="anim-grilla">
          <button className="boton" onClick={() => ver({ tipo: 'logro', clase: 'nivel', texto: 'Nivel 5', sub: `${KANJI.nivel.k} · ascender` })}><span className="k">{KANJI.nivel.k}</span><span className="chico">Subir de nivel</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'logro', clase: 'racha', texto: '7 días seguidos', sub: `${KANJI.racha.k} · racha` })}><span className="k">{KANJI.racha.k}</span><span className="chico">Racha de 7 días</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'logro', clase: 'fase', texto: 'Fase 2', sub: `${KANJI.fase.k} · nueva etapa` })}><span className="k">{KANJI.fase.k}</span><span className="chico">Cambio de fase</span></button>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Cuándo se muestran">
        <div className="selector-3">
          {MODOS.map((m) => (
            <button key={m.v} className={`boton chico ${(a.animaciones ?? 'todas') === m.v ? 'primario' : ''}`} onClick={() => guardar({ animaciones: m.v }, `Animaciones: ${m.t.toLowerCase()}`)}>{m.t}</button>
          ))}
        </div>
        <p className="ayuda">Si el teléfono tiene «reducir movimiento», solo se ve un destello de color y el texto.</p>
        <div className="selector-3" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
          <button className={`boton chico ${(a.temaAnimaciones ?? 'claro') === 'claro' ? 'primario' : ''}`} onClick={() => guardar({ temaAnimaciones: 'claro' }, 'Escenas sobre papel claro')}>Papel claro</button>
          <button className={`boton chico ${a.temaAnimaciones === 'oscuro' ? 'primario' : ''}`} onClick={() => guardar({ temaAnimaciones: 'oscuro' }, 'Escenas oscuras')}>Fondo oscuro</button>
        </div>
        <label className="fila chico" style={{ gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={!!a.sonidoAnimaciones} onChange={(e) => guardar({ sonidoAnimaciones: e.target.checked }, e.target.checked ? 'Sonido activado' : 'Sonido desactivado')} /> Sonido (corte, choque y aura, generados por la app)
        </label>
        <label className="fila chico" style={{ gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={config.lento > 1} onChange={(e) => configurarAnimaciones({ lento: e.target.checked ? 4 : 1 })} /> Cámara lenta (solo para mirar los detalles)
        </label>
        <label className="fila chico" style={{ gap: 8, marginTop: 6 }}>
          <input type="checkbox" checked={config.tinta} onChange={(e) => configurarAnimaciones({ tinta: e.target.checked })} /> Bordes de pincel (desactivalo si el teléfono va lento)
        </label>
      </Tarjeta>

      <Tarjeta titulo="Nombre del personaje">
        <div className="fila" style={{ gap: 8 }}>
          <input aria-label="Nombre del personaje" value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} style={{ flex: 1 }} />
          <button className="boton chico" onClick={() => guardar({ nombrePersonaje: nombre.trim() || 'Shinobi' }, 'Nombre guardado')}>Guardar</button>
        </div>
        <p className="ayuda">Provisorio. Cuando elijas el definitivo, cambialo acá.</p>
      </Tarjeta>

      <Tarjeta titulo="Editar pose">
        <p className="chico texto-2">El shinobi es un muñeco articulado: cada pose es una lista de ángulos. Movelos y mirá el resultado. Para calcar un dibujo tuyo, cargá la foto de fondo.</p>
        {editor ? <EditorPose /> : <button className="boton ancho" onClick={() => setEditor(true)}>Abrir el editor</button>}
      </Tarjeta>
    </>
  )
}
