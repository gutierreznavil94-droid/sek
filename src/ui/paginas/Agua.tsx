/**
 * Agua: la cantimplora del shinobi. Un toque suma el envase principal; mantener apretado abre
 * los otros envases y «restar el último». Sin XP: solo se mira y se llena.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EnvaseAgua, TomaAgua } from '../../data/tipos'
import { formatoHora, type FechaDia } from '../../domain/fechas'
import { aguaDelDia, borrarToma, configAgua, deshacerToma, guardarConfigAgua, litros, nuevoEnvase, resumenAgua, tomarAgua, type ResumenAgua } from '../../services/agua'
import { obtenerAjustes } from '../../services/base'
import { Hoja, Tarjeta, movimientoReducido } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

// ---------- El dibujo ----------

/** Cantimplora de bambú a tinta. `nivel` 0..1 llena el cuerpo; más de 1 rebalsa. */
export function Cantimplora({ nivel, ancho = 150, chorro = false, sello = false, etiqueta }: { nivel: number; ancho?: number; chorro?: boolean; sello?: boolean; etiqueta?: string }) {
  const quieto = movimientoReducido()
  const ARRIBA = 34
  const ABAJO = 134
  const lleno = Math.max(0, Math.min(1, nivel))
  const y = ABAJO - lleno * (ABAJO - ARRIBA)
  const rebalsa = nivel > 1.001
  const completo = nivel >= 0.999
  return (
    <svg viewBox="0 0 100 150" width={ancho} height={ancho * 1.5} className={`agua-svg ${completo ? 'llena' : ''} ${rebalsa ? 'rebalsa' : ''} ${quieto ? 'quieta' : ''}`} role="img" aria-label={etiqueta}>
      <defs>
        <clipPath id="agua-cuerpo">
          <path d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34 Z" />
        </clipPath>
      </defs>
      {/* Cuerpo: papel apenas visible para que el nivel se lea */}
      <path className="agua-fondo" d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34 Z" />
      {/* Agua con olas */}
      <g clipPath="url(#agua-cuerpo)">
        <g className="agua-nivel" style={{ transform: `translateY(${y}px)` }}>
          <path className="agua-ola" d="M-100 4 Q-87 0 -75 4 T-50 4 T-25 4 T0 4 T25 4 T50 4 T75 4 T100 4 T125 4 T150 4 T175 4 T200 4 V140 H-100 Z" />
          <path className="agua-ola dos" d="M-100 6 Q-90 2 -80 6 T-60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 T180 6 T200 6 V140 H-100 Z" />
        </g>
        {chorro && <path className="agua-chorro" d="M50 0 C 48 20, 53 40, 50 60" />}
      </g>
      {/* Bambú: nudos */}
      <path className="agua-trazo fino" d="M17 70 Q50 76 83 70" />
      <path className="agua-trazo fino" d="M14 104 Q50 110 86 104" />
      {/* Borde del cuerpo */}
      <path className="agua-trazo cuerpo" d="M33 34 Q10 62 13 126 Q14 136 25 136 H75 Q86 136 87 126 Q90 62 67 34" />
      {/* Cuello, tapa y cordel */}
      <path className="agua-trazo" d="M38 34 V20 Q38 16 42 16 H58 Q62 16 62 20 V34" />
      <rect className="agua-tapa" x="35" y="6" width="30" height="12" rx="4" />
      <path className="agua-trazo fino" d="M38 24 H62 M38 29 H62" />
      <path className="agua-trazo cordel" d="M35 12 C 20 14, 12 30, 16 50 M65 12 C 80 14, 88 30, 84 50" />
      {/* Rebalse: gotas que caen del cuello */}
      {rebalsa && (
        <g className="agua-gotas">
          <path d="M36 36 q-3 6 0 9 q3 -3 0 -9" />
          <path d="M64 38 q-3 6 0 9 q3 -3 0 -9" />
          <path d="M30 48 q-3 6 0 9 q3 -3 0 -9" />
        </g>
      )}
      {sello && <text className="agua-sello" x="50" y="96" textAnchor="middle">水</text>}
    </svg>
  )
}

