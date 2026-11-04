import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FranjaComida, ObjetivoComida, RegistroComida } from '../../data/tipos'
import { fechaLegible, sumarDias } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import {
  FRANJAS, FUENTES_TABLA, ID_PILAR_COMIDA, TABLA_ALIMENTOS, activarPilarComida, alimentoPorId, borrarComida, borrarGuardada, buscarCodigo, buscarEn, calcularObjetivo, cambiarCantidad,
  cargarGuardada, comidasDelDia, crearPropioDesdePorcion, estadoKcal, franjaAhora, frecuentes, guardarComida, guardarObjetivo, listarGuardadas, macrosDe, registrarComida, registrarPeso,
  repetirAyer, resumenComida, todosLosAlimentos, type Alimento, type ResumenComida, type Totales,
} from '../../services/comidas'
import { db } from '../../data/db'
import { Atras, Confirmar, Hoja, Tarjeta } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'
import { AguaEnComida, ConfigAguaTarjeta, SeccionAgua, TarjetaAgua, resumenAgua } from './Agua'

// ---------- Anillos ----------

/** Anillo de calorías o proteína: verde mientras va bien, ámbar al pasarse más del 10 %, nunca rojo. */
export function AnilloComida({ valor, objetivo, etiqueta, unidad, tam = 72, alPasarse = true }: { valor: number; objetivo: number; etiqueta: string; unidad: string; tam?: number; alPasarse?: boolean }) {
  const r = 42
  const c = 2 * Math.PI * r
  const [p, setP] = useState(0)
  const prop = objetivo > 0 ? valor / objetivo : 0
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(Math.min(1, prop)))
    return () => cancelAnimationFrame(id)
  }, [prop])
  const estado = valor <= 0 ? 'vacio' : alPasarse && prop > 1.1 ? 'pasado' : 'bien'
  return (
    <div className={`co-anillo ${estado}`} style={{ width: tam, height: tam }} role="img" aria-label={`${etiqueta}: ${valor} de ${objetivo} ${unidad}`}>
      <svg viewBox="0 0 100 100">
        <circle className="fondo" cx="50" cy="50" r={r} />
        <circle className="valor" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <div className="co-anillo-centro">
        <b>{valor.toLocaleString('es-AR')}</b>
        <span>{tam >= 110 ? `de ${objetivo.toLocaleString('es-AR')} ${unidad}` : unidad}</span>
      </div>
    </div>
  )
}

// ---------- Tarjeta de Hoy ----------

export function TarjetaComida({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => { const a = await obtenerAjustes(); return { dia: await comidasDelDia(hoy), objetivo: a.comida, aguaChica: (a.agua?.enHoy ?? 'chica') === 'chica' } }, [hoy])
  const [cargar, setCargar] = useState(false)
  const d = datos.datos
  if (!d) return null
  const t = d.dia.totales
  const o = d.objetivo
  return (
    <section className="co-tarjeta" aria-label="Comida">
      <Link to="/comida" className="co-tarjeta-link">
        <span className="co-kanji" aria-hidden>食</span>
        <span className="co-tarjeta-texto">
          <b>Comida</b>
          <span className="chico texto-2">
            {!o ? 'Configurá tu objetivo' : t.kcal === 0 ? 'Cargá tu primera comida' : estadoKcal(t.kcal, o.kcal) === 'pasado' ? `Te pasaste ${t.kcal - o.kcal} kcal` : `Faltan ${Math.max(0, o.kcal - t.kcal).toLocaleString('es-AR')} kcal`}
          </span>
        </span>
        {o && (
          <span className="co-tarjeta-anillos">
            <AnilloComida valor={t.kcal} objetivo={o.kcal} etiqueta="Calorías" unidad="kcal" tam={60} />
            <AnilloComida valor={t.p} objetivo={o.proteina} etiqueta="Proteína" unidad="g" tam={60} alPasarse={false} />
          </span>
        )}
      </Link>
      {d.aguaChica && <TarjetaAgua hoy={hoy} chica />}
      {o ? <button className="boton primario co-comi" onClick={() => setCargar(true)}>+ Comí</button> : <Link to="/mas/comida" className="boton co-comi">Objetivo</Link>}
      {cargar && <CargarComida hoy={hoy} onCerrar={() => setCargar(false)} />}
    </section>
  )
}

