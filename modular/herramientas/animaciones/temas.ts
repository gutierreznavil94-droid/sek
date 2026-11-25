// Reemplazo de src/temas/temas.ts para las escenas: solo las rutas de los archivos del tema Shinobi.
export const urlTema = (ruta: string): string => ruta
export const rutaTema = (archivo: string): string => (archivo.startsWith('fondos/') ? `/m/temas/shinobi/${archivo}` : archivo)
