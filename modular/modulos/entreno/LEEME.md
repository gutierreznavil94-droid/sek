# Módulo entreno

**Qué hace:** rutinas con bloques (ejercicio con series, calentamiento, temporizador, cronómetro de colgarse, rondas, casilla), ejercicios enlazados entre rutinas, el entreno en curso (series, descanso con 3·2·1 y sombra, relojes, peso de hoy, objetivo y sugerencia), XP extra por mejorar (récord +5, subir peso +10, tope 20), planes para empezar y las **series rápidas** (flexiones, dominadas) con cuota, extra y propuesta de subir.
Pantallas: `/entreno` (inicio, botón **Entreno** 鍛 de la barra), `/entreno/rutina?id=` (editor con guardado automático), `/entreno/sesion` (entreno en curso), `/entreno/series` (series rápidas).

## Lo que ofrece su ventanilla (`ventanilla/index.js`)

| Función | Para qué |
|---|---|
| `listarRutinas(u, { inactivas, borradas })` / `obtenerRutina(u, id)` | Rutinas en orden. |
| `guardarRutina(u, rutina)` | Crear o editar (valida). Cambiar el peso a mano empieza un tramo nuevo. Copia los bloques enlazados a las otras rutinas. |
| `crearRutina` / `borrarRutina` / `ordenarRutinas` | Borrar una rutina con entrenos la deja «borrada» para el historial. |
| `sumarBloqueARutinas(u, origen, bloqueId, destinos)` | «Sumar a otra rutina»: mismo id = enlazado (comparten historial, récords y peso). |
| `mismoNombreEnOtraRutina` / `responderEsElMismo(u, rutina, bloque, otro, si)` | La pregunta «¿Es el mismo?». No = queda `separado`. |
| `planes()` / `aplicarEleccion(u, { modo: 'plan', planId } \| { modo: 'poco' } \| { modo: 'cero' }, { reemplazar, diasPilar })` | Elegir cómo empezar. |
| `diasDeRutinas(u)` / `rutinaDelDia(u, fecha)` | Para el pilar Entrenar (**dia**). |
| `iniciarEntreno(u, rutinaId, fecha?)` y `registrarSerie`, `fijarPeso`, `corregirSerie`, `deshacerSerie`, `marcarBloque`, `saltarBloque`, `irABloque`, `moverBloque`, `terminarDescanso`, `alargarDescanso`, `iniciarReloj`, `saltarPreparacion`, `pararReloj`, `terminarCronometro`, `corregirTiempo` | El entreno en curso. Vive en la base: cerrar la app no lo pierde. |
| `terminarEntreno` / `reabrirEntreno` / `reiniciarEntreno` / `descartarEntreno` | XP extra con una sola clave por entreno (`entrenamiento:extra:<id>`): volver a terminar lo recalcula, nunca suma dos veces. |
| `vistaEntreno(u, id)` | Todo lo de la pantalla del entreno. |
| `progresionEjercicio`, `historialTiempo`, `historialEntrenos`, `resumenFuerza(u, hoy, desde)` | Historial y la tarjeta «Fuerza» (para **progreso**). |
| `listarContadores`, `guardarContador`, `sumarToque`, `deshacerUltimoToque`, `borrarRegistro`, `propuestasDeSubida`, `responderPropuesta`, `resumenSeries` | Series rápidas. |
| `repsDe(u, contadorId, fecha?)` | Reps de un día (para **desafios**: flexiones). |
| `faltantesDelDia(u, fecha)` | Series rápidas debajo de la cuota, en el formato de `xp.aplicarRestas` (lo junta **dia** con los pilares). |
| `resumenHoy(u, fecha?)` | Tarjeta de Hoy: qué rutina toca, entreno en curso o hecho, series rápidas. |
| `sembrar(u)` | Al crear cuenta: flexiones y dominadas (anotado en `app.js`). Las rutinas se eligen en pantalla. |
| `importar(u, { rutinas, sesionesEntreno, contadores, registrosContador })` / `exportar(u)` | Para **copia**. |

Todas aceptan `tx` opcional al final.

## Avisos que emite (`comun/eventos.js`)

- `entreno.empezado` → `{ usuarioId, sesionId, fecha, inicio }` (dia: pilar «iniciado»).
- `entreno.terminado` → `{ usuarioId, sesionId, rutinaId, fecha, inicio, inicioQueCuenta, fin, minutos }` (dia marca el pilar; con `inicioQueCuenta` decide si fue «tarde», 19:35).
- `entreno.deshecho` → `{ usuarioId, sesionId, fecha, quedaIniciado, motivo }` al reabrir, reiniciar o descartar (dia desmarca el pilar; vuelve a «iniciado» si `quedaIniciado`).

## Datos (migración `008-entreno.sql`)

- tabla `rutinas`: `bloques` y `dias` en JSON. Clave (usuario, id).
- tabla `sesiones_entreno`: columnas fijas + `datos` JSON (paso, orden, series, hechos, saltados, pesos, descanso, reloj, tiempos, base, xpExtra…).
- tabla `contadores`: configuración en `datos` JSON (cuota, extra, `historialCuota`…).
- tabla `registros_contador`: cada toque.

## Archivos

- `calculo.js`: cuentas puras (descanso, relojes, marcas, récords, cuotas). De `src/services/entreno.ts` y `src/domain/cuotas.ts`.
- `planes.js`: planes (Nay, Gimnasio A·B·C), rutina de ejemplo y series rápidas iniciales. De `src/data/planes.ts` y `semilla.ts`.
- `ventanilla/`: `index.js` (la puerta), `rutinas.js`, `entrenos.js`, `series.js`, `ayuda.js`.
- `pantallas/`: `entreno`, `rutina`, `sesion`, `series` (.html + .js) y `estilo.css`.

## Qué módulos usa

- **xp** (`sumar`, `anular`, `devolverResta`, `claveXp`). Nada más.

## Diferencias con la app vieja

- El pilar Entrenamiento ya no lo toca entreno: lo hace **dia** escuchando los avisos. Tampoco «igualar los días del pilar» (dia puede usar `diasDeRutinas`).
- XP extra: en la vieja se daba si ese día existía el pilar; acá, si alguna rutina activa tiene ese día de la semana.
- Series rápidas: la vieja no dejaba tocar antes del Día 1 del ciclo y contaba la propuesta desde el inicio del ciclo. Acá no depende de **ciclo**: la propuesta cuenta desde que existe la serie. `resumenSeries(u, hoy, desde)` recibe el inicio si se quiere el ciclo.
- Al importar, los entrenos toman un id nuevo (el viejo queda en `idViejo`): reabrir un entreno importado no anula su XP extra viejo.

## Pendiente

- Gráfico de progresión de cada ejercicio y «Fuerza» en pantalla (la API ya está: `/api/entreno/ejercicios/:bloqueId`, `/api/entreno/fuerza`); va con **progreso**.
- Editor de rutina: bloques plegables (con muchas rutinas queda largo) y textos aún más simples.
- Alarmas/vibración del descanso con la pantalla apagada: va con **celular**.
