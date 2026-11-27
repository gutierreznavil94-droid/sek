# Módulo dia

**Qué hace:** la pantalla **Hoy** como tablero (pilares + la tarjeta chica de cada módulo), el **Calendario**, **Mi horario**, feriados, fechas clave y el bloqueo de la app en modo sueño (parte 2). Y además (parte 1, pilares y cierre): los pilares y compromisos de cada día (cumplir, tarde, omitir, extra, reprogramar, deshacer, corregir), el cierre de los días pendientes (lo sin marcar queda omitido, el límite de juego se decide, «Comer según el plan» se evalúa, lo no cumplido resta, bonus de racha cada 7 días), cumplimiento, racha, valor de los atributos, excepciones (enfermedad, viaje) y el Tajo.

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

### Parte 2 (Hoy, Calendario, Mi horario)

| Función | Para qué |
|---|---|
| `tableroHoy(u)` | Todo lo de la pantalla Hoy: lo de `resumenHoy` + `sinCiclo`, `modoSueno`, `feriado`, `fechasClave` de hoy, `horario` (dónde estás ahora), `horas` de la noche, `pasoDejoCelu`, `deAlistarse`, `nivel` (xp) y `tarjetas: { juego, sueno, comida, entreno, habitos, organizacion, desafios }` (el `resumenHoy` de cada módulo). Una tarjeta que falla queda `null`: no rompe Hoy. |
| `empezarCiclo(u, { inicio?, duracionDias?, diaCero? })` | «Empezar mi ciclo» de una cuenta nueva (llama a `ciclo.iniciarCiclo`). Si ya hay ciclo, no lo pisa. |
| `dejoCeluDesdeHoy(u)` | «Dejo celu» desde Hoy: antes del Día 1 no registra; le pasa a sueno la línea «3 de 5 pilares · racha 4». |
| `tareaHecha(u, frente, tarea)` | ✓ de la tira «Hoy me toca a mí» (organizacion.marcarHecha). |
| `enModoSueno(u)` / `esPaginaBloqueable(ruta)` | El bloqueo: en modo sueño, toda pantalla (salvo `/sueno/modo`, `/entrar`, la API y los archivos) manda a `/sueno/modo`. Lo usa el `preHandler` de `app.js`. |
| `esFeriado` / `esDiaDeFinde` / `feriadosEntre` / `marcarFeriado(u, fecha, nombre)` / `quitarFeriado` | Feriados: límite de juego de finde (juego lo recibe con `juego.conectar({ esFeriado })`) y apagan los bloques obligatorios. Vienen cargados los de fecha fija de Argentina hasta 2027 (se pueden quitar). |
| `agregarFechaClave` / `editarFechaClave` / `borrarFechaClave` / `fechasClaveEntre` | Fechas clave (印): título, nota, anual, hora y hasta. No dan XP. Con hora, son un bloque obligatorio ese día. |
| `configHorario` / `guardarBloque` / `borrarBloque` / `copiarADias` / `nuevoHorario` / `activarHorario` / `renombrarHorario` / `borrarHorario` / `apagarBloqueEnFecha` / `correrEntreno` | Mi horario. El bloque `entreno` escribe en la acción «entrenamiento» (días, hora, «Empezar hasta»); el sueño sale de los ajustes de sueno. |
| `horarioDelDia(u, fecha?)` / `horarioSemana(u, fecha?)` | Bloques del día (con los apagados marcados), huecos libres y «Ahora: Facultad hasta 12:00 · después: …»; la semana para la pantalla. |
| `calendarioMes(u, 'AAAA-MM')` | Cada día: porcentaje, pilares, feriado, excepción, fechas clave y bloques; y dónde cae el ciclo. |
| `sembrar` / `importar` / `exportar` | Suman feriados de fábrica; `feriados`, `fechasClave` y `horario` (de los ajustes viejos) para **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida).

## Avisos que escucha (`escucharAvisos`)

