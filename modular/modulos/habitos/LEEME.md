# Módulo habitos

**Qué hace:** lo que te vuelve una persona distinta con el tiempo:

- **Forja** (鍛): un hábito nuevo es una piedra dura. Cada día cumplido la agrieta; a los **28 días válidos** (en 30) se rompe y queda su kanji. Cada semana perdona 1 falla; las fallas de más cierran una grieta y alargan la forja 1 día (nunca reinicia). +5 XP por día, +50 al forjarse. Máximo 3 a la vez.
- **Mi código** (掟): reglas propias que se leen (no se marcan ni dan XP), vistas **por momento** (朝 昼 夜 常) o **por área** (体 心 食 整), cada vista con su propio orden. Arranca con 6 ejemplos una sola vez.
- **Caídas**: «No cumplí mi palabra» deja la marca del día y saca XP (el precio de volver, 20 por defecto, nunca debajo de 0). El día sigue: no se reinicia nada. Se puede deshacer durante 10 s.
- **Fotos de progreso** (写) con el día en que se cargan, y **días marcados** (印) con un texto corto.

Pantallas: `/habitos` (botón **Código** 掟 de la barra: forja + Mi código + caída) y `/habitos/fotos` (fotos y días marcados).

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `listarForja(usuarioId)` | `{ hoy, enForja, forjados, abandonados, config }`; cada hábito con su `estado` (válidos, necesarios, pedazos, camino de días…). |
| `crearHabito(usuarioId, { nombre, kanji })` | Empieza la forja hoy. Falla si ya hay `maximo` en forja. |
| `alternarDia(usuarioId, id)` | Toque en la piedra: marca hoy (+XP) o desmarca (anula la XP). Devuelve `{ marcado, xp, pedazo, forjado, nuevoNivel, habito, estado }`. |
| `abandonarHabito` / `editarHabito(usuarioId, id, { nombre, kanji })` | Abandonar no resta XP. |
| `kanjiSugeridos(nombre)` | Hasta 6 kanji según el nombre (読 para «leer», 水 para «agua»…). |
| `sembrar(usuarioId)` | Carga los ejemplos de Mi código una sola vez. Va en `sesion.alCrearCuenta` (desde `app.js`). |
| `listarCodigo` / `agregarRegla(usuarioId, { texto, grupo, momento })` / `editarRegla` / `borrarRegla` / `moverRegla(usuarioId, id, ±1, 'area'│'momento')` | Mi código. |
| `registrarCaida(usuarioId, { origen: 'boton'│'tension', fecha? })` | La caída: marca + resta XP. Para **desafios** (soltar la mano en Tensión) y el botón de Hoy. |
| `deshacerCaida(usuarioId, id)` | Quita la marca y devuelve la XP. |
| `caidasDelDia` / `caidasPorDia(usuarioId, desde, hasta)` / `todasLasCaidas` | Para **dia** (Calendario, tumba rota) y **progreso** («Caídas superadas: N»). |
| `listarFotos` (sin imagen) / `imagenFoto` / `agregarFoto(usuarioId, { imagen, dia? })` / `borrarFoto` | Fotos. `imagen` es un data URL ya achicado. |
| `listarMarcas` / `marcarDia(usuarioId, fecha, texto)` / `quitarMarca` | Días marcados (para el Calendario de **dia** y **progreso**). |
| `cambiarConfig(usuarioId, { forja, caidaXp })` | Días, válidos, XP por día, XP al forjarse y máximo; XP de la caída (0 a 200). |
| `resumenHoy(usuarioId)` | La tarjeta de Hoy: `{ hoy, enForja: [{ id, nombre, kanji, validos, necesarios, pedazos, hechoHoy }], caidasHoy, reglas }`. |
| `resumen(usuarioId)` | Todo lo de la pantalla. |
| `importar(usuarioId, { forja, codigo, caidas, fotos, marcas, ajustes })` | Trae esas tablas de «Copiar todo como texto» de la app vieja. Conserva los id (así la XP importada por **xp** sigue enganchada a su hábito). Lo repetido no entra. Lo usa **copia**. |
| `exportar(usuarioId)` | Todo (con las fotos) con la forma que recibe `importar`. Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos

