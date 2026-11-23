# Módulo temas

**Qué hace:** todo lo visual que cambia con el tema. Qué tema eligió cada persona, el tema **Shinobi** que trae la app (colores, letras, kanjis, íconos dibujados, escenas en video, fondos, compañero que camina, Tajo), los **temas que sube cada persona** (archivo `.sektema`), la **lluvia de fondo** y los **efectos** de los eventos visuales (completar, logro, alerta, subir de nivel…). Es la «mudanza» de `src/temas/`, `public/temas/`, `public/fondos/`, `public/shinobi/` y `FondoLluvia` de la app vieja.

## Cómo llega a cada pantalla (sin tocar las pantallas de los demás)

`comun/pantalla/marco.js` carga `/m/temas/tema.js` en todas las páginas. `tema.js`:

1. Pide `GET /api/temas/activo` y pone las variables de color de `comun/pantalla/estilo.css` según el tema (Shinobi = las mismas de estilo.css, no cambia nada). Las guarda en el navegador y `marco.js` las pone al arrancar la siguiente pantalla, así no parpadea.
2. Hace que `SEK.icono(nombre)` responda con el tema elegido: kanji (texto) si el tema lo tiene, si no el ícono dibujado (`<svg class="ico">`), si no `''`.
3. Escucha `SEK.evento(nombre, { elemento })` y lo dibuja a la manera del tema (Shinobi: sello 済, tinta, tajo rojo; tema subido o sin efectos propios: pulso, fundido, temblor).
4. Muestra una sola vez los avisos guardados en el servidor (hoy: `xp.nivel` → cartel «段 Nivel N» con tinta).
5. Prende la lluvia (`lluvia.js`) si la persona no la apagó. Una página puede pedir sin lluvia con `<body data-sin-lluvia>`.
6. Con un tema subido, cambia los kanjis de la pantalla por emojis (`sin-kanjis.js`).

## Lo que ofrece en el navegador: `SEK.tema`

| | Para qué |
|---|---|
| `SEK.tema.listo` | Promesa: el tema ya está aplicado (o `null` si no hay sesión). |
| `SEK.tema.actual` | El tema elegido, completo. |
| `SEK.tema.icono(nombre)` | Lo mismo que `SEK.icono`. |
| `SEK.tema.color(nombre)` | Color por nombre genérico (`color-principal`, `color-papel`, `color-tinta`…). Para lo que no es CSS (canvas). |
| `SEK.tema.frase()` | Una frase del compañero al azar. |
| `SEK.tema.fondo('lluvia' \| 'rayos' \| 'pc')` | `{ video, imagen }` del fondo animado (Progreso). |
| `SEK.tema.escena('juego/jugando')` | `{ video, inicio, quieto, fin }` de una escena en video, o `null` si el tema no trae escenas (la pantalla usa su versión simple). |
| `SEK.tema.medio('sprite' \| 'tajo' \| 'grano' \| 'personaje')` | Dirección de otro archivo del tema, o `null`. |
| `SEK.tema.efecto(nombre, detalle)` | Dibuja un efecto directo (lo normal es `SEK.evento`). |
| `SEK.lluvia.prender(intensidad)` / `apagar()` | La lluvia de fondo (la prende `tema.js` solo). |

Eventos visuales que entiende: `completar`, `aparecer`, `logro`, `recompensa`, `alerta`, `descanso`, `dormir`, `pelear`, `robo`, `duda`, `jugar`, `pausa`, `quieto`, `forja-paso`, `forja-pedazo`, `forja-completa`, `xp-perdida`, `xp.nivel`. Cuando el tema queda aplicado, `tema.js` avisa `sek-tema` en `document`.

Escenas de Shinobi que hay (`pantallas/shinobi/escenas/`): `juego/a-jugar`, `juego/jugando`, `juego/te-entra`, `juego/te-bucle`, `juego/te-sale`, `noche/buenas-noches`, `noche/durmiendo`, `sueno/sentado`, `pelea/pelea`, `caida/t6-tumba-regreso`, `caida/r7-rival-corre`, `tension/t1-mirada`, `t1b-charcos`, `t3-mano`, `t3b-espera`, `t4a-se-tira`, `t4b-derrota`, `t4c-carga-llanura`… (ver la carpeta). El rival archivado no se mudó.

