import cv2,numpy as np,sys
P=np.array([208,221,228])
def x0s(im,lines):
  cov=(np.abs(im.astype(int)-P).sum(-1)>40); out=[]
  for l in lines:
    sm=np.convolve(cov[l,:900],np.ones(15)/15,'same'); xs=np.nonzero(sm>0.97)[0]; out.append(xs[0] if len(xs) else -1)
  return np.array(out)
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
sides={'left':(lambda I:I, range(300,1300,50)),'top':(lambda I:I.transpose(1,0,2), range(500,2000,75)),
 'right':(lambda I:I[:,::-1], range(200,1100,50)),'bottom':(lambda I:I[::-1].transpose(1,0,2), range(500,1900,75))}
for k,(f,ls) in sides.items():
  a=x0s(f(ref),ls); b=x0s(f(us),ls); print(k, 'ref-ours:', (a-b).tolist())
