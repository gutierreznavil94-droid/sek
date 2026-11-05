/**
 * Sugerir frente (opción B que eligió Navil): mira toda la frase, solo RESALTA un frente y muestra por qué palabras.
 * Nunca elige sola. Aprende cuando elegís otro. Se puede apagar en Clasificar.
 */
import type { DatosOrganizacion, Frente } from './tipos'

const VACIAS = new Set('las los que por para con del una uno unos unas sin hay mas como esta este esto ese esa todo toda pero cuando donde porque'.split(' '))

export function palabras(texto: string): string[] {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1 && !VACIAS.has(w))
}

export interface Sugerencia { f: Frente; por: string[] }

export function sugerir(d: DatosOrganizacion, texto: string): Sugerencia | null {
  if (!d.ajustes.sugerir) return null
  const w = [...new Set(palabras(texto))]
  let mejor: Frente | null = null
  let puntos = 0
  let por: string[] = []
  for (const f of d.frentes) {
    const clave = new Set(palabras(`${f.nombre} ${(f.palabras ?? []).join(' ')}`))
    const vistas = new Set(palabras(f.tareas.map((t) => t.texto).join(' ')).filter((x) => x.length > 3))
    const no = new Set(f.no ?? [])
    const todas = [...clave, ...vistas]
    let n = 0
    const r: string[] = []
    for (const x of w) {
      if (no.has(x)) { n -= 3; continue }
      if (clave.has(x)) { n += 3; r.push(x) }
      else if (vistas.has(x)) { n += 2; r.push(x) }
      else if (x.length > 4 && todas.some((v) => v.length > 4 && v.slice(0, 5) === x.slice(0, 5))) { n += 1; r.push(x) }
    }
    if (n > puntos) { puntos = n; mejor = f; por = r }
  }
  return mejor && puntos >= 3 ? { f: mejor, por } : null
}

/** Al clasificar: el frente elegido suma las palabras; si sugirió otro, ese aprende que no eran suyas. */
export function aprender(_d: DatosOrganizacion, texto: string, elegido: Frente, sugerida: Sugerencia | null): void {
  const w = palabras(texto).filter((x) => x.length > 2)
  if (sugerida && sugerida.f !== elegido) sugerida.f.no = [...new Set([...(sugerida.f.no ?? []), ...sugerida.por])].slice(-80)
  elegido.palabras = [...new Set([...(elegido.palabras ?? []), ...w])].slice(-120)
  if (elegido.no) elegido.no = elegido.no.filter((x) => !w.includes(x))
}
