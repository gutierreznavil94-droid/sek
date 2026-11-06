import { useEffect, useState } from 'react'
import { pedirDuelo } from '../Duelo'
import { REPS_SIN_SERIE } from '../../services/duelo'
import type { Ajustes } from '../../data/tipos'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { DURACION_EJECUCION, KANJI, animar, nombreDePilar, configurarAnimaciones, useConfigAnimaciones, type Animacion, type ModoAnimaciones, type VelocidadEjecucion } from '../animaciones/motor'
import { EditorPose } from '../animaciones/EditorPose'
import { MuniecoVivo } from '../animaciones/Escena'
import { Atras, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import type { Distraccion, ModoCompanero, MomentoNinja } from '../../data/tipos'
import { NOMBRE_MOMENTO, distraccionesDe, guardarDistracciones, nuevaDistraccion } from '../../services/ninjas'
import { pedirPelea } from '../Ninja'
import { Tajo } from '../Tajo'
import { pedirBatalla } from '../Batalla'
import { pedirRival } from '../Rival'
import { forzarPajaroTorpe } from '../Desintegrar'
import { useNavigate } from 'react-router-dom'
import { XP_ROBO_MAX, modoRival, xpRoboDe } from '../../services/rival'
import { FRASE_TENSION, KANJI_TENSION, pedirTension, useClipsTension } from '../Tension'
import { pedirCaida } from '../Caida'
import { carpetaEscenas } from '../../temas/temas'
import { GaleriaShinobi } from '../../temas/shinobi/GaleriaShinobi'
import { XP_CAIDA_MAX, xpCaidaDe } from '../../services/caidas'
import { REPS_POR_TOQUE, TOPE_BATALLAS_DIA, objetivoBatalla, prepararBatalla } from '../../services/batalla'
import { listarContadores } from '../../services/contadores'
import { fechaDe } from '../../domain/fechas'
import { ahora } from '../../services/reloj'

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
  const [tajo, setTajo] = useState(false)
  const contadores = useDatos(() => listarContadores(), [])
  const clipsTension = useClipsTension()
  const [kanjiT, setKanjiT] = useState('')
  const [fraseT, setFraseT] = useState('')
  useEffect(() => {
    if (datos.datos) { setKanjiT(datos.datos.tension?.kanji ?? ''); setFraseT(datos.datos.tension?.frase ?? '') }
  }, [datos.datos])
  useEffect(() => {
    if (datos.datos) setNombre(datos.datos.nombrePersonaje || 'Shinobi')
  }, [datos.datos])
  const a = datos.datos
  if (!a) return <p className="vacio">Cargando…</p>
  const ver = (x: Animacion) => animar(x, { forzar: true })
  /** Cámara lenta (x4) solo para esa animación; la casilla general no cambia. */
  const VELOCIDADES: { v: VelocidadEjecucion; t: string }[] = [{ v: 'normal', t: 'Normal' }, { v: 'rapida', t: 'Rápida' }, { v: 'lenta', t: 'Lenta' }]
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
        <p className="chico texto-2" style={{ margin: '12px 0 6px' }}>Velocidad de la ejecución</p>
        <div className="selector-3">
          {VELOCIDADES.map((v) => (
            <button key={v.v} className={`boton chico ${config.velocidadEjecucion === v.v ? 'primario' : ''}`} onClick={() => { configurarAnimaciones({ velocidadEjecucion: v.v }); ver(EJ) }}>
              {v.t} · {(DURACION_EJECUCION[v.v] / 1000).toLocaleString('es-AR')} s
            </button>
          ))}
        </div>
        <p className="ayuda">El ronin corta, el golpe se congela un instante y el rival cae (videos de Luma). También vale para la batalla. La anterior, con el muñeco, queda guardada acá.</p>
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
        <div className="rejilla-2">
          <button className="boton" onClick={() => { const l = distraccionesDe(a); if (!l.length) return avisar('Agregá una distracción primero'); pedirPelea({ fecha: '0000-00-00', distraccion: l[0], momento: { momento: 'duda' } }) }}>Probar ninja</button>
          <button className="boton" onClick={() => setTajo(true)}>Probar el tajo</button>
        </div>
        {tajo && <Tajo onFin={() => setTajo(false)} />}
        <p className="ayuda">Un ninja gris con el nombre de la distracción; el shinobi lo bloquea y queda una frase con «Empezar» / «Ahora no» / «⚔ Batalla». Sin XP por la pelea. Máximo 2 por día solos. El tajo aparece solo al volver a la app después de 3 h con un pilar pendiente; acá lo ves cuando quieras.</p>
      </Tarjeta>

      <Tarjeta>
        <h2>Pájaro torpe</h2>
        <label className="fila chico" style={{ gap: 8 }}>
          <input type="checkbox" checked={a.pajaroTorpe !== false} onChange={(e) => guardar({ pajaroTorpe: e.target.checked }, e.target.checked ? 'Pájaro torpe encendido' : 'Pájaro torpe apagado')} /> A veces, cuando el encabezado de Hoy se hace pájaros, uno se choca con el borde, dice «¡agh!» y se va para arriba
        </label>
        <p className="ayuda">Sale 1 de cada 10 veces, nunca dos seguidas.</p>
        <PajaroTorpeProbar />
      </Tarjeta>

      <Tarjeta>
        <h2>El rival escurridizo</h2>
        <div className="campo">
          <label>Cuando aparece una distracción</label>
          <select value={modoRival(a)} onChange={(e) => guardar({ rival: { ...a.rival, modo: e.target.value as 'escurridizo' | 'carta' } }, e.target.value === 'carta' ? 'Carta directa' : 'Rival escurridizo')}>
            <option value="escurridizo">Rival escurridizo (atraparlo en Hoy)</option>
            <option value="carta">Carta directa</option>
          </select>
        </div>
        <div className="campo">
          <label>XP que roba si lo ignorás (0 a {XP_ROBO_MAX})</label>
          <input type="number" inputMode="numeric" min={0} max={XP_ROBO_MAX} value={xpRoboDe(a)} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) guardar({ rival: { ...a.rival, xpRobo: Math.max(0, Math.min(XP_ROBO_MAX, Math.round(v))) } }, `Roba ${Math.max(0, Math.min(XP_ROBO_MAX, Math.round(v)))} XP`) }} style={{ width: 90 }} />
        </div>
        <button className="boton ancho" onClick={() => { const l = distraccionesDe(a); if (!l.length) return avisar('Agregá una distracción primero'); const r = l[Math.floor(Math.random() * l.length)]; if (!pedirRival({ fecha: fechaDe(ahora(), a.zonaHoraria), distraccion: r, momento: { momento: 'duda' } })) avisar('Ya hay un rival en pantalla'); else avisar(`${r.nombre} anda por Hoy`, { tipo: 'bajo' }) }}>Probar rival (aparece en Hoy)</button>
        <p className="ayuda">Un muñeco gris con el nombre de la distracción se pasea por abajo de Hoy, sin tapar nada. Tocalo: el shinobi corre y salta; la mitad de las veces lo atrapa al primer toque, a veces se escabulle una o dos veces. Al atraparlo arranca la batalla. Si lo dejás 60 s (o cerrás la app con él en pantalla), avisa rompiendo la pantalla, con 10 s para atraparlo; si no, te roba esa XP (nunca te baja de nivel) y queda el sello «se llevó N XP». Es la única penalización de la app: por eso es chica y editable.</p>
      </Tarjeta>

      <Tarjeta titulo="Batalla contra la distracción">
        <label className="fila chico" style={{ gap: 8 }}>
          <input type="checkbox" checked={a.batalla?.activa !== false} onChange={(e) => guardar({ batalla: { ...a.batalla, activa: e.target.checked } }, e.target.checked ? 'Batalla encendida' : 'Batalla apagada: «Dudo» abre la pelea corta')} /> «Dudo» (arriba en Hoy) arranca el minijuego: 3·2·1 y flexiones por rondas
        </label>
        <div className="campo">
          <label>Ejercicio de la batalla</label>
          <select value={a.batalla?.contadorId ?? (contadores.datos?.find((c) => /flexi/i.test(c.nombre))?.id ?? contadores.datos?.[0]?.id ?? '')} onChange={(e) => guardar({ batalla: { ...a.batalla, contadorId: e.target.value } }, 'Ejercicio guardado')}>
            {(contadores.datos ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.cantidadPorToque} por serie)</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Reps por toque</label>
          <input type="number" inputMode="numeric" min={1} max={50} value={a.batalla?.repsPorToque ?? REPS_POR_TOQUE} onChange={(e) => { const v = Number(e.target.value); if (v > 0) guardar({ batalla: { ...a.batalla, repsPorToque: v } }, `${v} reps por toque`) }} style={{ width: 90 }} />
        </div>
        <div className="campo">
          <label>Flexiones del duelo sin serie rápida</label>
          <input type="number" inputMode="numeric" min={1} max={200} value={a.batalla?.repsSinSerie ?? REPS_SIN_SERIE} onChange={(e) => { const v = Number(e.target.value); if (v > 0) guardar({ batalla: { ...a.batalla, repsSinSerie: v } }, `Duelo: ${v} flexiones`) }} style={{ width: 90 }} />
        </div>
        <p className="ayuda">Duelo (al alcanzar al rival, al final de Tensión y después de «No cumplí»): pide las reps de una serie del ejercicio (en «No cumplí», la serie más la mitad) y cuenta como una serie hecha.</p>
        <button className="boton ancho" onClick={() => pedirDuelo({ motivo: 'caida', prueba: true })}>Probar el duelo</button>
        <p className="ayuda">
          {(() => { const c = (contadores.datos ?? []).find((x) => x.id === (a.batalla?.contadorId ?? '')) ?? (contadores.datos ?? []).find((x) => /flexi/i.test(x.nombre)) ?? contadores.datos?.[0]; const o = objetivoBatalla(c?.cantidadPorToque, a.batalla?.repsPorToque ?? REPS_POR_TOQUE); return `Objetivo hoy: ${o} ${c ? c.nombre.toLowerCase() : 'flexiones'} (las reps por serie redondeadas a múltiplo de ${a.batalla?.repsPorToque ?? REPS_POR_TOQUE}). Al ganar se anota una serie en el contador con esas reps, con la XP de siempre. Rendirse no anota nada. Tope: ${TOPE_BATALLAS_DIA} batallas por día.` })()}
        </p>
        <button className="boton ancho" onClick={async () => { const r = await prepararBatalla(fechaDe(ahora(), a.zonaHoraria)); if (r.batalla) pedirBatalla(r.batalla); else avisar(r.motivo) }}>Probar la batalla</button>
      </Tarjeta>

      {/* Animaciones del tema (Shinobi): Compañero, Rival, Juego y Noche */}
      {carpetaEscenas() && <GaleriaShinobi />}
      <Tarjeta titulo="Tensión 「進」">
        <p className="chico texto-2" style={{ margin: 0 }}>Cinemática para el momento de estrés: el shinobi te da la mano y espera tu toque. Termina con el kanji y la frase de abajo. Sin tope ni XP (si no le das la mano, es una caída).</p>
        <div className="fila" style={{ gap: 8 }}>
          <input aria-label="Kanji del final" value={kanjiT} maxLength={2} placeholder={KANJI_TENSION} onChange={(e) => setKanjiT(e.target.value)} style={{ width: 64, textAlign: 'center', fontSize: '1.3rem' }} />
          <input aria-label="Frase del final" value={fraseT} maxLength={60} placeholder={FRASE_TENSION} onChange={(e) => setFraseT(e.target.value)} style={{ flex: 1 }} />
          <button className="boton chico" onClick={() => guardar({ tension: { kanji: kanjiT.trim() || undefined, frase: fraseT } }, 'Guardado')}>Guardar</button>
        </div>
        {clipsTension
          ? (
            <div className="col" style={{ gap: 6 }}>
              <button className="boton ancho" onClick={() => pedirTension({ prueba: true, auto: 'mano' })}>Tensión: le das la mano</button>
              <button className="boton ancho" onClick={() => pedirTension({ prueba: true, auto: 'soltar' })}>Tensión: no le das la mano</button>
            </div>
          )
          : <p className="ayuda">Todavía no están los videos: el botón 「進」 aparece en Hoy (al lado de «Dudo») cuando estén los clips en temas/shinobi/tension/.</p>}
        <p className="ayuda">Mirada, pasos en los charcos, la mano y la espera (los rivales bajan por las laderas, cada vez más cerca). Si le das la mano, se tira del risco y carga. Si no, la derrota y sigue la caída. Acá elige sola después de unos 11 s de espera y no te saca XP.</p>
      </Tarjeta>

      <Tarjeta titulo="Caída · Nuevo round 「甦」">
        <p className="chico texto-2" style={{ margin: 0 }}>Cuando tocás «No cumplí mi palabra» (abajo de todo en Hoy) o no le das la mano en Tensión: los rivales te pasan por encima, la tumba bajo el árbol seco, la mano que sale de la tierra y «NUEVO ROUND». No reinicia nada: el día sigue igual.</p>
        <div className="campo">
          <label>XP que saca una caída (0 a {XP_CAIDA_MAX})</label>
          <input type="number" inputMode="numeric" min={0} max={XP_CAIDA_MAX} value={xpCaidaDe(a)} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) { const x = Math.max(0, Math.min(XP_CAIDA_MAX, Math.round(v))); guardar({ caida: { ...a.caida, xp: x } }, `Una caída saca ${x} XP`) } }} style={{ width: 90 }} />
        </div>
        <button className="boton ancho" onClick={() => void pedirCaida('boton', { prueba: true })}>Caída (sin perder XP)</button>
        <p className="ayuda">Queda una tumba rota en el Calendario, en Progreso («Caídas superadas») y en el registro de batallas del día. Al cerrar la escena tenés 10 s para «Deshacer». </p>
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

/** «Probar»: el próximo encabezado que se haga polvo trae al pájaro torpe; vuelve a Hoy arriba de todo. */
function PajaroTorpeProbar() {
  const navegar = useNavigate()
  return <button className="boton ancho" onClick={() => { forzarPajaroTorpe(); navegar('/'); window.scrollTo(0, 0); avisar('Bajá un poco en Hoy para verlo', { tipo: 'bajo' }) }}>Probar (bajá en Hoy)</button>
}

const MOMENTOS: (MomentoNinja | 'cualquiera')[] = ['cualquiera', 'pilar', 'noche', 'duda', 'juego', 'batalla']

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
