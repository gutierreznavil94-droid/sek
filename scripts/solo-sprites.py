"""Arma una tira de cuadros desde un video de Luma con un solo personaje (caramelo, logro grande),
en dos versiones: papel claro y fondo oscuro.

Uso: python3 -I scripts/solo-sprites.py <cuadros> <nombre> <desde> <hasta> <cuadros_salida> <x0,y0,x1,y1> <escala> <dir_salida>
  - <cuadros>: PNG a 24 fps del video (0001.png = primer cuadro).
  - <desde>/<hasta>: tramo del video, en cuadros; se reparte parejo en <cuadros_salida> cuadros.
  - <x0,y0,x1,y1>: recorte en px del video. <escala>: px de la celda por px del video.
La marca de Luma (gris claro) se borra con un umbral de luminancia: todo lo más claro que 120 es papel.
El borde rojo del kasa se conserva en rojo.
"""
import sys, json
import numpy as np
from PIL import Image

TEMAS = {'claro': (20, 20, 20), 'oscuro': (236, 230, 216)}
ROJO = (200, 52, 46)
UMBRAL = 120

d, nombre, desde, hasta, total, caja, escala, salida = sys.argv[1:9]
desde, hasta, total, escala = int(desde), int(hasta), int(total), float(escala)
x0, y0, x1, y1 = map(int, caja.split(','))

def capa(ruta, tema):
    a = np.asarray(Image.open(ruta).convert('RGB').crop((x0, y0, x1, y1))).astype(np.float32)
    lum = a.mean(2)
    alfa = np.clip((UMBRAL - lum) / (UMBRAL - 25), 0, 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rojo = np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1) * (r > 90) * (lum < 170)
    c = TEMAS[tema]
    col = np.dstack([c[i] * (1 - rojo) + ROJO[i] * rojo for i in range(3)])
    alfa = np.maximum(alfa, rojo)
    return Image.fromarray(np.dstack([col, alfa * 255]).clip(0, 255).astype(np.uint8), 'RGBA')

W, H = round((x1 - x0) * escala), round((y1 - y0) * escala)
cols = 10
filas = (total + cols - 1) // cols
for tema in TEMAS:
    hoja = Image.new('RGBA', (W * cols, H * filas), (0, 0, 0, 0))
    for f in range(total):
        n = int(round(desde + (hasta - desde) * f / (total - 1)))
        hoja.paste(capa(f'{d}/{n:04d}.png', tema).resize((W, H), Image.LANCZOS), ((f % cols) * W, (f // cols) * H))
    hoja.save(f'{salida}/{nombre}-{tema}.webp', 'WEBP', quality=70, method=6, alpha_quality=80)
print(json.dumps({'celda': [W, H], 'columnas': cols, 'filas': filas, 'cuadros': total}))
