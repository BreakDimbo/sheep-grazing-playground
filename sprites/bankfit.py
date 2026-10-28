# bankfit.py ours.png -> per-river-point half-width multipliers (left,right) so our water edges land on the reference's
import cv2,numpy as np,json,sys
s=open('site/layout.js').read(); L=json.loads(s[s.find('=')+1:].strip().rstrip(';'))
H=np.array(L['cam']['Hpix'] if 'cam' in L else L['Hpix']).reshape(3,3); pts=np.array(L['river'])
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC)
def wm(im): r=im.astype(int); b,g,R=r[...,0],r[...,1],r[...,2]; return ((b>R+40)&(b>g+5)).astype(np.uint8)
mr,mu=wm(ref),wm(us)
mr=cv2.morphologyEx(mr,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8)); mu=cv2.morphologyEx(mu,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
P=np.c_[pts,np.ones(len(pts))]@H.T; px=P[:,:2]/P[:,2:]
def span(m,x,y):
    y=int(round(y)); x=int(round(x))
    if y<0 or y>=m.shape[0] or x<0 or x>=m.shape[1] or not m[y,x]: return None
    row=m[y]; l=x
    while l>0 and row[l-1]: l-=1
    r=x
    while r<m.shape[1]-1 and row[r+1]: r+=1
    return x-l, r-x
mL=[];mR=[]
for (x,y) in px:
    a=span(mr,x,y); b=span(mu,x,y)
    if a and b and min(b)>3 and min(a)>3: mL.append(a[0]/b[0]); mR.append(a[1]/b[1])
    else: mL.append(np.nan); mR.append(np.nan)
def fill(v):
    v=np.array(v); i=np.arange(len(v)); ok=~np.isnan(v); v=np.interp(i,i[ok],v[ok]); v=np.clip(v,0.75,1.3)
    k=np.ones(3)/3; return np.convolve(np.pad(v,1,mode='edge'),k,'valid')
mL,mR=fill(mL),fill(mR)
print('valid',int(np.sum(~np.isnan(np.array([1])))),'L',mL.round(2).tolist()[:40]); print('R',mR.round(2).tolist()[:40])
print('stats L',mL.mean().round(3),mL.std().round(3),'R',mR.mean().round(3),mR.std().round(3))
json.dump({'L':mL.round(3).tolist(),'R':mR.round(3).tolist()},open('out/bankfit.json','w'))
