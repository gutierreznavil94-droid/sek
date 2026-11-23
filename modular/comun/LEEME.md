# comun/

Lo que usan todos los módulos. **No depende de ningún módulo** (lo revisa `guardian.test.js`).

| Archivo | Qué hace |
|---|---|
| `config.js` | Puerto, dirección de la base, días de sesión. Sale de variables de entorno o de un JSON fuera del repo (`SEK_CONFIG`). |
| `base.js` | PostgreSQL: `consulta`, `una`, `todas`, `transaccion(fn, txExterna?)`. Fechas vuelven como texto `AAAA-MM-DD`; bigint como número. |
| `errores.js` | `ErrorSek(mensaje, estado)`, `noEncontrado`, `sinSesion`, `datoInvalido` y el manejador de Fastify (`{ error }`). |
| `sesion.js` | Personas y sesiones: crear cuenta, entrar, salir, `cambiarClave` (pide la actual y cierra las demás sesiones), `requiereUsuario` (deja `pedido.usuario`). Contraseña con scrypt. Cookie `sek_sesion` HttpOnly. `alCrearCuenta`: lista de funciones que corren al crear una cuenta (los módulos que siembran datos iniciales se anotan desde `app.js`). |
| `ajustes.js` | Ajustes de cada persona (JSON). `AJUSTES_INICIALES` lista todos; un módulo que necesite uno nuevo lo suma ahí. |
| `historial.js` | `anotar(usuarioId, modulo, tipo, detalle)`: qué cambió y cuándo. |
| `eventos.js` | `avisar(nombre, datos, tx)` / `escuchar(nombre, fn)`: para avisar «al revés» sin dependencias en círculo. |
| `fechas.js` | Un día = fecha `AAAA-MM-DD` en la zona de la persona. Traído de la app vieja. |
| `reloj.js` | `ahora()`. Nunca `Date.now()` directo: las pruebas fijan la hora. |
| `migrar.js` | Aplica `migraciones/NNN-*.sql` en orden, una sola vez cada una. |
| `prueba.js` | Para las pruebas: base aparte (`SEK_BASE_PRUEBA`), hora fija, persona de prueba. |
| `guardian.test.js` | Falla si un módulo se mete por la ventana de otro, si `comun/` usa un módulo, si a un módulo le falta su forma o si su `datos.js` usa una tabla que no figura como propia en su LEEME. |

## Tablas (migración `001-comun.sql`)

`usuarios`, `sesiones`, `ajustes`, `historial`. Todas las tablas de los módulos llevan `usuario_id` y toda consulta filtra por él.

## pantalla/

| Archivo | Qué hace |
|---|---|
| `estilo.css` | Colores, letras (Pincel y Brocha), fondo, tarjetas, botones, campos, barra de abajo. Tema Shinobi. |
| `marco.js` | `SEK.api`, `SEK.barra`, `SEK.mensaje`, `SEK.minutos`, `SEK.seguro`, `SEK.$`, `SEK.icono(nombre)` (kanjis del tema por nombre genérico, lista `ICONOS`, hasta que exista el módulo temas) y `SEK.evento(nombre, detalle)` (evento visual genérico: avisa `sek-evento` en `document`). La lista `MENU` tiene los botones de la barra de abajo: cada módulo con pantalla principal suma el suyo. |
| `servir.js` | Sirve `/comun/*` y `/m/<modulo>/*` (sin librerías y sin dejar salir de la carpeta). `pagina(respuesta, modulo, archivo)` para las rutas de cada módulo. |
| `entrar.html` | Entrar y crear cuenta. |
| `inicio.html` | Hoy provisorio, hasta que exista el módulo **dia**. |
| `fuentes/` | `pincel.woff2` (Yuji Syuku) y `brocha.woff2` (Kaushan Script). |
