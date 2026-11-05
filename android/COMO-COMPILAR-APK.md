# Cómo se arma el APK de SEK

Esta carpeta es el proyecto Android (Capacitor). La app es la misma web de SEK (`dist/`) adentro de una app
Android, más lo que solo Android puede hacer: alarmas con la app cerrada, widgets, accesos directos y
«Buscar actualización». Id de la app: **ar.sek.app** (no cambiarlo nunca: rompe las actualizaciones).

## Camino normal: GitHub lo arma solo

El workflow `.github/workflows/apk.yml` corre en cada push a **main** (y a mano con «Run workflow»):
`npm ci` → `npm test` → `npm run build` → `npx cap sync android` → `./gradlew assembleRelease`, firma con la
clave de los secretos y publica un **Release** `vX.YY` con el archivo `sek.apk`.

- Link fijo de descarga: https://github.com/gutierreznavil94-droid/sek/releases/latest/download/sek.apk
- La versión sale de `src/version.ts` («0.53» → versionName 0.53, versionCode 53). Subí la versión para que
  «Buscar actualización» la vea como nueva.
- En la rama `apk-android` solo prueba que compile (APK de prueba en «Artifacts», sin Release).

### La firma (una sola vez)

La clave está en la carpeta del proyecto `apk/firma/` (`sek.jks`). **Guardala en un lugar seguro**: sin ella no
se pueden publicar actualizaciones. Los 4 secretos van en GitHub → repo sek → Settings → Secrets and variables →
Actions → New repository secret: `SEK_KEYSTORE_BASE64`, `SEK_KEYSTORE_PASSWORD`, `SEK_KEY_ALIAS`,
`SEK_KEY_PASSWORD` (valores en `apk/firma/SECRETOS-PARA-GITHUB.md`).

## Camino manual: Android Studio en la PC

1. Instalar **Android Studio** (instala el SDK solo) y **Node.js** LTS.
2. En la carpeta del código: `npm install`, `npm run build`, `npx cap sync android`, `npx cap open android`.
3. Android Studio: **Build → Generate Signed App Bundle / APK → APK**, con `sek.jks` (alias `sek`).
   Para probar rápido sin firma propia: **Build → Build APK(s)** (no se puede instalar encima del firmado).

## Qué tiene la parte Android (`app/src/main/java/ar/sek/app/`)

- `MainActivity`: registra el plugin y recibe los accesos directos (extra `ruta`).
- `SekPlugin`: puente con la web (datos de los widgets, cola de lo marcado en el widget, ruta del acceso
  directo, bajar e instalar el APK nuevo).
- `WidgetChico` (2×1) y `WidgetMediano` (4×2), con `WidgetBase` y `Datos`. Se actualizan cuando la app guarda
  algo, cada 30 min y a las 00:01. Lo marcado con la app cerrada queda en cola y la app lo anota al abrirse.
- `res/xml/shortcuts.xml`: «Dejo celu», «+1 vaso de agua», «Batalla», «Revisión diaria».
- Alarmas: `@capacitor/local-notifications` con dos canales (alarmas con sonido y vibración; avisos tenues).

## Pasar los datos desde la web

La app Android arranca vacía (es otro navegador interno). En la web: Más → Copia → «Copiar todo como texto».
En la app: Más → Copia → «Pegá acá el texto de la copia».
