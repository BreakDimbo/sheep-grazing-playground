import json, numpy as np, sys
s = open('site/layout.js').read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1])
r = np.array(json.load(open('out/linefit_hedges_w.json'))); cur = np.array(L.get('hedgeW', [1] * len(r)))
L['hedgeW'] = np.round(np.clip(cur * r ** 0.7, 0.6, 2.0), 3).tolist(); print(L['hedgeW'])
open('site/layout.js', 'w').write('export const LAYOUT=' + json.dumps(L, separators=(',', ':')) + ';\n')
