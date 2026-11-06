"""Arma la hoja de sprites del rival gris del tema Shinobi (public/temas/shinobi/rival/rival.webp + .json).

Uso: python3 -I scripts/rival-sprites.py <dir_cuadros> <salida.webp> --clip nombre=carpeta,clave=valor,... [--clip ...]
<dir_cuadros>/<carpeta>/ tiene los cuadros PNG (24 fps) de cada clip de Luma/Kling.
Claves: desde/hasta (cuadros), paso (uno de cada N), fps, escala (px del clip → px «de quieto»: el rival parado mide
como el shinobi, ≈324), x (ancla horizontal fija en px del clip; sin x, cada cuadro por su centro), pies (y del piso en el
clip; sin pies, cada cuadro por sus pies), unaVez=1 (queda en el último cuadro), aire=A-B (cuadros en el aire: la app lo
mueve solo ahí), corte=1 (el clip se corta en el borde derecho del video: guarda dónde queda ese borde en la celda, así
la app lo pone justo en el borde de la pantalla y parece que se asoma).
Mismo proceso que scripts/shinobi-sprites.py: fondo blanco y marca de agua afuera por brillo, el rival en GRIS y lo
dorado (la bolita de XP) dorado. El tamaño en pantalla es el de la caminata del compañero.
"""
import sys, glob, json
import numpy as np
from PIL import Image

GRIS = np.array((150, 150, 158), np.float32)
ESCALA = 0.2
ANCHO, ALTO = 640, 600   # lienzo «de quieto» de cada celda
CENTRO, PIES = 320, 560

d, salida = sys.argv[1], sys.argv[2]
clips = []
args = sys.argv[3:]
while args:
    if args[0] == '--clip':
        nombre, resto = args[1].split('=', 1)
        partes = resto.split(',')
        c = {'nombre': nombre, 'carpeta': partes[0], 'desde': 0, 'hasta': 10 ** 6, 'paso': 1, 'fps': 24.0, 'escala': 0.72, 'x': None, 'pies': None, 'unaVez': False, 'aire': None, 'corte': False}
        for kv in partes[1:]:
            k, v = kv.split('=', 1)
            if k in ('desde', 'hasta', 'paso'): c[k] = int(v)
            elif k in ('fps', 'escala', 'x', 'pies'): c[k] = float(v)
            elif k in ('unaVez', 'corte'): c[k] = v not in ('0', 'no')
            elif k == 'aire': c[k] = [int(x) for x in v.split('-')]
        clips.append(c)
        args = args[2:]
    else:
        args = args[1:]


def celda(a, esc, ax, py):
    lum = a.mean(2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    alfa = np.clip((185 - lum) / 120, 0, 1)
    # Dorado: amarillo (r y g altos, b bajo), también el centro brillante de la bolita.
    dorado = np.clip(((np.minimum(r, g) - b) - 18) / 30, 0, 1) * (r > 150)
    col = GRIS * (1 - dorado[..., None]) + a * dorado[..., None]
    alfa = np.maximum(alfa, dorado)
    rgba = np.dstack([col * alfa[..., None], alfa * 255]).clip(0, 255).astype(np.uint8)  # premultiplicado
    im = Image.fromarray(rgba, 'RGBA').resize((round(a.shape[1] * esc), round(a.shape[0] * esc)), Image.LANCZOS)
    lienzo = Image.new('RGBA', (ANCHO, ALTO), (0, 0, 0, 0))
    lienzo.paste(im, (round(CENTRO - ax * esc), round(PIES - py * esc)))
    p = np.asarray(lienzo.resize((round(ANCHO * ESCALA), round(ALTO * ESCALA)), Image.LANCZOS)).astype(np.float32)
    al = p[..., 3:4] / 255
    p[..., :3] = np.where(al > 0, p[..., :3] / np.maximum(al, 1e-3), 0)
    return Image.fromarray(p.clip(0, 255).astype(np.uint8), 'RGBA')


celdas, meta_clips = [], {}
for c in clips:
    fs = sorted(glob.glob(f"{d}/{c['carpeta']}/*.png"))[c['desde']:c['hasta']][::c['paso']]
    desde = len(celdas)
    for f in fs:
        a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
        ys, xs = np.where(a.mean(2) < 110)
        if not len(ys): continue
        ax = c['x'] if c['x'] is not None else xs.mean()
        py = c['pies'] if c['pies'] is not None else ys.max()
        celdas.append(celda(a, c['escala'], ax, py))
    n = len(celdas) - desde
    m = {'desde': desde, 'n': n, 'fps': c['fps']}
    if c['unaVez']: m['unaVez'] = True
    if c['aire']: m['aire'] = [round((c['aire'][0] - c['desde']) / c['paso'] / n, 3), round((c['aire'][1] - c['desde']) / c['paso'] / n, 3)]
    if c['corte'] and c['x'] is not None: m['corte'] = round((CENTRO + (1280 - c['x']) * c['escala']) * ESCALA / 2, 1)
    meta_clips[c['nombre']] = m
    print(f"{c['nombre']}: {n} cuadros", file=sys.stderr)

cols = 16
w, h = celdas[0].size
filas = (len(celdas) + cols - 1) // cols
hoja = Image.new('RGBA', (cols * w, filas * h), (0, 0, 0, 0))
for i, c in enumerate(celdas):
    hoja.paste(c, ((i % cols) * w, (i // cols) * h))
hoja.save(salida, 'WEBP', quality=80, method=6, alpha_quality=85)
meta = {'celda': [w // 2, h // 2], 'columnas': cols, 'filas': filas, 'pies': round((ALTO - PIES) * ESCALA / 2, 1), 'clips': meta_clips}
with open(salida.rsplit('.', 1)[0] + '.json', 'w') as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)
print(json.dumps(meta))
