#!/usr/bin/env python3
"""
앱 아이콘 만들기 — desktop/build/icon.png (512x512, 투명 배경) 한 장에서 Android 용 아이콘을 모두 만든다.

    python3 android/scripts/make-icons.py

만드는 파일 (만든 PNG 는 저장소에 올려 둔다 — 아이콘을 바꿨을 때만 다시 실행):
  app/src/main/res/mipmap-<밀도>/ic_launcher_foreground.png  적응형 아이콘 앞 층 (108dp, 그림은 가운데 지름 66dp 안전 영역 안)
  app/src/main/res/mipmap-<밀도>/ic_launcher_background.png  적응형 아이콘 뒤 층 (하늘색 그라데이션)
  app/src/main/res/mipmap-<밀도>/ic_launcher.png · ic_launcher_round.png  옛 방식 아이콘 (48dp)
  store/icon-512.png                                        Play 스토어 아이콘 (512x512, 모서리는 스토어가 둥글게 자른다)
필요: Pillow (pip install pillow)
"""
import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
AND = os.path.dirname(HERE)
SRC = os.path.join(AND, '..', 'desktop', 'build', 'icon.png')
RES = os.path.join(AND, 'app', 'src', 'main', 'res')
STORE = os.path.join(AND, 'store')

DENSITIES = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}
TOP, BOTTOM = (38, 84, 122), (150, 190, 214)   # 뒤 층: 위 → 아래
SAFE = 66 / 108 / 2 * 0.96                     # 안전 영역 반지름 (캔버스 크기에 대한 비율, 4% 여유)
SS = 4                                         # 가장자리를 매끄럽게: 크게 그려 줄인다


def load_art():
    """원본에서 그림 부분만 잘라 내고, 그림 중심에서 가장 먼 불투명 픽셀까지의 거리(반지름)를 잰다."""
    im = Image.open(SRC).convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    art = im.crop(box)
    w, h = art.size
    cx, cy = w / 2, h / 2
    alpha = art.getchannel('A').load()
    r = 0.0
    for y in range(h):
        for x in range(w):
            if alpha[x, y] > 8:
                r = max(r, math.hypot(x + 0.5 - cx, y + 0.5 - cy))
    return art, r


def gradient(size):
    col = Image.new('RGB', (1, size))
    px = col.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM))
    return col.resize((size, size), Image.BILINEAR).convert('RGBA')


def foreground(size, art, radius, fit):
    """size 캔버스 가운데에 그림을 놓는다. fit = 그림의 바깥 반지름이 차지할 캔버스 비율."""
    scale = fit * size / radius
    w, h = max(1, round(art.width * scale)), max(1, round(art.height * scale))
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    layer.alpha_composite(art.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return layer


def masked(img, shape):
    """shape: 'round' 원 · 'squircle' 둥근 사각형 — 옛 방식 아이콘용"""
    size = img.width
    big = Image.new('L', (size * SS, size * SS), 0)
    d = ImageDraw.Draw(big)
    if shape == 'round':
        d.ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size * SS - 1, size * SS - 1), radius=round(size * SS * 0.22), fill=255)
    out = img.copy()
    out.putalpha(big.resize((size, size), Image.LANCZOS))
    return out


def save(img, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print(f'  {os.path.relpath(path, AND)}  {img.width}x{img.height}  {os.path.getsize(path)} B')


def main():
    art, radius = load_art()
    for name, k in DENSITIES.items():
        d = os.path.join(RES, 'mipmap-' + name)
        full = round(108 * k)
        save(foreground(full, art, radius, SAFE), d, 'ic_launcher_foreground.png')
        save(gradient(full).convert('RGB'), d, 'ic_launcher_background.png')
        legacy = round(48 * k)
        flat = gradient(legacy * SS)
        flat.alpha_composite(foreground(legacy * SS, art, radius, 0.40))
        flat = flat.resize((legacy, legacy), Image.LANCZOS)
        save(masked(flat, 'squircle'), d, 'ic_launcher.png')
        save(masked(flat, 'round'), d, 'ic_launcher_round.png')
    store = gradient(512)
    store.alpha_composite(foreground(512, art, radius, 0.37))
    save(store, STORE, 'icon-512.png')


if __name__ == '__main__':
    main()