// ---------- Pantalla completa ----------

export function Comida({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({ dia: await comidasDelDia(hoy), objetivo: (await obtenerAjustes()).comida, ultra: (await resumenComida(hoy, 1)).ultraprocesadosSemana }), [hoy])
  const [cargar, setCargar] = useState<FranjaComida | true | null>(null)
  const [editar, setEditar] = useState<RegistroComida | null>(null)
  const [guardar, setGuardar] = useState<FranjaComida | null>(null)
  const d = datos.datos
  if (!d) return null
  const o = d.objetivo
  const t = d.dia.totales
  return (
    <div className="co-pantalla">
      <Atras a="/" texto="Hoy" />
      <div className="co-titulo"><span className="co-kanji grande" aria-hidden>食</span><h1>Comida</h1><span className="texto-3 chico">{fechaLegible(hoy)}</span></div>
      {!o ? (
        <Tarjeta>
          <p>Para ver tus anillos, primero calculá tu objetivo: calorías y proteína por día.</p>
          <Link to="/mas/comida" className="boton primario ancho">Calcular mi objetivo</Link>
        </Tarjeta>
      ) : (
        <section className="co-resumen">
          <div className="co-anillos-grandes">
            <AnilloComida valor={t.kcal} objetivo={o.kcal} etiqueta="Calorías" unidad="kcal" tam={150} />
            <AnilloComida valor={t.p} objetivo={o.proteina} etiqueta="Proteína" unidad="g prot." tam={112} alPasarse={false} />
          </div>
          {t.kcal === 0 ? (
            <p className="centro texto-2">Cargá tu primera comida.</p>
          ) : (
            <div className="co-barras">
              <BarraFina nombre="Carbos" valor={t.c} objetivo={Math.round((o.kcal * 0.5) / 4)} />
              <BarraFina nombre="Grasas" valor={t.g} objetivo={Math.round((o.kcal * 0.28) / 9)} />
            </div>
          )}
        </section>
      )}
      {o && <button className="boton primario grande ancho" onClick={() => setCargar(true)}>+ Comí</button>}
      <AguaEnComida hoy={hoy} />
      {FRANJAS.map((f) => {
        const lista = d.dia.porFranja.get(f.id) ?? []
        const tf = lista.reduce((s, r) => s + r.kcal, 0)
        return (
          <section key={f.id} className="co-franja">
            <div className="fila entre">
              <span className="seccion-titulo">{f.nombre}</span>
              <span className="chico texto-3 mono">{lista.length ? `${tf} kcal` : ''}</span>
            </div>
            {lista.map((r) => (
              <button key={r.id} className="co-item" onClick={() => setEditar(r)}>
                <span>{r.nombre}{r.up ? <span className="co-up" title="Ultraprocesado">UP</span> : null}<span className="texto-3 chico"> · {r.gramos} g</span></span>
                <span className="mono chico co-item-num">{r.kcal} kcal · {Math.round(r.p)} g</span>
              </button>
            ))}
            <div className="co-franja-acciones">
              {o && <button className="enlace chico" onClick={() => setCargar(f.id)}>+ agregar</button>}
              {lista.length > 1 && <button className="enlace chico" onClick={() => setGuardar(f.id)}>guardar como comida</button>}
            </div>
          </section>
        )
      })}
      {d.ultra > 0 && <p className="ayuda centro">{d.ultra} ultraprocesado{d.ultra === 1 ? '' : 's'} esta semana.</p>}
      <p className="ayuda centro"><Link to="/mas/comida">Objetivo y pilar de comida</Link></p>
      {cargar && o && <CargarComida hoy={hoy} franjaInicial={cargar === true ? undefined : cargar} onCerrar={() => setCargar(null)} />}
      {editar && <EditarItem r={editar} onCerrar={() => setEditar(null)} />}
      {guardar && <GuardarComida items={d.dia.porFranja.get(guardar) ?? []} franja={guardar} onCerrar={() => setGuardar(null)} />}
    </div>
  )
}

function BarraFina({ nombre, valor, objetivo }: { nombre: string; valor: number; objetivo: number }) {
  const p = objetivo ? Math.min(1, valor / objetivo) : 0
  return (
    <div className="co-barra-fina">
      <span className="chico texto-2">{nombre}</span>
      <div><div style={{ width: `${p * 100}%` }} className={valor > objetivo * 1.1 ? 'pasado' : ''} /></div>
      <span className="chico mono texto-3">{Math.round(valor)} g</span>
    </div>
  )
}

