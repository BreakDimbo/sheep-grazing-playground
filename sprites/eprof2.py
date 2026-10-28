import cv2,numpy as np,sys
P=np.array([208,221,228])
def prof(im,lines,maxd=900):
  im=im.astype(int); cov=(np.abs(im-P).sum(-1)>40)
  cnt=np.zeros(120);cv=np.zeros(120);cs=np.zeros((120,3));cc=np.zeros(120)
  for l in lines:
    row=cov[l,:maxd]; sm=np.convolve(row,np.ones(15)/15,'same'); xs=np.nonzero(sm>0.97)[0]
    if not len(xs): continue
    x0=xs[0]
    for o in range(-60,60):
      x=x0+o
      if 0<=x<maxd: cv[o+60]+=row[x]; cnt[o+60]+=1
      if 0<=x<maxd and row[x]: cs[o+60]+=im[l,x]; cc[o+60]+=1
  return cv/np.maximum(cnt,1), cs/np.maximum(cc,1)[:,None]
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
sides={'left':(lambda I:I, range(700,1300,3)),'top':(lambda I:I.transpose(1,0,2), range(800,1700,3)),
 'right':(lambda I:I[:,::-1], range(300,1000,3)),'bottom':(lambda I:I[::-1].transpose(1,0,2), range(700,1500,3))}
for k,(f,ls) in sides.items():
  a,ac=prof(f(ref),ls); b,bc=prof(f(us),ls); print(k)
  for o in range(10,120,10): print(' ',o-60, f'{a[o]:.2f} {b[o]:.2f}', ac[o][::-1].astype(int), bc[o][::-1].astype(int))
