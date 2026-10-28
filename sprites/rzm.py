# rzm.py render tag : 3 river crops stacked, ref|ours
import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC)
rows=[]
for (x0,y0,x1,y1) in [(500,300,760,560),(560,700,800,960),(430,980,690,1240)]:
  a=cv2.resize(ref[y0:y1,x0:x1],(400,400),interpolation=cv2.INTER_CUBIC); b=cv2.resize(us[y0:y1,x0:x1],(400,400),interpolation=cv2.INTER_CUBIC)
  rows.append(np.hstack([a,np.full((400,6,3),255,np.uint8),b]))
cv2.imwrite(f'out/{sys.argv[2]}_river3.jpg',np.vstack([np.vstack([r,np.full((6,806,3),255,np.uint8)]) for r in rows]))
