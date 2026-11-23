# Módulo sueno

**Qué hace:** el sueño de SEK. «Dejo celu» (dormir a horario: da XP una sola vez si es a tiempo), la noche que se registra sola (acostado = «Dejo celu», dormido = + latencia, levantado = centro de la ventana de 15 min) y se corrige tocando, el **modo sueño** (pantalla casi negra hasta la hora de fin, cuenta las aperturas), la **adaptación por etapas** (Acostumbrando · Asentando · Estable, todo editable) con el veredicto de cada noche, y el resumen: gráfico de noches, mejora semana contra semana y racha. Pantallas en `/sueno` (botón **Sueño** 眠 de la barra) y `/sueno/modo`.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `dejoCelu(usuarioId, { instante?, nota?, resumen?, modo? })` | Registra «Dejo celu» en su noche (entre 00:00 y la hora de corte es la noche anterior). A tiempo: cumplido + `xpDejoCelu` (clave `suenio:acostarse:<noche>`, la misma de la app vieja). Tarde: sin XP. Después de `horaLimiteCelu` no se registra. Prende el modo sueño (salvo `modo: false`); `resumen` es la línea de «Buenas noches». Avisa `sueno.dejo_celu`. |
| `deshacerDejoCelu(usuarioId, noche, motivo?)` | Borra la noche, anula el XP y apaga el modo sueño de esa noche. Avisa `sueno.dejo_celu.deshecho`. |
| `dormirAHorario(usuarioId, noche)` | `{ registrado, cumplido, retrasoMinutos }`. Para el pilar «Dormir a horario» del módulo **dia**. Una noche cargada a mano no cuenta. |
| `nocheDe(usuarioId, instante?)` | A qué noche pertenece un instante. |
| `modoActivo` / `entrarModo` / `salirModo` / `terminarModoSiCorresponde` | El modo sueño. `terminarModoSiCorresponde` lo apaga desde media hora antes de la hora de levantarse y cierra la noche (para «Buenos días»). Salir después de 3 horas también cierra la noche. |
| `registrarApertura(usuarioId)` | Abrir la app en modo sueño: se anota la hora (no da ni quita XP). Dos en menos de un minuto cuentan como una. |
| `registrarDespertar(usuarioId, noche)` | Cierra la noche: levantado = centro de la ventana habitual. |
| `corregirNoche(usuarioId, noche, { acostado, dormido, levantado, despertares })` | Corrige a mano (HH:MM; despertares 0–3, `null` lo borra). Si la noche no existe la crea (sin XP). Valida el orden de las horas. |
| `volverAEstimado(usuarioId, noche, campo)` | Un dato corregido vuelve a lo estimado. |
| `noches(usuarioId, desde, hasta)` | Noches listas para mostrar (minutos desde las 00:00 de la noche, fuentes, rango de dormido). La de hoy, si no terminó, no entra. |
| `resumenNoches(usuarioId, dias?)` | Promedios, regularidad, diferencia con el objetivo, mejora semana contra semana y racha. Para **progreso**. |
| `estadoAdaptacion` / `guardarAdaptacion(usuarioId, cambios \| null)` | Etapa actual, tramos, discurso del shinobi. `null` vuelve a lo sugerido. |
| `ajustesSueno` / `guardarAjustesSueno` | Hora de «Dejo celu», minutos hasta dormirse (10 a 30), ventana de levantarse y objetivo (4 a 12 h). |
| `avisoDormir(usuarioId)` | `{ noche, mostrar, frase }`: el aviso tenue para alistarse (desde `minutosAvisoDormir` antes de «Dejo celu»). «Cerrar por esta noche» vive en el teléfono. |
| `resumen(usuarioId, { rango })` | Todo lo de la pantalla (`rango`: `semana`, `mes`, `todo`). |
| `resumenHoy(usuarioId)` | La tarjeta chica para **Hoy**. |
| `aperturasEntre(usuarioId, desde, hasta)` | Aperturas de noche, para la revisión semanal de **ciclo**. |
| `importar(usuarioId, { suenio, modoSuenio })` | Trae las tablas `suenio` y `modoSuenio` de «Copiar todo como texto» de la app vieja. Una noche que ya está no se pisa. Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida). Las que escriben corren en su propia transacción si no reciben una: «Dejo celu» + XP + modo sueño es todo o nada.

