import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { fechaDe, proximaMedianoche } from '../domain/fechas'
import { inicializarSiHaceFalta, obtenerAjustes } from '../services/base'
import { cicloActivo, iniciarCiclo } from '../services/ciclo'
import { db } from '../data/db'
import { enModoPrueba, limpiarRestosDePrueba } from '../data/modoPrueba'
import { cerrarDiasPendientes, ventanaNoche } from '../services/dia'
import { ahora } from '../services/reloj'
import { modoSuenioActivo, registrarAperturaEnSuenio, terminarModoSuenioSiCorresponde } from '../services/suenio'
import { programarAlarmas } from '../services/alarmas'
import { Avisos, Cargando } from './componentes'
import { PantallaSuenio } from './ModoSuenio'
import { CapaAnimacion } from './animaciones/CapaAnimacion'
import { NinjaPelea } from './Ninja'
import { BatallaCapa } from './Batalla'
import { TensionCapa } from './Tension'
import { CaidaCapa } from './Caida'
import { CapaXpPerdida } from '../temas/xpPerdida'
import { RivalCapa } from './Rival'
import { avisar, mutar, notificarCambio, useDatos, useVersion } from './estado'
import { Layout } from './Layout'
import { Acciones } from './paginas/Acciones'
import { Ajustes } from './paginas/Ajustes'
import { Recomendar } from './paginas/Recomendar'
import { RecomendacionesCreador } from './paginas/RecomendacionesCreador'
import { reintentarPendientes } from '../services/recomendaciones'
import { Sueno } from './paginas/Sueno'
import { AlarmasTelefono } from './paginas/AlarmasTelefono'
import { Actualizar } from './paginas/Actualizar'
import { PuenteAndroid } from './PuenteAndroid'
import { Atributos } from './paginas/Atributos'
import { Calendario } from './paginas/Calendario'
import { MiHorario } from './paginas/MiHorario'
import { CierreFase } from './paginas/CierreFase'
import { Copia } from './paginas/Copia'
import { Sincronizar } from './paginas/Sincronizar'
import { Entrenamiento } from './paginas/Entrenamiento'
import { Entreno } from './paginas/Entreno'
import { EditarRutina, HistorialEntrenos, Rutinas } from './paginas/Rutinas'
import { Historial } from './paginas/Historial'
import { Hoy } from './paginas/Hoy'
import { Identidad } from './paginas/Identidad'
import { Inicio } from './paginas/Inicio'
import { PrimeraVez } from './paginas/PrimeraVez'
import { Comida, MasComida } from './paginas/Comida'
import { TemaYNombres } from './paginas/TemaYNombres'
import { necesitaPrimeraVez } from '../services/primeraVez'
import { aplicarTema } from '../temas/temas'
import { Juego } from './paginas/Juego'
import { Mas } from './paginas/Mas'
import { Metas } from './paginas/Metas'
import { Contadores } from './paginas/Contadores'
import { Objetivos } from './paginas/Objetivos'
import { Progreso } from './paginas/Progreso'
import { Protocolo321 } from './paginas/Protocolo321'
import { RevisionDiaria } from './paginas/RevisionDiaria'
import { RevisionSemanal } from './paginas/RevisionSemanal'
import { SiguienteAccion } from './paginas/SiguienteAccion'
import { Organizacion } from './paginas/Organizacion'
import { recordatorios } from '../reminders/recordatorios'

const VerAnimaciones = lazy(() => import('./paginas/VerAnimaciones').then((m) => ({ default: m.VerAnimaciones })))

