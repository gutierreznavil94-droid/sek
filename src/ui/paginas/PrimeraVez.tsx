import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ConfigAviso } from '../../data/tipos'
import { fechaLegible } from '../../domain/fechas'
import {
  configDeEntrada, configurarDeNuevo, configurarPrimeraVez, MAX_PILARES, NIVELES_SERIE, numerosDeNivel, PILARES_DEL_CREADOR, serieNueva, SUGERENCIAS_PILARES,
  TEXTO_CREADOR, validarPrimeraVez, xpDePilar, type ClavePilar, type ConfigPrimeraVez, type EleccionPilar, type NivelSerie, type SerieElegida,
} from '../../services/primeraVez'
import { AVISOS, configAviso } from '../../services/avisos'
import { programarAlarmas } from '../../services/alarmas'
import { recordatorios } from '../../reminders/recordatorios'
import { TEMAS_PROXIMOS, aplicarTema, saludoDe, temaPorId, urlTema, useTemasElegibles, type DefinicionTema } from '../../temas/temas'
import { EXTENSION_TEMA, borrarTemaPropio, importarTema } from '../../temas/propios'
import { Cargando, DiasSemana, movimientoReducido } from '../componentes'
import { Divisor } from '../Divisor'
import { FondoLluvia } from '../FondoLluvia'
import { ShinobiRespira } from '../../temas/shinobi/ShinobiRespira'
import { avisar, mutar } from '../estado'
import { temaTieneFormulario } from '../../services/recomendaciones'
import { ListaAvisos } from './AlarmasTelefono'
import { diasDeEleccion, type EleccionEntreno } from '../../data/planes'
import { ComoEmpezar, nombreEleccion } from '../ComoEmpezar'
import { FUNCIONES, usa } from '../../services/funciones'
import type { Funcion } from '../../data/tipos'

const MuniecoVivo = lazy(() => import('../animaciones/Escena').then((m) => ({ default: m.MuniecoVivo })))

type IdPaso = 'nombre' | 'usar' | 'pilares' | 'series' | 'sueno' | 'juego' | 'comida' | 'avisos' | 'resumen'
const PASOS: { id: IdPaso; kanji: string; titulo: string }[] = [
  { id: 'nombre', kanji: '始', titulo: 'Nombre y tema' },
  { id: 'usar', kanji: '選', titulo: '¿Qué querés usar?' },
  { id: 'pilares', kanji: '柱', titulo: 'Tus pilares' },
  { id: 'series', kanji: '力', titulo: 'Series rápidas' },
  { id: 'sueno', kanji: '眠', titulo: 'Sueño' },
  { id: 'juego', kanji: '遊', titulo: 'Juego' },
  { id: 'comida', kanji: '水', titulo: 'Comida y agua' },
  { id: 'avisos', kanji: '鈴', titulo: 'Avisos' },
  { id: 'resumen', kanji: '誓', titulo: 'Resumen' },
]

/** Los pasos que tocan según lo que se usa: lo apagado en «¿Qué querés usar?» no tiene paso. */
function pasosVisibles(c: ConfigPrimeraVez): typeof PASOS {
  const f = (x: Funcion) => usa(c, x)
  return PASOS.filter((p) => {
    if (p.id === 'series') return f('series')
    if (p.id === 'juego') return f('juego')
    if (p.id === 'comida') return f('comida')
    // Los horarios de la noche sirven al Sueño y al pilar «Dormir a horario».
    if (p.id === 'sueno') return f('sueno') || c.pilares.some((x) => x.clave === 'dormir')
    return true
  })
}

/** Qué vuelve a lo de entrada cada «Saltar». */
const CAMPOS_DEL_PASO: Partial<Record<IdPaso, (keyof ConfigPrimeraVez)[]>> = {
  nombre: ['nombreApp', 'tema'],
  usar: ['funciones'],
  pilares: ['pilares'],
  series: ['series', 'subidaSugerida', 'repsSinSerie'],
  sueno: ['horarios'],
  juego: ['juego'],
  comida: ['agua', 'fruta'],
  avisos: ['avisos'],
}

