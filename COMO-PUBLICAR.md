# Cómo publicar «Progreso 90» en tu propia dirección (gratis)

La carpeta **`publicar/`** (al lado de este archivo) es la app ya compilada.
Sirve tal cual en cualquier hosting de archivos estáticos: Netlify, GitHub
Pages, Cloudflare Pages o un servidor propio, en la raíz o en una subcarpeta.
No hace falta instalar nada ni tocar el código.

## Opción 1 (la más fácil): Netlify Drop — 3 minutos

1. Entrá a **https://app.netlify.com/drop** desde la computadora.
2. Creá una cuenta gratis si te la pide (con Google o con tu mail).
3. **Arrastrá la carpeta `publicar/` entera** a la zona que dice «Drag and drop your site output folder here».
4. En unos segundos te da una dirección del estilo `https://algo-random-1234.netlify.app`. **Esa es tu app.**
5. Opcional: en «Site configuration → Change site name» podés ponerle un nombre más lindo, por ejemplo `progreso90`.

Para actualizar a una versión nueva: entrá a tu sitio en Netlify → pestaña **Deploys** → arrastrá la nueva carpeta `publicar/`. La dirección no cambia y tus datos tampoco (viven en el teléfono, no en Netlify).

## Opción 2: GitHub Pages

1. Creá una cuenta en https://github.com y un repositorio nuevo, público, llamado por ejemplo `progreso90`.
2. Subí **el contenido** de `publicar/` (los archivos, no la carpeta) con el botón «Add file → Upload files».
3. En el repositorio: **Settings → Pages → Branch: main / (root) → Save**.
4. En un par de minutos la app queda en `https://TU-USUARIO.github.io/progreso90/`. Funciona en subcarpeta porque la app usa rutas relativas.

## Abrir la app en el teléfono

1. Abrí la dirección en **Chrome** del teléfono.
2. Entrá a **Más** y tocá **«Instalar app»** (o el aviso de Chrome «Agregar a la pantalla de inicio»). En iPhone: Safari → Compartir → «Agregar a inicio».
3. Desde ahí la app abre con su ícono «Progreso 90», sin barra del navegador, **y funciona sin internet**.

## Pasar tus datos del link de prueba a la nueva dirección

Los datos viven en el teléfono, dentro de cada dirección. Para moverlos:

1. En el **link de prueba** (el de Claude): **Más → Copia de seguridad → Exportar**. Se guarda un archivo `.json`.
2. En la **nueva dirección**: **Más → Copia de seguridad → Importar** y elegí ese archivo.
3. Listo: mismo ciclo, mismo XP, mismo historial. Hacé una exportación por semana por las dudas.

## Si algo no anda

- La página carga en blanco: revisá que subiste la carpeta `publicar/` completa (tiene que estar `index.html` y la carpeta `assets`).
- No aparece «Instalar app»: tiene que ser **https** (Netlify y GitHub Pages ya lo dan) y abrirse en Chrome, no dentro de otra app.
- Ves una versión vieja: Más → «Actualizar app».
