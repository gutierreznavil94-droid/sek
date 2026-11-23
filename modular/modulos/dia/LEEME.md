# Módulo dia

**Qué hace (parte 1, pilares y cierre):** los pilares y compromisos de cada día (cumplir, tarde, omitir, extra, reprogramar, deshacer, corregir), el cierre de los días pendientes (lo sin marcar queda omitido, el límite de juego se decide, «Comer según el plan» se evalúa, lo no cumplido resta, bonus de racha cada 7 días), cumplimiento, racha, valor de los atributos, excepciones (enfermedad, viaje) y el Tajo. Por ahora es solo API: la pantalla **Hoy** como tablero, Calendario, Mi horario, feriados y fechas clave son la **parte 2**.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `resumenHoy(u)` | Todo lo de Hoy: cierra lo pendiente y devuelve `{ hoy, ciclo, pilares, cumplidos, aplican, racha, avisoResta, compromisos, excepcion, noche }`. Base de la parte 2. |
| `pilaresDelDia(u, fecha?)` | `{ fecha, pilares: [{ accion, compromiso, estado, horaLimite, vencido, ventanaCerrada, xpPrevisto }], cumplidos, aplican }`. Estado: `pendiente` · `cumplido` · `tarde` · `omitido` · `descanso`. Orden fijo: entrenamiento, empresa, manga, dormir. |
| `pilaresPorDia(u, desde, hasta)` | Estado de cada pilar por fecha (Calendario, gráfico). |
| `compromisosDelDia(u, fecha)` / `generarCompromisos(u, fecha)` | Los compromisos con su acción y XP; crearlos (idempotente, nunca antes del Día 1/Día 0 ni antes de que existiera la acción). |
| `completar(u, id, { minutos, nota, respuesta })` | Cumple y da la XP una vez. Después de la hora límite + margen (20:50 → 21:00): `tarde`, sin XP. Menos minutos que el mínimo: hecho sin XP. Compromisos sueltos: tope de XP por día. «Dormir a horario» no se marca acá (lo marca sueno). |
| `iniciar` / `omitir` / `reprogramar(u, id, fecha)` / `deshacer` | Lo demás de un compromiso. Deshacer anula su XP y su extra. |
| `marcarExtra` / `deshacerExtra` | Segunda marca (manga a los 30 min): extra de 10 XP, no cambia el cumplimiento. |
| `corregir(u, id, estado, motivo, minutos?)` | Corregir un día pasado. A cumplido: se evalúa a las 12:00 de ese día y devuelve la resta. Recalcula el día cerrado. |
| `cerrarDiasPendientes(u)` | Cierra cada día anterior cuando pasa la hora de corte (06:00 del día siguiente). Idempotente. Lo llama `resumenHoy`. |
| `ventanaNoche(u, fecha)` / `cerrarVentanaNoche(u, fecha)` | Horas de la noche (aviso 20:50, cierre 21:00, fin de «Dejo celu» 22:15); a las 21:00 lo sin marcar queda omitido. |
| `faltantesDelDia(u, fecha, abierto?)` / `avisoResta(u, hoy?)` | Lo que faltó en el formato de `xp.aplicarRestas` (pilares + series de entreno conectadas); el aviso «Te quedan 2 sin hacer: −15 XP». |
| `cumplimientoPorDia(u, desde, hasta)` / `cumplimientoEntre(u, desde, hasta)` | Por día `[{ fecha, porcentaje, nivel, excepcion, cumplidos, programados }]` / junto. Solo sobre pilares. |
| `racha(u, hoy?)` / `rachaHasta(u, fecha)` | Días seguidos ≥ `umbralRacha` (75 %). Hoy suma recién cuando los pilares cumplidos llegan al umbral sobre el total del día. La excepción no corta. |
| `atributosHoy(u)` | Valor de cada atributo (ventana móvil, de ciclo) y su tendencia contra hace 7 días. |
| `marcarExcepcion(u, fecha, motivo)` / `quitarExcepcion` / `excepciones(u, desde, hasta)` | Días que no cuentan: no restan ni cortan la racha. |
| `acciones` / `accionesConXp` / `guardarAccion(u, a, { xp })` / `activarAccion` / `cambiarXp(u, id, xp, desde?)` / `reglasDe` | Configurar pilares y compromisos. Cambiar la XP crea una regla desde hoy: lo ganado no cambia. Editar días acomoda los pendientes desde hoy. |
| `activarPilarComida(u, activo)` | Prende/apaga «Comer según el plan» (15 XP, arranca apagado). |
| `anotarVista(u)` / `tajo(u)` | El Tajo: la pantalla avisa al ocultarse; al volver pregunta. Sale si pasaron ≥ 3 h, hay un pilar pendiente, no pasó la hora de «Dejo celu» y hoy no salió. `{ mostrar, pendientes }`. |
| `sembrar(u)` | Al crear cuenta: los 7 de fábrica (entrenamiento, empresa, manga, dormir a horario, límite de juego, revisión diaria y semanal) con su XP (30, 15, 15, 20, 15, 10, 25). Anotado en `app.js`. |
| `importar(u, { acciones, reglasXp, compromisos, diasCerrados, excepciones, atributosDiarios })` | De «Copiar todo como texto» de la app vieja. Lo repetido no entra. Lo usa **copia**. |
| `exportar(u)` | Lo mismo que recibe `importar`. Lo usa **copia**. Al importar, la regla sembrada con el mismo id (`r_<acción>`) se reemplaza por la de la copia. |
| `escucharAvisos()` / `conectar({ planComida, faltantesSeries, seriesParaAtributos })` | Ver abajo. Los llama `app.js`. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos que escucha (`escucharAvisos`)

