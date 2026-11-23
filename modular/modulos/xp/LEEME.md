# Módulo xp

**Qué hace:** los puntos de SEK. Sumar y restar XP con clave única (el mismo evento nunca suma dos veces), anular con motivo (nada se borra), niveles (pasar del nivel n al n+1 cuesta `base × n`), «lo no cumplido resta» (la mitad por defecto) y el historial de XP. Pantalla en `/xp` (botón **Nivel** 段 de la barra).

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `sumar(usuarioId, { clave, cantidad, origen, fecha, descripcion })` | Suma XP. Si la clave ya está, no suma (`{ concedido: false }`). Si estaba anulada, la reactiva. Devuelve `{ concedido, cantidad, nuevoNivel }`. |
| `restar(usuarioId, { clave, cantidad, origen, fecha, descripcion })` | Resta (cantidad en positivo). Solo orígenes `resta`, `caida`, `rival`. Nunca deja el total debajo de 0. |
| `anular(usuarioId, clave, motivo)` / `anularPorId(usuarioId, id, motivo)` | Corrige un movimiento: queda tachado con su motivo. |
| `claveXp(origen, [partes])` | Arma la clave: `'compromiso:leer:2026-11-23'`. |
| `total(usuarioId)` / `estado(usuarioId)` | XP total / `{ nivel, etapa, xpTotal, xpEnNivel, xpParaSiguiente, progreso, … }`. |
| `delDia(usuarioId, fecha)` / `balanceDelDia(usuarioId, fecha)` | Movimientos de un día / `{ mas, menos }` («Ayer: +35 / −8»). |
| `xpPorDia(usuarioId, desde, hasta)` / `xpAntesDe(usuarioId, fecha)` | XP neta por día, para la montaña de **progreso**. |
| `historialXp(usuarioId, { cantidad, antesDe })` | Últimos movimientos (con anulados), de a páginas. |
| `configResta` / `asegurarInicioResta(usuarioId, hoy)` / `cambiarResta(usuarioId, { activa, porcentaje })` | «Lo no cumplido resta»: leer, fijar el día de inicio (nunca hacia atrás), prender/apagar y el % (10 a 100). |
| `aplicarRestas(usuarioId, fecha, faltantes)` | Al cerrar un día: una resta por cada faltante `{ id, nombre, xp, tipo }`. Idempotente. Devuelve cuánto restó. |
| `devolverResta(usuarioId, id, fecha)` | Si se corrige después (se marcó el pilar), devuelve la resta. |
| `avisoResta(usuarioId, hoy, faltantes)` | `{ faltantes, porcentaje, total, texto }` para «Te quedan 2 sin hacer: −15 XP…», o `null`. |
| `resumen(usuarioId)` | Todo lo de la pantalla. |
| `importar(usuarioId, registrosViejos)` | Trae la tabla `xp` de «Copiar todo como texto» de la app vieja (claves, anulados y restas). Lo repetido no entra. Lo usa **copia**. |
| `exportar(usuarioId)` | Todo el XP con la forma que recibe `importar`. Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida). Las que escriben corren en su propia transacción si no reciben una.

**Qué faltó un día no lo sabe xp:** lo arma el módulo **dia** (pilares) junto con **entreno** (series) y se lo pasa a `aplicarRestas` / `avisoResta`. En la app vieja era `faltantesDelDia` de `src/services/restas.ts`.

## Avisos que emite (`comun/eventos.js`)

- `xp.nivel` → `{ usuarioId, nivel, xpTotal }`, uno por cada nivel subido (lo escucha **temas** para la animación).

## Datos

- tabla `xp_registros`: `clave` (única por persona), `cantidad` (congelada: cambiar una regla después no recalcula), `origen`, `fecha`, `creado`, `descripcion`, `anulado`, `anulado_en`, `motivo_anulacion`. Migración `004-xp.sql`.

Dos sumas a la vez de la misma persona se ponen en fila (candado de PostgreSQL en la transacción), así el nivel nunca se calcula mal.

Ajustes que usa (de `comun/ajustes.js`): `baseNivel` (100), `xpResta` (`{ activa: true, porcentaje: 50, desde: null }`), `zonaHoraria`.

## Archivos

- `calculo.js`: las cuentas puras (niveles, restas, balance). Traído de `src/domain/xp.ts`, `niveles.ts` y `resta.ts`.
- `pantallas/xp.html` + `xp.js` + `estilo.css`: nivel con barra, hoy/ayer, prender o apagar «lo no cumplido resta», movimientos con «Anular».

## Qué módulos usa

Ninguno. Solo `comun/`.

## Pendiente (de la app vieja)

- `reglasXp` (cuánta XP da cada pilar desde tal fecha) y `xpCompromisoPorDefecto`: van con **dia**, que es quien tiene los pilares.
- `cuotas.ts` (cuota y extra de las series rápidas): va con **entreno**.
- La tabla vieja `niveles` (cuándo se alcanzó cada nivel) no se importa: las subidas nuevas quedan en el historial común.
- La pantalla vieja `Historial.tsx` mostraba el historial de **todos** los cambios; acá se ve el de XP. El historial común (`comun/historial.js`) no tiene pantalla todavía.
