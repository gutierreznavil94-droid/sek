# SEK · monolito modular

Una sola app Node.js (JavaScript), un repo y una base PostgreSQL. Las reglas están en `REGLAS.md` (archivos del proyecto). El mapa de módulos y el orden de la mudanza están en `MAPA.md`.

```
modular/
  app.js          ← arranca el servidor y registra las rutas de cada módulo
  comun/          ← lo que usan todos (ver comun/LEEME.md)
    pantalla/     ← estilo.css, marco.js, servir.js
  modulos/
    juego/        ← módulo de ejemplo: copiá su forma
  migraciones/    ← 001-comun.sql, 002-juego.sql, ...
```

Mientras se muda, vive en la carpeta `modular/` del repo, al lado de la app vieja (React), que sigue andando y sigue siendo la del APK. Cuando la nueva la reemplace, `modular/` pasa a ser la raíz.

## Cómo se prueba en una compu

Necesita Node 22 y PostgreSQL.

```bash
cd modular
npm install
# base real
export DATABASE_URL=postgres://usuario:clave@localhost:5432/sek
npm start                    # aplica migraciones y abre http://localhost:3000
# pruebas (usan OTRA base, que se borra en cada corrida)
export SEK_BASE_PRUEBA=postgres://usuario:clave@localhost:5432/sek_prueba
npm test
```

## Cómo se suma un módulo

1. Copiar la forma de `modulos/juego/`: `rutas.js`, `ventanilla.js`, `datos.js`, `pruebas.test.js`, `LEEME.md`, `pantallas/`.
2. Su migración en `migraciones/NNN-<modulo>.sql` (número siguiente). Todas las tablas con `usuario_id`.
3. En su LEEME, cada tabla propia como `- tabla \`nombre\`` (el guardián lo revisa).
4. Registrar sus rutas en `app.js`. Si siembra datos al crear una cuenta, sumar su función a `sesion.alCrearCuenta`.
5. Si tiene pantalla principal, sumar su botón al `MENU` de `comun/pantalla/marco.js`.
6. `npm test` en verde (incluye el guardián).
