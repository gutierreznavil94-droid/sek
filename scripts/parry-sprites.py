"""Arma el parry desde el video de Luma (parry-1.mp4), en dos versiones: papel claro y fondo oscuro.

Uso: python3 -I scripts/parry-sprites.py <dir_cuadros_png> <dir_salida>
Los cuadros son los PNG del video a 24 fps (0001.png = primer cuadro).
Tira: el rival se prepara (7–11), salta y ataca (13–24), choque (29, el más limpio; la app dibuja
destello y chispas), se saltea el forcejeo y sigue el rebote: se separan, el rival sale despedido y
vuelven a guardia (55–88). Los cuadros con hojas borrosas, dobles o dobladas (25–28, 30–54) quedan afuera.
"""
import sys, json
import numpy as np
from PIL import Image

# (cuadro del video, cuántos cuadros de 24 fps se muestra). Todos los cuadros seguidos de cada tramo.
# 1001–1003: cuadros intermedios del choque (29) al rebote (55), generados con
#   ffmpeg minterpolate (mci, aobmc, bidir) sobre 28, 29, 55, 56, 57 -> o06, o07, o08.
TIRA = [(n, 1) for n in range(13, 29)] + [(29, 3)] + [(1001, 1), (1002, 1), (1003, 1)] + [(n, 1) for n in range(55, 84)] + [(84, 4)]
CUADROS = [n for n, _ in TIRA]
CAJA = (40, 30, 945, 445)                           # x0, y0, x1, y1 en el video (sin la marca de Luma)
ESCALA = 0.5                                         # 905 px de ancho -> 452 (escena grande)
CONTACTO = (462, 217)                                # donde se cruzan las hojas en el cuadro 29 (px del video)
TEMAS = {
    'claro':  {'shinobi': (20, 20, 20), 'rival': (75, 75, 75)},
    'oscuro': {'shinobi': (236, 230, 216), 'rival': (138, 138, 146)},
}
ROJO = (200, 52, 46)

d, salida = sys.argv[1], sys.argv[2]

def corrimiento(m, dy, dx):
    r = np.zeros_like(m)
    h, w = m.shape
    r[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = m[max(0, -dy):h + min(0, -dy), max(0, -dx):w + min(0, -dx)]
    return r

def dilatar(m, n):
    for _ in range(n):
        m = m | corrimiento(m, 1, 0) | corrimiento(m, -1, 0) | corrimiento(m, 0, 1) | corrimiento(m, 0, -1)
    return m

def erosionar(m, n):
    return ~dilatar(~m, n)

def cuadro(n, tema):
    a = np.asarray(Image.open(f'{d}/{n:04d}.png').convert('RGB')).astype(np.float32)
    x0, y0, x1, y1 = CAJA
    a = a[y0:y1, x0:x1]
    lum = a.mean(2)
    # Solo lo que toca a los personajes: la marca de Luma (gris claro, suelta) queda afuera.
    cerca = dilatar(lum < 150, 3)
    # Cada trazo fino (hojas, bufandas, bordes) va con el personaje al que está pegado:
    # se crece desde el cuerpo de cada uno (shinobi negro, rival gris) por la tinta, de a un píxel.
    tinta = (lum < 205) & cerca
    sh = erosionar(lum < 30, 4)
    rival = erosionar((lum > 32) & (lum < 110), 4)
    for _ in range(400):
        ns = dilatar(sh, 1) & tinta & ~rival
        nr = dilatar(rival, 1) & tinta & ~sh
        choque = ns & nr & ~sh & ~rival
        ns &= ~choque
        if (ns == sh).all() and (nr == rival).all():
            break
        sh, rival = ns | sh, nr | rival
    # Alfa con curva firme: el desenfoque de movimiento muy claro (hojas fantasma) desaparece.
    alfa_s = np.clip((205 - lum) / (205 - 25), 0, 1)
    alfa_r = np.clip((205 - lum) / (205 - 60), 0, 1)
    alfa = np.where(rival, alfa_r, alfa_s) * cerca
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rojo = np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1) * (r > 90)
    col = np.zeros_like(a)
    c = TEMAS[tema]
    for i in range(3):
        base = np.where(rival, c['rival'][i], c['shinobi'][i])
        col[..., i] = base * (1 - rojo) + ROJO[i] * rojo
    alfa = np.maximum(alfa, rojo * cerca)
    im = Image.fromarray(np.dstack([col, alfa * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    return im.resize((round((x1 - x0) * ESCALA), round((y1 - y0) * ESCALA)), Image.LANCZOS)

for tema in TEMAS:
    celdas = [cuadro(n, tema) for n in CUADROS]
    w, h = celdas[0].size
    cols = 8
    filas = (len(celdas) + cols - 1) // cols
    hoja = Image.new('RGBA', (w * cols, h * filas), (0, 0, 0, 0))
    for i, c in enumerate(celdas):
        hoja.paste(c, ((i % cols) * w, (i // cols) * h))
    hoja.save(f'{salida}/parry-{tema}.webp', 'WEBP', quality=74, method=6, alpha_quality=80)

print(json.dumps({'celda': [w, h], 'columnas': cols, 'filas': filas, 'cuadros': len(CUADROS), 'pies': round((432 - CAJA[1]) * ESCALA), 'tiempos': [t for _, t in TIRA], 'choque': CUADROS.index(29), 'contacto': [round((CONTACTO[0] - CAJA[0]) * ESCALA), round((CONTACTO[1] - CAJA[1]) * ESCALA)]}))