No emite avisos de `comun/eventos.js`. En la pantalla dispara eventos visuales genéricos con `SEK.evento`: `forja-paso`, `forja-pedazo`, `forja-completa`, `caida` (los dibujará **temas**).

## Datos (migración `011-habitos.sql`)

- tabla `forja_habitos`: `id` (texto), `nombre`, `kanji`, `inicio`, `cumplidos` (lista de días), `fallas`, `estado` (forja / forjado / abandonado), `forjado_en`, `abandonado_en`, `creado`. El estado (válidos, grietas) nunca se guarda: se calcula de los días cumplidos.
- tabla `codigo_reglas`: `id`, `texto`, `grupo` (cuerpo, mente, comida, cuidado), `momento` (manana, tarde, noche, siempre), `orden` (vista por área), `orden_momento` (vista por momento), `creado`.
- tabla `caidas`: `id`, `fecha`, `instante`, `origen` (boton / tension), `xp` (lo que sacó de verdad).
- tabla `fotos_progreso`: `id`, `fecha` (no se cambia), `dia` (día del ciclo, si se sabe), `imagen` (data URL), `creada`.
- tabla `marcas_dia`: `fecha` (una por día), `texto` (hasta 80), `creada`, `editada`.

Los id son texto para conservar los de la app vieja. La XP: `forja:<id>:<fecha>`, `forja:<id>:forjado` y `caida:<id>` (las mismas claves que la app vieja).

Ajustes que usa (de `comun/ajustes.js`): `forja` (`{ dias: 30, validos: 28, xpDia: 5, xpForjado: 50, maximo: 3 }`), `caida` (`{ xp: 20 }`), `codigoSembrado`, `zonaHoraria`.

## Archivos

- `calculo.js`: las cuentas puras (estado de la forja, pedazos, kanji sugeridos, grupos y orden de Mi código, XP de la caída). Traído de `src/domain/forja.ts`, `src/services/codigo.ts` y `caidas.ts`.
- `pantallas/habitos.html` + `habitos.js`: forja (piedras), Mi código (dos vistas), «No cumplí mi palabra» con Deshacer y los ajustes.
- Fotos de progreso: sin pantalla propia, se ven y se suben en Progreso (como en la v0.88.27); los días marcados, en Calendario. Este módulo da la API (`/api/habitos/fotos`, `/api/habitos/marcas`).
- `pantallas/estilo.css`: la piedra, el camino de días y las reglas.

## Qué módulos usa

- **xp** (ventanilla): `sumar`, `anular`, `restar`, `claveXp`.

## Pendiente (de la app vieja)

- **Día del ciclo en las fotos** («Día 20»): lo sabe **ciclo**; cuando esté, la pantalla (o **dia**) lo pasa en `agregarFoto({ dia })`. Hoy se muestra la fecha.
- **Escenas**: el Juramento al forjar o jurar una regla, la piedra Shinobi que se rompe en pedazos, la escena de la caída con la estampida y el duelo de flexiones al levantarse: van con **temas** y **desafios** (escuchan los eventos visuales de arriba). Acá la piedra es un dibujo simple con sus grietas.
- **Fila «En forja» en Hoy**, el botón «No cumplí» en la cabecera de Hoy y la tumba rota del Calendario: los pone **dia** con `resumenHoy`, `alternarDia`, `registrarCaida` y `caidasPorDia`.
- «Marcar un día» manteniendo apretado en el Calendario: lo pone **dia** con `marcarDia`. Acá se marca eligiendo la fecha.
- Numerales a pincel (一 二 三) en Mi código: hechos acá; la opción «números comunes» de otros temas va con **temas**.
