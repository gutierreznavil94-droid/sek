// Reemplazo de src/ui/componentes.tsx para las escenas: solo «reducir movimiento».
export function movimientoReducido(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}
