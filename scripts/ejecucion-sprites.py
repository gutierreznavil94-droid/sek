"""Arma la ejecución desde los dos videos de Luma (ronin que corta y rival que cae) en una sola tira,
en dos versiones: papel claro y fondo oscuro.

Uso: python3 -I scripts/ejecucion-sprites.py <cuadros_ronin> <cuadros_rival> <dir_salida>
Los cuadros son PNG a 24 fps (0001.png = primer cuadro) de:
  - ejecucion-2a-borrador-540p.mp4 (ronin, 960x540): se usa del cuadro 29 (1,2 s) al 120 (5 s).
    En el 76 la hoja queda extendida: es el impacto.
  - ejecucion-2b-rival-cae.mp4 (rival gris, 1280x720): antes del impacto va muy despacio del cuadro 1 al 13
    (se agacha apenas en guardia, más una respiración leve); desde el impacto, del 16 al 72 (3 s, ya en el piso).
La marca de Luma (gris claro) se borra con un umbral de luminancia: todo lo más claro que 120 es papel.
La escena dura 2,1 s a 40 cuadros por segundo: carga 0,975 s, caída 0,825 s, disolución del rival 0,3 s.
"""
import sys, json
import numpy as np
from PIL import Image

FPS = 40
TOTAL = 84                     # 2,1 s
IMPACTO = 39                   # 0,975 s (46 %: el mismo instante que los efectos de la app)
FIN_CAIDA = 72                 # 1,8 s: después, disolución del rival
RONIN = (29, 76, 120)          # inicio, impacto, fin (cuadros del video)
RIVAL = (1, 16, 72)            # guardia, freno (impacto), en el piso
PISO_RONIN, PISO_RIVAL = 456, 564
ALTO_RONIN, ALTO_RIVAL = 321, 400   # alto de pie (sin la espada levantada)
ESCALA_RIVAL = 0.92 * ALTO_RONIN / ALTO_RIVAL
# En px del ronin: dónde cae el x=350 del rival (su torso en guardia), un poco antes de la punta de la hoja (765).
TORSO_RIVAL = (350, 700)
CAJA = (80, 30, 1290, 470)     # recorte de la escena, en px del ronin
ESCALA = 0.36                  # 1210 px -> 436 (como el parry)
TEMAS = {
    'claro':  {'ronin': (20, 20, 20), 'rival': (88, 88, 92)},
    'oscuro': {'ronin': (236, 230, 216), 'rival': (138, 138, 146)},
}
ROJO = (200, 52, 46)
UMBRAL = 120

dir_a, dir_b, salida = sys.argv[1], sys.argv[2], sys.argv[3]

def capa(ruta, oscuro_max, tema, quien):
    a = np.asarray(Image.open(ruta).convert('RGB')).astype(np.float32)
    lum = a.mean(2)
    alfa = np.clip((UMBRAL - lum) / (UMBRAL - oscuro_max), 0, 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    rojo = np.clip(((r - np.maximum(g, b)) - 30) / 50, 0, 1) * (r > 90) * (lum < 170)
    c = TEMAS[tema][quien]
    col = np.dstack([c[i] * (1 - rojo) + ROJO[i] * rojo for i in range(3)])
    alfa = np.maximum(alfa, rojo)
    return Image.fromarray(np.dstack([col, alfa * 255]).clip(0, 255).astype(np.uint8), 'RGBA')

def cuadro_en(t, desde, hasta):
    """t de 0 a 1 -> cuadro del video, el más cercano."""
    return int(round(desde + (hasta - desde) * min(1, max(0, t))))

def tira(tema):
    x0, y0, x1, y1 = CAJA
    W, H = x1 - x0, y1 - y0
    ox = TORSO_RIVAL[1] - TORSO_RIVAL[0] * ESCALA_RIVAL - x0
    oy = PISO_RONIN - PISO_RIVAL * ESCALA_RIVAL - y0
    cache = {}
    def rival(n):
        if n not in cache:
            im = capa(f'{dir_b}/{n:04d}.png', 58, tema, 'rival')
            cache[n] = im.resize((round(im.width * ESCALA_RIVAL), round(im.height * ESCALA_RIVAL)), Image.LANCZOS)
        return cache[n]
    rng = np.random.default_rng(7)
    ruido = None
    celdas = []
    for f in range(TOTAL):
        if f < IMPACTO:
            na, nb = cuadro_en(f / IMPACTO, RONIN[0], RONIN[1]), cuadro_en(f / IMPACTO, RIVAL[0], RIVAL[1])
        else:
            t = (f - IMPACTO) / (FIN_CAIDA - IMPACTO)
            na, nb = cuadro_en(t, RONIN[1], RONIN[2]), cuadro_en(t, RIVAL[1], RIVAL[2])
        lienzo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        rv = rival(nb)
        if f < IMPACTO:
            # Respira: el torso sube y baja apenas (1 %), con los pies fijos en el piso.
            resp = 1 + 0.01 * np.sin(f / FPS * 2 * np.pi / 1.3)
            rv = rv.resize((rv.width, round(rv.height * resp)), Image.BILINEAR)
            dy = rv.height - cache[nb].height
        else:
            dy = 0
        if f >= FIN_CAIDA:
            # Disolución en tinta: el rival se deshace en granos de abajo hacia arriba, con viento a la derecha.
            arr = np.asarray(rv).astype(np.float32)
            if ruido is None:
                ruido = rng.random(arr.shape[:2])
            p = (f - FIN_CAIDA + 1) / (TOTAL - FIN_CAIDA)
            corte = ruido * 0.8 + 0.2 * (np.arange(arr.shape[1])[None, :] / arr.shape[1])
            arr[..., 3] *= (corte > p).astype(np.float32)
            rv = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
        lienzo.alpha_composite(rv, (round(ox), round(oy) - dy))
        ra = capa(f'{dir_a}/{na:04d}.png', 25, tema, 'ronin')
        lienzo.alpha_composite(ra, (-x0, -y0))
        celdas.append(lienzo.resize((round(W * ESCALA), round(H * ESCALA)), Image.LANCZOS))
    return celdas

for tema in TEMAS:
    celdas = tira(tema)
    w, h = celdas[0].size
    cols = 10
    filas = (len(celdas) + cols - 1) // cols
    hoja = Image.new('RGBA', (w * cols, h * filas), (0, 0, 0, 0))
    for i, c in enumerate(celdas):
        hoja.paste(c, ((i % cols) * w, (i // cols) * h))
    hoja.save(f'{salida}/ejecucion-{tema}.webp', 'WEBP', quality=68, method=6, alpha_quality=75)

# Punta de la hoja en el impacto (px del ronin) -> px de la celda.
a = np.asarray(Image.open(f'{dir_a}/{RONIN[1]:04d}.png').convert('L')).astype(int)
ys, xs = np.where(a < UMBRAL)
punta = (int(xs.max()), int(ys[xs == xs.max()].mean()))
print(json.dumps({'celda': [w, h], 'columnas': cols, 'filas': filas, 'cuadros': TOTAL, 'fps': FPS, 'impacto': IMPACTO, 'finCaida': FIN_CAIDA,
                  'pies': round((PISO_RONIN - CAJA[1]) * ESCALA), 'punta': [round((punta[0] - CAJA[0]) * ESCALA), round((punta[1] - CAJA[1]) * ESCALA)],
                  'torso': [round((TORSO_RIVAL[1] - CAJA[0]) * ESCALA), round((punta[1] - CAJA[1]) * ESCALA)]}))
