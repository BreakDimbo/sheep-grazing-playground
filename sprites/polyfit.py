# Field-boundary tracer: soft step edges of a field polygon, ref vs ours, along normals; moves vertices by the difference.
import cv2, numpy as np, json, sys
kind, bld_p = sys.argv[1], sys.argv[2]; apply = 'apply' in sys.argv
s = open('site/layout.js').read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1]); H = np.array(L['cam']['Hpix']).reshape(3, 3); Hi = np.linalg.inv(H)
def sig(p):
    im = cv2.resize(cv2.imread(p), (2376, 1432)).astype(np.float32); b, g, r = cv2.split(im)
    return cv2.GaussianBlur(0.3 * r + 0.59 * g + 0.11 * b, (0, 0), 4)
SR, SB = sig('ref/F0.png'), sig(bld_p)
proj = lambda p: cv2.perspectiveTransform(np.array(p, np.float64)[None], H)[0]
unproj = lambda p: cv2.perspectiveTransform(np.array(p, np.float64)[None], Hi)[0]
objs = [(x, y, w * 0.9) for x, y, w, k in L['treesPx']] + [(sp['px'][0] + 10, sp['px'][1], 100) for sp in L['sheep']]
hed = np.zeros((1432, 2376), np.uint8)
for h in L['hedges'] + [L['river'], L['path']]: cv2.polylines(hed, [proj(h).astype(np.int32)], False, 1, 40)
poly = np.array(L[kind]); n = len(poly); R = 40; ts = np.arange(-R, R + 0.01, 0.5)
ctr = proj(poly.mean(0, keepdims=True))[0]
def cross(S, p, nm):
    xs = (p[0] + ts * nm[0]).astype(np.float32)[None]; ys = (p[1] + ts * nm[1]).astype(np.float32)[None]
    pr = cv2.remap(S, xs, ys, cv2.INTER_LINEAR)[0]; a, b = pr[:20].mean(), pr[-20:].mean()
    if abs(b - a) < 4: return None
    t = (pr - a) / (b - a); k = np.where((t[:-1] < 0.5) & (t[1:] >= 0.5))[0]
    if len(k) != 1: return None
    i = k[0]; return ts[i] + 0.5 * (0.5 - t[i]) / (t[i + 1] - t[i] + 1e-9)
moves = np.zeros((n, 2)); cnt = np.zeros(n); rep = []
for i in range(n):
    a, b = poly[i], poly[(i + 1) % n]
    for f in np.linspace(0.1, 0.9, 7):
        uv = a + (b - a) * f
        if min(uv[0], uv[1], 1 - uv[0], 1 - uv[1]) < 0.03: continue
        p = proj([uv])[0]; q = proj([uv + (b - a) * 0.01])[0]; tg = (q - p) / (np.linalg.norm(q - p) + 1e-9); nm = np.array([-tg[1], tg[0]])
        if np.dot(nm, ctr - p) < 0: nm = -nm
        if hed[int(np.clip(p[1], 0, 1431)), int(np.clip(p[0], 0, 2375))] or any((p[0] - x) ** 2 + (p[1] - y) ** 2 < r * r for x, y, r in objs): continue
        cr, cb = cross(SR, p, nm), cross(SB, p, nm)
        if cr is None or cb is None: continue
        d = cr - cb; rep.append(d); duv = unproj([p + nm * d])[0] - uv
        for j, w in ((i, 1 - f), ((i + 1) % n, f)): moves[j] += duv * w; cnt[j] += w
print(kind, 'samples', len(rep), 'mean|d| %.2f px, median %.2f' % (np.mean(np.abs(rep)) if rep else 0, np.median(rep) if rep else 0))
if apply:
    m = cnt > 0.5; poly[m] += moves[m] / cnt[m, None] * 0.8
    L[kind] = np.round(poly, 5).tolist(); open('site/layout.js', 'w').write('export const LAYOUT=' + json.dumps(L, separators=(',', ':')) + ';\n'); print('applied', int(m.sum()), 'vertices moved')
