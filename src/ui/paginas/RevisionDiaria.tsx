import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { esFechaValida, fechaLegible, formatoHora } from '../../domain/fechas'
import { obtenerAjustes } from '../../services/base'
import { celebrarPilar } from '../animaciones/logros'
import { completarCompromiso, cumplimientoDelDia, omitirCompromiso, pilaresDelDia, ventanaNoche, type Pilar } from '../../services/dia'
import { resumenJuego } from '../../services/juego'
import { ahora } from '../../services/reloj'
import { guardarRevision, obtenerRevision } from '../../services/revisiones'
import { avisoRestaHoy, balanceDelDia } from '../../services/restas'
import { textoAvisoResta } from '../../domain/resta'
import { Atras, Chips, IconoPilar } from '../componentes'
import { avisar, mutar, useDatos } from '../estado'

/** Obstáculos de un toque. «Ninguno» también es una respuesta válida. */
const OBSTACULOS = ['Postergué', 'Jugué de más', 'Me distraje', 'Cansancio', 'Imprevisto', 'Ninguno']

function textoEstado(p: Pilar, zona: string): string {
  const c = p.compromiso
  switch (p.estado) {
    case 'cumplido': return c?.finReal ? `Hecho a las ${formatoHora(c.finReal, zona)}` : 'Hecho'
    case 'tarde': return `Tarde · ${c?.retrasoMinutos ?? 0} min`
    case 'omitido': return 'No cumplido'
    case 'descanso': return 'No aplicaba hoy'
    default: return 'Sin marcar'
  }
}

/**
 * Revisión diaria en 3 pasos, menos de 3 minutos: (1) qué cumplí, se muestra
 * solo; (2) principal obstáculo, un toque; (3) un ajuste para mañana, una
 * línea. «Listo» guarda y da el XP una vez por día.
 */
