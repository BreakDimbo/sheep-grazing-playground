# chroma-key generated sprite sheets and pack them into atlases
import cv2, numpy as np, json, sys
def key(path, bgtype='magenta'):
    im = cv2.imread(path).astype(np.float32)[..., ::-1]  # RGB
    if bgtype == 'magenta':
        m = np.minimum(im[..., 0], im[..., 2]) - im[..., 1]
    else:
        m = 255 - im.max(-1)  # black bg: "background-ness"
    h, w = m.shape
    corners = np.concatenate([m[:20, :20].ravel(), m[:20, -20:].ravel(), m[-20:, :20].ravel(), m[-20:, -20:].ravel()])
    mb = np.median(corners)
    bgc = np.median(np.concatenate([im[:20, :20].reshape(-1, 3), im[-20:, -20:].reshape(-1, 3)]), 0)
    fg = (m < mb * 0.5).astype(np.uint8)
    lab_n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(fg, np.ones((15, 15), np.uint8)))
    comps = [i for i in range(1, lab_n) if st[i, 4] > 3000]
    out = []
    for i in comps:
        x, y, ww, hh = st[i, :4]
        sel = (lab == i)
        inner = cv2.erode((fg * sel).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        mf = np.median(m[inner]) if inner.any() else 0
        a = np.clip((mb - m) / max(1, (mb - mf)), 0, 1) * sel
        a[a < 0.04] = 0
        A = a[..., None]
        C = np.clip((im - (1 - A) * bgc) / np.maximum(A, 1e-3), 0, 255)
        rgba = np.dstack([C, a * 255]).astype(np.uint8)[y:y + hh, x:x + ww]
        out.append(dict(x=x, y=y, w=ww, h=hh, rgba=rgba))
    # sort into rows then columns
    out.sort(key=lambda o: o['y'] + o['h'] / 2)
    rows = []
    for o in out:
        if rows and abs((rows[-1][0]['y'] + rows[-1][0]['h'] / 2) - (o['y'] + o['h'] / 2)) < h * 0.2: rows[-1].append(o)
        else: rows.append([o])
    res = []
    for r in rows: res += sorted(r, key=lambda o: o['x'])
    return res
if __name__ == '__main__':
    for f in sys.argv[1:]:
        s = key(f); print(f, len(s), [(o['w'], o['h']) for o in s])
