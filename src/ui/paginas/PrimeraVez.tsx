import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AJUSTES_INICIALES } from '../../data/semilla'
import { fechaLegible } from '../../domain/fechas'
import { configurarPrimeraVez, MAX_PILARES, SUGERENCIAS_PILARES, validarPrimeraVez, type ClavePilar, type EleccionPilar } from '../../services/primeraVez'
import { TEMAS, TEMAS_PROXIMOS, aplicarTema, saludoDe, temaPorId, type DefinicionTema } from '../../temas/temas'
import { DiasSemana, movimientoReducido } from '../componentes'
import { Divisor } from '../Divisor'
import { avisar, mutar } from '../estado'

const MuniecoVivo = lazy(() => import('../animaciones/Escena').then((m) => ({ default: m.MuniecoVivo })))
const BASE = import.meta.env.BASE_URL

const PASOS = [
  { kanji: '始', titulo: 'Bienvenida' },
  { kanji: '忍', titulo: 'Tema' },
  { kanji: '柱', titulo: 'Tus pilares' },
  { kanji: '時', titulo: 'Horarios' },
  { kanji: '志', titulo: 'Tu visión' },
  { kanji: '誓', titulo: 'Listo' },
]

/**
 * Primera vez: seis pasos cortos para armar la app a medida. Solo aparece si
 * la base nunca tuvo un ciclo (a Navil no le aparece).
 */
