import cv2,numpy as np,sys
ref=cv2.imread('ref/F0.png')
c=ref[740:1060,280:580].astype(float); m=((c[...,2]+c[...,0])/2>c[...,1]+25)
m=cv2.erode(m.astype(np.uint8),np.ones((7,7),np.uint8))>0
for t in sys.argv[1:]:
    u=cv2.resize(cv2.imread(t),(2376,1432),interpolation=cv2.INTER_CUBIC)[740:1060,280:580].astype(float)
    um=((u[...,2]+u[...,0])/2>u[...,1]+25); both=m&um
    print(t,'ref',c[both].mean(0)[::-1].round(),'us',u[both].mean(0)[::-1].round(),'ratio',(c[both].mean(0)/u[both].mean(0))[::-1].round(3),'refsd',c[both].std(0)[::-1].round(),'ussd',u[both].std(0)[::-1].round())
