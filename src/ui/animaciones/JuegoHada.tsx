import { simbolo, urlTema, useTema } from '../../temas/temas'

/**
 * Juego en un tema subido: el personaje del tema (su imagen o 🧚) con el juego al lado.
 * Esperando: el control flota y lo llama. Jugando: rebota contenta con chispitas. En pausa: tecito.
 * Solo CSS; con «reducir movimiento» queda quieto.
 */
export function JuegoHada({ activa, pausada, reducido }: { activa: boolean; pausada: boolean; reducido: boolean }) {
  const tema = useTema()
  const img = tema.adornos?.imagenAnimaciones
  const estado = !activa ? 'espera' : pausada ? 'pausa' : 'jugando'
  const juego = simbolo('遊') === '遊' ? '🎮' : simbolo('遊')
  return (
    <div className={`jh-marco jh-${estado}${reducido ? ' quieto' : ''}`}>
      <div className="jh-escena" aria-hidden>
        {['✦', '♡', '✧', '♡', '✦'].map((c, i) => <span key={i} className={`jh-brillo b${i}`}>{c}</span>)}
        {img ? <img className="jh-personaje" src={urlTema(img)} alt="" draggable={false} /> : <span className="jh-personaje jh-emoji">🧚</span>}
        <span className="jh-objeto">{estado === 'pausa' ? '🍵' : juego}</span>
      </div>
      <span className="sl-casa-nota">{estado === 'espera' ? `${tema.personaje} te espera para jugar` : estado === 'jugando' ? `Jugando con ${tema.personaje}` : 'Pausa: tecito'}</span>
    </div>
  )
}
