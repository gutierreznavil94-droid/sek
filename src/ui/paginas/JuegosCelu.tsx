/**
 * Juego → «Mis juegos del celu»: marcás qué apps son juegos y su tiempo se suma solo al de hoy
 * (sin contar dos veces lo que se pisa con el temporizador). Al 50 % avisa y al 100 % salta el Tajo. Solo APK.
 */
import { useEffect, useMemo, useState } from 'react'
import { appsDelCelu, esAndroid, estadoVigia, pedirPermisoVigia, type AppInstalada, type ConfigVigia } from '../../nativo/sek'
import { guardarAjustes, obtenerAjustes } from '../../services/base'
import { olvidarTramosCelu, sincronizarVigia } from '../../services/juegoCelu'
import { Tarjeta } from '../componentes'
import { avisar, mutar } from '../estado'

type Juego = { paquete: string; nombre: string }
const EJEMPLO: Juego[] = [{ paquete: 'ejemplo.clash', nombre: 'Clash Royale' }, { paquete: 'ejemplo.freefire', nombre: 'Free Fire' }]

export function JuegosCelu() {
  const android = esAndroid()
  const [juegos, setJuegos] = useState<Juego[] | null>(null)
  const [apps, setApps] = useState<AppInstalada[]>([])
  const [minutos, setMinutos] = useState<Record<string, number>>({})
  const [uso, setUso] = useState<boolean | null>(null)
  const [elegir, setElegir] = useState(false)
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    void obtenerAjustes().then((a) => setJuegos(a.vigia?.juegos ?? (android ? [] : EJEMPLO)))
    const refrescar = () => {
      void estadoVigia().then((e) => setUso(e?.uso ?? null))
      if (android) void appsDelCelu().then((r) => { setApps(r.apps); setMinutos(r.minutos) })
    }
    refrescar()
    const volver = () => { if (document.visibilityState === 'visible') refrescar() }
    document.addEventListener('visibilitychange', volver)
    return () => document.removeEventListener('visibilitychange', volver)
  }, [android])

  const guardar = async (nuevos: Juego[], texto?: string) => {
    setJuegos(nuevos)
    const a = await obtenerAjustes()
    const vigia: ConfigVigia = { ...(a.vigia ?? { activo: false, repetir: 10, apps: [] }), juegos: nuevos }
    await mutar(async () => {
      await guardarAjustes({ vigia }, 'Mis juegos del celu')
      olvidarTramosCelu()
    })
    await sincronizarVigia()
    if (texto) avisar(texto, { tipo: 'ok' })
  }

  const iconoDe = useMemo(() => new Map(apps.map((a) => [a.paquete, a.icono])), [apps])
  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return apps.filter((a) => !juegos?.some((x) => x.paquete === a.paquete) && (!q || a.nombre.toLowerCase().includes(q)))
  }, [apps, buscar, juegos])

  if (!juegos) return null
  return (
    <Tarjeta titulo="Mis juegos del celu">
      <p className="texto-2 chico">Marcá qué apps son juegos: su tiempo se suma solo al de hoy, junto con el temporizador. Te avisa antes de llegar y al pasarte del límite salta el Tajo encima del juego.</p>
      {!android && <p className="aviso-chico">Esto funciona solo en la app de Android (APK). Acá ves cómo queda.</p>}
      {android && uso === false && (
        <div className="fila entre chico">
          <span className="texto-2">Permiso para ver el tiempo de uso: <b>falta</b></span>
          <button className="boton chico primario" onClick={() => pedirPermisoVigia('uso')}>Dar permiso</button>
        </div>
      )}
      {juegos.length === 0 && <p className="texto-3 chico">Todavía no marcaste ningún juego.</p>}
      {juegos.map((j) => (
        <div key={j.paquete} className="vigia-app">
          {iconoDe.get(j.paquete) ? <img src={iconoDe.get(j.paquete)} alt="" /> : <span className="vigia-sin-icono" aria-hidden>🎮</span>}
          <span className="crece col" style={{ gap: 1 }}>
            <b>{j.nombre}</b>
            <span className="chico texto-3">{minutos[j.paquete] !== undefined ? `Hoy: ${minutos[j.paquete]} min` : 'Cuenta solo'}</span>
          </span>
          <button className="boton chico suave" disabled={!android} aria-label={`Quitar ${j.nombre}`} onClick={() => void guardar(juegos.filter((x) => x.paquete !== j.paquete))}>✕</button>
        </div>
      ))}
      <button className="boton ancho" disabled={!android} onClick={() => setElegir(!elegir)}>{elegir ? 'Listo' : '+ Marcar juego'}</button>
      {elegir && (
        <div className="col">
          <input className="vigia-buscar" type="search" placeholder="Buscar app…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div className="vigia-lista">
            {filtradas.map((a) => (
              <button key={a.paquete} className="vigia-app vigia-elegible" onClick={() => void guardar([...juegos, { paquete: a.paquete, nombre: a.nombre }], `${a.nombre} cuenta como juego.`)}>
                {a.icono ? <img src={a.icono} alt="" /> : <span className="vigia-sin-icono" aria-hidden>📱</span>}
                <span className="crece">{a.nombre}</span>
                {minutos[a.paquete] ? <span className="chico texto-3">{minutos[a.paquete]} min hoy</span> : null}
              </button>
            ))}
            {filtradas.length === 0 && <p className="texto-3 chico">No hay más apps.</p>}
          </div>
        </div>
      )}
      <p className="ayuda">Usa el mismo límite de juego de siempre (semana y finde). SEK solo ve cuántos minutos estuvo abierto el juego, no qué hacés adentro.</p>
    </Tarjeta>
  )
}
