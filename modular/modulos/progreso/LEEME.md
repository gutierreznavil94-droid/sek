# Módulo progreso

**Qué hace:** la pantalla **Progreso** (進, en **Más**): nivel, XP y racha; **道 El camino** (la montaña de XP neta día por día del ciclo, con lo ganado y lo perdido, caídas, forja y días marcados); los pilares del ciclo; «Caídas superadas»; y una sección por tema: XP (semana, mes, ciclo), pilares y atributos, sueño, fuerza (récords, volumen, progresión de cada ejercicio), comida y agua (calorías, agua, fruta, peso) y series rápidas. También el **cierre de fase con números** («Base / fase anterior / esta fase»).

**Solo lee** (REGLAS §8.4). No tiene tablas propias, no tiene rutas que escriban y no emite avisos.

## De dónde saca los datos

1. **Vistas de la base** (migración `015-progreso.sql`), para todo lo que está guardado día por día. `datos.js` lee solo estas vistas, nunca las tablas de otro módulo.
2. **Ventanillas** de otros módulos, para lo que hay que calcular con sus reglas: nivel (**xp**), racha, pilares y atributos (**dia**), día y fases del ciclo, objetivos (**ciclo**), noches estimadas (**sueno**), récords y progresión de ejercicios (**entreno**).

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `resumen(usuarioId)` | Todo lo de la pantalla principal: nivel, racha, ciclo, camino, pilares, caídas, forjados, marcas, fases empezadas y el dato clave de cada sección. |
| `camino(usuarioId)` | La montaña: `[{ fecha, dia, neto, ganado, perdido, acumulado, pilares, caida, forja, marca }]`. `[]` si el ciclo no empezó. |
| `xpEnRango(usuarioId, 'semana' \| 'mes' \| 'ciclo')` | XP por día con acumulado, y lo ganado/perdido/neto del rango. |
| `pilares(usuarioId)` | Pilares del ciclo (hechos/programados, días cumplidos) y atributos de hoy con tendencia. |
| `suenoProgreso(usuarioId)` | 30 noches (minutos, a hora, estimada) y el resumen de **sueno**. |
| `fuerza(usuarioId)` / `ejercicio(usuarioId, bloqueId)` | «Fuerza» de **entreno** + entrenos de 30 días / progresión de un ejercicio. |
| `comida(usuarioId)` | Calorías, proteína, agua y fruta de 30 días; peso de 90. |
| `series(usuarioId)` | Reps por día de cada serie rápida (30 días), hoy, semana y récord. |
| `cierreFase(usuarioId, numero)` | Números de base (7 primeros días), fase anterior y esta fase (o el ciclo entero si es la última); atributos al inicio y al final; objetivos. Cerrar la fase sigue siendo de **ciclo**. |

Todas aceptan `tx` opcional al final. Nadie usa a progreso: está arriba de todo.

## Datos

No tiene tablas. Lee estas vistas (todas con `usuario_id`), creadas en `015-progreso.sql`:

- tabla `progreso_xp_dia` (vista): ganado, perdido y neto por día, sin anulados. De `xp_registros`.
- tabla `progreso_dias` (vista): días cerrados con cumplimiento y minutos de juego. De `dias_cerrados`.
- tabla `progreso_entrenos_previstos` (vista): compromisos de entrenamiento. De `compromisos` + `acciones`.
- tabla `progreso_atributos_dia` (vista): foto diaria de cada atributo con su nombre. De `atributos_diarios` + `atributos`.
- tabla `progreso_noches` (vista): noches guardadas (a hora, retraso). De `suenio`.
- tabla `progreso_entrenos` (vista): entrenos terminados con rutina y minutos. De `sesiones_entreno` + `rutinas`.
- tabla `progreso_series_dia` (vista): reps por día de cada serie rápida. De `registros_contador` + `contadores`.
- tabla `progreso_comida_dia` (vista): calorías y proteína por día. De `comidas`.
- tabla `progreso_agua_dia` (vista): ml por día. De `agua_tomas`.
- tabla `progreso_fruta_dia` (vista): frutas por día. De `frutas`.
- tabla `progreso_pesos` (vista): un peso por día. De `pesos`.
- tabla `progreso_caidas` (vista): caídas. De `caidas`.
- tabla `progreso_marcas` (vista): días marcados. De `marcas_dia`.
- tabla `progreso_forja` (vista): hábitos de la forja con sus días cumplidos. De `forja_habitos`.

**Ojo para los demás módulos:** si una migración cambia una columna que usa una de estas vistas, PostgreSQL no la deja borrar: esa migración tiene que rehacer la vista (`CREATE OR REPLACE VIEW`).

## Archivos

- `calculo.js`: cuentas puras (camino, pilares en rango, días cumplidos, series diarias, números de un período). Traído de `Progreso.tsx` y `CierreFase.tsx`.
- `pantallas/progreso.html` + `progreso.js`: la pantalla principal, en `/progreso`.
- `pantallas/seccion.html` + `seccion.js`: una sección a pantalla completa, en `/progreso/seccion?cual=xp|pilares|sueno|fuerza|comida|series`.
- `pantallas/fase.html` + `fase.js`: cierre de fase igual que la v0.88.27, en `/progreso/fase?numero=N`: números (base, fase anterior, esta), atributos, objetivos con su resultado real y «Cerrar fase» (lo cierra el módulo ciclo). Hoy muestra «Terminó la fase N · Revisar» (`faseSinCerrar` de `/api/dia/hoy`) y «Ciclo terminado».

## Qué módulos usa

xp, ciclo, dia, sueno, entreno y desafios («Inicios con 3-2-1» del cierre de fase), solo lectura, por su ventanilla. La entrada está en **Más** (fila en `modulos/cuentas/pantallas/mas.js`); no suma botón a la barra de abajo.

## Pendiente (de la app vieja)

- Ninjas vencidos de la semana: archivados en la app vieja; llegan con **desafios** si se prenden.
- Video de fondo del día y animación del camino del Shinobi (`Camino.tsx`, `TumbaRota`): los dibuja **temas** (`SEK.tema.fondo`, `SEK.tema.escena`).
- Metas de la semana y «Mi código» dentro de Progreso: ya tienen su pantalla en **ciclo** (/ciclo/metas) y **habitos** (/habitos); se pueden sumar como botones si Navil quiere.
- Fotos de progreso: tienen su pantalla en **habitos**.
- Tabla de niveles con la fecha en que se alcanzó cada uno (la vieja tabla `niveles` no se importa).
