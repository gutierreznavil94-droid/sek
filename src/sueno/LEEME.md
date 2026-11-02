# Sueño: fuentes de datos

La pantalla Sueño no lee la base directamente: pide las noches a `fuentes/index.ts` (`nochesEntre(desde, hasta)`), que junta todas las fuentes y, para cada dato (acostado, dormido, levantado), se queda con el de más prioridad:

**reloj > corregido a mano > estimado**

## Fuente actual: estimada (`fuentes/estimada.ts`)

- Acostado = «Dejo celu» (o la hora puesta a mano).
- Dormido = acostado + latencia (15 min por defecto, editable de 10 a 30; se muestra como rango ±5).
- Levantado = centro de la ventana habitual de 15 min (por ejemplo 05:00–05:15 → 05:07).
- La apertura del celu a la mañana solo cierra la noche; no cambia la hora de levantarse.
- Lo corregido a mano queda marcado `corregido`. Las noches anteriores a la v0.34 quedan como `estimado`.

## Cómo sumar un reloj inteligente

Escribir un archivo nuevo en `fuentes/` que cumpla `FuenteDeSuenio` (`tipos.ts`) y agregarlo a `FUENTES` en `fuentes/index.ts`. Cada dato que traiga va con `fuente: 'reloj'`. No hay que tocar pantallas.

### Android: Health Connect

Samsung Health, Xiaomi/Mi Fitness, Fitbit, Garmin, Oura y otros escriben el sueño en **Health Connect**. El proyecto Android ya existe (Capacitor, carpeta `android/`):

1. Agregar un plugin de Health Connect para Capacitor (por ejemplo `capacitor-health-connect` o uno propio con la API `androidx.health.connect`).
2. Pedir el permiso de lectura `android.permission.health.READ_SLEEP` en el `AndroidManifest.xml` y en tiempo de uso.
3. Leer `SleepSessionRecord` entre dos fechas: `startTime` → dormido, `endTime` → levantado, `stages` → etapas (`light` → ligero, `deep` → profundo, `rem` → rem, `awake` → despierto). Los tramos «despierto» en medio de la noche son despertares.
4. Asignar cada sesión a su noche con `nocheDeSuenio` (la misma regla de corte que usa la app).
5. Activar el interruptor «Reloj inteligente» en ajustes (hoy está en «próximamente») para que `disponible()` devuelva `true`.

### Web: importar un archivo del reloj

Para la versión web, una fuente que lea un CSV o JSON exportado por la app del reloj (Fitbit, Garmin Connect, Mi Fitness y Samsung Health exportan sueño). Columnas mínimas: inicio del sueño, fin del sueño; opcionales: etapas y despertares. Guardar lo importado en `RegistroSuenio` con `fuenteDormido: 'reloj'`, `fuenteLevantado: 'reloj'` y `etapas`.

## Etapas

`RegistroSuenio.etapas` y `NocheDeFuente.etapas` ya existen. El gráfico de la pantalla Sueño dibuja una barra por noche; cuando haya etapas, se pintan como tramos dentro de esa barra. Hoy no se muestran porque ninguna fuente las da.
