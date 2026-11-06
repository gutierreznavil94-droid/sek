"""Limpia los clips de escena del tema Shinobi (Juego, pelea, noche, Sueño) para la app oscura.

Uso: python3 -I scripts/shinobi-escenas.py <entrada.mp4> <salida.mp4> [ancho=640] [desde=0] [hasta=fin] [reves=1] [recorte=x0,y0,x1,y1]
Mismo proceso que scripts/shinobi-sprites.py (umbral de brillo): el fondo blanco y la marca de Luma/Kling son claros,
los personajes negro y gris oscuro. El fondo queda NEGRO (la app lo muestra con `mix-blend-mode: screen`, así el negro
desaparece sobre cualquier fondo oscuro). El shinobi (negro) queda en tinta color papel, el rival (gris oscuro) en gris,
el borde del kasa en rojo y lo dorado (la bolita de XP) dorado. Además escribe <salida>-quieto.jpg (un cuadro del medio,
para «Reducir movimiento») y <salida>-fin.jpg (el último cuadro, para no dejar la pantalla negra entre clips).
Para cambiar colores, tocá TINTA, GRIS y ROJO.
"""
import sys, subprocess, json
import numpy as np
from PIL import Image

TINTA = np.array((244, 236, 220), np.float32)
GRIS = np.array((150, 150, 158), np.float32)
ROJO = np.array((196, 58, 46), np.float32)

entrada, salida = sys.argv[1], sys.argv[2]
op = dict(a.split('=', 1) for a in sys.argv[3:])
ancho = int(op.get('ancho', 640))
desde = float(op.get('desde', 0))
hasta = op.get('hasta')
reves = op.get('reves') in ('1', 'si')
recorte = [int(v) for v in op['recorte'].split(',')] if 'recorte' in op else None
# fondo=papel: colores originales (shinobi negro, rival gris) sobre papel blanco cálido; la marca de agua se va igual.
papel = op.get('fondo') == 'papel'
PAPEL = np.array((242, 240, 235), np.float32)

info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', entrada]))
W, H = info['streams'][0]['width'], info['streams'][0]['height']
x0, y0, x1, y1 = recorte or (0, 0, W, H)
w, h = x1 - x0, y1 - y0
alto = round(ancho * h / w / 2) * 2

leer = ['ffmpeg', '-v', 'error', '-ss', str(desde), '-i', entrada]
if hasta: leer += ['-t', str(float(hasta) - desde)]
leer += ['-vf', f'fps=24,crop={w}:{h}:{x0}:{y0},scale={ancho}:{alto}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
crudo = subprocess.run(leer, capture_output=True, check=True).stdout
cuadros = np.frombuffer(crudo, np.uint8).reshape(-1, alto, ancho, 3)
if reves: cuadros = cuadros[::-1]


def limpiar(a):
    a = a.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(2)
    alfa = np.clip((185 - lum) / 120, 0, 1)
    gris = np.clip((lum - 28) / 24, 0, 1)[..., None]
    col = TINTA * (1 - gris) + GRIS * gris
    rojo = (np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1) * (r > 90))[..., None]
    col = col * (1 - rojo) + ROJO * rojo
    # Dorado: amarillo saturado (la bolita de XP). Se queda con su color y su brillo.
    dorado = np.clip(((np.minimum(r, g) - b) - 40) / 50, 0, 1)[..., None]
    col = col * (1 - dorado) + a * dorado
    alfa = np.maximum(alfa, np.maximum(rojo[..., 0], dorado[..., 0]))
    return (col * alfa[..., None]).clip(0, 255).astype(np.uint8)


def en_papel(a):
    a = a.astype(np.float32)
    lum = a.mean(2)
    alfa = np.clip((185 - lum) / 120, 0, 1)[..., None]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    color = np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1) * (r > 90)
    dorado = np.clip(((np.minimum(r, g) - b) - 40) / 50, 0, 1)
    alfa = np.maximum(alfa, np.maximum(color, dorado)[..., None])
    return (a * alfa + PAPEL * (1 - alfa)).clip(0, 255).astype(np.uint8)


limpios = np.stack([(en_papel if papel else limpiar)(c) for c in cuadros])
cod = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{ancho}x{alto}', '-r', '24', '-i', '-',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', salida]
subprocess.run(cod, input=limpios.tobytes(), check=True)
base = salida.rsplit('.', 1)[0]
Image.fromarray(limpios[len(limpios) // 2]).save(base + '-quieto.jpg', quality=82)
Image.fromarray(limpios[-1]).save(base + '-fin.jpg', quality=82)
print(f'{salida}: {len(limpios)} cuadros, {ancho}x{alto}', file=sys.stderr)
