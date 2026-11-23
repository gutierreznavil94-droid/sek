# Módulo cuentas

**Qué hace:** la pantalla **Más**: la lista de secciones (con buscador), los ajustes de la persona (zona horaria, día en que empieza la semana, límites de juego), los nombres (de la app, de la persona y de las fases del ciclo), cambiar la contraseña y salir.

## Pantallas

| Dirección | Archivos | Qué muestra |
|---|---|---|
| `/mas` | `mas.html` + `mas.js` | Las secciones (lista `SECCIONES` de `mas.js`: cada módulo con pantalla en Más suma su fila ahí), buscador y Salir. |
| `/mas/historial` | `historial.html` + `historial.js` | Historial de cambios (lo que anotan los módulos con `comun/historial.js`), con filtros, como la v0.88.27. |
| `/mas/ajustes` | `ajustes.html` + `ajustes.js` | Zona horaria, inicio de semana, límites de juego. |
| `/mas/nombres` | `nombres.html` + `nombres.js` | Nombre de la app, tu nombre, nombres de las fases. |
| `/mas/cuenta` | `cuenta.html` + `cuenta.js` | Nombre y email, cambiar contraseña, salir. |

`estilo.css`: la grilla de Más y los detalles propios. Suma el botón **Más** (他) a la barra de abajo (`comun/pantalla/marco.js`).

## Direcciones de la API

- `GET /api/cuentas` → `{ usuario, ajustes, zonas }`
- `PUT /api/cuentas/ajustes` → guarda los campos que vengan; devuelve `{ ajustes }`
- `POST /api/cuentas/clave` `{ actual, nueva, repetir }`
- Salir usa `POST /api/sesion/salir` (de `comun/sesion.js`).

## Lo que ofrece su ventanilla

| Función | Para qué |
|---|---|
| `ajustes(usuarioId)` | Los ajustes completos de la persona. |
| `guardar(usuarioId, cambios)` | Guarda solo los campos que maneja cuentas, revisando cada uno; si uno está mal no guarda nada. Anota en el historial `antes → después`. |
| `cambiarClave(usuarioId, { actual, nueva, repetir }, tokenQueQueda)` | Pide la actual, mínimo 8 letras, y cierra las demás sesiones. |
| `ZONAS` | Las zonas horarias que se ofrecen en la lista (se acepta cualquier zona válida). |

Ningún otro módulo la necesita: cada uno lee sus ajustes con `comun/ajustes.js`. Todas aceptan `tx` opcional al final.

Campos que cambia (y sus límites): `zonaHoraria` (zona válida), `diaInicioSemana` (1 lunes / 0 domingo), `limiteJuegoSemana` y `limiteJuegoFinde` (0 a 1440 min), `avisoJuegoPorcentaje` (10 a 100), `nombreApp` (1 a 20 letras), `nombrePersona` (hasta 40, puede quedar vacío), `nombresFases` (1 a 6, hasta 30 letras; vacía = nombre de siempre). Sumó `nombresFases` a `AJUSTES_INICIALES` de `comun/ajustes.js`.

## Datos

No tiene tablas propias. Usa la tabla común `ajustes` y, para la contraseña, `sesion.cambiarClave` de `comun/` (que toca `usuarios` y `sesiones`). Su `datos.js` solo pasa por esas funciones de `comun/`. La migración `003-cuentas.sql` está vacía a propósito, para mantener los números.

## Historial

Anota en `comun/historial.js` con módulo `cuentas`: tipo `ajustes` (qué campo, antes y después) y tipo `clave` (sin datos).

## Qué módulos usa

Ninguno. Solo `comun/`.

## Del código viejo

`src/ui/paginas/Mas.tsx`, `Ajustes.tsx` (zona horaria y juego) y `TemaYNombres.tsx` (solo nombres).

## Pendiente (llega con otros módulos)

- Filas de Más para Organización, Copia, Historial, Identidad, Atributos, Metas, Objetivos, Pilares, Rutinas, Alarmas, etc.: cada módulo suma la suya en `SECCIONES` cuando exista.
- Ajustes de otros módulos que en la app vieja estaban en la misma pantalla (XP y niveles, resta, forja, racha, lluvia, brillo, frases, recordatorio para dormir, recomendaciones): los suma cada módulo en su propia pantalla de ajustes, o acá cuando Navil diga.
- Tema (elegir y subir): módulo **temas**. Aviso de copia de seguridad: módulo **copia**. Versión y «Buscar actualización»: módulo **celular**.