| Aviso | Qué hace dia |
|---|---|
| `ciclo.revision` | Completa «Revisión diaria» (o «semanal») de esa fecha y da su XP (10 / 25). |
| `ciclo.inicio_cambiado` | Borra días cerrados y compromisos sin resolver de antes del nuevo Día 1. |
| `ciclo.nuevo` | Crea los compromisos de hoy. |
| `sueno.dejo_celu` / `sueno.dejo_celu.deshecho` | «Dormir a horario» cumplido o tarde (con minutos); vuelve a pendiente. **Sin XP**: la da sueno (`suenio:acostarse:<noche>`). |
| `entreno.empezado` / `entreno.terminado` / `entreno.deshecho` | Entrenamiento iniciado; cumplido con 30 XP (tarde y sin XP si `inicioQueCuenta` pasó la hora límite de inicio, 19:35; sin XP con menos minutos que el mínimo); vuelve atrás. |

No emite avisos.

## Lo que le conectan (`conectar`, en `app.js`)

Para no depender de módulos que se suman después, dia recibe estas funciones (si no están, sigue andando sin ellas):

- `planComida` ← `comida.planDelDia(u, fecha)`: decide «Comer según el plan» al cerrar el día (sin comidas cargadas no cuenta).
- `faltantesSeries` ← `entreno.faltantesDelDia(u, fecha)`: las series rápidas debajo de la cuota suman a lo que resta.
- `seriesParaAtributos` ← (cuando entreno lo ofrezca) series por día para el valor de los atributos, como hacía la app vieja con los contadores.

## Datos (migración `012-dia.sql`)

- tabla `acciones`: pilares y compromisos (nombre, tipo, días, hora, hora límite, pilar, atributos, peso, activa, orden; lo demás en `opciones` JSON).
- tabla `reglas_xp`: XP de cada acción desde tal fecha.
- tabla `compromisos`: una acción en una fecha (`<accion>:<fecha>`), su estado y lo que pasó.
- tabla `dias_cerrados`: cumplimiento de cada día cerrado, minutos de juego, excepción.
- tabla `atributos_diarios`: foto del valor de cada atributo al cerrar el día.
- tabla `excepciones`: días que no cuentan.
- tabla `dia_vistas`: última vez a la vista y día en que salió el Tajo.

Ajustes propios (en `comun/ajustes.js`): `margenNocheMinutos` (10), `umbralRacha` (75), `xpRacha7` (20), `minimoProgramadosAtributo` (5), `maxCompromisosXpPorDia` (5), `xpCompromisoPorDefecto` (10). Usa también los de sueno (`horaCorteNoche`, `horaDejarCelu`, `horaLimiteCelu`, `horaAlistarse`; si faltan, 06:00, 21:15, 22:15 y 20:50) y `zonaHoraria`.

## Direcciones (`rutas.js`)

`GET /api/dia` (Hoy) · `GET /api/dia/pilares?fecha` · `GET /api/dia/compromisos?fecha` · `POST /api/dia/compromisos/:id/{iniciar,completar,omitir,deshacer,extra,deshacer-extra,reprogramar,corregir}` · `GET /api/dia/{cumplimiento,pilares-por-dia,excepciones}?desde&hasta` · `GET /api/dia/{racha,atributos,aviso-resta}` · `PUT|DELETE /api/dia/excepciones/:fecha` · `GET /api/dia/acciones` · `PUT /api/dia/acciones/:id` · `POST /api/dia/acciones/:id/activa` · `POST /api/dia/comida` · `POST /api/dia/vista` · `POST /api/dia/tajo`.

## Archivos

- `calculo.js`: cuentas puras (cumplimiento, racha, atributos, estado de pilar, regla vigente, Tajo) y los datos de fábrica. De `src/domain/cumplimiento.ts`, `src/services/dia.ts`, `acciones.ts`, `restas.ts`, `ninjas.ts` (Tajo) y `src/data/semilla.ts`.
- Sin `pantallas/` todavía (parte 2).

## Qué módulos usa

- **xp**: `sumar`, `anular`, `delDia`, `claveXp`, `asegurarInicioResta`, `aplicarRestas`, `devolverResta`, `avisoResta`.
- **ciclo**: `cicloActivo`, `diaDelCiclo`, `atributos`.
- **juego**: `limiteRespetado`, `minutosDelDia`.
- sueno, entreno, comida: solo por avisos y por `conectar` (no los requiere).

## Pendiente

- **Parte 2:** pantalla Hoy (tablero con la tarjeta de cada módulo), Calendario, Mi horario, feriados (límite de juego de finde en feriados), fechas clave, inicios, la barra de abajo y el bloqueo del modo sueño.
- **Tensión y «No cumplí»:** no tenían lógica de día en la app vieja. «No cumplí» (la caída, −20 XP y la marca) ya está en **habitos** (`registrarCaida`); Tensión, el duelo de flexiones y el 3·2·1 van con **desafios**. En la parte 2, Hoy pone los botones y llama a esas ventanillas; lo visual con `SEK.tema.escena` / `SEK.tema.medio('tajo')` de **temas**.
- El Tajo de Android (encima de otra app, «Apps que te atrapan») va con **celular**; acá queda la regla.
