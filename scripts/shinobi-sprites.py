"""Arma el sprite del shinobi que camina por la barra del entreno.

Uso: python3 -I scripts/shinobi-sprites.py <dir_cuadros> <salida.webp>
<dir_cuadros> tiene los cuadros PNG (24 fps) de:
  camina-y-frena/  (de camina-y-frena.mp4; se usan los cuadros 72..174)
  quieto/          (de quieto-respirando-1.mp4; uno de cada dos)
Quita el fondo blanco, recorta al personaje (sin la marca de Luma) y lo pinta en tinta
color papel con el borde rojo del kasa. Para cambiar el color, tocá TINTA y ROJO.
"""
import sys, glob, json
import numpy as np
from PIL import Image

TINTA = (244, 236, 220)
ROJO = (196, 58, 46)
ESCALA = 0.2           # px del sprite por px del video (personaje de 320 px -> 64 px = 32 px CSS a 2x)
ANCHO_SRC, ALTO_SRC = 480, 352
IZQ = 230              # el cuerpo (x media) queda a 230 px del borde izquierdo de la celda

d, salida = sys.argv[1], sys.argv[2]
cyf = sorted(glob.glob(d + '/camina-y-frena/*.png'))
qui = sorted(glob.glob(d + '/quieto/*.png'))

def cargar(f):
    return np.asarray(Image.open(f).convert('RGB')).astype(np.float32)

def xmedia(a):
    m = a.mean(2) < 120
    return np.where(m)[1].mean()

def celda(a, ancla, y0):
    lum = a.mean(2)
    alfa = np.clip((236 - lum) / (236 - 60), 0, 1)
    # Solo el personaje: caja de los píxeles oscuros con margen (la marca de Luma es gris claro y queda afuera).
    ys, xs = np.where(lum < 110)
    caja = np.zeros_like(alfa)
    caja[max(0, ys.min() - 14):ys.max() + 14, max(0, xs.min() - 14):xs.max() + 14] = 1
    alfa *= caja
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rojo = np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1)
    rojo *= (r > 90)
    col = np.empty_like(a)
    for i in range(3):
        col[..., i] = TINTA[i] * (1 - rojo) + ROJO[i] * rojo
    alfa = np.maximum(alfa, rojo)
    rgba = np.dstack([col, alfa * 255]).clip(0, 255).astype(np.uint8)
    x0 = int(round(ancla - IZQ))
    lienzo = np.zeros((ALTO_SRC, ANCHO_SRC, 4), np.uint8)
    sx0, sx1 = max(0, x0), min(a.shape[1], x0 + ANCHO_SRC)
    lienzo[:, sx0 - x0:sx1 - x0] = rgba[y0:y0 + ALTO_SRC, sx0:sx1]
    im = Image.fromarray(lienzo, 'RGBA')
    # Premultiplicar para escalar sin bordes oscuros.
    return im.resize((round(ANCHO_SRC * ESCALA), round(ALTO_SRC * ESCALA)), Image.LANCZOS)

# Caminata: ciclo de 2 pasos (48 cuadros) justo antes del frenado, así el último cuadro empalma con el primero del frenado.
caminar = list(range(72, 120))
frenar = list(range(120, 175))
xs = np.array([xmedia(cargar(cyf[i])) for i in range(0, 120)])
k, b0 = np.polyfit(np.arange(120), xs, 1)
celdas = []
for i in caminar:
    celdas.append(celda(cargar(cyf[i]), b0 + k * i, 100))
ancla_freno = b0 + k * 120
for i in frenar:
    celdas.append(celda(cargar(cyf[i]), ancla_freno, 100))
fin_freno = np.mean([xmedia(cargar(cyf[i])) for i in range(168, 175)]) - ancla_freno
qx = np.mean([xmedia(cargar(f)) for f in qui[::10]])
quieto = qui[::2]
for f in quieto:
    celdas.append(celda(cargar(f), qx, 103))

cols = 16
w, h = celdas[0].size
filas = (len(celdas) + cols - 1) // cols
hoja = Image.new('RGBA', (cols * w, filas * h), (0, 0, 0, 0))
for n, c in enumerate(celdas):
    hoja.paste(c, ((n % cols) * w, (n // cols) * h))
hoja.save(salida, 'WEBP', quality=82, method=6, alpha_quality=90)
meta = {
    'celda': [w, h], 'columnas': cols, 'escala': 2,
    'ancla': round(IZQ * ESCALA), 'pies': round((444 - 100) * ESCALA),
    'caminar': [0, len(caminar)], 'frenar': [len(caminar), len(frenar)],
    'quieto': [len(caminar) + len(frenar), len(quieto)],
    'pasoCuadro': round(k * ESCALA / 2, 4),       # px CSS que avanza por cuadro (24 fps)
    'frenoAvance': round(fin_freno * ESCALA / 2, 2),
}
print(json.dumps(meta))
