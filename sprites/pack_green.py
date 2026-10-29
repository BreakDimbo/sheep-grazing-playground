# append the lumpy trunk-less pink crowns (gen/pink*.png, 2x2 on green; gen/pink2.png is the one used) as a 4th row of the tree atlas
import cv2, numpy as np, json, sys
sys.path.insert(0, 'site/sprites')
SQ = float(sys.argv[1]) if len(sys.argv) > 1 else 0.86     # horizontal squash: the generated crowns are wider than the reference's
im = cv2.imread(sys.argv[2] if len(sys.argv) > 2 else 'gen/pink.png').astype(np.float32)[..., ::-1]
m = np.minimum(im[..., 0], im[..., 2]) - im[..., 1]           # magenta-ness
fg = (m < 60).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(fg, np.ones((9, 9), np.uint8)))
comps = sorted([i for i in range(1, n) if st[i, 4] > 3000], key=lambda i: (st[i, 1] // 300, st[i, 0]))
BASE = sys.argv[3] if len(sys.argv) > 3 else 'out/trees_backup'   # base atlas (+ .webp / _meta.json); out/trees_r4 keeps the pink2 row and appends a 5th
T = cv2.cvtColor(cv2.imread(BASE + '.webp', cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA)
meta = json.load(open(BASE.replace('trees', 'meta') + '.json')); TC = meta['trees']['cell']
cells = meta['trees']['cells'][:24] if BASE == 'out/trees_backup' else meta['trees']['cells']; COLS = meta['trees'].get('cols', 8); start = len(cells)
row, col0 = start // COLS, start % COLS                     # fill the next free cells (row-major, as the atlas lookup expects)
if row >= T.shape[0] // TC: T = np.vstack([T, np.zeros((TC, T.shape[1], 4), np.uint8)])
for c, i in enumerate(comps[:4]):
    x, y, w, h = st[i, :4]; sel = lab[y:y+h, x:x+w] == i
    mm = m[y:y+h, x:x+w]; a = np.clip((200 - mm) / 140, 0, 1) * sel
    A = a[..., None]; C = np.clip((im[y:y+h, x:x+w] - (1 - A) * np.array([255, 0, 255])) / np.maximum(A, 1e-3), 0, 255)
    C[..., 0] = np.minimum(C[..., 0], C[..., 1]); C[..., 2] = np.minimum(C[..., 2], C[..., 1])   # kill magenta spill
    rgba = np.dstack([C, a * 255]).astype(np.uint8)
    rgba = cv2.resize(rgba, (int(w * SQ), h), interpolation=cv2.INTER_AREA)
    k = 370 / max(rgba.shape[:2]); r = cv2.resize(rgba, None, fx=k, fy=k, interpolation=cv2.INTER_AREA); hh, ww = r.shape[:2]
    x0 = (col0 + c) * TC + TC // 2 - ww // 2; y0 = row * TC + TC - 6 - hh; T[y0:y0+hh, x0:x0+ww] = r
    cells.append(dict(w=ww / TC, h=hh / TC))
meta['trees']['cells'] = cells
cv2.imwrite('site/sprites/trees.webp', cv2.cvtColor(T, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
open('site/sprites/meta.json', 'w').write(json.dumps(meta)); print('cells', len(cells), cells[-4:])
