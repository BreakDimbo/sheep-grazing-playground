# Board-edge position: along each side find where paint (saturation) crosses 50% between paper and field, ref vs ours.
import cv2, numpy as np, json, sys
s = open('site/layout.js').read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1]); H = np.array(L['cam']['Hpix']).reshape(3, 3)
def satmap(p):
    im = cv2.resize(cv2.imread(p), (2376, 1432)); hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
    return cv2.GaussianBlur(hsv[..., 1], (0, 0), 5)
A, B = satmap('ref/F0.png'), satmap(sys.argv[1])
proj = lambda p: cv2.perspectiveTransform(np.array(p, np.float64)[None], H)[0]
sides = {'top': lambda t: (t, 0.0), 'bottom': lambda t: (t, 1.0), 'left': lambda t: (0.0, t), 'right': lambda t: (1.0, t)}
inward = {'top': (0, 1), 'bottom': (0, -1), 'left': (1, 0), 'right': (-1, 0)}
ts_ = np.arange(-60, 60.1, 0.5); res = {}; uvd = {}
objs = [(x, y, w * 0.9) for x, y, w, k in L['treesPx']] + [(sp['px'][0], sp['px'][1], 90) for sp in L['sheep']]
for name, f in sides.items():
    row = []
    for t in np.linspace(0.04, 0.96, 24):
        u, v = f(t); du, dv = inward[name]
        p0, p1 = proj([[u, v], [u + du * 0.02, v + dv * 0.02]]); n = (p1 - p0) / np.linalg.norm(p1 - p0)
        if any((p0[0] - a) ** 2 + (p0[1] - b) ** 2 < r * r for a, b, r in objs): row.append(None); continue
        xs = (p0[0] + ts_ * n[0]).astype(np.float32)[None]; ys = (p0[1] + ts_ * n[1]).astype(np.float32)[None]
        cr = []
        for S in (A, B):
            pr = cv2.remap(S, xs, ys, cv2.INTER_LINEAR)[0]; lo, hi = np.percentile(pr[:40], 50), np.percentile(pr[-40:], 50)
            k = np.where(pr > (lo + hi) / 2)[0]; cr.append(ts_[k[0]] if len(k) and hi - lo > 15 else np.nan)
        ppu = np.linalg.norm(p1 - p0) / 0.02
        row.append(round(float(cr[0] - cr[1]), 1) if not np.isnan(cr).any() else None); uvd.setdefault(name, []).append((t, (cr[0] - cr[1]) / ppu) if row[-1] is not None else None)
    res[name] = row
    v = [x for x in row if x is not None]; print(name, 'median %.1f px  mean|d| %.1f' % (np.median(v), np.mean(np.abs(v))), row)
json.dump(res, open('out/edgefit.json', 'w'))

DEG = int(sys.argv[3]) if len(sys.argv) > 3 else 2
apply = len(sys.argv) > 2 and sys.argv[2] == 'apply'
cur = L.get('edgeFit', {}); new = {}
for name in sides:
    pts = np.array([p for p in uvd.get(name, []) if p is not None])
    if len(pts) < 6: new[name] = cur.get(name, [0, 0, 0]); continue
    t, d = pts[:, 0], pts[:, 1]; d = np.clip(d, np.percentile(d, 15), np.percentile(d, 85))
    c = np.polyfit(t, d, DEG)[::-1] * 0.8                    # c0 + c1 t + c2 t^2, damped
    new[name] = [round(float(a + b), 5) for a, b in zip((list(cur.get(name, [])) + [0] * 9)[:DEG + 1], c)]
print('edgeFit', new)
if apply:
    L['edgeFit'] = new; open('site/layout.js', 'w').write('export const LAYOUT=' + json.dumps(L, separators=(',', ':')) + ';\n'); print('applied')
