# Mapa de módulos de SEK

Un módulo por tema de la vida. Cada uno tiene la misma forma (ver `modulos/juego/`) y se habla con los demás **solo por su `ventanilla.js`**. Las dependencias van en un solo sentido; para avisar «al revés» se usa `comun/eventos.js`.

## Quién usa a quién

```
                 progreso (solo lee)        copia (importa/exporta)
                        │                          │
                        ▼                          ▼
   dia (pilares + Hoy) ───────────────► todos los demás, por su ventanilla
     │      │      │
     ▼      ▼      ▼
   ciclo   juego  xp ◄── entreno, sueno, comida, habitos, desafios, ciclo
     │
     ▼
    xp
   organizacion, cuentas, temas: no usan otros módulos
```

Avisos «al revés» (el que emite no conoce a quien escucha):

| Aviso | Lo emite | Lo escucha |
|---|---|---|
| `juego.terminado` | juego | (desafios: Tajo; celular) |
| `entreno.empezado` | entreno | dia (pilar «iniciado») |
| `entreno.terminado` | entreno | dia (pilar Entrenamiento) |
| `entreno.deshecho` | entreno | dia (desmarcar el pilar) |
| `sueno.dejo_celu` | sueno | dia (pilar Dormir a horario) |
| `comida.registrada` | comida | dia (pilar Comer según el plan) |
| `organizacion.tarea.hecha` | organizacion | (temas: animación) |
| `ciclo.nuevo`, `ciclo.inicio_cambiado` | ciclo | dia (pilares del ciclo nuevo; limpiar días de antes del Día 1) |
| `ciclo.revision` | ciclo | dia (pilar «Revisión diaria/semanal» y su XP) |
| `ciclo.fase_cerrada` | ciclo | (temas: animación; progreso) |
| `xp.nivel` | xp | temas (animación de nivel) |

## Orden de la mudanza (un hilo por módulo)

| # | Módulo | Depende de | Tamaño |
|---|---|---|---|
| 0 | **comun + juego** | — | ✅ hecho (esqueleto y ejemplo) |
| 1 | cuentas | — | chico |
| 2 | xp | — | chico |
| 3 | organizacion | — | medio (ya está sin React) |
| 4 | ciclo | xp | medio |
| 5 | dia | xp, ciclo, juego | grande |
| 6 | entreno | xp | grande |
| 7 | sueno | xp | medio |
| 8 | comida | xp | medio |
| 9 | habitos | xp | medio |
| 10 | desafios | xp, entreno | medio |
| 11 | temas | — | grande (visual) |
| 12 | progreso | todos (solo lee) | grande |
| 13 | copia | todos | chico |
| 14 | celular (APK) | rutas de todos | grande (Android) |

Los módulos 1, 2 y 3 se pueden hacer a la vez. Después 4 y 5 en orden. Del 6 al 11 a la vez (solo necesitan xp). 12, 13 y 14 al final.

---

## 1. cuentas
**Qué hace:** la pantalla **Más**: ajustes de la persona (zona horaria, límites, nombres de la app y de las fases), cambiar contraseña, salir.
**Del código viejo:** `src/ui/paginas/Mas.tsx`, `Ajustes.tsx`, `TemaYNombres.tsx` (solo nombres), `Identidad.tsx` no (va en ciclo).
**Tablas:** ninguna propia (usa `comun/ajustes.js`).
**Usa:** solo `comun/`.
**Ofrece:** nada a otros módulos; suma el botón **Más** a la barra.

## 2. xp
**Qué hace:** sumar y restar puntos con clave única (nunca dos veces), anular con motivo, niveles (base × n), «lo no cumplido resta la mitad», historial de XP.
**Del código viejo:** `src/domain/xp.ts`, `niveles.ts`, `resta.ts`, `cuotas.ts`; `src/services/xp.ts`, `restas.ts`; `src/ui/paginas/Historial.tsx`.
**Tablas:** `xp_registros`.
**Usa:** solo `comun/`.
**Ofrece:** `sumar`, `anular`, `estado` (nivel, progreso), `historialXp`, `importar`. Emite `xp.nivel`.

