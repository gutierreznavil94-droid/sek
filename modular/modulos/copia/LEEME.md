# Módulo copia

**Qué hace:** la pantalla **Más → Copia de seguridad**.

1. **Traer mis datos:** pegás el texto de «Copiar todo como texto» de la app vieja (Más → Copia de seguridad), o elegís el archivo `.json`. La app te muestra qué trae cada parte y lo que no se trae; al tocar **Importar**, le da a cada módulo su parte por su ventanilla (`importar`), **todo en una sola transacción**: si algo falla, no entra nada.
2. **Guardar una copia:** baja toda tu app nueva en un archivo `sek-AAAA-MM-DD.json` (o la copia como texto). Esa copia se puede volver a importar acá (en esta cuenta o en otra).

Importar **suma** a lo que ya hay: no borra nada y lo repetido no entra dos veces (cada módulo decide qué es «repetido», ver su LEEME). La **misma copia** (mismo momento de armado) no se puede importar dos veces: responde 409 «Esta copia ya se importó».

## Pantallas

| Dirección | Archivos | Qué muestra |
|---|---|---|
| `/mas/copia` | `copia.html` + `copia.js` + `estilo.css` | Pegar o elegir la copia → «Revisar copia» (qué trae, lo que no se trae, si ya se importó) → «Importar». «Descargar copia (JSON)», «Copiar todo como texto», última copia y copias importadas. |

La fila **Copia de seguridad** (写) está en `SECCIONES` de `modulos/cuentas/pantallas/mas.js`. No va en la barra de abajo.

## Direcciones de la API

- `GET /api/copia` → `{ ultimaExportacion, importaciones: [{ origen, exportado, creado, total }], modulos }`
- `POST /api/copia/revisar` `{ texto }` → `{ origen, exportado, partes: [{ clave, nombre, filas }], total, ajustes, sinUsar: [{ tabla, filas, motivo }], yaImportada }` (no guarda nada)
- `POST /api/copia/importar` `{ texto }` → `{ origen, exportado, resultado: { <módulo>: cuántos entraron }, total, sinUsar }`
- `GET /api/copia/exportar` → la copia nueva (JSON). Con `?descargar=1` baja como archivo.

Las dos que reciben texto aceptan hasta 80 MB (las fotos de progreso y los temas propios pesan).

## Los dos formatos

| | App vieja | App nueva |
|---|---|---|
| Cabecera | `{ app: 'sistema-progreso', version: 1, exportado, tablas }` | `{ app: 'sek', formato: 'modular', version: 1, exportado, ajustes, modulos }` |
| Datos | Una lista por tabla de Dexie | `modulos.<m>` = exactamente lo que recibe `<m>/ventanilla.importar` |

`formato.js` (cuentas puras, sin base) convierte las dos a lo mismo: `{ origen, exportado, ajustes, partes, sinUsar }`.

### Qué tabla vieja va a qué módulo

| Módulo | Tablas de la copia vieja |
|---|---|
| ciclo | `ciclos`, `fases`, `objetivos`, `atributos`, `identidad`, `metas`, `revisiones` |
| dia | `acciones`, `reglasXp`, `compromisos`, `diasCerrados`, `excepciones`, `atributosDiarios` |
| xp | `xp` |
| juego | `sesionesJuego` |
| organizacion | `organizacion` |
| sueno | `suenio`, `modoSuenio` |
| habitos | `forja`, `codigo`, `caidas`, `fotos`, `marcas` + de `ajustes`: `forja`, `caida`, `codigoSembrado` |
| comida | `alimentosPropios`, `comidas`, `comidasGuardadas`, `pesos`, `agua`, `frutas` + de `ajustes`: `comida`, `agua`, `fruta` |
| entreno | `rutinas`, `sesionesEntreno`, `contadores`, `registrosContador` |
| temas | de `ajustes`: `tema` |
| comun/ajustes | la fila `ajustes` (`unicos`): todo lo que existe en `AJUSTES_INICIALES` (zona horaria, límites, horas de sueño, nombres, resta, racha…). `lluviaIntensidad` → `lluvia` (y si `fondoLluvia` estaba todo apagado → `apagada`). |

