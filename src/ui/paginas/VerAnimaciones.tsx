import { useEffect, useState } from 'react'
import type { Ajustes } from '../../data/tipos'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { KANJI, animar, nombreDePilar, configurarAnimaciones, useConfigAnimaciones, type Animacion, type ModoAnimaciones } from '../animaciones/motor'
import { EditorPose } from '../animaciones/EditorPose'
import { MuniecoVivo } from '../animaciones/Escena'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import type { Distraccion, ModoCompanero, MomentoNinja } from '../../data/tipos'
import { NOMBRE_MOMENTO, distraccionesDe, guardarDistracciones, nuevaDistraccion } from '../../services/ninjas'
import { pedirPelea } from '../Ninja'

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
  /** Cámara lenta (x4) solo para esa animación; la casilla general no cambia. */
  const lenta = (x: Animacion) => ver({ ...x, lento: 4 })
  const guardar = (c: Partial<Ajustes>, msg: string) => mutar(() => guardarAjustes(c)).then(() => avisar(msg, { tipo: 'ok' }))
  const EJ: Animacion = { tipo: 'ejecucion', pilar: 'entrenamiento' }
  const CAR: Animacion = { tipo: 'postura', modo: '321' }
  const LOG: Animacion = { tipo: 'logro', clase: 'nivel', texto: 'Nivel 5', sub: `${KANJI.nivel.k} · ascender` }
  const PARRY: Animacion = { tipo: 'parry' }
  /** Botones «cámara lenta» y «anterior (muñeco)» de una animación, para compararla con la versión vieja. */
  const comparar = (x: Animacion, k: string, nombre: string) => (
    <div className="anim-grilla anim-comparar">
      <button className="boton" onClick={() => lenta(x)}><span className="k">{k}</span><span className="chico">{nombre} · cámara lenta</span></button>
      <button className="boton" onClick={() => ver({ ...x, vieja: true })}><span className="k">{k}</span><span className="chico">{nombre} anterior (muñeco)</span></button>
    </div>
  )
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
        {comparar(EJ, '斬', 'Ejecución')}
        <p className="ayuda">El ronin corta y el rival cae (videos de Luma). La anterior, con el muñeco, queda guardada acá.</p>
      </Tarjeta>

      <Tarjeta titulo="Caramelo de monje">
        <div className="anim-grilla">
          <button className="boton" onClick={() => ver(CAR)}><span className="k">{KANJI['321'].k}</span><span className="chico">3-2-1</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'postura', modo: 'siguiente' })}><span className="k">{KANJI.siguiente.k}</span><span className="chico">Siguiente acción</span></button>
        </div>
        {comparar(CAR, KANJI['321'].k, 'Caramelo')}
        <p className="ayuda">Se arrodilla, caramelo en la mano y aura al juntar las manos (video de Luma).</p>
      </Tarjeta>

      <Tarjeta titulo="Series · parry">
        <div className="anim-grilla">
          <button className="boton" onClick={() => ver(PARRY)}><span className="k">弾</span><span className="chico">Parry (sumar serie)</span></button>
          <button className="boton" onClick={() => { for (let i = 0; i < 3; i++) window.setTimeout(() => ver(PARRY), i * 280) }}><span className="k">弾弾</span><span className="chico">Tres series seguidas</span></button>
        </div>
        {comparar(PARRY, '弾', 'Parry')}
      </Tarjeta>

      <Tarjeta titulo="Logros grandes">
        <div className="anim-grilla">
          <button className="boton" onClick={() => ver(LOG)}><span className="k">{KANJI.nivel.k}</span><span className="chico">Subir de nivel</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'logro', clase: 'racha', texto: '7 días seguidos', sub: `${KANJI.racha.k} · racha` })}><span className="k">{KANJI.racha.k}</span><span className="chico">Racha de 7 días</span></button>
          <button className="boton" onClick={() => ver({ tipo: 'logro', clase: 'fase', texto: 'Fase 2', sub: `${KANJI.fase.k} · nueva etapa` })}><span className="k">{KANJI.fase.k}</span><span className="chico">Cambio de fase</span></button>
        </div>
        {comparar(LOG, KANJI.nivel.k, 'Logro')}
        <p className="ayuda">El ronin corta, el kasa vuela y alza la katana (video de Luma). El anterior, con el muñeco, queda guardado acá.</p>
      </Tarjeta>

      <Tarjeta titulo="El shinobi, en reposo">
        <div className="sh-reposo-marco"><MuniecoVivo /></div>
        <p className="ayuda">Nunca queda quieto: respira, el kasa se mece y la bufanda y el abrigo van con el viento.</p>
      </Tarjeta>

      <Tarjeta titulo="Cuándo se muestran">
        <div className="selector-3">
          {MODOS.map((m) => (
            <button key={m.v} className={`boton chico ${(a.animaciones ?? 'todas') === m.v ? 'primario' : ''}`} onClick={() => guardar({ animaciones: m.v }, `Animaciones: ${m.t.toLowerCase()}`)}>{m.t}</button>
          ))}
        </div>
        <p className="ayuda">Si el teléfono tiene «reducir movimiento», solo se ve un destello de color y el texto.</p>
        <div className="selector-3" style={{ marginTop: 10 }}>
          <button className={`boton chico ${(a.temaAnimaciones ?? 'epico') === 'epico' ? 'primario' : ''}`} onClick={() => guardar({ temaAnimaciones: 'epico' }, 'Escenas con fondo épico')}>Épico</button>
          <button className={`boton chico ${a.temaAnimaciones === 'claro' ? 'primario' : ''}`} onClick={() => guardar({ temaAnimaciones: 'claro' }, 'Escenas sobre papel claro')}>Papel claro</button>
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

      <Tarjeta titulo="Compañero">
        <div className="selector-3">
          {([['pasea', 'Se pasea'], ['quieto', 'Quieto'], ['apagado', 'Apagado']] as [ModoCompanero, string][]).map(([v, t]) => (
            <button key={v} className={`boton chico ${(a.companero ?? 'pasea') === v ? 'primario' : ''}`} onClick={() => guardar({ companero: v }, `Compañero: ${t.toLowerCase()}`)}>{t}</button>
          ))}
        </div>
        <p className="ayuda">El shinobi chiquito camina por el borde de abajo de Hoy y queda quieto en una esquina en Calendario, Comida y Más. Tocalo y habla. Con «reducir movimiento» queda quieto. Sus frases se editan en Más → Ajustes.</p>
      </Tarjeta>

      <Tarjeta titulo="Ninjas de la distracción">
        <label className="fila chico" style={{ gap: 8 }}>
          <input type="checkbox" checked={a.ninjas !== false} onChange={(e) => guardar({ ninjas: e.target.checked }, e.target.checked ? 'Ninjas encendidos' : 'Ninjas apagados')} /> Aparecen en los momentos de duda (y el tajo al volver después de horas)
        </label>
        <label className="fila chico" style={{ gap: 8 }}>
          <input type="checkbox" checked={a.ninjasEnProgreso !== false} onChange={(e) => guardar({ ninjasEnProgreso: e.target.checked }, 'Guardado')} /> Tira «Ninjas vencidos esta semana» en Progreso
        </label>
        <MisDistracciones lista={distraccionesDe(a)} />
        <button className="boton ancho" onClick={() => { const l = distraccionesDe(a); if (!l.length) return avisar('Agregá una distracción primero'); pedirPelea({ fecha: '0000-00-00', distraccion: l[0], momento: { momento: 'duda' } }) }}>Ver una pelea de prueba</button>
        <p className="ayuda">Un ninja gris con el nombre de la distracción; el shinobi lo bloquea y queda una frase con «Empezar» / «Ahora no». Sin XP por la pelea. Máximo 2 por día solos; el botón «Estoy dudando» de Hoy no tiene tope.</p>
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

