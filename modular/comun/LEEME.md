# comun/

Lo que usan todos los módulos. **No depende de ningún módulo** (lo revisa `guardian.test.js`).

| Archivo | Qué hace |
|---|---|
| `config.js` | Días de sesión y si es producción. |
| `base.js` | PostgreSQL dentro del celu (PGlite; guarda en la memoria del teléfono, y en memoria en las pruebas): `consulta`, `una`, `todas`, `transaccion(fn, txExterna?)`. Fechas vuelven como texto `AAAA-MM-DD`; bigint como número. |
| `errores.js` | `ErrorSek(mensaje, estado)`, `noEncontrado`, `sinSesion`, `datoInvalido` y el manejador de errores del enrutador (`{ error }`). |
| `enrutador.js` | Un «Fastify chiquito» que corre en el celu: `app.get/post/put/patch/delete`, `register`, `preHandler`, `schema` (valida y convierte), `inject` (así la pantalla le pide datos a su módulo sin internet). Lo fijo gana a `:param` y `:param` a `*`. |
| `sesion.js` | Personas y sesiones: crear cuenta, entrar, salir, `cambiarClave` (pide la actual y cierra las demás sesiones), `requiereUsuario` (deja `pedido.usuario`). Contraseña con PBKDF2 (WebCrypto, anda en el celu). Cookie `sek_sesion` HttpOnly. `alCrearCuenta`: lista de funciones que corren al crear una cuenta (los módulos que siembran datos iniciales se anotan desde `app.js`). |
| `ajustes.js` | Ajustes de cada persona (JSON). `AJUSTES_INICIALES` lista todos; un módulo que necesite uno nuevo lo suma ahí (ej.: `lluvia`, de temas). |
| `historial.js` | `anotar(usuarioId, modulo, tipo, detalle)`: qué cambió y cuándo. |
| `eventos.js` | `avisar(nombre, datos, tx)` / `escuchar(nombre, fn)`: para avisar «al revés» sin dependencias en círculo. |
| `fechas.js` | Un día = fecha `AAAA-MM-DD` en la zona de la persona. Traído de la app vieja. |
| `bytes.js` | `deBase64(texto)`: bytes de un base64 (Buffer en la compu, Uint8Array en el celu). |
| `reloj.js` | `ahora()`. Nunca `Date.now()` directo: las pruebas fijan la hora. |
| `migrar.js` | Aplica `migraciones/NNN-*.sql` en orden, una sola vez cada una. En el celu vienen adentro del paquete (`SEK_MIGRACIONES`). |
| `prueba.js` | Para las pruebas: base nueva en memoria, hora fija, persona de prueba. |
| `guardian.test.js` | Falla si un módulo se mete por la ventana de otro, si `comun/` usa un módulo, si a un módulo le falta su forma o si su `datos.js` usa una tabla que no figura como propia en su LEEME (`ON CONFLICT … DO UPDATE SET` no cuenta como tabla). |

## Tablas (migración `001-comun.sql`)

`usuarios`, `sesiones`, `ajustes`, `historial`. Todas las tablas de los módulos llevan `usuario_id` y toda consulta filtra por él.

## pantalla/

| Archivo | Qué hace |
|---|---|
| `estilo.css` | Colores, letras (Pincel y Brocha), fondo, tarjetas, botones, campos, barra de abajo. Tema Shinobi. |
| `marco.js` | `SEK.api`, `SEK.barra`, `SEK.mensaje`, `SEK.minutos`, `SEK.seguro`, `SEK.$`, `SEK.icono(nombre)` (kanji o ícono del tema elegido por nombre genérico; lo responde el módulo **temas**, y mientras carga la lista de respaldo `ICONOS`) y `SEK.evento(nombre, detalle)` (evento visual genérico: avisa `sek-evento` en `document`). La lista `MENU` tiene los **5 botones fijos** de la barra de abajo (Hoy, Calendario, Juego, Sueño, Más): las demás pantallas principales van como fila en **Más** (`modulos/cuentas/pantallas/mas.js`). Una pantalla que no está en la barra marca **Más** como activo. Al arrancar pone las variables de color guardadas del último tema y carga `/m/temas/tema.js` (ver `modulos/temas/LEEME.md`). |
| `servir.js` | Sirve `/comun/*` y `/m/<modulo>/*` (sin librerías y sin dejar salir de la carpeta). En el celu no lee nada: responde con el encabezado `X-SEK-Archivo` y la página madre abre ese archivo del paquete. `pagina(respuesta, modulo, archivo)` para las rutas de cada módulo. |
| `entrar.html` | Entrar y crear cuenta. |
| `fuentes/` | `pincel.woff2` (Yuji Syuku) y `brocha.woff2` (Kaushan Script). |
