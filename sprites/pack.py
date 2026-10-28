import cv2, numpy as np, json
from atlas import key
meta = {}
def place(atlas, rgba, cx, cy, cell, k, col, row, anchor='bottom'):
    r = cv2.resize(rgba, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    h, w = r.shape[:2]
    x0 = col * cell + cell // 2 - w // 2
    y0 = row * cell + (cell - 6 - h if anchor == 'bottom' else cell // 2 - h // 2)
    atlas[y0:y0 + h, x0:x0 + w] = r
    return dict(w=w / cell, h=h / cell)
# sheep: rows graze, stand, walk, jump
sheets = ['graze2', 'stand', 'walk2', 'jump2']
CELL = 256
A = np.zeros((CELL * 4, CELL * 8, 4), np.uint8)
meta['sheep'] = {'cell': CELL, 'rows': ['graze', 'stand', 'walk', 'jump'], 'cells': []}
import os
for r, n in enumerate(sheets):
    p = f'gen/sheep_{n}.png'
    if not os.path.exists(p): p = 'gen/sheep_stand.png'
    s = key(p); assert len(s) == 8, (p, len(s))
    k = 230 / s[0]['w']
    meta['sheep']['cells'].append([place(A, o['rgba'], 0, 0, CELL, k, c, r) for c, o in enumerate(s)])
cv2.imwrite('site/sprites/sheep.webp', cv2.cvtColor(A, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
# trees
TC = 384
s = key('gen/trees.png'); T = np.zeros((TC * 2, TC * 4, 4), np.uint8); cells = []
for i, o in enumerate(s):
    k = 370 / max(o['w'], o['h'])
    cells.append(place(T, o['rgba'], 0, 0, TC, k, i % 4, i // 4))
cv2.imwrite('site/sprites/trees.webp', cv2.cvtColor(T, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
meta['trees'] = {'cell': TC, 'cols': 4, 'cells': cells}
if os.path.exists('gen/clouds.png'):
    s = key('gen/clouds.png', 'black'); CC = 512; Cl = np.zeros((CC * 2, CC * 2, 4), np.uint8); cells = []
    for i, o in enumerate(s[:4]):
        k = 490 / max(o['w'], o['h'])
        cells.append(place(Cl, o['rgba'], 0, 0, CC, k, i % 2, i // 2, 'center'))
    cv2.imwrite('site/sprites/clouds.webp', cv2.cvtColor(Cl, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
    meta['clouds'] = {'cell': CC, 'cols': 2, 'cells': cells}
open('site/sprites/meta.json', 'w').write(json.dumps(meta))
cv2.imwrite('out/atlas_sheep_preview.png', cv2.cvtColor(A, cv2.COLOR_RGBA2BGRA)[..., :3] // 2 + (255 - cv2.cvtColor(A, cv2.COLOR_RGBA2BGRA)[..., 3:]) // 2)
print('ok')