function EditarItem({ r, onCerrar }: { r: RegistroComida; onCerrar: () => void }) {
  const [g, setG] = useState(String(r.gramos))
  return (
    <Hoja abierta titulo={r.nombre} onCerrar={onCerrar}>
      <div className="campo">
        <label htmlFor="co-ed-g">Cantidad (g)</label>
        <input id="co-ed-g" type="number" inputMode="numeric" value={g} onChange={(e) => setG(e.target.value)} />
      </div>
      <div className="botonera">
        <button className="boton peligro" onClick={async () => { await mutar(() => borrarComida(r.id)); avisar('Quitado'); onCerrar() }}>Quitar</button>
        <button className="boton primario" onClick={async () => { await mutar(() => cambiarCantidad(r.id, Number(g))); onCerrar() }}>Guardar</button>
      </div>
    </Hoja>
  )
}

function GuardarComida({ items, franja, onCerrar }: { items: RegistroComida[]; franja: FranjaComida; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(`${FRANJAS.find((f) => f.id === franja)?.nombre} de siempre`)
  return (
    <Hoja abierta titulo="Guardar comida" onCerrar={onCerrar}>
      <p className="chico texto-2">{items.map((i) => i.nombre).join(' · ')}. Después se carga de un toque.</p>
      <div className="campo"><label htmlFor="co-gn">Nombre</label><input id="co-gn" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <button className="boton primario ancho" onClick={async () => { await mutar(() => guardarComida(nombre, items)); avisar('Comida guardada', { tipo: 'ok' }); onCerrar() }}>Guardar</button>
    </Hoja>
  )
}

// ---------- Cargar una comida ----------

type Vista = { tipo: 'buscar' } | { tipo: 'cantidad'; alimento: Alimento; gramos?: number } | { tipo: 'propio'; codigo?: string } | { tipo: 'escanear' }

export const PUEDE_ESCANEAR = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia

export function CargarComida({ hoy, franjaInicial, onCerrar }: { hoy: string; franjaInicial?: FranjaComida; onCerrar: () => void }) {
  const [franja, setFranja] = useState<FranjaComida>(franjaInicial ?? 'almuerzo')
  const [vista, setVista] = useState<Vista>({ tipo: 'buscar' })
  const [texto, setTexto] = useState('')
  const datos = useDatos(async () => ({ franja: await franjaAhora(), frec: await frecuentes(hoy), todos: await todosLosAlimentos(), guardadas: await listarGuardadas(), ayer: await comidasDelDia(sumarDias(hoy, -1)) }), [hoy])
  useEffect(() => { if (!franjaInicial && datos.datos) setFranja(datos.datos.franja) }, [datos.datos, franjaInicial])
  const resultados = useMemo(() => (datos.datos ? buscarEn(datos.datos.todos, texto) : []), [datos.datos, texto])
  const d = datos.datos
  const nombreFranja = FRANJAS.find((f) => f.id === franja)?.nombre ?? ''

  const agregar = async (a: Alimento, gramos: number) => {
    await mutar(() => registrarComida(hoy, franja, a, gramos))
    avisar(`${a.n} · ${macrosDe(a, gramos).kcal} kcal`, { tipo: 'ok' })
    onCerrar()
  }
  const unToque = async (id: string, gramos: number) => {
    const a = await alimentoPorId(id)
    if (a) await agregar(a, gramos)
  }
  const ayerFranja = d?.ayer.porFranja.get(franja) ?? []

  return (
    <Hoja abierta titulo={vista.tipo === 'escanear' ? 'Escanear' : vista.tipo === 'propio' ? 'Alimento propio' : vista.tipo === 'cantidad' ? vista.alimento.n : `Comí · ${nombreFranja}`} onCerrar={onCerrar}>
      {vista.tipo === 'buscar' && d && (
        <div className="co-cargar">
          <div className="co-franjas" role="group" aria-label="Franja">
            {FRANJAS.map((f) => <button key={f.id} className={franja === f.id ? 'activo' : ''} onClick={() => setFranja(f.id)}>{f.nombre}</button>)}
          </div>
          <input className="co-buscar" type="search" placeholder="Buscar: milanesa, huevo, mate…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar alimento" />
          {texto.trim() ? (
            <div className="co-lista">
              {resultados.map((a) => (
                <button key={a.id} className="co-opcion" onClick={() => setVista({ tipo: 'cantidad', alimento: a })}>
                  <span>{a.n}<span className="texto-3 chico"> · {a.por}</span></span>
                  <span className="mono chico texto-2">{macrosDe(a, a.gr).kcal} kcal</span>
                </button>
              ))}
              {!resultados.length && <p className="chico texto-2">No está en la tabla. <button className="enlace" onClick={() => setVista({ tipo: 'propio' })}>Cargalo como propio</button></p>}
            </div>
          ) : (
            <>
              {d.frec.length > 0 && (
                <>
                  <span className="seccion-titulo">Frecuentes · un toque</span>
                  <div className="co-chips">
                    {d.frec.map((f) => <button key={f.alimentoId} onClick={() => unToque(f.alimentoId, f.gramos)}>{f.nombre}<span> {f.kcal} kcal</span></button>)}
                  </div>
                </>
              )}
              <div className="co-atajos">
                {PUEDE_ESCANEAR && <button className="boton" onClick={() => setVista({ tipo: 'escanear' })}>▥ Escanear</button>}
                <button className="boton" onClick={() => setVista({ tipo: 'propio' })}>+ Propio</button>
                {ayerFranja.length > 0 && <button className="boton" onClick={async () => { const n = await mutar(() => repetirAyer(hoy, franja)); avisar(`${n} cosa${n === 1 ? '' : 's'} de ayer`, { tipo: 'ok' }); onCerrar() }}>↻ Repetir ayer</button>}
              </div>
              {d.guardadas.length > 0 && (
                <>
                  <span className="seccion-titulo">Comidas guardadas</span>
                  <div className="co-chips">
                    {d.guardadas.map((g) => (
                      <button key={g.id} onClick={async () => { const n = await mutar(() => cargarGuardada(g.id, hoy, franja)); avisar(`${g.nombre}: ${n} cosas`, { tipo: 'ok' }); onCerrar() }} onContextMenu={(e) => { e.preventDefault(); if (confirm(`¿Borrar «${g.nombre}»?`)) mutar(() => borrarGuardada(g.id)) }}>{g.nombre}</button>
                    ))}
                  </div>
                </>
              )}
              {!d.frec.length && <p className="ayuda">Lo que cargues va a aparecer acá arriba para repetirlo de un toque.</p>}
            </>
          )}
        </div>
      )}
      {vista.tipo === 'cantidad' && <Cantidad alimento={vista.alimento} inicial={vista.gramos} onListo={(g) => agregar(vista.alimento, g)} onVolver={() => setVista({ tipo: 'buscar' })} />}
      {vista.tipo === 'propio' && <Propio codigo={vista.codigo} onListo={(a) => setVista({ tipo: 'cantidad', alimento: a })} onVolver={() => setVista({ tipo: 'buscar' })} />}
      {vista.tipo === 'escanear' && <Escanear onAlimento={(a) => setVista({ tipo: 'cantidad', alimento: a })} onManual={(codigo) => setVista({ tipo: 'propio', codigo })} onVolver={() => setVista({ tipo: 'buscar' })} />}
    </Hoja>
  )
}

function Cantidad({ alimento, inicial, onListo, onVolver }: { alimento: Alimento; inicial?: number; onListo: (gramos: number) => void; onVolver: () => void }) {
  const [gramos, setGramos] = useState(inicial ?? alimento.gr)
  const m = macrosDe(alimento, gramos)
  const porciones = gramos / alimento.gr
  return (
    <div className="co-cargar">
      <p className="chico texto-2">Porción: {alimento.por} ({alimento.gr} g)</p>
      <div className="co-porciones" role="group" aria-label="Porciones">
        {[0.5, 1, 2].map((x) => <button key={x} className={Math.abs(porciones - x) < 0.01 ? 'activo' : ''} onClick={() => setGramos(Math.round(alimento.gr * x))}>{x === 0.5 ? '½' : x}</button>)}
        <label className="co-gramos"><input type="number" inputMode="numeric" min={1} value={gramos || ''} onChange={(e) => setGramos(Number(e.target.value))} aria-label="Gramos" /><span>g</span></label>
      </div>
      <div className="co-previa">
        <div><b>{m.kcal}</b><span>kcal</span></div>
        <div><b>{Math.round(m.p)}</b><span>g prot.</span></div>
        <div className="chico"><b>{Math.round(m.c)}</b><span>carbos</span></div>
        <div className="chico"><b>{Math.round(m.g)}</b><span>grasas</span></div>
      </div>
      {alimento.up && <p className="ayuda">Marcado como ultraprocesado (solo para saberlo, no resta nada).</p>}
      <div className="botonera">
        <button className="boton" onClick={onVolver}>‹ Volver</button>
        <button className="boton primario" disabled={!(gramos > 0)} onClick={() => onListo(gramos)}>Agregar</button>
      </div>
      {alimento.fuente === 'off' && <p className="ayuda">Datos de Open Food Facts (ODbL).</p>}
    </div>
  )
}

function Propio({ codigo, onListo, onVolver }: { codigo?: string; onListo: (a: Alimento) => void; onVolver: () => void }) {
  const [f, setF] = useState({ nombre: '', porcion: '1 porción', gramos: '100', kcal: '', proteina: '', carbos: '', grasas: '', up: false })
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'up' ? e.target.checked : e.target.value })
  const listo = async () => {
    try {
      const a = await mutar(() => crearPropioDesdePorcion({ nombre: f.nombre, porcion: f.porcion, gramos: Number(f.gramos), kcal: Number(f.kcal), proteina: Number(f.proteina), carbos: f.carbos ? Number(f.carbos) : undefined, grasas: f.grasas ? Number(f.grasas) : undefined, up: f.up }))
      if (codigo) await db().alimentosPropios.put({ ...a, codigo })
      onListo({ ...a, fuente: 'propio' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="co-cargar">
      {codigo && <p className="chico texto-2">Código {codigo}: no lo encontramos. Cargalo una vez y queda guardado.</p>}
      <div className="campo"><label htmlFor="pr-n">Nombre</label><input id="pr-n" value={f.nombre} onChange={set('nombre')} /></div>
      <div className="co-dos">
        <div className="campo"><label htmlFor="pr-p">Porción</label><input id="pr-p" value={f.porcion} onChange={set('porcion')} /></div>
        <div className="campo"><label htmlFor="pr-g">Gramos</label><input id="pr-g" type="number" inputMode="numeric" value={f.gramos} onChange={set('gramos')} /></div>
      </div>
      <div className="co-dos">
        <div className="campo"><label htmlFor="pr-k">Calorías</label><input id="pr-k" type="number" inputMode="numeric" value={f.kcal} onChange={set('kcal')} /></div>
        <div className="campo"><label htmlFor="pr-pr">Proteína (g)</label><input id="pr-pr" type="number" inputMode="decimal" value={f.proteina} onChange={set('proteina')} /></div>
      </div>
      <div className="co-dos">
        <div className="campo"><label htmlFor="pr-c">Carbos (opcional)</label><input id="pr-c" type="number" inputMode="decimal" value={f.carbos} onChange={set('carbos')} /></div>
        <div className="campo"><label htmlFor="pr-gr">Grasas (opcional)</label><input id="pr-gr" type="number" inputMode="decimal" value={f.grasas} onChange={set('grasas')} /></div>
      </div>
      <label className="fila chico" style={{ gap: 8 }}><input type="checkbox" checked={f.up} onChange={set('up')} />Es ultraprocesado</label>
      <p className="ayuda">Los valores son de la porción. Queda guardado y aparece en frecuentes.</p>
      {error && <p className="error chico">{error}</p>}
      <div className="botonera">
        <button className="boton" onClick={onVolver}>‹ Volver</button>
        <button className="boton primario" disabled={!f.nombre.trim() || !f.kcal} onClick={listo}>Seguir</button>
      </div>
    </div>
  )
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

function Escanear({ onAlimento, onManual, onVolver }: { onAlimento: (a: Alimento) => void; onManual: (codigo: string) => void; onVolver: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<'pidiendo' | 'mirando' | 'buscando' | 'error'>('pidiendo')
  const [mensaje, setMensaje] = useState('')
  const [manual, setManual] = useState('')
  const consultar = async (codigo: string) => {
    setEstado('buscando')
    const r = await mutar(() => buscarCodigo(codigo))
    if (r.alimento) return onAlimento({ ...r.alimento, fuente: r.alimento.fuente })
    if (r.motivo === 'sin_internet') { setMensaje('Sin internet: cargalo a mano.'); return onManual(codigo) }
    onManual(codigo)
  }
  useEffect(() => {
    let flujo: MediaStream | null = null
    let vivo = true
    ;(async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!vivo || !video.current) return
        video.current.srcObject = flujo
        await video.current.play()
        setEstado('mirando')
        const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector
        const det = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        while (vivo) {
          const r = await det.detect(video.current).catch(() => [])
          if (r[0]?.rawValue) { vivo = false; navigator.vibrate?.(40); await consultar(r[0].rawValue); break }
          await new Promise((ok) => setTimeout(ok, 250))
        }
      } catch {
        setEstado('error')
        setMensaje('No se pudo abrir la cámara. Escribí el número del código.')
      }
    })()
    return () => { vivo = false; flujo?.getTracks().forEach((t) => t.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="co-cargar">
      <div className="co-camara">
        <video ref={video} muted playsInline />
        <span className="co-mira" aria-hidden />
        {estado === 'buscando' && <span className="co-camara-estado">Buscando en Open Food Facts…</span>}
      </div>
      <p className="chico texto-2">{mensaje || 'Apuntá al código de barras del paquete.'}</p>
      <div className="co-dos">
        <input type="text" inputMode="numeric" placeholder="O escribí el número" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Número del código" />
        <button className="boton" disabled={manual.replace(/\D/g, '').length < 8} onClick={() => consultar(manual)}>Buscar</button>
      </div>
      <button className="boton ancho" onClick={onVolver}>‹ Volver</button>
    </div>
  )
}

// ---------- Más → Comida ----------

export function MasComida({ hoy }: { hoy: string }) {
  const datos = useDatos(async () => ({ a: await obtenerAjustes(), pilar: await db().acciones.get(ID_PILAR_COMIDA) }), [])
  const [f, setF] = useState<Omit<ObjetivoComida, 'kcal' | 'proteina'>>({ peso: 70, altura: 170, edad: 25, sexo: 'hombre', actividad: 'moderado', meta: 'mantener' })
  const [manual, setManual] = useState<{ kcal: string; proteina: string } | null>(null)
  const [peso, setPeso] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const o = datos.datos?.a.comida
  useEffect(() => {
    if (o) {
      setF({ peso: o.peso, altura: o.altura, edad: o.edad, sexo: o.sexo, actividad: o.actividad, meta: o.meta })
      if (o.manual) setManual({ kcal: String(o.kcal), proteina: String(o.proteina) })
    }
  }, [o])
  if (!datos.datos) return null
  const calc = calcularObjetivo(f)
  const kcal = manual ? Number(manual.kcal) || calc.kcal : calc.kcal
  const proteina = manual ? Number(manual.proteina) || calc.proteina : calc.proteina
  const pilarActivo = !!datos.datos.pilar?.activa
  const num = (k: 'peso' | 'altura' | 'edad') => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  const guardar = async () => {
    try {
      await mutar(() => guardarObjetivo({ ...f, kcal, proteina, ...(manual ? { manual: true } : {}) }, hoy))
      avisar('Objetivo guardado', { tipo: 'ok' })
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <>
      <Atras />
      <h1>Comida</h1>
      <Tarjeta titulo="Tu objetivo">
        <div className="co-dos">
          <div className="campo"><label htmlFor="mc-peso">Peso (kg)</label><input id="mc-peso" type="number" inputMode="decimal" value={f.peso || ''} onChange={num('peso')} /></div>
          <div className="campo"><label htmlFor="mc-alt">Altura (cm)</label><input id="mc-alt" type="number" inputMode="numeric" value={f.altura || ''} onChange={num('altura')} /></div>
        </div>
        <div className="co-dos">
          <div className="campo"><label htmlFor="mc-edad">Edad</label><input id="mc-edad" type="number" inputMode="numeric" value={f.edad || ''} onChange={num('edad')} /></div>
          <div className="campo"><label htmlFor="mc-sexo">Sexo</label><select id="mc-sexo" value={f.sexo} onChange={(e) => setF({ ...f, sexo: e.target.value as ObjetivoComida['sexo'] })}><option value="hombre">Hombre</option><option value="mujer">Mujer</option></select></div>
        </div>
        <span className="seccion-titulo">Actividad</span>
        <div className="co-franjas">
          {([['sedentario', 'Sedentario'], ['ligero', 'Ligero'], ['moderado', 'Moderado'], ['alto', 'Alto']] as const).map(([id, n]) => <button key={id} className={f.actividad === id ? 'activo' : ''} onClick={() => setF({ ...f, actividad: id })}>{n}</button>)}
        </div>
        <span className="seccion-titulo">Meta</span>
        <div className="co-franjas">
          {([['bajar', 'Bajar grasa'], ['mantener', 'Mantener'], ['ganar', 'Ganar músculo']] as const).map(([id, n]) => <button key={id} className={f.meta === id ? 'activo' : ''} onClick={() => setF({ ...f, meta: id })}>{n}</button>)}
        </div>
        <div className="co-objetivo">
          <b>{kcal.toLocaleString('es-AR')} kcal</b> y <b>{proteina} g de proteína</b> por día.
          <span className="chico texto-3">Mantenimiento ≈ {calc.mantenimiento.toLocaleString('es-AR')} kcal (Mifflin-St Jeor × actividad{f.meta === 'bajar' ? ', −20 %' : f.meta === 'ganar' ? ', +10 %' : ''}).</span>
        </div>
        {manual ? (
          <div className="co-dos">
            <div className="campo"><label htmlFor="mc-k">Calorías a mano</label><input id="mc-k" type="number" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} /></div>
            <div className="campo"><label htmlFor="mc-p">Proteína a mano</label><input id="mc-p" type="number" value={manual.proteina} onChange={(e) => setManual({ ...manual, proteina: e.target.value })} /></div>
          </div>
        ) : (
          <button className="enlace chico" onClick={() => setManual({ kcal: String(calc.kcal), proteina: String(calc.proteina) })}>Corregir a mano</button>
        )}
        {manual && <button className="enlace chico" onClick={() => setManual(null)}>Volver al cálculo</button>}
        <button className="boton primario ancho" onClick={guardar}>Guardar objetivo</button>
      </Tarjeta>
      {o && (
        <Tarjeta titulo="Peso de hoy">
          <p className="chico texto-2">Queda en la curva de Progreso → 食. Último: {o.peso} kg.</p>
          <div className="co-dos">
            <input type="number" inputMode="decimal" placeholder="kg" value={peso} onChange={(e) => setPeso(e.target.value)} aria-label="Peso de hoy" />
            <button className="boton" disabled={!Number(peso)} onClick={async () => { try { await mutar(() => registrarPeso(hoy, Number(peso))); setPeso(''); avisar('Peso guardado', { tipo: 'ok' }) } catch (e) { avisar(e instanceof Error ? e.message : String(e)) } }}>Guardar</button>
          </div>
        </Tarjeta>
      )}
      <ConfigAguaTarjeta />
      <Tarjeta titulo="Pilar «Comer según el plan»">
        <p className="chico texto-2">Se cumple si el día cierra entre −10 % y +10 % de tus calorías y llegás a tu proteína. 15 XP. Un día sin cargar comidas no cuenta: retomás sin castigo.</p>
        <button className={`boton ancho ${pilarActivo ? '' : 'primario'}`} disabled={!o} onClick={() => (pilarActivo ? setConfirmar(true) : mutar(() => activarPilarComida(true, hoy)).then(() => avisar('Pilar de comida activado', { tipo: 'ok' })))}>
          {pilarActivo ? 'Apagar el pilar' : o ? 'Activar el pilar' : 'Primero guardá tu objetivo'}
        </button>
      </Tarjeta>
      <Tarjeta titulo="De dónde salen los datos">
        <ul className="chico texto-2" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Tabla local de {TABLA_ALIMENTOS.length} alimentos: {FUENTES_TABLA.U}</li>
          <li>{FUENTES_TABLA.A}</li>
          <li>Códigos de barras: Open Food Facts (openfoodfacts.org), base abierta bajo licencia ODbL.</li>
          <li>Objetivo: fórmula de Mifflin-St Jeor; proteína 1,8 g/kg (1,4 si mantenés).</li>
        </ul>
      </Tarjeta>
      <Confirmar abierta={confirmar} titulo="¿Apagar el pilar de comida?" texto="Lo ya ganado no cambia. Desde hoy deja de contar." confirmar="Apagar" onConfirmar={() => { setConfirmar(false); mutar(() => activarPilarComida(false, hoy)) }} onCancelar={() => setConfirmar(false)} />
    </>
  )
}

// ---------- Progreso → 食 ----------

export function SeccionComida({ r, hoy }: { r: ResumenComida; hoy: string }) {
  const agua = useDatos(() => resumenAgua(hoy), [hoy])
  const o = r.objetivo
  const pesos = r.pesos.slice(-30)
  const W = 300
  const H = 110
  const min = Math.min(...pesos.map((p) => p.kg)) - 0.5
  const max = Math.max(...pesos.map((p) => p.kg)) + 0.5
  const x = (i: number) => (pesos.length < 2 ? W / 2 : 10 + (i * (W - 20)) / (pesos.length - 1))
  const y = (kg: number) => H - 14 - ((kg - min) / (max - min || 1)) * (H - 28)
  const maxK = Math.max(o?.kcal ?? 0, ...r.semanas.map((s) => s.kcal ?? 0)) * 1.1 || 1
  const maxP = Math.max(o?.proteina ?? 0, ...r.semanas.map((s) => s.proteina ?? 0)) * 1.1 || 1
  return (
    <div className="col" style={{ gap: 12 }}>
      <section className="av-tarjeta">
        <div className="fila entre"><b>Peso</b><span className="chico texto-2">{pesos.length ? `${pesos[pesos.length - 1].kg} kg` : 'sin datos'}</span></div>
        {pesos.length ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="co-curva" role="img" aria-label="Curva de peso">
            <polyline points={pesos.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {pesos.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.kg)} r={i === pesos.length - 1 ? 4 : 2.4} className={i === pesos.length - 1 ? 'ultimo' : ''} />)}
            <text x="4" y="11" className="co-eje">{max.toFixed(1)}</text>
            <text x="4" y={H - 2} className="co-eje">{min.toFixed(1)}</text>
          </svg>
        ) : <p className="chico texto-2">Guardá tu peso en Más → Comida para ver la curva.</p>}
      </section>
      <section className="av-tarjeta">
        <div className="fila entre"><b>Promedio por semana</b><span className="chico texto-3">solo días cargados</span></div>
        <div className="co-semanas">
          {r.semanas.map((s) => (
            <div key={s.desde} className="co-semana" title={`Semana del ${fechaLegible(s.desde)}`}>
              <div className="co-col"><div className={`k ${o && s.kcal && s.kcal > o.kcal * 1.1 ? 'pasado' : ''}`} style={{ height: `${((s.kcal ?? 0) / maxK) * 100}%` }} /></div>
              <div className="co-col"><div className="p" style={{ height: `${((s.proteina ?? 0) / maxP) * 100}%` }} /></div>
              <span>{s.desde.slice(8)}/{s.desde.slice(5, 7)}</span>
            </div>
          ))}
        </div>
        <div className="fila chico texto-2" style={{ gap: '4px 14px', flexWrap: 'wrap' }}><span><i className="co-punto k" /> calorías</span><span><i className="co-punto p" /> proteína</span>{o && <span>objetivo {o.kcal.toLocaleString('es-AR')} kcal · {o.proteina} g</span>}</div>
        {(() => { const s = r.semanas[r.semanas.length - 1]; return s.kcal ? <p className="chico">Esta semana: <b>{s.kcal.toLocaleString('es-AR')} kcal</b> y <b>{s.proteina} g</b> de proteína por día ({s.dias} día{s.dias === 1 ? '' : 's'} cargado{s.dias === 1 ? '' : 's'}).</p> : null })()}
        <p className="chico texto-2">{r.ultraprocesadosSemana ? `${r.ultraprocesadosSemana} ultraprocesado${r.ultraprocesadosSemana === 1 ? '' : 's'} esta semana.` : 'Sin ultraprocesados esta semana.'}</p>
      </section>
      {agua.datos && <SeccionAgua r={agua.datos} hoy={hoy} />}
      <Link to="/comida" className="boton ancho">Ver la comida de hoy</Link>
    </div>
  )
}

export type { Totales }
