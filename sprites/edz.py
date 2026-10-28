import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC)
x0,y0,x1,y1=60,800,380,1100
a=cv2.resize(ref[y0:y1,x0:x1],None,fx=1.6,fy=1.6); b=cv2.resize(us[y0:y1,x0:x1],None,fx=1.6,fy=1.6)
cv2.imwrite(sys.argv[2],np.hstack([a,np.full((a.shape[0],6,3),255,np.uint8),b]))
