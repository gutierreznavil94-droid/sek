import { useEffect, useState } from 'react'
import { alCambiarInstalacion, enVisorEmbebido, estadoInstalacion, instalar } from '../instalar'
import { Link } from 'react-router-dom'
import { FECHA_VERSION, VERSION_APP } from '../../version'
import { enModoPrueba, entrarModoPrueba, salirModoPrueba } from '../../data/modoPrueba'
import { obtenerAjustes } from '../../services/base'
import { ahora } from '../../services/reloj'
import { SINCRONIZACION_CONFIGURADA } from '../../sync/config'
import { Tarjeta } from '../componentes'
import { avisar, useDatos } from '../estado'
import { configRecomendaciones } from '../../services/recomendaciones'
import { iconoTema } from '../../temas/temas'

type Seccion = { a: string; t: string; d: string; claves: string; icono?: string }

/** Lo de la app en sí: primera fila, cada uno con su botón. */
const SISTEMA: Seccion[] = [
  { a: '/mas/copia', t: 'Copia', d: 'Exportar e importar', icono: 'icono-copia', claves: 'copia seguridad backup exportar importar json csv texto guardar datos' },
  { a: '/mas/animaciones', t: 'Animaciones', d: 'Ver y elegir', icono: 'icono-animaciones', claves: 'animaciones shinobi pajaro torpe rival batalla sonido video' },
  { a: '/mas/tema', t: 'Tema', d: 'Tema y nombres', icono: 'icono-tema', claves: 'tema nombres nombre app fases color' },
  { a: '/mas/ajustes', t: 'Ajustes', d: 'Juego, racha, lluvia', icono: 'icono-ajustes', claves: 'ajustes configuracion limite juego racha niveles zona horaria lluvia fondo movimiento' },
  { a: '/mas/historial', t: 'Historial', d: 'Lo que cambió', icono: 'icono-historial', claves: 'historial cambios registro corregir' },
  { a: '/mas/sincronizar', t: 'Sincronizar', d: 'Celu y compu', icono: 'icono-sincronizar', claves: 'sincronizar compu celu nube' },
  { a: '/mas/actualizar', t: 'Buscar actualización', d: 'Versión nueva', icono: 'icono-actualizar', claves: 'buscar actualizacion actualizar version nueva apk instalar descargar' },
  { a: '/mas/nuevo-ciclo', t: 'Nuevo ciclo', d: 'Día 1 y otros 90', icono: 'icono-ciclo', claves: 'fecha inicio nuevo ciclo dia 1 empezar 90 dias reiniciar' },
]

/** El resto, en tres grupos cortos (la explicación larga va adentro de cada pantalla). */
const GRUPOS: { titulo: string; items: Seccion[] }[] = [
  { titulo: 'Yo', items: [
    { a: '/mas/identidad', t: 'Identidad', d: 'Visión y obstáculos', claves: 'identidad vision obstaculos quien soy' },
    { a: '/mas/atributos', t: 'Atributos', d: 'Tus cinco áreas', claves: 'atributos areas stats fuerza' },
    { a: '/mas/metas', t: 'Metas con fecha', d: 'Qué querés lograr y cuándo', claves: 'metas fecha objetivo lograr verde rojo' },
    { a: '/mas/objetivos', t: 'Objetivos y fases', d: 'Qué buscás en cada etapa', claves: 'objetivos fases etapas 30 dias disciplina constancia' },
  ] },
  { titulo: 'Día a día', items: [
    { a: '/mas/acciones', t: 'Pilares y acciones', d: 'Hora límite, mínimo y XP', claves: 'pilares acciones compromisos hora limite xp minimo' },
    { a: '/mas/creador', t: 'Recomendaciones del creador', d: 'Los pilares del creador', claves: 'recomendaciones creador pilares sugeridos' },
    { a: '/mas/comida', t: 'Comida', d: 'Calorías, proteína y agua', claves: 'comida calorias proteina peso agua botella dieta plan' },
    { a: '/mas/contadores', t: 'Contadores', d: 'Flexiones y dominadas', claves: 'contadores flexiones dominadas series cuota extra' },
  ] },
  { titulo: 'Entreno y descanso', items: [
    { a: '/mas/rutinas', t: 'Mis rutinas', d: 'Rutinas, ejercicios y días', claves: 'rutinas ejercicios entreno gimnasio colgarse barra historial series' },
    { a: '/mas/entrenamiento', t: 'Entrenamiento y descanso', d: 'Días, horas y sueño', claves: 'entrenamiento descanso dormir sueno acostarse hora dias' },
    { a: '/mas/alarmas', t: 'Alarmas del teléfono', d: 'Qué cargar en el reloj', claves: 'alarmas telefono reloj android despertador' },
  ] },
]

