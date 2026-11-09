"""Prepare generated art (made with an image generator, sources kept outside the repo in ../riyadiyat-art-src):
characters/stickers: remove the flat green background (flood fill from the border, so green eyes stay), soft edge, despill,
trim, resize, save WebP with alpha. Scenes: resize + WebP.  usage: python3 tools/art_prep.py"""
import numpy as np, os
from PIL import Image, ImageFilter
SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'riyadiyat-art-src'); OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'img')

def border_bg(rgb):
    r, g, b = [rgb[..., i].astype(np.int16) for i in range(3)]
    green = g - np.maximum(r, b)
    cand = (green > 60) & (g > 120)
    reach = np.zeros_like(cand); reach[0, :] = cand[0, :]; reach[-1, :] = cand[-1, :]; reach[:, 0] = cand[:, 0]; reach[:, -1] = cand[:, -1]
    while True:
        d = reach.copy(); d[1:] |= reach[:-1]; d[:-1] |= reach[1:]; d[:, 1:] |= reach[:, :-1]; d[:, :-1] |= reach[:, 1:]
        d &= cand
        if (d == reach).all(): break
        reach = d
    # enclosed holes of pure backdrop green (e.g. between an arm and the body); green eyes are darker, so they stay
    reach |= (g > 200) & (r < 90) & (b < 90) & (green > 140)
    return reach, green

def cutout(path, height, out):
    im = Image.open(path).convert('RGB'); rgb = np.array(im)
    bg, green = border_bg(rgb)
    # soft edge: pixels next to the background get partial alpha by how green they are
    near = np.array(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    alpha = np.where(bg, 0, 255).astype(np.float32)
    edge = near & ~bg
    alpha[edge] = np.clip((60 - green[edge]) / 60 * 255, 0, 255)
    # despill on edges + everything touching the background ring
    out_rgb = rgb.astype(np.int16)
    sp = edge | (np.array(Image.fromarray((near * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0) & ~bg
    gmax = np.maximum(out_rgb[..., 0], out_rgb[..., 2])
    out_rgb[..., 1] = np.where(sp & (out_rgb[..., 1] > gmax), gmax + (out_rgb[..., 1] - gmax) // 4, out_rgb[..., 1])
    a = Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = Image.fromarray(np.clip(out_rgb, 0, 255).astype(np.uint8)).convert('RGBA'); rgba.putalpha(a)
    bb = rgba.getbbox(); rgba = rgba.crop(bb)
    w = round(rgba.width * height / rgba.height); rgba = rgba.resize((w, height), Image.LANCZOS)
    rgba.save(out, 'WEBP', quality=86, method=6)
    return rgba.size

os.makedirs(OUT, exist_ok=True)
for c in ('cat', 'bird', 'bee'):
    for pose in ('wave', 'cheer', 'point', 'think', 'kind'):
        print(c, pose, cutout(f'{SRC}/{c}_{pose}.jpg', 440, f'{OUT}/{c}_{pose}.webp'))
for ch in ('seller', 'ammar'): print(ch, cutout(f'{SRC}/{ch}.jpg', 520, f'{OUT}/ch_{ch}.webp'))
for s in ('world_map', 'scene_station', 'scene_workshop', 'scene_farm'):
    Image.open(f'{SRC}/{s}.jpg').convert('RGB').resize((720, 1280), Image.LANCZOS).save(f'{OUT}/{s}.webp', 'WEBP', quality=72, method=6)
# stickers: 4x2 grid
sh = Image.open(f'{SRC}/stickers.jpg').convert('RGB'); W, H = sh.size
names = ['star', 'rainbow', 'cupcake', 'kite', 'butterfly', 'sun', 'flower', 'rocket']
for i, n in enumerate(names):
    cx, cy = i % 4, i // 4
    tile = sh.crop((cx * W // 4, cy * H // 2, (cx + 1) * W // 4, (cy + 1) * H // 2)); p = f'/tmp/st_{n}.png'
    # pad with green so the border flood fill reaches all around
    pad = Image.new('RGB', (tile.width + 20, tile.height + 20), (0, 255, 0)); pad.paste(tile, (10, 10)); pad.save(p)
    print(n, cutout(p, 200, f'{OUT}/st_{n}.webp'))

# index thumbnails: crops of the places on the world map (720x1280 coordinates; the same boxes are the map hotspots in main.js)
PLACES = {'workshop': (325, 40, 680, 375), 'beadshop': (35, 135, 275, 375), 'farm': (455, 395, 705, 665), 'station': (25, 400, 300, 750), 'jars': (150, 230, 340, 390)}
wm = Image.open(f'{SRC}/world_map.jpg').convert('RGB').resize((720, 1280), Image.LANCZOS)
for k, b in PLACES.items():
    t = wm.crop(b); t.thumbnail((220, 220), Image.LANCZOS); t.save(f'{OUT}/pl_{k}.webp', 'WEBP', quality=78, method=6)
