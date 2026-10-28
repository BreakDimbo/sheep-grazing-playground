import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
def M(im):
    c=im[740:1060,280:580].astype(float); b,g,r=c[...,0],c[...,1],c[...,2]; m=((r+b)/2>g+25).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)); return m
a,b=M(ref),M(us)
for nm,m in [('ref',a),('us',b)]:
    ys,xs=np.nonzero(m); print(nm,'area',m.sum(),'bbox',xs.min()+280,ys.min()+740,xs.max()+280,ys.max()+740,'w/h',round((xs.max()-xs.min())/(ys.max()-ys.min()),2),'c',round(xs.mean()+280),round(ys.mean()+740))
print('IoU',round((a&b).sum()/(a|b).sum(),3))