/** Para buscar: sin tildes ni mayúsculas. */
export function normalizar(x: string): string {
  return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** ¿La sección coincide con lo buscado? (todas las palabras, en nombre, descripción o palabras clave). */
export function coincide(s: Pick<Seccion, 't' | 'd' | 'claves'>, busqueda: string): boolean {
  const q = normalizar(busqueda)
  if (!q) return true
  const texto = normalizar(`${s.t} ${s.d} ${s.claves}`)
  return q.split(/\s+/).every((p) => texto.includes(p))
}


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
  const recomendar = useDatos(() => configRecomendaciones(), [])
  const [instalacion, setInstalacion] = useState(estadoInstalacion())
  useEffect(() => alCambiarInstalacion(() => setInstalacion(estadoInstalacion())), [])
  const [verIphone, setVerIphone] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const dias = ajustes.datos?.ultimaExportacion ? Math.floor((ahora() - ajustes.datos.ultimaExportacion) / 86_400_000) : null
  const avisoCopia = ajustes.datos && (dias === null || dias >= ajustes.datos.diasAvisoCopia)
  const [busqueda, setBusqueda] = useState('')
  const sistema = SISTEMA.filter((s) => (SINCRONIZACION_CONFIGURADA || s.a !== '/mas/sincronizar') && coincide(s, busqueda))
  const grupos = GRUPOS.map((g) => ({ ...g, items: g.items.filter((s) => coincide(s, busqueda)) })).filter((g) => g.items.length > 0)
  const nada = sistema.length === 0 && grupos.length === 0
  return (
    <>
      <h1>Más</h1>
      <label className="mas-buscar">
        <span className="mas-lupa" aria-hidden>{iconoTema('icono-buscar') || '⌕'}</span>
        <input type="search" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar en Más" />
        {busqueda && <button type="button" className="mas-borrar" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">×</button>}
      </label>
      {avisoCopia && !busqueda && (
        <Tarjeta compacta>
          <div className="fila entre">
            <span className="chico">{dias === null ? 'Todavía no hiciste ninguna copia de seguridad.' : `Última copia hace ${dias} días.`}</span>
            <Link to="/mas/copia" className="boton chico primario">Exportar</Link>
          </div>
        </Tarjeta>
      )}
      {sistema.length > 0 && (
        <nav className="mas-sistema" aria-label="La app">
          {sistema.map((s) => (
            <Link key={s.a} to={s.a} className={`mas-sis ${s.a === '/mas/copia' && avisoCopia ? 'pendiente' : ''}`}>
              <span className="mas-sis-icono" aria-hidden>{iconoTema(s.icono ?? '')}</span>
              <span className="mas-sis-nombre">{s.t}</span>
              <span className="mas-sis-desc">{s.d}</span>
            </Link>
          ))}
        </nav>
      )}
      {grupos.map((g) => (
        <Tarjeta key={g.titulo} titulo={g.titulo} compacta>
          <div className="lista-nav">
            {g.items.map((s) => (
              <Link key={s.a} to={s.a}>
                <span>{s.t}<span className="desc">{s.d}</span></span>
                <span className="flecha">›</span>
              </Link>
            ))}
          </div>
        </Tarjeta>
      ))}
      {nada && (
        <div className="mas-nada">
          <p className="texto-2 centro">Nada con eso.</p>
          {recomendar.datos && <Link to="/mas/recomendar" className="boton ancho">Recomendar algo</Link>}
        </div>
      )}
      {recomendar.datos && !nada && !busqueda && (
        <Link to="/mas/recomendar" className="boton ancho rec-boton"><span className="rec-kanji chico" aria-hidden>願</span><span>Recomendar algo<span className="desc">Contale qué mejorarías</span></span><span className="flecha">›</span></Link>
      )}
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
      <div className="mas-pie chico">
        <span className="texto-3">v{VERSION_APP} · {FECHA_VERSION}</span>
        <button className="boton chico" disabled={actualizando} onClick={() => { setActualizando(true); avisar('Buscando la última versión…'); actualizarApp() }}>Actualizar app</button>
        {enModoPrueba() ? <button className="boton chico" onClick={salirModoPrueba}>Salir de la prueba</button> : <button className="boton chico" onClick={() => entrarModoPrueba()}>Modo prueba</button>}
      </div>
    </>
  )
}
