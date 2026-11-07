/**
 * Lo que SEK le pasa a Organización: dónde guardar (la base local) y cómo se ve (el tema activo).
 * Organización no sabe nada de SEK; este archivo es el único puente.
 */
import { db } from '../data/db'
import type { Almacen, DatosOrganizacion, TemaOrganizacion } from '../organizacion'
import { colorTema, iconoTema, temaActivo } from '../temas/temas'
import { iconoSvg } from '../temas/iconos'
import { disparar } from '../temas/eventos'

const FILA = 'datos'

/** Guarda Organización en la tabla `organizacion` (viaja sola en la copia de seguridad y en Sincronizar). */
export const almacenSek: Almacen = {
  async leer() {
    return (await db().organizacion.get(FILA))?.datos ?? null
  },
  async guardar(datos: DatosOrganizacion) {
    const d = db()
    await d.organizacion.put({ id: FILA, datos: JSON.parse(JSON.stringify(datos)), actualizado: Date.now() })
  },
}

/** El tema activo de SEK, respondiendo por nombre genérico. */
export const temaSek: TemaOrganizacion = {
  color: (nombre) => colorTema(nombre),
  icono: (nombre) => {
    const t = temaActivo()
    // Los kanjis decorativos se apagan si el tema no los usa.
    if (!t.kanjis && (nombre.startsWith('kanji-') || nombre === 'icono-organizacion' || nombre === 'icono-hoy' || nombre === 'icono-bandeja' || nombre === 'icono-sueltas-fondo')) return ''
    return iconoSvg(nombre, t.id) || iconoTema(nombre)
  },
  evento: (nombre, detalle) => disparar(nombre, detalle),
}

