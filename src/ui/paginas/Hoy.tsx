import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { rivalArchivado } from '../../temas/archivado'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import type { Compromiso } from '../../data/tipos'
import { prepararBatalla, puedeBatallar } from '../../services/batalla'
import { pedirBatalla } from '../Batalla'
import { pedirTension, useClipsTension } from '../Tension'
import { NOMBRES_FASES_INICIALES } from '../../data/semilla'
import { TarjetaComida } from './Comida'
import { TarjetaAgua } from './Agua'
import { cerrarAvisoDormir, minutosAvisoDormir, mostrarAvisoDormir } from '../../services/dormir'
import { debeMostrarTajo, marcarTajo, momentoActivo, peleasDelDia, prepararPelea, tajoMostradoHoy, vistaAnterior, type Pelea } from '../../services/ninjas'
import { hayPelea, pedirPelea } from '../Ninja'
import { hayRival, pedirRival } from '../Rival'
import { modoRival } from '../../services/rival'
import { Tajo } from '../Tajo'
import { LineaDelDia } from './MiHorario'
import { finDeObligatorio } from '../../services/horario'
import { db } from '../../data/db'
import { entrarModoPrueba } from '../../data/modoPrueba'
import { diaSemanaDe, duracionLegible, fechaLegible, formatoHora, instanteDe, lunesDe, minutosDe, partesLocales, sumarDias } from '../../domain/fechas'
import { estadoNivel } from '../../domain/niveles'
import { cerrarDiasPendientes } from '../../services/dia'
import { recordatorios } from '../../reminders/recordatorios'
import { obtenerAjustes } from '../../services/base'
import { estadoDelCiclo, metasEntre } from '../../services/ciclo'
import {
  atributosHoy,
  completarCompromiso,
  compromisosDelDia,
  cumplimientoEntre,
  deshacerCompromiso,
  deshacerDejoCelu,
  deshacerExtra,
  iniciarCompromiso,
  marcarExtra,
  tieneExtra,
  omitirCompromiso,
  pilaresDelDia,
  rachaActual,
  registrarDejoCelu,
  reprogramarCompromiso,
  ventanaNoche,
  type CompromisoConAccion,
  type Pilar,
} from '../../services/dia'
import { emitirEvento } from '../../temas/eventos'
import { duracionSuenio, entrarModoSuenio, horaDeMinutos, resumenSuenio } from '../../services/suenio'
import { estadoAdaptacion, veredictoDe } from '../../services/adaptacion'
import { FilaForjaHoy } from '../Forja'
import { celebrarFase, celebrarNivel, celebrarPilar, celebrarRacha } from '../animaciones/logros'
import { animar, configuracionAnimaciones } from '../animaciones/motor'
import { resumenJuego } from '../../services/juego'
import { deshacerUltimoToque, propuestasDeSubida, responderPropuesta, resumenContadores, sumarToque, type ResumenContador } from '../../services/contadores'
import { estadoEnDia, estadoVisible, metasPorDia } from '../../services/metas'
import { FilaMeta } from '../metas'
import { ahora } from '../../services/reloj'
import { rutinaDelDia, sesionEnCurso } from '../../services/entreno'
import { obtenerRevision } from '../../services/revisiones'
import { xpDelDia, xpTotal } from '../../services/xp'
import { avisoRestaHoy, balanceDelDia } from '../../services/restas'
import { textoAvisoResta } from '../../domain/resta'
import { disparar } from '../../temas/eventos'
import { Celebracion, Hoja, IconoPilar } from '../componentes'
import { avisar, mutar, useDatos, useTic } from '../estado'
import { TiraOrganizacion } from './Organizacion'
import { CamaDelCompanero } from '../Companero'
import { ChipsBatallas } from '../ChipsBatallas'
import { BotonNoCumpli } from '../Caida'
import { brillo, type EstadoBrillo } from '../brillo'

/** Pilar → brillo: pendiente titila, marcado (a tiempo o tarde) verde fijo; omitido y descanso sin brillo. */
function estadoBrilloPilar(p: Pilar): EstadoBrillo | null {
  if (p.estado === 'pendiente') return 'pendiente'
  // Con segundo tope (ej. Dibujar 15 / 30 min): 1.ª meta = parcial, 2.ª = máximo, como las series.
  if (p.estado === 'cumplido' || p.estado === 'tarde') return tieneExtra(p.accion) ? (p.compromiso?.extra ? 'maximo' : 'parcial') : 'hecho'
  return null
}
import { simbolo } from '../../temas/temas'
import { usa } from '../../services/funciones'

async function cargarPanel(hoy: string) {
  const ajustes = await obtenerAjustes()
  const estado = await estadoDelCiclo(hoy)
  if (!estado || estado.noEmpezado) {
    return { antes: true as const, ajustes, estado }
  }
  const [compromisos, total, atributos, racha, juego, xpHoy, revision, pilares, propuestas, contadores, ventana, revisionAyer] = await Promise.all([
    compromisosDelDia(hoy),
    xpTotal(),
    atributosHoy(hoy),
    rachaActual(hoy),
    resumenJuego(hoy),
    xpDelDia(hoy),
    obtenerRevision('diaria', hoy),
    pilaresDelDia(hoy),
    propuestasDeSubida(hoy),
    resumenContadores(hoy),
    ventanaNoche(hoy),
    obtenerRevision('diaria', sumarDias(hoy, -1)),
  ])
  const semana = await cumplimientoEntre(lunesDe(hoy), hoy, hoy)
  const nivel = estadoNivel(total, ajustes.baseNivel)
  // Hasta la hora de corte, la noche abierta es la de ayer (para «Dejo celu» después de las 00:00).
  const p = partesLocales(ahora(), ajustes.zonaHoraria)
  const minutoActual = p.hora * 60 + p.minuto
  const nocheAbierta = minutoActual < minutosDe(ajustes.horaCorteNoche) ? sumarDias(hoy, -1) : hoy
  const suenio = await db().suenio.where('noche').equals(nocheAbierta).first()
  const metasSemana = (await metasEntre(hoy, sumarDias(hoy, 6))).sort((a, b) => a.fecha.localeCompare(b.fecha))
  let buenosDias: string | null = null
  try { buenosDias = localStorage.getItem('buenos-dias') } catch { /* sin almacenamiento */ }
  const anoche = buenosDias ? (await resumenSuenio(hoy, 2)).anoche : null
  const veredictoAnoche = anoche ? veredictoDe(anoche, await estadoAdaptacion(hoy)) : null
  const ajusteDeAyer = revisionAyer?.respuestas.ajuste?.trim() || null
  const rutina = (await rutinaDelDia(hoy)) ?? null
  const entrenoEnCurso = !!(await sesionEnCurso())
  const peleas = await peleasDelDia(hoy)
  // «Ayer: +35 / −8» y lo que restaría hoy si queda sin hacer.
  const ayer = await balanceDelDia(sumarDias(hoy, -1))
  const avisoResta = await avisoRestaHoy(hoy)
  return { antes: false as const, ayer, avisoResta, peleas, rutina, entrenoEnCurso, metasSemana, ajustes, estado, compromisos, nivel, atributos, racha, juego, semana, xpHoy, revision, nocheAbierta, suenio, pilares, propuestas, contadores, ventana, ajusteDeAyer, buenosDias, anoche, veredictoAnoche }
}


const ICONO_321 = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6" /></svg>
const ICONO_REV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
const ICONO_OK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
const ICONO_SIG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>

