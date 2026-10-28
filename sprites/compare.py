import numpy as np, cv2, json, sys
from skimage.metrics import structural_similarity as ssim
from skimage.color import rgb2lab, deltaE_ciede2000
from PIL import Image
ref_p, bld_p, tag = sys.argv[1], sys.argv[2], sys.argv[3]
ref = cv2.imread(ref_p); bld = cv2.imread(bld_p)
H, W = 716, 1188
ref = cv2.resize(ref, (W, H), interpolation=cv2.INTER_AREA); bld = cv2.resize(bld, (W, H), interpolation=cv2.INTER_AREA)
s=open('site/layout.js').read(); L=json.loads(s[s.index('{'):s.rindex('}')+1])
Hp=np.array(L['cam']['Hpix']).reshape(3,3); S=np.diag([W/2376,H/1432,1]); Hs=S@Hp
def proj(pts): return cv2.perspectiveTransform(np.array(pts,np.float64)[None],Hs)[0]
def polymask(pts):
    m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[proj(pts).astype(np.int32)],1); return m>0
def linemask(pts,wuv):
    m=np.zeros((H,W),np.uint8); p=proj(pts); 
    # approximate width in px via local scale
    for a,b,q in zip(p[:-1],p[1:],pts[:-1]):
        d=proj([q,[q[0]+wuv,q[1]]]); wpx=max(1,int(np.linalg.norm(d[1]-d[0])))
        cv2.line(m,tuple(a.astype(int)),tuple(b.astype(int)),1,wpx)
    return m>0
board=polymask([[0,0],[1,0],[1,1],[0,1]])
inner=polymask([[0.04,0.04],[0.96,0.04],[0.96,0.96],[0.04,0.96]])
outer=polymask([[-0.04,-0.04],[1.04,-0.04],[1.04,1.04],[-0.04,1.04]])
sheep=np.zeros((H,W),bool)
for sp in L['sheep']:
    x,y=sp['px']; x*=W/2376; y*=H/1432; sheep[int(y-45):int(y+12),int(x-36):int(x+36)]=True
trees=np.zeros((H,W),bool)
for u,v,sc,k in L['trees']:
    x,y=proj([[u,v]])[0]; r=int(36*sc); trees[max(0,int(y-2.3*r)):int(y+0.4*r),max(0,int(x-r)):int(x+r)]=True
objects=sheep|trees
river=linemask(L['river'],L['riverW']*1.25)&~objects
path=linemask(L['path'],L['pathW']*1.1)&~objects&~river
hed=np.zeros((H,W),bool)
for h in L['hedges']: hed|=linemask(h,0.02)
wheat=polymask(L['wheat'])&inner&~objects&~path&~hed
lime=(polymask(L['lime']) if 'lime' in L else np.zeros((H,W),bool))&inner&~objects&~hed
dark=polymask(L['dark'])&inner&~objects&~river&~hed&~lime
bright=polymask(L['bright'])&inner&~objects&~path&~hed&~wheat
light=inner&~polymask(L['dark'])&~polymask(L['bright'])&~polymask(L['wheat'])&~objects&~river&~path&~hed
edge=outer&~inner&~objects
paper=~outer&~objects
regions=dict(paper=paper,edge=edge,light=light,bright=bright,dark=dark,lime=lime,wheat=wheat,river=river,path=path,hedges=hed&inner&~objects,sheep=sheep,trees=trees,all=np.ones((H,W),bool))
g1=cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY); g2=cv2.cvtColor(bld,cv2.COLOR_BGR2GRAY)
_,smap=ssim(g1,g2,full=True,gaussian_weights=True,sigma=1.5,data_range=255)
l1=cv2.GaussianBlur(g1,(0,0),4.0); l2=cv2.GaussianBlur(g2,(0,0),4.0)
_,lmap=ssim(l1,l2,full=True,gaussian_weights=True,sigma=1.5,data_range=255)
h1=g1.astype(np.float32)-cv2.GaussianBlur(g1,(0,0),2.0).astype(np.float32); h2=g2.astype(np.float32)-cv2.GaussianBlur(g2,(0,0),2.0).astype(np.float32)
b1=cv2.GaussianBlur(ref,(0,0),2.0); b2=cv2.GaussianBlur(bld,(0,0),2.0)
lab1=rgb2lab(b1[...,::-1]/255.); lab2=rgb2lab(b2[...,::-1]/255.)
de=deltaE_ciede2000(lab1,lab2)
res={}
for k,m in regions.items():
    if m.sum()<50: continue
    res[k]=dict(ssim=round(float(smap[m].mean()),3),lf=round(float(lmap[m].mean()),3),hf=round(float(h2[m].std()/(h1[m].std()+1e-6)),2),dE=round(float(de[m].mean()),2),
                dL=round(float((lab2[...,0]-lab1[...,0])[m].mean()),1),da=round(float((lab2[...,1]-lab1[...,1])[m].mean()),1),db=round(float((lab2[...,2]-lab1[...,2])[m].mean()),1))
json.dump(res,open(f'out/{tag}_scores.json','w'),indent=1)
for k,v in res.items(): print(f'{k:8s} ssim {v["ssim"]:.3f} lf {v["lf"]:.3f} hf {v["hf"]:.2f}  dE {v["dE"]:5.2f}  dL {v["dL"]:+5.1f} da {v["da"]:+5.1f} db {v["db"]:+5.1f}')
# outputs
lab=lambda im,t: cv2.putText(im.copy(),t,(14,32),cv2.FONT_HERSHEY_SIMPLEX,0.9,(40,40,40),2,cv2.LINE_AA)
cv2.imwrite(f'out/{tag}_sbs.png',np.hstack([lab(ref,'reference (video frame)'),np.full((H,6,3),255,np.uint8),lab(bld,'recreation')]))
hm=cv2.applyColorMap(np.clip(de*12,0,255).astype(np.uint8),cv2.COLORMAP_INFERNO)
ov=cv2.addWeighted(cv2.cvtColor(cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY),cv2.COLOR_GRAY2BGR),0.35,hm,0.65,0)
cv2.imwrite(f'out/{tag}_diff.png',np.hstack([lab(ov,'CIEDE2000 colour difference (bright = differs)'),np.full((H,6,3),255,np.uint8),lab(cv2.addWeighted(ref,0.5,bld,0.5,0),'50/50 overlay')]))
fr=[Image.fromarray(lab(x,t)[...,::-1]).resize((W//2*2//2,H//2)) for x,t in [(ref,'reference'),(bld,'recreation')]]
fr[0].save(f'out/{tag}_blink.gif',save_all=True,append_images=fr[1:],duration=700,loop=0)
# region map for documentation
if tag.endswith('1'):
    rm=np.zeros((H,W,3),np.uint8); pal=[(200,200,200),(120,120,120),(80,200,160),(40,180,40),(30,110,60),(60,190,220),(220,90,30),(140,200,230),(10,60,10),(255,255,255),(200,60,200)]
    for (k,m),c in zip(regions.items(),pal): rm[m]=c
    cv2.imwrite('out/regions_map.png',rm)
