# setbank.py [mult] : write out/bankfit.json into layout.js riverBank (multiplying into the existing profile)
import json,sys,numpy as np
s=open('site/layout.js').read(); pre='export const LAYOUT='; L=json.loads(s[len(pre):].strip().rstrip(';'))
F=json.load(open('out/bankfit.json')); old=L.get('riverBank',{'L':[1]*len(F['L']),'R':[1]*len(F['R'])})
L['riverBank']={k:np.clip(np.array(old[k])*np.array(F[k]),0.75,1.3).round(3).tolist() for k in 'LR'}
open('site/layout.js','w').write(pre+json.dumps(L,separators=(',',':'))+';\n' if s.strip().endswith(';') else pre+json.dumps(L,separators=(',',':'))+'\n'); print('ok')
