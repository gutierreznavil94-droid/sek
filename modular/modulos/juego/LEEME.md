# Módulo juego

**Qué hace:** el temporizador de juego. Empezar, pausar, seguir y terminar; sumar a mano lo que te olvidaste de anotar; límites de juego para la semana y el finde; resumen de hoy y de la semana.

Es el **módulo de ejemplo** del monolito: copiá su forma para armar los demás.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `sesionActiva(usuarioId)` | La sesión abierta, o `null`. |
| `empezar(usuarioId)` / `pausar` / `seguir` | Mueven el temporizador. Empezar dos veces no crea dos sesiones. |
| `terminar(usuarioId, nota?)` | Cierra la sesión y avisa `juego.terminado`. |
| `agregarManual(usuarioId, { inicio, fin, nota? })` | «Me olvidé de anotar». No acepta futuro ni fin antes del inicio. |
| `borrar(usuarioId, id, motivo?)` | Borra una sesión (queda en el historial común). |
| `minutosDelDia(usuarioId, 'AAAA-MM-DD')` | Minutos jugados ese día (lo que cruza la medianoche se reparte). |
| `limiteRespetado(usuarioId, fecha)` | `{ minutos, limite, respetado }`. Para el pilar «Respetar el límite de juego» del módulo **dia**. |
| `resumen(usuarioId)` | Todo lo de la pantalla: sesión, hoy, semana, estado del límite. |
| `historial(usuarioId, cantidad?)` | Últimas sesiones. |
| `importar(usuarioId, sesionesViejas)` | Trae `sesionesJuego` de una copia de la app vieja. Lo usa el módulo **copia**. |
| `exportar(usuarioId)` | Todas las sesiones con la forma que recibe `importar` (que no duplica una sesión con el mismo inicio). Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos que emite (`comun/eventos.js`)

- `juego.terminado` → `{ usuarioId, sesion, minutos }`

## Datos

- tabla `sesiones_juego`: `inicio`, `fin`, `pausas` (lista de `{ desde, hasta }`, en milisegundos). Nunca se guarda un contador: los minutos salen de las marcas. Migración `002-juego.sql`.

Ajustes que usa (de `comun/ajustes.js`): `limiteJuegoSemana`, `limiteJuegoFinde`, `avisoJuegoPorcentaje`, `zonaHoraria`.

## Archivos

- `calculo.js`: las cuentas puras (tramos, pausas, medianoche). Traído de `src/domain/juego.ts`.
- `pantallas/juego.html` + `juego.js` + `estilo.css`: la pantalla, en `/juego`.

## Qué módulos usa

Ninguno. Solo `comun/`.

## Pendiente (de la app vieja)

- Feriados con límite de finde (cuando exista el módulo que tenga el calendario).
- «Mis juegos del celu» (lo cuenta Android solo): llega con el módulo **celular**.
- Avisos al acercarse al límite y el Tajo.