Se cargan en ese orden (ciclo antes que dia: las acciones nombran atributos).

**Lo que no se trae** (se muestra con el motivo antes de importar): `eventos` (historial viejo), `niveles`, `siguienteAccion`, `temporizador`, `recomendaciones`, y lo que todavía no tiene módulo: `ninjas` (desafíos), `feriados` y `fechasClave` (dia parte 2), `horario` de los ajustes (Mi horario, dia parte 2). Las fotos solo vienen si en la app vieja se tildó «Incluir fotos de progreso».

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `revisar(usuarioId, texto)` | Lee la copia sin guardar nada (lo de `POST /api/copia/revisar`). |
| `importar(usuarioId, texto)` | Reparte la copia a cada módulo y a los ajustes, todo o nada. Anota en `copia_registros` y en el historial común. |
| `exportar(usuarioId)` | Toda la app de la persona en un objeto (formato nuevo). Anota la exportación. |
| `estado(usuarioId)` | Última copia exportada y últimas 5 importadas. |

Todas aceptan `tx` opcional al final. Ningún otro módulo usa a copia.

## Qué módulos usa (solo por su ventanilla)

ciclo, dia, xp, juego, organizacion, sueno, habitos, comida, entreno y temas: de cada uno, `importar(usuarioId, parte, tx)` y `exportar(usuarioId, tx)`. Para sumar un módulo nuevo (por ejemplo desafíos): que su ventanilla tenga `importar` y `exportar` con la misma forma, sumarlo a `MODULOS` (y a `TABLAS_VIEJAS`, sacándolo de `SIN_LUGAR`) en `formato.js` y a `VENTANILLAS` en `ventanilla.js`.

Para esto, cada uno de esos módulos sumó a su ventanilla `exportar(usuarioId)`, que devuelve **lo mismo que recibe su `importar`** (entreno ya lo tenía). Además:
- **juego**: `importar` ya no duplica una sesión con el mismo inicio.
- **dia**: `importar` reemplaza la regla de XP sembrada con el mismo id (`r_<acción>`) por la de la copia; antes chocaba con una cuenta recién creada.

## Datos

- tabla `copia_registros`: cada importación y exportación (`tipo`, `origen` vieja/nueva, `exportado` = el momento en que se armó la copia, `resultado` = cuántos entraron de cada módulo). Índice único (persona, origen, exportado) para importaciones: la misma copia, una vez. Migración `016-copia.sql`.

## Pruebas

`pruebas.test.js` usa `ejemplo-copia-vieja.json`: una copia de la app vieja con todas las tablas que se reparten (y algunas que no). Prueba: el formato y sus errores, revisar sin guardar, que cada módulo reciba lo suyo, que no se importe dos veces, todo o nada, exportar → importar en otra cuenta deja lo mismo, y la web (sesión, 409, copia de más de 1 MB, descarga). Las cuentas de prueba se crean con la siembra de cada módulo, como una cuenta de verdad.

## Del código viejo

`src/services/exportar.ts` (`exportarTodo`, `validarExportacion`) y `src/ui/paginas/Copia.tsx`.

## Pendiente

- La app vieja **reemplazaba todo** al importar; esta **suma**. Si hace falta «vaciar y traer», es otra función (no pedida).
- Importar dos copias **distintas** que se pisan: xp, ciclo, sueño, hábitos y juego no duplican; comida (comidas, agua, fruta) y entreno (entrenos, toques) sí pueden duplicar.
- ciclo: un atributo con el mismo id que uno sembrado (p. ej. `disciplina`) no se pisa: queda el nombre de la cuenta nueva.
- CSV de registros (la vieja lo tenía): no se pidió todavía.
- Aviso «hace X días que no guardás una copia» (ajuste viejo `diasAvisoCopia`): con Hoy (dia parte 2).
- Cuando lleguen **desafios** y **dia parte 2**: sumar `ninjas`, `feriados`, `fechasClave` y `ajustes.horario`.
