# put a Codex image-to-image edit of one atlas cell back in place: key the flat background, match the original cell's alpha bbox, overwrite the cell
# usage: pack_edit.py trees|clouds CELL edit.png [key=magenta|green]
import cv2, numpy as np, json, sys
kind, cell, path = sys.argv[1], int(sys.argv[2]), sys.argv[3]; key = sys.argv[4] if len(sys.argv) > 4 else 'magenta'
meta = json.load(open('site/sprites/meta.json'))[kind]; TC, COLS = meta['cell'], meta['cols']
T = cv2.imread(f'site/sprites/{kind}.webp', cv2.IMREAD_UNCHANGED)
x0, y0 = (cell % COLS) * TC, (cell // COLS) * TC; orig = T[y0:y0+TC, x0:x0+TC]
im = cv2.imread(path).astype(np.float32)[..., ::-1]          # RGB
if key == 'magenta': m = np.minimum(im[..., 0], im[..., 2]) - im[..., 1]; bg = np.array([255, 0, 255])
else: m = im[..., 1] - np.maximum(im[..., 0], im[..., 2]); bg = np.array([0, 255, 0])
a = np.clip((200 - m) / 140, 0, 1)
n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8)); big = 1 + np.argmax(st[1:, 4]); a *= cv2.dilate((lab == big).astype(np.uint8), np.ones((15, 15), np.uint8))
A = a[..., None]; C = np.clip((im - (1 - A) * bg) / np.maximum(A, 1e-3), 0, 255)
if key == 'magenta': C[..., 0] = np.minimum(C[..., 0], C[..., 1] * 1.6); C[..., 2] = np.minimum(C[..., 2], C[..., 1])
else: C[..., 1] = np.minimum(C[..., 1], (C[..., 0] + C[..., 2]) / 2 + 10); a = cv2.GaussianBlur(cv2.erode(a, np.ones((5, 5), np.uint8)), (0, 0), 2) * (a > 0); A = a[..., None]   # fuzzy cloud rims: stronger despill, pull the alpha in
rgba = np.dstack([C, a * 255]).astype(np.uint8)
ys, xs = np.where(a > 0.5); ex = rgba[ys.min():ys.max()+1, xs.min():xs.max()+1]
oy, ox = np.where(orig[..., 3] > 127); w, h = ox.max() - ox.min() + 1, oy.max() - oy.min() + 1
ex = cv2.resize(ex, (w, h), interpolation=cv2.INTER_AREA)
if '--match' in sys.argv:                                     # keep the edit's lobe structure but the original cell's per-channel mean/std (tone stays fitted)
    ma, mo = ex[..., 3] > 127, orig[..., 3] > 127; oc = cv2.cvtColor(orig, cv2.COLOR_BGRA2RGBA).astype(np.float32); ef = ex.astype(np.float32)
    for k in range(3): e, o = ef[..., k][ma], oc[..., k][mo]; ef[..., k] = (ef[..., k] - e.mean()) / (e.std() + 1e-3) * o.std() + o.mean()
    ex = np.dstack([np.clip(ef[..., :3], 0, 255), ef[..., 3]]).astype(np.uint8)
out = np.zeros_like(orig); out[oy.min():oy.min()+h, ox.min():ox.min()+w] = cv2.cvtColor(ex, cv2.COLOR_RGBA2BGRA)
T[y0:y0+TC, x0:x0+TC] = out
cv2.imwrite(f'site/sprites/{kind}.webp', T, [cv2.IMWRITE_WEBP_QUALITY, 92]); print(kind, cell, 'bbox', w, h)
