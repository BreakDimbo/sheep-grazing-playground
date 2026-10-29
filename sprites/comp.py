# hand composite of two packed versions of one tree cell: blend a variant's masses onto the current crown with a soft mask
# usage: comp.py CELL base.webp variant.webp mode lo hi [alpha=base|max] -> writes site/sprites/trees.webp
#  mode top: weight 1 above lo..hi (fraction of crown height from top), 0 below; mode lit: weight by variant's luminance (lit faces)
import cv2, numpy as np, json, sys
cell=int(sys.argv[1]); B=cv2.imread(sys.argv[2],cv2.IMREAD_UNCHANGED); V=cv2.imread(sys.argv[3],cv2.IMREAD_UNCHANGED)
mode, lo, hi = sys.argv[4], float(sys.argv[5]), float(sys.argv[6]); am = sys.argv[7] if len(sys.argv)>7 else 'base'
meta=json.load(open('site/sprites/meta.json'))['trees']; TC,COLS=meta['cell'],meta['cols']; x0,y0=(cell%COLS)*TC,(cell//COLS)*TC
b=B[y0:y0+TC,x0:x0+TC].astype(np.float32); v=V[y0:y0+TC,x0:x0+TC].astype(np.float32)
ys,xs=np.where(b[...,3]>127); t,h=ys.min(),ys.max()-ys.min()+1
if mode=='top':
    f=(np.arange(TC)[:,None]-t)/h; W=np.clip((hi-f)/(hi-lo),0,1)*np.ones((1,TC))
else:
    L=cv2.cvtColor(v[...,:3].astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32); m=v[...,3]>127; q0,q1=np.percentile(L[m],[lo*100,hi*100]); W=np.clip((L-q0)/(q1-q0),0,1)
W=cv2.GaussianBlur(W.astype(np.float32),(0,0),6)*(v[...,3]/255)
o=b.copy(); o[...,:3]=b[...,:3]*(1-W[...,None])+v[...,:3]*W[...,None]
if am=='max': o[...,3]=np.maximum(b[...,3],v[...,3]*(W>0.5))
B[y0:y0+TC,x0:x0+TC]=np.clip(o,0,255).astype(np.uint8); cv2.imwrite('site/sprites/trees.webp',B,[cv2.IMWRITE_WEBP_QUALITY,92]); print('ok')
