/**
 * Más → «Apps que te atrapan»: elegís apps y minutos por día. Al pasarte con la app abierta,
 * SEK se abre encima con la escena de Tensión (la mano) y te dice cuánto llevás. Solo en la app de Android.
 */
import { useEffect, useMemo, useState } from 'react'
import { appsDelCelu, esAndroid, estadoVigia, pedirPermisoVigia, type AppInstalada, type ConfigVigia } from '../../nativo/sek'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { sincronizarVigia } from '../../services/juegoCelu'
import { Atras, Tarjeta } from '../componentes'
import { avisar } from '../estado'

const VACIA: ConfigVigia = { activo: false, repetir: 10, apps: [] }
const MINUTOS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180]
const EJEMPLO: AppInstalada[] = [
  { paquete: 'ejemplo.tiktok', nombre: 'TikTok', icono: '' },
  { paquete: 'ejemplo.instagram', nombre: 'Instagram', icono: '' },
  { paquete: 'ejemplo.youtube', nombre: 'YouTube', icono: '' },
]

export function AppsQueAtrapan() {
  const android = esAndroid()
  const [c, setC] = useState<ConfigVigia | null>(null)
  const [estado, setEstado] = useState<{ uso: boolean; encima: boolean; activo: boolean } | null>(null)
  const [apps, setApps] = useState<AppInstalada[]>([])
  const [minutos, setMinutos] = useState<Record<string, number>>({})
  const [buscar, setBuscar] = useState('')
  const [elegir, setElegir] = useState(false)

  useEffect(() => {
    void obtenerAjustes().then((a) => setC(a.vigia ?? (android ? VACIA : { ...VACIA, apps: [{ paquete: 'ejemplo.tiktok', nombre: 'TikTok', minutos: 30 }, { paquete: 'ejemplo.instagram', nombre: 'Instagram', minutos: 20 }] })))
    const refrescar = () => {
      void estadoVigia().then(setEstado)
      void appsDelCelu().then((r) => { setApps(android ? r.apps : EJEMPLO); setMinutos(r.minutos) })
    }
    refrescar()
    // Al volver de los ajustes de Android, se revisan los permisos.
    const volver = () => { if (document.visibilityState === 'visible') refrescar() }
    document.addEventListener('visibilitychange', volver)
    return () => document.removeEventListener('visibilitychange', volver)
  }, [android])

  const guardar = async (nueva: ConfigVigia, texto?: string) => {
    setC(nueva)
    // Se conservan los juegos marcados en Juego → «Mis juegos del celu».
    const juegos = (await obtenerAjustes()).vigia?.juegos
    await guardarAjustes({ vigia: { ...nueva, juegos } }, 'Apps que te atrapan')
    await sincronizarVigia()
    setEstado(await estadoVigia())
    if (texto) avisar(texto, { tipo: 'ok' })
  }

  const iconoDe = useMemo(() => new Map(apps.map((a) => [a.paquete, a.icono])), [apps])
  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return apps.filter((a) => !c?.apps.some((x) => x.paquete === a.paquete) && (!q || a.nombre.toLowerCase().includes(q)))
  }, [apps, buscar, c])

  if (!c) return null
  const permisosOk = !!estado?.uso && !!estado?.encima

  return (
    <>
      <Atras />
      <h1>Apps que te atrapan</h1>
      <p className="texto-2">Elegí las apps donde se te va el tiempo y cuántos minutos por día te das. Cuando te pasás, SEK rompe la pantalla con la mano de Tensión y te llama.</p>

      {!android && <p className="aviso-chico">Esto funciona solo en la app de Android (APK). Acá ves cómo queda.</p>}

      {android && !permisosOk && (
        <Tarjeta titulo="Dos permisos de Android">
          <div className="fila entre chico">
            <span className="texto-2">Ver el tiempo de uso de las apps: <b>{estado?.uso ? 'listo ✓' : 'falta'}</b></span>
            {!estado?.uso && <button className="boton chico primario" onClick={() => pedirPermisoVigia('uso')}>Dar permiso</button>}
          </div>
          <div className="fila entre chico">
            <span className="texto-2">Aparecer encima de otras apps: <b>{estado?.encima ? 'listo ✓' : 'falta'}</b></span>
            {!estado?.encima && <button className="boton chico primario" onClick={() => pedirPermisoVigia('encima')}>Dar permiso</button>}
          </div>
          <p className="ayuda">Android abre el ajuste: buscá SEK, activalo y volvé. Sin «aparecer encima» llega como aviso fuerte en vez de abrirse sola. SEK no ve qué hacés dentro de las apps: solo cuántos minutos estuvieron abiertas.</p>
        </Tarjeta>
      )}

      <Tarjeta titulo="Mis apps">
        <label className="fila entre">
          <span><b>Activado</b><br /><span className="chico texto-3">{c.activo ? (estado?.activo || !android ? 'SEK está mirando' : 'Faltan permisos o apps') : 'Apagado'}</span></span>
          <input type="checkbox" className="interruptor" checked={c.activo} disabled={!android} onChange={(e) => void guardar({ ...c, activo: e.target.checked }, e.target.checked ? 'Listo: SEK te va a llamar cuando te pases.' : 'Apagado.')} />
        </label>
        {c.apps.length === 0 && <p className="texto-3 chico">Todavía no elegiste ninguna app.</p>}
        {c.apps.map((a) => (
          <div key={a.paquete} className="vigia-app">
            {iconoDe.get(a.paquete) ? <img src={iconoDe.get(a.paquete)} alt="" /> : <span className="vigia-sin-icono" aria-hidden>📱</span>}
            <span className="crece col" style={{ gap: 1 }}>
              <b>{a.nombre}</b>
              <span className="chico texto-3">{minutos[a.paquete] !== undefined ? `Hoy: ${minutos[a.paquete]} min` : 'Te llama al pasarte'}</span>
            </span>
            <select value={a.minutos} disabled={!android} aria-label={`Minutos por día en ${a.nombre}`} onChange={(e) => void guardar({ ...c, apps: c.apps.map((x) => x.paquete === a.paquete ? { ...x, minutos: Number(e.target.value) } : x) })}>
              {MINUTOS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ' y media')}</option>)}
            </select>
            <button className="boton chico suave" disabled={!android} aria-label={`Quitar ${a.nombre}`} onClick={() => void guardar({ ...c, apps: c.apps.filter((x) => x.paquete !== a.paquete) })}>✕</button>
          </div>
        ))}
        <button className="boton ancho" disabled={!android} onClick={() => setElegir(!elegir)}>{elegir ? 'Listo' : '+ Elegir app'}</button>
        {elegir && (
          <div className="col">
            <input className="vigia-buscar" type="search" placeholder="Buscar app…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <div className="vigia-lista">
              {filtradas.map((a) => (
                <button key={a.paquete} className="vigia-app vigia-elegible" onClick={() => void guardar({ ...c, activo: true, apps: [...c.apps, { paquete: a.paquete, nombre: a.nombre, minutos: 30 }] }, `${a.nombre}: 30 min por día.`)}>
                  {a.icono ? <img src={a.icono} alt="" /> : <span className="vigia-sin-icono" aria-hidden>📱</span>}
                  <span className="crece">{a.nombre}</span>
                  {minutos[a.paquete] ? <span className="chico texto-3">{minutos[a.paquete]} min hoy</span> : null}
                </button>
              ))}
              {filtradas.length === 0 && <p className="texto-3 chico">No hay más apps.</p>}
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Si seguís">
        <label className="fila entre chico">
          <span className="texto-2">Te vuelve a llamar cada</span>
          <select value={c.repetir} disabled={!android} onChange={(e) => void guardar({ ...c, repetir: Number(e.target.value) })}>
            {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
        <p className="ayuda">Los minutos se cuentan por día, desde la medianoche. Solo te llama con la app abierta adelante.</p>
      </Tarjeta>
    </>
  )
}
