#!/usr/bin/env python3
"""Portadas de los videos: el primer cuadro de cada .mp4 del tema como <nombre>-inicio.webp (chico).
Se usan debajo del video mientras carga, así nunca se ve el ícono de play del navegador.
Uso: python3 scripts/portadas-videos.py   (necesita ffmpeg)"""
import pathlib, subprocess

RAIZ = pathlib.Path(__file__).resolve().parent.parent / 'public'
for mp4 in sorted(list((RAIZ / 'temas').rglob('*.mp4')) + list((RAIZ / 'shinobi').glob('*.mp4'))):
    sal = mp4.with_name(mp4.stem + '-inicio.webp')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mp4), '-frames:v', '1', '-vf', "scale='min(640,iw)':-2", '-quality', '72', str(sal)], check=True)
    print(sal.relative_to(RAIZ), sal.stat().st_size // 1024, 'KB')
