# ez4.py render tag -> out/{tag}_e_{top,left,right,bottom}.jpg (ref | ours, 3x nearest) + one blink gif of all four
import cv2,numpy as np,sys
from PIL import Image
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC); tag=sys.argv[2]
C={'top':(1150,200,1450,320),'left':(300,700,450,880),'right':(1960,620,2110,800),'bottom':(850,1160,1150,1280)}
A=[];B=[]
for k,(x0,y0,x1,y1) in C.items():
    f=3
    a=cv2.resize(ref[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_NEAREST); b=cv2.resize(us[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_NEAREST)
    cv2.imwrite(f'out/{tag}_e_{k}.jpg',np.hstack([a,np.full((a.shape[0],8,3),0,np.uint8),b]),[cv2.IMWRITE_JPEG_QUALITY,88])