## 3. organizacion
**Qué hace:** frentes y tareas (Anotar, Clasificar, Hoy, Sueltas).
**Del código viejo:** `src/organizacion/` entera (ya no usa React ni SEK). Pasar los `.ts` a `.js` y su `Almacen` a rutas `GET/PUT /api/organizacion`. Su `CONTRATO.md` pasa a ser el LEEME.
**Tablas:** `organizacion_datos` (un JSON por persona).
**Usa:** solo `comun/`.
**Ofrece:** `resumenHoy` (para la tira de Hoy), `importar`. Emite `organizacion.tarea.hecha`.

## 4. ciclo
**Qué hace:** ciclo de 90 días (o más), fases 30/60/90, objetivos, atributos, identidad, metas, revisión diaria y semanal, cierre de fase, juramento.
**Del código viejo:** `src/services/ciclo.ts`, `metas.ts`, `revisiones.ts`, `metasRapidas`; `src/domain/fechas.ts` (día del ciclo, fase); páginas `Objetivos`, `Atributos`, `Identidad`, `Juramento`, `CierreFase`, `Metas`, `RevisionDiaria`, `RevisionSemanal`, `SiguienteAccion`.
**Tablas:** `ciclos`, `fases`, `objetivos`, `atributos`, `identidad`, `metas`, `revisiones`.
**Usa:** xp.
**Ofrece:** `cicloActivo`, `diaDelCiclo(fecha)` (día y fase), `atributos`, `sembrar` (al crear cuenta), `importar`.
**Hecho (migración 006):** ver `modulos/ciclo/LEEME.md`. `SiguienteAccion` se muda con **dia**/**desafios** (usa horario, inicios y 3·2·1) y `Juramento` con **habitos**/**temas** (es la animación de «Mi código»). La tabla de números del cierre de fase y de la revisión semanal va en **progreso**.

## 5. dia
**Qué hace:** los pilares y compromisos de cada día (cumplir, tarde, omitir, extra, deshacer), cerrar los días pendientes, racha, excepciones, feriados, fechas clave, Mi horario, Calendario y la pantalla **Hoy** como tablero (cada módulo le presta su tarjeta).
**Del código viejo:** `src/services/dia.ts` (747 líneas, el más enredado), `acciones.ts`, `horario.ts`, `feriados.ts`, `fechasClave.ts`, `inicios.ts`; `src/domain/cumplimiento.ts`; páginas `Hoy` (1003 líneas), `Acciones`, `Calendario`, `MiHorario`, `Protocolo321` (o en desafios).
**Tablas:** `acciones`, `compromisos`, `dias_cerrados`, `excepciones`, `feriados`, `fechas_clave`, `horarios`.
**Usa:** xp, ciclo, juego (`limiteRespetado`) y las tarjetas de los demás a medida que existan.
**Ofrece:** `pilaresDelDia`, `cumplimientoPorDia`, `racha`, `sembrar`, `importar`. Escucha `entreno.terminado`, `sueno.dejo_celu`, `comida.registrada`.
**Ojo:** es grande; conviene partirlo en dos hilos: «pilares y cierre del día» y «Hoy como tablero».

## 6. entreno
**Qué hace:** rutinas con bloques (series, temporizador, rondas, casilla), ejercicios enlazados entre rutinas, sesión con descanso y sombra, planes, series rápidas (contadores) y cuotas.
**Del código viejo:** `src/services/entreno.ts` (1083 líneas), `contadores.ts`; `src/data/planes.ts`; páginas `Rutinas`, `Entreno`, `Entrenamiento`, `Contadores`.
**Tablas:** `rutinas`, `sesiones_entreno`, `contadores`, `registros_contador`.
**Usa:** xp.
**Ofrece:** `resumenHoy`, `repsDe(contador)` (para desafios), `importar`. Emite `entreno.terminado`.

## 7. sueno
**Qué hace:** «Dejo celu», noches, estimar el sueño, adaptación por etapas, modo sueño.
**Del código viejo:** `src/services/suenio.ts`, `dormir.ts`, `adaptacion.ts`; `src/sueno/`; páginas `Sueno`, `ModoSuenio`.
**Tablas:** `suenio`, `modo_suenio`.
**Usa:** xp.
**Ofrece:** `resumenHoy`, `importar`. Emite `sueno.dejo_celu`.