## Lo que ofrece su ventanilla (servidor)

| Función | Para qué |
|---|---|
| `temaDe(usuarioId)` | El tema elegido, completo (colores, íconos, letras, medios). Si ya no existe, Shinobi. |
| `activo(usuarioId)` | Lo de `GET /api/temas/activo`: `{ tema (con variables CSS), lluvia, nombreApp, avisos }`. Entrega los avisos una sola vez. |
| `lista(usuarioId)` | `{ elegido, lluvia, temas, proximos }` para la pantalla Tema. |
| `elegir(usuarioId, id)` | Elige un tema de la app o uno subido (si no existe: 404). Anota en el historial. |
| `guardarLluvia(usuarioId, intensidad)` | `apagada`, `llovizna`, `lluvia` o `tormenta`. |
| `subir(usuarioId, textoArchivo, { elegirlo = true })` | Revisa y guarda un `.sektema`. Mismo nombre = lo reemplaza. Devuelve su id (`propio-<nombre>`). |
| `borrarPropio(usuarioId, id)` | Si estaba en uso, vuelve Shinobi. |
| `archivoDe(usuarioId, id)` | `{ nombreArchivo, texto }` para volver a compartirlo. |
| `medio(usuarioId, id, nombre)` | Una imagen/video de un tema subido: `{ tipo, bytes }`. |
| `importar(usuarioId, { tema, archivos })` | Para el módulo **copia**: el tema elegido y archivos `.sektema` (lo que no sirve se saltea). Devuelve cuántos entraron. |
| `exportar(usuarioId)` | El tema elegido y los temas subidos (archivo completo), con la forma que recibe `importar`. Lo usa **copia**. |
| `guardarAviso(usuarioId, nombre, detalle)` | Guarda un aviso visual para la próxima pantalla. |
| `conectar()` | Empieza a escuchar `xp.nivel` (lo llama `rutas.js`; una sola vez). |

Todas aceptan `tx` opcional al final (transacción compartida). El aviso de `xp.nivel` se guarda en la misma transacción de quien sube de nivel: si eso vuelve atrás, el aviso también.

## Direcciones

| Dirección | Qué |
|---|---|
| `GET /temas` | Pantalla **Tema** (en Más): elegir tema, lluvia, subir/compartir/borrar temas propios, probar efectos. `temas.html` + `temas.js` + `estilo.css`. |
| `GET /api/temas/activo` | Lo que pide `tema.js` en cada pantalla. |
| `GET /api/temas` | La lista. |
| `PUT /api/temas/elegido` `{ id }` | Elegir. |
| `PUT /api/temas/lluvia` `{ lluvia }` | Intensidad de la lluvia. |
| `POST /api/temas/propios` `{ texto }` | Subir un `.sektema` (acepta hasta ~45 MB, el resto de la API 1 MB). |
| `DELETE /api/temas/propios/:id` | Borrar uno subido. |
| `GET /api/temas/propios/:id/archivo` | Descargar el `.sektema`. |
| `GET /api/temas/propios/:id/medio/:nombre` | Imagen/video de un tema subido: `fondo`, `vistaPrevia`, `personaje`, `alarma`, `widget-1..4`, `video-lluvia|rayos|pc`, `cuadro-lluvia|rayos|pc`. |
| `/m/temas/shinobi/…` | Archivos de Shinobi (los sirve `comun/pantalla/servir.js`). |

## Cómo se arma un tema

