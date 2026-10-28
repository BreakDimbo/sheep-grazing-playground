# flfit.py ours.png [gain] : fit a coarse flower-density multiplier (layout.flowerMul, 32x40 over the texture) so the local dot counts match the ref
import cv2, numpy as np, json, sys
src = open('compare.py').read().split('regions=dict')[0]; sys.argv, arg = ['x', 'ref/F0.png', sys.argv[1], 'x'], sys.argv; exec(src)
gain = float(arg[2]) if len(arg) > 2 else 1.0
pre = 'export const LAYOUT='; s = open('site/layout.js').read(); L = json.loads(s[len(pre):].strip().rstrip(';'))
Hi = np.linalg.inv(np.array(L['cam']['Hpix']).reshape(3, 3)); E = 0.05; GW, GH = 32, 40
fields = (light | bright | dark | lime | wheat)
def dots(im):
    im = cv2.resize(im, (2376, 1432)) if im.shape[1] != 2376 else im
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(float); bg = cv2.GaussianBlur(lab, (0, 0), 5); dl = lab[..., 0] - bg[..., 0]; b = lab[..., 2] - 128; a = lab[..., 1] - 128
    L0 = lab[..., 0]; m = (((dl > 16) & (b > 28) & (a > -28) & (L0 > 195)) | ((dl > 16) & (b < 22) & (L0 > 225) & (a > -12)))
    fm = cv2.resize(fields.astype(np.uint8), (2376, 1432), interpolation=cv2.INTER_NEAREST) > 0
    n, lb, st, ce = cv2.connectedComponentsWithStats((m & fm).astype(np.uint8), 8); G = np.zeros((GH, GW))
    for x, y in ce[1:]:
        p = Hi @ np.array([x, y, 1.0]); u, v = p[:2] / p[2]; gx, gy = int((u + E) / (1 + 2 * E) * GW), int((v + E) / (1 + 2 * E) * GH)
        if 0 <= gx < GW and 0 <= gy < GH: G[gy, gx] += 1
    return cv2.GaussianBlur(G, (0, 0), 1.5)
R, O = dots(cv2.imread('ref/F0.png')), dots(cv2.imread(arg[1]))
M0 = np.array(L.get('flowerMul', [1] * (GW * GH))).reshape(GH, GW)
ratio = np.clip((R + 0.3) / (O + 0.3), 0.5, 1.0) ** gain; L['flowerAdd'] = [round(float(x), 2) for x in np.maximum(0, R - O).ravel()]
M = np.clip(M0 * ratio, 0.3, 3.0); L['flowerMul'] = [round(float(x), 3) for x in M.ravel()]
open('site/layout.js', 'w').write(pre + json.dumps(L, separators=(',', ':')) + ';\n')
print('ref dots', R.sum().round(), 'ours', O.sum().round(), 'mul range', M.min().round(2), M.max().round(2))
