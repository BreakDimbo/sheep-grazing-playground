# edet.py ours.png [gain] : measure solid-edge position ref vs ours along each side, store per-side metre offsets in layout.edgeDet (128 bins over the side parameter)
import cv2,numpy as np,json,sys
pre='export const LAYOUT='; s=open('site/layout.js').read(); L=json.loads(s[len(pre):].strip().rstrip(';'))
H=np.array(L['cam']['Hpix']).reshape(3,3); Hi=np.linalg.inv(H); Wm,Dm=None,None
gain=float(sys.argv[2]) if len(sys.argv)>2 else 1.0
P=np.array([208,221,228])
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
def cov(im): return (np.abs(im.astype(int)-P).sum(-1)>40)
cr,cu=cov(ref),cov(us)
def first(row):
    sm=np.convolve(row,np.ones(9)/9,'same'); xs=np.nonzero(sm>0.9)[0]; return xs[0] if len(xs) else -1
def uv(x,y): p=Hi@np.array([x,y,1.0]); return p[:2]/p[2]
NB=256; E=None
out={}
for side in ['left','right','top','bottom']:
    pts=[]
    if side in ('left','right'):
        for y in range(200,1300,3):
            rr=cr[y,:1188] if side=='left' else cr[y,1188:][::-1]; ru=cu[y,:1188] if side=='left' else cu[y,1188:][::-1]
            a,b=first(rr),first(ru)
            if a<0 or b<0: continue
            xa,xb=(a,b) if side=='left' else (2375-a,2375-b)
            ua,ub=uv(xa,y),uv(xb,y); pts.append((ub[1], (ua[0]-ub[0])*(1 if side=='left' else -1)))
    else:
        for x in range(300,2100,3):
            rr=cr[:716,x] if side=='top' else cr[716:,x][::-1]; ru=cu[:716,x] if side=='top' else cu[716:,x][::-1]
            a,b=first(rr),first(ru)
            if a<0 or b<0: continue
            ya,yb=(a,b) if side=='top' else (1431-a,1431-b)
            ua,ub=uv(x,ya),uv(x,yb); pts.append((ub[0], (ua[1]-ub[1])*(1 if side=='top' else -1)))
    pts=np.array(pts); pts=pts[np.abs(pts[:,1])<0.03]; t=pts[:,0]; d=pts[:,1]
    # d>0: ref edge is further inward -> we must move our edge inward: eAt adds -offset... store uv shift; JS converts with W/D
    bins=np.linspace(-0.1,1.1,NB); vals=np.full(NB,np.nan)
    for i,b0 in enumerate(bins):
        m=np.abs(t-b0)<1.2/NB*0.75
        if m.sum()>=2: vals[i]=np.median(d[m])
    ok=~np.isnan(vals); idx=np.arange(NB); vals=np.interp(idx,idx[ok],vals[ok]) if ok.any() else np.zeros(NB)
    vals=np.convolve(np.pad(vals,1,mode='edge'),[.25,.5,.25],'valid')
    old=np.array(L.get('edgeDet',{}).get(side,[0]*NB)); old=np.interp(np.linspace(0,1,NB),np.linspace(0,1,len(old)),old); new=np.clip(old+gain*vals,-0.04,0.04)
    out[side]=new.round(5).tolist(); print(side,'n',len(pts),'mean|d|',np.abs(d).mean().round(4),'sd',d.std().round(4))
L['edgeDet']=out; open('site/layout.js','w').write(pre+json.dumps(L,separators=(',',':'))+';\n')
