import { useEffect, useState } from 'react'
import { db } from '../../data/db'
import type { FuenteSuenio } from '../../data/tipos'
import { fechaLegible, sumarDias, type FechaDia } from '../../domain/fechas'
import { guardarAccion } from '../../services/acciones'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { cicloActivo } from '../../services/ciclo'
import { corregirNoche, duracionSuenio, horaDeMinutos, nochesDeSuenio, resumenSuenio, volverAEstimado, type NocheDeSuenio, type ResumenSuenio } from '../../services/suenio'
import { finVentana, LATENCIA_MAX, LATENCIA_MIN } from '../../sueno/estimar'
import { Hoja, Tarjeta } from '../componentes'
import { iconoTema } from '../../temas/temas'
import { ETAPAS_SUGERIDAS, TOLERANCIA_SUGERIDA, discursoDeSemana, estadoAdaptacion, etapaDe, normalizarEtapas, ultimaSemanaConInfo, veredictoDe, type ConfigEtapa, type EstadoAdaptacion, type Veredicto } from '../../services/adaptacion'
import { avisar, mutar, useDatos } from '../estado'

type Rango = 'semana' | 'mes' | 'ciclo'
const NOMBRE_FUENTE: Record<FuenteSuenio, string> = { estimado: 'estimado', corregido: 'corregido', reloj: 'reloj' }

/**
 * Sueño: pantalla principal. La app registra sola cada noche («Dejo celu» +
 * latencia y el centro de la ventana de levantarse) y todo se corrige tocando.
 * Los datos vienen de las fuentes de sueño (src/sueno/fuentes): hoy, la estimada;
 * un reloj inteligente sería otra fuente, sin tocar esta pantalla.
 */
export function Sueno({ hoy }: { hoy: string }) {
  const [rango, setRango] = useState<Rango>('semana')
  const datos = useDatos(async () => {
    const ciclo = await cicloActivo()
    const desdeCiclo = ciclo && ciclo.inicio <= hoy ? ciclo.inicio : sumarDias(hoy, -14)
    const desde = rango === 'semana' ? sumarDias(hoy, -7) : rango === 'mes' ? sumarDias(hoy, -30) : desdeCiclo
    return { r: await resumenSuenio(hoy, 14), noches: await nochesDeSuenio(desde, hoy, hoy), a: await obtenerAjustes(), ad: await estadoAdaptacion(hoy) }
  }, [hoy, rango])
  const [editar, setEditar] = useState<{ noche: FechaDia; n: NocheDeSuenio | null } | null>(null)
  if (!datos.datos) return <p className="vacio">Cargando…</p>
  const { r, noches, a, ad } = datos.datos
  const anocheFecha = sumarDias(hoy, -1)
  return (
    <div className="pagina-sueno">
      <h1 className="sueno-titulo"><span className="sueno-kanji" aria-hidden>眠</span>Sueño</h1>

      <Tarjeta titulo="Anoche">
        {r.anoche ? (
          <Anoche n={r.anoche} objetivo={r.objetivoMinutos} veredicto={veredictoDe(r.anoche, ad, r.noches)} onEditar={() => setEditar({ noche: r.anoche!.noche, n: r.anoche })} />
        ) : (
          <div className="col" style={{ gap: 8 }}>
            <p className="texto-2 chico">Todavía no hay registro de anoche. Se completa solo cuando tocás «Dejo celu» en Hoy.</p>
            <button className="boton chico" onClick={() => setEditar({ noche: anocheFecha, n: null })}>Cargar anoche a mano</button>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Noches" derecha={
        <div className="seg" role="tablist" aria-label="Rango del gráfico">
          {(['semana', 'mes', 'ciclo'] as Rango[]).map((x) => (
            <button key={x} role="tab" aria-selected={rango === x} className={rango === x ? 'activo' : ''} onClick={() => setRango(x)}>{x === 'semana' ? 'Semana' : x === 'mes' ? 'Mes' : 'Ciclo'}</button>
          ))}
        </div>
      }>
        {noches.length ? (
          <>
            <GraficoNoches noches={noches} ventana={[a.horaDormido, finVentana(a.horaFinSuenio)]} etapaDe={(f) => etapaDe(f, ad.inicio, ad.etapas).indice} ultimaEtapa={ad.etapas.length - 1} onElegir={(n) => setEditar({ noche: n.noche, n })} />
            <p className="ayuda">Cada barra va de cuando te dormiste a cuando te levantaste; el punto es «Dejo celu» (verde si fue a tiempo). La franja verde es tu ventana ideal ({a.horaDormido} a {finVentana(a.horaFinSuenio)}). Borde claro: corregida a mano. Tocá una barra para corregirla.</p>
          </>
        ) : (
          <p className="texto-2 chico">Con la primera noche registrada aparece acá el gráfico.</p>
        )}
      </Tarjeta>

      <Adaptacion ad={ad} hoy={hoy} onGuardado={datos.recargar} />

      <Mejora r={r} />

      <AjustesSueno onGuardado={datos.recargar} />

      {editar && <EditarNoche noche={editar.noche} n={editar.n} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); datos.recargar() }} />}
    </div>
  )
}

