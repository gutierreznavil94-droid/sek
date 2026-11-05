/**
 * Nombres de eventos visuales que Organización puede pedir. Son los mismos que los de Temas (`src/temas/eventos.ts`),
 * copiados acá para que Organización no dependa de ninguna carpeta de afuera.
 */
export type NombreEventoTema = 'completar' | 'aparecer' | 'logro' | 'recompensa' | 'alerta' | 'descanso' | 'dormir' | 'pelear' | 'robo'
export interface DetalleEventoTema { elemento?: Element | null; texto?: string }
