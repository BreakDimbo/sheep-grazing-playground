# allz.py render tag -> out/{tag}_item_{name}.jpg (ref | ours) + _blink.gif for the six visual items
import cv2,numpy as np,sys
from PIL import Image
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432),interpolation=cv2.INTER_CUBIC); tag=sys.argv[2]
items={'1_grain':[(1380,620,1640,780),(450,750,750,950)],'2_flowers':[(380,380,640,600),(1380,560,1640,780)],
 '3_edge':[(60,800,380,1100),(1900,250,2200,500)],'4_hedges':[(1420,560,1720,760),(1200,150,1600,420)],
 '5_river':[(500,300,760,560),(560,700,800,960),(430,980,690,1240)],'6_pink':[(290,760,570,1020)]}
for k,cs in items.items():
  A=[];B=[]
  for (x0,y0,x1,y1) in cs:
    f=360/(y1-y0); a=cv2.resize(ref[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_CUBIC); b=cv2.resize(us[y0:y1,x0:x1],None,fx=f,fy=f,interpolation=cv2.INTER_CUBIC)
    A.append(a);B.append(b)
  sep=lambda h:np.full((h,6,3),255,np.uint8)
  a=np.hstack(sum([[x,sep(360)] for x in A],[])[:-1]); b=np.hstack(sum([[x,sep(360)] for x in B],[])[:-1])
  cv2.imwrite(f'out/{tag}_item_{k}.jpg',np.vstack([a,np.full((8,a.shape[1],3),255,np.uint8),b]),[cv2.IMWRITE_JPEG_QUALITY,90])
  fr=[Image.fromarray(x[...,::-1]) for x in (a,b)]; fr[0].save(f'out/{tag}_item_{k}_blink.gif',save_all=True,append_images=fr[1:],duration=700,loop=0)
print('ok')
