# usage: zs.py render.png tag  -> zoomed sbs crops + guard metrics + texture stats
import cv2,numpy as np,sys,subprocess
from PIL import Image
f,tag=sys.argv[1],sys.argv[2]
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(f),(2376,1432),interpolation=cv2.INTER_CUBIC)
crops={'leftedge_dark':(150,420,750,1180),'river':(700,300,1400,800),'wheat_path':(1300,800,2100,1350),'bright_hedges':(1200,150,2000,650),'grain':(450,750,750,950)}
for k,(x0,y0,x1,y1) in crops.items():
    a=ref[y0:y1,x0:x1]; b=us[y0:y1,x0:x1]
    if k=='grain': a=cv2.resize(a,None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST); b=cv2.resize(b,None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST)
    cv2.imwrite(f'out/{tag}_z_{k}.jpg',np.hstack([a,np.full((a.shape[0],8,3),255,np.uint8),b]),[cv2.IMWRITE_JPEG_QUALITY,90])
    fr=[Image.fromarray(x[...,::-1]) for x in (a,b)]; fr[0].save(f'out/{tag}_z_{k}_blink.gif',save_all=True,append_images=fr[1:],duration=600,loop=0)
