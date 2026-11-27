# Módulo desafios

**Qué hace:** los momentos de la duda. **Tensión** (la escena de la mano: si la das, «進 Avanzá igual.» y el duelo; si no, la caída), **No cumplí** (caída, −XP, nuevo round), el **duelo de flexiones** (la serie rápida de flexiones; después de «No cumplí», la serie más la mitad), el **Tajo** (volver después de horas con un pilar pendiente corta la pantalla), la frase **«Dudar es fracasar»** una vez por día y el **3·2·1** (contar y empezar, con un poco de XP).
Guardados y apagados adentro (archivado v0.86, hasta pulirlos): ninjas de la distracción, rival escurridizo y batalla. Su lógica y su tabla están; no tienen pantalla.

Pantallas: `/desafios` (Más → **Desafíos** 進: los tres botones, lo de hoy, ajustes y «Probar»), `/desafios/321` (desde Hoy, igual a la v0.88.27, con el hueco libre de Mi horario). «Siguiente acción» se sacó en la 0.21 (Navil: el 3·2·1 hace lo mismo y es más enfocado), `/desafios/tension` y `/desafios/no-cumpli` (hacen todo y vuelven a `?volver=`, Hoy por defecto).

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `config(u)` / `cambiarConfig(u, cambios)` | Ajustes propios (abajo). Guarda solo lo que viene; si un dato está mal no guarda nada. |
| `pendientes(u)` | **Para Hoy (dia):** `{ tension: { ruta, activa, kanji }, noCumpli: { ruta }, tresDosUno: { ruta }, pendientes: [] }`. dia lo recibe conectado desde `app.js` (no requiere esta ventanilla). |
| `llegada(u, { pilarPendiente, pasoDejoCelu, modoSueno })` | Al abrir Hoy: `{ frase, tajo, tension }`. Lo que vuelve en `true` queda marcado como mostrado hoy. Deja la última vista en «ahora». |
| `vista(u)` | Anota la última vez a la vista (al ocultarse la pantalla). Para el Tajo. |
| `configDuelo(u, motivo)` / `anotarDuelo(u, motivo, reps?)` | `motivo`: `tension`, `caida`, `rival`. Las flexiones se anotan como una serie hecha con `entreno.sumarToque` (su XP y sus topes). Sin serie rápida no anota. |
| `noCumpli(u, fecha?)` / `tensionSoltar(u)` | La caída (con `habitos.registrarCaida`, origen `boton` / `tension`) y el duelo que sigue: `{ caida, duelo }`. |
| `deshacerCaida(u, id)` / `xpDeCaida(u)` | «Deshacer» 10 s / cuánto saca una caída (ajuste `caida` de habitos). |
| `registrarInicio(u, { accion, tareaAmbigua?, compromisoId? })` | «Empecé» en el 3·2·1: XP (5) una vez por acción y día, tope 3 por día. Avisa `desafios.inicio`. |
| `iniciosRecientes(u)` / `iniciosEntre(u, desde, hasta)` | Para la pantalla y para **progreso** / cierre de fase («3-2-1 usados»). |
| `prepararPelea`, `registrarPelea`, `peleasDelDia`, `prepararBatalla`, `terminarBatalla`, `rendirse`, `robarXp`, `chipsDelDia`, `ninjasVencidosSemana`, `momentoActivo`, `accionDePelea`, `fraseDePelea` | Archivado. Con `ninjas: false` (lo de siempre) no aparece ninguno. El robo nunca baja de nivel. |
| `resumen(u)` | Todo lo de la pantalla Desafíos. |
| `importar(u, { ninjas, siguienteAccion, ajustes })` / `exportar(u)` | Para **copia**. De los ajustes viejos toma `tension`, `ninjas`, `distracciones`, `batalla` (y `repsSinSerie` → duelo), `rival`, `xpInicio`, `maxIniciosXpPorDia`. Lo repetido no entra. |

Todas aceptan `tx` opcional al final.

## En el navegador: `/m/desafios/capa.js` → `SEK.desafios`

Cualquier pantalla lo carga después de `marco.js`. Todo devuelve una promesa que termina al cerrarse; `prueba: true` solo muestra.