export function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        await limpiarRestosDePrueba()
        await inicializarSiHaceFalta()
        { const a = await obtenerAjustes(); aplicarTema(a.tema, a.nombreApp) }
        if (enModoPrueba() && !(await cicloActivo())) {
          // Prueba: el Día 1 es hoy, con la configuración real copiada.
          const a = await obtenerAjustes()
          const c = await iniciarCiclo(fechaDe(ahora(), a.zonaHoraria))
          const sueltos = (await db().objetivos.toArray()).filter((o) => o.cicloId !== c.id)
          for (const o of sueltos) await db().objetivos.put({ ...o, cicloId: c.id })
        }
        await cerrarDiasPendientes()
        // Modo sueño: si ya pasó la hora de fin, termina y deja «Buenos días» para Hoy; si sigue, esta apertura queda anotada.
        const terminado = await terminarModoSuenioSiCorresponde()
        if (terminado) marcarBuenosDias(terminado.noche)
        else if (await modoSuenioActivo()) await registrarAperturaEnSuenio()
        if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
        // Recomendaciones que quedaron esperando internet.
        reintentarPendientes().catch(() => {})
        window.addEventListener('online', () => { reintentarPendientes().catch(() => {}) })
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelado) setListo(true)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  // Cambio de día: al pasar la medianoche y al volver a primer plano.
  useEffect(() => {
    if (!listo) return
    let temporizador = 0
    const programar = async () => {
      const a = await obtenerAjustes()
      const espera = Math.max(1000, proximaMedianoche(ahora(), a.zonaHoraria) - ahora() + 1500)
      temporizador = window.setTimeout(async () => {
        await mutar(cerrarDiasPendientes)
        programar()
      }, Math.min(espera, 2_000_000_000))
    }
    programar()
    const alVolver = async () => {
      if (document.visibilityState !== 'visible') return
      const cerrados = await mutar(cerrarDiasPendientes)
      if (cerrados.length) notificarCambio()
      const terminado = await terminarModoSuenioSiCorresponde()
      if (terminado) { marcarBuenosDias(terminado.noche); notificarCambio() }
      else if (await modoSuenioActivo()) await mutar(() => registrarAperturaEnSuenio())
    }
    // Cierre de las 21:00: lo que sigue sin marcar queda omitido sin esperar a la medianoche.
    let temporizadorNoche = 0
    const programarNoche = async () => {
      const a = await obtenerAjustes()
      const v = await ventanaNoche(fechaDe(ahora(), a.zonaHoraria))
      const espera = v.instanteCierre - ahora() + 1500
      if (espera > 0 && espera < 2_000_000_000) temporizadorNoche = window.setTimeout(() => mutar(cerrarDiasPendientes), espera)
    }
    programarNoche()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    const quitar = recordatorios.alDisparar((r) => avisar(`${r.titulo}: ${r.cuerpo}`, { duracionMs: 15_000 }))
    return () => {
      clearTimeout(temporizador)
      clearTimeout(temporizadorNoche)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
      quitar()
    }
  }, [listo])

  // Alarmas del teléfono (app Android): se reprograman al abrir y, con una pausa, después de cada cambio.
  const version = useVersion()
  useEffect(() => {
    if (!listo) return
    const id = window.setTimeout(() => programarAlarmas().catch(() => {}), 2000)
    return () => window.clearTimeout(id)
  }, [listo, version])

  if (!listo) return <div className="contenido"><Cargando /></div>
  if (error) return <div className="contenido"><p className="error">No se pudo abrir la base de datos: {error}</p></div>

  return (
    <HashRouter>
      <ConSuenio />
      <PuenteAndroid listo={listo} />
      <CapaAnimacion />
      <NinjaPelea />
      <BatallaCapa />
      <TensionCapa />
      <CaidaCapa />
      <CapaXpPerdida />
      <RivalCapa />
      <Avisos />
    </HashRouter>
  )
}

/** Deja una marca para que Hoy muestre «Buenos días» la primera vez que se abre después del modo sueño. */
export function marcarBuenosDias(noche: string): void {
  try { localStorage.setItem('buenos-dias', noche) } catch { /* sin almacenamiento */ }
}

/** Mientras el modo sueño está activo, solo se ve su pantalla. Termina solo a la hora de fin. */
function ConSuenio() {
  const suenio = useDatos(() => modoSuenioActivo(), [])
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const estado = suenio.datos
  useEffect(() => {
    if (!estado) return
    const espera = estado.hasta - ahora() + 1000
    if (espera > 2_000_000_000) return
    const id = window.setTimeout(async () => {
      const t = await mutar(() => terminarModoSuenioSiCorresponde())
      if (t) marcarBuenosDias(t.noche)
    }, Math.max(0, espera))
    return () => window.clearTimeout(id)
  }, [estado])
  if (suenio.cargando || ajustes.cargando) return <div className="contenido"><Cargando /></div>
  if (estado && ajustes.datos) return <PantallaSuenio estado={estado} zona={ajustes.datos.zonaHoraria} horaDormido={ajustes.datos.horaDormido} horaFin={ajustes.datos.horaFinSuenio} />
  return <Rutas />
}

