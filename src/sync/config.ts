/**
 * Datos públicos del proyecto de Supabase de SEK (Project Settings → API).
 * La clave «publishable/anon» es pública a propósito: la seguridad la dan las
 * reglas de la tabla (cada usuario solo ve su propia fila). Nunca pongas acá
 * la clave «service_role» ni la contraseña de la base.
 * Si están vacíos, la sincronización queda apagada y la app anda igual que antes.
 */
export const SUPABASE_URL = ''
export const SUPABASE_CLAVE_PUBLICA = ''

export const SINCRONIZACION_CONFIGURADA = SUPABASE_URL !== '' && SUPABASE_CLAVE_PUBLICA !== ''
