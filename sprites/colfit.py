# colfit.py ours.png [gain] : low-frequency field colour correction (layout.colCorr, 24x30 RGB offsets over the texture) from ref vs ours in field regions
import cv2, numpy as np, json, sys
src = open('compare.py').read().split('regions=dict')[0]; sys.argv, arg = ['x', 'ref/F0.png', sys.argv[1], 'x'], sys.argv; exec(src)
gain = float(arg[2]) if len(arg) > 2 else 0.7
pre = 'export const LAYOUT='; s = open('site/layout.js').read(); L = json.loads(s[len(pre):].strip().rstrip(';'))
Hi = np.linalg.inv(np.array(L['cam']['Hpix']).reshape(3, 3)); E = 0.05; GW, GH = 24, 30
fm = cv2.resize((light | bright | dark | lime | wheat).astype(np.uint8), (2376, 1432), interpolation=cv2.INTER_NEAREST) > 0
R = cv2.GaussianBlur(cv2.imread('ref/F0.png').astype(float), (0, 0), 3); O = cv2.GaussianBlur(cv2.resize(cv2.imread(arg[1]), (2376, 1432)).astype(float), (0, 0), 3)
ys, xs = np.nonzero(fm); ys, xs = ys[::3], xs[::3]
p = Hi @ np.stack([xs, ys, np.ones_like(xs)]).astype(float); u, v = p[0] / p[2], p[1] / p[2]
gx = ((u + E) / (1 + 2 * E) * GW).astype(int); gy = ((v + E) / (1 + 2 * E) * GH).astype(int); ok = (gx >= 0) & (gx < GW) & (gy >= 0) & (gy < GH)
S = np.zeros((GH, GW, 3)); N = np.zeros((GH, GW))
d = (R[ys, xs] - O[ys, xs])[:, ::-1]                                           # BGR -> RGB
np.add.at(S, (gy[ok], gx[ok]), d[ok]); np.add.at(N, (gy[ok], gx[ok]), 1)
Nb = cv2.GaussianBlur(N, (0, 0), 1.2); Sb = np.dstack([cv2.GaussianBlur(S[..., c], (0, 0), 1.2) for c in range(3)]) / np.maximum(Nb, 1e-6)[..., None]
Sb[Nb < 30] = 0
c0 = np.array(L.get('colCorr', [0] * (GW * GH * 3))).reshape(GH, GW, 3)
C = np.clip(c0 + gain * Sb, -25, 25); L['colCorr'] = [int(round(x)) for x in C.ravel()]
open('site/layout.js', 'w').write(pre + json.dumps(L, separators=(',', ':')) + ';\n'); print('corr range', C.min().round(1), C.max().round(1), 'mean|c|', np.abs(C).mean().round(2))