// ---------- Hoy ----------

export function TarjetaAgua({ hoy, chica = false }: { hoy: FechaDia; chica?: boolean }) {
  const datos = useDatos(async () => ({ dia: await aguaDelDia(hoy), cfg: await configAgua(), zona: (await obtenerAjustes()).zonaHoraria }), [hoy])
  const [chorro, setChorro] = useState(false)
  const [sello, setSello] = useState(false)
  const [ultimo, setUltimo] = useState<number | null>(null)
  const [hoja, setHoja] = useState(false)
  const largo = useRef<number | null>(null)
  const fueLargo = useRef(false)
  const d = datos.datos
  useEffect(() => () => { if (largo.current) window.clearTimeout(largo.current) }, [])
  if (!d) return null
  const tomar = async (envaseId?: string) => {
    const r = await mutar(() => tomarAgua(hoy, envaseId))
    setChorro(true); setSello(true); setUltimo(r.toma.ml)
    window.setTimeout(() => setChorro(false), 900)
    window.setTimeout(() => setSello(false), 1400)
    window.setTimeout(() => setUltimo((u) => (u === r.toma.ml ? null : u)), 2200)
    if (r.recienLlego) avisar(`Llegaste a ${litros(r.dia.objetivo)} de agua. 水`, { tipo: 'ok' })
  }
  const empezar = () => {
    fueLargo.current = false
    largo.current = window.setTimeout(() => { fueLargo.current = true; setHoja(true) }, 480)
  }
  const soltar = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null } }
  const click = () => { if (fueLargo.current) { fueLargo.current = false; return } void tomar() }
  const pasado = Math.max(0, d.dia.ml - d.dia.objetivo)
  const hojaEnvases = (
    <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo="Agua">
      <HojaEnvases hoy={hoy} envases={d.cfg.config.envases} principal={d.cfg.principal.id} tomas={d.dia.tomas} zona={d.zona} onTomar={(id) => { setHoja(false); void tomar(id) }} onCerrar={() => setHoja(false)} />
    </Hoja>
  )
  if (chica) {
    // Chiquita, dentro de la tarjeta de Comida: un toque suma y se ve el chorro; mantené para otro envase.
    return (
      <>
        <button
          type="button"
          className="agua-boton agua-chica"
          onPointerDown={empezar}
          onPointerUp={soltar}
          onPointerLeave={soltar}
          onPointerCancel={soltar}
          onContextMenu={(e) => e.preventDefault()}
          onClick={click}
          aria-label={`Agua: llevás ${litros(d.dia.ml)} de ${litros(d.dia.objetivo)}. Tocá para sumar ${d.cfg.principal.nombre} de ${d.cfg.principal.ml} ml; mantené apretado para otro envase`}
        >
          <Cantimplora nivel={d.dia.nivel} ancho={30} chorro={chorro} sello={sello} />
          <span className={`agua-chica-ml mono ${ultimo ? 'suma' : ''}`}>{ultimo ? `+${ultimo}` : litros(d.dia.ml)}</span>
        </button>
        {hojaEnvases}
      </>
    )
  }
  return (
    <section className="agua-tarjeta" aria-label="Agua">
      <button
        type="button"
        className="agua-boton"
        onPointerDown={empezar}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
        onContextMenu={(e) => e.preventDefault()}
        onClick={click}
        aria-label={`Tomé ${d.cfg.principal.nombre} de ${d.cfg.principal.ml} ml. Llevás ${litros(d.dia.ml)} de ${litros(d.dia.objetivo)}. Mantené apretado para otro envase`}
      >
        <Cantimplora nivel={d.dia.nivel} ancho={60} chorro={chorro} sello={sello} />
      </button>
      <div className="agua-texto">
        <span className="seccion-titulo">Agua</span>
        <b className="agua-numero mono">
          {d.dia.llego ? <>{litros(d.dia.ml)}{pasado > 0 && <span className="agua-extra"> · +{pasado >= 1000 ? litros(pasado) : `${pasado} ml`}</span>}</> : <>{litros(d.dia.ml)} <span className="texto-3">de {litros(d.dia.objetivo)}</span></>}
        </b>
        <span className="chico texto-2">{ultimo ? `+${ultimo} ml` : d.dia.llego ? (pasado > 0 ? 'Rebalsa: seguís sumando' : 'Objetivo del día cumplido') : d.dia.tomas.length ? `Faltan ${d.dia.objetivo - d.dia.ml >= 1000 ? litros(d.dia.objetivo - d.dia.ml) : `${d.dia.objetivo - d.dia.ml} ml`}` : 'Tocá la cantimplora'}</span>
        <span className="chico texto-3">Un toque = {d.cfg.principal.nombre.toLowerCase()} {d.cfg.principal.ml} ml · mantené para más</span>
      </div>
      {hojaEnvases}
    </section>
  )
}

