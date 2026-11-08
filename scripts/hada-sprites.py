"""Arma el sprite de un personaje que flota (estilo hada) a partir de UNA imagen recortada.

Uso: python3 -I scripts/hada-sprites.py <recorte.png> <salida.webp>
<recorte.png>: el personaje con fondo transparente (RGBA), recortado a su caja.
Misma grilla que shinobi/camina.webp (16 × 13 celdas de 96×70 px, a 2x) y mismos tramos que
usa src/ui/Shinobi.tsx: caminar 0..47 (38,4 fps), frenar 48..102, quieto 103..207 (12 fps).
En vez de caminar, sube y baja suave y aletea (las alas son los píxeles rosados del lado izquierdo).
"""
import sys, math
import numpy as np
from PIL import Image

COLS, FILAS, CW, CH = 16, 13, 96, 70
ANCLA = 46          # x del cuerpo dentro de la celda (px de la hoja; Shinobi.tsx usa 23 px CSS)
ALTO = 58           # alto del personaje en la hoja
CUERPO_X = 0.47     # dónde está el centro del cuerpo dentro del recorte (0..1)
ALAS_HASTA = 0.30   # las alas viven a la izquierda de esta fracción del ancho

src = Image.open(sys.argv[1]).convert('RGBA')
w = round(src.width * ALTO / src.height)
fig = np.asarray(src.resize((w, ALTO), Image.LANCZOS)).astype(np.float32)
r, g, b, a = (fig[..., i] for i in range(4))
xs = np.arange(w)[None, :].repeat(ALTO, 0)
ala = (xs < w * ALAS_HASTA) & ((r - g) > 18) & (a > 20)
cuerpo = fig.copy(); cuerpo[..., 3] *= ~ala
alas = fig.copy(); alas[..., 3] *= ala
cuerpo_im = Image.fromarray(cuerpo.astype(np.uint8), 'RGBA')
alas_im = Image.fromarray(alas.astype(np.uint8), 'RGBA')
borde = int(w * ALAS_HASTA)

def cuadro(t, periodo_flota, periodo_ala, amp=3.0):
    celda = Image.new('RGBA', (CW, CH))
    dy = amp * math.sin(2 * math.pi * t / periodo_flota)
    s = 0.78 + 0.22 * (0.5 + 0.5 * math.cos(2 * math.pi * t / periodo_ala))
    x0 = ANCLA - round(w * CUERPO_X)
    y0 = round((CH - ALTO) / 2 + dy)
    aw = max(1, round(borde * s))
    a2 = alas_im.crop((0, 0, borde, ALTO)).resize((aw, ALTO), Image.LANCZOS)
    celda.alpha_composite(a2, (x0 + borde - aw, y0))
    celda.alpha_composite(alas_im.crop((borde, 0, w, ALTO)), (x0 + borde, y0))
    celda.alpha_composite(cuerpo_im, (x0, y0))
    return celda

cuadros = []
cuadros += [cuadro(i / 38.4, 1.25, 0.25) for i in range(48)]          # caminar (en bucle: 1,25 s)
cuadros += [cuadro((48 + i) / 38.4, 1.25, 0.25 + i * 0.006) for i in range(55)]  # frenar: aletea más lento
cuadros += [cuadro(i / 12, 8.75 / 5, 8.75 / 25, 2.5) for i in range(105)]  # quieto (en bucle: 8,75 s)
hoja = Image.new('RGBA', (COLS * CW, FILAS * CH))
for k, c in enumerate(cuadros):
    hoja.alpha_composite(c, ((k % COLS) * CW, (k // COLS) * CH))
hoja.save(sys.argv[2], 'WEBP', quality=88, method=6)
print(len(cuadros), hoja.size)