- **De la app:** una carpeta `pantallas/<id>/` con `tema.json` (como `pantallas/shinobi/tema.json`) y sus archivos. Lo que no trae se toma de Shinobi. Opcional: `iconos.json` (íconos dibujados, el cuerpo de un `<svg viewBox="0 0 24 24">` con `currentColor`). `proximamente.json`: tarjetas «Próximamente».
- **Subido por la persona (`.sektema`):** JSON con `formato: "sek-tema"`, `version: 1`, `nombre` y, opcionales: `descripcion`, `personaje`, `saludo`, `claro`, `colores` (`color-fondo`, `color-tarjeta`, `color-tarjeta-2`, `color-borde`, `color-texto`, `color-texto-2`, `color-texto-3`, `color-principal`, `color-hecho`, `color-aviso`, `color-con-alguien`, `color-importancia-alta|media|baja`, `color-papel`, `color-papel-2`, `color-peligro`, en `#RRGGBB`), `simbolos` (`{ "水": "💧" }`), `adornos`, `frases`, `imagenes` (`fondo`, `vistaPrevia`, `personaje`, `widget[]`, `alarma`, `videos`, `cuadros`; PNG/JPG/WebP hasta 4 MB, MP4/WebM hasta 8 MB, como `data:`), `widget`, `escenas`. No trae código ni estilos: cada dato se revisa (`revisar.js`) y lo que no sirve se descarta. Fondo claro sin color de texto → texto oscuro.

## Datos

- tabla `temas_propios`: un `.sektema` revisado por persona y nombre (`clave` = `propio-<nombre>`), `archivo` (JSON), `subido`.
- tabla `temas_avisos`: avisos visuales pendientes (`nombre`, `datos`, `visto`).

Migración `007-temas.sql`. Ajustes que usa (de `comun/ajustes.js`): `tema` (ya estaba) y `lluvia` (lo sumó este módulo, `'lluvia'` por defecto).

## Archivos

- `catalogo.js`: los temas que trae la app (lee `pantallas/*/tema.json`).
- `revisar.js`: cuentas puras: revisar un `.sektema`, armar la definición, variables CSS. Traído de `src/temas/propios.ts` y `temas.ts`.
- `pantallas/tema.js` (motor del navegador), `tema.css` (vidrio con lluvia, capas de efectos, cartel de nivel), `lluvia.js` (traído más corto de `src/ui/FondoLluvia.tsx`), `sin-kanjis.js` (de `src/temas/sinKanjis.ts`).
- `pantallas/shinobi/`: `tema.json`, `iconos.json` (18 íconos dibujados), `fondos/` (lluvia, rayos, pc), `escenas/`, `companero/` (sprite que camina), `tajo.mp4/.webm`, `grano.png`.

## Qué módulos usa

Ninguno. Solo `comun/`. **Escucha** `xp.nivel` (lo emite **xp**). Las pantallas de los demás le hablan solo por `SEK.icono`, `SEK.evento` y `SEK.tema` en el navegador.

## Cambios en comun/ (chicos)

- `comun/pantalla/marco.js`: pone las variables guardadas del último tema, carga `/m/temas/tema.js`, y `SEK.icono` le pregunta primero al tema (si no está, la lista `ICONOS` de respaldo).
- `comun/ajustes.js`: nuevo ajuste `lluvia`.
- `comun/guardian.test.js`: no confunde `ON CONFLICT … DO UPDATE SET` con una tabla.
- `modulos/cuentas/pantallas/mas.js`: fila **Tema** (彩) en Más (como pide su LEEME).

## Pendiente (de la app vieja)

- Lluvia por pantalla (Calendario con nubes, Sueño con ventana, Comida con bambú, Juego con vidrio): hoy cambia solo la dirección y velocidad según la sección. Lluvia «pastel» (pétalos) para temas subidos.
- Elegir tema en el primer arranque y el saludo del personaje (cuando exista el arranque nuevo).
- Animaciones grandes del Shinobi que viven en cada pantalla (Tajo que rompe la pantalla, forja/piedra, compañero que camina, escenas de Juego/noche/Tensión, polvo de tinta, pájaros de la cabecera, camino de Progreso): los archivos ya están acá y se piden con `SEK.tema.escena/medio`; el dibujo lo hace cada módulo cuando se mude (desafios, habitos, entreno, juego, sueno, progreso).
- Animaciones del hada (`adornos.animaciones: 'hada'`): hoy usan los efectos simples.
- Muñeco articulado y poses (`public/animaciones/`): no se mudó.
- Los videos todavía tienen marca Luma/Kling.