function Anoche({ n, objetivo, veredicto, onEditar }: { n: NocheDeSuenio; objetivo: number; veredicto: Veredicto; onEditar: () => void }) {
  const ok = n.minutos >= objetivo - 15
  const dormido = n.dormidoRango ? `${horaDeMinutos(n.dormidoRango[0])}–${horaDeMinutos(n.dormidoRango[1])}` : horaDeMinutos(n.dormido)
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="sueno-grande">{duracionSuenio(n.minutos)}<span>{n.estimado ? ' aprox.' : ''}</span></div>
      <p className={`sueno-veredicto ${veredicto.tono}`} role="status">{veredicto.texto}</p>
      <span className={`muy-chico ${ok ? 'texto-verde' : 'texto-3'}`}>{ok ? 'Llegaste al objetivo' : `${duracionSuenio(objetivo - n.minutos)} menos que el objetivo de ${duracionSuenio(objetivo)}`}{n.despertares !== undefined ? ` · despertares: ${n.despertares === 3 ? '3 o más' : n.despertares}` : ''}</span>
      <div className="sueno-linea">
        <button className="sueno-dato" onClick={onEditar}><b>{horaDeMinutos(n.acostado)}</b><span>acostado{n.fuentes.acostado !== 'estimado' ? ` · ${NOMBRE_FUENTE[n.fuentes.acostado]}` : n.cumplido ? '' : n.sinDejoCelu ? ' · a mano' : ' · tarde'}</span></button>
        <button className="sueno-dato" onClick={onEditar}><b>{dormido}</b><span>dormido{n.fuentes.dormido !== 'estimado' ? ` · ${NOMBRE_FUENTE[n.fuentes.dormido]}` : ''}</span></button>
        <button className="sueno-dato" onClick={onEditar}><b>{horaDeMinutos(n.levantado)}</b><span>levantado{n.fuentes.levantado !== 'estimado' ? ` · ${NOMBRE_FUENTE[n.fuentes.levantado]}` : ''}</span></button>
      </div>
      <span className="ayuda">Tocá cualquier hora para corregirla.</span>
    </div>
  )
}