| | Para qué |
|---|---|
| `llegada({ pilarPendiente, pasoDejoCelu, modoSueno })` | Para Hoy: la frase del día y el Tajo si tocan. Anota la última vista al ocultarse la pantalla. |
| `botones(contenedor, { fecha })` | Pone «進 Tensión» (si está prendida) y «No cumplí». |
| `tension()`, `noCumpli({ fecha })`, `caida({ origen })`, `duelo(motivo)`, `frase({ dia })`, `tajo()` | Cada escena. |

Las escenas salen del tema: `SEK.tema.escena('tension/t1-mirada'…)` (Tensión), `escena('caida/t6-tumba-regreso')` (caída), `medio('tajo')` (Tajo), `fondo('rayos')` (frase del día). Si el tema no las trae (temas subidos), la versión simple: kanji, texto y botones. Eventos visuales que pide: `pelear`, `xp-perdida`, `logro`, `aparecer`, `completar`. Con «reducir movimiento», cuadros quietos.

## Avisos que emite (`comun/eventos.js`)

- `desafios.inicio` → `{ usuarioId, inicioId, fecha, accion, compromisoId }` (dia pasa el compromiso a «iniciado»).

## Datos (migración `013-desafios.sql`)

- tabla `config_desafios`: `datos` JSON (ajustes de abajo) y las marcas `ultima_vista`, `tajo_dia`, `frase_dia`.
- tabla `inicios`: cada 3·2·1 (`accion`, `fecha`, `creado`, `iniciado`, `resultado`, `compromiso_id`, `id_viejo`).
- tabla `ninjas`: peleas con las distracciones (archivado): `distraccion`, `momento`, `resultado` (vencido / escapo), `reps`, `robo`.

Ajustes propios (en `config_desafios`, no en `comun/ajustes.js`): `tension` `{ activa, kanji: '進', frase: 'Avanzá igual.' }`, `fraseDelDia` (sí), `tajo` `{ activo, horas: 3 }`, `duelo` `{ contadorId: null, repsSinSerie: 10 }`, `inicio` `{ xp: 5, maxPorDia: 3 }`; archivado: `ninjas` (no), `distracciones`, `batalla`, `rival`. Lee de `comun/ajustes.js`: `zonaHoraria` y `caida` (de habitos).

## Archivos

- `calculo.js`: cuentas puras (configuración, reps del duelo, Tajo, ninjas, batalla, robo). De `src/services/duelo.ts`, `ninjas.ts`, `batalla.ts`, `rival.ts`, `inicios.ts`.
- `pantallas/capa.js` + `capa.css`: las escenas encima de cualquier pantalla. De `Tension.tsx`, `Tajo.tsx`, `FraseDuda.tsx`, `Caida.tsx`, `Duelo.tsx`, `EscenaTension.tsx`.
- `pantallas/desafios.html/.js`, `321.html/.js`, `hueco.js` (el hueco libre y los pendientes para el 3·2·1), `accion.html/.js`, `estilo.css` (solo Más → Desafíos). Estilo de `comun/v88.css`.

## Qué módulos usa

- **xp** (`sumar`, `restar`, `estado`, `delDia`, `claveXp`), **entreno** (`listarContadores`, `sumarToque`), **habitos** (`registrarCaida`, `deshacerCaida`, `caidasDelDia`). Ninguno de ellos usa desafios.

## Cambios fuera del módulo

- `app.js`: registra sus rutas.
- `modulos/cuentas/pantallas/mas.js`: fila **Desafíos** (進) en Más. No suma botón a la barra de abajo.

## Pendiente

- Que **dia** ponga en Hoy los botones (rutas de `pendientes`) y llame a `SEK.desafios.llegada` con `pilarPendiente` / `pasoDejoCelu` / `modoSueno` (sin eso no salen la frase del día ni el Tajo; en Más → Desafíos → Probar se ven igual).
- 3·2·1: los chips con los compromisos pendientes del día y el «tenés N min libres» de Mi horario (son de **dia**; se pueden pasar con `?accion=&compromiso=`).
- Tensión: las manchitas de rivales que se acercan en la espera, la carga del horizonte y los sonidos (lluvia, taiko, estampida): no se mudaron.
- El Tajo encima de otra app (Android, `TajoActivity`) y «Apps que te atrapan»: van con **celular**.
- Rival, ninjas, duelo con personajes y batalla: sin pantalla hasta que Navil los quiera de vuelta.
