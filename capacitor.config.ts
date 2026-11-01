import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Empaquetado Android con Capacitor (etapa 1 de alarmas). La lógica de la app
 * no cambia: la misma compilación web (dist/) corre dentro de la app Android,
 * y los recordatorios usan notificaciones locales del teléfono.
 */
const config: CapacitorConfig = {
  appId: 'ar.progreso90.app',
  appName: 'SEK',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#4f8cff',
    },
  },
}

export default config