function restarMinutos(hora: string | undefined, min: number): string | undefined {
  if (!hora) return undefined
  const [h, m] = hora.split(':').map(Number)
  const t = (((h * 60 + m - min) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** 90 → «1 h 30 min». */
export function textoMinutos(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * Primer arranque (y Más → «Configurar de nuevo»): siete pasos con valores de entrada ya cargados y «Saltar»
 * en cada uno, y un resumen al final. De nuevo no borra nada: solo cambia ajustes, pilares y series.
 */
export function PrimeraVez({ hoy, deNuevo = false }: { hoy: string; deNuevo?: boolean }) {
  const [paso, setPaso] = useState(0)
  const [inicial, setInicial] = useState<ConfigPrimeraVez | null>(null)
  const [c, setC] = useState<ConfigPrimeraVez | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const navegar = useNavigate()

  useEffect(() => {
    let vivo = true
    configDeEntrada(hoy, deNuevo).then((x) => { if (vivo) { setInicial(x); setC(x) } })
    return () => { vivo = false }
  }, [hoy, deNuevo])

  if (!c || !inicial) return <div className="contenido"><Cargando /></div>
  const cambiar = (x: Partial<ConfigPrimeraVez>) => setC({ ...c, ...x })

  const pasos = pasosVisibles(c)
  const TOTAL = pasos.length - 1
  const id = pasos[Math.min(paso, pasos.length - 1)].id
  const errorDelPaso = (): string | null => {
    if (id === 'nombre' && !c.nombrePersona.trim()) return 'Escribí tu nombre para seguir.'
    const errores = validarPrimeraVez({ ...c, nombrePersona: c.nombrePersona || 'x' })
    if (id === 'pilares') {
      if (!c.pilares.length) return 'Prendé al menos un pilar.'
      return errores.find((x) => x.startsWith('«') && c.pilares.some((p) => x.startsWith(`«${p.nombre}»`)) || x.startsWith('Cada pilar') || x.startsWith('Máximo')) ?? null
    }
    if (id === 'series') return errores.find((x) => x.startsWith('Cada serie') || x.includes('reps y series') || x.includes('Tensión')) ?? null
    if (id === 'sueno') return errores.find((x) => x.startsWith('Revisá los horarios')) ?? null
    if (id === 'juego') return errores.find((x) => x.includes('Juego')) ?? null
    if (id === 'comida') return errores.find((x) => x.includes('agua') || x.includes('frutas')) ?? null
    return null
  }
  const bloqueo = errorDelPaso()
  const ir = (n: number) => { setError(''); setPaso(Math.max(0, Math.min(pasos.length - 1, n))); window.scrollTo(0, 0) }
  const saltar = () => {
    const vuelta: Partial<ConfigPrimeraVez> = {}
    for (const k of CAMPOS_DEL_PASO[id] ?? []) (vuelta as Record<string, unknown>)[k] = inicial[k]
    setC({ ...c, ...vuelta })
    ir(paso + 1)
  }
  const terminar = async () => {
    setGuardando(true)
    setError('')
    try {
      if (deNuevo) {
        await mutar(async () => { await configurarDeNuevo(c); await programarAlarmas().catch(() => 0) })
        aplicarTema(c.tema, c.nombreApp)
        avisar('Listo: cambios guardados. Tus datos siguen igual.', { tipo: 'ok' })
        navegar('/mas')
      } else {
        await mutar(() => configurarPrimeraVez(c))
        aplicarTema(c.tema, c.nombreApp)
        avisar(`Día 1: ${fechaLegible(hoy)}. ¡Vamos, ${c.nombrePersona.trim()}!`, { tipo: 'ok' })
        navegar('/')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setGuardando(false)
    }
  }
  const esResumen = id === 'resumen'

  return (
    <div className="pv" data-paso={id}>
      <header className="pv-cabeza">
        <div className="pv-trazos" aria-label={esResumen ? 'Resumen' : `Paso ${paso + 1} de ${TOTAL}`}>
          {pasos.slice(0, TOTAL).map((p, i) => <span key={p.titulo} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''} />)}
        </div>
        <div className="pv-titulo">
          <span className="pv-kanji" aria-hidden>{pasos[paso]?.kanji}</span>
          <div>
            <span className="pv-num">{esResumen ? (deNuevo ? 'Configurar de nuevo' : 'Listo') : `Paso ${paso + 1} de ${TOTAL}`}</span>
            <h1>{pasos[paso]?.titulo}</h1>
          </div>
        </div>
        <Divisor className="divisor-cabecera" />
      </header>

      <main className="pv-cuerpo" key={id}>
        {id === 'nombre' && (
          <>
            <p className="pv-lead">{deNuevo ? 'Revisá cada paso y cambiá lo que quieras. Tus datos, tu ciclo y tu XP quedan como están.' : `Hola. En ${TOTAL} pasos cortos armamos tu app a tu gusto. Todo viene cargado: si algo te sirve así, tocá «Saltar».`}</p>
            <div className="campo">
              <label htmlFor="pv-nombre">¿Cómo te llamás?</label>
              <input id="pv-nombre" value={c.nombrePersona} autoComplete="given-name" placeholder="Tu nombre" onChange={(e) => cambiar({ nombrePersona: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="pv-app">¿Cómo querés llamar a tu app?</label>
              <input id="pv-app" value={c.nombreApp} maxLength={20} onChange={(e) => cambiar({ nombreApp: e.target.value })} />
            </div>
            <span className="seccion-titulo">Tema</span>
            <ListaTemas valor={c.tema} onElegir={(tema) => cambiar({ tema })} />
            {!deNuevo && <p className="ayuda centro">¿Ya usabas la app en otro teléfono? <Link to="/copia">Restaurar una copia</Link></p>}
          </>
        )}

        {id === 'usar' && <ElegirFunciones valor={c.funciones ?? {}} onChange={(funciones) => cambiar({ funciones })} />}

        {id === 'pilares' && (
          <ElegirPilares
            valor={c.pilares}
            onChange={(pilares) => cambiar({ pilares })}
            entreno={c.entreno ?? { modo: 'poco' }}
            onEntreno={deNuevo || !usa(c, 'planes') ? undefined : (entreno, pilares) => cambiar(pilares ? { entreno, pilares } : { entreno })}
          />
        )}

        {id === 'series' && <ElegirSeries c={c} onChange={cambiar} />}

        {id === 'sueno' && (
          <>
            <p className="pv-lead">La noche en tres pasos. Con esto la app te avisa y arma tu modo sueño.</p>
            <FilaHora id="pv-h1" etiqueta="Me empiezo a alistar" ayuda="Ducha, dientes, ropa de mañana" valor={c.horarios.alistarse} onChange={(v) => cambiar({ horarios: { ...c.horarios, alistarse: v } })} />
            <FilaHora id="pv-h2" etiqueta="Dejo el celu" ayuda="Lejos de la cama" valor={c.horarios.dejarCelu} onChange={(v) => cambiar({ horarios: { ...c.horarios, dejarCelu: v } })} />
            <FilaHora id="pv-h3" etiqueta="Me duermo" ayuda="Luz apagada" valor={c.horarios.dormir} onChange={(v) => cambiar({ horarios: { ...c.horarios, dormir: v } })} />
            {!deNuevo && <p className="ayuda">De entrada están los de quien hizo la app (20:50 · 21:15 · 21:20).</p>}
          </>
        )}

        {id === 'juego' && c.juego && (
          <>
            <p className="pv-lead">Cuánto tiempo de Juego te permitís por día. La pestaña Juego lo cuenta y te avisa al llegar.</p>
            <FilaMinutos id="pv-j1" etiqueta="Lunes a viernes" valor={c.juego.semana} onChange={(v) => cambiar({ juego: { ...c.juego!, semana: v } })} />
            <FilaMinutos id="pv-j2" etiqueta="Sábado, domingo y feriados" valor={c.juego.finde} onChange={(v) => cambiar({ juego: { ...c.juego!, finde: v } })} />
            <p className="ayuda">Con 0 minutos, el Juego queda sin tiempo permitido.</p>
          </>
        )}

        {id === 'comida' && c.agua && c.fruta && (
          <>
            <p className="pv-lead">La cantimplora y la manzana de Hoy. Si no las querés, «No usar» y no aparecen.</p>
            <div className={`pv-pilar ${c.agua.usar ? 'elegido' : ''}`}>
              <div className="pv-pilar-cabeza"><b className="crece">Agua</b><Interruptor etiqueta="Usar agua" valor={c.agua.usar} onChange={(usar) => cambiar({ agua: { ...c.agua!, usar } })} /></div>
              {c.agua.usar ? (
                <div className="pv-pilar-detalle">
                  <label className="pv-numero"><span>Litros por día</span><input type="number" inputMode="decimal" step={0.25} min={0.25} value={c.agua.litros} onChange={(e) => cambiar({ agua: { ...c.agua!, litros: Number(e.target.value) } })} /></label>
                </div>
              ) : <p className="pv-pilar-detalle texto-3 chico">No usar: no aparece en Hoy.</p>}
            </div>
            <div className={`pv-pilar ${c.fruta.usar ? 'elegido' : ''}`}>
              <div className="pv-pilar-cabeza"><b className="crece">Fruta</b><Interruptor etiqueta="Usar fruta" valor={c.fruta.usar} onChange={(usar) => cambiar({ fruta: { ...c.fruta!, usar } })} /></div>
              {c.fruta.usar ? (
                <div className="pv-pilar-detalle">
                  <label className="pv-numero"><span>Frutas por día</span><input type="number" inputMode="numeric" min={1} max={10} value={c.fruta.porDia} onChange={(e) => cambiar({ fruta: { ...c.fruta!, porDia: Number(e.target.value) } })} /></label>
                </div>
              ) : <p className="pv-pilar-detalle texto-3 chico">No usar: no aparece en Hoy.</p>}
            </div>
            <p className="ayuda">Calorías y proteína se configuran después en Más → Comida.</p>
          </>
        )}

        {id === 'avisos' && <PasoAvisos c={c} onChange={cambiar} />}

        {esResumen && <Resumen c={c} deNuevo={deNuevo} tema={temaPorId(c.tema)} />}

        {(error || (bloqueo && id !== 'nombre')) && <p className="error chico">{error || bloqueo}</p>}
      </main>

      <footer className="pv-pie">
        {paso > 0 ? <button className="boton" onClick={() => ir(paso - 1)} disabled={guardando}>‹ Atrás</button> : deNuevo ? <button className="boton" onClick={() => navegar('/mas')}>Cancelar</button> : <span />}
        {!esResumen && <button className="boton suave pv-saltar" onClick={saltar} disabled={id === 'nombre' && !c.nombrePersona.trim()}>Saltar</button>}
        {!esResumen ? (
          <button className="boton primario" onClick={() => ir(paso + 1)} disabled={!!bloqueo}>Siguiente</button>
        ) : (
          <button className="boton primario" onClick={terminar} disabled={guardando}>{guardando ? 'Guardando…' : deNuevo ? 'Guardar cambios' : 'Empezar Día 1'}</button>
        )}
      </footer>
    </div>
  )
}

/** «¿Qué querés usar?»: lo del creador prendido, lo de App Nay apagado; cada uno elige. */
function ElegirFunciones({ valor, onChange }: { valor: Partial<Record<Funcion, boolean>>; onChange: (v: Partial<Record<Funcion, boolean>>) => void }) {
  const grupo = (de: 'sek' | 'nay', titulo: string) => (
    <>
      <span className="seccion-titulo">{titulo}</span>
      <div className="pv-pilares">
        {FUNCIONES.filter((f) => f.de === de).map((f) => {
          const prendida = usa({ funciones: valor }, f.id)
          return (
            <div key={f.id} className={`pv-pilar ${prendida ? 'elegido' : ''}`}>
              <div className="pv-pilar-cabeza">
                <span className="crece col" style={{ gap: 2 }}><b>{f.nombre}</b><span className="texto-3 chico">{f.detalle}</span></span>
                <Interruptor etiqueta={f.nombre} valor={prendida} onChange={(v) => onChange({ ...valor, [f.id]: v })} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
  return (
    <>
      <p className="pv-lead">Prendé solo lo que vas a usar. Lo apagado no aparece en Hoy ni en Más y sus avisos no suenan. Se cambia cuando quieras en Más → Configurar de nuevo.</p>
      {grupo('sek', 'De SEK')}
      {grupo('nay', 'Extras de entreno')}
    </>
  )
}

function Interruptor({ valor, onChange, etiqueta }: { valor: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button type="button" role="switch" aria-checked={valor} aria-label={etiqueta} className={`pv-switch ${valor ? 'on' : ''}`} onClick={() => onChange(!valor)}>
      <span className="pv-switch-texto">{valor ? 'Usar' : 'No usar'}</span>
      <span className="pv-switch-pista" aria-hidden><span /></span>
    </button>
  )
}

function FilaMinutos({ id, etiqueta, valor, onChange }: { id: string; etiqueta: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label className="pv-hora" htmlFor={id}>
      <span><b>{etiqueta}</b><span className="texto-3 chico">{textoMinutos(valor || 0)} por día</span></span>
      <span className="fila" style={{ gap: 6, flexDirection: 'row', alignItems: 'center' }}>
        <input id={id} type="number" inputMode="numeric" min={0} max={720} step={15} value={valor} style={{ width: 90 }} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
        <span className="chico texto-2">min</span>
      </span>
    </label>
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

/** Tarjetas de temas: los listos con vista previa animada, los subidos por la persona, «Importar tema» y los «Próximamente» apagados. */
export function ListaTemas({ valor, onElegir }: { valor: string; onElegir: (id: string) => void }) {
  const quieto = movimientoReducido()
  const temas = useTemasElegibles()
  const [subiendo, setSubiendo] = useState(false)
  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true)
    try {
      const id = await importarTema(await archivo.text())
      onElegir(id)
      avisar('Tema subido. Queda guardado solo en este celu.', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error && e.message ? e.message : 'No se pudo leer ese archivo.')
    } finally {
      setSubiendo(false)
    }
  }
  const borrar = async (t: DefinicionTema) => {
    if (!confirm(`¿Borrar el tema «${t.nombre}» de este celu? Tus datos no se tocan.`)) return
    await borrarTemaPropio(t.id)
    if (valor === t.id) onElegir('shinobi')
    avisar('Tema borrado', { tipo: 'ok' })
  }
  return (
    <div className="pv-temas">
      {temas.map((t: DefinicionTema) => (
        <div key={t.id} className="pv-tema-lugar">
          <button className={`pv-tema ${valor === t.id ? 'elegido' : ''}`} aria-pressed={valor === t.id} onClick={() => onElegir(t.id)} style={{ ['--tema-acento' as string]: t.acento }}>
            <span className="pv-tema-vista">
              {t.vistaPrevia.video && !quieto ? (
                <video src={urlTema(t.vistaPrevia.video)} poster={urlTema(t.vistaPrevia.imagen)} autoPlay muted loop playsInline preload="metadata" />
              ) : (
                <img src={urlTema(t.vistaPrevia.imagen)} alt="" />
              )}
              {t.sprite && <span className="pv-tema-sprite" style={{ backgroundImage: `url(${urlTema(t.sprite)})` }} aria-hidden />}
              {t.propio && t.adornos?.imagenAnimaciones && <img className="pv-tema-personaje" src={t.adornos.imagenAnimaciones} alt="" />}
            </span>
            <span className="pv-tema-texto">
              <b>{t.nombre}</b>
              <span className="chico texto-2">{t.descripcion}</span>
            </span>
            {valor === t.id && <span className="pv-tema-sello" aria-hidden>印</span>}
          </button>
          {t.propio && <button className="pv-tema-borrar" onClick={() => borrar(t)} aria-label={`Borrar el tema ${t.nombre}`}>✕</button>}
        </div>
      ))}
      <label className={`pv-tema pv-tema-importar ${subiendo ? 'subiendo' : ''}`}>
        <input type="file" className="pv-tema-archivo" aria-label="Importar tema" disabled={subiendo} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void subir(f) }} />
        <span className="pv-tema-vista"><span className="pv-tema-pronto">{subiendo ? '…' : '＋'}</span></span>
        <span className="pv-tema-texto">
          <b>Importar tema</b>
          <span className="chico texto-2">¿Tenés un archivo de tema ({EXTENSION_TEMA})? Subilo y queda guardado solo en este celu.</span>
        </span>
      </label>
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

/** `onEntreno` solo en la primera vez: «¿Cómo querés empezar a entrenar?» dentro del pilar Entrenar (en «Configurar de nuevo» las rutinas no se tocan). */
function ElegirPilares({ valor, onChange, entreno, onEntreno }: { valor: EleccionPilar[]; onChange: (v: EleccionPilar[]) => void; entreno: EleccionEntreno; onEntreno?: (e: EleccionEntreno, pilares?: EleccionPilar[]) => void }) {
  const [visibles, setVisibles] = useState<ClavePilar[]>(() => [...new Set([...valor.map((p) => p.clave), ...PILARES_DEL_CREADOR.map((p) => p.clave)])])
  const elegido = (c: ClavePilar) => valor.find((p) => p.clave === c)
  const lleno = valor.length >= MAX_PILARES
  const prender = (c: ClavePilar) => {
    if (lleno) return avisar(`Máximo ${MAX_PILARES} pilares: pocos y firmes.`)
    const del = PILARES_DEL_CREADOR.find((p) => p.clave === c)
    const s = SUGERENCIAS_PILARES.find((x) => x.clave === c)!
    const dias = (c === 'entrenar' && onEntreno && diasDeEleccion(entreno)) || (del ? del.dias : s.dias)
    onChange([...valor, del ? { ...del, dias: [...dias] } : { clave: c, nombre: c === 'otro' ? '' : s.nombre, dias: [...dias], horaLimite: s.pideHora ? s.horaLimite : undefined, minutos: s.pideMinutos ? s.minutos : undefined }])
  }
  const alternar = (c: ClavePilar) => (elegido(c) ? onChange(valor.filter((p) => p.clave !== c)) : prender(c))
  const cambiar = (c: ClavePilar, cambios: Partial<EleccionPilar>) => onChange(valor.map((p) => (p.clave === c ? { ...p, ...cambios } : p)))
  const resto = SUGERENCIAS_PILARES.filter((s) => !visibles.includes(s.clave))
  // Un plan completo trae sus días: el pilar Entrenar los toma (se pueden cambiar igual). Va en un solo cambio para no pisar nada.
  const elegirEntreno = (e: EleccionEntreno) => {
    const dias = diasDeEleccion(e)
    onEntreno?.(e, dias ? valor.map((p) => (p.clave === 'entrenar' ? { ...p, dias: [...dias] } : p)) : undefined)
  }
  return (
    <>
      <p className="pv-lead">Lo que querés cumplir cada día. De entrada, los 4 del creador: apagá los que no quieras, cambiales el nombre y la hora. Hasta {MAX_PILARES}. <b className="pv-cuenta">{valor.length}/{MAX_PILARES}</b></p>
      <div className="pv-pilares">
        {visibles.map((clave) => {
          const s = SUGERENCIAS_PILARES.find((x) => x.clave === clave)!
          const p = elegido(clave)
          return (
            <div key={clave} className={`pv-pilar ${p ? 'elegido' : ''}`}>
              <div className="pv-pilar-cabeza">
                {p ? <input className="pv-pilar-nombre" aria-label="Nombre del pilar" value={p.nombre} placeholder="¿Qué pilar?" onChange={(e) => cambiar(clave, { nombre: e.target.value })} /> : <b className="crece texto-2">{s.nombre}</b>}
                <Interruptor etiqueta={s.nombre} valor={!!p} onChange={() => alternar(clave)} />
              </div>
              {p && (
                <div className="pv-pilar-detalle">
                  <DiasSemana valor={p.dias} onChange={(dias) => cambiar(clave, { dias })} />
                  {(s.pideHora || s.pideMinutos) && (
                    <div className="pv-pilar-fila">
                      {s.pideHora && (
                        <label>
                          <span className="texto-3 chico">{clave === 'entrenar' ? 'Empezar hasta' : 'Hora límite'}</span>
                          <input type="time" value={p.horaLimite ?? ''} onChange={(e) => cambiar(clave, { horaLimite: e.target.value })} />
                        </label>
                      )}
                      {s.pideMinutos && (
                        <label>
                          <span className="texto-3 chico">{clave === 'entrenar' ? 'Duración (min)' : 'Mínimo (min)'}</span>
                          <input type="number" inputMode="numeric" min={1} max={240} value={p.minutos ?? ''} onChange={(e) => cambiar(clave, { minutos: Number(e.target.value) || undefined })} />
                        </label>
                      )}
                    </div>
                  )}
                  {clave === 'dormir' && <span className="texto-3 chico">La hora límite es la de «Dejo el celu» (paso Sueño).</span>}
                  {clave === 'entrenar' && onEntreno && (
                    <>
                      <span className="texto-3 chico">¿Cómo querés empezar a entrenar?</span>
                      <ComoEmpezar valor={entreno} onChange={elegirEntreno} />
                      <span className="texto-3 chico">Todo se puede cambiar después en Más → Mis rutinas.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {resto.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="seccion-titulo">+ Pilar</span>
          <div className="chips">
            {resto.map((s) => <button key={s.clave} type="button" disabled={lleno} onClick={() => { setVisibles([...visibles, s.clave]); prender(s.clave) }}>+ {s.nombre}</button>)}
          </div>
        </div>
      )}
      {!elegido('entrenar') && <p className="ayuda">Sin «Entrenar», la pestaña de entreno queda igual pero no cuenta como pilar.</p>}
    </>
  )
}

function ElegirSeries({ c, onChange }: { c: ConfigPrimeraVez; onChange: (x: Partial<ConfigPrimeraVez>) => void }) {
  const series = c.series ?? []
  const [nivel, setNivel] = useState<NivelSerie | null>(null)
  const cambiar = (id: string, x: Partial<SerieElegida>) => onChange({ series: series.map((s) => (s.id === id ? { ...s, ...x } : s)) })
  const usarNivel = (n: NivelSerie) => { setNivel(n); onChange({ series: series.map((s) => (s.usar ? { ...s, ...numerosDeNivel(s.id, n) } : s)) }) }
  const usadas = series.filter((s) => s.usar)
  return (
    <>
      <p className="pv-lead">Series cortas que sumás en el día con un toque (al salir del trabajo, en la escalera). Prendé las que quieras y elegí con cuánto arrancás.</p>
      <div className="col" style={{ gap: 6 }}>
        <span className="seccion-titulo">Atajo de nivel</span>
        <div className="chips" role="radiogroup" aria-label="Nivel">
          {NIVELES_SERIE.map((n) => <button key={n.id} type="button" role="radio" aria-checked={nivel === n.id} className={nivel === n.id ? 'activo' : ''} disabled={!usadas.length} onClick={() => usarNivel(n.id)}>{n.nombre}</button>)}
        </div>
        <span className="texto-3 chico">Carga números sugeridos en las que usás. Después ajustalos a mano.</span>
      </div>
      <div className="pv-pilares">
        {series.map((s) => {
          const propia = !['flexiones', 'dominadas', 'sentadillas', 'abdominales'].includes(s.id)
          return (
            <div key={s.id} className={`pv-pilar ${s.usar ? 'elegido' : ''}`}>
              <div className="pv-pilar-cabeza">
                {propia && s.usar ? <input className="pv-pilar-nombre" aria-label="Nombre de la serie" value={s.nombre} placeholder="¿Qué serie?" onChange={(e) => cambiar(s.id, { nombre: e.target.value })} /> : <b className={`crece ${s.usar ? '' : 'texto-2'}`}>{s.nombre || 'Serie propia'}</b>}
                <Interruptor etiqueta={s.nombre || 'Serie propia'} valor={s.usar} onChange={(usar) => cambiar(s.id, { usar })} />
              </div>
              {s.usar && (
                <div className="pv-pilar-detalle">
                  <div className="pv-pilar-fila">
                    <label><span className="texto-3 chico">Reps por serie</span><input type="number" inputMode="numeric" min={1} max={200} value={s.reps || ''} onChange={(e) => cambiar(s.id, { reps: Math.round(Number(e.target.value)) || 0 })} /></label>
                    <label><span className="texto-3 chico">Series por día</span><input type="number" inputMode="numeric" min={1} max={20} value={s.series || ''} onChange={(e) => cambiar(s.id, { series: Math.round(Number(e.target.value)) || 0 })} /></label>
                  </div>
                  <span className="chico texto-2">Cuota del día: <b>{(s.reps || 0) * (s.series || 0)}</b> ({s.reps} × {s.series})</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" className="boton agregar-aviso" onClick={() => onChange({ series: [...series, serieNueva()] })}>+ Serie propia</button>
      <div className="pv-pilar">
        <div className="pv-pilar-cabeza">
          <span className="crece"><b>Subida sugerida</b><span className="texto-3 chico" style={{ display: 'block' }}>Si cumplís 3 días seguidos, te propone +1 rep por serie. Nunca sube sola.</span></span>
          <Interruptor etiqueta="Subida sugerida cada 3 días" valor={c.subidaSugerida !== false} onChange={(v) => onChange({ subidaSugerida: v })} />
        </div>
      </div>
      {!usadas.length && (
        <div className="pv-pilar elegido">
          <div className="pv-pilar-detalle" style={{ paddingTop: 12 }}>
            <span className="chico">Sin series, la sección no aparece en Hoy. En Tensión y «No cumplí» se piden:</span>
            <label className="pv-numero"><span>Flexiones</span><input type="number" inputMode="numeric" min={1} max={200} value={c.repsSinSerie ?? 10} onChange={(e) => onChange({ repsSinSerie: Math.round(Number(e.target.value)) || 0 })} /></label>
          </div>
        </div>
      )}
    </>
  )
}

function PasoAvisos({ c, onChange }: { c: ConfigPrimeraVez; onChange: (x: Partial<ConfigPrimeraVez>) => void }) {
  const cap = recordatorios.capacidades()
  const [permiso, setPermiso] = useState<string | null>(null)
  const avisos = c.avisos ?? {}
  const entreno = c.pilares.find((p) => p.clave === 'entrenar')?.horaLimite
  const horas: Record<string, string | undefined> = {
    entrenamiento: entreno,
    'entreno-aviso': restarMinutos(entreno, 30),
    revision: c.horarios.alistarse,
    alistarse: c.horarios.alistarse,
    celu: c.horarios.dejarCelu,
    dormido: c.horarios.dormir,
  }
  const activar = async () => {
    const ok = await recordatorios.pedirPermiso()
    setPermiso(ok ? 'Listo: los avisos van a sonar.' : 'Sin permiso: después lo activás en Más → Alarmas.')
  }
  return (
    <>
      <p className="pv-lead">Cómo te avisa cada cosa: <b>Notificación</b>, <b>Alarma</b> (suena a pantalla completa hasta que la apagás) o <b>Nada</b>. Tocá un nombre para cambiar la hora.</p>
      <div className="pv-pilar elegido">
        <div className="pv-pilar-detalle" style={{ paddingTop: 12 }}>
          <span className="chico">{cap.conAppCerrada ? 'Para que suenen con el celu bloqueado, SEK necesita tu permiso.' : 'En la web los avisos suenan con la app abierta. Para alarmas de verdad, usá el APK.'}</span>
          <button type="button" className="boton primario" onClick={activar}>{cap.conAppCerrada ? 'Activar alarmas' : 'Permitir notificaciones'}</button>
          {permiso && <span className="chico texto-2">{permiso}</span>}
        </div>
      </div>
      <ListaAvisos ajustes={{ avisos: avisos.avisos, avisosPropios: avisos.avisosPropios }} horas={horas} onCambio={(x) => onChange({ avisos: { ...avisos, ...x } })} />
    </>
  )
}

/** «Así lo usa el creador»: los 4 pilares de Navil con horario y XP, y un botón que los deja tildados de una. */
export function TarjetaCreador({ usados, onUsar, etiquetaBoton = 'Usar estos 4', nota }: { usados: ClavePilar[]; onUsar: () => void; etiquetaBoton?: string; nota?: string }) {
  const todos = PILARES_DEL_CREADOR.every((p) => usados.includes(p.clave))
  return (
    <section className="pv-creador">
      <div className="fila entre"><b>Así lo usa el creador</b><span className="texto-3 chico">4 pilares</span></div>
      <ul className="pv-creador-lista">
        {PILARES_DEL_CREADOR.map((p) => (
          <li key={p.clave} className={usados.includes(p.clave) ? 'tiene' : ''}>
            <span className="pv-casilla" aria-hidden>{usados.includes(p.clave) ? '✓' : ''}</span>
            <span className="crece">{p.nombre}</span>
            <span className="texto-3 chico mono">{p.clave === 'dormir' ? 'a tu hora' : p.clave === 'entrenar' ? `${p.horaLimite} · ${p.minutos} min` : p.minutos ? `${p.horaLimite} · ${p.minutos} min` : p.horaLimite} · +{xpDePilar(p.clave)} XP</span>
          </li>
        ))}
      </ul>
      <p className="chico texto-2" style={{ margin: 0 }}>{nota ?? TEXTO_CREADOR}</p>
      <button type="button" className="boton ancho" disabled={todos} onClick={onUsar}>{todos ? 'Ya los tenés' : etiquetaBoton}</button>
    </section>
  )
}

function Resumen({ c, deNuevo, tema }: { c: ConfigPrimeraVez; deNuevo: boolean; tema: DefinicionTema }) {
  const usadas = (c.series ?? []).filter((s) => s.usar)
  const modos = AVISOS.map((d) => configAviso({ avisos: c.avisos?.avisos as Record<string, ConfigAviso> | undefined }, d.tipo).modo)
  const propios = c.avisos?.avisosPropios ?? []
  const cuenta = (m: string) => modos.filter((x) => x === m).length + propios.filter((p) => p.modo === m).length
  const filas: [string, string][] = [
    ['Pilares', c.pilares.map((p) => p.nombre.trim()).join(' · ')],
    ['Series rápidas', usadas.length ? usadas.map((s) => `${s.nombre} ${s.reps}×${s.series}`).join(' · ') + (c.subidaSugerida === false ? ' · sin subida' : ' · sube cada 3 días') : `No usás · Tensión: ${c.repsSinSerie ?? 10} flexiones`],
    ...(!deNuevo && c.pilares.some((p) => p.clave === 'entrenar') ? [['Entreno', nombreEleccion(c.entreno ?? { modo: 'poco' })] as [string, string]] : []),
    ['Sueño', `Me alisto ${c.horarios.alistarse} · dejo el celu ${c.horarios.dejarCelu} · me duermo ${c.horarios.dormir}`],
    ['Juego', c.juego ? `${textoMinutos(c.juego.semana)} lun–vie · ${textoMinutos(c.juego.finde)} finde` : ''],
    ['Comida y agua', `${c.agua?.usar ? `Agua ${String(c.agua.litros).replace('.', ',')} L` : 'Sin agua'} · ${c.fruta?.usar ? `${c.fruta.porDia} ${c.fruta.porDia === 1 ? 'fruta' : 'frutas'} por día` : 'sin fruta'}`],
    ['Avisos', `${cuenta('alarma')} alarmas · ${cuenta('notificacion')} notificaciones · ${cuenta('nada')} en Nada`],
  ]
  return (
    <>
      {!deNuevo && (
        <div className="pv-saludo">
          {tema.id === 'shinobi' ? (
            <div className="pv-escena" aria-hidden>
              <FondoLluvia variante="hoy" enCaja />
              <ShinobiRespira hoja={urlTema(tema.sprite)} quieto={movimientoReducido()} className="pv-escena-shinobi" />
            </div>
          ) : tema.propio ? (
            tema.adornos?.imagenAnimaciones ? <div className="pv-personaje"><img className="pv-personaje-propio" src={tema.adornos.imagenAnimaciones} alt="" /></div> : null
          ) : (
            <div className="sh-reposo-marco pv-personaje">
              <Suspense fallback={<div className="pv-personaje-vacio" />}>
                <MuniecoVivo />
              </Suspense>
            </div>
          )}
          <p className={`pv-globo${tema.id === 'shinobi' ? ' al-lado' : ''}`}><b>¡Hola, {c.nombrePersona.trim()}!</b> {saludoDe(tema, c.nombrePersona.trim())}</p>
        </div>
      )}
      <div className="pv-resumen">
        {!deNuevo && <div><span className="texto-3 chico">Tu ciclo</span><b>90 días desde hoy</b><span className="chico texto-2">Día 1: {fechaLegible(c.hoy)}</span></div>}
        {filas.map(([t, v]) => <div key={t}><span className="texto-3 chico">{t}</span><b>{v}</b></div>)}
      </div>
      <p className="ayuda">{deNuevo ? 'Se guardan solo estos ajustes: no se borra nada.' : 'Todo se puede cambiar después desde Más (o en Más → Configurar de nuevo). Los datos viven solo en este teléfono: hacé una copia cada semana.'}</p>
      {!deNuevo && temaTieneFormulario() && <p className="ayuda centro">¿Algo que mejorarías? Después, en Más → <b>Recomendar algo</b>.</p>}
    </>
  )
}
