# Tema de Nay

Acá vive el tema de Nay. Solo se edita esta carpeta y `public/temas/nay/`.
Lo que no esté escrito en `tema.json` se toma de Shinobi, así nada se rompe a medio armar.
Cada pedido de Nay va sumando o cambiando un campo.

| Campo | Qué es |
|---|---|
| `nombre`, `descripcion` | Lo que dice la tarjeta del tema |
| `personaje` | Nombre del personaje |
| `saludo` | Lo que dice la primera vez (`{personaje}` y `{nombre}` se reemplazan) |
| `nombreApp` | Nombre de la app que se propone |
| `acento` | Color de acento en hex |
| `kanjis` | `true` o `false`: kanjis decorativos en Progreso |
| `carpetaFondos` | Pasa a `"temas/nay/"` cuando estén los videos |
| `sprite` | Pasa a `"temas/nay/camina.webp"` cuando esté el sprite |
| `vistaPrevia` | Video e imagen de la tarjeta |
| `oculto` | `true` = no aparece en la app real. Solo Navil lo saca («sumalo») |

Archivos (en `public/temas/nay/`, mismos nombres que Shinobi): `lluvia.mp4/.jpg`,
`rayos.mp4/.jpg`, `pc.mp4/.jpg`, `camina.webp` (16×13 cuadros de 96×70 px).
Ver `TEMAS.md` en la raíz para el detalle.
