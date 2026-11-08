"""Arma las imágenes de ejemplo de la botella y la manzana para la vista previa de los widgets.
Mismas formas que android/app/src/main/java/ar/sek/app/Dibujo.java (caja 100x150).
Uso: python3 herramientas/widgets-vista.py  (necesita Pillow)."""
from PIL import Image, ImageDraw

S = 8  # dibujo a 8x y se achica, para bordes suaves
W, H = 200, 300
PAPEL = (241, 235, 223, 255)
OUT = 'android/app/src/main/res/drawable-nodpi/'


def cubic(p0, p1, p2, p3, n=24):
    return [tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))
            for t in (i/n for i in range(1, n+1))]


def quad(p0, p1, p2, n=12):
    return [tuple((1-t)**2*a + 2*(1-t)*t*b + t**2*c for a, b, c in zip(p0, p1, p2)) for t in (i/n for i in range(1, n+1))]


def botella_pts():
    p = [(40, 30)]
    p += cubic((40, 30), (40, 40), (18, 40), (18, 50))
    p += [(18, 138)]
    p += quad((18, 138), (18, 148), (28, 148))
    p += [(72, 148)]
    p += quad((72, 148), (82, 148), (82, 138))
    p += [(82, 50)]
    p += cubic((82, 50), (82, 40), (60, 40), (60, 30))
    p += [(60, 16), (40, 16)]
    return p


def manzana_pts():
    p = [(50, 62)]
    for seg in [((62, 50), (92, 52), (94, 84)), ((96, 114), (76, 138), (62, 138)), ((56, 138), (54, 135), (50, 135)),
                ((46, 135), (44, 138), (38, 138)), ((24, 138), (4, 114), (6, 84)), ((8, 52), (38, 50), (50, 62))]:
        p += cubic(p[-1], *seg)
    return p


def esc(pts):
    k = W * S / 100
    return [(x * k, y * k) for x, y in pts]


def llenar(pts, tope, color):
    """Relleno de la forma desde abajo hasta `tope` (coordenadas de la caja)."""
    m = Image.new('L', (W*S, H*S), 0)
    ImageDraw.Draw(m).polygon(esc(pts), fill=255)
    r = Image.new('L', (W*S, H*S), 0)
    ImageDraw.Draw(r).rectangle((0, tope * W*S/100, W*S, H*S), fill=255)
    from PIL import ImageChops
    m = ImageChops.multiply(m, r)
    capa = Image.new('RGBA', (W*S, H*S), color)
    return capa, m


def dibujar(pts, tope, color, extra):
    im = Image.new('RGBA', (W*S, H*S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon(esc(pts), fill=(241, 235, 223, 60))
    capa, m = llenar(pts, tope, color)
    im.paste(capa, (0, 0), m)
    extra(d)
    d.line(esc(pts + [pts[0]]), fill=PAPEL, width=int(4 * W*S/100 / 1), joint='curve')
    return im.resize((W, H), Image.LANCZOS)


def k(v):
    return v * W*S/100


def extra_botella(d):
    d.line([(k(26), k(60)), (k(26), k(132))], fill=(255, 255, 255, 110), width=int(k(4)))
    d.rounded_rectangle((k(37), k(3), k(63), k(16)), radius=k(3), fill=PAPEL)


def extra_manzana(d):
    d.line([(k(50), k(62)), (k(55), k(44))], fill=(138, 90, 43, 255), width=int(k(5)))
    hoja = [(55, 52)] + cubic((55, 52), (62, 40), (78, 40), (82, 44)) + cubic((82, 44), (76, 56), (62, 58), (55, 52))
    d.polygon(esc(hoja), fill=(76, 175, 80, 255))
    d.line([(k(30), k(80)), (k(26), k(100))], fill=(255, 255, 255, 110), width=int(k(4)))


if __name__ == '__main__':
    # Ejemplo: agua 1,25 / 2,25 L y fruta 1 / 2.
    dibujar(botella_pts(), 148 - (1.25/2.25)*(148-44), (79, 168, 232, 255), extra_botella).save(OUT + 'widget_ej_botella.png')
    dibujar(manzana_pts(), 138 - 0.5*(138-54), (210, 40, 60, 255), extra_manzana).crop((0, 72, 200, 282)).save(OUT + 'widget_ej_manzana.png')
    print('listo')


def titulo_ejemplo(texto='Día 12 de 90', px=72):
    """Título de ejemplo de la vista previa con la letra Brocha de Progreso (como Dibujo.titulo):
    blanco papel, sombra roja corrida y brillo rojo suave."""
    from PIL import ImageFont, ImageFilter
    f = ImageFont.truetype('android/app/src/main/res/font/brocha.ttf', px)
    corrida, margen = px // 9, px // 5
    asc, desc = f.getmetrics()
    x1 = f.getbbox(texto)[2]
    w, h = x1 + margen * 2 + corrida, asc + desc + margen * 2 + corrida
    brillo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(brillo).text((margen, margen), texto, font=f, fill=(200, 16, 46, 120))
    im = brillo.filter(ImageFilter.GaussianBlur(px / 5))
    d = ImageDraw.Draw(im)
    d.text((margen + corrida, margen + corrida), texto, font=f, fill=(200, 16, 46, 217))
    d.text((margen, margen), texto, font=f, fill=(243, 239, 230, 255), stroke_width=max(1, px // 40), stroke_fill=(243, 239, 230, 255))
    im.save(OUT + 'widget_ej_titulo.png')


if __name__ == '__main__':
    titulo_ejemplo()