export function Hoy({ hoy }: { hoy: string }) {
  const panel = useDatos(() => cargarPanel(hoy), [hoy])
  const navegar = useNavigate()
  const tic = useTic(30_000)
  const [seleccion, setSeleccion] = useState<CompromisoConAccion | null>(null)
  const [pilarSel, setPilarSel] = useState<Pilar | null>(null)
  const [destello, setDestello] = useState<string | null>(null)
  const [flash, setFlash] = useState<Record<string, number>>({})
  const [marcado, setMarcado] = useState<string | null>(null)
  const [nivelNuevo, setNivelNuevo] = useState<number | null>(null)
  const [avisoDormirAbierto, setAvisoDormirAbierto] = useState(true)
  const [tajo, setTajo] = useState(false)
  const cerrarTajo = useCallback(() => setTajo(false), [])
  const intentoNinja = useRef<string>('')
  const cerrarCelebracion = useCallback(() => setNivelNuevo(null), [])
  const d = panel.datos
  // «Dudo» y 「進」 van en la cabecera, al lado de la fecha (hueco que deja Layout).
  const [huecoCabecera, setHuecoCabecera] = useState<HTMLElement | null>(null)
  useEffect(() => { setHuecoCabecera(document.getElementById('cabecera-extra')) }, [])
  // La barra del horario vive arriba, en la franja que queda fija cuando el encabezado se hace polvo (Layout/Desintegrar).
  const [huecoHorario, setHuecoHorario] = useState<HTMLElement | null>(null)
  useEffect(() => { setHuecoHorario(document.getElementById('barra-horario-slot')) }, [])
  const clipsTension = useClipsTension()
  const batallas = useDatos(() => puedeBatallar(hoy), [hoy]).datos
  // El compañero duerme después de «Dejo celu», pero solo de noche: desde la hora de alistarse (20:00 si no hay)
  // hasta la mañana. Si «Dejo celu» se toca de tarde, sigue paseando hasta esa hora.
  const deNoche = !!d && !d.antes && tic >= instanteDe(d.nocheAbierta, d.ajustes.horaAlistarse || '20:00', d.ajustes.zonaHoraria)
  useEffect(() => {
    if (!d || d.antes) return
    try {
      if (d.suenio && deNoche) localStorage.setItem('companero-dormido', d.nocheAbierta)
      else localStorage.removeItem('companero-dormido')
    } catch { /* sin almacenamiento */ }
    window.dispatchEvent(new Event('companero-cambio'))
  }, [d, deNoche])
  // A las 20:50 en punto (y al cierre) la pantalla se actualiza sola, sin esperar al reloj de 30 s.
  const [, forzar] = useState(0)
  useEffect(() => {
    if (!d || d.antes) return
    const ids = [d.ventana.instanteAviso, d.ventana.instanteCierre].map((i) => i - Date.now() + 80).filter((e) => e > 0 && e < 2_000_000_000).map((e) => window.setTimeout(() => forzar((x) => x + 1), e))
    return () => ids.forEach((i) => window.clearTimeout(i))
  }, [d])

  // Un solo aviso a las 20:50: marcar lo que falta y completar la revisión (solo con la app abierta en la versión web).
  useEffect(() => {
    if (!d || d.antes) return
    if (d.revision) {
      recordatorios.cancelar('revision-2050')
      return
    }
    const pendientes = d.pilares.pilares.filter((p) => p.estado === 'pendiente' && p.accion.tipo === 'compromiso')
    const t = Date.now()
    if (t >= d.ventana.instanteCierre) return
    // Si cae dentro de un bloque obligatorio (facultad, trabajo), se corre al final del bloque.
    void finDeObligatorio(hoy, d.ventana.instanteAviso).then((x) => {
      let instante = x && x.fin < d.ventana.instanteCierre ? x.fin : d.ventana.instanteAviso
      if (instante <= t) {
        // Ya pasó la hora (la app estaba cerrada o recién se abrió): avisa ahora, una sola vez por día.
        const clave = `aviso-2050:${hoy}`
        try {
          if (localStorage.getItem(clave)) return
          localStorage.setItem(clave, '1')
        } catch { /* sin almacenamiento */ }
        instante = t
      }
      recordatorios.programar({ id: 'revision-2050', titulo: x ? `Saliste de ${x.bloque.nombre}: completá tu revisión` : 'Completá tu revisión ahora', cuerpo: `Menos de 3 min${pendientes.length ? ` · sin marcar: ${pendientes.map((p) => p.accion.nombre).join(', ')}` : ''}`, instante })
    }).catch(() => {})
  }, [d, hoy])

  // Aviso de entreno (19:00): si es día de entreno y todavía no empezó. En la web suena solo con la app abierta
  // o recién minimizada; en la app Android lo programa programarAlarmas aunque esté cerrada.
  const avisoEntreno = (() => {
    if (!d || d.antes) return null
    const p = d.pilares.pilares.find((x) => x.accion.tipo === 'entrenamiento')
    const a = p?.accion
    if (!p || !a?.horaLimiteInicio || !a.avisoInicio?.activo || p.compromiso?.estado !== 'pendiente' || d.entrenoEnCurso) return null
    return { desde: instanteDe(hoy, a.avisoInicio.hora, d.ajustes.zonaHoraria), hasta: instanteDe(hoy, a.horaLimiteInicio, d.ajustes.zonaHoraria), limite: a.horaLimiteInicio }
  })()
  useEffect(() => {
    if (!avisoEntreno || avisoEntreno.desde <= Date.now()) {
      recordatorios.cancelar('entreno-1900')
      return
    }
    const faltan = Math.round((avisoEntreno.hasta - avisoEntreno.desde) / 60_000)
    recordatorios.programar({ id: 'entreno-1900', titulo: 'Empezá el entreno', cuerpo: `Quedan ${faltan} min: hasta las ${avisoEntreno.limite} el pilar cuenta.`, instante: avisoEntreno.desde })
  }, [avisoEntreno?.desde, avisoEntreno?.hasta, avisoEntreno?.limite]) // eslint-disable-line react-hooks/exhaustive-deps
  const enAvisoEntreno = !!avisoEntreno && tic >= avisoEntreno.desde && tic < avisoEntreno.hasta
  // Vibración corta una vez por día al ver el aviso.
  useEffect(() => {
    if (!enAvisoEntreno) return
    const clave = `aviso-entreno:${hoy}`
    try {
      if (localStorage.getItem(clave)) return
      localStorage.setItem(clave, '1')
    } catch { /* sin almacenamiento */ }
    try { navigator.vibrate?.([120, 80, 120]) } catch { /* sin vibración */ }
  }, [enAvisoEntreno, hoy])

  // A las 21:00 lo que sigue sin marcar queda omitido: se dispara sin esperar a recargar.
  useEffect(() => {
    if (!d || d.antes) return
    const espera = d.ventana.instanteCierre - Date.now() + 1500
    if (espera <= 0 || espera > 2_000_000_000) return
    const id = window.setTimeout(() => mutar(cerrarDiasPendientes), espera)
    return () => window.clearTimeout(id)
  }, [d])

  // «Lo no cumplido resta»: aviso a la hora de alistarse con lo que falta y cuánto restaría.
  useEffect(() => {
    if (!d || d.antes) return
    const texto = d.avisoResta ? textoAvisoResta(d.avisoResta.faltantes, d.avisoResta.porcentaje) : null
    const instante = instanteDe(hoy, d.ajustes.horaAlistarse || '20:00', d.ajustes.zonaHoraria)
    if (!texto || instante <= Date.now()) { recordatorios.cancelar('resta-alistarse'); return }
    recordatorios.programar({ id: 'resta-alistarse', titulo: 'Todavía estás a tiempo', cuerpo: `${texto} · ${d.avisoResta!.faltantes.map((f) => f.nombre).join(', ')}`, instante })
  }, [d, hoy])
  // Lo que se perdió ayer: el tema lo muestra una vez (la bolita de XP se apaga y cae como ceniza), arriba.
  useEffect(() => {
    if (!d || d.antes || !d.ayer.menos) return
    const clave = `xp-perdida:${sumarDias(hoy, -1)}`
    try { if (localStorage.getItem(clave)) return; localStorage.setItem(clave, '1') } catch { /* sin almacenamiento */ }
    const t = window.setTimeout(() => disparar('xp-perdida', { texto: `−${d.ayer.menos} XP` }), 700)
    return () => window.clearTimeout(t)
  }, [d, hoy])

  // Primer día de una fase nueva: logro grande (una sola vez).
  useEffect(() => {
    if (!d || d.antes || !d.estado?.fase) return
    if (d.estado.dia === d.estado.fase.diaInicio) celebrarFase(d.estado.faseNumero, (d.ajustes.nombresFases ?? NOMBRES_FASES_INICIALES)[d.estado.faseNumero - 1], d.estado.ciclo.id)
  }, [d])


  // El tajo y los ninjas automáticos (hooks: van antes de cualquier return).
  useEffect(() => {
    if (!d || d.antes || d.ajustes.ninjas === false) return
    const pendientes = d.pilares.pilares.filter((p) => p.estado === 'pendiente')
    const instDejar = instanteDe(d.nocheAbierta, d.ajustes.horaDejarCelu, d.ajustes.zonaHoraria)
    if (debeMostrarTajo({ ultimaVista: vistaAnterior(), ahora: Date.now(), pilarPendiente: pendientes.length > 0, pasoDejoCelu: !d.suenio && Date.now() > instDejar, mostradoHoy: tajoMostradoHoy(hoy) })) {
      marcarTajo(hoy)
      setTajo(true)
    }
  }, [hoy, d])
  useEffect(() => {
    if (!d || d.antes || hayPelea() || hayRival()) return
    const pendientes = d.pilares.pilares.filter((p) => p.estado === 'pendiente').map((p) => ({ id: p.accion.id, nombre: p.accion.nombre, horaLimite: p.accion.tipo === 'entrenamiento' ? p.accion.horaLimiteInicio ?? p.horaLimite : p.horaLimite, entreno: p.accion.tipo === 'entrenamiento' }))
    const instDejar = instanteDe(d.nocheAbierta, d.ajustes.horaDejarCelu, d.ajustes.zonaHoraria)
    const pl = partesLocales(tic, d.ajustes.zonaHoraria)
    const m = momentoActivo({ minutoActual: pl.hora * 60 + pl.minuto, pilaresPendientes: pendientes, pasoDejoCelu: !d.suenio && tic > instDejar, juegoPasado: d.juego.minutosHoy > d.juego.limiteMinutos })
    if (!m) return
    const clave = `${hoy}:${m.momento}`
    if (intentoNinja.current === clave) return
    intentoNinja.current = clave
    void prepararPelea(hoy, m).then((p) => { if (p) lanzarDistraccion(p, modoRival(d.ajustes)) }).catch(() => {})
  }, [tic, hoy, d])

  if (!d) return <p className="vacio">{panel.error ?? 'Cargando…'}</p>

  if (d.antes) {
    const e = d.estado
    const faltan = e ? 1 - e.dia : null
    return (
      <>
        <section className="col" style={{ gap: 6, padding: '8px 0' }}>
          <div className="enorme">{e ? `${faltan}` : '—'}<span className="grande texto-2" style={{ marginLeft: 8 }}>{faltan === 1 ? 'día' : 'días'}</span></div>
          <p className="texto-2">{e ? `El Día 1 es el ${fechaLegible(e.ciclo.inicio, false)}. Hasta entonces no se registra nada: ni pilares, ni XP, ni descanso.` : 'Todavía no hay un ciclo activo.'}</p>
          <p className="texto-3 chico">Usá estos días para dejar todo configurado.</p>
        </section>
        <button className="boton ancho grande" onClick={() => entrarModoPrueba()}>Probar cómo se ve</button>
        <p className="ayuda centro" style={{ marginTop: -6 }}>Abre una copia de prueba con el Día 1 hoy y tu configuración. Al salir o cerrar la app se borra; tu ciclo real no se toca.</p>
        <div className="lista-nav compacta">
          <Link to="/mas/nuevo-ciclo"><span>Fecha de inicio<span className="desc">{e ? fechaLegible(e.ciclo.inicio) : 'elegir'} · días y hora de entrenamiento</span></span><span className="flecha">›</span></Link>
          <Link to="/mas/acciones"><span>Pilares y acciones<span className="desc">nombre, hora límite, mínimo, atributo, XP</span></span><span className="flecha">›</span></Link>
          <Link to="/mas/entrenamiento"><span>Descanso<span className="desc">alistarse {d.ajustes.horaAlistarse} · dejo celu {d.ajustes.horaDejarCelu} · dormido {d.ajustes.horaDormido}</span></span><span className="flecha">›</span></Link>
          <Link to="/mas/ajustes"><span>Límite de juego<span className="desc">{d.ajustes.limiteJuegoSemana} min lun–vie · {d.ajustes.limiteJuegoFinde} min sáb, dom y feriados</span></span><span className="flecha">›</span></Link>
          <Link to="/mas/objetivos"><span>Objetivos por fase<span className="desc">qué querés lograr en cada etapa</span></span><span className="flecha">›</span></Link>
          <Link to="/mas/alarmas"><span>Alarmas<span className="desc">cada aviso: Notificación, Alarma o Nada</span></span><span className="flecha">›</span></Link>
        </div>
      </>
    )
  }

  const { ajustes } = d
  const conBrillo = ajustes.brilloPendientes !== false
  const faseTerminada = d.estado?.fase && d.estado.dia > d.estado.fase.diaFin
  // La revisión diaria tiene su botón grande arriba: no se repite en la lista.
  const otros = d.compromisos.filter((c) => !c.accion.pilar && c.accion.tipo !== 'limite_juego' && c.accion.tipo !== 'acostarse' && c.accion.tipo !== 'revision_diaria')
  const pendientesOtros = otros.filter((c) => c.estado === 'pendiente' || c.estado === 'iniciado')
  const instAlistarse = instanteDe(d.nocheAbierta, ajustes.horaAlistarse, ajustes.zonaHoraria)
  const instDejarCelu = instanteDe(d.nocheAbierta, ajustes.horaDejarCelu, ajustes.zonaHoraria)
  const esHoraDeAlistarse = tic >= instAlistarse
  const minutosHastaCelu = Math.round((instDejarCelu - tic) / 60_000)
  const instFinCelu = instanteDe(d.nocheAbierta, ajustes.horaLimiteCelu, ajustes.zonaHoraria)
  const ventanaCeluCerrada = tic > instFinCelu
  // Recordatorio tenue para alistarse a dormir (30 min antes de «Dejo celu»; un toque lo cierra por esta noche).
  const avisoDormir = mostrarAvisoDormir({ ahora: tic, instDejarCelu, instFinCelu, minutos: minutosAvisoDormir(ajustes), dormirMarcado: !!d.suenio, noche: d.nocheAbierta }) && avisoDormirAbierto
  const enAviso2050 = !d.revision && tic >= d.ventana.instanteAviso && tic < d.ventana.instanteCierre
  const pasoElCierre = tic >= d.ventana.instanteCierre

  // Pilares pendientes con su hora límite (para el compañero y los ninjas).
  const pendientesConHora = d.pilares.pilares.filter((p) => p.estado === 'pendiente').map((p) => ({ id: p.accion.id, nombre: p.accion.nombre, horaLimite: p.accion.tipo === 'entrenamiento' ? p.accion.horaLimiteInicio ?? p.horaLimite : p.horaLimite, entreno: p.accion.tipo === 'entrenamiento' }))
  const dudar = async () => {
    const m = { momento: 'duda' as const, pilar: pendientesConHora[0] }
    const p = await prepararPelea(hoy, m)
    if (!p) return avisar(ajustes.ninjas === false ? 'Los ninjas están apagados (Más → Ver animaciones).' : 'Sin distracciones en la lista (Más → Ver animaciones → Mis distracciones).')
    lanzarDistraccion(p, modoRival(ajustes))
  }
  // «Dudo»: con el rival escurridizo, aparece el muñeco (atraparlo lleva a la batalla). Con la carta directa, la batalla
  // (minijuego de flexiones); si la batalla está apagada, la pelea corta de antes.
  const batallar = async () => {
    emitirEvento('duda')
    if (modoRival(ajustes) === 'escurridizo' || ajustes.batalla?.activa === false) return dudar()
    const r = await prepararBatalla(hoy)
    if (r.batalla) pedirBatalla(r.batalla)
    else avisar(r.motivo)
  }
  // Avisos de una línea, apilados: entreno, pilares por vencer (45 min), dejo celu y la revisión.
  const avisos: { clave: string; texto: ReactNode; accion?: ReactNode; onCerrar?: () => void; tono?: 'rojo' | 'ambar' }[] = []
  if (enAvisoEntreno && avisoEntreno) avisos.push({ clave: 'entreno', tono: 'rojo', texto: <>Entreno en <b>{Math.max(1, Math.ceil((avisoEntreno.hasta - tic) / 60_000))} min</b></>, accion: <Link to="/entreno" className="boton chico primario">Empezar</Link> })
  for (const p of d.pilares.pilares) {
    if (p.estado !== 'pendiente' || p.vencido || !p.horaLimite || p.accion.tipo === 'entrenamiento' || p.accion.tipo === 'acostarse' || !p.compromiso) continue
    const faltan = Math.ceil((instanteDe(p.compromiso.fecha, p.horaLimite, ajustes.zonaHoraria) - tic) / 60_000)
    if (faltan > 0 && faltan <= 45) avisos.push({ clave: p.accion.id, tono: 'ambar', texto: <>{p.accion.nombre} en <b>{faltan} min</b></> })
  }
  if (avisoDormir) avisos.push({ clave: 'celu', texto: <>Dejo celu en <b>{Math.max(0, minutosHastaCelu)} min</b></>, onCerrar: () => { cerrarAvisoDormir(d.nocheAbierta); setAvisoDormirAbierto(false) } })
  if (enAviso2050 && usa(ajustes, 'revision')) avisos.push({ clave: 'revision', tono: 'rojo', texto: <>Revisión diaria <b>ahora</b> · hasta las {d.ventana.horaCierre}</>, accion: <Link to="/revision" className="boton chico primario">Empezar</Link> })

  const celebrarYFlash = (id: string, xp: number, nuevoNivel: number | null) => {
    setMarcado(id)
    setTimeout(() => setMarcado((m) => (m === id ? null : m)), 450)
    if (xp > 0) {
      setFlash((f) => ({ ...f, [id]: xp }))
      setTimeout(() => setFlash((f) => { const { [id]: _quitar, ...resto } = f; void _quitar; return resto }), 1200)
    }
    // Animación del shinobi (el registro ya está guardado); si no se muestra, queda la celebración de siempre.
    const { nivelMostrado } = celebrarPilar(id, nuevoNivel)
    if (nuevoNivel && !nivelMostrado && configuracionAnimaciones().modo !== 'ninguna') setNivelNuevo(nuevoNivel)
    void rachaActual(hoy).then((r) => celebrarRacha(r, hoy)).catch(() => {})
  }

  const subioNivel = (n: number | null) => {
    if (!n) return
    if (!celebrarNivel(n).nivelMostrado && configuracionAnimaciones().modo !== 'ninguna') setNivelNuevo(n)
  }

  // «Dejo celu»: registra la hora y entra en modo sueño (la pantalla de «Buenas noches» reemplaza a Hoy).
  const dejoCelu = () =>
    mutar(async () => {
      const r = await registrarDejoCelu()
      // Primero la ejecución de «Dormir a horario» (encima de todo), después la pantalla de buenas noches.
      if (r.cumplido) animar({ tipo: 'ejecucion', pilar: 'acostarse' })
      await entrarModoSuenio(r.noche, !r.cumplido)
      return r
    }).catch((e: unknown) => avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' }))

  const marcarPilar = async (p: Pilar) => {
    const c = p.compromiso
    if (!c) return
    // Entrenamiento: un toque = hecho con su duración fija.
    const minutos = p.accion.tipo === 'entrenamiento' ? p.accion.duracionMinutos ?? p.accion.minutosMinimos : undefined
    const r = await mutar(() => completarCompromiso(c.id, minutos ? { minutos } : undefined))
    celebrarYFlash(p.accion.id, r.xp, r.nuevoNivel)
    avisar(r.xp > 0 ? `${p.accion.nombre}: +${r.xp} XP` : `${p.accion.nombre}: ${r.motivoSinXp ?? 'hecho'}`, {
      tipo: r.xp > 0 ? 'ok' : 'bajo',
      accion: { texto: 'Deshacer', fn: () => mutar(() => deshacerCompromiso(c.id)) },
    })
  }

  // Segunda marca (manga a los 30 min): extra con brillo verde, como en las series.
  const marcarExtraPilar = async (p: Pilar) => {
    const c = p.compromiso
    if (!c) return
    const r = await mutar(() => marcarExtra(c.id))
    setMarcado(p.accion.id)
    setTimeout(() => setMarcado((m) => (m === p.accion.id ? null : m)), 450)
    if (r.xp > 0) {
      setFlash((f) => ({ ...f, [p.accion.id]: r.xp }))
      setTimeout(() => setFlash((f) => { const { [p.accion.id]: _quitar, ...resto } = f; void _quitar; return resto }), 1200)
    }
    setDestello(p.accion.id)
    setTimeout(() => setDestello((x) => (x === p.accion.id ? null : x)), 1600)
    subioNivel(r.nuevoNivel)
    avisar(r.xp > 0 ? `${p.accion.nombre}: ${p.accion.minutosExtra} min · extra +${r.xp} XP` : `${p.accion.nombre}: extra (${r.motivoSinXp ?? 'sin XP'})`, {
      tipo: r.xp > 0 ? 'ok' : 'bajo',
      accion: { texto: 'Deshacer', fn: () => mutar(() => deshacerExtra(c.id)) },
    })
  }

  const tocarPilar = (p: Pilar) => {
    if (p.estado === 'descanso' || !p.compromiso) return
    if ((p.estado === 'cumplido' || p.estado === 'tarde') && tieneExtra(p.accion) && !p.compromiso.extra) return void marcarExtraPilar(p)
    if (p.estado !== 'pendiente') return setPilarSel(p)
    // Entrenamiento: abre el modo entreno (la rutina que toca hoy); al terminar se marca solo.
    if (p.accion.tipo === 'entrenamiento') return navegar('/entreno')
    // Comer según el plan: se evalúa solo al cerrar el día; tocar abre la comida.
    if (p.accion.tipo === 'comida_plan') return navegar('/comida')
    if (p.accion.tipo === 'acostarse') {
      if (p.ventanaCerrada) return avisar(`Pasaron las ${ajustes.horaLimiteCelu}: la noche queda sin cumplir.`, { tipo: 'bajo' })
      return void dejoCelu()
    }
    void marcarPilar(p)
  }

  return (
    <>
      {d.estado?.terminado && (
        <section className="tarjeta">
          <h2>Ciclo terminado</h2>
          <p className="texto-2">Llegaste al día {d.estado.ciclo.duracionDias}. Revisá los resultados y empezá el siguiente ciclo: tu nivel y tu historial se conservan.</p>
          <div className="botonera">
            <Link className="boton" to={`/fase/${d.estado.faseNumero}`}>Ver resultados</Link>
            <Link className="boton primario" to="/mas/nuevo-ciclo">Nuevo ciclo</Link>
          </div>
        </section>
      )}
      {!d.estado?.terminado && faseTerminada && d.estado?.fase && !d.estado.fase.cerradaEn && (
        <div className="fila entre tarjeta compacta">
          <span>Terminó la fase {d.estado.fase.numero}.</span>
          <Link className="boton chico primario" to={`/fase/${d.estado.fase.numero}`}>Revisar</Link>
        </div>
      )}

      {/* «Dudo», «Tensión» y «No cumplí» en la cabecera, juntos y en contorno */}
      {huecoCabecera && createPortal(
        <span className="hoy-arriba">
          {!rivalArchivado() && <button type="button" className="boton-duda" onClick={batallar} aria-label="Estoy dudando: batalla contra la distracción">Dudo</button>}
          {clipsTension && usa(ajustes, 'tension') && <button type="button" className="boton-duda" onClick={() => pedirTension()} aria-label="Tensión: cinemática"><span className="boton-duda-kanji" aria-hidden>進</span>Tensión</button>}
          {usa(ajustes, 'tension') && <BotonNoCumpli fecha={hoy} className="boton-duda rojo" texto="No cumplí" />}
        </span>,
        huecoCabecera,
      )}

      {/* Avisos: una línea cada uno, apilados */}
      {avisos.length > 0 && (
        <div className="avisos" role="alert">
          {avisos.map((a) => (
            <div key={a.clave} className={`aviso-linea ${a.tono ?? ''}`}>
              <span className="crece">{a.texto}</span>
              {a.accion}
              {a.onCerrar && <button type="button" className="aviso-cerrar" aria-label="Cerrar" onClick={a.onCerrar}>✕</button>}
            </div>
          ))}
        </div>
      )}

      {/* Buenos días: la primera vez que se abre después del modo sueño */}
      {d.buenosDias && (
        <div className="buenos-dias" role="status">
          <div className="col" style={{ gap: 2 }}>
            <b>Buenos días · Día {d.estado?.dia} de {d.estado?.ciclo.duracionDias}</b>
            {d.anoche && <span className="chico"><Link to="/sueno" className="texto-2">Dormiste {duracionSuenio(d.anoche.minutos)}{d.anoche.estimado ? ' aprox.' : ''} · celu {horaDeMinutos(d.anoche.acostado)} · arriba {horaDeMinutos(d.anoche.levantado)} ›</Link></span>}
            {d.veredictoAnoche && <span className={`chico sueno-veredicto-linea ${d.veredictoAnoche.tono}`}>{d.veredictoAnoche.texto}</span>}
            <span className="chico texto-2">{d.ajusteDeAyer ? `Tu ajuste para hoy: ${d.ajusteDeAyer}` : `Hoy, de nuevo, los ${d.pilares.pilares.length || 4} pilares.`}</span>
          </div>
          <button className="boton chico suave" aria-label="Cerrar" onClick={() => { try { localStorage.removeItem('buenos-dias') } catch { /* nada */ } panel.recargar() }}>✕</button>
        </div>
      )}
      {!d.buenosDias && d.ajusteDeAyer && <p className="ajuste-ayer">Ajuste de hoy: <b>{d.ajusteDeAyer}</b></p>}

      {/* Mi horario: dónde estás ahora y qué sigue (tocar abre la semana). Arriba, en la barra fija; sin ella, acá. */}
      {usa(ajustes, 'horario') && (huecoHorario ? createPortal(<LineaDelDia hoy={hoy} />, huecoHorario) : <LineaDelDia hoy={hoy} />)}

      {/* Pilares del día: una línea cada uno */}
      <section className="col pilares-hoy" style={{ gap: 6 }} aria-label="Pilares de hoy">
        <div className="fila entre">
          <span className="seccion-titulo">Pilares de hoy <span className="seccion-nota">(tocá para registrar o iniciar)</span></span>
          <span className="mono chico" style={{ fontWeight: 700 }}>
            <span className={d.pilares.cumplidos === d.pilares.aplican && d.pilares.aplican > 0 ? 'ok' : ''}>{d.pilares.cumplidos}</span>
            <span className="texto-3">/{d.pilares.aplican}</span>
          </span>
        </div>
        <div className="pilares-bloques">
          {d.pilares.pilares.map((p, i) => (
            <FilaPilar
              key={p.accion.id}
              brillo={brillo(estadoBrilloPilar(p), i, conBrillo)}
              p={p}
              suenio={d.suenio}
              zona={ajustes.zonaHoraria}
              tic={tic}
              flash={flash[p.accion.id]}
              marcado={marcado === p.accion.id}
              destello={destello === p.accion.id}
              onTocar={() => tocarPilar(p)}
              onMas={() => p.compromiso && setPilarSel(p)}
              onConfigurar={() => navegar(`/mas/acciones?editar=${encodeURIComponent(p.accion.id)}`)}
              horaLimiteCelu={ajustes.horaLimiteCelu}
              entrenoEnCurso={d.entrenoEnCurso}
            />
          ))}
        </div>
        {/* Línea simple del horario de la noche */}
        <p className="linea-horario muy-chico texto-3 centro">Alistarse {ajustes.horaAlistarse} · dejo celu hasta {ajustes.horaDejarCelu} · dormido {ajustes.horaDormido}</p>
        {!rivalArchivado() && ajustes.ninjas !== false && (d.peleas.length > 0 || (batallas && batallas.hechas > 0)) && (
          <ChipsBatallas hoy={hoy} ajustes={ajustes} unidad={d.contadores.find((c) => c.contador.id === (ajustes.batalla?.contadorId ?? 'flexiones'))?.contador.nombre.toLowerCase() ?? 'flexiones'} hechas={batallas?.hechas} tope={batallas?.tope} />
        )}
        {!d.suenio && esHoraDeAlistarse && !ventanaCeluCerrada && (
          <button className="boton celu ancho grande" onClick={dejoCelu}>
            Dejo celu{minutosHastaCelu > 0 ? ` · faltan ${duracionLegible(minutosHastaCelu)}` : minutosHastaCelu < 0 ? ` · ${duracionLegible(-minutosHastaCelu)} tarde` : ''}
          </button>
        )}
        {d.suenio && (
          <p className="muy-chico texto-3 centro" style={{ margin: 0 }}>
            Celu dejado a las {formatoHora(d.suenio.horaReal, ajustes.zonaHoraria)}{d.suenio.cumplido ? ' · a tiempo' : ` · ${d.suenio.retrasoMinutos} min tarde`}.{' '}
            <button className="enlace" onClick={() => mutar(() => deshacerDejoCelu(d.nocheAbierta)).then(() => avisar('«Dejo celu» deshecho'))}>Deshacer</button>
          </p>
        )}
      </section>

      {/* Agua como tarjeta aparte (lo normal es la chiquita dentro de Comida) */}
      {usa(ajustes, 'comida') && ajustes.agua?.enHoy === 'tarjeta' && <TarjetaAgua hoy={hoy} />}
      {tajo && <Tajo onFin={cerrarTajo} />}

      {/* Comida: dos anillos (calorías y proteína) y «+ Comí» */}
      {usa(ajustes, 'comida') && <TarjetaComida hoy={hoy} />}

      {/* Forja de hábitos: hasta 3 piedras chicas (si no hay, no aparece) */}
      {usa(ajustes, 'forja') && <FilaForjaHoy hoy={hoy} />}

      {/* Metas de la semana: fila mini de 7 días, debajo de los pilares */}
      {usa(ajustes, 'metas') && <SemanaMetas hoy={hoy} />}

      {/* Botones importantes: rojizos a pincel; al usarlos en el día pasan a verde */}
      <div className="col accesos" style={{ gap: 8 }}>
        {usa(ajustes, 'revision') && <Link to="/revision" className={`boton grande revision-baja ${d.revision ? 'hecha' : 'rojizo'}`} {...brillo(d.revision ? 'hecho' : 'pendiente', 4, conBrillo)}>
          {d.revision ? ICONO_OK : ICONO_REV}{d.revision ? 'Revisión diaria hecha' : 'Revisión diaria'}<span className="chico" style={{ fontWeight: 500, opacity: 0.8 }}>{d.revision ? '· ver' : pasoElCierre ? `· sin hacer a las ${d.ventana.horaCierre}` : `· hasta ${d.ventana.horaAviso}`}</span>
        </Link>}
        <div className="rejilla-2">
          <Link to="/321" className={`boton grande acceso-medio ${usadoHoy('321', hoy) ? 'hecha' : 'rojizo'}`} {...brillo(usadoHoy('321', hoy) ? 'hecho' : 'pendiente', 5, conBrillo)}>{usadoHoy('321', hoy) ? ICONO_OK : ICONO_321}3 · 2 · 1</Link>
          <Link to="/siguiente" className={`boton grande acceso-medio ${usadoHoy('siguiente', hoy) ? 'hecha' : 'rojizo'}`} {...brillo(usadoHoy('siguiente', hoy) ? 'hecho' : 'pendiente', 6, conBrillo)}>{usadoHoy('siguiente', hoy) ? ICONO_OK : ICONO_SIG}Siguiente acción</Link>
        </div>
      </div>

      {/* Series rápidas: flexiones al salir del taller, dominadas en la escalera */}
      {usa(ajustes, 'series') && d.contadores.length > 0 && (
        <section className="col" style={{ gap: 8 }} aria-label="Series rápidas">
          <div className="fila entre">
            <span className="seccion-titulo">Series rápidas</span>
            <Link to="/mas/contadores" className="chico texto-3">ajustar ›</Link>
          </div>
          {d.propuestas.map((p) => (
            <div key={p.contadorId} className="propuesta-cuota" role="group" aria-label={`Subir las reps por serie de ${p.nombre}`}>
              <span><b>¿Subimos a {p.a} {p.nombre.toLowerCase()} por serie?</b> <span className="texto-3 chico" style={{ whiteSpace: 'nowrap' }}>{p.de} → {p.a} · cuota {p.cuota} · extra {p.extra}</span></span>
              <span className="fila" style={{ gap: 6 }}>
                <button className="boton chico primario" onClick={() => mutar(() => responderPropuesta(p.contadorId, true)).then(() => avisar(`${p.nombre}: ${p.a} por serie desde hoy · cuota ${p.cuota}`, { tipo: 'ok' }))}>Sí</button>
                <button className="boton chico suave" onClick={() => mutar(() => responderPropuesta(p.contadorId, false)).then(() => avisar('Te lo vuelvo a proponer en 3 días'))}>Todavía no</button>
              </span>
            </div>
          ))}
          <div className="rejilla-2">
            {d.contadores.map((c, i) => (
              <BotonContador key={c.contador.id} r={c} brillo={brillo(c.extraLogradoHoy ? 'maximo' : c.metaLogradaHoy ? 'parcial' : 'pendiente', 7 + i, conBrillo)} destello={destello === c.contador.id} onToque={async () => {
                const res = await mutar(() => sumarToque(c.contador.id))
                animar({ tipo: 'parry' })
                subioNivel(res.nuevoNivel)
                if (res.xpExtra > 0) {
                  setDestello(c.contador.id)
                  setTimeout(() => setDestello((x) => (x === c.contador.id ? null : x)), 1600)
                  avisar(`${c.contador.nombre}: Extra +${res.xpExtra} XP`, { tipo: 'ok' })
                } else if (res.xp > 0) avisar(`${c.contador.nombre}: llegaste a la cuota. +${res.xp} XP`, { tipo: 'ok' })
              }} onDeshacer={() => mutar(() => deshacerUltimoToque(c.contador.id)).then((t) => avisar(`${c.contador.nombre}: ${t} hoy`))} />
            ))}
          </div>
        </section>
      )}

      {/* Otros compromisos (no pilares) */}
      {otros.length > 0 && (
        <section className="col" style={{ gap: 6 }}>
          <div className="fila entre">
            <span className="seccion-titulo">Otros compromisos</span>
            <span className="texto-3 chico">{pendientesOtros.length} pendiente{pendientesOtros.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            {otros.map((c) => (
              <FilaCompromiso key={c.id} c={c} hoy={hoy} onAbrir={() => setSeleccion(c)} />
            ))}
          </div>
        </section>
      )}

      {/* Organización: lo que me toca hoy (tareas de los frentes). */}
      {usa(ajustes, 'organizacion') && <TiraOrganizacion hoy={hoy} />}

      {/* Juego, Entrenamiento y Calendario ya están en la barra de abajo: no se repiten acá. */}

      {/* De noche, después de «Dejo celu»: la cama del compañero, abajo de todo sin tapar nada */}
      <CamaDelCompanero dormido={!!d.suenio && deNoche} modo={ajustes.companero} />

      {/* Discreto, abajo de todo: una caída no reinicia nada, saca un poco de XP y deja la marca */}

      <DetalleCompromiso c={seleccion} hoy={hoy} onCerrar={() => setSeleccion(null)} />
      <DetallePilar p={pilarSel} hoy={hoy} onCerrar={() => setPilarSel(null)} onResultado={(id, xp, n) => celebrarYFlash(id, xp, n)} />
      <Celebracion nivel={nivelNuevo} onFin={cerrarCelebracion} />
    </>
  )
}

function BotonContador({ r, brillo: b, destello, onToque, onDeshacer }: { r: ResumenContador; brillo: ReturnType<typeof brillo>; destello: boolean; onToque: () => void; onDeshacer: () => void }) {
  const c = r.contador
  // La barra llega hasta el extra: primera capa hasta la cuota, segunda capa (más brillante) de la cuota al extra.
  const tope = Math.max(1, r.extraHoy)
  const marca = (100 * r.cuotaHoy) / tope
  const capa1 = (100 * Math.min(r.hoy, r.cuotaHoy)) / tope
  const capa2 = (100 * Math.max(0, Math.min(r.hoy, r.extraHoy) - r.cuotaHoy)) / tope
  const falta = r.extraHoy - r.hoy
  const detalle = r.extraLogradoHoy ? `${r.hoy} · extra ✓` : r.metaLogradaHoy ? `${r.hoy} · faltan ${falta} al extra` : `${r.hoy} / ${r.cuotaHoy} hoy`
  return (
    <button type="button" className={`contador-boton compacto ${r.metaLogradaHoy ? 'logrado' : ''} ${r.extraLogradoHoy ? 'extra' : ''} ${destello ? 'destello-extra' : ''}`} {...b} onClick={onToque} aria-label={`Sumar ${c.cantidadPorToque} ${c.nombre.toLowerCase()}. Hoy ${r.hoy}, cuota ${r.cuotaHoy}, extra ${r.extraHoy}`}>
      <span className="fila" style={{ gap: 6, alignItems: 'baseline' }}>
        <span className="mas-n">+{c.cantidadPorToque}</span>
        <span className="nombre">{c.nombre}</span>
      </span>
      {destello ? <span className="detalle mono texto-extra">Extra +{c.xpExtra ?? 5} XP</span> : <span className="detalle mono">{detalle}{r.toquesHoy > 0 ? ` · ${r.toquesHoy} serie${r.toquesHoy === 1 ? '' : 's'}` : ''}</span>}
      <span className="barrita dos-topes">
        <i style={{ width: `${capa1}%` }} />
        <i className="capa-extra" style={{ left: `${marca}%`, width: `${capa2}%` }} />
        <b className="marca-cuota" style={{ left: `${marca}%` }} />
      </span>
      {r.toquesHoy > 0 && <span className="deshacer" role="button" aria-label="Deshacer último toque" onClick={(e) => { e.stopPropagation(); onDeshacer() }}>↶</span>}
    </button>
  )
}

/** Según el ajuste: el rival escurridizo en Hoy (atraparlo → batalla) o la carta directa de antes. */
function lanzarDistraccion(p: Pelea, modo: 'escurridizo' | 'carta'): void {
  if (modo === 'escurridizo') pedirRival(p)
  else pedirPelea(p)
}

/** Una sola línea chica: la última batalla ganada con sus reps, cuántos se escaparon y si alguno se llevó XP. */

/** ¿Se usó hoy 3·2·1 o Siguiente acción? (lo anotan esas pantallas al empezar). */
function usadoHoy(que: '321' | 'siguiente', hoy: string): boolean {
  try { return !!localStorage.getItem(`usado-${que}:${hoy}`) } catch { return false }
}

/** Un pilar en una sola fila: ícono, nombre, el dato que importa y el estado a la derecha (tilde grande hecho, punto ámbar iniciado). */
function FilaPilar({ p, brillo: b, suenio, zona, tic, flash, marcado, destello, onTocar, onMas, onConfigurar, horaLimiteCelu, entrenoEnCurso }: { p: Pilar; brillo: ReturnType<typeof brillo>; suenio: { horaReal: number } | undefined; zona: string; tic: number; flash?: number; marcado: boolean; destello?: boolean; onTocar: () => void; onMas: () => void; onConfigurar: () => void; horaLimiteCelu: string; entrenoEnCurso?: boolean }) {
  const c = p.compromiso
  const esCelu = p.accion.tipo === 'acostarse'
  // Mantener apretado (0,55 s) abre la configuración del pilar; el toque normal sigue igual.
  const largo = useRef<number | null>(null)
  const fueLargo = useRef(false)
  useEffect(() => () => { if (largo.current) window.clearTimeout(largo.current) }, [])
  const empezar = () => { fueLargo.current = false; largo.current = window.setTimeout(() => { fueLargo.current = true; largo.current = null; onConfigurar() }, 550) }
  const soltar = () => { if (largo.current) { window.clearTimeout(largo.current); largo.current = null } }
  const esEntreno = p.accion.tipo === 'entrenamiento'
  const iniciado = p.estado === 'pendiente' && (c?.estado === 'iniciado' || (esEntreno && !!entrenoEnCurso))
  // Últimos 30 minutos antes de la hora límite: el brillo se nota más.
  const cerca = p.estado === 'pendiente' && !!p.horaLimite && !p.vencido && instanteDe(c?.fecha ?? '', p.horaLimite, zona) - tic <= 30 * 60_000
  const conExtra = tieneExtra(p.accion) && (p.estado === 'cumplido' || p.estado === 'tarde')
  let detalle: ReactNode
  let texto: string
  switch (p.estado) {
    case 'cumplido':
      if (esCelu && suenio) { texto = `${formatoHora(suenio.horaReal, zona)} · +${p.xpPrevisto} XP`; detalle = texto }
      else if (c?.extra) { texto = `✓ ${c.minutos ?? p.accion.minutosExtra} min · extra ✓`; detalle = texto }
      else if (conExtra) { texto = `✓ ${c?.minutos ?? p.accion.minutosMinimos} min · ¿${p.accion.minutosExtra} min?`; detalle = <>✓ {c?.minutos ?? p.accion.minutosMinimos} min · <span className="extra-pendiente">¿{p.accion.minutosExtra} min?</span></> }
      else { const min = c?.minutos ?? p.accion.minutosMinimos; texto = min ? `✓ ${min} min · +${p.xpPrevisto} XP` : `✓ +${p.xpPrevisto} XP`; detalle = texto }
      break
    case 'tarde':
      texto = `Tarde · ${c?.retrasoMinutos ?? 0} min`; detalle = texto
      break
    case 'omitido':
      texto = 'No cumplido'; detalle = texto
      break
    case 'descanso':
      texto = 'Descanso'; detalle = texto
      break
    default:
      texto = p.ventanaCerrada ? 'Ya no se registra' : p.vencido ? (esCelu ? `Tarde · hasta las ${horaLimiteCelu}` : `Venció ${p.horaLimite}`) : esCelu ? `Dejo celu hasta ${p.horaLimite}` : esEntreno ? (entrenoEnCurso ? 'En curso' : `Hasta ${p.accion.horaLimiteInicio ?? p.horaLimite ?? '—'}`) : p.accion.tipo === 'comida_plan' ? 'Se mide al cerrar el día' : `Hasta ${p.horaLimite ?? '—'}${p.accion.minutosMinimos ? ` · ${p.accion.minutosMinimos} min` : ''}`
      detalle = texto
  }
  // Segunda línea chica, como en la versión guardada: qué hacer con un toque.
  const pista = p.estado !== 'pendiente' || p.ventanaCerrada || p.accion.tipo === 'comida_plan' ? '' : esEntreno ? (entrenoEnCurso ? 'Tocá para seguir' : 'Tocá para empezar') : esCelu ? 'Tocá para registrar' : 'Tocá si lo hiciste'
  return (
    <button
      type="button"
      className={`pilar-bloque ${p.estado} ${p.vencido ? 'vencido' : ''} ${cerca ? 'cerca' : ''} ${marcado ? 'marcado' : ''} ${c?.extra ? 'extra' : ''} ${destello ? 'destello-extra' : ''} ${iniciado ? 'iniciado' : ''}`}
      {...b}
      onPointerDown={empezar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (fueLargo.current) { fueLargo.current = false; return } onTocar() }}
      aria-label={`${p.accion.nombre}: ${texto}. Mantené apretado para configurarlo`}
      disabled={p.estado === 'descanso'}
    >
      <span className="icono"><IconoPilar id={p.accion.id} tipo={p.accion.tipo} /></span>
      <span className="nombre">{p.accion.nombre}</span>
      <span className="detalle">{detalle}</span>
      {pista && <span className="pista">{pista}</span>}
      {tieneExtra(p.accion) && p.estado !== 'descanso' && (() => {
        // Barrita de dos topes, como las series: hasta la 1.ª meta y de ahí al extra.
        const meta = p.accion.minutosMinimos ?? 0
        const extra = p.accion.minutosExtra!
        const hechos = c?.extra ? Math.max(extra, c.minutos ?? 0) : p.estado === 'cumplido' || p.estado === 'tarde' ? Math.max(meta, Math.min(c?.minutos ?? meta, extra)) : 0
        const marca = (100 * meta) / extra
        return (
          <span className="barrita dos-topes pilar-barrita" aria-hidden>
            <i style={{ width: `${(100 * Math.min(hechos, meta)) / extra}%` }} />
            <i className="capa-extra" style={{ left: `${marca}%`, width: `${(100 * Math.max(0, Math.min(hechos, extra) - meta)) / extra}%` }} />
            <b className="marca-cuota" style={{ left: `${marca}%` }} />
          </span>
        )
      })()}
      <span className="estado-ic" aria-hidden>{p.estado === 'cumplido' ? '✓' : p.estado === 'tarde' ? '!' : p.estado === 'omitido' ? simbolo('✕') : p.estado === 'descanso' ? '–' : iniciado ? <i className="punto-ambar" /> : ''}</span>
      {flash !== undefined && <span className="flash" aria-hidden>+{flash} XP</span>}
      {c && p.estado !== 'descanso' && !esCelu && <span className="mas" role="button" aria-label="Más opciones" onClick={(e) => { e.stopPropagation(); onMas() }}>…</span>}
    </button>
  )
}

function DetallePilar({ p, hoy, onCerrar, onResultado }: { p: Pilar | null; hoy: string; onCerrar: () => void; onResultado: (id: string, xp: number, nuevoNivel: number | null) => void }) {
  const [minutos, setMinutos] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [nota, setNota] = useState('')
  const claveTemp = `manga-temp:${hoy}`
  const [fin, setFin] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(claveTemp)
      return v ? Number(v) : null
    } catch {
      return null
    }
  })
  const tic = useTic(1000)
  const c = p?.compromiso
  const restante = fin ? Math.max(0, Math.ceil((fin - tic) / 1000)) : null

  const hecho = async (m?: number) => {
    if (!c || !p) return
    const r = await mutar(() => completarCompromiso(c.id, { minutos: m, nota: nota || undefined, respuesta: respuesta || undefined }))
    onResultado(p.accion.id, r.xp, r.nuevoNivel)
    avisar(r.xp > 0 ? `${p.accion.nombre}: +${r.xp} XP` : `${p.accion.nombre}: ${r.motivoSinXp ?? 'hecho'}`, { tipo: r.xp > 0 ? 'ok' : 'bajo' })
    try { localStorage.removeItem(claveTemp) } catch { /* sin almacenamiento */ }
    setFin(null)
    onCerrar()
  }

  useEffect(() => {
    if (fin && restante === 0 && c && c.estado === 'pendiente') {
      hecho(p?.accion.minutosMinimos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante])

  if (!p || !c) return null
  const esEntreno = p.accion.tipo === 'entrenamiento'
  const conMinutos = !!p.accion.minutosMinimos
  const activo = c.estado === 'pendiente' || c.estado === 'iniciado'
  const empezarTemp = () => {
    const f = Date.now() + (p.accion.minutosMinimos ?? 15) * 60_000
    try { localStorage.setItem(claveTemp, String(f)) } catch { /* sin almacenamiento */ }
    setFin(f)
    mutar(() => iniciarCompromiso(c.id))
  }
  return (
    <Hoja abierta={!!p} onCerrar={onCerrar} titulo={p.accion.nombre}>
      <p className="texto-2 chico">{p.accion.condicion}</p>
      <div className="fila entre chico">
        <span className="texto-3">{p.horaLimite ? `Hasta las ${p.horaLimite}` : c.horaPrevista ? `Previsto ${c.horaPrevista}` : ''} · {p.xpPrevisto} XP</span>
        <span className={`etiqueta ${p.estado === 'cumplido' ? 'ok' : p.estado === 'tarde' || p.estado === 'omitido' ? 'bajo' : ''}`}>{p.estado}</span>
      </div>
      {c.estado === 'tarde' && <p className="chico texto-2">Marcado {c.retrasoMinutos} min después de la hora límite: cuenta como tarde y no da XP.</p>}
      {c.respuesta && <p className="chico">{p.accion.pregunta ?? 'Respuesta'}: {c.respuesta}</p>}
      {activo && conMinutos && !esEntreno && (
        <div className="col">
          {restante === null && <button className="boton ancho" onClick={empezarTemp}>Empezar {p.accion.minutosMinimos} min</button>}
          {restante !== null && restante > 0 && (
            <div className="fila entre">
              <span className="grande mono">{Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}</span>
              <button className="boton chico" onClick={() => { try { localStorage.removeItem(claveTemp) } catch { /* nada */ } setFin(null) }}>Cancelar</button>
            </div>
          )}
          <p className="ayuda">Al terminar el tiempo se marca solo. Si ya lo hiciste, cargá los minutos y marcá Sí.</p>
        </div>
      )}
      {activo && conMinutos && (
        <div className="campo">
          <label>Minutos {esEntreno ? 'entrenados' : 'dedicados'}</label>
          <input type="number" inputMode="numeric" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder={`mínimo ${p.accion.minutosMinimos}`} />
        </div>
      )}
      {activo && p.accion.pregunta && (
        <div className="campo">
          <label>{p.accion.pregunta} (opcional)</label>
          <input value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
        </div>
      )}
      {activo && (
        <div className="campo">
          <label>Nota (opcional)</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      )}
      {activo && (
        <>
          <button className="boton ok ancho" onClick={() => hecho(minutos ? Number(minutos) : undefined)}>{esEntreno ? 'Hecho' : 'Sí'}</button>
          <div className="botonera">
            <button className="boton" onClick={() => mutar(() => omitirCompromiso(c.id, nota || undefined)).then(onCerrar)}>No</button>
            {esEntreno && <button className="boton" onClick={() => mutar(() => reprogramarCompromiso(c.id, sumarDias(hoy, 1))).then(() => { avisar('Movido a mañana'); onCerrar() })}>Mover a mañana</button>}
          </div>
        </>
      )}
      {(c.estado === 'completado' || c.estado === 'tarde') && tieneExtra(p.accion) && (
        c.extra
          ? <button className="boton ancho" onClick={() => mutar(() => deshacerExtra(c.id)).then(() => { avisar('Extra quitado'); onCerrar() })}>Quitar el extra de {p.accion.minutosExtra} min</button>
          : <button className="boton ok ancho" onClick={() => mutar(() => marcarExtra(c.id)).then((r) => { avisar(r.xp > 0 ? `Extra +${r.xp} XP` : `Extra: ${r.motivoSinXp ?? 'sin XP'}`, { tipo: r.xp > 0 ? 'ok' : 'bajo' }); onCerrar() })}>Llegué a {p.accion.minutosExtra} min (extra)</button>
      )}
      {!activo && c.estado !== 'reprogramado' && (
        <button className="boton ancho" onClick={() => mutar(() => deshacerCompromiso(c.id, 'Cambiado desde Hoy')).then(onCerrar)}>Volver a pendiente</button>
      )}
    </Hoja>
  )
}

function iconoEstado(estado: Compromiso['estado']): string {
  switch (estado) {
    case 'completado': return '✓'
    case 'tarde': return '!'
    case 'iniciado': return '●'
    case 'omitido': return simbolo('✕')
    case 'no_registrado': return '–'
    case 'reprogramado': return '→'
    default: return ''
  }
}

function FilaCompromiso({ c, hoy, onAbrir }: { c: CompromisoConAccion; hoy: string; onAbrir: () => void }) {
  const navegar = useNavigate()
  const completar = async () => {
    if (c.accion.tipo === 'entrenamiento') {
      onAbrir()
      return
    }
    // Las revisiones se completan desde su propia pantalla (el XP se da al guardarla).
    if (c.accion.tipo === 'revision_diaria') return navegar('/revision')
    if (c.accion.tipo === 'revision_semanal') return navegar('/semana')
    const r = await mutar(() => completarCompromiso(c.id))
    avisar(r.xp > 0 ? `${c.accion.nombre}: +${r.xp} XP${r.nuevoNivel ? ` · ¡Nivel ${r.nuevoNivel}!` : ''}` : `${c.accion.nombre}: hecho${r.motivoSinXp ? ` (${r.motivoSinXp})` : ''}`, {
      tipo: 'ok',
      accion: { texto: 'Deshacer', fn: () => mutar(() => deshacerCompromiso(c.id)) },
    })
  }
  const activo = c.estado === 'pendiente' || c.estado === 'iniciado'
  return (
    <div className={`compromiso ${c.estado}`}>
      <div className="marca">{iconoEstado(c.estado)}</div>
      <div className="crece">
        <div className="fila entre">
          <span className="nombre">{c.horaPrevista && <span className="texto-3 mono chico">{c.horaPrevista} </span>}{c.accion.nombre}</span>
          <span className="texto-3 chico mono">{c.estado === 'completado' ? 'hecho' : c.estado === 'tarde' ? 'tarde' : `${c.xpPrevisto} XP`}</span>
        </div>
        {c.reprogramadoDesde && <span className="muy-chico texto-3">Reprogramado desde {fechaLegible(c.reprogramadoDesde)}</span>}
        {c.estado === 'reprogramado' && c.reprogramadoA && <span className="muy-chico texto-3">Movido al {fechaLegible(c.reprogramadoA)}</span>}
        {activo && (
          <div className="acciones">
            {c.estado === 'pendiente' && <button className="boton chico" onClick={() => mutar(() => iniciarCompromiso(c.id))}>Iniciar</button>}
            <button className="boton chico ok" onClick={completar}>Hecho</button>
            <button className="boton chico suave" onClick={onAbrir}>Más</button>
          </div>
        )}
        {!activo && c.fecha === hoy && (
          <div className="acciones">
            <button className="boton chico suave" onClick={onAbrir}>Cambiar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetalleCompromiso({ c, hoy, onCerrar }: { c: CompromisoConAccion | null; hoy: string; onCerrar: () => void }) {
  const [minutos, setMinutos] = useState('')
  const [nota, setNota] = useState('')
  if (!c) return null
  const esEntreno = c.accion.tipo === 'entrenamiento'
  const hecho = async () => {
    const m = esEntreno ? Number(minutos) || undefined : undefined
    const r = await mutar(() => completarCompromiso(c.id, { minutos: m, nota: nota || undefined }))
    avisar(r.xp > 0 ? `${c.accion.nombre}: +${r.xp} XP${r.nuevoNivel ? ` · ¡Nivel ${r.nuevoNivel}!` : ''}` : `Hecho${r.motivoSinXp ? `: ${r.motivoSinXp}` : ''}`, { tipo: 'ok' })
    onCerrar()
  }
  return (
    <Hoja abierta={!!c} onCerrar={onCerrar} titulo={c.accion.nombre}>
      <p className="texto-2 chico">{c.accion.condicion}</p>
      <div className="fila entre chico">
        <span className="texto-3">Previsto {c.horaPrevista ?? '—'} · {c.xpPrevisto} XP</span>
        <span className="etiqueta">{c.estado.replace('_', ' ')}</span>
      </div>
      {c.inicioReal && <span className="chico texto-2">Empezado a las {formatoHora(c.inicioReal)}{c.finReal ? `, terminado a las ${formatoHora(c.finReal)}` : ''}</span>}
      {esEntreno && (
        <div className="campo">
          <label>Minutos entrenados</label>
          <input type="number" inputMode="numeric" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder={`mínimo ${c.accion.minutosMinimos ?? 0}`} />
        </div>
      )}
      <div className="campo">
        <label>Nota (opcional)</label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      {(c.estado === 'pendiente' || c.estado === 'iniciado') && (
        <>
          <button className="boton ok ancho" onClick={hecho}>Hecho</button>
          <div className="botonera">
            <button className="boton" onClick={() => mutar(() => omitirCompromiso(c.id, nota || undefined)).then(onCerrar)}>Omitir</button>
            <button className="boton" onClick={() => mutar(() => reprogramarCompromiso(c.id, sumarDias(hoy, 1))).then(() => { avisar('Movido a mañana'); onCerrar() })}>Mover a mañana</button>
          </div>
        </>
      )}
      {c.estado !== 'pendiente' && c.estado !== 'iniciado' && c.estado !== 'reprogramado' && (
        <button className="boton ancho" onClick={() => mutar(() => deshacerCompromiso(c.id, 'Cambiado desde Hoy')).then(onCerrar)}>Volver a pendiente</button>
      )}
    </Hoja>
  )
}

const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/**
 * Metas: una fila de 7 días (hoy y los 6 siguientes). Un punto gris con brillo
 * en los días con metas: más cerca de hoy, más brilla. Debajo, las metas de hoy
 * con su casilla y la próxima. Tocar un día lo abre en el calendario.
 */
function SemanaMetas({ hoy }: { hoy: string }) {
  const navigate = useNavigate()
  const datos = useDatos(() => metasPorDia(hoy, sumarDias(hoy, 6)), [hoy])
  const porDia = datos.datos
  if (!porDia) return null
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i))
  const deHoy = porDia.get(hoy) ?? []
  const proxima = dias.slice(1).flatMap((f) => porDia.get(f) ?? []).find((m) => estadoVisible(m, hoy) === 'pendiente')
  const abrir = (f: string) => navigate(`/calendario?dia=${f}`)
  return (
    <section className="semana-metas simple" aria-label="Metas de la semana">
      <div className="fila entre">
        <span className="seccion-titulo semana-titulo-simple"><span className="semana-kanji" aria-hidden>的</span>Metas{deHoy.length === 0 && !proxima && <span className="semana-sin">sin metas esta semana</span>}</span>
        <button type="button" className="enlace semana-mas" onClick={() => abrir(hoy)} aria-label="Sumar meta">+ meta</button>
      </div>
      <div className="semana-fila">
        {dias.map((f, i) => {
          const metas = porDia.get(f) ?? []
          const cumplidas = metas.filter((m) => estadoEnDia(m, f, hoy) === 'cumplida').length
          return (
            <button key={f} type="button" className={`semana-dia ${i === 0 ? 'hoy' : ''}`} onClick={() => abrir(f)} aria-label={`${fechaLegible(f)}: ${metas.length ? `${metas.length} meta${metas.length > 1 ? 's' : ''}` : 'sin metas'}`}>
              <span className="semana-letra">{i === 0 ? 'hoy' : LETRAS[diaSemanaDe(f)]}</span>
              <span className="semana-num">{Number(f.slice(8))}</span>
              <span className="semana-puntos">
                {metas.slice(0, 4).map((m, j) => <span key={m.id ?? j} className={`semana-punto ${j < cumplidas ? 'cumplida' : 'con-meta'}`} style={{ '--cerca': String(1 - i / 7) } as React.CSSProperties} />)}
                {metas.length === 0 && <span className="semana-punto" />}
              </span>
            </button>
          )
        })}
      </div>
      {deHoy.length > 0 && <div className="semana-hoy">{deHoy.map((m) => <FilaMeta key={m.id} m={m} hoy={hoy} dia={hoy} chica />)}</div>}
      {proxima && (
        <div className="muy-chico texto-3 semana-proxima">próxima: <b className="texto-2">{proxima.titulo}</b> · {fechaLegible(proxima.fecha)}</div>
      )}
    </section>
  )
}
