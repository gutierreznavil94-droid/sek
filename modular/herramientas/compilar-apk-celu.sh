#!/bin/bash
# Arma el APK de PRUEBA de la SEK nueva (sin servidor). Convive con la app vieja: otro id (ar.sek.nueva)
# y otro nombre («SEK nueva»), así no pisa tus datos de la v0.88.27.
# Uso: bash herramientas/compilar-apk-celu.sh <versionCode> <versionName>
# Necesita: SDK en /tmp/claude-0/sdk, `npm ci` hecho en la raíz del repo. Firma con apk/firma (no imprime claves).
# No toca la carpeta android/ del repo: trabaja en una copia en /tmp/claude-0/apk-celu.
set -e
CODE="${1:-1}"; NOMBRE="${2:-0.1}"
REPO=/home/user/sek
MOD="$REPO/modular"
FIRMA=/mnt/project-files/apk/firma
TRABAJO=/tmp/claude-0/apk-celu
ESPEJO=/tmp/claude-0/espejo.gradle
ID=ar.sek.nueva

cat > "$ESPEJO" <<'G'
def espejo = 'https://maven-central.storage-download.googleapis.com/maven2/'
def cambiar = { repos -> repos.withType(MavenArtifactRepository).configureEach { r -> if (r.url.toString().contains('repo.maven.apache.org') || r.url.toString().contains('repo1.maven.org')) r.url = espejo } }
settingsEvaluated { s -> cambiar(s.pluginManagement.repositories); cambiar(s.dependencyResolutionManagement.repositories) }
allprojects { p -> cambiar(p.buildscript.repositories); cambiar(p.repositories) }
G

# 1. La web del celu
(cd "$MOD" && node herramientas/armar-celu.js)

# 2. Copia del proyecto Android con otro id y otro nombre
rm -rf "$TRABAJO"; mkdir -p "$TRABAJO"
cp -r "$REPO/android" "$TRABAJO/android"
ln -s "$REPO/node_modules" "$TRABAJO/node_modules"
cp "$REPO/package.json" "$TRABAJO/"
cat > "$TRABAJO/capacitor.config.json" <<J
{ "appId": "$ID", "appName": "SEK nueva", "webDir": "www", "android": { "allowMixedContent": false } }
J
cp -r "$MOD/celu/www" "$TRABAJO/www"
cd "$TRABAJO"
sed -i "s/applicationId \"ar.sek.app\"/applicationId \"$ID\"/" android/app/build.gradle
sed -i 's/>SEK</>SEK nueva</g' android/app/src/main/res/values/strings.xml
sed -i "s/android:targetPackage=\"ar.sek.app\"/android:targetPackage=\"$ID\"/g" android/app/src/main/res/xml/shortcuts.xml
npx cap sync android >/tmp/claude-0/cap-celu.log 2>&1 || { tail -20 /tmp/claude-0/cap-celu.log; exit 1; }

# 3. Compilar y firmar
cd android
echo "sdk.dir=/tmp/claude-0/sdk" > local.properties
export ANDROID_HOME=/tmp/claude-0/sdk
export SEK_KEYSTORE_FILE="$FIRMA/sek.jks"
export SEK_KEY_ALIAS=sek
PASS=$(grep -oE 'SEK_KEYSTORE_PASSWORD[^A-Za-z0-9]*[^ `|]+' "$FIRMA/SECRETOS-PARA-GITHUB.md" | head -1 | sed -E 's/SEK_KEYSTORE_PASSWORD[^A-Za-z0-9]*//')
KPASS=$(grep -oE 'SEK_KEY_PASSWORD[^A-Za-z0-9]*[^ `|]+' "$FIRMA/SECRETOS-PARA-GITHUB.md" | head -1 | sed -E 's/SEK_KEY_PASSWORD[^A-Za-z0-9]*//')
export SEK_KEYSTORE_PASSWORD="$PASS" SEK_KEY_PASSWORD="${KPASS:-$PASS}"
bash gradlew assembleRelease -I "$ESPEJO" -PsekVersionCode="$CODE" -PsekVersionName="$NOMBRE" --no-daemon -q >/tmp/claude-0/gradle-celu.log 2>&1 || { tail -30 /tmp/claude-0/gradle-celu.log; exit 1; }
ls -la app/build/outputs/apk/release/
