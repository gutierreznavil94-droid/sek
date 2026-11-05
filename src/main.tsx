import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './ui/App'
import './ui/estilos.css'
import { aplicarMovimiento } from './ui/componentes'
import { iniciarSincronizacion } from './sync/sincronizar'
import { esAndroid } from './nativo/sek'

aplicarMovimiento()
void iniciarSincronizacion()

// Busca una versión nueva al abrir, al volver a primer plano y cada hora.
// Con «autoUpdate», cuando la hay se instala y la página se recarga sola.
// En la app Android no: ahí la versión viene adentro del APK (y se actualiza con «Buscar actualización»).
if (!esAndroid()) registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (!registro) return
    const buscar = () => registro.update().catch(() => {})
    setInterval(buscar, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') buscar()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
