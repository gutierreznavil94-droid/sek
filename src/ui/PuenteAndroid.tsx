/**
 * Solo en la app Android: mantiene los widgets al día, aplica lo marcado desde el widget, atiende los accesos
 * directos («Dejo celu», «+1 vaso», «Batalla», «Revisión diaria») y revisa una vez por día si hay versión nueva.
 * En la web no hace nada.
 */
import { useEffect } from 'react'
import { fechaDe } from '../domain/fechas'
import { esAndroid, guardarDatosWidget, leerAccionesWidget, rutaDeAtajo } from '../nativo/sek'
import { buscarActualizacion, tocaRevisarHoy } from '../services/actualizacion'
import { tomarAgua } from '../services/agua'
import { obtenerAjustes } from '../services/base'
import { prepararBatalla } from '../services/batalla'
import { registrarDejoCelu } from '../services/dia'
import { ahora } from '../services/reloj'
import { entrarModoSuenio } from '../services/suenio'
import { aplicarAccionesWidget, datosWidget } from '../services/widgets'
import { animar } from './animaciones/motor'
import { pedirBatalla } from './Batalla'
import { avisar, mutar, useVersion } from './estado'
import { instalarActualizacion } from './actualizar'

async function hoyYZona() {
  const a = await obtenerAjustes()
  return { hoy: fechaDe(ahora(), a.zonaHoraria), zona: a.zonaHoraria }
}

async function atenderAtajo(ruta: string) {
  const { hoy } = await hoyYZona()
  if (ruta === 'vaso') {
    const r = await mutar(() => tomarAgua(hoy))
    window.location.hash = '#/'
    return avisar(`+1 vaso · ${(r.dia.ml / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} L de ${(r.dia.objetivo / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} L`, { tipo: 'ok' })
  }
  if (ruta === 'dejo-celu') {
    window.location.hash = '#/'
    try {
      const r = await mutar(async () => {
        const x = await registrarDejoCelu()
        if (x.cumplido) animar({ tipo: 'ejecucion', pilar: 'acostarse' })
        await entrarModoSuenio(x.noche, !x.cumplido)
        return x
      })
      return r
    } catch (e) {
      return avisar(e instanceof Error ? e.message : String(e), { tipo: 'bajo' })
    }
  }
  if (ruta === 'batalla') {
    window.location.hash = '#/'
    const r = await prepararBatalla(hoy)
    if (!r.batalla) return avisar(r.motivo)
    pedirBatalla(r.batalla)
    return
  }
  if (ruta === 'revision') { window.location.hash = '#/revision'; return }
}

async function alAbrir() {
  const { hoy, zona } = await hoyYZona()
  const acciones = await leerAccionesWidget()
  if (acciones.length) {
    const n = await mutar(() => aplicarAccionesWidget(acciones, hoy, (t) => fechaDe(t, zona)))
    if (n) avisar(n === 1 ? 'Se anotó lo que marcaste en el widget.' : `Se anotaron ${n} cosas del widget.`, { tipo: 'ok' })
  }
  const ruta = await rutaDeAtajo()
  if (ruta) await atenderAtajo(ruta)
}

async function revisarVersion() {
  const { hoy } = await hoyYZona()
  if (!tocaRevisarHoy(hoy)) return
  const nueva = await buscarActualizacion().catch(() => null)
  if (nueva) avisar(`Hay versión nueva (v${nueva.version})`, { duracionMs: 12_000, accion: { texto: 'Actualizar', fn: () => void instalarActualizacion(nueva) } })
}

export function PuenteAndroid({ listo }: { listo: boolean }) {
  const version = useVersion()
  const android = esAndroid()

  useEffect(() => {
    if (!android || !listo) return
    void alAbrir().catch(() => {})
    void revisarVersion()
    const alVolver = () => { if (document.visibilityState === 'visible') void alAbrir().catch(() => {}) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('sek-atajo', alVolver)
    return () => { document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('sek-atajo', alVolver) }
  }, [android, listo])

  // Los widgets se actualizan después de cada cambio (con una pausa chica para juntar varios).
  useEffect(() => {
    if (!android || !listo) return
    const id = window.setTimeout(() => { void hoyYZona().then(({ hoy }) => datosWidget(hoy)).then(guardarDatosWidget).catch(() => {}) }, 800)
    return () => window.clearTimeout(id)
  }, [android, listo, version])

  return null
}
