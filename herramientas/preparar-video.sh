#!/usr/bin/env bash
# Prepara un video vertical para el fondo de Progreso.
# Uso:  herramientas/preparar-video.sh <entrada.mp4> <viento|lluvia|rayos> [--tapar-marca]
#
# Siempre: 720 px de ancho, video entero, 24 cuadros/s, funde el último medio segundo con el
# principio (bucle sin salto), H.264 liviano para celular, y saca un cuadro fijo
# (para «reducir movimiento»).
# Por defecto no recorta nada (así lo prefirió Navil): solo bucle y compresión.
# Con --tapar-marca: recorta la franja de arriba con la marca de Luma, oscurece
# el pie y tapa el logo de la roca (pierde algo de imagen).
set -euo pipefail
entrada="$1"; id="$2"; modo="${3:-}"
aqui="$(cd "$(dirname "$0")" && pwd)"
destino="$aqui/../public/fondos"
if [ "$modo" != "--tapar-marca" ]; then
  base="[0:v]scale=720:-2:flags=lanczos,unsharp=5:5:0.5:5:5:0,setsar=1,fps=24,format=yuv420p[v]"
  mezcla="[v]split[a][b]"
else
  base="[0:v]scale=720:1280:flags=lanczos,crop=720:1094:0:186,unsharp=5:5:0.6:5:5:0,setsar=1,fps=24,format=yuv420p[v];color=c=0x121110:s=720x1094:r=24,format=rgba[tinta];[1:v]format=gray,fps=24[m];[tinta][m]alphamerge[tm]"
  mezcla="[v][tm]overlay=shortest=1,format=yuv420p,split[a][b]"
fi
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$entrada")
fin=$(python3 -c "print(round($dur-0.5,3))")
ffmpeg -v error -y -i "$entrada" -loop 1 -i "$aqui/mascara-marca-de-agua.png" -filter_complex "$base;$mezcla;[a]trim=start=$fin:end=$dur,setpts=PTS-STARTPTS[cola];[b]trim=start=0:end=$fin,setpts=PTS-STARTPTS[cuerpo];[cola][cuerpo]xfade=transition=fade:duration=0.5:offset=0,format=yuv420p[o]" \
  -map "[o]" -an -c:v libx264 -preset slow -crf 27 -tune film -profile:v high -level 4.0 -pix_fmt yuv420p -movflags +faststart "$destino/$id.mp4"
ffmpeg -v error -y -ss 1.5 -i "$destino/$id.mp4" -frames:v 1 -q:v 4 "$destino/$id.jpg"
ls -la "$destino/$id.mp4" "$destino/$id.jpg"
