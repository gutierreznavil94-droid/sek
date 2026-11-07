"""Regenera src/assets/fuentes/pincel.woff2 (Yuji Syuku, OFL) solo con los kanji que usa la app.
Uso: python3 scripts/pincel-fuente.py  (agregar los kanji nuevos a KANJI)."""
import os, re, ssl, urllib.request
KANJI = '体力印夜始常弾心忍志掟描整斬昇昼時朝柱次段目眠誓連進鍛静食一二三四五六七八九十水願読学書走歩音健早律耐甦道写今墓逃減祝Elprogesnia.'
ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE', '/root/.ccr/ca-bundle.crt')) if os.path.exists('/root/.ccr/ca-bundle.crt') else ssl.create_default_context()
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
url = 'https://fonts.googleapis.com/css2?family=Yuji+Syuku&text=' + urllib.parse.quote(KANJI)
css = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': ua}), context=ctx).read().decode()
m = re.search(r'url\((https://[^)]+)\) format', css)
assert m, css
datos = urllib.request.urlopen(urllib.request.Request(m.group(1), headers={'User-Agent': ua}), context=ctx).read()
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'fuentes', 'pincel.woff2')
open(out, 'wb').write(datos)
print('ok', len(datos), 'bytes', len(KANJI), 'kanji')