| Aviso | Qué hace dia |
|---|---|
| `ciclo.revision` | Completa «Revisión diaria» (o «semanal») de esa fecha y da su XP (10 / 25). |
| `ciclo.inicio_cambiado` | Borra días cerrados y compromisos sin resolver de antes del nuevo Día 1. |
| `ciclo.nuevo` | Crea los compromisos de hoy. |
| `sueno.dejo_celu` / `sueno.dejo_celu.deshecho` | «Dormir a horario» cumplido o tarde (con minutos); vuelve a pendiente. **Sin XP**: la da sueno (`suenio:acostarse:<noche>`). |
| `desafios.inicio` | «Empecé» en el 3·2·1 con `compromisoId`: ese compromiso pasa a «iniciado». |
| `entreno.empezado` / `entreno.terminado` / `entreno.deshecho` | Entrenamiento iniciado; cumplido con 30 XP (tarde y sin XP si `inicioQueCuenta` pasó la hora límite de inicio, 19:35; sin XP con menos minutos que el mínimo); vuelve atrás. |

No emite avisos.

## Lo que le conectan (`conectar`, en `app.js`)

Para no depender de módulos que se suman después, dia recibe estas funciones (si no están, sigue andando sin ellas):

- `planComida` ← `comida.planDelDia(u, fecha)`: decide «Comer según el plan» al cerrar el día (sin comidas cargadas no cuenta).
- `faltantesSeries` ← `entreno.faltantesDelDia(u, fecha)`: las series rápidas debajo de la cuota suman a lo que resta.
- `seriesParaAtributos` ← (cuando entreno lo ofrezca) series por día para el valor de los atributos, como hacía la app vieja con los contadores.
- `desafiosHoy` ← `desafios.pendientes(u)`: los botones **Tensión** y **No cumplí** de Hoy (van a las pantallas de desafios, que guardan la caída por habitos y vuelven a Hoy).

## Datos (migración `012-dia.sql`)

- tabla `acciones`: pilares y compromisos (nombre, tipo, días, hora, hora límite, pilar, atributos, peso, activa, orden; lo demás en `opciones` JSON).
- tabla `reglas_xp`: XP de cada acción desde tal fecha.
- tabla `compromisos`: una acción en una fecha (`<accion>:<fecha>`), su estado y lo que pasó.
- tabla `dias_cerrados`: cumplimiento de cada día cerrado, minutos de juego, excepción.
- tabla `atributos_diarios`: foto del valor de cada atributo al cerrar el día.
- tabla `excepciones`: días que no cuentan.
- tabla `dia_vistas`: última vez a la vista y día en que salió el Tajo.

Migración `014-dia.sql` (parte 2):

- tabla `feriados`: fecha, nombre, `propio` (lo marcó la persona) o precargado.
- tabla `fechas_clave`: notas del calendario (título, nota, anual, hora y hasta).
- tabla `horarios`: Mi horario, un JSON por persona (`{ activo, horarios: [{ id, nombre, bloques }], excepciones: { fecha: [bloqueId] } }`).

Ajustes propios (en `comun/ajustes.js`): `margenNocheMinutos` (10), `umbralRacha` (75), `xpRacha7` (20), `minimoProgramadosAtributo` (5), `maxCompromisosXpPorDia` (5), `xpCompromisoPorDefecto` (10). Usa también los de sueno (`horaCorteNoche`, `horaDejarCelu`, `horaLimiteCelu`, `horaAlistarse`; si faltan, 06:00, 21:15, 22:15 y 20:50) y `zonaHoraria`.

## Direcciones (`rutas.js`)

Pantallas: `GET /hoy` · `GET /calendario` · `GET /horario`.

Parte 2: `GET /api/dia/hoy` · `POST /api/dia/empezar-ciclo` · `POST /api/dia/dejo-celu` · `POST /api/dia/organizacion/:frente/:tarea/hecha` · `GET /api/dia/calendario?mes` · `GET /api/dia/feriados?desde&hasta` · `PUT|DELETE /api/dia/feriados/:fecha` · `POST /api/dia/fechas-clave` · `PUT|DELETE /api/dia/fechas-clave/:id` · `GET /api/dia/horario?fecha` · `GET /api/dia/horario/dia?fecha` · `POST /api/dia/horario/bloques` · `PUT|DELETE /api/dia/horario/bloques/:id` · `POST /api/dia/horario/bloques/:id/copiar` · `POST /api/dia/horario/apagar` · `POST /api/dia/horario/correr-entreno` · `POST /api/dia/horarios` · `POST /api/dia/horarios/:id/activar` · `PUT|DELETE /api/dia/horarios/:id`.

