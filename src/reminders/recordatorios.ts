/**
 * Recordatorios detrás de una interfaz propia, con dos implementaciones:
 *
 * - Web (navegador o link de prueba): avisa solo mientras la app está abierta
 *   o recién minimizada, con la API de notificaciones si hay permiso y con un
 *   aviso en pantalla siempre. No puede sonar a hora fija con la app cerrada.
 * - Nativa (app Android con Capacitor): programa notificaciones locales en el
 *   teléfono, que suenan aunque la app esté cerrada. Pide los permisos de
 *   Android 13+ (notificaciones) y de alarmas exactas.
 *
 * El resto de la app no sabe cuál está activa: usa `recordatorios`.
 */

export type Recordatorio = {
  id: string
  titulo: string
  cuerpo: string
  /** Instante en que debe sonar. */
  instante: number
}

export type Capacidades = {
  conAppCerrada: boolean
  descripcion: string
  /** 'web' o 'android'. */
  plataforma: 'web' | 'android'
}

export interface Recordatorios {
  /** Describe qué puede y qué no puede hacer esta implementación. */
  capacidades(): Capacidades
  pedirPermiso(): Promise<boolean>
  /** Estado del permiso: 'granted', 'denied', 'prompt' o 'no disponible'. */
  estadoPermiso(): Promise<string>
  programar(r: Recordatorio): Promise<void>
  cancelar(id: string): Promise<void>
  cancelarTodos(): Promise<void>
  /** Ids programados ahora mismo (para mostrar en «Alarmas del teléfono»). */
  programados(): Promise<Recordatorio[]>
  /** La interfaz se suscribe para mostrar el aviso en pantalla. */
  alDisparar(o: Oyente): () => void
}

type Oyente = (r: Recordatorio) => void

class RecordatoriosWeb implements Recordatorios {
  private temporizadores = new Map<string, { id: number; r: Recordatorio }>()
  private oyentes = new Set<Oyente>()

  capacidades(): Capacidades {
    return {
      conAppCerrada: false,
      plataforma: 'web',
      descripcion: 'En la versión web los avisos suenan solo con la app abierta o recién minimizada. Para alarmas con la app cerrada, usá el reloj del teléfono (ver Alarmas del teléfono) o la app Android.',
    }
  }

  async estadoPermiso(): Promise<string> {
    return typeof Notification !== 'undefined' ? Notification.permission : 'no disponible'
  }

  async pedirPermiso(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    try {
      return (await Notification.requestPermission()) === 'granted'
    } catch {
      return false
    }
  }

  async programar(r: Recordatorio): Promise<void> {
    await this.cancelar(r.id)
    const espera = r.instante - Date.now()
    // setTimeout no admite más de ~24,8 días; de todos modos la web no garantiza nada tan lejos.
    if (espera > 2_000_000_000) return
    const id = window.setTimeout(() => {
      this.temporizadores.delete(r.id)
      this.disparar(r)
    }, Math.max(0, espera))
    this.temporizadores.set(r.id, { id, r })
  }

  async cancelar(id: string): Promise<void> {
    const t = this.temporizadores.get(id)
    if (t !== undefined) {
      clearTimeout(t.id)
      this.temporizadores.delete(id)
    }
  }

  async cancelarTodos(): Promise<void> {
    for (const t of this.temporizadores.values()) clearTimeout(t.id)
    this.temporizadores.clear()
  }

  async programados(): Promise<Recordatorio[]> {
    return [...this.temporizadores.values()].map((t) => t.r).sort((a, b) => a.instante - b.instante)
  }

  alDisparar(o: Oyente): () => void {
    this.oyentes.add(o)
    return () => this.oyentes.delete(o)
  }

  private disparar(r: Recordatorio) {
    for (const o of this.oyentes) o(r)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(r.titulo, { body: r.cuerpo, tag: r.id })
      } catch {
        // Algunos Android solo permiten notificaciones desde el service worker.
        navigator.serviceWorker?.ready.then((reg) => reg.showNotification(r.titulo, { body: r.cuerpo, tag: r.id })).catch(() => {})
      }
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200])
      } catch {
        // sin vibración
      }
    }
  }
}