export function RevisionDiaria({ hoy }: { hoy: string }) {
  const params = useParams()
  const fecha = params.fecha && esFechaValida(params.fecha) ? params.fecha : hoy
  const navegar = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [obstaculo, setObstaculo] = useState<string[]>([])
  const [detalle, setDetalle] = useState('')
  const [ajuste, setAjuste] = useState('')
  const [inicio] = useState(() => ahora())
  const datos = useDatos(async () => ({
    pilares: await pilaresDelDia(fecha),
    cumplimiento: await cumplimientoDelDia(fecha, hoy),
    juego: await resumenJuego(fecha),
    revision: await obtenerRevision('diaria', fecha),
    ventana: await ventanaNoche(fecha),
    zona: (await obtenerAjustes()).zonaHoraria,
    resta: fecha === hoy ? await avisoRestaHoy(fecha) : null,
    balance: fecha < hoy ? await balanceDelDia(fecha) : null,
  }), [fecha, hoy])
  const d = datos.datos
  useEffect(() => {
    if (d?.revision) {
      setObstaculo(d.revision.respuestas.obstaculo ? [d.revision.respuestas.obstaculo] : [])
      setDetalle(d.revision.respuestas.detalle ?? '')
      setAjuste(d.revision.respuestas.ajuste ?? '')
    }
  }, [d?.revision])
  if (!d) return <p className="vacio">Cargando…</p>
  const pilares = d.pilares.pilares
  const hechos = pilares.filter((p) => p.estado === 'cumplido')
  const noHechos = pilares.filter((p) => p.estado === 'omitido' || p.estado === 'tarde' || (fecha < hoy && p.estado === 'pendiente'))
  const esHoy = fecha === hoy
  const antesDelCierre = esHoy && ahora() < d.ventana.instanteCierre
  const sinMarcar = pilares.filter((p) => esHoy && p.estado === 'pendiente' && p.accion.tipo === 'compromiso' && p.compromiso)

  const guardar = async () => {
    const r = await mutar(() =>
      guardarRevision('diaria', fecha, { obstaculo: obstaculo[0] ?? '', detalle, ajuste: ajuste.trim() }, {
        cumplidos: d.pilares.cumplidos,
        programados: d.pilares.aplican,
        porcentaje: d.cumplimiento.porcentaje,
        minutosJuego: d.juego.minutosHoy,
        hechos: hechos.map((p) => p.accion.nombre),
        noHechos: noHechos.map((p) => p.accion.nombre),
        segundos: Math.round((ahora() - inicio) / 1000),
      }),
    )
    avisar(r.xp > 0 ? `Revisión lista. +${r.xp} XP` : 'Revisión guardada', { tipo: 'ok' })
    navegar('/')
  }

  return (
    <>
      <Atras a="/" texto="Hoy" />
      <div className="fila entre">
        <h1>Revisión {esHoy ? 'de hoy' : `del ${fechaLegible(fecha)}`}</h1>
        <span className="chico texto-3 mono">paso {paso} de 3</span>
      </div>
      <div className="pasos" aria-hidden>{[1, 2, 3].map((n) => <i key={n} className={n <= paso ? 'hecho' : ''} />)}</div>

      {paso === 1 && (
        <section className="col" style={{ gap: 8 }}>
          <span className="seccion-titulo">1 · Qué cumplí y qué no</span>
          <div className="pilares-lista">
            {pilares.map((p) => (
              <div key={p.accion.id} className={`pilar-fila ${p.estado}`}>
                <span className="punto" aria-hidden />
                <span className="icono"><IconoPilar id={p.accion.id} tipo={p.accion.tipo} /></span>
                <span className="crece col" style={{ gap: 0 }}>
                  <b className="chico">{p.accion.nombre}</b>
                  <span className="muy-chico texto-3">{textoEstado(p, d.zona)}</span>
                </span>
                {antesDelCierre && sinMarcar.includes(p) && (
                  <span className="fila" style={{ gap: 4 }}>
                    <button className="boton chico ok" onClick={() => mutar(() => completarCompromiso(p.compromiso!.id)).then((r) => { celebrarPilar(p.accion.id, r.nuevoNivel); return r }).then((r) => avisar(r.xp > 0 ? `${p.accion.nombre}: +${r.xp} XP` : `${p.accion.nombre}: hecho`, { tipo: 'ok' }))}>Sí</button>
                    <button className="boton chico suave" onClick={() => mutar(() => omitirCompromiso(p.compromiso!.id))}>No</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {d.resta && <p className="aviso-resta" role="status"><span className="aviso-resta-k" aria-hidden>減</span>{textoAvisoResta(d.resta.faltantes, d.resta.porcentaje)}<span className="muy-chico texto-3"> · {d.resta.faltantes.map((f) => f.nombre).join(', ')}</span></p>}
          {d.balance && (d.balance.mas > 0 || d.balance.menos > 0) && <p className="chico texto-2 mono" style={{ margin: 0 }}>Ese día: <span className="ok">+{d.balance.mas}</span>{d.balance.menos > 0 && <> / <span className="acento">−{d.balance.menos}</span></>} XP</p>}
          <div className="fila entre chico texto-2">
            <span>{d.pilares.cumplidos} de {d.pilares.aplican} pilares · juego {d.juego.minutosHoy} / {d.juego.limiteMinutos} min</span>
          </div>
          <button className="boton primario grande ancho" onClick={() => setPaso(2)}>Siguiente</button>
        </section>
      )}

      {paso === 2 && (
        <section className="col" style={{ gap: 8 }}>
          <span className="seccion-titulo">2 · Principal obstáculo</span>
          <Chips opciones={OBSTACULOS.map((o) => ({ id: o, nombre: o }))} valor={obstaculo} onChange={(v) => { setObstaculo(v); if (v.length) setTimeout(() => setPaso(3), 180) }} />
          <div className="campo">
            <input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle (opcional)" />
          </div>
          <div className="botonera">
            <button className="boton" onClick={() => setPaso(1)}>Atrás</button>
            <button className="boton primario crece" onClick={() => setPaso(3)}>Siguiente</button>
          </div>
        </section>
      )}

      {paso === 3 && (
        <section className="col" style={{ gap: 8 }}>
          <span className="seccion-titulo">3 · Ajuste para mañana</span>
          <div className="campo">
            <input value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="Ej.: Entrenar apenas llego" autoFocus onKeyDown={(e) => e.key === 'Enter' && guardar()} />
            <span className="ayuda">Una sola línea. Mañana aparece arriba de Hoy.</span>
          </div>
          <div className="botonera">
            <button className="boton" onClick={() => setPaso(2)}>Atrás</button>
            <button className="boton primario grande crece" onClick={guardar}>{d.revision ? 'Actualizar' : 'Listo'}</button>
          </div>
        </section>
      )}
    </>
  )
}
