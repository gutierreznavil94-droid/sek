/**
 * Tumba rota del tema Shinobi (marca de una caída): lápida partida en tinta gris con una grieta roja fina.
 * No depende de SEK: solo el tamaño.
 */
export function TumbaRota({ ancho = 14, etiqueta }: { ancho?: number; etiqueta?: string }) {
  return (
    <svg viewBox="0 0 20 24" width={ancho} height={ancho * 1.2} className="tema-tumba-rota" role={etiqueta ? 'img' : undefined} aria-label={etiqueta} aria-hidden={etiqueta ? undefined : true}>
      {/* Mitad izquierda y mitad derecha, un poco separadas e inclinadas */}
      <path className="tema-tumba-piedra" d="M3 22 L3 9 C3 5 6 2.5 9.4 2.5 L10.6 8 L8.6 12.5 L10.4 16 L9 22 Z" />
      <path className="tema-tumba-piedra" d="M11 22 L12.4 16.4 L10.8 12.6 L12.8 8.2 L11.2 2.6 C14.4 3 17 5.6 17 9 L17 22 Z" transform="rotate(4 14 22)" />
      <path className="tema-tumba-grieta" d="M10.2 2.8 L11.6 8.1 L9.7 12.6 L11.4 16.2 L10 21.6" />
      <path className="tema-tumba-suelo" d="M1 22.5 L19 22.5" />
    </svg>
  )
}