function HojaEnvases({ hoy, envases, principal, tomas, zona, onTomar, onCerrar }: { hoy: FechaDia; envases: EnvaseAgua[]; principal: string; tomas: TomaAgua[]; zona: string; onTomar: (id: string) => void; onCerrar: () => void }) {
  const ultima = tomas[tomas.length - 1]
  return (
    <div className="col" style={{ gap: 10 }}>
      <span className="seccion-titulo">Tomé…</span>
      <div className="agua-envases">
        {envases.map((e) => (
          <button key={e.id} className={`boton ${e.id === principal ? 'primario' : ''}`} onClick={() => onTomar(e.id)}>{e.nombre}<span className="chico mono" style={{ opacity: 0.8 }}> {e.ml} ml</span></button>
        ))}
      </div>
      {ultima && (
        <button className="boton suave ancho" onClick={async () => { await mutar(() => deshacerToma(hoy)); avisar(`Resté ${ultima.ml} ml (${formatoHora(ultima.instante, zona)})`); onCerrar() }}>
          Restar el último toque · {ultima.ml} ml a las {formatoHora(ultima.instante, zona)}
        </button>
      )}
      <p className="ayuda centro"><Link to="/mas/comida" onClick={onCerrar}>Envases y objetivo</Link> · <Link to="/comida" onClick={onCerrar}>tomas de hoy</Link></p>
    </div>
  )
}

// ---------- Comida: envase chico y lista de tomas ----------

