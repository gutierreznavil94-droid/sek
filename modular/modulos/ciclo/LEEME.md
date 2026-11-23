# Módulo ciclo

**Qué hace:** el ciclo de 90 días (o 60, 120, 180, 365): el Día 1 y el Día 0 de calentamiento, las fases de 30 días con su foco y qué se mide, los objetivos de cada fase (con atributo, indicador, línea de base, meta y resultado), el cierre de fase, los atributos, la identidad (yo ideal y obstáculos), las metas con fecha y las revisiones diaria y semanal. Pantallas en `/ciclo` (botón **Ciclo** 道 de la barra), `/ciclo/metas`, `/ciclo/identidad` y `/ciclo/revision`.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `cicloActivo(u)` / `ciclos(u)` / `fases(u, cicloId)` | El ciclo en curso (o `null`), todos los ciclos, las fases de uno. |
| `diaDelCiclo(u, fecha?)` | `{ ciclo, fecha, dia, fase, faseNumero, terminado, noEmpezado, diaCero, fechaFin, progreso }` o `null`. Lo usa **dia** («Día 12 de 90», el Día 0 no resta) y **progreso**. |
| `iniciarCiclo(u, { inicio, duracionDias, diasPorFase, diaCero })` | Empieza un ciclo (cierra el anterior). Arma fases y metas automáticas. Avisa `ciclo.nuevo`. |
| `cambiarInicio(u, fecha)` | Mueve el Día 1 sin perder nada (regenera solo las metas automáticas). Avisa `ciclo.inicio_cambiado`. |
| `editarFase(u, id, { foco, queSeMide })` / `cerrarFase(u, id, { notas, resultados })` | Editar una fase; cerrarla con lo aprendido y el resultado de cada objetivo (desde el día siguiente a su fin; la última, que cierra el ciclo, desde que empieza). Avisa `ciclo.fase_cerrada`. |
| `objetivos(u, cicloId)` / `guardarObjetivo(u, o)` / `archivarObjetivo(u, id)` | Objetivos por fase. |
| `atributos(u, { conArchivados })` / `guardarAtributo` / `archivarAtributo` | Los atributos (nombre, descripción, ventana de días). Su **valor** lo calcula **dia**, que tiene las acciones vinculadas. |
| `identidad(u)` / `guardarIdentidad(u, { vision, obstaculos })` | Yo ideal y obstáculos. |
| `crearMeta` / `editarMeta` / `resolverMeta(u, id, lograda)` / `reabrirMeta` / `borrarMeta` | Metas propias con fecha. Cumplida da su XP (15 por defecto) una sola vez; solo 2 metas por día dan XP. Cumplida antes de tiempo cuenta el día que se marcó. |
| `resumenMetas(u, hoy?)` / `metasQueVencen(u, hoy?)` / `metasEntre(u, desde, hasta)` | Agrupadas (pendientes, vencidas, cumplidas, no cumplidas); las que esperan respuesta (para Hoy); todas con fecha en un rango (para Calendario y Progreso). |
| `revision(u, tipo, periodo)` / `guardarRevision(u, tipo, periodo, respuestas, foto)` | Revisión diaria (periodo = fecha) o semanal (cualquier día de la semana; se guarda con el lunes). Al actualizar, la foto queda la primera. La primera vez avisa `ciclo.revision`. |
| `datosRevision(u, tipo, fecha?)` / `fotoRevision` | Lo de la pantalla de revisión, con lo que xp sabe del día o la semana. |
| `ajusteParaHoy(u, hoy?)` | El «ajuste para mañana» de la revisión de ayer (para arriba de Hoy). |
| `resumen(u)` | Todo lo de la pantalla Ciclo. |
| `sembrar(u)` | Al crear una cuenta: identidad y los 5 atributos de fábrica (`disciplina`, `fisico`, `autocontrol`, `claridad`, `confianza`). El ciclo lo empieza la persona eligiendo el Día 1. Anotado en `app.js` (`sesion.alCrearCuenta`). |
| `importar(u, { ciclos, fases, objetivos, atributos, identidad, metas, revisiones })` | Trae esas tablas de «Copiar todo como texto» de la app vieja, con sus mismos id. Lo repetido no entra. Lo usa **copia**. |
| `exportar(u)` | Todo lo del ciclo (también lo cerrado y archivado), con la forma que recibe `importar`. Lo usa **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos que emite (`comun/eventos.js`)

