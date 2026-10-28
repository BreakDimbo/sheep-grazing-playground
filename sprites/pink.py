import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png'); us=cv2.resize(cv2.imread(sys.argv[1]),(2376,1432))
for nm,im in [('ref',ref),('us',us)]:
    c=im[800:1000,320:540].reshape(-1,3).astype(float); b,g,r=c.T; m=((r+b)/2>g+25)
    hsv=cv2.cvtColor(im[800:1000,320:540],cv2.COLOR_BGR2HSV).reshape(-1,3)[m]
    print(nm,'n',m.sum(),'rgb',np.median(c[m],0)[::-1],'p10',np.percentile(c[m],10,0)[::-1].round(),'p90',np.percentile(c[m],90,0)[::-1].round(),'S',np.median(hsv[:,1]))