export function AguaEnComida({ hoy }: { hoy: FechaDia }) {
  const datos = useDatos(async () => ({ dia: await aguaDelDia(hoy), cfg: await configAgua(), zona: (await obtenerAjustes()).zonaHoraria }), [hoy])
  const [chorro, setChorro] = useState(false)
  const d = datos.datos
  if (!d) return null
  const tomar = async () => {
    await mutar(() => tomarAgua(hoy))
    setChorro(true); window.setTimeout(() => setChorro(false), 900)
  }
  return (
    <section className="co-franja agua-en-comida">
      <div className="fila entre">
        <span className="seccion-titulo">Agua</span>
        <span className="chico texto-3 mono">{litros(d.dia.ml)} de {litros(d.dia.objetivo)}</span>
      </div>
      <div className="fila" style={{ gap: 12, alignItems: 'center' }}>
        <button type="button" className="agua-boton chico" onClick={tomar} aria-label={`Tomé ${d.cfg.principal.nombre} ${d.cfg.principal.ml} ml`}>
          <Cantimplora nivel={d.dia.nivel} ancho={56} chorro={chorro} />
        </button>
        <div className="col crece" style={{ gap: 2 }}>
          {d.dia.tomas.length === 0 && <span className="chico texto-2">Todavía nada. Tocá la cantimplora: suma {d.cfg.principal.nombre.toLowerCase()} {d.cfg.principal.ml} ml.</span>}
          {d.dia.tomas.map((t) => (
            <button key={t.id} className="co-item" onClick={async () => { await mutar(() => borrarToma(t.id)); avisar(`Borré ${t.ml} ml`) }} aria-label={`Borrar toma de ${t.ml} ml`}>
              <span>{formatoHora(t.instante, d.zona)}<span className="texto-3 chico"> · {d.cfg.config.envases.find((e) => e.id === t.envase)?.nombre ?? 'agua'}</span></span>
              <span className="mono chico co-item-num">{t.ml} ml ✕</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Más → Comida: envases y objetivo ----------

export function ConfigAguaTarjeta() {
  const datos = useDatos(() => configAgua(), [])
  const [nombre, setNombre] = useState('')
  const [ml, setMl] = useState('')
  const [objetivo, setObjetivo] = useState<string | null>(null)
  const d = datos.datos
  useEffect(() => { if (d) setObjetivo(d.config.objetivoMl ? String(d.config.objetivoMl) : null) }, [d])
  if (!d) return null
  const guardar = async (cambios: Parameters<typeof guardarConfigAgua>[0], aviso = 'Agua guardada') => {
    try { await mutar(() => guardarConfigAgua(cambios)); avisar(aviso, { tipo: 'ok' }) } catch (e) { avisar(e instanceof Error ? e.message : String(e)) }
  }
  const envases = d.config.envases
  return (
    <Tarjeta titulo="Agua">
      <p className="chico texto-2">La cantimplora de Hoy suma el envase principal con un toque. Mantené apretado para los otros.</p>
      <div className="col" style={{ gap: 4 }}>
        <span className="seccion-titulo">En Hoy</span>
        <div className="fila" style={{ gap: 6 }}>
          {([['chica', 'Chiquita, en Comida'], ['tarjeta', 'Tarjeta aparte']] as const).map(([v, t]) => (
            <button key={v} className={`boton chico ${(d.config.enHoy ?? 'chica') === v ? 'primario' : 'suave'}`} aria-pressed={(d.config.enHoy ?? 'chica') === v} onClick={() => guardar({ enHoy: v }, v === 'chica' ? 'Agua chiquita en Comida' : 'Agua como tarjeta')}>{t}</button>
          ))}
        </div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        {envases.map((e) => (
          <div key={e.id} className="agua-envase-fila">
            <input aria-label="Nombre del envase" value={e.nombre} onChange={(ev) => guardar({ envases: envases.map((x) => (x.id === e.id ? { ...x, nombre: ev.target.value } : x)) }, 'Envase guardado')} />
            <input aria-label="Mililitros" type="number" inputMode="numeric" value={e.ml} onChange={(ev) => guardar({ envases: envases.map((x) => (x.id === e.id ? { ...x, ml: Number(ev.target.value) } : x)) }, 'Envase guardado')} />
            <button className={`boton chico ${e.id === d.config.principal ? 'primario' : 'suave'}`} onClick={() => guardar({ principal: e.id }, `${e.nombre}: el del toque`)} aria-pressed={e.id === d.config.principal}>{e.id === d.config.principal ? 'Toque' : 'Usar'}</button>
            <button className="boton chico suave" aria-label={`Borrar ${e.nombre}`} disabled={envases.length <= 1} onClick={() => guardar({ envases: envases.filter((x) => x.id !== e.id) }, 'Envase borrado')}>✕</button>
          </div>
        ))}
        <div className="agua-envase-fila nuevo">
          <input placeholder="Nuevo envase" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del envase nuevo" />
          <input placeholder="ml" type="number" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value)} aria-label="Mililitros del envase nuevo" />
          <button className="boton chico" disabled={!nombre.trim() || !(Number(ml) > 0)} onClick={async () => { await guardar({ envases: [...envases, nuevoEnvase(nombre, Number(ml))] }, 'Envase agregado'); setNombre(''); setMl('') }}>+ Agregar</button>
        </div>
      </div>
      <div className="col" style={{ gap: 4, marginTop: 6 }}>
        <span className="seccion-titulo">Objetivo por día</span>
        <p className="chico texto-2" style={{ margin: 0 }}>{d.pesoUsado ? `${d.calculado.toLocaleString('es-AR')} ml: 35 ml por kilo × ${d.pesoUsado} kg, redondeado a 250.` : `${d.calculado.toLocaleString('es-AR')} ml mientras no haya peso en tu objetivo de comida.`}</p>
        {objetivo === null ? (
          <button className="enlace chico" onClick={() => setObjetivo(String(d.objetivo))}>Corregir a mano</button>
        ) : (
          <div className="co-dos">
            <input type="number" inputMode="numeric" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} aria-label="Objetivo en ml" />
            <div className="fila" style={{ gap: 6 }}>
              <button className="boton chico" disabled={!(Number(objetivo) > 0)} onClick={() => guardar({ objetivoMl: Number(objetivo) }, `Objetivo: ${litros(Number(objetivo))}`)}>Guardar</button>
              <button className="boton chico suave" onClick={() => { setObjetivo(null); void guardar({ objetivoMl: undefined }, 'Vuelve al cálculo') }}>Al cálculo</button>
            </div>
          </div>
        )}
      </div>
    </Tarjeta>
  )
}

// ---------- Progreso → 食 ----------

export function SeccionAgua({ r, hoy }: { r: ResumenAgua; hoy: FechaDia }) {
  const sem = r.semanas[r.semanas.length - 1]
  const llegoEstaSemana = sem?.llego ?? 0
  return (
    <section className="av-tarjeta">
      <div className="fila entre"><b>Agua</b><span className="chico texto-2">objetivo {litros(r.objetivo)}</span></div>
      <div className="sr-dias agua-dias" aria-label="Últimos 14 días de agua">
        {r.dias.map((d) => <span key={d.fecha} className={`sr-dia ${d.llego ? 'cuota' : d.ml > 0 ? 'parcial' : 'no'} ${d.fecha === hoy ? 'hoy' : ''}`} title={`${d.fecha}: ${litros(d.ml)}`} />)}
      </div>
      <div className="sr-leyenda"><span><i className="sr-dia no" /> no llegaste</span><span><i className="sr-dia parcial" /> algo</span><span><i className="sr-dia cuota" /> llegaste</span></div>
      <div className="agua-semanas">
        {r.semanas.map((s) => (
          <div key={s.desde} className="agua-semana">
            <div className="agua-col"><div style={{ height: `${Math.min(100, ((s.litrosPorDia ?? 0) * 1000 / (r.objetivo * 1.3)) * 100)}%` }} className={s.litrosPorDia !== null && s.litrosPorDia * 1000 >= r.objetivo ? 'llego' : ''} /></div>
            <b className="mono chico">{s.litrosPorDia !== null ? `${s.litrosPorDia.toLocaleString('es-AR')} L` : '—'}</b>
            <span>{s.desde.slice(8)}/{s.desde.slice(5, 7)}</span>
          </div>
        ))}
      </div>
      <p className="chico texto-2" style={{ margin: 0 }}>
        {sem?.litrosPorDia !== null && sem?.litrosPorDia !== undefined ? <>Esta semana: <b>{sem.litrosPorDia.toLocaleString('es-AR')} L por día</b>, llegaste {llegoEstaSemana} día{llegoEstaSemana === 1 ? '' : 's'}.</> : 'Esta semana todavía sin agua cargada.'}
        {r.rachaDias > 1 ? ` Racha: ${r.rachaDias} días.` : ''}
      </p>
    </section>
  )
}

export { resumenAgua }