## Avisos que emite (`comun/eventos.js`)

- `sueno.dejo_celu` → `{ usuarioId, noche, cumplido, retrasoMinutos, instante }` (lo escucha **dia** para el pilar «Dormir a horario»).
- `sueno.dejo_celu.deshecho` → `{ usuarioId, noche }` (para que **dia** vuelva el pilar a pendiente).

## Datos

- tabla `suenio`: una fila por persona y noche. «Dejo celu» (`hora_prevista`, `hora_real`, `retraso_minutos`, `cumplido`), lo estimado o corregido (`acostado_manual`, `dormido`, `latencia_minutos`, `levantado`, `minutos_dormido`, `despertares`), de dónde sale cada dato (`fuente_acostado`, `fuente_dormido`, `fuente_levantado`: `estimado` · `corregido` · `reloj`), `etapas` (para un reloj) y `aperturas`. `sin_dejo_celu` = cargada a mano.
- tabla `modo_suenio`: una fila por persona mientras el modo sueño está prendido (`noche`, `inicio`, `hasta`, `tarde`, `resumen`, `aperturas` con las horas).

Migración `009-sueno.sql`.

Ajustes que usa (de `comun/ajustes.js`, sumados por este módulo): `horaAlistarse` (20:50), `horaDejarCelu` (21:15), `horaDormido` (21:20), `horaCorteNoche` (06:00), `horaLimiteCelu` (22:15), `horaFinSuenio` (05:00), `latenciaDormirseMinutos` (15), `objetivoSuenioHoras` (7,5), `relojInteligente` (false), `xpDejoCelu` (20), `adaptacion` (null = lo sugerido), `minutosAvisoDormir` (30), `frasesDormir` ([] = las de la app). Y `zonaHoraria`.

## Archivos

- `calculo.js`: las cuentas puras: estimación, fuentes (reloj > corregido > estimado), resumen de noches, adaptación y veredicto, frases para alistarse. Traído de `src/sueno/estimar.ts`, `src/sueno/fuentes/`, `src/services/adaptacion.ts`, `dormir.ts` y la parte de cuentas de `suenio.ts`.
- `pantallas/sueno.html` + `sueno.js`: botón «Dejo celu», anoche (tocar corrige), gráfico de noches (semana · mes · todo), tu adaptación con el shinobi, cómo vas mejorando y ajustes.
- `pantallas/modo.html` + `modo.js`: el modo sueño: «Buenas noches», el reloj, hasta cuándo dura, salir (con confirmación) y «Buenos días».
- `pantallas/estilo.css`: lo propio de estas pantallas (usa los colores generales).

## Cómo sumar un reloj inteligente

Un reloj es otra **fuente**: algo que devuelve noches con la forma de `calculo.nocheDesdeRegistro` (`{ noche, acostado, dormido, levantado }`, cada dato `{ valor, fuente: 'reloj' }`, y `etapas`). Se pasa como `fuentesExtra` a `calculo.nochesParaMostrar` y `combinarNoches` se queda con el mejor dato. Las pantallas no cambian. Detalles de Health Connect y de importar un archivo del reloj: `src/sueno/LEEME.md` de la app vieja.

## Qué módulos usa

- **xp** (por su ventanilla): `sumar`, `anular`, `claveXp`.

## Pendiente (de la app vieja)

- «Dejo celu» no revisa si el ciclo ya empezó («no se registra nada antes del Día 1»): sueno no usa **ciclo**. Si hace falta, lo hace **dia** antes de llamar a `dejoCelu`.
- La línea de «Buenas noches» con los pilares del día («3 de 5 pilares · Racha») la arma **dia** y la pasa en `resumen`; mientras tanto se muestra la racha de noches.
- Cambiar la hora de «Dejo celu» también cambiaba la hora del pilar «acostarse»: cuando exista **dia**, que lea `ajustes.horaDejarCelu`.
- Que toda la app quede bloqueada en modo sueño (la vieja no dejaba usar nada): hoy solo `/sueno` manda a `/sueno/modo`. Cuando exista **dia**, Hoy tiene que hacer lo mismo (`GET /api/sueno/modo`).
- Las escenas animadas del shinobi (Buenas noches, la noche, el shinobi que te habla): van con **temas**. Acá se avisa `SEK.evento('dormir')` y se muestra el kanji 眠.
- El reloj inteligente sigue «próximamente».