/** Número entero estable para un id de texto (Capacitor exige ids numéricos). */
export function idNumerico(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 2_000_000_000 || 1
}

type ModuloNotificaciones = typeof import('@capacitor/local-notifications')

/** App Android: notificaciones locales programadas en el dispositivo. */
class RecordatoriosNativo implements Recordatorios {
  private oyentes = new Set<Oyente>()
  private modulo: Promise<ModuloNotificaciones> | null = null
  private escuchando = false
  /** Copia local de lo programado, con el id de texto (el plugin solo guarda el numérico). */
  private lista = new Map<string, Recordatorio>()

  private async plugin() {
    if (!this.modulo) this.modulo = import('@capacitor/local-notifications')
    const { LocalNotifications } = await this.modulo
    if (!this.escuchando) {
      this.escuchando = true
      LocalNotifications.addListener('localNotificationReceived', (n) => {
        const r = this.lista.get(String(n.extra?.id ?? '')) ?? { id: String(n.id), titulo: n.title ?? '', cuerpo: n.body ?? '', instante: Date.now() }
        for (const o of this.oyentes) o(r)
      }).catch(() => {})
    }
    return LocalNotifications
  }

  capacidades(): Capacidades {
    return {
      conAppCerrada: true,
      plataforma: 'android',
      descripcion: 'En la app Android las alarmas se programan en el teléfono y suenan aunque la app esté cerrada. Hace falta dar permiso de notificaciones y, en Android 12 o superior, el de alarmas exactas. Probalo en tu teléfono con la pantalla apagada antes de confiar en ellas.',
    }
  }

  async estadoPermiso(): Promise<string> {
    try {
      const p = await (await this.plugin()).checkPermissions()
      return p.display
    } catch {
      return 'no disponible'
    }
  }

  async pedirPermiso(): Promise<boolean> {
    try {
      const ln = await this.plugin()
      const p = await ln.requestPermissions()
      if (p.display !== 'granted') return false
      // Android 12+: alarmas exactas. Si no está concedido, abre el ajuste del sistema.
      try {
        const e = await ln.checkExactNotificationSetting()
        if (e.exact_alarm !== 'granted') await ln.changeExactNotificationSetting()
      } catch {
        // Versiones viejas de Android: no hace falta.
      }
      return true
    } catch {
      return false
    }
  }

  async programar(r: Recordatorio): Promise<void> {
    const ln = await this.plugin()
    await this.cancelar(r.id)
    if (r.instante <= Date.now()) return
    await ln.schedule({
      notifications: [{
        id: idNumerico(r.id),
        title: r.titulo,
        body: r.cuerpo,
        schedule: { at: new Date(r.instante), allowWhileIdle: true },
        extra: { id: r.id },
        sound: 'default',
      }],
    })
    this.lista.set(r.id, r)
  }

  async cancelar(id: string): Promise<void> {
    const ln = await this.plugin()
    await ln.cancel({ notifications: [{ id: idNumerico(id) }] }).catch(() => {})
    this.lista.delete(id)
  }

  async cancelarTodos(): Promise<void> {
    const ln = await this.plugin()
    const p = await ln.getPending()
    if (p.notifications.length) await ln.cancel({ notifications: p.notifications.map((n) => ({ id: n.id })) })
    this.lista.clear()
  }

  async programados(): Promise<Recordatorio[]> {
    const ln = await this.plugin()
    const p = await ln.getPending()
    return p.notifications
      .map((n) => this.lista.get(String(n.extra?.id ?? '')) ?? { id: String(n.id), titulo: n.title ?? '', cuerpo: n.body ?? '', instante: n.schedule?.at ? new Date(n.schedule.at).getTime() : 0 })
      .sort((a, b) => a.instante - b.instante)
  }

  alDisparar(o: Oyente): () => void {
    this.oyentes.add(o)
    return () => this.oyentes.delete(o)
  }
}

function esNativo(): boolean {
  const w = globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }
  try {
    return !!w.Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

export const recordatorios: Recordatorios = esNativo() ? new RecordatoriosNativo() : new RecordatoriosWeb()