Parte 1: `GET /api/dia` (Hoy) · `GET /api/dia/pilares?fecha` · `GET /api/dia/compromisos?fecha` · `POST /api/dia/compromisos/:id/{iniciar,completar,omitir,deshacer,extra,deshacer-extra,reprogramar,corregir}` · `GET /api/dia/{cumplimiento,pilares-por-dia,excepciones}?desde&hasta` · `GET /api/dia/{racha,atributos,aviso-resta}` · `PUT|DELETE /api/dia/excepciones/:fecha` · `GET /api/dia/acciones` · `PUT /api/dia/acciones/:id` · `POST /api/dia/acciones/:id/activa` · `POST /api/dia/comida` · `POST /api/dia/vista` · `POST /api/dia/tajo`.

## Archivos

- `ventanilla/index.js`: la puerta. Junta `pilares.js` (parte 1), `calendario.js` (feriados, fechas clave, Mi horario, Calendario) y `tablero.js` (Hoy, Empezar mi ciclo, Dejo celu, bloqueo de sueño).
- `agenda.js`: cuentas puras de la parte 2 (bloques del día, dónde estás, huecos, fechas clave anuales, feriados de fábrica). De `src/services/horario.ts`, `fechasClave.ts`, `feriados.ts`.
- `pantallas/`: `hoy.html`+`hoy.js` (tablero), `calendario.html`+`calendario.js`, `horario.html`+`horario.js`, `ayuda.js` (hoja de formulario, fechas) y `estilo.css`. Hoy carga `/m/desafios/capa.js` (frase del día y Tajo con `SEK.desafios.llegada`).
- **Orden de Hoy (0.21, pedido de Navil):** pilares chicos (icono al lado del nombre, sin «Tocá para…») con la Revisión diaria como barra fina en el mismo recuadro · series rápidas (una línea + barra de doble meta) · metas · comida en una línea (sin botón «Objetivo»: tocar Comida lleva a cargarlo) · En forja (hasta 3 cuadritos en una fila) · 3·2·1 solo. Estilos en `hoy.css`.
- `pruebas.test.js` (parte 1) y `parte2.test.js`.
- `calculo.js`: cuentas puras (cumplimiento, racha, atributos, estado de pilar, regla vigente, Tajo) y los datos de fábrica. De `src/domain/cumplimiento.ts`, `src/services/dia.ts`, `acciones.ts`, `restas.ts`, `ninjas.ts` (Tajo) y `src/data/semilla.ts`.

## Qué módulos usa

- **sueno**, **comida**, **entreno**, **habitos**, **organizacion** (parte 2): su `resumenHoy` para las tarjetas de Hoy; sueno `dejoCelu` y `modoActivo`; organizacion `marcarHecha`. Ninguno de ellos usa dia (dependencia en un solo sentido).
- **xp**: `estado` (nivel en Hoy), `sumar`, `anular`, `delDia`, `claveXp`, `asegurarInicioResta`, `aplicarRestas`, `devolverResta`, `avisoResta`.
- **ciclo**: `cicloActivo`, `diaDelCiclo`, `atributos`.
- **juego**: `limiteRespetado`, `minutosDelDia`.
- sueno, entreno, comida: solo por avisos y por `conectar` (no los requiere).

## Pendiente

- La barra de abajo quedó con 5 fijos (Hoy, Calendario, Juego, Sueño, Más), como la app vieja sin Progreso. Progreso está en Más; si Navil lo quiere fijo, serían 6.
- De la Hoy vieja quedan afuera por ahora: «Buenos días» con el ajuste de ayer (lo muestra la pantalla del modo sueño), metas de la semana (ciclo), series rápidas con toque directo (están en Entreno) y la cama del compañero (temas).
- El Tajo de Android (encima de otra app) va con **celular**; acá queda la regla.