/** Una barra por noche sobre un eje de 20:00 a 08:00. Listo para pintar etapas cuando una fuente las traiga. */
function GraficoNoches({ noches, ventana, etapaDe: indiceEtapa, ultimaEtapa, onElegir }: { noches: NocheDeSuenio[]; ventana: [string, string]; etapaDe?: (f: FechaDia) => number; ultimaEtapa?: number; onElegir: (n: NocheDeSuenio) => void }) {
  const min = 20 * 60
  const max = 32 * 60
  const W = 340
  const fila = noches.length > 16 ? 11 : 20
  const alto = fila - 6
  const H = fila * noches.length + 22
  const x0 = 46
  const x = (m: number) => ((Math.max(min, Math.min(max, m)) - min) / (max - min)) * (W - x0 - 4) + x0
  const aMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); const t = h * 60 + m; return t < 12 * 60 ? t + 1440 : t }
  const v0 = aMin(ventana[0])
  const v1 = aMin(ventana[1])
  const cadaEtiqueta = noches.length > 16 ? 5 : 1
  return (
    <svg className="sueno-grafico" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Sueño de ${noches.length} noches`}>
      <rect x={x(v0)} y={0} width={Math.max(0, x(v1) - x(v0))} height={H - 16} className="sueno-ventana" />
      {/* Trazo de pincel verde arriba de la ventana ideal (decoración: la franja sigue marcando el rango) */}
      <path d={`M${x(v0)},2 C${x(v0) + (x(v1) - x(v0)) * 0.3},0 ${x(v0) + (x(v1) - x(v0)) * 0.7},4 ${x(v1)},1.5`} className="sueno-trazo" />
      <path d={`M${x(v0)},${H - 18} C${x(v0) + (x(v1) - x(v0)) * 0.4},${H - 16} ${x(v0) + (x(v1) - x(v0)) * 0.6},${H - 20} ${x(v1)},${H - 17.5}`} className="sueno-trazo" />
      {[20, 22, 24, 26, 28, 30, 32].map((h) => (
        <g key={h}>
          <line x1={x(h * 60)} y1={0} x2={x(h * 60)} y2={H - 16} className="sueno-eje" />
          <text x={x(h * 60)} y={H - 4} textAnchor="middle" className="sueno-hora">{String(h % 24).padStart(2, '0')}</text>
        </g>
      ))}
      {noches.map((n, i) => {
        const y = 3 + i * fila
        const fecha = fechaLegible(n.noche).split(' ').slice(0, 2).join(' ')
        const clase = n.reloj ? 'reloj' : n.corregido ? 'corregida' : 'estimada'
        const ie = indiceEtapa ? indiceEtapa(n.noche) : -1
        const claseEtapa = ie < 0 ? '' : ie === 0 ? 'acostumbrando' : ie === ultimaEtapa ? 'estable' : 'asentando'
        return (
          <g key={n.noche} className="sueno-noche" role="button" tabIndex={0} aria-label={`${fecha}: ${duracionSuenio(n.minutos)}. Tocá para corregir`} onClick={() => onElegir(n)} onKeyDown={(e) => e.key === 'Enter' && onElegir(n)}>
            <rect x={0} y={y - 2} width={W} height={fila} fill="transparent" />
            {claseEtapa && <rect x={x0} y={y - 2} width={W - x0 - 4} height={fila} className={`sueno-etapa ${claseEtapa}`} />}
            {i % cadaEtiqueta === 0 && <text x={0} y={y + alto - 3} className="sueno-hora">{fecha}</text>}
            <rect x={x(n.dormido)} y={y} width={Math.max(3, x(n.levantado) - x(n.dormido))} height={alto} rx={alto / 2.5} className={`sueno-barra ${clase}`} />
            {/* Etapas: cuando una fuente (reloj) las traiga, se pintan acá como tramos dentro de la barra. */}
            <circle cx={x(n.acostado)} cy={y + alto / 2} r={Math.min(3, alto / 3)} className={n.cumplido ? 'sueno-punto ok' : 'sueno-punto'} />
          </g>
        )
      })}
    </svg>
  )
}

function Flecha({ ahora, antes, mejorEsMas }: { ahora: number | null; antes: number | null; mejorEsMas: boolean }) {
  if (ahora === null || antes === null || Math.abs(ahora - antes) < 5) return null
  const sube = ahora > antes
  const bien = sube === mejorEsMas
  return <span className={`sueno-flecha ${bien ? 'bien' : 'mal'}`} aria-label={bien ? 'mejor que la semana anterior' : 'peor que la semana anterior'}>{sube ? '↑' : '↓'}</span>
}

function Mejora({ r }: { r: ResumenSuenio }) {
  const m = r.mejora
  return (
    <Tarjeta titulo="Cómo vas mejorando">
      <div className="sueno-cifras">
        <div><b>{m.semana !== null ? duracionSuenio(m.semana) : '—'} <Flecha ahora={m.semana} antes={m.semanaAnterior} mejorEsMas /></b><span>por noche esta semana{m.semanaAnterior !== null ? ` (antes ${duracionSuenio(m.semanaAnterior)})` : ''}</span></div>
        <div><b>{m.regularidad !== null ? `±${m.regularidad} min` : '—'} <Flecha ahora={m.regularidad} antes={m.regularidadAnterior} mejorEsMas={false} /></b><span>cuánto varía la hora de dormirte (menos es mejor)</span></div>
        <div><b>{m.racha}</b><span>{m.racha === 1 ? 'noche seguida' : 'noches seguidas'} a horario</span></div>
      </div>
    </Tarjeta>
  )
}

function EditarNoche({ noche, n, onCerrar, onGuardado }: { noche: FechaDia; n: NocheDeSuenio | null; onCerrar: () => void; onGuardado: () => void }) {
  const inicial = { acostado: n ? horaDeMinutos(n.acostado) : '', dormido: n ? horaDeMinutos(n.dormido) : '', levantado: n ? horaDeMinutos(n.levantado) : '' }
  const [v, setV] = useState(inicial)
  const [despertares, setDespertares] = useState<string>(n?.despertares !== undefined ? String(n.despertares) : '')
  const campos: { k: 'acostado' | 'dormido' | 'levantado'; t: string }[] = [{ k: 'acostado', t: 'Me acosté' }, { k: 'dormido', t: 'Me dormí' }, { k: 'levantado', t: 'Me levanté' }]
  const guardar = async () => {
    const cambios: Record<string, string | number | null> = {}
    for (const c of campos) if (v[c.k] && v[c.k] !== inicial[c.k]) cambios[c.k] = v[c.k]
    const dAntes = n?.despertares !== undefined ? String(n.despertares) : ''
    if (despertares !== dAntes) cambios.despertares = despertares === '' ? null : Number(despertares)
    if (!Object.keys(cambios).length) return onCerrar()
    try {
      await mutar(() => corregirNoche(noche, cambios))
      avisar('Noche corregida', { tipo: 'ok' })
      onGuardado()
    } catch (e) {
      avisar((e as Error).message, { tipo: 'bajo' })
    }
  }
  const volver = async (k: 'acostado' | 'dormido' | 'levantado') => {
    await mutar(() => volverAEstimado(noche, k))
    avisar('Volvió a lo estimado')
    onGuardado()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={`Noche del ${fechaLegible(noche)}`}>
      {campos.map((c) => (
        <div key={c.k} className="campo">
          <label htmlFor={`sueno-${c.k}`}>{c.t}{n ? <span className="texto-3"> · {NOMBRE_FUENTE[n.fuentes[c.k]]}</span> : ''}</label>
          <input id={`sueno-${c.k}`} type="time" value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
          {n && n.fuentes[c.k] === 'corregido' && <button type="button" className="enlace chico" onClick={() => volver(c.k)}>Volver a lo estimado</button>}
          {c.k === 'dormido' && n?.dormidoRango && <span className="ayuda">Estimado entre {horaDeMinutos(n.dormidoRango[0])} y {horaDeMinutos(n.dormidoRango[1])}.</span>}
        </div>
      ))}
      <div className="campo">
        <label htmlFor="sueno-despertares">¿Te despertaste? <span className="texto-3">· opcional</span></label>
        <select id="sueno-despertares" value={despertares} onChange={(e) => setDespertares(e.target.value)}>
          <option value="">No lo cargo</option>
          <option value="0">No, dormí de corrido</option>
          <option value="1">1 vez</option>
          <option value="2">2 veces</option>
          <option value="3">3 o más</option>
        </select>
        <span className="ayuda">Si lo cargás, entra en el veredicto de la noche según tu etapa de adaptación. Si no, no se asume nada.</span>
      </div>
      {!n && <p className="ayuda">Si no ponés «me dormí», se calcula con tu latencia. Una noche cargada a mano no cuenta para «Dormir a horario».</p>}
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}

/** «Tu adaptación»: tira de etapas y todo editable (semanas, horas, despertares, tolerancia, desde cuándo). */
function Adaptacion({ ad, hoy, onGuardado }: { ad: EstadoAdaptacion; hoy: FechaDia; onGuardado: () => void }) {
  const [editar, setEditar] = useState(false)
  const [etapas, setEtapas] = useState<ConfigEtapa[]>(ad.etapas)
  const [tolerancia, setTolerancia] = useState(ad.tolerancia)
  const [desde, setDesde] = useState(ad.inicio)
  useEffect(() => { setEtapas(ad.etapas); setTolerancia(ad.tolerancia); setDesde(ad.inicio) }, [ad])
  const guardar = async () => {
    if (!/^\d{4}-\d\d-\d\d$/.test(desde) || desde > hoy) return avisar('La fecha de inicio tiene que ser de hoy para atrás', { tipo: 'bajo' })
    await mutar(() => guardarAjustes({ adaptacion: { desde, etapas: normalizarEtapas(etapas), toleranciaMinutos: Math.max(0, Math.min(120, Math.round(tolerancia))) } }))
    avisar('Adaptación guardada', { tipo: 'ok' })
    setEditar(false)
    onGuardado()
  }
  const restaurar = async () => {
    await mutar(() => guardarAjustes({ adaptacion: { desde: undefined, etapas: undefined, toleranciaMinutos: undefined } }))
    setEtapas(ETAPAS_SUGERIDAS.map((e) => ({ ...e }))); setTolerancia(TOLERANCIA_SUGERIDA)
    avisar('Volvió lo sugerido', { tipo: 'ok' })
    setEditar(false)
    onGuardado()
  }
  const campo = (i: number, k: keyof ConfigEtapa, v: string) => setEtapas(etapas.map((e, j) => (j === i ? { ...e, [k]: k === 'nombre' ? v : Number(v) } : e)))
  return (
    <Tarjeta titulo="Tu adaptación" derecha={<button type="button" className="boton chico" onClick={() => setEditar(!editar)}>{editar ? 'Cerrar' : 'Editar'}</button>}>
      <ShinobiDice ad={ad} />
      {editar && (
        <div className="col sueno-adaptacion-form" style={{ gap: 10 }}>
          <div className="campo"><label htmlFor="ad-desde">Empecé a mejorar mi sueño el</label><input id="ad-desde" type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} /></div>
          {etapas.map((e, i) => (
            <div key={i} className="sueno-etapa-edicion">
              <input aria-label={`Nombre de la etapa ${i + 1}`} value={e.nombre} onChange={(ev) => campo(i, 'nombre', ev.target.value)} />
              <div className="rejilla-2">
                <div className="campo"><label htmlFor={`ad-sem-${i}`}>Semanas{i === etapas.length - 1 ? ' (0 = sin fin)' : ''}</label><input id={`ad-sem-${i}`} type="number" inputMode="numeric" min={0} max={12} value={e.semanas} onChange={(ev) => campo(i, 'semanas', ev.target.value)} /></div>
                <div className="campo"><label htmlFor={`ad-desp-${i}`}>Despertares normales</label><input id={`ad-desp-${i}`} type="number" inputMode="numeric" min={0} max={5} value={e.despertaresNormales} onChange={(ev) => campo(i, 'despertaresNormales', ev.target.value)} /></div>
                <div className="campo"><label htmlFor={`ad-min-${i}`}>Horas mínimas</label><input id={`ad-min-${i}`} type="number" inputMode="decimal" step={0.5} min={3} max={14} value={e.horasMin} onChange={(ev) => campo(i, 'horasMin', ev.target.value)} /></div>
                <div className="campo"><label htmlFor={`ad-max-${i}`}>Horas máximas</label><input id={`ad-max-${i}`} type="number" inputMode="decimal" step={0.5} min={3} max={14} value={e.horasMax} onChange={(ev) => campo(i, 'horasMax', ev.target.value)} /></div>
              </div>
            </div>
          ))}
          <div className="campo"><label htmlFor="ad-tol">«A horario»: minutos de tolerancia después de «Dejo celu»</label><input id="ad-tol" type="number" inputMode="numeric" min={0} max={120} value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} style={{ width: 110 }} /></div>
          <div className="rejilla-2">
            <button type="button" className="boton" onClick={restaurar}>Restaurar lo sugerido</button>
            <button type="button" className="boton primario" onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}

function AjustesSueno({ onGuardado }: { onGuardado: () => void }) {
  const datos = useDatos(async () => ({ a: await obtenerAjustes(), acostarse: await db().acciones.get('acostarse') }), [])
  const [celu, setCelu] = useState('21:15')
  const [latencia, setLatencia] = useState(15)
  const [ventana, setVentana] = useState('05:00')
  const [objetivo, setObjetivo] = useState(7.5)
  useEffect(() => {
    if (!datos.datos) return
    const a = datos.datos.a
    setCelu(a.horaDejarCelu)
    setLatencia(a.latenciaDormirseMinutos)
    setVentana(a.horaFinSuenio)
    setObjetivo(a.objetivoSuenioHoras)
  }, [datos.datos])
  if (!datos.datos) return null
  const { a, acostarse } = datos.datos
  const min = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
  const guardar = async () => {
    if (!/^\d\d:\d\d$/.test(celu) || !/^\d\d:\d\d$/.test(ventana)) return avisar('Revisá las horas (HH:MM)', { tipo: 'bajo' })
    if (!(min(a.horaAlistarse) < min(celu) && min(celu) < min(a.horaDormido))) return avisar(`«Dejo celu» tiene que quedar entre ${a.horaAlistarse} (alistarse) y ${a.horaDormido} (dormido)`, { tipo: 'bajo' })
    if (!(objetivo >= 4 && objetivo <= 12)) return avisar('El objetivo va de 4 a 12 horas', { tipo: 'bajo' })
    await mutar(async () => {
      await guardarAjustes({ horaDejarCelu: celu, latenciaDormirseMinutos: Math.max(LATENCIA_MIN, Math.min(LATENCIA_MAX, Math.round(latencia))), horaFinSuenio: ventana, objetivoSuenioHoras: objetivo })
      if (acostarse && acostarse.horaLimite !== celu) await guardarAccion({ ...acostarse, hora: celu, horaLimite: celu })
    })
    avisar('Guardado. Vale de esta noche en adelante.', { tipo: 'ok' })
    onGuardado()
  }
  return (
    <Tarjeta titulo="Ajustes del sueño">
      <div className="rejilla-2">
        <div className="campo"><label htmlFor="aj-celu">Hora de «Dejo celu»</label><input id="aj-celu" type="time" value={celu} onChange={(e) => setCelu(e.target.value)} /></div>
        <div className="campo"><label htmlFor="aj-lat">Minutos hasta dormirte</label><input id="aj-lat" type="number" inputMode="numeric" min={LATENCIA_MIN} max={LATENCIA_MAX} value={latencia} onChange={(e) => setLatencia(Number(e.target.value))} /><span className="ayuda">De {LATENCIA_MIN} a {LATENCIA_MAX}. Se muestra como rango de ±5.</span></div>
        <div className="campo"><label htmlFor="aj-vent">Me levanto entre</label><input id="aj-vent" type="time" value={ventana} onChange={(e) => setVentana(e.target.value)} /><span className="ayuda">y las {/^\d\d:\d\d$/.test(ventana) ? finVentana(ventana) : '—'}. Se usa el centro.</span></div>
        <div className="campo"><label htmlFor="aj-obj">Objetivo (horas)</label><input id="aj-obj" type="number" inputMode="decimal" step={0.5} min={4} max={12} value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value))} /></div>
      </div>
      <label className="fila chico texto-3" style={{ gap: 8, marginTop: 4 }}><input type="checkbox" checked={a.relojInteligente} disabled /> Reloj inteligente: no conectado (próximamente)</label>
      <button className="boton primario ancho" onClick={guardar}>Guardar</button>
    </Tarjeta>
  )
}


/**
 * El shinobi te dice cómo va tu adaptación hoy. Arriba, una barra chica de etapas con tu marca; los botoncitos de
 * más adelante hacen que te hable de esa etapa, y tu marca vuelve a hoy. El texto sale de las etapas editables.
 */
function ShinobiDice({ ad }: { ad: EstadoAdaptacion }) {
  const actual = ad.actual.semana
  const [sem, setSem] = useState(actual)
  useEffect(() => setSem(actual), [actual])
  const total = ultimaSemanaConInfo(ad.etapas)
  // Dónde empieza cada etapa (semana) y su ancho en la barra; la última (sin fin) ocupa una semana.
  let acum = 0
  const tramos = ad.etapas.map((e, i) => {
    const desde = acum + 1
    const semanas = i === ad.etapas.length - 1 || e.semanas <= 0 ? 1 : e.semanas
    acum += semanas
    return { i, nombre: e.nombre, desde, semanas }
  })
  const pos = (w: number) => `${(Math.min(total, Math.max(1, w)) - 0.5) / total * 100}%`
  const d = discursoDeSemana(sem, ad.etapas)
  const viendo = etapaDe(sumarDias(ad.inicio, (sem - 1) * 7), ad.inicio, ad.etapas).indice
  return (
    <div className="sh-dice">
      <div className="sh-barra" role="group" aria-label="Dónde estás en la adaptación">
        {tramos.map((t) => (
          <div key={t.i} className={`sh-tramo ${t.i < ad.actual.indice ? 'pasado' : t.i === ad.actual.indice ? 'actual' : ''}`} style={{ flexGrow: t.semanas }}>
            <span className="sh-tramo-nombre">{t.nombre}</span>
          </div>
        ))}
        {tramos.filter((t) => t.i > ad.actual.indice).map((t) => (
          <button key={t.i} type="button" className={`sh-etapa-boton ${viendo === t.i && sem !== actual ? 'viendo' : ''}`} style={{ left: pos(t.desde) }} onClick={() => setSem(t.desde)} aria-label={`Qué pasa en ${t.nombre}`} />
        ))}
        <button type="button" className={`sh-marca ${sem === actual ? 'viendo' : ''}`} style={{ left: pos(actual) }} onClick={() => setSem(actual)} aria-label={`Estás en la semana ${actual}: volver a hoy`} />
      </div>
      <div className="tema-globo sh-globo" role="status">
        <span className="tema-globo-kanji" aria-hidden>{iconoTema('icono-sueno') || '眠'}</span>
        <p className="sh-texto"><b>{sem === actual ? `Hoy, ${d.titulo.charAt(0).toLowerCase()}${d.titulo.slice(1)}` : `Más adelante, ${d.titulo.charAt(0).toLowerCase()}${d.titulo.slice(1)}`}.</b> {d.texto}</p>
      </div>
    </div>
  )
}
