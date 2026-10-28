# Fit a smooth quadratic colour correction (in board uv) per field from blurred ref-vs-ours differences.
import cv2, numpy as np, json, sys
src = open('compare.py').read(); src = src[:src.index('g1=cv2')]
sys.argv = ['x', 'ref/F0.png', sys.argv[1], 'ff'] + sys.argv[2:]; apply = 'apply' in sys.argv
exec(src)
Hi = np.linalg.inv(Hs)
# keep away from objects and their shadows (cast toward lower right)
ob = cv2.dilate(objects.astype(np.uint8), np.ones((25, 25), np.uint8)); ob = ob | np.roll(np.roll(ob, 18, 0), 22, 1)
r = cv2.GaussianBlur(ref.astype(np.float32), (0, 0), 3); b = cv2.GaussianBlur(bld.astype(np.float32), (0, 0), 3)
yy, xx = np.mgrid[0:H, 0:W]
uv = cv2.perspectiveTransform(np.stack([xx, yy], -1).reshape(1, -1, 2).astype(np.float64), Hi)[0].reshape(H, W, 2)
s = open('site/layout.js').read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1]); cur = L.get('fieldFix', {})
basis = lambda u, v: np.stack([np.ones_like(u), u, v, u * u, u * v, v * v], -1)
new = {}
for k in ['light', 'bright', 'dark', 'wheat']:
    m = regions[k] & (ob == 0); m = cv2.erode(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    d = (r - b)[m][:, ::-1]; U = uv[m]; A = basis(U[:, 0], U[:, 1])
    co = []
    for c in range(3):
        y = d[:, c]; lo, hi = np.percentile(y, [10, 90]); keep = (y > lo) & (y < hi)
        x = np.linalg.lstsq(A[keep], y[keep], rcond=None)[0]; co.append(x * 0.8)
    co = np.array(co); old = np.array(cur.get(k, np.zeros((3, 6))))
    new[k] = np.round(old + co, 2).tolist()
    print(k, 'mean diff RGB', d.mean(0).round(2), 'n', m.sum())
if apply:
    L['fieldFix'] = new; open('site/layout.js', 'w').write('export const LAYOUT=' + json.dumps(L, separators=(',', ':')) + ';\n'); print('applied')
