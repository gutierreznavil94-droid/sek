import { useState } from 'react'
import { esAndroid } from '../../nativo/sek'
import { buscarActualizacion, LINK_APK, type Novedad } from '../../services/actualizacion'
import { VERSION_APP } from '../../version'
import { instalarActualizacion } from '../actualizar'
import { Atras, Tarjeta } from '../componentes'

/** Más → Buscar actualización: compara con el último Release de GitHub y, si hay una nueva, la instala encima. */
export function Actualizar() {
  const android = esAndroid()
  const [estado, setEstado] = useState<'nada' | 'buscando' | 'al-dia' | 'nueva' | 'error'>('nada')
  const [nueva, setNueva] = useState<Novedad | null>(null)
  const [error, setError] = useState('')
  const [bajando, setBajando] = useState(false)

  const buscar = async () => {
    setEstado('buscando')
    try {
      const n = await buscarActualizacion()
      setNueva(n)
      setEstado(n ? 'nueva' : 'al-dia')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEstado('error')
    }
  }
  const instalar = async () => {
    if (!nueva) return
    setBajando(true)
    await instalarActualizacion(nueva)
    setBajando(false)
  }

  return (
    <>
      <Atras />
      <h1>Buscar actualización</h1>
      <Tarjeta>
        <div className="fila entre">
          <span>Tenés la <b>v{VERSION_APP}</b></span>
          <button className="boton primario" disabled={estado === 'buscando'} onClick={buscar}>{estado === 'buscando' ? 'Buscando…' : 'Buscar actualización'}</button>
        </div>
        {estado === 'al-dia' && <p className="chico texto-2">Estás al día. No hay versión nueva.</p>}
        {estado === 'error' && <p className="chico texto-2">No se pudo revisar ({error}). Fijate que haya internet.</p>}
        {estado === 'nueva' && nueva && (
          <div className="actualizar-nueva">
            <p><b>Hay versión nueva (v{nueva.version})</b></p>
            {nueva.notas && <p className="chico texto-2" style={{ whiteSpace: 'pre-line' }}>{nueva.notas}</p>}
            {android ? (
              <button className="boton primario" disabled={bajando} onClick={instalar}>{bajando ? 'Bajando…' : 'Bajar e instalar'}</button>
            ) : (
              <a className="boton primario" href={LINK_APK}>Bajar el APK</a>
            )}
          </div>
        )}
      </Tarjeta>
      <p className="ayuda">
        {android
          ? 'Se instala encima: tus datos quedan. La primera vez Android pide permiso para «instalar apps desconocidas»: activalo para SEK y volvé. Al abrir la app se revisa sola una vez por día.'
          : 'La versión web se actualiza sola. Para la app de Android, bajá el APK desde el botón de arriba.'}
      </p>
    </>
  )
}
