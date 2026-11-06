/**
 * Que nunca se vea el ícono de play del navegador (Android/WebView) mientras un video carga.
 * Cada <video> sin portada queda invisible (CSS) hasta que de verdad reproduce: recién ahí se marca data-vivo.
 * Debajo, cada escena deja su portada (primer cuadro) o el último cuadro del clip anterior.
 */
export function videosSinPlay() {
  if (typeof document === 'undefined') return
  const marcar = (e: Event) => { const v = e.target; if (v instanceof HTMLVideoElement) v.dataset.vivo = '1' }
  const desmarcar = (e: Event) => { const v = e.target; if (v instanceof HTMLVideoElement) delete v.dataset.vivo }
  document.addEventListener('playing', marcar, true)
  document.addEventListener('emptied', desmarcar, true)
  document.addEventListener('error', (e) => { if (e.target instanceof HTMLVideoElement) desmarcar(e) }, true)
}
