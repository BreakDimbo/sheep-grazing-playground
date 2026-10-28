# river cross-profile: for rows 320..1200 step 20, find water span (blue mask) and sample 11 bins across; median RGB per bin
import cv2,numpy as np,sys
def prof(img):
  r=img.astype(int); b,g,R=r[...,0],r[...,1],r[...,2]; m=(b>R+40)&(b>g)
  bins=[[] for _ in range(11)]
  for y in range(320,1200,8):
    xs=np.nonzero(m[y,400:800])[0]+400
    if len(xs)<30: continue
    x0,x1=xs.min(),xs.max()
    for i in range(11):
      x=int(x0+(x1-x0)*(i+.5)/11); bins[i].append(img[y,x])
  return [np.median(np.array(v),0).astype(int)[::-1] for v in bins]
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
for a,b in zip(prof(ref),prof(us)): print(a,b)
