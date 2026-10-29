import cv2,numpy as np,sys
def mask(p):
    im=cv2.resize(cv2.imread(p),(2376,1432))[0:340,1150:1750]
    L=cv2.cvtColor(cv2.GaussianBlur(im,(0,0),3).astype(np.float32)/255,cv2.COLOR_BGR2Lab)
    paper=np.median(L[0:30].reshape(-1,3),0)
    d=np.linalg.norm(L-paper,axis=2); m=(d>float(__import__("os").environ.get("TH","1.8")))&(L[...,1]>-4)&(np.arange(340)[:,None]<255)
    m=cv2.morphologyEx(m.astype(np.uint8),cv2.MORPH_OPEN,np.ones((7,7),np.uint8)); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m); i=1+np.argmax(st[1:,4]); return (lab==i).astype(np.uint8),st[i]
if __name__=='__main__':
    for p in sys.argv[1:]:
        m,st=mask(p); x,y,w,h,a=st; print(p,'bbox x',x+1150,'y',y,'w',w,'h',h,'area',a,'cx',x+1150+w/2,'cy',y+h/2)
        cv2.imwrite('out/X_cm_'+p.split('/')[-1].replace('.png','.png'),m*255)