## 8. comida
**Qué hace:** comidas con alimentos, comidas guardadas, objetivo, peso, agua con envases, fruta del día.
**Del código viejo:** `src/services/comidas.ts`, `agua.ts`, `fruta.ts`; `src/comidas/alimentos.json`; páginas `Comida`, `Agua`, `Fruta`.
**Tablas:** `comidas`, `alimentos_propios`, `comidas_guardadas`, `pesos`, `agua_config`, `agua_tomas`, `frutas`.
**Usa:** xp.
**Ofrece:** `resumenHoy`, `importar`. Emite `comida.registrada`.

## 9. habitos
**Qué hace:** la Forja (piedra que se agrieta, 30 días / 28 válidos), Mi Código (reglas propias), caídas y nuevo round, fotos y marcas de progreso.
**Del código viejo:** `src/services/forja.ts`, `codigo.ts`, `caidas.ts`, `fotos.ts`; `src/domain/forja.ts`; páginas `MiCodigo`, `Forja`, `FotosMarcas`, `Caida`.
**Tablas:** `forja_habitos`, `codigo_reglas`, `caidas`, `fotos_progreso`, `marcas_dia` (migración 011).
**Usa:** xp.
**Ofrece:** `resumenHoy`, `importar`.

## 10. desafios
**Qué hace:** Tensión y «No cumplí» con flexiones, el Tajo, el 3·2·1, la frase «Dudar es fracasar». Guardados y apagados adentro: rival, ninjas, duelo y batalla.
**Del código viejo:** `src/services/batalla.ts`, `rival.ts`, `ninjas.ts`, `duelo.ts`; páginas y componentes `Tension`, `Tajo`, `Protocolo321`, `FraseDuda`, `Rival`, `Ninja`, `Duelo`, `Batalla`, `ChipsBatallas`.
**Tablas:** `ninjas`, `config_desafios`.
**Usa:** xp, entreno (reps de flexiones).
**Ofrece:** `pendientes` (para Hoy), `importar`.

## 11. temas
**Qué hace:** elegir el tema, temas subidos por cada persona (el de Nay sería uno), y lo animado del Shinobi: escenas, compañero que camina, lluvia, Tajo, forja, polvo de tinta. Es la **mudanza pendiente** de las animaciones de `src/ui/` a temas.
**Del código viejo:** `src/temas/` (todo), `src/ui/animaciones/`, `FondoLluvia`, `Companero`, `Desintegrar`, `TintaPolvo`, `PapelMojado`, `public/temas/`, `src/fondos/`; y `/mnt/project-files/tema-sek/`.
**Tablas:** `temas_propios`.
**Usa:** solo `comun/`. Los colores generales siguen en `comun/pantalla/estilo.css`; un tema cambia esas variables.
**Ofrece:** `temaDe(usuario)`; un `tema.js` para pantallas que escucha los avisos visuales (`completar`, `logro`, `xp.nivel`).

## 12. progreso
**Qué hace:** la pantalla Progreso: montaña de XP por día, camino del ciclo, atributos, estadísticas de juego, sueño, entreno y comida. **Solo lee** (REGLAS §8.4), con vistas de la base.
**Del código viejo:** `src/ui/paginas/Progreso.tsx` (1194 líneas), `temas/shinobi/Camino.tsx`, `TumbaRota`.
**Usa:** las ventanillas de todos (solo lectura) o vistas SQL.

## 13. copia
**Qué hace:** pegar el texto de «Copiar todo como texto» de la app vieja y repartirlo a cada módulo (`ventanilla.importar`), todo en una transacción. Exportar todo de la nueva.
**Del código viejo:** `src/services/exportar.ts`, `src/ui/paginas/Copia.tsx`.
**Usa:** la ventanilla de todos.

## 14. celular (APK)
**Qué hace:** el APK con Capacitor abre el servidor en vez de llevar la app adentro. Lo nativo sigue en Java: alarmas, widgets, notificaciones, Tajo encima, «Apps que te atrapan» y «Mis juegos del celu», buscar actualización.
**Del código viejo:** `android/`, `src/nativo/sek.ts`, `src/ui/PuenteAndroid.tsx`, `src/reminders/`, `src/services/alarmas.ts`, `widgets.ts`, `juegoCelu.ts`, `actualizacion.ts`; páginas `AlarmasTelefono`, `AppsQueAtrapan`, `JuegosCelu`, `Actualizar`.
**Necesita antes:** el servidor de prueba (REGLAS §7) para que el APK tenga a dónde conectarse.
