# Cómo se arma un tema

Un tema es la cara de la app: personaje, fondos, sprite del entreno, color de acento y kanjis. Los datos y el motor (XP, niveles, calendario, series, sueño) son los mismos para todos los temas. Cambiar de tema en **Más → Tema y nombres** no toca ningún dato.

## Sumar un tema nuevo (sin tocar código)

1. **Videos y sprite** en `public/temas/<id>/`:
   - `lluvia.mp4` + `lluvia.jpg` y `rayos.mp4` + `rayos.jpg` (verticales, 720×1280; se intercalan por día en Progreso),
   - `pc.mp4` + `pc.jpg` (horizontal, para la computadora),
   - `camina.webp`: hoja de sprites del personaje que camina en la barra del entreno (misma grilla que `public/shinobi/camina.webp`: 16 columnas × 13 filas de 96×70 px).
   - Los nombres de archivo son los mismos que los de Shinobi; solo cambia la carpeta. `herramientas/preparar-video.sh` deja cada video listo.
2. **Definición** en `src/temas/<id>/tema.json` (copiá la de `src/temas/shinobi/tema.json`):

| Campo | Qué es |
|---|---|
| `id` | Nombre de la carpeta, sin espacios |
| `nombre`, `descripcion` | Lo que dice la tarjeta del tema |
| `personaje` | Nombre del personaje de las animaciones |
| `saludo` | Lo que dice al terminar la primera vez (`{personaje}` y `{nombre}` se reemplazan) |
| `nombreApp` | Nombre de la app que se propone |
| `acento` | Color de acento en hex (Shinobi: `#C8102E`) |
| `kanjis` | `true` o `false`: kanjis decorativos en los botones de Progreso |
| `carpetaFondos` | `"temas/<id>/"` |
| `sprite` | `"temas/<id>/camina.webp"` |
| `vistaPrevia` | `{ "video": "temas/<id>/lluvia.mp4", "imagen": "temas/<id>/lluvia.jpg" }` |
| `orden` | Posición en la lista de temas |
| `adornos` | Opcional. `aves`: `"pajaros"` (Shinobi) o `"estrellas"` (la cabecera se deshace en estrellitas y corazones). `cumplir`: `"corte"` (Shinobi) o `"chispazo"` (estrellitas al cumplir un pilar). `simbolos`: reemplazos de kanjis y de la cruz de «no cumplido», por ejemplo `{ "食": "🍓" }`. `numerosComunes`: `true` para numerar Mi código con 1, 2, 3 |
| `vidrio` | Opcional. `"claro"`: las tarjetas de Progreso van en vidrio claro (para temas de fondo claro). Shinobi: oscuro |
| `oculto` | `true`: el tema no aparece en la lista mientras se arma (con `VITE_TEMAS_OCULTOS=1` se ve igual, para probarlo) |

Lo que falte en `tema.json` se completa con los valores de Shinobi: un tema puede arrancar con solo `nombre` y `descripcion`.

3. **Estilos propios (opcional)** en `src/temas/<id>/tema.css`: cabecera, decoración y colores de fondo (redefiniendo `--fondo`, `--fondo-2`, `--texto`… en `:root[data-tema="<id>"]`). Cada regla empieza con `:root[data-tema="<id>"]`, así solo se ve con ese tema; un test lo verifica y también que Shinobi no tenga `tema.css` (queda idéntico).
4. Si el tema estaba en `src/temas/proximamente.json`, sacá su tarjeta de ahí.
5. Publicar. La app encuentra sola cada carpeta con `tema.json` (y los tests verifican que Shinobi siga siendo el tema por defecto).

## Qué es del tema y qué no

- Del tema: fondos de Progreso, sprite del entreno, color de acento, kanjis de Progreso, nombre del personaje y saludo.
- De la persona (Ajustes, viajan en la copia de seguridad): `tema`, `nombreApp`, `nombrePersona`, `nombresFases`.
- Las escenas de animación (muñeco, cortes, parry) son por ahora las de Shinobi para todos los temas.
