import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../../data/db'
import { diaDelCiclo, diaSemanaDe, esFechaValida, faseDelDia, fechaLegible, nombreMes, sumarDias } from '../../domain/fechas'
import { cicloActivo, guardarMeta, metasEntre } from '../../services/ciclo'
import { metasPorDia } from '../../services/metas'
import { CampoMeta, FilaMeta } from '../metas'
import { compromisosDelDia, corregirCompromiso, marcarExcepcion, ordenarPilares, pilaresPorDia, quitarExcepcion } from '../../services/dia'
import { feriadosEntre, marcarFeriado, quitarFeriado } from '../../services/feriados'
import { xpDelDia } from '../../services/xp'
import { Hoja, IconoPilar, Porcentaje, Tarjeta } from '../componentes'
import { formatoHora } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import { avisar, mutar, useDatos } from '../estado'
import { HojaMarcar } from '../FotosMarcas'
import { listarMarcas } from '../../services/fotos'
import { caidasDelDia, caidasPorDia } from '../../services/caidas'
import { TumbaRota } from '../../temas/shinobi/TumbaRota'
import { agregarFechaClave, borrarFechaClave, editarFechaClave, fechasClavePorDia } from '../../services/fechasClave'
import type { FechaClave } from '../../data/tipos'
import { Confirmar } from '../componentes'
import { bloquesEntre } from '../../services/horario'
import { HorarioDelDia } from './MiHorario'
import { simbolo } from '../../temas/temas'
import { useFunciones } from '../funciones'

function primerDiaMes(fecha: string): string {
  return fecha.slice(0, 8) + '01'
}