| Aviso | Datos | Para qué (quién lo va a escuchar) |
|---|---|---|
| `ciclo.nuevo` | `{ usuarioId, ciclo, anterior }` | dia: arrancar los pilares del ciclo nuevo. |
| `ciclo.inicio_cambiado` | `{ usuarioId, ciclo, inicioAnterior }` | dia: borrar días cerrados y compromisos sin resolver de antes del nuevo Día 1 (lo hacía `cambiarInicioCiclo`). |
| `ciclo.fase_cerrada` | `{ usuarioId, fase, ciclo, esUltima }` | temas (animación), progreso. |
| `ciclo.revision` | `{ usuarioId, tipo, periodo, fecha }` | dia: completar el pilar «Revisión diaria» (o «semanal» el domingo) y dar su XP, como en la app vieja. |

## Datos (migración `006-ciclo.sql`)

Los id son texto, como en la app vieja (`ciclo_…`, `fase_…`, `meta_…`), así la copia los trae iguales.

- tabla `ciclos`: número, inicio, `dia_cero`, duración, días por fase, estado (`activo`/`cerrado`, uno solo activo).
- tabla `fases`: número, día de inicio y fin, foco, qué se mide, notas y fecha de cierre.
- tabla `objetivos`: ciclo, número de fase, atributo, título, indicador, línea de base, meta, resultado, archivado.
- tabla `atributos`: nombre, descripción, orden, ventana de días, archivado.
- tabla `identidad`: yo ideal y obstáculos (una fila por persona).
- tabla `metas`: automáticas (`inicio_ciclo`, `fin_fase`, `fin_ciclo`, `revision_semanal`) y `propia`; estado, XP, `cumplida_el`.
- tabla `revisiones`: tipo, periodo, respuestas y foto (JSON). Una por tipo y periodo.

Ajustes que usa (de `comun/ajustes.js`): `zonaHoraria`. Los nombres cortos de las fases (`nombresFases`) los edita **cuentas**.

## Archivos

- `calculo.js`: cuentas puras (fases, metas automáticas, día del ciclo, estado de las metas) y los datos de fábrica. Traído de `src/services/ciclo.ts`, `metas.ts`, `src/data/semilla.ts` y `src/domain/fechas.ts` (lo de fechas ya estaba en `comun/fechas.js`).
Pantallas (todas con el estilo de la v0.88.27: `comun/v88.css` y `SEK.v88`):
- `pantallas/ciclo.html` + `ciclo.js` (/ciclo, «Nuevo ciclo» en Más): sin ciclo, elegir el Día 1; con ciclo, cambiar la fecha de inicio o empezar uno nuevo.
- `objetivos.*` (/ciclo/objetivos): una tarjeta por fase, sus objetivos, cerrar la fase o el ciclo.
- `atributos.*` (/ciclo/atributos): valor de hoy y acciones vinculadas (de /api/dia), crear, editar, archivar.
- `identidad.*` (/ciclo/identidad): yo ideal y obstáculos.
- `metas.*` (/ciclo/metas): metas con fecha.
- `revision.*` (/ciclo/revision, ?tipo=semanal, ?fecha=): diaria en 3 pasos con los pilares del día; semanal con cumplimiento, entrenos, descanso, juego, XP, atributos y reflexión.

## Qué módulos usa

- **xp** (por su ventanilla): `sumar`, `anular`, `claveXp` y `delDia` para las metas; `delDia`, `balanceDelDia` y `xpPorDia` para la revisión.

## Pendiente (de la app vieja)

- **Revisión con pilares:** el paso 1 «Qué cumplí» mostraba los pilares del día (marcar Sí/No ahí mismo) y la semanal mostraba cumplimiento, entrenos, noches, juego e inicios. Eso lo tiene **dia** (y entreno, sueno, juego): cuando exista, la pantalla le pide esos datos y se los pasa como `foto`. Hoy muestra lo que dejó rastro en xp.
- **XP de la revisión:** ✅ la da **dia** al escuchar `ciclo.revision` (regla `revision_diaria` 10 XP, `revision_semanal` 25 XP).
- **Cierre de fase con números:** la tabla «Base / fase anterior / fase» (cumplimiento, entrenos, noches, juego, 3-2-1, XP) y los atributos de inicio y fin de fase van en **progreso**, que lee todos los módulos.
- **Valor de los atributos** y las acciones vinculadas: **dia**.
- **Metas rápidas en el calendario y en Hoy** (escribir una meta en un día, la línea verde/gris/roja): las pantallas son de **dia** (Calendario) y usan `crearMeta`, `resolverMeta`, `reabrirMeta` y `metasEntre`.
- **Siguiente acción** (tarea vaga → acción de menos de 5 min → 3·2·1): necesita Mi horario e inicios (**dia**) y el 3·2·1 (**desafios**); se muda con ellos.
- **Juramento:** era la animación al jurar una regla de «Mi código»; va con **habitos** / **temas**, no con el ciclo.
