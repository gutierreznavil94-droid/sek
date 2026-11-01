# Videos de fondo de Progreso

Los tres videos están en `public/fondos/`:

| Archivo | Qué es | Cuándo sale |
|---|---|---|
| `lluvia.mp4` + `lluvia.jpg` | nubes y lluvia | Día 1, 3, 5… del ciclo |
| `rayos.mp4` + `rayos.jpg` | tormenta con relámpagos | Día 2, 4, 6… |

Van a la calidad de los originales: la misma resolución (720×1280; el de rayos venía a 540×960 y se agrandó con buen filtro) y casi sin compresión (unos 9 MB cada uno). El video de viento se quitó a pedido de Navil.

El `.jpg` es el cuadro fijo que se muestra con «reducir movimiento», ahorro de datos o batería baja sin cargar.

Todo se configura en un solo archivo: `src/fondos/videos.json` (nombre, archivo, tipo claro/oscuro, cuánto oscurece el vidrio, segundos con relámpago, orden del ciclo).

## Cambiar un video por la versión sin marca de agua

Los videos van **enteros**, sin recorte ni zoom (así lo prefirió Navil), y por ahora conservan la marca de agua de Luma AI.

**A mano (lo más simple):** reemplazá `public/fondos/lluvia.mp4` por el nuevo, con el mismo nombre, y publicá. Funciona igual. Solo puede notarse un pequeño salto cuando el video vuelve a empezar.

**Con el fundido del bucle:** pasale el video a Claude y corre una línea:

```
herramientas/preparar-video.sh nuevo.mp4 lluvia
```

Deja `lluvia.mp4` y `lluvia.jpg` listos: 720 px, bucle sin salto, liviano para el celular. Si alguna vez se quiere volver a tapar la marca recortando, existe `--tapar-marca`.

Si el video nuevo es de rayos y los relámpagos caen en otros segundos, hay que actualizar `destellos` en `videos.json`.

## Modo «según el clima» (preparado, apagado)

La opción aparece en Más → Ajustes → «Apariencia · video de fondo de Progreso» como «Según el clima (próximamente)», desactivada.

Ya está hecho:
- `videoSegunClima(codigo)` en `src/fondos/elegir.ts`: tormenta eléctrica (códigos 95–99) → rayos; lluvia o llovizna (51–67, 80–82) → lluvia; el resto → viento.
- `elegirVideo(modo, hoy, diaUno, codigoClima)` ya usa el clima si el modo está activado.
- En `videos.json`, `clima.servicio` tiene la dirección de Open-Meteo para Córdoba (gratis, sin clave) y `consultarCadaMinutos: 60`.

Falta, para activarlo:
1. Consultar el servicio al abrir Progreso (y como mucho una vez por hora), leer `current.weather_code` y guardarlo en el teléfono con la hora de la consulta.
2. Sin conexión o si falla: usar el último dato guardado si tiene menos de 3 horas; si no, el intercalado por día.
3. Poner `"activo": true` en `clima` dentro de `videos.json` (eso habilita la opción en Ajustes).
4. Sumar `api.open-meteo.com` a lo que la app tiene permitido consultar, si algún día se restringe.
