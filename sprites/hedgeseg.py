# hedgeseg.py ours.png [gain] : per-vertex hedge width multipliers (layout.hedgeSeg) from perpendicular dark-band widths, ref vs ours
import cv2, numpy as np, json, sys
pre = 'export const LAYOUT='; s = open('site/layout.js').read(); L = json.loads(s[len(pre):].strip().rstrip(';'))
H = np.array(L['cam']['Hpix']).reshape(3, 3); gain = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
def px(u, v): p = H @ np.array([u, v, 1.0]); return p[:2] / p[2]
def lum(f):
    im = cv2.imread(f); im = cv2.resize(im, (2376, 1432)) if im.shape[1] != 2376 else im
    return cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[..., 0].astype(float), (0, 0), 1.2)
R, O = lum('ref/F0.png'), lum(sys.argv[1])
def width(img, p, n):
    ts = np.arange(-40, 41); xs = p[0] + n[0] * ts; ys = p[1] + n[1] * ts
    ok = (xs > 0) & (ys > 0) & (xs < 2375) & (ys < 1431)
    if not ok.all(): return np.nan
    prof = cv2.remap(img.astype(np.float32), xs.astype(np.float32)[None], ys.astype(np.float32)[None], cv2.INTER_LINEAR)[0]
    bg = np.median(np.r_[prof[:12], prof[-12:]]); mn = prof[30:51].min()
    if bg - mn < 12: return np.nan
    thr = (bg + mn) / 2; c = 40; i = np.argmin(prof[30:51]) + 30; a = i; b = i
    while a > 0 and prof[a] < thr: a -= 1
    while b < 80 and prof[b] < thr: b += 1
    return b - a
seg = []; cur = L.get('hedgeSeg')
for hi, h in enumerate(L['hedges']):
    h = np.array(h); r = []
    for k in range(len(h)):
        a, b = h[max(k - 1, 0)], h[min(k + 1, len(h) - 1)]; p = px(*h[k]); d = px(*b) - px(*a); d /= np.linalg.norm(d) + 1e-9; n = np.array([-d[1], d[0]])
        ws = [(width(R, p + d * o, n), width(O, p + d * o, n)) for o in (-6, 0, 6)]; ws = [w for w in ws if not np.isnan(w[0]) and not np.isnan(w[1])]
        r.append(np.median([w[0] / w[1] for w in ws]) if ws else np.nan)
    r = np.array(r); r[np.isnan(r)] = 1; r = np.clip(r, 0.6, 1.6)
    r = np.convolve(np.pad(r, 1, mode='edge'), [.25, .5, .25], 'valid')       # smooth along the hedge
    c0 = np.array(cur[hi]) if cur else np.ones(len(r)); seg.append(np.round(np.clip(c0 * r ** gain, 0.5, 1.8), 3).tolist())
L['hedgeSeg'] = seg; open('site/layout.js', 'w').write(pre + json.dumps(L, separators=(',', ':')) + ';\n')
allr = np.concatenate(seg); print('hedges', len(seg), 'verts', len(allr), 'range', allr.min(), allr.max(), 'mean', allr.mean().round(3))
