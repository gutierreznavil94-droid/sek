# Módulo comida

**Qué hace:** lo que comés y tomás. Comidas con alimentos (tabla común de ~400, propios y código de barras), comidas guardadas, «repetir ayer», objetivo de calorías y proteína, peso, agua con envases y fruta del día. Pantallas en `/comida` (botón **Comida** 食 de la barra) y `/comida/ajustes`.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `hoy(usuarioId)` | Fecha de hoy en la zona de la persona. |
| `buscar(usuarioId, texto)` / `alimento(usuarioId, id)` | Buscador sin tildes (todas las palabras). Ids: `t001` (tabla común) o `p12` (propio). |
| `crearPropio(usuarioId, { nombre, porcion, gramos, kcal, proteina, carbos?, grasas?, up?, codigo? })` | Alimento propio desde **una porción**; se guarda por 100 g. |
| `buscarCodigo(usuarioId, codigo, pedir?)` | Código de barras: primero lo guardado, después Open Food Facts (lo consulta el servidor). `{ alimento }` o `{ alimento: null, motivo: 'sin_internet' \| 'no_esta' }`. |
| `registrar(usuarioId, { alimento, gramos, franja?, fecha? })` | «Comí». Sin franja, según la hora; sin fecha, hoy. Avisa `comida.registrada`. |
| `cambiarCantidad(usuarioId, id, gramos)` / `borrar(usuarioId, id)` | Corregir o quitar algo cargado. |
| `delDia(usuarioId, fecha)` | `{ lista, totales, porFranja }`. |
| `frecuentes(usuarioId, fecha)` / `repetirAyer(usuarioId, fecha, franja)` | Lo de siempre (con la cantidad de la última vez) y copiar una franja de ayer. |
| `guardarFranja` / `guardadas` / `cargarGuardada` / `borrarGuardada` | Comidas guardadas («Desayuno de siempre»). |
| `objetivo` / `guardarObjetivo(usuarioId, datos, fecha?)` | Calorías y proteína (Mifflin-St Jeor × actividad; o a mano con `manual`). Si cambia el peso, queda en la curva. |
| `registrarPeso(usuarioId, fecha, kg)` / `pesos` | Un peso por día. Recalcula el objetivo (si no es a mano). |
| `planDelDia(usuarioId, fecha)` | Pilar «Comer según el plan»: `{ cumplido, kcal, proteina }` o `null` (sin objetivo o sin cargar: no cuenta). Lo usa **dia**. |
| `configAgua` / `guardarConfigAgua` / `aguaDelDia` / `tomarAgua` / `deshacerAgua` / `borrarToma` / `resumenAgua` | Agua: envases, objetivo (35 ml por kilo o a mano), un toque suma, deshacer, tira de 14 días y racha. |
| `configFruta` / `guardarConfigFruta` / `frutaDelDia` / `comerFruta` / `deshacerFruta` / `historialFruta` | Fruta del día con dos objetivos (1 y 2) y la manzana mordida. |
| `resumenHoy(usuarioId)` | Lo chico para la tarjeta de **Hoy** (dia): totales vs objetivo, agua y fruta. |
| `resumenSemanas(usuarioId, fecha)` | Para **progreso**: promedios por semana, pesos, ultraprocesados. |
| `resumen(usuarioId, fecha?)` / `ajustes(usuarioId)` | Todo lo de cada pantalla. |
| `importar(usuarioId, tablas)` | Trae de «Copiar todo como texto» de la app vieja: `alimentosPropios`, `comidas`, `comidasGuardadas`, `pesos`, `agua`, `frutas` y `ajustes` (comida, agua, fruta). Pasa los ids viejos de propios a los nuevos. Todo o nada. Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos que emite (`comun/eventos.js`)

- `comida.registrada` → `{ usuarioId, fecha, registro }` (al cargar algo; `registro` es `null` en «repetir ayer»). Lo escucha **dia** para el pilar «Comer según el plan».

## Datos (migración `010-comida.sql`)

- tabla `comida_config`: un renglón por persona con `objetivo`, `agua` (envases, principal, objetivoMl, enHoy) y `fruta` (nombre, objetivo1, objetivo2, usar), en JSON.
- tabla `alimentos_propios`: por 100 g; `fuente` `propio` u `off` (código de barras); `codigo` único por persona.
- tabla `comidas`: cada cosa comida con los totales congelados (cambiar la tabla después no recalcula lo viejo).
- tabla `comidas_guardadas`: nombre + `items` (`alimento`, `nombre`, `gramos`).
- tabla `pesos`: uno por día.
- tabla `agua_tomas`: cada toque (ml y envase).
- tabla `frutas`: cada fruta.

Ajustes comunes que usa: solo `zonaHoraria`. Lo propio va en `comida_config` (no en `comun/ajustes.js`).

## Archivos

- `calculo.js`: cuentas puras (buscador, macros, objetivo, franjas, agua, fruta, Open Food Facts). Traído de `src/services/comidas.ts`, `agua.ts`, `fruta.ts`.
- `alimentos.json`: tabla común (USDA y tablas argentinas), copia de `src/comidas/alimentos.json`.
- `pantallas/comida.html` + `comida.js`: anillos de calorías y proteína, cantimplora (toque suma, mantener = otro envase o deshacer), manzana (toque suma, mantener deshace), «+ Comí» (buscar, lo de siempre, guardadas, propio, código, repetir ayer), lista por franja, días anteriores.
- `pantallas/ajustes.html` + `ajustes.js`: objetivo, peso con curva chica, envases de agua, fruta y fuentes.
- `pantallas/estilo.css`: lo propio (anillos, cantimplora, manzana, hojas).

## Qué módulos usa

Ninguno. Solo `comun/`. (El MAPA decía «usa xp», pero en la app vieja comida nunca dio XP directo: la XP del pilar «Comer según el plan» la da **dia**, preguntando `planDelDia`. Agua y fruta no dan XP.)

## Cambios en comun/

- `comun/pantalla/marco.js`: botón **Comida** 食 en `MENU`.
- `comun/guardian.test.js`: el guardián confundía `ON CONFLICT … DO UPDATE SET` con una tabla llamada «SET»; ahora lo salta.

## Pendiente (de la app vieja)

- Prender/apagar el pilar «Comer según el plan» (15 XP): va con **dia**, que tiene los pilares; comida ya ofrece `planDelDia` y avisa `comida.registrada`.
- Escanear con la cámara: acá se escribe el número del código. La cámara llega con **celular** (o un lector en la pantalla, si Navil lo pide).
- La tarjeta chica de Hoy (cantimplora y manzana al lado de la comida): la arma **dia** con `resumenHoy`.
- Gráficos de comida, agua y peso en Progreso: los arma **progreso** con `resumenSemanas`, `resumenAgua` y `historialFruta` (ruta `/api/comida/progreso`).
- Animaciones del tema al llenar el agua o morder la manzana: la pantalla avisa `SEK.evento('completar' | 'logro', { modulo: 'comida' })`; las dibuja **temas**.
