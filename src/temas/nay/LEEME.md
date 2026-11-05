# Tema «App Nay» (plantilla)

Esta carpeta es el tema de Nay. Todo lo que es de este tema se edita **acá adentro** y en `public/temas/nay/`.
La estructura de la app (secciones, orden, XP, niveles, calendario, pilares) es común y no se toca.

## Cómo está ahora

`tema.json` arranca con los valores de Shinobi (fondos, sprite, color), para que la app funcione aunque falte algo.
Mientras `"oculto": true`, el tema **no aparece** en la primera entrada ni en Más → Tema: solo se ve «Próximamente».
Cuando Navil diga «sumalo», se saca esa línea y aparece.

## Qué se puede cambiar (cada cosa, de a una)

| Campo | Qué es | Ahora |
|---|---|---|
| `nombre`, `descripcion` | Lo que dice la tarjeta del tema | App Nay |
| `personaje` | Nombre del personaje | Nay |
| `saludo` | Lo que dice al terminar la primera vez (`{personaje}` y `{nombre}` se reemplazan) | |
| `nombreApp` | Nombre que se propone para la app | App Nay |
| `acento` | Color de acento, en hex | rojo de SEK |
| `kanjis` | `true` / `false`: kanjis decorativos en Progreso | true |
| `carpetaFondos` | Carpeta con los videos de fondo | `fondos/` (los de Shinobi) → cambiar a `temas/nay/` cuando estén los videos |
| `sprite` | Personaje que camina en la barra del entreno | el shinobi → `temas/nay/camina.webp` |
| `vistaPrevia` | Video e imagen de la tarjeta del tema | los de Shinobi |
| `icono` | Ícono de la app | el de SEK |
| `nombresFases` | Nombres de las tres fases de 30 días | los de SEK |

## Archivos que van en `public/temas/nay/`

- `lluvia.mp4` + `lluvia.jpg`, `rayos.mp4` + `rayos.jpg` (verticales, 720×1280; se intercalan por día en Progreso).
- `pc.mp4` + `pc.jpg` (horizontal, para la computadora).
- `camina.webp`: hoja de sprites del personaje (misma grilla que `public/shinobi/camina.webp`: 16 columnas × 13 filas de 96×70 px).
- `herramientas/preparar-video.sh` deja cada video listo.

Si un archivo falta, se usa el de Shinobi: nada se rompe.
