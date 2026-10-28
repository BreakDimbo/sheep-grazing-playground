# edge profile on the left board edge: rows 700..1300; coverage (non-paper) and paint colour vs offset from the solid-paint start
import cv2,numpy as np,sys
def prof(im):
  im=im.astype(int); P=np.array([208,221,228]); 
  cov=(np.abs(im-P).sum(-1)>40)
  covp=[];col=[]
  res=np.zeros((2,120));cnt=np.zeros(120);cs=np.zeros((120,3));cc=np.zeros(120)
  for y in range(700,1300,3):
    row=cov[y,0:700]; sm=np.convolve(row,np.ones(15)/15,'same')
    xs=np.nonzero(sm>0.97)[0]
    if not len(xs): continue
    x0=xs[0]
    for o in range(-60,60):
      x=x0+o
      if 0<=x<700: res[0,o+60]+=row[x]; cnt[o+60]+=1
      if 0<=x<700 and row[x]: cs[o+60]+=im[y,x]; cc[o+60]+=1
  return res[0]/np.maximum(cnt,1), cs/np.maximum(cc,1)[:,None]
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
a,ac=prof(ref); b,bc=prof(us)
for o in range(0,120,5): print(o-60, f'{a[o]:.2f} {b[o]:.2f}', ac[o][::-1].astype(int), bc[o][::-1].astype(int))
