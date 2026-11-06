"""Arma el sprite del shinobi que camina por la barra del entreno.

Uso: python3 -I scripts/shinobi-sprites.py <dir_cuadros> <salida.webp> [--clip nombre=carpeta,clave=valor,...]...
<dir_cuadros> tiene los cuadros PNG (24 fps) de:
  camina-y-frena/  (de camina-y-frena.mp4; se usan los cuadros 72..174)
  quieto/          (de quieto-respirando-1.mp4; uno de cada dos)
Clips nuevos (los de Luma para la rutina del compañero) se suman por nombre, por ejemplo:
  --clip saltar=c1-salto,desde=30,aire=58-71 --clip caerRodar=c2-cae,desde=24,aire=36-47
  --clip correr=c3-carrera,desde=24,hasta=72 --clip sentado=c4-sentado,desde=24,paso=2,fps=12,ancla=fijo,cuelga=111,unaVez=1
  nombre = el que usa src/ui/companero/rutina.ts (correr, saltar, sentado, caerRodar, voltereta, estirarse, alerta, llamar, desenvainar).
  Claves: desde/hasta (cuadros del clip), paso (uno de cada N), fps, altura (factor sobre la altura del quieto),
  ancla=cuadro|fijo, cuelga (px del video que las piernas cuelgan bajo el borde, para sentado), unaVez=1 (se reproduce
  una vez y queda en el último cuadro), aire=A-B (cuadros del clip en que está en el aire: la app lo mueve solo ahí).
Además del .webp escribe el .json de al lado (celda, columnas, filas y los clips): la app lo lee y usa cada clip
que encuentre; mientras un clip no está, ese movimiento usa caminar o quieto.
Quita el fondo blanco, recorta al personaje (sin la marca de Luma) y lo pinta en tinta
color papel con el borde rojo del kasa. Para cambiar el color, tocá TINTA y ROJO, o pasá --tinta R,G,B
(el tema Shinobi usa negro tinta: --tinta 21,20,19, como en los videos).
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
extras = []  # dicts: nombre, carpeta, desde, hasta, paso, fps, ancla, cuelga, altura, unaVez, aire
args = sys.argv[3:]
while args:
    if args[0] == '--tinta' and len(args) > 1:
        TINTA = tuple(int(v) for v in args[1].split(','))
        args = args[2:]
    elif args[0] == '--clip' and len(args) > 1:
        nombre, resto = args[1].split('=', 1)
        partes = resto.split(',')
        c = {'nombre': nombre, 'carpeta': partes[0], 'desde': 0, 'hasta': 10 ** 6, 'paso': 1, 'fps': 24.0, 'ancla': 'cuadro', 'cuelga': 0, 'altura': 1.0, 'unaVez': False, 'aire': None}
        for kv in partes[1:]:
            k, v = kv.split('=', 1)
            if k in ('desde', 'hasta', 'paso', 'cuelga'): c[k] = int(v)
            elif k in ('fps', 'altura'): c[k] = float(v)
            elif k == 'unaVez': c[k] = v not in ('0', 'no', 'false')
            elif k == 'aire': c[k] = [int(x) for x in v.split('-')]
            else: c[k] = v
        extras.append(c)
        args = args[2:]
    else:
        args = args[1:]

cyf = sorted(glob.glob(d + '/camina-y-frena/*.png'))
qui = sorted(glob.glob(d + '/quieto/*.png'))

def cargar(f):
    return np.asarray(Image.open(f).convert('RGB')).astype(np.float32)

def xmedia(a):
    m = a.mean(2) < 120
    return np.where(m)[1].mean()

def celda(a, ancla, y0):
    lum = a.mean(2)
    alfa = np.clip((200 - lum) / (200 - 70), 0, 1)
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

# Clips nuevos (los de Luma para la rutina): el personaje puede venir a otro tamaño, así que se normaliza por la
# altura del quieto (ALTO_QUIETO px en el video). Anclaje «cuadro»: cada cuadro por su propio centro y sus pies (la app
# mueve al muñeco); «fijo»: todos los cuadros con los pies de los primeros cuadros (sentado: las piernas cuelgan
# `cuelga` px por debajo del borde, y la app lo baja ese tanto en CSS → `bajar`).
ALTO_QUIETO = 324
PIES = 444
LUM_CUERPO = 110

def caja_cuerpo(a):
    lum = a.mean(2)
    ys, xs = np.where(lum < LUM_CUERPO)
    if not len(ys): return None
    return ys.min(), ys.max(), xs.min(), xs.max()

def celda_normalizada(a, escala_clip, ancla_x, pies_y):
    """Reescala el cuadro del clip para que el personaje mida como el quieto y lo apoya en (ancla_x → IZQ, pies_y → PIES)."""
    if abs(escala_clip - 1) > 0.01:
        im = Image.fromarray(a.astype(np.uint8)).resize((round(a.shape[1] * escala_clip), round(a.shape[0] * escala_clip)), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32)
        ancla_x *= escala_clip
        pies_y *= escala_clip
    # Lienzo blanco con el cuadro corrido para que coincidan el ancla y los pies con los de la caminata.
    lienzo = np.full((ALTO_SRC + 100, max(ANCHO_SRC, a.shape[1]) + ANCHO_SRC, 3), 255, np.float32)
    dx = int(round(ANCHO_SRC + IZQ - ancla_x)); dy = int(round(PIES - pies_y))
    y0, y1 = max(0, dy), min(lienzo.shape[0], dy + a.shape[0]); x0, x1 = max(0, dx), min(lienzo.shape[1], dx + a.shape[1])
    if y1 > y0 and x1 > x0:
        lienzo[y0:y1, x0:x1] = a[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return celda(lienzo, ANCHO_SRC + IZQ, 100)

clips_extra = {}
for c in extras:
    fs = sorted(glob.glob(f"{d}/{c['carpeta']}/*.png"))[c['desde']:c['hasta']][::c['paso']]
    if not fs:
        print(f"aviso: sin cuadros en {c['carpeta']}", file=sys.stderr)
        continue
    cuadros = [cargar(f) for f in fs]
    cajas = [caja_cuerpo(a) for a in cuadros]
    primeras = [b[1] - b[0] for b in cajas[:8] if b]
    alto = max(primeras) if primeras else max(b[1] - b[0] for b in cajas if b)
    escala_clip = ALTO_QUIETO * c['altura'] / alto
    pies_fijo = max(b[1] for b in cajas[:8] if b)
    desde = len(celdas)
    for a, b in zip(cuadros, cajas):
        if not b: continue
        pies_y = b[1] if c['ancla'] == 'cuadro' else pies_fijo
        celdas.append(celda_normalizada(a, escala_clip, xmedia(a), pies_y))
    n = len(celdas) - desde
    meta_clip = {'desde': desde, 'n': n, 'fps': c['fps']}
    if c['unaVez']: meta_clip['unaVez'] = True
    if c['cuelga']: meta_clip['bajar'] = round(c['cuelga'] * escala_clip * ESCALA / 2)
    if c['aire']:
        a0, a1 = c['aire']
        meta_clip['aire'] = [round((a0 - c['desde']) / c['paso'] / n, 3), round((a1 - c['desde']) / c['paso'] / n, 3)]
    clips_extra[c['nombre']] = meta_clip
    print(f"{c['nombre']}: {n} cuadros, escala {escala_clip:.2f}", file=sys.stderr)

cols = 16
w, h = celdas[0].size
filas = (len(celdas) + cols - 1) // cols
hoja = Image.new('RGBA', (cols * w, filas * h), (0, 0, 0, 0))
for n, c in enumerate(celdas):
    hoja.paste(c, ((n % cols) * w, (n // cols) * h))
hoja.save(salida, 'WEBP', quality=82, method=6, alpha_quality=90)
meta = {
    'celda': [w // 2, h // 2], 'columnas': cols, 'filas': filas,
    'clips': {
        'caminar': {'desde': 0, 'n': len(caminar), 'fps': 33.6},
        'frenar': {'desde': len(caminar), 'n': len(frenar), 'fps': 33.6},
        'quieto': {'desde': len(caminar) + len(frenar), 'n': len(quieto), 'fps': 12},
        **clips_extra,
    },
    'pasoCuadro': round(k * ESCALA / 2, 4),       # px CSS que avanza por cuadro (24 fps)
    'frenoAvance': round(fin_freno * ESCALA / 2, 2),
}
with open(salida.rsplit('.', 1)[0] + '.json', 'w') as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)
print(json.dumps(meta))