function diasDelMes(primero: string): string[] {
  const [a, m] = primero.split('-').map(Number)
  const n = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${primero.slice(0, 8)}${String(i + 1).padStart(2, '0')}`)
}

export function Calendario({ hoy }: { hoy: string }) {
  const usaF = useFunciones()
  const [params, setParams] = useSearchParams()
  const pedido = params.get('dia')
  const [mes, setMes] = useState(primerDiaMes(pedido && esFechaValida(pedido) ? pedido : hoy))
  const [sel, setSel] = useState<string | null>(pedido && esFechaValida(pedido) ? pedido : null)
  const [enfocar, setEnfocar] = useState(!!pedido)
  // Desde Hoy: «abrir este día» llega como ?dia=AAAA-MM-DD
  useEffect(() => {
    if (pedido && esFechaValida(pedido)) {
      setMes(primerDiaMes(pedido))
      setSel(pedido)
      setEnfocar(true)
      setParams({}, { replace: true })
    }
  }, [pedido, setParams])
  const [hoja, setHoja] = useState(false)
  // Mantener apretado un día → «Marcar este día» (印).
  const [marcar, setMarcar] = useState<string | null>(null)
  const largo = useRef<number | null>(null)
  const fueLargo = useRef(false)
  const soltar = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null } }
  const dias = diasDelMes(mes)
  const ultimo = dias[dias.length - 1]
  const datos = useDatos(async () => {
    const ciclo = await cicloActivo()
    const pilares = await pilaresPorDia(dias[0], ultimo, hoy)
    const metas = await metasPorDia(dias[0], ultimo)
    const excepciones = new Set((await db().excepciones.where('fecha').between(dias[0], ultimo, true, true).toArray()).map((e) => e.fecha))
    const feriados = new Map((await feriadosEntre(dias[0], ultimo)).map((f) => [f.fecha, f.nombre]))
    const acciones = ordenarPilares(await db().acciones.filter((a) => a.activa && !!a.pilar).toArray())
    const claves = await fechasClavePorDia(dias[0], ultimo)
    const bloques = await bloquesEntre(dias[0], ultimo)
    const verHorario = (await obtenerAjustes()).calendarioHorario !== false
    const caidas = await caidasPorDia(dias[0], ultimo)
    const marcas = new Map((await listarMarcas()).filter((x) => x.fecha >= dias[0] && x.fecha <= ultimo).map((x) => [x.fecha, x]))
    const forja = new Set((await db().forja.toArray()).flatMap((h) => h.cumplidos ?? []))
    return { ciclo, pilares, metas, excepciones, feriados, acciones, claves, bloques, verHorario, caidas, marcas, forja }
  }, [mes, hoy])

  const d = datos.datos
  const [a, m] = mes.split('-').map(Number)
  const huecos = (diaSemanaDe(dias[0]) + 6) % 7 // lunes primero
  const ciclo = d?.ciclo
  const fin = ciclo ? sumarDias(ciclo.inicio, ciclo.duracionDias - 1) : null

  return (
    <>
      {usaF('horario') && <Link to="/calendario/horario" className="boton ancho hor-boton"><span>Mi horario<span className="desc">bloques fijos de la semana: colegio, trabajo, entreno</span></span><span className="flecha">›</span></Link>}
      <div className="fila entre">
        <button className="boton chico" onClick={() => setMes(sumarDias(mes, -1).slice(0, 8) + '01')} aria-label="Mes anterior">‹</button>
        <h1 style={{ textTransform: 'capitalize' }} className="cal-titulo"><span className="cal-kanji" aria-hidden>{simbolo('暦')}</span>{nombreMes(m)} {a}</h1>
        <button className="boton chico" onClick={() => setMes(sumarDias(ultimo, 1).slice(0, 8) + '01')} aria-label="Mes siguiente">›</button>
      </div>
      <Tarjeta>
        <div className="calendario tinta">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => <div key={x} className="cab">{x}</div>)}
          {Array.from({ length: huecos }).map((_, i) => <div key={`h${i}`} className="cal-dia vacio" />)}
          {dias.map((f) => {
            const enCiclo = ciclo && f >= ciclo.inicio && fin && f <= fin
            const dia = ciclo ? diaDelCiclo(ciclo.inicio, f) : 0
            const puntos = enCiclo ? d?.pilares.get(f) ?? [] : []
            const inicioFase = enCiclo && ciclo && (dia - 1) % ciclo.diasPorFase === 0
            const claves = d?.claves.get(f) ?? []
            return (
              <div
                key={f}
                className={`cal-dia ${!enCiclo ? 'fuera' : ''} ${f === hoy ? 'hoy tema-remarque-hoy' : ''} ${sel === f ? 'seleccionado' : ''} ${d?.excepciones.has(f) ? 'excepcion' : ''} ${d?.feriados.has(f) ? 'feriado' : ''} ${inicioFase ? 'fase-inicio' : ''} ${f <= hoy && puntos.length > 0 && puntos.every((p) => p.estado === 'cumplido' || p.estado === 'descanso') && puntos.some((p) => p.estado === 'cumplido') ? 'completo' : ''}`}
                onClick={() => { if (fueLargo.current) { fueLargo.current = false; return } setSel(sel === f ? null : f); setEnfocar(sel !== f) }}
                onPointerDown={() => { fueLargo.current = false; soltar(); largo.current = window.setTimeout(() => { fueLargo.current = true; largo.current = null; setMarcar(f) }, 550) }}
                onPointerUp={soltar}
                onPointerLeave={soltar}
                onContextMenu={(e) => e.preventDefault()}
                role="button"
                aria-label={`${fechaLegible(f, false)}${enCiclo ? `, día ${dia}` : ''}${(d?.caidas.get(f) ?? 0) > 0 ? ', caída superada' : ''}${claves.length ? `, fecha clave: ${claves.map((c) => c.titulo).join(', ')}` : ''}`}
              >
                {/* Lugares fijos: número arriba a la izquierda, un solo ícono arriba a la derecha, la barrita de pilares abajo y el río de la forja debajo. */}
                <span className="num">{Number(f.slice(8))}</span>
                {(() => {
                  // Hasta 2 íconos, por prioridad: hoy → marcado → fecha clave → caída → feriado. Si hay más, «·» (se ven al tocar el día).
                  const iconos: { k: string; c: string }[] = []
                  if (f === hoy) iconos.push({ k: simbolo('今'), c: 'hoy' })
                  if (d?.marcas.has(f)) iconos.push({ k: simbolo('印'), c: 'marca' })
                  if (claves.length > 0) iconos.push({ k: simbolo('印'), c: 'clave' })
                  if ((d?.caidas.get(f) ?? 0) > 0) iconos.push({ k: simbolo('墓'), c: 'caida' })
                  if (d?.feriados.has(f)) iconos.push({ k: simbolo('祝'), c: 'feriado' })
                  if (!iconos.length) return null
                  return (
                    <span className="cal-iconos" aria-hidden>
                      {iconos.slice(0, 2).map((x) => <span key={x.c} className={`cal-icono ${x.c}`}>{x.k}</span>)}
                      {iconos.length > 2 && <span className="cal-mas">·</span>}
                    </span>
                  )
                })()}
                {puntos.length > 0 && (
                  <span className="cal-barra" aria-hidden>
                    {puntos.map((p) => <i key={p.accionId} className={f > hoy ? '' : p.estado} />)}
                  </span>
                )}
                {d?.forja.has(f) && <span className={`cal-rio ${d.forja.has(sumarDias(f, -1)) ? 'une-izq' : ''} ${d.forja.has(sumarDias(f, 1)) ? 'une-der' : ''}`} aria-hidden />}
              </div>
            )
          })}
        </div>
        {/* Qué es cada cosa: el listado completo, simple y corto, en 2 columnas. El detalle de cada día se ve al tocarlo. */}
        <ul className="cal-leyenda" aria-label="Qué significa cada marca">
          <li><span className="cal-barra muestra"><i className="cumplido" /><i className="cumplido" /><i className="omitido" /><i /></span> pilares: verde hecho, rojo no</li>
          <li><span className="cal-rio muestra" /> forja cumplida</li>
          <li><b className="cal-icono hoy">{simbolo('今')}</b> hoy</li>
          <li><b className="cal-icono marca">{simbolo('印')}</b> día marcado</li>
          <li><b className="cal-icono clave">{simbolo('印')}</b> fecha clave</li>
          <li><b className="cal-icono caida">{simbolo('墓')}</b> caída</li>
          <li><b className="cal-icono feriado">{simbolo('祝')}</b> feriado</li>
          <li><span className="cal-muestra-dia completo" /> día completo</li>
          <li><span className="cal-muestra-dia fase" /> inicio de fase</li>
          <li><span className="cal-muestra-dia libre" /> día libre</li>
          <li><b className="cal-mas">·</b> hay más: tocá el día</li>
        </ul>
        <p className="cal-pista">Mantené apretado un día para marcarlo (cambio de estilo, algo importante…)</p>
      </Tarjeta>

      {sel && d && (
        <div className="fila entre tarjeta compacta cal-marca-fila">
          {d.marcas.get(sel) ? <span><span className="cal-marca muestra">印</span> {d.marcas.get(sel)!.texto}</span> : <span className="texto-3 chico">Sin marca este día</span>}
          <button type="button" className="boton chico suave" onClick={() => setMarcar(sel)}>{d.marcas.get(sel) ? 'Editar' : '印 Marcar este día'}</button>
        </div>
      )}
      <HojaMarcar fecha={marcar} marca={marcar ? d?.marcas.get(marcar) : undefined} onCerrar={() => setMarcar(null)} />

      {sel && d && <PilaresDelDiaSel fecha={sel} hoy={hoy} ciclo={ciclo ?? null} enfocar={enfocar} onMas={() => setHoja(true)} />}

      {sel && hoja && <DetalleDia fecha={sel} hoy={hoy} ciclo={ciclo ?? null} onCerrar={() => setHoja(false)} />}
    </>
  )
}

function textoPilar(estado: string, c: { finReal?: number; retrasoMinutos?: number; minutos?: number } | undefined, esCelu: boolean, suenio: { horaReal: number } | undefined, zona: string, futuro: boolean): string {
  if (futuro) return estado === 'descanso' ? 'No aplica' : 'Pendiente'
  switch (estado) {
    case 'cumplido':
      if (esCelu && suenio) return `Dejé el celu a las ${formatoHora(suenio.horaReal, zona)}`
      return c?.finReal ? `Hecho a las ${formatoHora(c.finReal, zona)}${c.minutos ? ` · ${c.minutos} min` : ''}` : 'Hecho'
    case 'tarde':
      return esCelu && suenio ? `Dejé el celu a las ${formatoHora(suenio.horaReal, zona)} · ${c?.retrasoMinutos ?? 0} min tarde (sin XP)` : `Tarde · ${c?.retrasoMinutos ?? 0} min (sin XP)`
    case 'omitido': return 'No cumplido'
    case 'descanso': return 'No aplicaba'
    default: return 'Sin marcar todavía'
  }
}

/** Debajo del calendario: los 4 puntos del día elegido, en el orden fijo, con color, ícono, nombre y detalle. */
function PilaresDelDiaSel({ fecha, hoy, ciclo, enfocar, onMas }: { fecha: string; hoy: string; ciclo: { inicio: string; duracionDias: number; diasPorFase: number } | null; enfocar: boolean; onMas: () => void }) {
  const datos = useDatos(async () => {
    const [pilares, compromisos, suenio, xp, cerrado, zona] = await Promise.all([
      pilaresPorDia(fecha, fecha, hoy),
      compromisosDelDia(fecha),
      db().suenio.where('noche').equals(fecha).first(),
      xpDelDia(fecha),
      db().diasCerrados.get(fecha),
      obtenerAjustes().then((a) => a.zonaHoraria),
    ])
    const acciones = new Map((await db().acciones.toArray()).map((a) => [a.id, a]))
    const metas = (await metasPorDia(fecha, fecha)).get(fecha) ?? []
    const caidas = await caidasDelDia(fecha)
    return { fila: pilares.get(fecha) ?? [], compromisos, suenio, xp, cerrado, zona, acciones, metas, caidas }
  }, [fecha, hoy])
  const d = datos.datos
  const dia = ciclo ? diaDelCiclo(ciclo.inicio, fecha) : 0
  const enCiclo = ciclo && dia >= 1 && dia <= ciclo.duracionDias
  const corregible = fecha < hoy && Date.parse(hoy) - Date.parse(fecha) <= 2 * 86_400_000
  if (!d) return null
  const totalXp = d.xp.reduce((s, r) => s + r.cantidad, 0)
  return (
    <Tarjeta compacta>
      <div className="fila entre">
        <b>{fechaLegible(fecha, false)}{enCiclo && <span className="texto-3 chico"> · día {dia}</span>}</b>
        <span className="chico texto-3">{fecha > hoy ? '' : `+${totalXp} XP`}{d.cerrado?.porcentaje != null ? ` · ${d.cerrado.porcentaje} %` : ''}</span>
      </div>
      {/* Lo primero: escribir una meta (hoy y días futuros). En días pasados, solo marcar. */}
      <div className="metas-del-dia">
        {fecha >= hoy && <CampoMeta fecha={fecha} hoy={hoy} enfocar={enfocar} />}
        {d.metas.map((m) => <FilaMeta key={m.id} m={m} hoy={hoy} dia={fecha} />)}
        {fecha < hoy && d.metas.length === 0 && <p className="muy-chico texto-3">Sin metas ese día. En días pasados no se agregan.</p>}
      </div>
      {d.caidas.length > 0 && (
        <p className="muy-chico texto-2 fila" style={{ gap: 6, margin: '2px 0' }}>
          <span className="caidas-fila">{d.caidas.map((c) => <TumbaRota key={c.id} ancho={12} />)}</span>
          {d.caidas.length === 1 ? 'Una caída' : `${d.caidas.length} caídas`} ese día{d.caidas.some((c) => c.xp > 0) ? ` (−${d.caidas.reduce((s, c) => s + c.xp, 0)} XP)` : ''} · nuevo round, seguiste
        </p>
      )}
      <FechasClaveDelDia fecha={fecha} />
      <HorarioDelDia fecha={fecha} hoy={hoy} />
      {!enCiclo && <p className="texto-3 chico">Fuera del ciclo: ese día no se registra nada.</p>}
      {enCiclo && (
        <div className="pilares-lista">
          {d.fila.map((p, i) => {
            const accion = d.acciones.get(p.accionId)
            const c = d.compromisos.find((x) => x.accionId === p.accionId)
            const esCelu = accion?.tipo === 'acostarse'
            return (
              <div key={p.accionId} className={`pilar-fila ${fecha > hoy ? 'futuro' : p.estado}`}>
                <span className="punto" aria-hidden />
                <span className="icono"><IconoPilar id={p.accionId} tipo={accion?.tipo ?? 'compromiso'} /></span>
                <span className="crece col" style={{ gap: 0 }}>
                  <b className="chico"><span className="texto-3 mono">{i + 1} </span>{p.nombre}</b>
                  <span className="muy-chico texto-3">{textoPilar(p.estado, c, !!esCelu, d.suenio, d.zona, fecha > hoy)}</span>
                </span>
                {corregible && c && c.estado !== 'reprogramado' && !esCelu && (
                  <button className="boton chico suave" onClick={async () => {
                    await mutar(() => corregirCompromiso(c.id, c.estado === 'completado' ? 'omitido' : 'completado', 'Corrección desde el calendario'))
                    avisar('Corregido (queda en el historial)')
                  }}>{c.estado === 'completado' ? 'No lo hice' : 'Sí lo hice'}</button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <button className="boton chico ancho" onClick={onMas}>Revisión, feriado y excepción de este día ›</button>
    </Tarjeta>
  )
}

function DetalleDia({ fecha, hoy, ciclo, onCerrar }: { fecha: string; hoy: string; ciclo: { inicio: string; duracionDias: number; diasPorFase: number } | null; onCerrar: () => void }) {
  const [motivoExc, setMotivoExc] = useState('')
  const datos = useDatos(async () => {
    const [compromisos, xp, metas, cerrado, excepcion, feriado] = await Promise.all([
      compromisosDelDia(fecha),
      xpDelDia(fecha),
      metasEntre(fecha, fecha),
      db().diasCerrados.get(fecha),
      db().excepciones.get(fecha),
      db().feriados.get(fecha),
    ])
    return { compromisos, xp, metas, cerrado, excepcion, feriado }
  }, [fecha])
  const d = datos.datos
  const dia = ciclo ? diaDelCiclo(ciclo.inicio, fecha) : 0
  const enCiclo = ciclo && dia >= 1 && dia <= ciclo.duracionDias
  const pasado = fecha < hoy
  const corregible = pasado && Date.parse(hoy) - Date.parse(fecha) <= 2 * 86_400_000
  const totalXp = d?.xp.reduce((s, r) => s + r.cantidad, 0) ?? 0

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={<span>{fechaLegible(fecha, false)} {enCiclo && <span className="texto-3 chico">· día {dia} · fase {faseDelDia(dia, ciclo!.diasPorFase)}</span>}</span>}>
      {d && (
        <>
          <div className="fila entre">
            <span className="texto-2">Cumplimiento</span>
            <b>{fecha > hoy ? <span className="texto-3">—</span> : <Porcentaje valor={d.cerrado?.porcentaje ?? (d.compromisos.length ? Math.round((100 * d.compromisos.filter((c) => c.estado === 'completado').length) / Math.max(1, d.compromisos.filter((c) => c.estado !== 'reprogramado').length)) : null)} />}</b>
          </div>
          {d.excepcion && <div className="etiqueta medio">Excepción: {d.excepcion.motivo}</div>}
          {d.feriado && <div className="etiqueta">Feriado: {d.feriado.nombre} · juego hasta 120 min</div>}
          {d.compromisos.filter((c) => !c.accion.pilar).length > 0 && (
            <div>
              {d.compromisos.filter((c) => !c.accion.pilar).map((c) => (
                <div key={c.id} className={`compromiso ${c.estado}`} style={{ padding: '8px 0' }}>
                  <div className="marca" style={{ width: 22, height: 22, fontSize: '0.7rem' }}>{c.estado === 'completado' ? '✓' : c.estado === 'omitido' || c.estado === 'no_registrado' ? '✕' : c.estado === 'reprogramado' ? '→' : ''}</div>
                  <div className="crece fila entre">
                    <span className="nombre chico">{c.accion.nombre}</span>
                    <span className="chico texto-3">{c.estado === 'completado' ? `+${d.xp.find((x) => x.clave.endsWith(`:${c.accionId}:${fecha}`))?.cantidad ?? 0} XP` : c.estado.replace('_', ' ')}</span>
                  </div>
                  {corregible && c.estado !== 'reprogramado' && (
                    <button className="boton chico suave" onClick={async () => {
                      const nuevo = c.estado === 'completado' ? 'omitido' : 'completado'
                      await mutar(() => corregirCompromiso(c.id, nuevo, 'Corrección desde el calendario'))
                      avisar('Corregido (queda en el historial)')
                    }}>
                      {c.estado === 'completado' ? 'No lo hice' : 'Sí lo hice'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {d.compromisos.length === 0 && <p className="texto-3 chico">Sin compromisos registrados ese día.</p>}
          <div className="fila entre chico">
            <span className="texto-2">XP del día</span>
            <b className="mono">+{totalXp}</b>
          </div>
          {d.xp.filter((r) => r.origen === 'inicio' || r.origen === 'racha7' || r.origen === 'juego').map((r) => (
            <div key={r.clave} className="fila entre muy-chico texto-3"><span>{r.descripcion}</span><span>+{r.cantidad}</span></div>
          ))}
          {d.cerrado && <span className="muy-chico texto-3">Juego: {d.cerrado.minutosJuego} min</span>}
          {fecha === hoy && <Link to="/revision" className="boton chico" onClick={onCerrar}>Revisión diaria</Link>}
          {pasado && <Link to={`/revision/${fecha}`} className="boton chico suave" onClick={onCerrar}>Ver revisión de ese día</Link>}

          {d.metas.filter((m) => m.tipo !== 'propia').length > 0 && (
            <>
              <div className="separador" />
              <h3>Hitos del ciclo</h3>
              {d.metas.filter((m) => m.tipo !== 'propia').map((meta) => (
                <div key={meta.id} className="fila entre chico">
                  <span className="crece"><span className="etiqueta" style={{ marginRight: 6 }}>{meta.tipo.replace('_', ' ')}</span>{meta.titulo}</span>
                  <button className="boton chico suave" onClick={() => mutar(() => guardarMeta({ ...meta, cumplida: !meta.cumplida }))}>{meta.cumplida ? '✓' : '○'}</button>
                </div>
              ))}
            </>
          )}

          <div className="separador" />
          <div className="fila entre chico">
            <span className="texto-2">{d.feriado ? `Feriado${d.feriado.propio ? ' (marcado por vos)' : ''}` : 'Día común'} · límite de juego como {d.feriado || [0, 6].includes(diaSemanaDe(fecha)) ? 'fin de semana' : 'día de semana'}</span>
            {d.feriado ? (
              <button className="boton chico suave" onClick={() => mutar(() => quitarFeriado(fecha)).then(() => avisar('Ya no es feriado'))}>Quitar feriado</button>
            ) : (
              <button className="boton chico" onClick={() => mutar(() => marcarFeriado(fecha, 'Feriado')).then(() => avisar('Marcado como feriado: límite de juego de fin de semana'))}>Marcar feriado</button>
            )}
          </div>
          {d.excepcion ? (
            <button className="boton chico suave" onClick={() => mutar(() => quitarExcepcion(fecha))}>Quitar excepción</button>
          ) : (
            <details>
              <summary className="chico texto-2">Marcar como excepción (enfermedad, viaje)</summary>
              <div className="fila" style={{ marginTop: 8 }}>
                <input className="crece" placeholder="Motivo" value={motivoExc} onChange={(e) => setMotivoExc(e.target.value)} style={{ background: 'var(--fondo)', border: '1px solid var(--borde)', borderRadius: 10, padding: 10, minHeight: 44 }} />
                <button className="boton" disabled={!motivoExc.trim()} onClick={() => mutar(() => marcarExcepcion(fecha, motivoExc.trim())).then(() => avisar('Día marcado como excepción: no cuenta en atributos ni racha'))}>Marcar</button>
              </div>
            </details>
          )}
        </>
      )}
    </Hoja>
  )
}

export { esFechaValida }

/** Debajo de las metas del día: las fechas clave (印). Se agregan, editan y borran; no dan XP. */
function FechasClaveDelDia({ fecha }: { fecha: string }) {
  const datos = useDatos(async () => (await fechasClavePorDia(fecha, fecha)).get(fecha) ?? [], [fecha])
  const [editor, setEditor] = useState<FechaClave | 'nueva' | null>(null)
  const lista = datos.datos ?? []
  return (
    <div className="claves-del-dia">
      {lista.map((fc) => (
        <button key={fc.id} type="button" className="clave-fila" onClick={() => setEditor(fc)} aria-label={`Fecha clave: ${fc.titulo}. Tocá para editar`}>
          <span className="sello-clave grande" aria-hidden>{simbolo('印')}</span>
          <span className="crece col" style={{ gap: 0 }}>
            <b className="chico">{fc.titulo}</b>
            {(fc.nota || fc.anual || fc.hora) && <span className="muy-chico texto-3">{[fc.hora ? `${fc.hora}${fc.horaFin ? `–${fc.horaFin}` : ''}` : '', fc.nota, fc.anual ? `cada año${fc.fecha.slice(0, 4) !== fecha.slice(0, 4) ? ` · desde ${fc.fecha.slice(0, 4)}` : ''}` : ''].filter(Boolean).join(' · ')}</span>}
          </span>
        </button>
      ))}
      <button type="button" className="boton chico suave clave-nueva" onClick={() => setEditor('nueva')}>+ fecha clave</button>
      {editor && <EditorFechaClave fecha={fecha} fc={editor === 'nueva' ? undefined : editor} onCerrar={() => setEditor(null)} />}
    </div>
  )
}

function EditorFechaClave({ fecha, fc, onCerrar }: { fecha: string; fc?: FechaClave; onCerrar: () => void }) {
  const [titulo, setTitulo] = useState(fc?.titulo ?? '')
  const [nota, setNota] = useState(fc?.nota ?? '')
  const [anual, setAnual] = useState(!!fc?.anual)
  const [hora, setHora] = useState(fc?.hora ?? '')
  const [horaFin, setHoraFin] = useState(fc?.horaFin ?? '')
  const [borrar, setBorrar] = useState(false)
  const guardar = async () => {
    if (!titulo.trim()) return
    if (fc) await mutar(() => editarFechaClave(fc.id, { titulo, nota, anual, hora, horaFin }))
    else await mutar(() => agregarFechaClave(fecha, titulo, nota, anual, { hora, horaFin }))
    avisar(fc ? 'Fecha clave guardada' : `Fecha clave marcada ${simbolo('印')}`, { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta onCerrar={onCerrar} titulo={fc ? 'Editar fecha clave' : 'Nueva fecha clave'}>
      <p className="ayuda">{fechaLegible(fc && !fc.anual ? fc.fecha : fecha, false)}. Queda marcada en el calendario; no da XP ni cuenta como meta.</p>
      <div className="campo">
        <label>Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Ingreso a la facultad" maxLength={80} />
      </div>
      <div className="campo">
        <label>Nota (opcional)</label>
        <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: llevar DNI y título" maxLength={240} />
      </div>
      <div className="rejilla-2">
        <div className="campo"><label>Hora (opcional)</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        <div className="campo"><label>Hasta</label><input type="time" value={horaFin} disabled={!hora} onChange={(e) => setHoraFin(e.target.value)} /></div>
      </div>
      {hora && <p className="ayuda" style={{ marginTop: -6 }}>Con hora, ese día cuenta como bloque obligatorio en Mi horario (examen, trámite): sin avisos mientras dura.</p>}
      <label className="fila" style={{ gap: 8, marginBottom: 12 }}>
        <input type="checkbox" checked={anual} onChange={(e) => setAnual(e.target.checked)} />
        <span>Se repite cada año (cumpleaños, aniversarios)</span>
      </label>
      <button className="boton primario ancho" disabled={!titulo.trim()} onClick={() => void guardar()}>Guardar</button>
      {fc && <button className="boton suave ancho" style={{ marginTop: 8 }} onClick={() => setBorrar(true)}>Borrar fecha clave</button>}
      <Confirmar abierta={borrar} titulo="¿Borrar esta fecha clave?" texto={`«${titulo}» sale del calendario${fc?.anual ? ' (de todos los años)' : ''}.`} confirmar="Borrar" peligro
        onConfirmar={async () => { setBorrar(false); if (fc) await mutar(() => borrarFechaClave(fc.id)); avisar('Fecha clave borrada'); onCerrar() }}
        onCancelar={() => setBorrar(false)} />
    </Hoja>
  )
}
