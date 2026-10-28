# Measure line features (hedges / river / path) in the reference and in our render along normals of our
# layout polylines; move the polylines by the difference (ref - ours) and report width ratios.
import cv2, numpy as np, json, sys
kind = sys.argv[1]; bld_p = sys.argv[2]; apply = len(sys.argv) > 3 and sys.argv[3] == 'apply'
s = open('site/layout.js').read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1])
H = np.array(L['cam']['Hpix']).reshape(3, 3); Hi = np.linalg.inv(H)
ref = cv2.imread('ref/F0.png').astype(np.float32); bld = cv2.resize(cv2.imread(bld_p), (2376, 1432)).astype(np.float32)
def sig(im):
    b, g, r = im[..., 0], im[..., 1], im[..., 2]; Lm = 0.3 * r + 0.59 * g + 0.11 * b
    if kind == 'hedges': return -Lm                    # dark lines
    if kind == 'river': return b - 0.5 * (r + g)       # blue
    if kind == 'path': return r - g * 0.5 - b * 0.5 + 0.3 * Lm     # sandy / light
SR, SB = sig(ref), sig(bld)
def proj(p): q = cv2.perspectiveTransform(np.array(p, np.float64)[None], H)[0]; return q
def unproj(p): return cv2.perspectiveTransform(np.array(p, np.float64)[None], Hi)[0]
def bez(pts):            # same curve as smoothPath()
    pts = np.array(pts); out = [pts[0]]
    cur = pts[0]
    for i in range(1, len(pts) - 1):
        c = pts[i]; e = (pts[i] + pts[i + 1]) / 2
        for t in np.linspace(0, 1, 12)[1:]: out.append((1 - t) ** 2 * cur + 2 * (1 - t) * t * c + t * t * e)
        cur = e
    out.append(pts[-1]); return np.array(out)
def resample(p, step):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]; n = max(2, int(d[-1] / step) + 1)
    t = np.linspace(0, d[-1], n); return np.stack([np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])], 1)
objs = []
for sp in L['sheep']: objs.append((sp['px'][0], sp['px'][1] - 30, 95))
for x, y, w, k in L['treesPx']: objs.append((x, y, w * 0.75))
def blocked(x, y): return any((x - a) ** 2 + (y - b) ** 2 < r * r for a, b, r in objs)
R = {'hedges': 18, 'river': 40, 'path': 30}[kind]; ts = np.arange(-R, R + 0.01, 0.5)
def profile(S, p, n):
    xs = (p[0] + ts * n[0]).astype(np.float32)[None]; ys = (p[1] + ts * n[1]).astype(np.float32)[None]
    return cv2.remap(S, xs, ys, cv2.INTER_LINEAR)[0]
def feat(pr):
    base = np.percentile(pr, 20); d = np.clip(pr - base, 0, None)
    if d.max() < (6 if kind != 'river' else 15): return None
    i0 = np.argmax(d * np.exp(-(ts / (R * 0.7)) ** 2)); thr = d[i0] * 0.5
    a = i0
    while a > 0 and d[a - 1] > thr: a -= 1
    b = i0
    while b < len(d) - 1 and d[b + 1] > thr: b += 1
    w = d[a:b + 1]; c = (w * ts[a:b + 1]).sum() / w.sum()
    return c, (b - a + 1) * 0.5        # centre offset, FWHM px
lines = L[kind] if kind == 'hedges' else [L[kind]]
out, rep = [], []
for li, pl in enumerate(lines):
    uv = resample(bez(pl), 0.004); px = proj(uv)
    tg = np.gradient(px, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9; nm = np.stack([-tg[:, 1], tg[:, 0]], 1)
    dl, wr, ok = np.zeros(len(px)), np.full(len(px), np.nan), np.zeros(len(px), bool)
    for i, (p, n) in enumerate(zip(px, nm)):
        u, v = uv[i]
        if blocked(*p) or min(u, v, 1 - u, 1 - v) < 0.015: continue
        fr, fb = feat(profile(SR, p, n)), feat(profile(SB, p, n))
        if fr is None or fb is None or abs(fr[0] - fb[0]) > R * 0.6: continue
        dl[i] = fr[0] - fb[0]; wr[i] = fr[1] / max(fb[1], 0.5); ok[i] = True
    if ok.sum() < 3: out.append(pl); rep.append((li, 0, 0, 0, 1)); continue
    idx = np.arange(len(px)); d2 = np.interp(idx, idx[ok], dl[ok])
    k = 7; d2 = np.array([np.median(d2[max(0, i - k):i + k + 1]) for i in idx])
    d2 = np.convolve(np.pad(d2, 4, mode='edge'), np.ones(9) / 9, 'valid')
    new = unproj(px + d2[:, None] * nm)
    # keep the end points on their original location along the line (they meet other lines / board edge)
    new[0], new[-1] = uv[0], uv[-1]
    out.append(np.round(resample(new, 0.008), 5).tolist())
    rep.append((li, int(ok.sum()), round(float(np.abs(dl[ok]).mean()), 2), round(float(np.median(dl[ok])), 2), round(float(np.nanmedian(wr)), 2)))
for r in rep: print('line %d n=%d mean|d|=%.2fpx med d=%.2f widthRatio(ref/ours)=%.2f' % r)
json.dump([r[4] for r in rep], open(f'out/linefit_{kind}_w.json', 'w'))
if apply:
    if kind == 'hedges': L['hedges'] = out
    else: L[kind] = out[0]
    open('site/layout.js', 'w').write('export const LAYOUT=' + json.dumps(L, separators=(',', ':')) + ';\n'); print('applied')
