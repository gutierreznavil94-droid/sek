#!/bin/bash
# Arma modulos/temas/pantallas/animaciones.js: las escenas del shinobi de la v0.88.27 (corte al cumplir, parry,
# caramelo del 3·2·1, logro) con sus hojas de cuadros. Toma el código viejo del bundle de git de la v0.88.27.
# Uso: bash herramientas/armar-animaciones.sh   (necesita `npm ci` hecho en la raíz del repo: react y esbuild)
set -e
MOD=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(cd "$MOD/.." && pwd)
VIEJA=${VIEJA:-/mnt/project-files/organizacion/codigo/sek-v0.88.27-completo.bundle}
TMP=$(mktemp -d)
git clone -q "$VIEJA" "$TMP/vieja"
mkdir -p "$TMP/arma"
cp "$TMP/vieja/src/ui/animaciones/"{Escena.tsx,motor.ts,munieco.tsx,poses-base.json} "$TMP/arma/"
cp "$MOD/herramientas/animaciones/"{entrada.tsx,temas.ts,componentes.ts} "$TMP/arma/"
# Las escenas importan el tema y los componentes de la app vieja: van los reemplazos chicos de acá.
sed -i "s#'../../temas/temas'#'./temas'#; s#'../componentes'#'./componentes'#" "$TMP/arma/Escena.tsx"
ln -s "$REPO/node_modules" "$TMP/arma/node_modules"
"$REPO/node_modules/.bin/esbuild" "$TMP/arma/entrada.tsx" --bundle --minify --format=iife --target=es2019 \
  --jsx=automatic --define:import.meta.env.BASE_URL='"/m/temas/"' --define:process.env.NODE_ENV='"production"' \
  --legal-comments=none --outfile="$MOD/modulos/temas/pantallas/animaciones.js"
DEST="$MOD/modulos/temas/pantallas/animaciones"
for n in parry ejecucion caramelo logro; do mkdir -p "$DEST/$n"; cp "$TMP/vieja/public/animaciones/$n/$n-claro.webp" "$DEST/$n/"  # el fondo «épico» usa las hojas claras; done
rm -rf "$TMP"
ls -la "$MOD/modulos/temas/pantallas/animaciones.js"
