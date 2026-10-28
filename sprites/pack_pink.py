# append the lumpy trunk-less pink crowns (gen/pink*.png, 2x2 on green; gen/pink2.png is the one used) as a 4th row of the tree atlas
import cv2, numpy as np, json, sys
sys.path.insert(0, 'site/sprites')
SQ = float(sys.argv[1]) if len(sys.argv) > 1 else 0.86     # horizontal squash: the generated crowns are wider than the reference's
im = cv2.imread(sys.argv[2] if len(sys.argv) > 2 else 'gen/pink.png').astype(np.float32)[..., ::-1]
m = im[..., 1] - np.maximum(im[..., 0], im[..., 2])           # green-ness
fg = (m < 60).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(fg, np.ones((9, 9), np.uint8)))
comps = sorted([i for i in range(1, n) if st[i, 4] > 3000], key=lambda i: (st[i, 1] // 300, st[i, 0]))
T = cv2.cvtColor(cv2.imread('out/trees_backup.webp', cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA)
meta = json.load(open('out/meta_backup.json')); TC = meta['trees']['cell']
T = np.vstack([T, np.zeros((TC, T.shape[1], 4), np.uint8)]); row = T.shape[0] // TC - 1
cells = meta['trees']['cells'][:24]
for c, i in enumerate(comps[:4]):
    x, y, w, h = st[i, :4]; sel = lab[y:y+h, x:x+w] == i
    mm = m[y:y+h, x:x+w]; a = np.clip((200 - mm) / 140, 0, 1) * sel
    A = a[..., None]; C = np.clip((im[y:y+h, x:x+w] - (1 - A) * np.array([0, 255, 0])) / np.maximum(A, 1e-3), 0, 255)
    C[..., 1] = np.minimum(C[..., 1], (C[..., 0] + C[..., 2]) / 2)            # kill green spill
    rgba = np.dstack([C, a * 255]).astype(np.uint8)
    rgba = cv2.resize(rgba, (int(w * SQ), h), interpolation=cv2.INTER_AREA)
    k = 370 / max(rgba.shape[:2]); r = cv2.resize(rgba, None, fx=k, fy=k, interpolation=cv2.INTER_AREA); hh, ww = r.shape[:2]
    x0 = c * TC + TC // 2 - ww // 2; y0 = row * TC + TC - 6 - hh; T[y0:y0+hh, x0:x0+ww] = r
    cells.append(dict(w=ww / TC, h=hh / TC))
meta['trees']['cells'] = cells
cv2.imwrite('site/sprites/trees.webp', cv2.cvtColor(T, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 92])
open('site/sprites/meta.json', 'w').write(json.dumps(meta)); print('cells', len(cells), cells[-4:])
