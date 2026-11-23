# Módulo organizacion

**Qué hace:** notas y tareas por **frentes**: Anotar (va a la Bandeja), Clasificar (quién, importancia, rapidez, dónde y fecha son obligatorios), «Hoy me toca a mí», Sueltas (cosas sin proyecto), frentes que se crean, finalizan, reabren y eliminan, sugerir frente, historial de hechas y Deshacer. Traído de `src/organizacion/` de la app vieja (su `CONTRATO.md` pasó a ser este LEEME). Las tareas **no dan XP**.

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `leer(usuarioId)` | `{ datos, actualizado, hoy }`. Si no guardó nada, arranca con Sueltas y Personal. |
| `guardar(usuarioId, datos, antes?)` | Guarda todo el JSON (lo manda la pantalla). Lo valida con `normalizar`. Si `antes` no coincide con lo guardado (otro teléfono guardó en el medio), no pisa: error 409. Avisa `organizacion.tarea.hecha` por cada tarea que recién pasó a hecha. |
| `resumenHoy(usuarioId)` | Para la tira «Hoy me toca a mí» de la pantalla Hoy (módulo **dia**): `{ hoy, limite, tareas: [{ frente, tarea }], meToca, bandeja, hechas, total, porcentaje }`. |
| `marcarHecha(usuarioId, frenteId, tareaId)` | El ✓ de la tira de Hoy. Devuelve `resumenHoy`. |
| `importar(usuarioId, viejo)` | Trae la tabla `organizacion` de «Copiar todo como texto» de la app vieja (o el objeto de datos). Reemplaza lo que haya. Lo usa el módulo **copia**. |

Todas aceptan `tx` opcional al final (transacción compartida). «Hoy» es el día en la zona horaria de la persona (`comun/ajustes.js`).

## Avisos que emite (`comun/eventos.js`)

- `organizacion.tarea.hecha` → `{ usuarioId, frente: { id, nombre }, tarea }`

## Rutas

- `GET /organizacion` la pantalla. `?abrir=anotar` o `?abrir=<id de frente>` abre esa hoja al entrar (para accesos directos y widgets).
- `GET /api/organizacion` → `{ datos, actualizado, hoy, nombre }`.
- `PUT /api/organizacion` con `{ datos, antes }` → `{ datos, actualizado, hoy }`.
- `GET /m/organizacion/modelo.js` las reglas, para la pantalla.

## Datos

- tabla `organizacion_datos`: una fila por persona con todo en un JSON (`datos`) y `actualizado` (ms). Migración `005-organizacion.sql`.

Formato 1 (solo se suman campos; las migraciones van en `normalizar()` y nunca borran lo cargado):

```
{
  formato: 1,
  frentes: Frente[],      // el primero suele ser «Sueltas» (tipo: 'sueltas')
  archivados: Frente[],   // finalizados (se pueden reabrir)
  bandeja: ItemBandeja[], // anotado sin clasificar
  ajustes: { limiteHoy: 3, sugerir: true, vista: 'todo' | 'solo' }
}
Frente = { id, nombre, tipo?: 'sueltas', icono, color, sub?, nota?, movido: 'AAAA-MM-DD', palabras?, no?, tareas: Tarea[], finalizado? }
Tarea  = { id, texto, estado: 'por_hacer' | 'hecho', quien: 'yo' | 'delegar' | 'alguien', quienNombre?,
           imp?: 'alta' | 'media' | 'baja', rapidez?: 'rapida' | 'lenta', donde?: 'celu' | 'compu' | 'calle',
           fecha?: 'AAAA-MM-DD', creada: ms, hecha?: ms }
ItemBandeja = { id, texto, frente?, previo?, creada: ms }
```

Sin `donde` = «Sin dónde». Sin `fecha` = «Libre».

## Archivos

- `modelo.js`: las reglas (antes `modelo.ts` + `sugerir.ts`). **El mismo archivo** corre en el servidor (`require`) y en la pantalla (`window.OrgModelo`).
- `pantallas/organizacion.html` + `organizacion.js` + `estilo.css`: la pantalla (antes `vista.ts` + `estilos.css`). Guarda con `PUT` después de cada cambio, de a uno y en orden.

## Lo visual (por nombre genérico, nunca el look de un tema adentro)

- **Colores:** `estilo.css` les pone nombre `--fr-*` a las variables generales de `comun/pantalla/estilo.css` (`--fondo`, `--acento`, `--verde`, `--violeta`, `--papel`, `--papel-2`, `--tinta`…). Letra decorativa: `--pincel`.
- **Kanjis decorativos** con `SEK.icono(nombre)`: `icono-organizacion`, `icono-hoy`, `icono-bandeja`, `icono-sueltas-fondo`, `icono-sello-hecho`, `kanji-quien|importancia|rapidez|donde|fecha|frente`. Vacío = no se muestran.
- **Íconos** (`icono-importancia-alta|media|baja`, `icono-rapida|lenta`, `icono-celu|compu|calle|sin-donde`, `icono-yo|delegar|con-alguien|flecha`, `icono-hecho|por-hacer|libre|punto|sueltas`): hoy van con respaldo de texto (■ ▲ ● ⚡ 📱 …). Si `SEK.icono` devuelve un `<svg>`, se usa ese.
- **Eventos visuales** con `SEK.evento(nombre)`: `completar` (al marcar hecha), `aparecer` (al abrir una hoja), `logro` (no queda nada de hoy), `alerta` (falta clasificar algo).

## Decisiones que vienen del prototipo «Frentes» v14

- Bandeja sí; atajos de texto (#, @, ?) no.
- Estados: solo Por hacer y Hecho. Las hechas van al Historial plegado.
- Quién: Yo / Delegar («Navil → Facu») / Necesito a alguien («Navil ∞ Facu»).
- «Hoy me toca a mí» = lo mío con fecha de hoy o vencida y no hecho. Se ven de 1 a 9 a la vez.
- Sugerir frente: solo resalta, muestra por qué palabras, aprende si elegís otro, se puede apagar, nunca elige sola.
- Sueltas: máximo 5 a la vista, no se finaliza ni se elimina.
- Frentes: se eliminan con confirmación y Deshacer; al eliminar se borran sus tareas.

## Qué módulos usa

Ninguno. Solo `comun/`.

## Pendiente

- La tira «Hoy me toca a mí» en la pantalla Hoy: la arma el módulo **dia** con `resumenHoy` y `marcarHecha`.
- Íconos SVG y animaciones de los eventos: llegan con el módulo **temas** (que escuche `sek-evento`).
- Widget de Organización en el APK (módulo **celular**). Exportar e importar solo Organización; vista semana; arrastrar para ordenar (hoy usa ↑↓).
