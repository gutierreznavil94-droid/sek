/**
 * La piedra de la forja según el tema: Shinobi (y los temas con escenas) usa la piedra que se rompe;
 * los demás, el círculo simple de Común. SEK solo pasa los días válidos.
 */
import { ForjaComun } from './comun/ForjaComun'
import { PiedraShinobi } from './shinobi/Piedra'
import { useTema } from './temas'

export function PiedraHabito(p: { id: string; kanji: string; validos: number; necesarios: number; tam?: number; reducido?: boolean; conSonido?: boolean }) {
  const tema = useTema()
  return tema.escenas ? <PiedraShinobi {...p} /> : <ForjaComun {...p} />
}
