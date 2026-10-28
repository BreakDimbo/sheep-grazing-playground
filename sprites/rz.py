import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC)
for i,(x0,y0,x1,y1) in enumerate([(560,700,800,960),(500,300,760,560),(430,980,690,1240)]):
  a=cv2.resize(ref[y0:y1,x0:x1],None,fx=2,fy=2,interpolation=cv2.INTER_CUBIC); b=cv2.resize(us[y0:y1,x0:x1],None,fx=2,fy=2,interpolation=cv2.INTER_CUBIC)
  cv2.imwrite(sys.argv[2].replace('.jpg',f'_{i}.jpg'),np.hstack([a,np.full((a.shape[0],6,3),255,np.uint8),b]))
