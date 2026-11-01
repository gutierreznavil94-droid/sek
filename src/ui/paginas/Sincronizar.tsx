import { useState, useSyncExternalStore } from 'react'
import { enModoPrueba } from '../../data/modoPrueba'
import { alCambiarSync, crearCuenta, entrar, estadoSync, salir, sincronizar } from '../../sync/sincronizar'
import { Atras, Confirmar, Tarjeta } from '../componentes'
import { avisar } from '../estado'

export function useEstadoSync() {
  return useSyncExternalStore(alCambiarSync, estadoSync, estadoSync)
}

export function textoEstadoSync(e: ReturnType<typeof estadoSync>): string {
  if (!e.configurada) return 'Todavía no está configurada'
  if (!e.conectado) return 'Apagada: entrá con tu cuenta'
  if (e.fase === 'subiendo') return 'Subiendo cambios…'
  if (e.fase === 'bajando') return 'Bajando cambios…'
  if (e.fase === 'sin-conexion') return 'Sin conexión: se sube al volver'
  if (e.fase === 'error') return 'Error al sincronizar'
  const h = e.ultima ? new Date(e.ultima).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null
  return h ? `Al día · ${h}` : 'Conectada'
}

export function Sincronizar() {
  const e = useEstadoSync()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [confirmarEntrar, setConfirmarEntrar] = useState(false)

  const hacer = async (fn: () => Promise<void>, ok: string) => {
    setOcupado(true)
    setError('')
    try {
      await fn()
      avisar(ok, { tipo: 'ok' })
      setClave('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }
  const valido = email.includes('@') && clave.length >= 6

  return (
    <>
      <Atras />
      <h1>Sincronizar</h1>
      <p className="texto-2 chico">Tus datos iguales en el celu y en la compu, al momento. Entrá con la misma cuenta en los dos.</p>
      {enModoPrueba() && <p className="ayuda">En modo prueba no se sincroniza nada.</p>}
      {!e.configurada ? (
        <Tarjeta><p className="chico texto-2">La sincronización todavía no está configurada en esta versión.</p></Tarjeta>
      ) : e.conectado ? (
        <Tarjeta titulo="Conectada">
          <div className="fila entre chico"><span className="texto-2">Cuenta</span><b>{e.email}</b></div>
          <div className="fila entre chico"><span className="texto-2">Estado</span><b>{textoEstadoSync(e)}</b></div>
          {e.fase === 'error' && e.error && <p className="error">{e.error}</p>}
          <button className="boton ancho" disabled={ocupado} onClick={() => hacer(sincronizar, 'Sincronizado')}>Sincronizar ahora</button>
          <button className="boton ancho" disabled={ocupado} onClick={() => hacer(salir, 'Saliste de la cuenta en este dispositivo')}>Salir de la cuenta</button>
          <p className="ayuda">Cada cambio se sube solo a los pocos segundos. Si usás los dos dispositivos sin internet a la vez, queda el cambio más nuevo.</p>
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Tu cuenta">
          <div className="campo">
            <label htmlFor="sync-mail">Mail</label>
            <input id="sync-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="sync-clave">Contraseña (6 o más)</label>
            <input id="sync-clave" type="password" autoComplete="current-password" value={clave} onChange={(ev) => setClave(ev.target.value)} />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="boton primario ancho" disabled={!valido || ocupado} onClick={() => hacer(() => crearCuenta(email, clave), 'Cuenta creada: tus datos se suben a la nube')}>Crear cuenta (primera vez)</button>
          <button className="boton ancho" disabled={!valido || ocupado} onClick={() => setConfirmarEntrar(true)}>Entrar (ya tengo cuenta)</button>
          <p className="ayuda">Creá la cuenta en el dispositivo que tiene tus datos. En el otro tocá «Entrar»: se reemplaza lo que hay ahí por lo de la nube.</p>
        </Tarjeta>
      )}
      <Confirmar
        abierta={confirmarEntrar}
        titulo="¿Entrar en este dispositivo?"
        texto="Si tu cuenta ya tiene datos en la nube, reemplazan a los de este dispositivo."
        confirmar="Entrar"
        onConfirmar={() => { setConfirmarEntrar(false); void hacer(() => entrar(email, clave), 'Listo: este dispositivo quedó sincronizado') }}
        onCancelar={() => setConfirmarEntrar(false)}
      />
    </>
  )
}
