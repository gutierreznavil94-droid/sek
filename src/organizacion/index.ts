/**
 * Organización (notas y tareas por «frentes»). Punto de entrada único.
 * Sin React y sin nada de SEK: SEK lo monta en una pantalla; más adelante, Tumi también.
 * Ver CONTRATO.md.
 */
export { montarOrganizacion, montarTiraHoy, type OpcionesOrganizacion, type OpcionesTira, type Montado } from './vista'
export { almacenEnMemoria, type Almacen } from './almacen'
export type { TemaOrganizacion } from './tema'
export type { DatosOrganizacion, Frente, Tarea, ItemBandeja, Aviso } from './tipos'
export { normalizar, meToca, resumen, diaLocal } from './modelo'
export const VERSION_ORGANIZACION = '0.1.0'
