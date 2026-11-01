import { useEffect, useState } from 'react'
import { alCambiarInstalacion, enVisorEmbebido, estadoInstalacion, instalar } from '../instalar'
import { Link } from 'react-router-dom'
import { FECHA_VERSION, VERSION_APP } from '../../version'
import { enModoPrueba, entrarModoPrueba, salirModoPrueba } from '../../data/modoPrueba'
import { obtenerAjustes } from '../../services/base'
import { ahora } from '../../services/reloj'
import { Tarjeta } from '../componentes'
import { avisar, useDatos } from '../estado'

const SECCIONES = [
  { a: '/mas/identidad', t: 'Identidad', d: 'Visión y obstáculos' },
  { a: '/mas/atributos', t: 'Atributos', d: 'Las cinco áreas y su ventana de cálculo' },
  { a: '/mas/metas', t: 'Metas con fecha', d: 'Qué querés lograr y para cuándo; verde o rojo al llegar el día' },
  { a: '/mas/contadores', t: 'Contadores', d: 'Flexiones y dominadas: cantidad por toque, meta diaria y XP' },
  { a: '/mas/objetivos', t: 'Objetivos y fases', d: 'Qué buscás en cada etapa de 30 días' },
  { a: '/mas/acciones', t: 'Pilares y acciones', d: 'Nombre, hora límite, mínimo, atributo y XP de cada pilar y compromiso' },
  { a: '/mas/entrenamiento', t: 'Entrenamiento y descanso', d: 'Días y horas, hora de acostarse, objetivo de sueño' },
  { a: '/mas/suenio', t: 'Sueño y ritmo', d: 'Cuánto dormís, a qué hora te dormís y te levantás; la app lo aprende sola' },
  { a: '/mas/alarmas', t: 'Alarmas del teléfono', d: 'Qué cargar en el reloj de Android' },
  { a: '/mas/sincronizar', t: 'Sincronizar', d: 'Los mismos datos en el celu y en la compu' },
  { a: '/mas/copia', t: 'Copia de seguridad', d: 'Exportar e importar (JSON, CSV)' },
  { a: '/mas/historial', t: 'Historial de cambios', d: 'Todo lo que se registró o corrigió' },
  { a: '/mas/animaciones', t: 'Ver animaciones', d: 'El shinobi: vista previa, cuándo se muestran, sonido y nombre' },
  { a: '/mas/ajustes', t: 'Ajustes', d: 'Límite de juego, racha, niveles, zona horaria' },
  { a: '/mas/nuevo-ciclo', t: 'Fecha de inicio y nuevo ciclo', d: 'Cambiar el Día 1 o empezar otros 90 días conservando el historial' },
]

/** Borra la copia guardada de la app (no los datos) y vuelve a cargar la última versión publicada. */
async function actualizarApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    }
    if ('caches' in window) {
      for (const k of await caches.keys()) await caches.delete(k)
    }
  } catch {
    // Sin service worker: alcanza con recargar.
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}

export function Mas() {
  const ajustes = useDatos(() => obtenerAjustes(), [])
  const [instalacion, setInstalacion] = useState(estadoInstalacion())
  useEffect(() => alCambiarInstalacion(() => setInstalacion(estadoInstalacion())), [])
  const [verIphone, setVerIphone] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const dias = ajustes.datos?.ultimaExportacion ? Math.floor((ahora() - ajustes.datos.ultimaExportacion) / 86_400_000) : null
  const avisoCopia = ajustes.datos && (dias === null || dias >= ajustes.datos.diasAvisoCopia)
  return (
    <>
      <h1>Más</h1>
      {avisoCopia && (
        <Tarjeta compacta>
          <div className="fila entre">
            <span className="chico">{dias === null ? 'Todavía no hiciste ninguna copia de seguridad.' : `Última copia hace ${dias} días.`}</span>
            <Link to="/mas/copia" className="boton chico primario">Exportar</Link>
          </div>
        </Tarjeta>
      )}
      <Tarjeta>
        <div className="lista-nav">
          {SECCIONES.map((s) => (
            <Link key={s.a} to={s.a}>
              <span>{s.t}<span className="desc">{s.d}</span></span>
              <span className="flecha">›</span>
            </Link>
          ))}
        </div>
      </Tarjeta>
      {instalacion === 'disponible' && (
        <div className="fila entre chico" style={{ padding: '4px 0' }}>
          <span className="texto-2">Abrila como app, con su ícono y sin barra del navegador.</span>
          <button className="boton chico" onClick={() => instalar().then((r) => avisar(r === 'accepted' ? 'Instalada. Buscá «SEK» en tu pantalla de inicio.' : r === 'dismissed' ? 'No se instaló' : 'El navegador no ofreció instalarla', { tipo: r === 'accepted' ? 'ok' : 'normal' }))}>Instalar app</button>
        </div>
      )}
      {instalacion === 'iphone' && (
        <div className="fila entre chico" style={{ padding: '4px 0' }}>
          <span className="texto-2">{verIphone ? 'En Safari: Compartir (el cuadrado con la flecha) → «Agregar a inicio».' : 'Abrila como app desde la pantalla de inicio.'}</span>
          {!verIphone && <button className="boton chico" onClick={() => setVerIphone(true)}>Instalar app</button>}
        </div>
      )}
      {instalacion === 'no_disponible' && enVisorEmbebido() && <p className="ayuda centro">«Instalar app» va a estar disponible cuando la publiques en tu propia dirección (ver COMO-PUBLICAR).</p>}
      <p className="ayuda centro">Los datos viven solo en este teléfono. Si borrás los datos del navegador o desinstalás la app, se pierden: exportá una copia cada semana.</p>
      <div className="fila entre chico" style={{ padding: '4px 0' }}>
        <span className="texto-2">{enModoPrueba() ? 'Estás en modo prueba.' : 'Probar la app con datos de mentira.'}</span>
        {enModoPrueba() ? <button className="boton chico" onClick={salirModoPrueba}>Salir de la prueba</button> : <button className="boton chico" onClick={() => entrarModoPrueba()}>Modo prueba</button>}
      </div>
      <div className="fila entre chico" style={{ padding: '4px 0' }}>
        <span className="texto-3">Versión {VERSION_APP} · {FECHA_VERSION}</span>
        <button className="boton chico" disabled={actualizando} onClick={() => { setActualizando(true); avisar('Buscando la última versión…'); actualizarApp() }}>Actualizar app</button>
      </div>
      <p className="ayuda centro">Si el número de versión no coincide con el último que te pasé, tocá «Actualizar app». Tus datos no se tocan.</p>
    </>
  )
}
