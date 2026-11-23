#!/usr/bin/env python3
"""
Pasa un video corto (las escenas del tema) a una hoja de cuadros .webp + su .json, para dibujarla en un <canvas>.
En el celu los <video> dentro de la app no arrancaban; una hoja de cuadros anda siempre (como el compañero).
Uso: python3 herramientas/video-a-hoja.py clip.mp4 [ancho=480] [fps=12]
Deja clip.webp (todos los cuadros en filas) y clip.json { celda: [ancho, alto], columnas, filas, n, fps }.
Necesita ffmpeg y Pillow.
"""
import json, math, os, subprocess, sys, tempfile
from PIL import Image

video = sys.argv[1]
ancho = int(sys.argv[2]) if len(sys.argv) > 2 else 480
fps = int(sys.argv[3]) if len(sys.argv) > 3 else 12
base = os.path.splitext(video)[0]
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={fps},scale={ancho}:-2', os.path.join(tmp, 'c%04d.png')], check=True)
    cuadros = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    imgs = [Image.open(os.path.join(tmp, f)).convert('RGB') for f in cuadros]
w, h = imgs[0].size
columnas = max(1, min(len(imgs), 4096 // w))  # hojas de hasta 4096 px de ancho: los celus las decodifican sin problema
filas = math.ceil(len(imgs) / columnas)
hoja = Image.new('RGB', (columnas * w, filas * h), (242, 240, 235))
for i, im in enumerate(imgs):
    hoja.paste(im, ((i % columnas) * w, (i // columnas) * h))
hoja.save(base + '.webp', 'WEBP', quality=72, method=6)
with open(base + '.json', 'w') as f:
    json.dump({'celda': [w, h], 'columnas': columnas, 'filas': filas, 'n': len(imgs), 'fps': fps}, f)
print(base + '.webp', f'{len(imgs)} cuadros', f'{os.path.getsize(base + ".webp") // 1024} KB')