const MOMENTOS: (MomentoNinja | 'cualquiera')[] = ['cualquiera', 'pilar', 'noche', 'duda', 'juego']

/** Lista editable de distracciones: nombre y, opcional, en qué momento aparece. Se guarda con cada cambio. */
function MisDistracciones({ lista }: { lista: Distraccion[] }) {
  const [nueva, setNueva] = useState('')
  const guardarLista = (l: Distraccion[]) => mutar(() => guardarDistracciones(l))
  const cambiar = (id: string, c: Partial<Distraccion>) => guardarLista(lista.map((d) => (d.id === id ? { ...d, ...c } : d)))
  const mover = (i: number, a: number) => { const l = [...lista]; const [x] = l.splice(i, 1); l.splice(a, 0, x); void guardarLista(l) }
  const agregar = () => { if (nueva.trim().length < 2) return; void guardarLista([...lista, nuevaDistraccion(nueva)]); setNueva('') }
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="seccion-titulo">Mis distracciones</span>
      {lista.length === 0 && <p className="ayuda">La lista está vacía: los ninjas no aparecen. Agregá una.</p>}
      {lista.map((d, i) => (
        <div key={d.id} className="distraccion-fila">
          <input aria-label="Nombre de la distracción" value={d.nombre} maxLength={30} onChange={(e) => cambiar(d.id, { nombre: e.target.value })} />
          <select aria-label="Cuándo aparece" value={d.momento ?? 'cualquiera'} onChange={(e) => cambiar(d.id, { momento: e.target.value as Distraccion['momento'] })}>
            {MOMENTOS.map((m) => <option key={m} value={m}>{m === 'cualquiera' ? 'Cualquier momento' : NOMBRE_MOMENTO[m]}</option>)}
          </select>
          <button type="button" className="boton chico suave" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, i - 1)}>↑</button>
          <button type="button" className="boton chico suave" aria-label="Borrar" onClick={() => guardarLista(lista.filter((x) => x.id !== d.id))}>✕</button>
        </div>
      ))}
      <div className="fila" style={{ gap: 6 }}>
        <input placeholder="Nueva distracción (ej.: Series)" value={nueva} maxLength={30} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregar() }} style={{ flex: 1 }} />
        <button type="button" className="boton chico" onClick={agregar}>Agregar</button>
      </div>
    </div>
  )
}
