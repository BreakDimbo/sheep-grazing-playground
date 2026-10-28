# zc.py render tag x0 y0 x1 y1 [scale]  -> out/{tag}_zc.jpg (ref top / ours bottom) + blink
import cv2,numpy as np,sys
from PIL import Image
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC); tag=sys.argv[2]
x0,y0,x1,y1=map(int,sys.argv[3:7]); f=float(sys.argv[7]) if len(sys.argv)>7 else 1000/(x1-x0)
a=cv2.resize(ref[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_NEAREST); b=cv2.resize(us[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_NEAREST)
cv2.imwrite(f'out/{tag}_zc.jpg',np.vstack([a,np.full((6,a.shape[1],3),255,np.uint8),b]),[cv2.IMWRITE_JPEG_QUALITY,90])
fr=[Image.fromarray(x[...,::-1]) for x in (a,b)]; fr[0].save(f'out/{tag}_zc_blink.gif',save_all=True,append_images=fr[1:],duration=700,loop=0)