function Rutas() {
  const ciclo = useDatos(() => cicloActivo(), [])
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const primeraVez = useDatos(() => necesitaPrimeraVez(), [])
  if (ciclo.cargando || ajustes.cargando || primeraVez.cargando) return <div className="contenido"><Cargando /></div>
  const hoy = fechaDe(ahora(), ajustes.datos!.zonaHoraria)
  if (!ciclo.datos && primeraVez.datos) {
    return (
      <Routes>
        <Route path="/bienvenida" element={<PrimeraVez hoy={hoy} />} />
        <Route path="/copia" element={<div className="app"><div className="contenido" style={{ paddingTop: 24 }}><Copia /></div></div>} />
        <Route path="*" element={<Navigate to="/bienvenida" replace />} />
      </Routes>
    )
  }
  if (!ciclo.datos) {
    return (
      <Routes>
        <Route path="/inicio" element={<Inicio hoy={hoy} />} />
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout hoy={hoy} />}>
        <Route path="/" element={<Hoy hoy={hoy} />} />
        <Route path="/calendario" element={<Calendario hoy={hoy} />} />
        <Route path="/calendario/horario" element={<MiHorario />} />
        <Route path="/juego" element={<Juego hoy={hoy} />} />
        <Route path="/progreso/*" element={<Progreso hoy={hoy} />} />
        <Route path="/organizacion" element={<Organizacion hoy={hoy} />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="/mas/identidad" element={<Identidad />} />
        <Route path="/mas/atributos" element={<Atributos hoy={hoy} />} />
        <Route path="/mas/objetivos" element={<Objetivos hoy={hoy} />} />
        <Route path="/mas/metas" element={<Metas hoy={hoy} />} />
        <Route path="/mas/contadores" element={<Contadores hoy={hoy} />} />
        <Route path="/mas/acciones" element={<Acciones hoy={hoy} />} />
        <Route path="/mas/entrenamiento" element={<Entrenamiento hoy={hoy} />} />
        <Route path="/mas/rutinas" element={<Rutinas />} />
        <Route path="/mas/rutinas/historial" element={<HistorialEntrenos />} />
        <Route path="/mas/rutinas/:id" element={<EditarRutina />} />
        <Route path="/mas/alarmas" element={<AlarmasTelefono />} />
        <Route path="/mas/actualizar" element={<Actualizar />} />
        <Route path="/mas/copia" element={<Copia />} />
        <Route path="/mas/sincronizar" element={<Sincronizar />} />
        <Route path="/mas/ajustes" element={<Ajustes />} />
        <Route path="/mas/recomendar" element={<Recomendar />} />
        <Route path="/mas/creador" element={<RecomendacionesCreador hoy={hoy} />} />
        <Route path="/mas/tema" element={<TemaYNombres />} />
        <Route path="/mas/comida" element={<MasComida hoy={hoy} />} />
        <Route path="/comida" element={<Comida hoy={hoy} />} />
        <Route path="/sueno" element={<Sueno hoy={hoy} />} />
        <Route path="/mas/suenio" element={<Navigate to="/sueno" replace />} />
        <Route path="/mas/animaciones" element={<Suspense fallback={<Cargando />}><VerAnimaciones /></Suspense>} />
        <Route path="/mas/historial" element={<Historial />} />
        <Route path="/mas/avances" element={<Navigate to="/progreso" replace />} />
        <Route path="/mas/nuevo-ciclo" element={<Inicio hoy={hoy} nuevo />} />
        <Route path="/revision" element={<RevisionDiaria hoy={hoy} />} />
        <Route path="/revision/:fecha" element={<RevisionDiaria hoy={hoy} />} />
        <Route path="/semana" element={<RevisionSemanal hoy={hoy} />} />
        <Route path="/semana/:fecha" element={<RevisionSemanal hoy={hoy} />} />
        <Route path="/fase/:numero" element={<CierreFase hoy={hoy} />} />
      </Route>
      <Route path="/entreno" element={<Entreno hoy={hoy} />} />
      <Route path="/321" element={<Protocolo321 hoy={hoy} />} />
      <Route path="/siguiente" element={<SiguienteAccion hoy={hoy} />} />
      <Route path="/inicio" element={<Navigate to="/" replace />} />
      <Route path="/bienvenida" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