export function PrimeraVez({ hoy }: { hoy: string }) {
  const [paso, setPaso] = useState(0)
  const [nombre, setNombre] = useState('')
  const [nombreApp, setNombreApp] = useState('SEK')
  const [tema, setTema] = useState('shinobi')
  const [pilares, setPilares] = useState<EleccionPilar[]>([])
  const [horarios, setHorarios] = useState({ alistarse: AJUSTES_INICIALES.horaAlistarse, dejarCelu: AJUSTES_INICIALES.horaDejarCelu, dormir: AJUSTES_INICIALES.horaDormido })
  const [vision, setVision] = useState('')
  const [obstaculo, setObstaculo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const navegar = useNavigate()

  const config = { hoy, nombrePersona: nombre, nombreApp, tema, pilares, horarios, vision, obstaculo }
  const errorDelPaso = (): string | null => {
    if (paso === 0 && !nombre.trim()) return 'Escribí tu nombre para seguir.'
    if (paso === 2) {
      if (!pilares.length) return 'Tildá al menos un pilar.'
      const e = validarPrimeraVez({ ...config, nombrePersona: 'x' }).find((x) => x.startsWith('«') || x.startsWith('Cada'))
      if (e) return e
    }
    if (paso === 3 && validarPrimeraVez({ ...config, nombrePersona: 'x', pilares: [{ clave: 'leer', nombre: 'xx', dias: [1] }] }).length) return 'Revisá los horarios.'
    return null
  }
  const bloqueo = errorDelPaso()
  const siguiente = () => { setError(''); setPaso((p) => Math.min(PASOS.length - 1, p + 1)); window.scrollTo(0, 0) }
  const atras = () => { setError(''); setPaso((p) => Math.max(0, p - 1)); window.scrollTo(0, 0) }
  const empezar = async () => {
    setGuardando(true)
    setError('')
    try {
      await mutar(() => configurarPrimeraVez(config))
      aplicarTema(tema, nombreApp)
      avisar(`Día 1: ${fechaLegible(hoy)}. ¡Vamos, ${nombre.trim()}!`, { tipo: 'ok' })
      navegar('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setGuardando(false)
    }
  }

  return (
    <div className="pv" data-paso={paso + 1}>
      <header className="pv-cabeza">
        <div className="pv-trazos" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
          {PASOS.map((p, i) => <span key={p.titulo} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''} />)}
        </div>
        <div className="pv-titulo">
          <span className="pv-kanji" aria-hidden>{PASOS[paso].kanji}</span>
          <div>
            <span className="pv-num">Paso {paso + 1} de {PASOS.length}</span>
            <h1>{PASOS[paso].titulo}</h1>
          </div>
        </div>
        <Divisor className="divisor-cabecera" />
      </header>

      <main className="pv-cuerpo" key={paso}>
        {paso === 0 && (
          <>
            <p className="pv-lead">Hola. En seis pasos cortos armamos tu app: tus pilares, tus horarios y tu ciclo de 90 días.</p>
            <div className="campo">
              <label htmlFor="pv-nombre">¿Cómo te llamás?</label>
              <input id="pv-nombre" value={nombre} autoComplete="given-name" placeholder="Tu nombre" onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="pv-app">¿Cómo querés llamar a tu app?</label>
              <input id="pv-app" value={nombreApp} maxLength={20} onChange={(e) => setNombreApp(e.target.value)} />
              <span className="ayuda">Por defecto, SEK. Lo podés cambiar después en Más → Tema y nombres.</span>
            </div>
            <p className="ayuda centro">¿Ya usabas la app en otro teléfono? <Link to="/copia">Restaurar una copia</Link></p>
          </>
        )}

        {paso === 1 && (
          <>
            <p className="pv-lead">Elegí la cara de tu app. Tus datos son los mismos con cualquier tema y lo podés cambiar cuando quieras.</p>
            <ListaTemas valor={tema} onElegir={setTema} />
          </>
        )}

        {paso === 2 && <ElegirPilares valor={pilares} onChange={setPilares} />}

        {paso === 3 && (
          <>
            <p className="pv-lead">La noche en tres pasos. Con esto la app te avisa y arma tu modo sueño.</p>
            <FilaHora id="pv-h1" etiqueta="Me empiezo a alistar" ayuda="Ducha, dientes, ropa de mañana" valor={horarios.alistarse} onChange={(v) => setHorarios({ ...horarios, alistarse: v })} />
            <FilaHora id="pv-h2" etiqueta="Dejo el celu" ayuda="Lejos de la cama" valor={horarios.dejarCelu} onChange={(v) => setHorarios({ ...horarios, dejarCelu: v })} />
            <FilaHora id="pv-h3" etiqueta="Me duermo" ayuda="Luz apagada" valor={horarios.dormir} onChange={(v) => setHorarios({ ...horarios, dormir: v })} />
            <p className="ayuda">De ejemplo están los horarios de quien hizo la app (20:50 · 21:15 · 21:20). Cambialos por los tuyos.</p>
          </>
        )}

        {paso === 4 && (
          <>
            <p className="pv-lead">Una frase para acordarte por qué empezaste. Se puede saltar y escribir después.</p>
            <div className="campo">
              <label htmlFor="pv-vision">¿Quién querés ser?</label>
              <textarea id="pv-vision" rows={3} value={vision} placeholder="Ej.: alguien que cumple lo que se propone" onChange={(e) => setVision(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="pv-obst">Tu obstáculo principal</label>
              <input id="pv-obst" value={obstaculo} placeholder="Ej.: postergar" onChange={(e) => setObstaculo(e.target.value)} />
            </div>
          </>
        )}

        {paso === 5 && <Listo tema={temaPorId(tema)} nombre={nombre.trim()} hoy={hoy} pilares={pilares} />}

        {(error || (bloqueo && paso !== 0)) && <p className="error chico">{error || bloqueo}</p>}
      </main>

      <footer className="pv-pie">
        {paso > 0 ? <button className="boton" onClick={atras} disabled={guardando}>‹ Atrás</button> : <span />}
        {paso === 4 && !vision.trim() && !obstaculo.trim() ? (
          <button className="boton primario" onClick={siguiente}>Saltar</button>
        ) : paso < PASOS.length - 1 ? (
          <button className="boton primario" onClick={siguiente} disabled={!!bloqueo}>Siguiente</button>
        ) : (
          <button className="boton primario" onClick={empezar} disabled={guardando}>{guardando ? 'Armando…' : 'Empezar'}</button>
        )}
      </footer>
    </div>
  )
}

function FilaHora({ id, etiqueta, ayuda, valor, onChange }: { id: string; etiqueta: string; ayuda: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="pv-hora" htmlFor={id}>
      <span><b>{etiqueta}</b><span className="texto-3 chico">{ayuda}</span></span>
      <input id={id} type="time" value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** Tarjetas de temas: los listos con vista previa animada y los «Próximamente» apagados. */
export function ListaTemas({ valor, onElegir }: { valor: string; onElegir: (id: string) => void }) {
  const quieto = movimientoReducido()
  return (
    <div className="pv-temas">
      {TEMAS.map((t: DefinicionTema) => (
        <button key={t.id} className={`pv-tema ${valor === t.id ? 'elegido' : ''}`} aria-pressed={valor === t.id} onClick={() => onElegir(t.id)} style={{ ['--tema-acento' as string]: t.acento }}>
          <span className="pv-tema-vista">
            {t.vistaPrevia.video && !quieto ? (
              <video src={BASE + t.vistaPrevia.video} poster={BASE + t.vistaPrevia.imagen} autoPlay muted loop playsInline preload="metadata" />
            ) : (
              <img src={BASE + t.vistaPrevia.imagen} alt="" />
            )}
            <span className="pv-tema-sprite" style={{ backgroundImage: `url(${BASE + t.sprite})` }} aria-hidden />
          </span>
          <span className="pv-tema-texto">
            <b>{t.nombre}</b>
            <span className="chico texto-2">{t.descripcion}</span>
          </span>
          {valor === t.id && <span className="pv-tema-sello" aria-hidden>印</span>}
        </button>
      ))}
      {TEMAS_PROXIMOS.map((t) => (
        <div key={t.id} className="pv-tema apagado" aria-disabled>
          <span className="pv-tema-vista"><span className="pv-tema-pronto">?</span></span>
          <span className="pv-tema-texto">
            <b>{t.nombre}</b>
            <span className="chico texto-3">{t.pista}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ElegirPilares({ valor, onChange }: { valor: EleccionPilar[]; onChange: (v: EleccionPilar[]) => void }) {
  const elegido = (c: ClavePilar) => valor.find((p) => p.clave === c)
  const lleno = valor.length >= MAX_PILARES
  const alternar = (c: ClavePilar) => {
    if (elegido(c)) return onChange(valor.filter((p) => p.clave !== c))
    if (lleno) return avisar(`Máximo ${MAX_PILARES} pilares: pocos y firmes.`)
    const s = SUGERENCIAS_PILARES.find((x) => x.clave === c)!
    onChange([...valor, { clave: c, nombre: c === 'otro' ? '' : s.nombre, dias: [...s.dias], horaLimite: s.pideHora ? s.horaLimite : undefined, minutos: s.pideMinutos ? s.minutos : undefined }])
  }
  const cambiar = (c: ClavePilar, cambios: Partial<EleccionPilar>) => onChange(valor.map((p) => (p.clave === c ? { ...p, ...cambios } : p)))
  return (
    <>
      <p className="pv-lead">Tildá lo que querés cumplir cada día. Pocos y firmes: hasta {MAX_PILARES}. <b className="pv-cuenta">{valor.length}/{MAX_PILARES}</b></p>
      <div className="pv-pilares">
        {SUGERENCIAS_PILARES.map((s) => {
          const p = elegido(s.clave)
          return (
            <div key={s.clave} className={`pv-pilar ${p ? 'elegido' : ''} ${!p && lleno ? 'apagado' : ''}`}>
              <button className="pv-pilar-tilde" aria-pressed={!!p} onClick={() => alternar(s.clave)}>
                <span className="pv-casilla" aria-hidden>{p ? '✓' : ''}</span>
                <span>{s.nombre}</span>
              </button>
              {p && (
                <div className="pv-pilar-detalle">
                  {s.clave === 'otro' && <input aria-label="Nombre del pilar" value={p.nombre} placeholder="¿Qué pilar?" onChange={(e) => cambiar(s.clave, { nombre: e.target.value })} />}
                  <DiasSemana valor={p.dias} onChange={(dias) => cambiar(s.clave, { dias })} />
                  {(s.pideHora || s.pideMinutos) && (
                    <div className="pv-pilar-fila">
                      {s.pideHora && (
                        <label>
                          <span className="texto-3 chico">{s.clave === 'entrenar' ? 'Empezar hasta' : 'Hora límite'}</span>
                          <input type="time" value={p.horaLimite ?? ''} onChange={(e) => cambiar(s.clave, { horaLimite: e.target.value })} />
                        </label>
                      )}
                      {s.pideMinutos && (
                        <label>
                          <span className="texto-3 chico">{s.clave === 'entrenar' ? 'Duración (min)' : 'Mínimo (min)'}</span>
                          <input type="number" inputMode="numeric" min={1} max={240} value={p.minutos ?? ''} onChange={(e) => cambiar(s.clave, { minutos: Number(e.target.value) || undefined })} />
                        </label>
                      )}
                    </div>
                  )}
                  {s.clave === 'dormir' && <span className="texto-3 chico">La hora sale del paso siguiente («Dejo el celu»).</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!elegido('entrenar') && <p className="ayuda">Sin «Entrenar», la pestaña de entreno queda igual pero no cuenta como pilar.</p>}
    </>
  )
}

function Listo({ tema, nombre, hoy, pilares }: { tema: DefinicionTema; nombre: string; hoy: string; pilares: EleccionPilar[] }) {
  return (
    <>
      <div className="pv-saludo">
        <div className="sh-reposo-marco pv-personaje">
          <Suspense fallback={<div className="pv-personaje-vacio" />}>
            <MuniecoVivo />
          </Suspense>
        </div>
        <p className="pv-globo"><b>¡Hola, {nombre}!</b> {saludoDe(tema, nombre)}</p>
      </div>
      <div className="pv-resumen">
        <div><span className="texto-3 chico">Tu ciclo</span><b>90 días desde hoy</b><span className="chico texto-2">Día 1: {fechaLegible(hoy)}</span></div>
        <div><span className="texto-3 chico">Tus pilares</span><b>{pilares.map((p) => p.nombre.trim()).join(' · ')}</b></div>
      </div>
      <p className="ayuda">Todo se puede cambiar después desde Más. Los datos viven solo en este teléfono: hacé una copia cada semana.</p>
    </>
  )
}
